var SimpleWallet = artifacts.require("./SimpleWallet.sol");

module.exports = function(deployer) {
  deployer.deploy(SimpleWallet,[web3.eth.accounts[0],web3.eth.accounts[1],web3.eth.accounts[2],web3.eth.accounts[3]]);
};
