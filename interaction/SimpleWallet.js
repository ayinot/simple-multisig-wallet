// importing all the libraries
const keythereum = require("keythereum");
const Tx = require('ethereumjs-tx');
const BigNumber = require('bignumber.js');
const ethUtil = require('ethereumjs-util');
const helpers = require('../test/helpers');
require('dotenv').load();
let Web3 = require("web3");

//conecting to rospten
let web3 = new Web3("https://ropsten.infura.io/qe93eRW1ZLx44WsdN2wh");

const datadir = "./";
const address = "633642c036db81fb7a726a37a8b42254556b56f0"; //without the initial '0x'
const password = process.env.PASSWORD;
let BN = web3.utils.BN;


//Initializing contract Objects
let abiArray = JSON.parse('[ { "anonymous": false, "inputs": [ { "indexed": true, "name": "msgSender", "type": "address" }, { "indexed": true, "name": "otherSigner", "type": "address" }, { "indexed": false, "name": "operationCode", "type": "string" }, { "indexed": false, "name": "operation", "type": "bytes32" }, { "indexed": false, "name": "toAddress", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }, { "indexed": false, "name": "data", "type": "bytes" } ], "name": "Transacted", "type": "event" }, { "constant": false, "inputs": [], "name": "activateSafeMode", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "oldSigner", "type": "address" }, { "indexed": false, "name": "newSigner", "type": "address" } ], "name": "SignershipTransfer", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "msgSender", "type": "address" } ], "name": "SafeModeActivated", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "msgSender", "type": "address" } ], "name": "Verified", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "from", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }, { "indexed": false, "name": "data", "type": "bytes" } ], "name": "Deposited", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "forwardContract", "type": "address" }, { "indexed": false, "name": "addressSeq", "type": "uint256" }, { "indexed": false, "name": "currentBlock", "type": "uint256" }, { "indexed": false, "name": "parentAddress", "type": "address" } ], "name": "ForwarderCreate", "type": "event" }, { "constant": false, "inputs": [], "name": "createForwarder", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_toAddress", "type": "address" }, { "name": "_value", "type": "uint256" }, { "name": "_data", "type": "bytes" }, { "name": "_expireTime", "type": "uint256" }, { "name": "_sequenceId", "type": "uint256" }, { "name": "_signature", "type": "bytes" } ], "name": "sendMultiSig", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_oldSigner", "type": "address" }, { "name": "_newSigner", "type": "address" }, { "name": "_expireTime", "type": "uint256" }, { "name": "_sequenceId", "type": "uint256" }, { "name": "_signature", "type": "bytes" } ], "name": "transferSignership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [], "name": "verifySigner", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "name": "_allowedSigners", "type": "address[]" } ], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "payable": true, "stateMutability": "payable", "type": "fallback" }, { "constant": true, "inputs": [], "name": "addressId", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "uint256" } ], "name": "forwarders", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "getSequenceId", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "safeMode", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "signers", "outputs": [ { "name": "allowed", "type": "bool" }, { "name": "verified", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" } ]')
let contractAddress = '0xEc22a12800179A08d168BD0d74c48643323Dd7e9'
const contractObj = new web3.eth.Contract(abiArray, contractAddress);

let privateKey;
keythereum.importFromFile(address, datadir, function (keyObject) {
    privateKey = keythereum.recover(password, keyObject);
});


//Custom Error message
let ENOUGH_ETHER = "Account doesn't have enough ether to make this transaction";

/**
 * @dev signTransaction function signs and sends a transaction to the blockchain network
 * @param {*String} functionData [payload of the transaction]
 * @param {*Promise} resolve [successful promise]
 * @param {*Promise} reject [unsuccessful promise]
 */
async function signTransaction(from, to, functionData, resolve, reject) {
    try {
        var gasObj = {
            to: to,
            from: from,
            data: functionData
        };
        var nonce;
        var gasPrice;
        var gasEstimate;
        var balance;
        try {
            var nonce = await web3.eth.getTransactionCount(from);
            var gasPrice = await web3.eth.getGasPrice();
            gasPrice = new BigNumber(gasPrice);
            var gasEstimate = await web3.eth.estimateGas({ gasObj });
            gasEstimate = new BigNumber(gasEstimate);
            var balance = await web3.eth.getBalance(from);
            balance = new BigNumber(balance);
        } catch (e) {
            console.log(e);
            reject(e);
        }
        if (balance.isLessThan(gasEstimate.times(gasPrice))) {
            reject(ENOUGH_ETHER);
        } else {
            var tx = new Tx({
                to: to,
                nonce: nonce,
                value: '0x',
                gasPrice: web3.utils.toHex(gasPrice.toString()),
                gasLimit: web3.utils.toHex(gasEstimate.plus(200000).toString()),
                data: functionData
            });
            tx.sign(privateKey);
            web3.eth.sendSignedTransaction('0x' + tx.serialize().toString('hex'))
                .on('transactionHash', function (hash) {
                    console.log("transaction hash",hash)
                })
                .on('receipt', function (receipt) {
                    console.log("receipt", receipt)
                    resolve([receipt]);
                })
                .on('error', function (error) {
                    try {
                        console.log(error);
                        var data = error.message.split(':\n', 2);
                        if (data.length == 2) {
                            var transaction = JSON.parse(data[1]);
                            transaction.messesge = data[0];
                            return resolve([transaction]);
                        }
                        reject(error);
                    } catch (e) {
                        reject(e);
                    }
                });
        }
    } catch (e) {
        reject(e);
    }
}

/**
 * @dev withdraws funds from the multi sig wallet contract
 * @param {*String} signer1 is the other signer to get the verification signature
 * @param {*String} toAddress is the address where the funds should be sent
 * @param {*BigNumber} value is the amount we want to withdraw
 */
async function sendMultiSig(signer1,toAddress,value) {
    return new Promise(async (resolve, reject) => {
        try {
            value = web3.utils.toWei(value,'ether');
            let contractBalance = await web3.eth.getBalance(contractAddress)

            if(contractBalance < value) {
                reject('Contract does not have enough balance to withdraw')
            }
            let blockNumber = await web3.eth.getBlockNumber();
            blockNumber = blockNumber+40;
            let seqId = await contractObj.methods.getSequenceId().call();

            let signer1privateKey = await helpers.getPrivateKey(signer1, datadir, password);
            signer1privateKey = '0x'+signer1privateKey;

            let messageHash = helpers.hashSendMultiSig(toAddress,value,blockNumber,seqId)
            let signature = helpers.signMessage(messageHash,signer1privateKey);

            let data = contractObj.methods.sendMultiSig(toAddress,value,'0x',blockNumber,seqId,signature).encodeABI();

            signTransaction('0x'+address,contractAddress,data, resolve, reject).then(function (error, response) {
                if (error) {
                    reject(error);
                } else {
                    return resolve("Successful", response)
                }
            })
        } catch (error) {
            reject(error);
        }
    })
}

/**
 *
 * @param {*String } oldSigner address of the  existing signer who is verified and allowed
 * @param {*String } newSigner address of the  new signer
 */
async function transferSigner(oldSigner,newSigner) {
    return new Promise (async (resolve,reject) =>  {
        try {
            let blockNumber = await web3.eth.getBlockNumber();
            blockNumber = blockNumber+40;
            let seqId = await contractObj.methods.getSequenceId().call();

            let signer1privateKey = await helpers.getPrivateKey(signer1, datadir, password);
            signer1privateKey = '0x'+signer1privateKey;

            let messageHash = helpers.hashtransferSignership(oldSigner,newSigner, blockNumber, seqId)
            let signature = helpers.signMessage(messageHash,signer1privateKey);

            let data = contractObj.methods.transferSignership(oldSigner,newSigner, blockNumber, seqId, signature).encodeABI();

            signTransaction('0x'+address,contractAddress,data, resolve, reject).then(function (error, response) {
                if (error) {
                    reject(error);
                } else {
                    return resolve("Successful", response)
                }
            })

        } catch (error) {
            reject(error)
        }
    })
}




/**
 * withdraw funds from multisig contract
 */
const signer1 = "2464ccfaf33b613786b3383203518caa3894f4a6";
const toAddress = "0xabd362D60E32E5c9EC40CfDDAEFa8d0b91384771";
const value = new BigNumber(2).toString();

// sendMultiSig(signer1,toAddress,value).then(console.log)


/**
 * Transfer signer ship from old owner to new owner
 */
const newSigner  = "0x476637335902321375B004DF6A35dF225EdbB8C0"

transferSigner('0x'+signer1,newSigner)