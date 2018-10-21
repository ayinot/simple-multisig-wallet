let Web3 = require("web3");
let web3 = new Web3("http://127.0.0.1:8545");
const truffleAssert = require('truffle-assertions');
const ethUtil = require('ethereumjs-util');
const helpers = require('./helpers');
const assert = require("chai").assert;
require('chai')
    .use(require('chai-as-promised'))
    .should();


let SimpleWallet = artifacts.require("./SimpleWallet.sol");

contract('Multisig wallet', function (accounts) {
    const privateKey = "0xc0cc5aaa4452920817bcdc682ee3dc3028e24c3a7c18b4382f3a4f5e09411a36"
    let walletInstance;
    let forwarderAddress;
    let blockNumber;
    let package1 = 45;
    let package2 = 55;

    describe('Test simple wallet', async function(){

        before('Should create a contract',async function () {
            walletInstance = await SimpleWallet.new([accounts[0],accounts[1],accounts[2],accounts[3]]);
        })

        it('Should verify themselves', async function () {
            await walletInstance.verifySigner({from:accounts[0]})
            await walletInstance.verifySigner({from:accounts[1]})
            await walletInstance.verifySigner({from:accounts[2]})
            await walletInstance.verifySigner({from:accounts[3]})
        })

        it('Should Create forwarder', async function() {
            await walletInstance.createForwarder()
            forwarderAddress = await walletInstance.forwarders.call(0);
        })

        it('Should Transfer signerShip accounts[3] to accounts[4] ', async function() {
            blockNumber = await web3.eth.getBlockNumber();
            blockNumber = blockNumber+40;
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashtransferSignership(accounts[3],accounts[4],blockNumber,seqId.toNumber())
            let sign = helpers.signMessage(messageHash,privateKey);
            await walletInstance.transferSignership(accounts[3],accounts[4],blockNumber,seqId,sign.toString('hex'),{from:accounts[0]})

        })

        it('Should send money to Forwarder contract address', async function() {
            await web3.eth.sendTransaction({from:accounts[7],to:forwarderAddress, value:web3.utils.toWei(package1.toString(),'ether')});
            let balance = await web3.eth.getBalance(walletInstance.address);
            assert.equal(balance,web3.utils.toWei(package1.toString(), "ether"),"Wallet contract should have 45 ether balance")
        })

        it('Should reject when we are trying to send from non registered signer', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashtransferSignership (accounts[4],accounts[5],blockNumber,seqId.toNumber())
            let sign = helpers.signMessage(messageHash,privateKey);
            signer = await walletInstance.signers.call(accounts[5]);
            assert.equal(signer[0],false,"Signer should be allowed")
            assert.equal(signer[1],false,"Signer should be verified")
            await walletInstance.transferSignership (accounts[4],accounts[5],blockNumber,seqId,sign.toString('hex'),{from:accounts[5]}).should.be.rejected;
        })

        it('Should reject when we are trying to send from allowed but not verified signer', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashtransferSignership (accounts[4],accounts[5],blockNumber,seqId.toNumber())
            let sign = helpers.signMessage(messageHash,privateKey);
            signer = await walletInstance.signers.call(accounts[4]);
            assert.equal(signer[0],true,"Signer should be allowed")
            assert.equal(signer[1],false,"Signer should be verified")
            await walletInstance.transferSignership (accounts[4],accounts[5],blockNumber,seqId,sign.toString('hex'),{from:accounts[4]}).should.be.rejected;
        })

        it('Should reject when tried to send funds after the time has expired ', async function() {

            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashSendMultiSig(accounts[5],web3.utils.toWei(package1.toString(),'ether'),blockNumber-80,seqId.toNumber())

            let sign = helpers.signMessage(messageHash,privateKey)
            await walletInstance.sendMultiSig(accounts[5],web3.utils.toWei(package1.toString(), "ether"),'0x',blockNumber-80,seqId,sign.toString('hex'),{from:accounts[0]}).should.be.rejected;

            let balance = await web3.eth.getBalance(walletInstance.address);
            assert.equal(balance,web3.utils.toWei(package1.toString(),'ether'),"toAddress should have balance as 45 ether")
        })

        it('Should verify 2 signers and send funds to the address', async function() {

            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashSendMultiSig (accounts[5],web3.utils.toWei(package1.toString(),'ether'),blockNumber,seqId.toNumber())

            let signer = await walletInstance.signers.call(accounts[0]);
            assert.equal(signer[0],true,"Signer should be allowed")
            assert.equal(signer[1],true,"Signer should be verified")

            signer = await walletInstance.signers.call(accounts[1]);
            assert.equal(signer[0],true,"Signer should be allowed")
            assert.equal(signer[1],true,"Signer should be verified")

            let sign = helpers.signMessage(messageHash,privateKey)
            await walletInstance.sendMultiSig(accounts[5],web3.utils.toWei(package1.toString(), "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[0]})

            let balance = await web3.eth.getBalance(walletInstance.address);
            assert.equal(balance,0,"toAddress should have balance as 0 ether")
        })

        it('Should reject when trying to withdraw funds from a non signer', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashtransferSignership (accounts[4],accounts[5],blockNumber,seqId.toNumber())
            let sign = helpers.signMessage(messageHash,privateKey);
            signer = await walletInstance.signers.call(accounts[5]);
            assert.equal(signer[0],false,"Signer should be allowed")
            assert.equal(signer[1],false,"Signer should be verified")
            await walletInstance.sendMultiSig(accounts[5],web3.utils.toWei(package1.toString(), "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[5]}).should.be.rejected;
        })

        it('Should reject when trying to withdraw funds from a non verified signer', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashtransferSignership (accounts[4],accounts[5],blockNumber,seqId.toNumber())
            let sign = helpers.signMessage(messageHash,privateKey);
            signer = await walletInstance.signers.call(accounts[4]);
            assert.equal(signer[0],true,"Signer should be allowed")
            assert.equal(signer[1],false,"Signer should be verified")
            await walletInstance.sendMultiSig(accounts[5],web3.utils.toWei(package1.toString(), "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[4]}).should.be.rejected;
        })

        it('Should fail to activate safe mode from non signer', async function() {
            await walletInstance.activateSafeMode({from:accounts[5]}).should.be.rejected;
            let safeMode = await walletInstance.safeMode.call()
            assert.equal(safeMode,false,"Safe mode should be activated")
        })

        it('Should activate safe mode', async function() {
            await walletInstance.activateSafeMode()
            let safeMode = await walletInstance.safeMode.call()
            assert.equal(safeMode,true,"Safe mode should be activated")
        })

        it('Should Create forwarder', async function() {
            await walletInstance.createForwarder()
            forwarderAddress = await walletInstance.forwarders.call(0);
        })

        it('Should send money to Forwarder contract address', async function() {
            await web3.eth.sendTransaction({from:accounts[7],to:forwarderAddress, value:web3.utils.toWei(package2.toString(),'ether')});
            let balance = await web3.eth.getBalance(walletInstance.address);
            assert.equal(balance,web3.utils.toWei(package2.toString(), "ether"),"Wallet contract should have package2 ether balance")
        })

        it('Should reject to non contract address or non signer address in safe mode', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashSendMultiSig (accounts[7],web3.utils.toWei(package2.toString(),'ether'),blockNumber,seqId.toNumber())

            let sign = helpers.signMessage(messageHash,privateKey)
            await walletInstance.sendMultiSig(accounts[7],web3.utils.toWei(package2.toString(), "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[0]}).should.be.rejected;
        })

        it('Should allow to transfer to only to contract address in safe mode', async function() {
            let seqId = await walletInstance.getSequenceId.call()
            let messageHash = helpers.hashSendMultiSig (accounts[1],web3.utils.toWei(package2.toString(),'ether'),blockNumber,seqId.toNumber())

            let sign = helpers.signMessage(messageHash,privateKey)
            await walletInstance.sendMultiSig(accounts[1],web3.utils.toWei(package2.toString(), "ether"),'0x',blockNumber,seqId,sign.toString('hex'),{from:accounts[0]})
        })
    })

})