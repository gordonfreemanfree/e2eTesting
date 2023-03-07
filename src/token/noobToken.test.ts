// import { NoobToken } from './noobToken';
// import {
//   isReady,
//   shutdown,
//   Field,
//   Mina,
//   PrivateKey,
//   PublicKey,
//   AccountUpdate,
//   UInt64,
// } from 'snarkyjs';

// /*
//  * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
//  * with your own tests.
//  *
//  * See https://docs.minaprotocol.com/zkapps for more info.
//  */

// let proofsEnabled = false;

// describe('BasicTokenContract', () => {
//   let deployerAccount: PublicKey,
//     deployerKey: PrivateKey,
//     senderAccount: PublicKey,
//     senderKey: PrivateKey,
//     zkAppAddress: PublicKey,
//     zkAppPrivateKey: PrivateKey,
//     zkApp: NoobToken;

//   beforeAll(async () => {
//     await isReady;
//     if (proofsEnabled) NoobToken.compile();
//   });

//   beforeEach(() => {
//     const Local = Mina.LocalBlockchain({ proofsEnabled });
//     Mina.setActiveInstance(Local);
//     ({
//       privateKey: deployerKey,
//       publicKey: deployerAccount,
//     } = Local.testAccounts[0]);
//     ({
//       privateKey: senderKey,
//       publicKey: senderAccount,
//     } = Local.testAccounts[1]);
//     zkAppPrivateKey = PrivateKey.random();
//     zkAppAddress = zkAppPrivateKey.toPublicKey();
//     zkApp = new NoobToken(zkAppAddress);
//   });

//   afterAll(() => {
//     // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
//     // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
//     // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
//     setTimeout(shutdown, 0);
//   });

//   async function localDeploy() {
//     const txn = await Mina.transaction(deployerAccount, () => {
//       AccountUpdate.fundNewAccount(deployerAccount);
//       zkApp.deploy({});
//     });
//     await txn.prove();
//     // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
//     await txn.sign([deployerKey, zkAppPrivateKey]).send();
//   }

//   it('generates and deploys the `BasicTokenContract` smart contract', async () => {
//     await localDeploy();
//     const tokenAmount = zkApp.totalAmountInCirculation.get();
//     expect(tokenAmount).toEqual(UInt64.from(0));
//   });

//   it('correctly updates the num state on the `BasicTokenContract` smart contract', async () => {
//     await localDeploy();
//     expect(UInt64.from(0)).toEqual(UInt64.from(0));
//   });

//   // it('correctly updates the num state on the `Add` smart contract', async () => {
//   //   await localDeploy();

//   //   // update transaction
//   //   const txn = await Mina.transaction(senderAccount, () => {
//   //     zkApp.update();
//   //   });
//   //   await txn.prove();
//   //   await txn.sign([senderKey]).send();

//   //   const updatedNum = zkApp.num.get();
//   //   expect(updatedNum).toEqual(UInt64(3));
//   // });
// });
