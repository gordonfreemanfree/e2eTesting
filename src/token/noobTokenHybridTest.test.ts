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

// const SECONDS = 1000;
// jest.setTimeout(70 * SECONDS);
console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const isBerkeley = true;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('foo', () => {
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
      zkAppBAddress: PublicKey;

    beforeAll(async () => {
      await isReady;
      console.log('compiling zkapp');
      if (proofsEnabled) await NoobToken.compile();

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

        // zkAppBPrivateKey = PrivateKey.random();
        // zkAppBAddress = zkAppPrivateKey.toPublicKey();
        zkApp = new NoobToken(zkAppAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({ privateKey: deployerKey, publicKey: deployerAccount } =
          Local.testAccounts[0]);
        // ({
        //   privateKey: senderKey,
        //   publicKey: senderAccount,
        // } = Local.testAccounts[1]);
        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

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
      const txn = await Mina.transaction(deployerAccount, () => {
        // AccountUpdate.createSigned(deployerAccount);
        AccountUpdate.fundNewAccount(deployerAccount);
        zkApp.deploy({});
      });
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      await (await txn.sign([deployerKey, zkAppPrivateKey]).send()).wait();
    }

    async function berkeleyDeploy() {
      console.log('generating deploy transaction');
      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 1.1e9 },
        () => {
          //   AccountUpdate.createSigned(deployerAccount);
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy({ zkappKey: zkAppPrivateKey });
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
    }

    // function fetchAccount(...args: any) {
    //   if (isBerkeley) {
    //     return fetchAccountOriginal(args);
    //   } else {
    //     return Promise.resolve();
    //   }
    // }

    async function printBalances() {
      try {
        console.log(
          `deployerAccount balance:    ${Mina.getBalance(deployerAccount).div(
            1e9
          )} MINA`
        );
        console.log(
          `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
        );
      } catch (e) {
        console.log('error printing balances', e);
      }
    }

    // ------------------------------------------------------------------------
    // deploy zkApp and initialize
    // status: working
    // confirmed: true
    it(`totalAmountInCirculation === 0 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

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
      // await fetchAccount({ publicKey: zkAppAddress });
      const tokenAmount = zkApp.totalAmountInCirculation.get();
      // expect(tokenAmount).toEqual(UInt64.from(0));
      console.log('tokenAmount', tokenAmount.toString());

      // console.log('initializing...');

      // const init_txn = await Mina.transaction(
      //   { sender: deployerAccount, fee: 0.1e9 },
      //   () => {
      //     AccountUpdate.createSigned(zkAppAddress);
      //     zkApp.init();
      //   }
      // );

      // await init_txn.prove();
      // init_txn.sign([zkAppPrivateKey, deployerKey]);
      // await (await init_txn.send()).wait();

      // console.log('initialized');

      expect(tokenAmount).toEqual(UInt64.from(0));
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // check token symbol
    // status: working
    // confirmed: true
    it(`check the tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
      console.log('tokenSymbol is', tokenSymbol);
      expect(tokenSymbol).toEqual('NOOB');
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // change zkAppUri with SignedTransaction
    // status: fails on berkeley because of getAccount() bug
    // confirmed: true
    it(`change zkAppUri with SignedTransaction - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let newUri = 'https://www.newuri.com';
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

      let fetch = await fetchAccount({ publicKey: zkAppAddress });
      console.log('fetch', fetch);
      let account = Mina.getAccount(zkAppAddress);
      console.log('newUri is', account.zkapp?.zkappUri);
      expect(account.zkapp?.zkappUri).toEqual(newUri);
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // change Permissions for setZkAppUri to none
    // status:
    // confirmed:
    it(`change zkAppUri permissions - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let newUri = 'https://www.newuriAfterPermissions.com';

      // change permissions for setZkappUri to none
      // fetchAccount({ publicKey: zkAppAddress });
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
      let oldUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;

      // try to change zkappUri without signature
      const txn_changeZkappUri = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.create(zkAppAddress);
          update.account.zkappUri.set(newUri);
        }
      );
      await txn_changeZkappUri.prove();
      txn_changeZkappUri.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_changeZkappUri.send()).wait();

      let account = Mina.getAccount(zkAppAddress);
      console.log(
        'zkAppUri after Permission change is',
        account.zkapp?.zkappUri
      );
      expect(account.zkapp?.zkappUri).toEqual(newUri);
    }, 1000000);

    // it(`mint 10 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   printBalances();
    //   console.log('minting 10 tokens');
    //   const mintAmount = UInt64.from(10);

    //   const txn10 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mint(zkAppAddress, mintAmount);
    //     }
    //   );
    //   await txn10.prove();
    //   txn10.sign([zkAppPrivateKey, deployerKey]);

    //   const response = await (await txn10.send()).wait();
    //   console.log('response', response);

    //   let newAccountInfo = await fetchAccount({
    //     publicKey: zkAppAddress,
    //     tokenId: zkApp.token.id.toString(),
    //   });
    //   // let newAccountInfo = Mina.getAccount(zkAppAddress, zkApp.token.id)
    //   //   .balance;

    //   // balance of account is
    //   console.log('newAccountInfo', newAccountInfo);
    //   const tokenAmount = zkApp.totalAmountInCirculation.get();
    //   console.log('totalAmountInCirculation', tokenAmount.value.toJSON());
    //   // console.log(
    //   //   'zkApps Tokens',
    //   //   Mina.getBalance(zkAppAddress, zkApp.token.id).toJSON()
    //   // );
    //   // console.log(
    //   //   'zkApps Tokens',
    //   //   Mina.getBalance(zkAppAddress, zkApp.token.id).value.toBigInt()
    //   // );
    //   // console.log(Mina.getAccount(zkAppAddress, zkApp.token.id));
    //   expect(tokenAmount).toEqual(mintAmount);
    // }, 1000000);

    // this should fail because the account balance is 0
    // it(`mintWithMina 1 tokens but balance is 0  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 1 tokens');
    //   printBalances();

    //   let accountInfo = Mina.getAccount(deployerAccount);
    //   console.log('nonce of deployerAccount is', accountInfo.nonce.toJSON());

    //   const txn20 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mintWithMina(deployerAccount, UInt64.from(1));
    //     }
    //   );

    //   console.log('txn20 is', txn20.toPretty());
    //   await txn20.prove();
    //   await txn20.sign([deployerKey, zkAppPrivateKey]);
    //   console.log(txn20.toPretty());
    //   await (await txn20.send()).wait();
    //   let tokenId = zkApp.token.id;
    //   let newNoobBalance = Mina.getAccount(deployerAccount, tokenId).balance;
    //   expect(newNoobBalance).toEqual(UInt64.from(1));
    // }, 1000000);

    // it(`mintWithMina 1 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 1 tokens');
    //   printBalances();

    //   // send 1 Mina to zkApp
    //   const txn = await Mina.transaction(
    //     //   AccountUpdate.getNonce()
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
    //   let response = await (await txn.send()).wait();
    //   console.log('response', response);
    //   printBalances();

    //   let accountInfo = Mina.getAccount(deployerAccount);
    //   console.log('nonce of deployerAccount is', accountInfo.nonce.toJSON());

    //   const txn20 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mintWithMina(deployerAccount, UInt64.from(1));
    //     }
    //   );
    //   //   txn20.transaction.feePayer.body.nonce = txn20.transaction.feePayer.body.nonce.add(
    //   //     3
    //   //   );
    //   console.log('txn20 is', txn20.toPretty());
    //   await txn20.prove();
    //   await txn20.sign([deployerKey, zkAppPrivateKey]);
    //   console.log(txn20.toPretty());
    //   await (await txn20.send()).wait();
    //   let tokenId = zkApp.token.id;
    //   let newNoobBalance = Mina.getAccount(deployerAccount, tokenId).balance;
    //   expect(newNoobBalance).toEqual(UInt64.from(1));
    // }, 1000000);

    // // set URI
    // it(`set the zkApp URI  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   const txn30 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       AccountUpdate.defaultAccountUpdate(deployerAccount);

    //     }
    //   );
    //   await txn30.prove();
    //   txn30.sign([zkAppPrivateKey, deployerKey]);
    //   await (await txn30.send()).wait();
    //   let zkAppUri = Mina.getAccount(zkAppAddress);

    // });

    // it(`set zkAppUri deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   const txn30 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       AccountUpdate.create(zkAppAddress);
    //     }
    //   );
    //   await txn30.prove();
    //   txn30.sign([zkAppPrivateKey, deployerKey]);
    //   await (await txn30.send()).wait();

    //   let verificationKey = Mina.getAccount(zkAppAddress).zkapp
    //     ?.verificationKey;

    //   let zkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;
    //   console.log('zkAppUri', zkAppUri);
    //   expect(zkAppUri).toEqual('https://zkapp.com' + verificationKey);
    // });

    it(`3 not equals 5 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(3).not.toEqual(5);
    });
  }

  runTests();
});
