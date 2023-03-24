import {
  isReady,
  method,
  Mina,
  AccountUpdate,
  PrivateKey,
  SmartContract,
  UInt64,
  shutdown,
  Permissions,
  PublicKey,
  state,
  DeployArgs,
  State,
} from 'snarkyjs';
import { NoobToken } from '../token/noobToken.js';

import fs from 'fs/promises';
import { loopUntilAccountExists } from '../token/utils/utils.js';
import { getFriendlyDateTime } from '../token/utils/utils.js';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

// const blockchainSwitch = process.env.TEST_ON_BERKELEY == 'true' ? true : false;
const blockchainSwitch = true;
console.log('blockchainSwitch', blockchainSwitch);
let proofsEnabled = true;

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

await isReady;

const tokenSymbol = 'NOOB';

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

async function beforeAll(deployToBerkeley: boolean = blockchainSwitch) {
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
}

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
      AccountUpdate.createSigned(deployerAccount);
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({ zkappKey: zkAppPrivateKey });
    }
  );
  console.log('generating proof');
  await txn.prove();
  // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
  console.log('signing transaction');
  await txn.sign([deployerKey, zkAppPrivateKey]);
  let response = await txn.send();
  console.log('response from deploy txn', response);
  console.log('generated deploy txn for zkApp', zkAppAddress.toBase58());
}

// it(`totalAmountInCirculation === 0 - deployToBerkeley?: ${deployToBerkeley}`, async () => {

async function test1(deployToBerkeley: boolean) {
  deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

  if (blockchainSwitch) {
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
  const tokenAmount = zkApp.totalAmountInCirculation.get();
  // expect(tokenAmount).toEqual(UInt64.from(0));
  //   expect(1).toEqual(1);

  console.log('initializing...');

  const init_txn = await Mina.transaction(
    { sender: deployerAccount, fee: 1.1e9 },
    () => {
      //   AccountUpdate.createSigned(deployerAccount);
      //   AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.init();
    }
  );

  await init_txn.prove();
  init_txn.sign([zkAppPrivateKey, deployerKey]);
  let response = await init_txn.send();
  console.log('response from init is', response);

  console.log('initialized');
}

// it(`check the tokenSymbol is 'NOOB' - deployToBerkeley?: ${deployToBerkeley}`, async () => {
async function test2() {
  let tokenId = zkApp.token.id;
  console.log('tokenId', tokenId);
  let tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
  console.log('tokenSymbol is', tokenSymbol);
  // expect(tokenSymbol).toEqual('NOOB');
}

// it(`mint 10 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
async function test3() {
  printBalances();
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
    deployerAccount,
    () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.mint(zkAppAddress, mintAmount);
    }
  );
  await txn10.prove();
  await txn10.sign([zkAppPrivateKey, deployerKey]);
  const response = await txn10.send();
  console.log('response', response);
  const tokenAmount = zkApp.totalAmountInCirculation.get();
  console.log('totalAmountInCirculation', tokenAmount.value);
  console.log('tokenAmount is', tokenAmount);
  console.log('mintAmount is', mintAmount);
  // expect(tokenAmount).toEqual(mintAmount);
}

await beforeAll();
await test1(blockchainSwitch);
await test2();
await test3();
shutdown();
