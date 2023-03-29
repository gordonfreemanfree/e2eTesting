// use this file to test the noobToken actions

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
  Poseidon,
  Bool,
} from 'snarkyjs';
import { NoobToken } from '../noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';
// import { ActionsType } from './noobToken';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const isBerkeley = true;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('Token-test-actions', () => {
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
      zkAppVerificationKey: { data: string; hash: Field } | undefined;

    beforeAll(async () => {
      await isReady;

      // choosing which Blockchain to use
      console.log('choosing blockchain');
      Blockchain = deployToBerkeley
        ? Mina.Network({
            mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
            archive: 'https://archive.berkeley.minaexplorer.com',
          })
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
          AccountUpdate.createSigned(deployerAccount);
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
        console.log('error printing balances');
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

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let actualVerificationKey = Mina.getAccount(zkAppAddress).zkapp
        ?.verificationKey;

      expect(actualVerificationKey?.hash).toEqual(zkAppVerificationKey?.hash);
    }, 10000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    it(`Sending Actions - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('applying actions..');

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: deployerAccount,
        });
      }

      console.log('action 1');
      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },

        () => {
          zkApp.incrementCounter(Field(1));
          // zkApp.incrementCounter();
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait();

      console.log('action 2');
      tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },
        () => {
          zkApp.incrementCounter(Field(1));
          // zkApp.incrementCounter();
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait();

      console.log('action 3');
      tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },
        () => {
          zkApp.incrementCounter(Field(1));
          // zkApp.incrementCounter();
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait();
    }, 10000000);
    // // ------------------------------------------------------------------------
    // // ------------------------------------------------------------------------
    it(`waiting one block to get Actions back later - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('dummy tx');
      let tx = await Mina.transaction(
        {
          sender: deployerAccount,
          memo: 'Dummy Transaction',
          fee: 0.2e9,
        },

        () => {}
      );
      await tx.prove();
      tx.sign([deployerKey]);
      await (await tx.send()).wait();
    }, 10000000);

    // // ------------------------------------------------------------------------
    it(`getting Actions back - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('rolling up pending actions..');

      console.log('state before: ' + zkApp.actionCounter.get());

      let tx = await Mina.transaction(
        { sender: deployerAccount, fee: 0.2e9 },
        () => {
          zkApp.rollUpActions();
        }
      );
      await tx.prove();
      await (await tx.sign([deployerKey]).send()).wait();

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
        });
        await fetchAccount({
          publicKey: deployerAccount,
        });
      }

      let currentActionCounter = zkApp.actionCounter.get();

      // console.log('state after rollup: ' + zkApp.actionCounter.get());
      expect(currentActionCounter).toEqual(Field(3));
    }, 10000000);
  }

  // runTests();
});
