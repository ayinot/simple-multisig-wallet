const ethUtil = require('ethereumjs-util');
const keythereum = require("keythereum");
require('dotenv').load();
const BN = require('bn.js');
let Web3 = require("web3");

let web3 = new Web3("https://ropsten.infura.io/qe93eRW1ZLx44WsdN2wh");

/**
 *@dev function used to sign using ethereumjs-util ecsign method
 *@param {* String} _messageHash is the hash the message ot be signed
 *@param {* String}  _privateKey is the private key the owner to sign the message this can be done offline
 *@returns sign is the signature object which has the v,r,s part for verification.
 */
exports.signMessage = (_messageHash,_privateKey) => {
    const signature = ethUtil.ecsign(ethUtil.toBuffer(_messageHash),ethUtil.toBuffer(_privateKey))
    const sign = '0x' + Buffer.concat([signature.r, signature.s, Buffer.from([signature.v])]).toString('hex');
    return sign;
}

/**
 * @dev function to hash the transact message
 * @param {*String}  _toAddress is the address to send funds to
 * @param {*Integer} _value is the amount you want to send
 * @param {*Integer} _expireTime is the time limit u allow for this transaction
 * @param {*Integer} _sequenceId counter to iterate the number of transaction
 */
exports.hashSendMultiSig = (_toAddress, _value, _expireTime, _sequenceId) => {
    let messageHash = web3.utils.soliditySha3("TRANSACT", _toAddress,_value, "0x", _expireTime, _sequenceId);
    return messageHash;
}

/**
 * @dev function to hash the transfer signer message
 * @param {*String}  _oldSigner is the address of the existing signer
 * @param {*String}   _newSigner isi the new signer address to change
 * @param {*Integer}  _expireTime is the time limit u allow for this transaction
 * @param {*Integer}  _sequenceId counter to iterate the number of transaction
 */
exports.hashtransferSignership = (_oldSigner,_newSigner, _expireTime, _sequenceId) => {
    let messageHash = web3.utils.soliditySha3("XFERSIGN", _oldSigner, _newSigner, _expireTime, _sequenceId);
    return messageHash;
}


/**
 * @dev function to export private key
 * @param {*String} _address of the private key
 * @param {*String} _datadir is the location of the keystore
 * @param {*String} _password to open the file
 * @returns the private key with appended hex
 */
exports.getPrivateKey = (address, datadir, password) => {
    let keyObject = keythereum.importFromFile(address, datadir);
    let privateKey = keythereum.recover(password, keyObject);
    return privateKey.toString('hex');
}