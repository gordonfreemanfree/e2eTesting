import {
  isReady,
  Mina,
  shutdown,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Signature,
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
      // timeout for each test
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();
      const tokenAmount = zkApp.totalAmountInCirculation.get();
      expect(tokenAmount).toEqual(UInt64.from(0));
      //   expect(1).toEqual(1);
    }, 1000000);

    it(`check the tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      // check token symbol
      let tokenId = zkApp.token.id;
      console.log('tokenId', tokenId);
      let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
      console.log('tokenSymbol is', tokenSymbol);
      expect(tokenSymbol).toEqual('NOOB');
    }, 1000000);

    // error with     ("Error: File \"src/lib/transaction_logic/zkapp_command_logic.ml\", line 1847, characters 42-49: [[0,[[\"Update_not_permitted_balance\"],[\"Overflow\"]]]]")
    it(`mint 100 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      //   printBalances();
      console.log('minting 10 tokens');
      const mintAmount = UInt64.from(10);
      //   const mintSignature = Signature.create(
      //     zkAppPrivateKey,
      //     mintAmount.toFields().concat(zkAppAddress.toFields())
      //   );
      //   let mintReceiverKey = PrivateKey.random();
      //   let mintReceiverAddress = mintReceiverKey.toPublicKey();
      //   const Local = Mina.LocalBlockchain({ proofsEnabled });
      const txn10 = await Mina.transaction(
        // { sender: deployerAccount, fee: 1e9 },
        zkAppAddress,
        () => {
          //   AccountUpdate.fundNewAccount(zkAppAddress);
          //   AccountUpdate.fundNewAccount(deployerAccount);
          //   zkApp.mint(mintReceiverAddress, mintAmount, mintSignature);
          zkApp.mint(zkAppAddress, mintAmount);
        }
      );
      await txn10.prove();
      await txn10.sign([zkAppPrivateKey, deployerKey]).send();
      //   const response = await txn10.send();
      //   console.log('response', response);
      //   const tokenAmount = zkApp.totalAmountInCirculation.get();
      //   console.log(tokenAmount);
      //   expect(tokenAmount).toEqual(mintAmount);
    }, 1000000);

    // it(`mintWithMina 100 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   printBalances();

    //   // send 100 Mina to zkApp
    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
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

    //   const txn1 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 1e9 },
    //     () => {
    //       zkApp.mintWithMina(deployerAccount, UInt64.from(100));
    //     }
    //   );
    //   await txn1.prove();
    //   await txn1.sign([deployerKey, zkAppPrivateKey]).send();
    //   await txn1.send();
    //   let tokenId = zkApp.token.id;

    //   console.log(
    //     'tokens in deployer account',
    //     Mina.getBalance(deployerAccount, tokenId).value.toBigInt()
    //   );

    //   //   expect();
    // });

    it(`transfer 10 tokens if the time is correct  - deployToBerkeley?: ${deployToBerkeley}`, async () => {});

    it(`3 not equals 5 - deployToBerkeley?: ${deployToBerkeley}`, () => {
      expect(3).not.toEqual(5);
    });
  }

  runTests();
});
