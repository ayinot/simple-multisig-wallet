const ethUtil = require('ethereumjs-util');
const assert = require("chai").assert;

let SimpleWallet = artifacts.require("./SimpleWallet.sol");

contract('Multisig wallet', function (accounts) {
    let walletInstance;
    let forwarderAddress;
    let blockNumber = web3.eth.blockNUmber;
    blockNumber = blockNumber+40;
    const privateKey = "0xec0e0d4915397fba152731e0cbb000c5079773e7e3a63122637d7e7b27e5ec1d"
    before(async function () {
        walletInstance = await SimpleWallet.new([accounts[0],accounts[1],accounts[2],accounts[3]]);
    })

    describe('Test simple wallet', async function(){

        before('verify themselves', async function () {
            await walletInstance.verifySigner({from:accounts[0]})
            await walletInstance.verifySigner({from:accounts[1]})
            await walletInstance.verifySigner({from:accounts[2]})
            await walletInstance.verifySigner({from:accounts[3]})
        })

        it('Create forwarder', async function() {
            await walletInstance.createForwarder()
            forwarderAddress = await walletInstance.forwarderAddress.call();
        })

        it('Should Transfer signerShip accounts[3] to accounts[4] ', async function() {
            let messageHash = await walletInstance.signTransfer(accounts[3],accounts[4],blockNumber,1)

            let signature = ethUtil.ecsign(ethUtil.toBuffer(messageHash),ethUtil.toBuffer(privateKey))
            let sign = '0x' + Buffer.concat([signature.r, signature.s, Buffer.from([signature.v])]).toString('hex');

            await walletInstance.transferSignership(accounts[3],accounts[4],blockNumber,1,sign.toString('hex'),{from:accounts[0]})

        })

        it('Should send money to Forwarder contract address', async function() {
            await web3.eth.sendTransaction({from:accounts[7],to:forwarderAddress, value:web3.toWei(45, "ether")});
            let balance = await web3.eth.getBalance(walletInstance.address);
            assert.equal(balance.toNumber(),web3.toWei(45, "ether"),"Wallet contract should have 45 ether balance")
        })

        it('Should verify 2 signers and send funds to the address', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            seqId = seqId.toNumber();
            let messageHash = await walletInstance.signSendMultiSig(accounts[5],web3.toWei(40, "ether"),'0x',blockNumber,seqId)

            let signature = ethUtil.ecsign(ethUtil.toBuffer(messageHash),ethUtil.toBuffer(privateKey))
            let sign = '0x' + Buffer.concat([signature.r, signature.s, Buffer.from([signature.v])]).toString('hex');

            let signer = await walletInstance.signers.call(accounts[2]);
            assert.equal(signer[0],true,"Signer should be allowed")
            assert.equal(signer[1],true,"Signer should be verified")

            await walletInstance.sendMultiSig(accounts[5],web3.toWei(40, "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[0]})

        })

    })

})