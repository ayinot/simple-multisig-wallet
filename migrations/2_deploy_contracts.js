var SimpleWallet = artifacts.require("./SimpleWallet.sol");

module.exports = function(deployer) {
  deployer.deploy(SimpleWallet,['0xbc324446023e9315E275a184Ec47ac8B7dC8f8a7','0x3bcAA20a1e16B0b9E80812C0173F89c0b6F34Fad','0x32d87cd19475a8C9dcD0Df0A21d2ea5e3F9BF359','0x9dA3aDa966fC92D96550F9623cE40b9A0EB8FB2B']);
};
