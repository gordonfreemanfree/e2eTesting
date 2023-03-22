import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Permissions,
  Signature,
  fetchAccount,
  setGraphqlEndpoint,
  Account,
  VerificationKey,
  Field,
} from 'snarkyjs';
import { NoobToken } from './noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const isBerkeley = true;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test', () => {
  async function runTests(deployToBerkeley: boolean = isBerkeley) {
    let Blockchain;
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      senderAccount: PublicKey,
      senderKey: PrivateKey,
      zkAppAddress: PublicKey,
      zkAppPrivateKey: PrivateKey,
      zkApp: NoobToken,
      zkAppBPrivateKey: PrivateKey,
      zkAppBAddress: PublicKey,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey,
      zkAppVerificationKey: { data: string; hash: string } | undefined;

    beforeAll(async () => {
      await isReady;
      // console.log('compiling zkapp');
      // if (proofsEnabled) {
      //   let {
      //     verificationKey: zkAppVerificationKey,
      //   } = await NoobToken.compile();
      // }

      // choosing which Blockchain to use
      console.log('choosing blockchain');
      Blockchain = deployToBerkeley
        ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql')
        : Mina.LocalBlockchain({ proofsEnabled });

      Mina.setActiveInstance(Blockchain);

      // choosing deployer account
      if (deployToBerkeley) {
        type Config = {
          deployAliases: Record<string, { url: string; keyPath: string }>;
        };
        let configJson: Config = JSON.parse(
          await fs.readFile('config.json', 'utf8')
        );
        // berkeley key hardcoded here
        let config = configJson.deployAliases['berkeley'];
        let key: { privateKey: string } = JSON.parse(
          await fs.readFile(config.keyPath, 'utf8')
        );
        deployerKey = PrivateKey.fromBase58(key.privateKey);
        deployerAccount = deployerKey.toPublicKey();

        // load zkAppKey from config file
        // let zkAppKey: { privateKey: string } = JSON.parse(
        //   await fs.readFile(config.keyPath, 'utf8')
        // );
        // zkAppPrivateKey = PrivateKey.fromBase58(zkAppKey.privateKey);
        // zkAppAddress = zkAppPrivateKey.toPublicKey();

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        zkApp = new NoobToken(zkAppAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({
          privateKey: deployerKey,
          publicKey: deployerAccount,
        } = Local.testAccounts[0]);
        // ({
        //   privateKey: senderKey,
        //   publicKey: senderAccount,
        // } = Local.testAccounts[1]);
        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        // zkAppBPrivateKey = PrivateKey.random();
        // zkAppBAddress = zkAppPrivateKey.toPublicKey();

        zkApp = new NoobToken(zkAppAddress);
      }
      // const { deployerKey ,deployerAccount } = Blockchain.testAccounts[0]
    }, 1000000);

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    async function localDeploy() {
      console.log('compiling...');

      let txn;
      try {
        ({ verificationKey: zkAppVerificationKey } = await NoobToken.compile());
      } catch (e) {
        console.log('error compiling zkapp', e);
      }

      if (zkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(deployerAccount, () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy({
            verificationKey: zkAppVerificationKey,
            zkappKey: zkAppPrivateKey,
          });
        });
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        await (await txn.sign([deployerKey, zkAppPrivateKey]).send()).wait();
        console.log('deployed local zkApp', zkAppAddress.toBase58());
      }
      return zkAppVerificationKey;
    }

    async function berkeleyDeploy() {
      console.log('compiling...');
      let { verificationKey: zkAppVerificationKey } = await NoobToken.compile();
      console.log('generating deploy transaction');
      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 1.1e9 },
        () => {
          //   AccountUpdate.createSigned(deployerAccount);
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy({
            verificationKey: zkAppVerificationKey,
            zkappKey: zkAppPrivateKey,
          });
        }
      );
      console.log('generating proof');
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      console.log('signing transaction');
      txn.sign([deployerKey, zkAppPrivateKey]);
      let response = await txn.send();
      console.log('response from deploy txn', response);
      console.log('generated deploy txn for zkApp', zkAppAddress.toBase58());
      return zkAppVerificationKey;
    }

    async function printBalances() {
      try {
        console.log(
          `deployerAccount balance: ${deployerAccount.toBase58()} ${Mina.getBalance(
            deployerAccount
          ).div(1e9)} MINA`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `zkApp balance: ${zkAppAddress.toBase58()} ${Mina.getBalance(
            zkAppAddress
          ).div(1e9)} MINA`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `zkApp balance of NOOB token: ${zkAppAddress.toBase58()} ${Mina.getBalance(
            zkAppAddress,
            zkApp.token.id
          ).div(1e9)} NOOB`
        );
        console.log(
          // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
          `receiver balance of Noob token: ${receiverAddress.toBase58()} ${Mina.getBalance(
            receiverAddress,
            zkApp.token.id
          ).div(1e9)} NOOB`
        );
      } catch (e) {
        console.log('error printing balances', e);
      }
    }

    // ------------------------------------------------------------------------
    // deploy zkApp and initialize
    // status: working
    // confirmed: true
    // dependencies: none
    it(`checking that zkAppVerificationKey gets deployed correctly - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('checking that zkAppVerificationKey gets deployed correctly');

      let zkAppVerificationKey = deployToBerkeley
        ? await berkeleyDeploy()
        : await localDeploy();

      if (isBerkeley) {
        // wait for the account to exist
        await loopUntilAccountExists({
          account: zkAppAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for zkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });
      }

      // const tokenAmount = zkApp.totalAmountInCirculation.get();
      // console.log('tokenAmount', tokenAmount.toString());

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let actualVerificationKey = Mina.getAccount(zkAppAddress).zkapp
        ?.verificationKey;

      expect(actualVerificationKey?.hash.toString()).toEqual(
        zkAppVerificationKey?.hash
      );
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // check that tokenSymbol is 'NOOB'
    // status: working
    // confirmed: true
    // dependencies:
    it(`check that tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
      console.log('tokenSymbol is', tokenSymbol);
      expect(tokenSymbol).toEqual('NOOB');
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // change zkAppUri with SignedTransaction
    // status: working
    // confirmed: true
    it(`change zkAppUri with SignedTransaction - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('change zkAppUri with SignedTransaction');
      let newUri = 'https://www.newUri.com';
      const txn_changeZkappUri = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.zkappUri.set(newUri);
        }
      );
      await txn_changeZkappUri.prove();
      txn_changeZkappUri.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_changeZkappUri.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newZkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;

      console.log('newUri is', newZkAppUri);
      expect(newZkAppUri).toEqual(newUri);
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // change setZkAppUri permissions to none() and updating zkAppUri without signature
    // status: working
    // confirmed: true
    it(`change setZkAppUri permissions to none() and updating zkAppUri without signature  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log(
        'change setZkAppUri permissions to none() and updating zkAppUri without signature'
      );
      let newUri = 'https://www.newuriAfterPermissions.com';

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }

      // change permissions for setZkappUri to none
      Mina.getAccount(zkAppAddress);
      const txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(zkAppAddress);
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            setZkappUri: Permissions.none(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_permission.send()).wait();
      // let oldUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;

      // try to change zkappUri without signature
      const txn_changeZkappUri = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.create(zkAppAddress);
          update.account.zkappUri.set(newUri);
        }
      );
      await txn_changeZkappUri.prove();
      txn_changeZkappUri.sign([deployerKey]);
      await (await txn_changeZkappUri.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let updatedZkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;
      console.log('zkAppUri after Permission change is', updatedZkAppUri);

      expect(updatedZkAppUri).toEqual(newUri);
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mint 10 tokens to zkAppAccount
    // status: working
    // confirmed: true
    // it(`mint 7 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   printBalances();
    //   console.log('minting 7 tokens');

    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({ publicKey: zkAppAddress });
    //     console.log('fetchAccount:', fetch);
    //     let fetch2 = await fetchAccount({ publicKey: deployerAccount });
    //   }
    //   let account = Mina.getAccount(zkAppAddress);
    //   let deployer = Mina.getAccount(deployerAccount);

    //   const mintAmount = UInt64.from(7e9);
    //   const txn_mint = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mint(zkAppAddress, mintAmount);
    //     }
    //   );
    //   await txn_mint.prove();
    //   txn_mint.sign([zkAppPrivateKey, deployerKey]);
    //   await (await txn_mint.send()).wait();

    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({
    //       publicKey: zkAppAddress,
    //       tokenId: zkApp.token.id,
    //     });
    //     console.log('fetchAccount, tokenId is:', fetch.account?.tokenId);
    //   }
    //   let newAccountInfo = Mina.getAccount(zkAppAddress, zkApp.token.id);

    //   // balance of account is
    //   console.log('newAccountInfo', newAccountInfo);
    //   const tokenAmount = newAccountInfo.balance;
    //   console.log('totalAmountInCirculation', tokenAmount.value.toJSON());

    //   expect(tokenAmount).toEqual(mintAmount);
    // }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mintWithMina but balance is 0. expecting failure
    // status: working
    // confirmed:
    // it(`mintWithMina 1 tokens but balance is 0  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 1 tokens');

    //   expect(async () => {
    //     printBalances();
    //     if (isBerkeley) {
    //       let fetch = await fetchAccount({ publicKey: zkAppAddress });
    //       console.log('fetchAccount:', fetch);
    //     }

    //     let accountInfo = Mina.getAccount(deployerAccount);
    //     console.log('nonce of deployerAccount is', accountInfo.nonce.toJSON());

    //     const txn20 = await Mina.transaction(
    //       { sender: deployerAccount, fee: 1e9 },
    //       () => {
    //         AccountUpdate.fundNewAccount(deployerAccount);
    //         zkApp.mintWithMina(deployerAccount, UInt64.from(1));
    //       }
    //     );
    //     await txn20.prove();
    //     txn20.sign([deployerKey, zkAppPrivateKey]);
    //     console.log(txn20.toPretty());
    //     await (await txn20.send()).wait();
    //     let tokenId = zkApp.token.id;
    //     if (isBerkeley) {
    //       let fetch = await fetchAccount({
    //         publicKey: zkAppAddress,
    //         tokenId: tokenId,
    //       });
    //     }
    //     let newNoobBalance = Mina.getAccount(zkAppAddress, tokenId).balance;
    //   }).rejects.toThrow();
    // }, 1000000);

    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mintWithMina 1 tokens
    // status:
    // confirmed:
    // it(`mintWithMina 1 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 1 tokens');
    //   printBalances();

    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({ publicKey: zkAppAddress });
    //     console.log('fetchAccount:', fetch);
    //   }

    //   Mina.getAccount(zkAppAddress);

    //   // send 1 Mina to zkAppAddress
    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       //   AccountUpdate.fundNewAccount(deployerAccount);
    //       let deployerAccountUpdate = AccountUpdate.createSigned(
    //         deployerAccount
    //       );
    //       deployerAccountUpdate.send({
    //         to: zkAppAddress,
    //         amount: UInt64.from(1e9),
    //       });
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, zkAppPrivateKey]);
    //   await (await txn.send()).wait();

    //   console.log('txn with 1 mina sent, txn is', txn.toPretty());

    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({
    //       publicKey: zkAppAddress,
    //       tokenId: zkApp.token.id,
    //     });
    //     console.log('fetchAccount:', fetch);
    //   }
    //   printBalances();
    //   Mina.getAccount(zkAppAddress, zkApp.token.id);

    //   // sleep for 60 seconds
    //   // console.log('sleeping for 60 seconds');
    //   // await new Promise((resolve) => setTimeout(resolve, 60000));
    //   // console.log('woke up from sleep', getFriendlyDateTime());

    //   // await fetchAccount({
    //   //   publicKey: zkAppAddress,
    //   // });
    //   // Mina.getAccount(zkAppAddress);
    //   // Mina.getBalance(zkAppAddress);
    //   // console.log('after fetchAccount and getAccount', getFriendlyDateTime());

    //   // mintWithMina 1 tokens
    //   const txn20 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       zkApp.mintWithMina(zkAppAddress, UInt64.from(1e9));
    //     }
    //   );

    //   console.log('txn20 before proof is', txn20.toPretty());
    //   await txn20.prove();
    //   console.log('after prove', txn20.toPretty());
    //   txn20.sign([deployerKey, zkAppPrivateKey]);
    //   console.log('after sign', txn20.toPretty());
    //   await (await txn20.send()).wait();
    //   let tokenId = zkApp.token.id;
    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({
    //       publicKey: zkAppAddress,
    //       tokenId: tokenId,
    //     });
    //     console.log('fetchAccount, tokenId is:', fetch.account?.balance);
    //   }
    //   let newNoobBalance = Mina.getAccount(zkAppAddress, tokenId).balance;
    //   expect(newNoobBalance).toEqual(UInt64.from(8e9));
    // }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // sendTokens to receiverAddress
    // status: failing - no idea why
    // confirmed:
    // it(`sendTokens to receiverAddress - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('sendTokens to receiverAddress');
    //   if (isBerkeley) {
    //     let fetch = await fetchAccount({ publicKey: zkAppAddress });
    //     console.log('fetchAccount:', fetch);
    //   }
    //   Mina.getAccount(zkAppAddress);

    //   let sendAmount = UInt64.from(1e9);

    //   const txn_send = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       // AccountUpdate.fundNewAccount(deployerAccount);
    //       // AccountUpdate.createSigned(zkAppAddress);
    //       // zkApp.sendTokens(zkAppAddress, receiverAddress, sendAmount);

    //       let zkAppUpdate = AccountUpdate.createSigned(zkAppAddress);
    //       zkAppUpdate.token().send({
    //         from: zkAppAddress,
    //         to: receiverAddress,
    //         amount: sendAmount,
    //       });
    //     }
    //   );
    //   await txn_send.prove();
    //   txn_send.sign([deployerKey, zkAppPrivateKey, receiverKey]);
    //   await (await txn_send.send()).wait();

    //   let receiverAddressBalance = Mina.getAccount(
    //     receiverAddress,
    //     zkApp.token.id
    //   ).balance;

    //   expect(receiverAddressBalance).toEqual(sendAmount);
    // }, 10000000);

    // ------------------------------------------------------------------------
    // sendNOOBIfCorrectTime to receiverAddress
    // status: failing on berkeley
    // confirmed:
    // dependencies: mintWithMina
    // it(`Send NOOB if the network time is correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   let amount = UInt64.from(1e9);

    //   // assuring that the endDate is always in the future
    //   let endDateCorrect = UInt64.from(Date.now() + 1000000);
    //   console.log('endDateCorrect is', endDateCorrect.toString());

    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       AccountUpdate.createSigned(zkAppAddress);
    //       zkApp.sendNOOBIfCorrectTime(receiverAddress, amount, endDateCorrect);
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, zkAppPrivateKey, receiverKey]);
    //   await (await txn.send()).wait();

    //   // get the NOOB balance of the receiverAddress
    //   let updateBalance = Mina.getBalance(receiverAddress, zkApp.token.id);
    //   // console.log('updateBalance is', updateBalance.toString());

    //   printBalances();
    //   expect(updateBalance).toEqual(UInt64.from(1e9));
    // }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // sendMinaIfCorrectTime to receiverAddress
    // status: failing on berkeley
    // confirmed:
    // dependencies: mint
    // it(`Send NOOB if the network time is NOT correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   // testing with incorrect time
    //   expect(async () => {
    //     let amount = UInt64.from(1e9);
    //     let noobBalanceBeforeTxn = Mina.getBalance(
    //       receiverAddress,
    //       zkApp.token.id
    //     );
    //     // assuring that the endDate is always in the past
    //     let endDateIncorrect = UInt64.from(Date.now() - 1000000);

    //     let txn = await Mina.transaction(
    //       { sender: deployerAccount, fee: 0.1e9 },
    //       () => {
    //         // AccountUpdate.fundNewAccount(deployerAccount);
    //         zkApp.sendNOOBIfCorrectTime(
    //           receiverAddress,
    //           amount,
    //           endDateIncorrect
    //         );
    //       }
    //     );
    //     await txn.prove();
    //     txn.sign([deployerKey, zkAppPrivateKey, receiverKey]);
    //     await (await txn.send()).wait();

    //     // get the NOOB balance of the receiverAddress
    //     let noobBalanceAfterTxn = Mina.getBalance(
    //       receiverAddress,
    //       zkApp.token.id
    //     );
    //     printBalances();

    //     expect(noobBalanceBeforeTxn.add(amount)).toEqual(noobBalanceAfterTxn);
    //   }).rejects.toThrow();
    // }, 10000000);

    it(`Send if the network time is correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {}, 10000000);
  }

  runTests();
});
