import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
} from 'snarkyjs';
import { NoobToken } from './noobToken';
import fs from 'fs/promises';

// const SECONDS = 1000;
// jest.setTimeout(70 * SECONDS);
console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const blockchainSwitch = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
// const blockchainSwitch = true;
console.log('blockchainSwitch', blockchainSwitch);
let proofsEnabled = true;

describe('foo', () => {
  async function runTests(deployToBerkeley: boolean = blockchainSwitch) {
    let Blockchain;
    let deployerAccount: PublicKey,
      deployerKey: PrivateKey,
      senderAccount: PublicKey,
      senderKey: PrivateKey,
      zkAppAddress: PublicKey,
      zkAppPrivateKey: PrivateKey,
      zkApp: NoobToken;

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

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();
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
        zkApp = new NoobToken(zkAppAddress);
      }
      // const { deployerKey ,deployerAccount } = Blockchain.testAccounts[0]
    }, 100000);

    afterAll(() => {
      setInterval(shutdown, 0);
    });

    async function localDeploy() {
      const txn = await Mina.transaction(deployerAccount, () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        zkApp.deploy({});
      });
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }

    async function berkeleyDeploy() {
      console.log('generating deploy transaction');
      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 1.1e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.deploy({});
        }
      );
      console.log('generating proof');
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      console.log('signing transaction');
      await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }

    it(`totalAmountInCirculation === 0 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      // timeout for each test
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();
      const tokenAmount = zkApp.totalAmountInCirculation.get();
      expect(tokenAmount).toEqual(UInt64.from(0));
      //   expect(1).toEqual(1);
    }, 1000000);

    it(`2 equals 2 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(2).toEqual(2);
    });

    it(`3 not equals 5 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(3).not.toEqual(5);
    });
  }

  runTests();
});
