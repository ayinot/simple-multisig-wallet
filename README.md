## simple-multisig-wallet

simple-mutlisig-wallet requires multiple signers to sign before spending funds from the contract. Transactions can be executed only when verified by predefined users

### Installation and Usage

Prerequisite

1. Node v8+
```
npm -v
```
2. Install truffle and ganache globally 

3. Install
-------------
```
git clone https://github.com/ToniyaSundaram/simple-mutlisig-wallet
cd simple-mutlisig-wallet
npm install
```
4. Compile and migrate test smart contracts
```
truffle compile
truffle migrate --network {ropsten/mainnet}
truffle test
```
### Features:
- Can hold ether with multisig support
- Easy to use offline signing and create consistent messageHash for signing the message
- Transaction data , events logs for readability
- Easy to add signer and remove signer
- Easy usage for private multisig wallets.


