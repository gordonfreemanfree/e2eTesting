import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Signature,
  fetchAccount,
  setGraphqlEndpoint,
} from 'snarkyjs';
import { NoobToken } from './noobToken';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../utils/utils';
import { getFriendlyDateTime } from '../utils/utils';

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

        zkAppPrivateKey = PrivateKey.random();
        zkAppAddress = zkAppPrivateKey.toPublicKey();

        // zkAppBPrivateKey = PrivateKey.random();
        // zkAppBAddress = zkAppPrivateKey.toPublicKey();
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
      console.log('generated deploy txn for zkApp', zkAppAddress.toBase58());
    }

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

    it(`totalAmountInCirculation === 0 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

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

      const tokenAmount = zkApp.totalAmountInCirculation.get();
      expect(tokenAmount).toEqual(UInt64.from(0));
      //   expect(1).toEqual(1);

      console.log('initializing...');

      const init_txn = await Mina.transaction(deployerAccount, () => {
        zkApp.init();
      });

      await init_txn.prove();
      init_txn.sign([zkAppPrivateKey, deployerKey]);
      await init_txn.send();

      console.log('initialized');
    }, 1000000);

    // it(`check the tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   // check token symbol
    //   let tokenId = zkApp.token.id;
    //   console.log('tokenId', tokenId);
    //   let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
    //   console.log('tokenSymbol is', tokenSymbol);
    //   expect(tokenSymbol).toEqual('NOOB');
    // }, 1000000);

    // Method works on Local !!!
    // it(`mint 10 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   printBalances();
    //   console.log('minting 10 tokens');
    //   const mintAmount = UInt64.from(10);
    //   //   const mintSignature = Signature.create(
    //   //     zkAppPrivateKey,
    //   //     mintAmount.toFields().concat(zkAppAddress.toFields())
    //   //   );
    //   //   let mintReceiverKey = PrivateKey.random();
    //   //   let mintReceiverAddress = mintReceiverKey.toPublicKey();
    //   //   const Local = Mina.LocalBlockchain({ proofsEnabled });
    //   const txn10 = await Mina.transaction(
    //     // { sender: deployerAccount, fee: 1e9 },
    //     deployerAccount,
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mint(zkAppAddress, mintAmount);
    //     }
    //   );
    //   await txn10.prove();
    //   await txn10.sign([zkAppPrivateKey, deployerKey]);

    //   const response = await txn10.send();
    //   console.log('response', response);
    //   const tokenAmount = zkApp.totalAmountInCirculation.get();
    //   console.log('totalAmountInCirculation', tokenAmount.value);
    //   expect(tokenAmount).toEqual(mintAmount);
    // }, 1000000);

    // it(`mintWithMina 100 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 100 tokens');
    //   printBalances();

    //   // send 100 Mina to zkApp
    //   const txn = await Mina.transaction(
    //     //   AccountUpdate.getNonce()
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
    //       //   AccountUpdate.fundNewAccount(deployerAccount);
    //       let deployerAccountUpdate = AccountUpdate.createSigned(
    //         deployerAccount
    //       );
    //       deployerAccountUpdate.send({
    //         to: zkAppAddress,
    //         amount: UInt64.from(100e9),
    //       });
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, zkAppPrivateKey]);
    //   let response = await txn.send();
    //   console.log('response', response);
    //   printBalances();

    //   let accountInfo = Mina.getAccount(deployerAccount);
    //   console.log('accountinfo is', accountInfo.nonce.toJSON());

    //   const txn20 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
    //       AccountUpdate.fundNewAccount(deployerAccount);
    //       zkApp.mintWithMina(deployerAccount, UInt64.from(100));
    //     }
    //   );
    //   //   txn20.transaction.feePayer.body.nonce = txn20.transaction.feePayer.body.nonce.add(
    //   //     3
    //   //   );
    //   console.log('txn20 is', txn20.toPretty());
    //   await txn20.prove();
    //   await txn20.sign([deployerKey, zkAppPrivateKey]);
    //   console.log(txn20.toPretty());
    //   await txn20.send();
    //   let tokenId = zkApp.token.id;
    //   let newNoobBalance = Mina.getAccount(deployerAccount, tokenId).balance;
    //   expect((newNoobBalance = UInt64.from(100)));
    // });

    it(`transfer 10 tokens if the time is correct  - deployToBerkeley?: ${deployToBerkeley}`, async () => {});

    it(`3 not equals 5 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(3).not.toEqual(5);
    });
  }

  runTests();
});
