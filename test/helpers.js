const ethUtil = require('ethereumjs-util');
const BN = require('bn.js');

/**
 *@dev function used to sign using ethereumjs-util ecsign method
 *@param messageHash is the hash the message ot be signed
 *@param privateKey is the private key the owner to sign the message this can be done offline
 *@returns sign is the signature object which has the v,r,s part for verification.
 */
exports.signMessage = (messageHash,privateKey) => {
    const signature = ethUtil.ecsign(ethUtil.toBuffer(messageHash),ethUtil.toBuffer(privateKey))
    const sign = '0x' + Buffer.concat([signature.r, signature.s, Buffer.from([signature.v])]).toString('hex');
    return sign;
}