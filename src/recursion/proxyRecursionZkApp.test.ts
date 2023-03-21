import {
  Mina,
  PublicKey,
  PrivateKey,
  isReady,
  shutdown,
  AccountUpdate,
  UInt64,
  fetchAccount,
  Field,
} from 'snarkyjs';
import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';
import { ProxyRecursionZkApp } from './proxyRecursionZkApp.js';
import { RecursionZkApp } from './recursionZkApp.js';
import { Add } from './recursionZkApp.js';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const isBerkeley = true;
console.log('isBerkeley:', isBerkeley);
let proofsEnabled = true;

describe('proxy-recursion-test', () => {
  async function runTests(deployToBerkeley: boolean = isBerkeley) {
    let Blockchain;
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      //   senderAccount: PublicKey,
      //   senderKey: PrivateKey,
      proxyZkAppAddress: PublicKey,
      proxyZkAppPrivateKey: PrivateKey,
      proxyZkApp: ProxyRecursionZkApp,
      recursionZkAppPrivateKey: PrivateKey,
      recursionZkAppAddress: PublicKey,
      recursionZkApp: RecursionZkApp,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey;
    let addZkAppVerificationKey: string | undefined;

    let proxyZkAppVerificationKey: { data: string; hash: string } | undefined;
    let recursionZkAppVerificationKey:
      | { data: string; hash: string }
      | undefined;
    beforeAll(async () => {
      await isReady;

      // choosing which Blockchain to use
      console.log('choosing blockchain');
      Blockchain = deployToBerkeley
        ? Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql')
        : Mina.LocalBlockchain({ proofsEnabled });

      Mina.setActiveInstance(Blockchain);

      try {
        console.log('compiling Add...');

        ({ verificationKey: addZkAppVerificationKey } = await Add.compile());
        console.log('compiling Proxy...');

        ({
          verificationKey: proxyZkAppVerificationKey,
        } = await ProxyRecursionZkApp.compile());
        console.log('compiling RecursionZkapp...');
        ({
          verificationKey: recursionZkAppVerificationKey,
        } = await RecursionZkApp.compile());
      } catch (e) {
        console.log('error compiling one of the zkapps', e);
      }

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

        proxyZkAppPrivateKey = PrivateKey.random();
        proxyZkAppAddress = proxyZkAppPrivateKey.toPublicKey();

        recursionZkAppPrivateKey = PrivateKey.random();
        recursionZkAppAddress = recursionZkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        recursionZkApp = new RecursionZkApp(recursionZkAppAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({
          privateKey: deployerKey,
          publicKey: deployerAccount,
        } = Local.testAccounts[0]);

        proxyZkAppPrivateKey = PrivateKey.random();
        proxyZkAppAddress = proxyZkAppPrivateKey.toPublicKey();

        recursionZkAppPrivateKey = PrivateKey.random();
        recursionZkAppAddress = recursionZkAppPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        recursionZkApp = new RecursionZkApp(recursionZkAppAddress);
      }
    }, 1000000);

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    async function localDeploy() {
      console.log('localDeploy...');

      let txn;

      if (
        proxyZkAppVerificationKey !== undefined &&
        recursionZkAppVerificationKey !== undefined
      ) {
        txn = await Mina.transaction(deployerAccount, () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          AccountUpdate.fundNewAccount(deployerAccount);

          recursionZkApp.deploy({
            verificationKey: recursionZkAppVerificationKey,
            zkappKey: recursionZkAppPrivateKey,
          });
          proxyZkApp.deploy({
            verificationKey: proxyZkAppVerificationKey,
            zkappKey: proxyZkAppPrivateKey,
          });
        });
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        await (
          await txn
            .sign([deployerKey, recursionZkAppPrivateKey, proxyZkAppPrivateKey])
            .send()
        ).wait();
        console.log('deployed proxyZkApp local', proxyZkAppAddress.toBase58());
        console.log(
          'deployed recursionZkApp local',
          recursionZkAppAddress.toBase58()
        );
      }
    }

    async function berkeleyDeploy() {
      console.log('deploy on Berkeley...');

      let txn;

      if (recursionZkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.1e9 },
          () => {
            AccountUpdate.fundNewAccount(deployerAccount, 2);

            recursionZkApp.deploy({
              verificationKey: recursionZkAppVerificationKey,
              zkappKey: recursionZkAppPrivateKey,
            });
            proxyZkApp.deploy({
              verificationKey: proxyZkAppVerificationKey,
              zkappKey: proxyZkAppPrivateKey,
            });
          }
        );
      } else {
        console.log('zkAppVerificationKey is not defined');
      }
      if (txn === undefined) {
        console.log('txn is not defined');
      } else {
        await txn.prove();
        txn.sign([deployerKey, recursionZkAppPrivateKey]);
        let response = await txn.send();
        console.log('response from recursion deploy is', response);
      }
    }

    async function printBalances() {
      //   try {
      //     console.log(
      //       `deployerAccount balance: ${deployerAccount.toBase58()} ${Mina.getBalance(
      //         deployerAccount
      //       ).div(1e9)} MINA`
      //     );
      //     console.log(
      //       // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
      //       `zkApp balance: ${zkAppAddress.toBase58()} ${Mina.getBalance(
      //         zkAppAddress
      //       ).div(1e9)} MINA`
      //     );
      //     console.log(
      //       // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
      //       `zkApp balance of NOOB token: ${zkAppAddress.toBase58()} ${Mina.getBalance(
      //         zkAppAddress,
      //         zkApp.token.id
      //       ).div(1e9)} NOOB`
      //     );
      //     console.log(
      //       // `zkApp balance: ${Mina.getBalance(zkAppAddress).div(1e9)} MINA`
      //       `receiver balance of Noob token: ${receiverAddress.toBase58()} ${Mina.getBalance(
      //         receiverAddress,
      //         zkApp.token.id
      //       ).div(1e9)} NOOB`
      //     );
      //   } catch (e) {
      //     console.log('error printing balances', e);
      //   }
    }

    it(`deploy zkApps - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

      if (isBerkeley) {
        // wait for the account to exist
        await loopUntilAccountExists({
          account: recursionZkAppAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for recursionZkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });

        await loopUntilAccountExists({
          account: proxyZkAppAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for proxyZkApp account to be deployed...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: true,
        });
      }

      const currentOnChainState = proxyZkApp.onChainState.get();
      console.log('currentOnChainState', currentOnChainState.toString());

      let actualProxyVerificationKeyHash = Mina.getAccount(proxyZkAppAddress)
        .zkapp?.verificationKey?.hash;
      console.log('actualProxyVerificationKey', actualProxyVerificationKeyHash);
      let actualRecursionVerificationKeyHash = Mina.getAccount(
        recursionZkAppAddress
      ).zkapp?.verificationKey?.hash;
      console.log(
        'actualRecursionVerificationKey',
        actualRecursionVerificationKeyHash
      );

      expect(actualProxyVerificationKeyHash?.toString()).toEqual(
        proxyZkAppVerificationKey?.hash
      );
      expect(actualRecursionVerificationKeyHash?.toString()).toEqual(
        recursionZkAppVerificationKey?.hash
      );
    }, 100000000);

    it(`update State through proxy - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      let amount = UInt64.from(100);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          proxyZkApp.callRecursionDummyState(amount, recursionZkAppAddress);
        }
      );
      await txn.prove();
      txn.sign([deployerKey, recursionZkAppPrivateKey]);
      await (await txn.send()).wait();

      if (isBerkeley) {
        let fetch = await fetchAccount({ publicKey: recursionZkAppAddress });
        console.log('fetch', fetch);
      }
      Mina.getAccount(recursionZkAppAddress);

      let currentDummyState = recursionZkApp.dummyState.get();
      console.log('currentDummyState', currentDummyState.toString());

      expect(currentDummyState).toEqual(amount);
    }, 10000000);

    it(`Send if the network time is correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('compiling...');

      //   const { verificationKey } = await Add.compile();

      console.log('making proof 0');

      const proof0 = await Add.init(Field(0));

      console.log('making proof 1');

      const proof1 = await Add.addNumber(Field(4), proof0, Field(4));

      console.log('making proof 2');

      const proof2 = await Add.add(Field(4), proof1, proof0);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          recursionZkApp.proofVerification(proof2);
        }
      );
      await txn.prove();
      txn.sign([deployerKey, recursionZkAppPrivateKey]);
      await (await txn.send()).wait();

      let currentDummyState = recursionZkApp.dummyState.get();
      console.log('currentDummyState', currentDummyState.toString());

      expect(currentDummyState).toEqual(UInt64.from(400));
    }, 10000000);

    // it(`Send if the network time is correct - deployToBerkeley?: ${deployToBerkeley}`, async () => {}, 10000000);
  }
  runTests();
});
