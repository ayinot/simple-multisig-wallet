pragma solidity ^0.5.3;

import "./Forwarder.sol";
import "./IERC20.sol";

/**
*
* SimpleWallet
* ============
*
* Basic multi-signer wallet designed for use in a co-signing environment where 2 signatures are required to move funds.
* Typically used in a 2-of-3 signing configuration, this configuration is 2-of-4, 2 hot accounts (allowed and verified) and 2 cold accounts (allowed).
* Uses ecrecover to allow for 2 signatures in a single transaction.
* If either (or both) of the hot accounts are compromised (or have lost their private keys) one (or both) of the cold accounts
*   can be verified (made hot) and used to TransferSignership away from the old compromised accounts to fresh cold accounts.
*
* The first signature is created on the operation hash (see Data Formats) and passed to sendMultiSig/sendMultiSigToken
* The signer is determined by verifyMultiSig().
*
* The second signature is created by the submitter of the transaction and determined by msg.signer.
*
* Data Formats
* ============
*
* The signature is created with ethereumjs-util.ecsign(operationHash).
* Like the eth_sign RPC call, it packs the values as a 65-byte array of [r, s, v].
* Unlike eth_sign, the message is not prefixed.
*
* The operationHash is the result of keccak256(abi.encode(prefix, toAddress, value, data, expireTime, sequenceId)).
* For general Ethereum transactions (including basic ETH send), `prefix` is "TRANSACT", `data` is 0x (for an ETH send without a message), or some preferred message byte code for ETH send with a message, or initialization byte code for a contract creation, or a hashed method signature and parameter data for a contract call.
* For easy token transfer, `prefix` is "ERC20" and `data` is the tokenContractAddress.
* For Signer transfer transaction, `prefix` is "XFERSIGN" and `data` is the .
*
*
*/

contract SimpleWallet {
    // Events
    event ForwarderCreate(address forwardContract, uint256 currentBlock, address parentAddress);
    event Deposited(address from, uint256 value, bytes data);
    event Verified(address msgSender);
    event SafeModeActivated(address msgSender);
    event SignershipTransfer(address oldSigner, address otherSigner, address newSigner);
    event Transacted(
      address indexed msgSender, // Address of the sender of the message initiating the transaction
      address indexed otherSigner, // Address of the signer (second signature) used to initiate the transaction
      string operationCode, // the code of the operation transacted
      bytes32 operation, // Operation hash (see Data Formats)
      address toAddress, // The address the transaction was sent to
      uint256 value, // Amount of Wei sent to the address
      bytes data // Data sent when invoking the transaction
    );
    event ERC20Sent(
      address indexed msgSender, // Address of the sender of the message initiating the transaction
      address indexed otherSigner, // Address of the signer (second signature) used to initiate the transaction
      string operationCode, // the code of the operation transacted
      bytes32 operation, // Operation hash (see Data Formats)
      address toAddress, // The address the transaction was sent to
      uint256 value, // Amount of tokens sent to the address
      address tokenContractAddress // the contract address of the ERC20 token contract which issued and holds token balances
    );

    // Public fields
    mapping(address => Signer) public signers; // The addresses that can co-sign transactions on the wallet
    struct Signer {
        bool allowed; // flag to set when the signing address is allowed to sign transactions
        bool verified; // flag to set when the signing address has verified itself to prove ownership of the account
    }

    bool public safeMode = false; // when active, wallet may only send to signer addresses

    // Private fields
    uint256 private _sequenceId; // the current sequence ID of all transactions on this contract (counts up for every new transaction)

    /**
    * A simple multi-sig wallet by specifying the signers allowed to be used on this wallet.
    * 2 signers will be required to send a transaction from this wallet.
    * Note: The contract deployer is NOT automatically added to the list of signers.
    *
    * @param allowedSigners An array of signers on the wallet
    */
    constructor(address[] memory allowedSigners) public {
        // 4 signers, 2 hot and 2 cold, if one or both of the hot signers are compromised (or priv keys are lost) use cold signers to transfer signership
        require(allowedSigners.length == 4, "only 4 signers allowed");

        for (uint i = 0; i < allowedSigners.length; i++) {
            require(signers[allowedSigners[i]].allowed != true, "each signer address must be unique");
            signers[allowedSigners[i]].allowed = true;
        }
    }

    /**
    * Modifier that will execute internal code block only if the sender is an authorized signer on this wallet
    */
    modifier onlySigner {
        require(signers[msg.sender].allowed && signers[msg.sender].verified, "msg.sender is not allowed or not verfied");
        _;
    }

    /**
    * Gets called when a transaction is received without calling a method
    */
    function() external payable {
        if (msg.value > 0) {
            // Fire deposited event if we are receiving funds
            emit Deposited(msg.sender, msg.value, msg.data);
        }
    }

    /**
    * @dev public function for signers to verify themselves
    */
    function verifySigner() public {
        require(signers[msg.sender].allowed, "Only allowed signer can verify themselves");
        require(!signers[msg.sender].verified, "Signer account already verified");
        signers[msg.sender].verified = true;
        emit Verified(msg.sender);
    }
    /**
    * @dev functionality to replace an old signer with a new signer
    * @param oldSigner signer addresss of the old signer
    * @param newSigner signer addresss of the new signer
    * @param expireTime the number of seconds since 1970 for which this transaction is valid
    * @param sequenceId the unique sequence id obtainable from getNextSequenceId
    * @param signature see Data Formats
    */
    function transferSignership(
        address oldSigner,
        address newSigner,
        uint256 expireTime,
        uint256 sequenceId,
        bytes memory signature
    ) public onlySigner {

        require(signers[newSigner].allowed != true, "_newSigner cannot be an exsisting signer");

        // Verify the other signer
        bytes32 operationHash = keccak256(abi.encodePacked("XFERSIGN", oldSigner, newSigner, expireTime, sequenceId));
        address otherSigner = verifyMultiSig(address(this), operationHash, expireTime, sequenceId, signature);

        _transferSignership(oldSigner, otherSigner, newSigner);
    }

    /**
    * @dev Transfers control of the contract to a newOwner.
    * @param oldSigner is the address of the existing signer
    * @param newSigner The address to include in the signer list.
    */
    function _transferSignership(address oldSigner, address otherSigner, address newSigner) internal {
        // disallow old signer
        delete signers[oldSigner];

        // allow new signer
        signers[newSigner].allowed = true;
        _sequenceId += 1;
        emit SignershipTransfer(oldSigner, otherSigner, newSigner);
    }

    /**
    * Create a new contract (and also address) that forwards ETH funds and can flush ERC20 funds to this contract
    * returns address of newly created forwarder address
    */
    function createForwarder() public {
        Forwarder forwarder = new Forwarder();
        emit ForwarderCreate(address(forwarder), block.number, msg.sender);
    }

    /**
    * Execute a multi-signature transaction from this wallet using 2 signers: one from msg.sender and the other from ecrecover.
    *
    * @param toAddress the destination address to send an outgoing transaction
    * @param value the amount in Wei to be sent
    * @param data the data to send to the toAddress when invoking the transaction
    * @param expireTime the block number until which this transaction is valid
    * @param sequenceId the unique sequence id obtainable from getNextSequenceId
    * @param signature see Data Formats
    */
    function sendMultiSig (
        address toAddress,
        uint value,
        bytes memory data,
        uint expireTime,
        uint sequenceId,
        bytes memory signature
    ) public onlySigner {
        // Verify the other signer
        bytes32 operationHash = keccak256(abi.encodePacked("TRANSACT", toAddress, value, data, expireTime, sequenceId));
        address otherSigner = verifyMultiSig(toAddress, operationHash, expireTime, sequenceId, signature);

        // Success, send the transaction
        // .call.value()() is fine here since only signers can call this function and presumably we trust them from re-entrancy
        require(toAddress.call.value(value)(data), "Transaction send failed");
        _sequenceId += 1;
        emit Transacted(msg.sender, otherSigner, operationHash, toAddress, value, data);
    }

    /**
    * Execute a multi-signature token transfer from this wallet using 2 signers: one from msg.sender and the other from ecrecover.
    * Sequence IDs are numbers starting from 1. They are used to prevent replay attacks and may not be repeated.
    *
    * @param toAddress the destination address to send an outgoing transaction
    * @param value the amount in tokens to be sent
    * @param tokenContractAddress the address of the erc20 token contract
    * @param expireTime the block number until which this transaction is valid
    * @param sequenceId the unique sequence id obtainable from getNextSequenceId
    * @param signature see Data Formats
    */
    function sendMultiSigToken(
        address toAddress,
        uint value,
        address tokenContractAddress,
        uint expireTime,
        uint sequenceId,
        bytes memory signature
    ) public onlySigner {
        // Verify the other signer
        var operationHash = keccak256("ERC20", toAddress, value, tokenContractAddress, expireTime, sequenceId);
        
        address otherSigner = verifyMultiSig(toAddress, operationHash, expireTime, sequenceId, signature);
        
        IERC20 instance = IERC20(tokenContractAddress);
        if (!instance.transfer(toAddress, value)) {
            revert();
        }
        emit ERC20Sent(msg.sender, otherSigner, operationHash, toAddress, value, tokenContractAddress);
    }

    /**
    * Execute a token flush from one of the forwarder addresses. This transfer needs only a single signature and can be done by any signer
    *
    * @param forwarderAddress the address of the forwarder address to flush the tokens from
    * @param tokenContractAddress the address of the erc20 token contract
    */
    function flushForwarderTokens(
        address payable forwarderAddress, 
        address tokenContractAddress
    ) public onlySigner {
        Forwarder forwarder = Forwarder(forwarderAddress);
        forwarder.flushTokens(tokenContractAddress);
    }

    /**
    * Do common verification for all multisig txns
    *
    * @param toAddress the destination address to send an outgoing transaction
    * @param operationHash see Data Formats
    * @param signature see Data Formats
    * @param expireTime the number of seconds since 1970 for which this transaction is valid
    * @param sequenceId the unique sequence id obtainable from getNextSequenceId
    * returns address that has created the signature
    */
    function verifyMultiSig(
        address toAddress,
        bytes32 operationHash,
        uint256 expireTime,
        uint256 sequenceId,
        bytes memory signature
    ) private view returns (address) {

        // Verify that the transaction has not expired
        require(expireTime >= block.number, "Transaction expired");
        require(sequenceId == _sequenceId + 1, "Invalid sequence ID");
        address otherSigner = recoverAddressFromSignature(operationHash, signature);
        require(signers[otherSigner].allowed, "otherSigner not allowed");
        require(signers[otherSigner].verified, "otherSigner not verified");

        // Check if we are in safe mode. In safe mode, the wallet can only send to current signers or this contract
        if(safeMode && toAddress != address(this)){
            // We are in safe mode and if the toAddress is not a signer or not verified. Disallow!
            require(signers[toAddress].allowed, "toAddress not allowed");
            require(signers[toAddress].verified, "toAddress not verified");
            // Furthermore to be as safe as possible only the msg.sender or the otherSigner can receive the transaction (because they have proven they still hold their private keys to sign)
            require(toAddress == msg.sender || toAddress == otherSigner, "toAddress was not msg.sender or otherSigner");
        }

        require(otherSigner != msg.sender, "msg.sender cannot double sign");
        return otherSigner;
    }

    /**
    * Irrevocably puts contract into safe mode. When in this mode, transactions may only be sent to signing addresses.
    */
    function activateSafeMode() public onlySigner {
        safeMode = true;
        emit SafeModeActivated(msg.sender);
    }

    /**
    * Gets signer's address using ecrecover
    * @param operationHash see Data Formats
    * @param signature see Data Formats
    * returns address recovered from the signature
    */
    function recoverAddressFromSignature(
        bytes32 operationHash,
        bytes memory signature
      ) private pure returns (address) {
        if (signature.length != 65) {
            revert();
        }
        // We need to unpack the signature, which is given as an array of 65 bytes (like eth.sign)
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
          r := mload(add(signature, 32))
          s := mload(add(signature, 64))
          v := and(mload(add(signature, 65)), 255)
        }
        if (v < 27) {
            v += 27; // Ethereum versions are 27 or 28 as opposed to 0 or 1 which is submitted by some signing libs
        }
        return ecrecover(operationHash, v, r, s);
    }

    /**
    * @dev functionality to get the sequenceId for the next transaction
    * @return the current _sequenceId plus one
    */
    function getSequenceId() public view returns (uint256){
        return _sequenceId + 1;
    }

}