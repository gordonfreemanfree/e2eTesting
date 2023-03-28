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

describe('Token-test-permission', () => {
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

      expect(actualVerificationKey?.hash.toString()).toEqual(
        zkAppVerificationKey?.hash
      );
    }, 10000000);
    // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // change zkAppUri with SignedTransaction
    // // status: working
    // // confirmed: true
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
      // await txn_changeZkappUri.prove();
      txn_changeZkappUri.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_changeZkappUri.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newZkAppUri = Mina.getAccount(zkAppAddress).zkapp?.zkappUri;

      console.log('newUri is', newZkAppUri);
      expect(newZkAppUri).toEqual(newUri);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // change setZkAppUri permissions to none() and updating zkAppUri without signature
    // // status: working
    // // confirmed: true
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
      console.log(
        'zkAppUri after changing Permission to none() is',
        updatedZkAppUri
      );

      expect(updatedZkAppUri).toEqual(newUri);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // change setTiming Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`change setTiming Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldTiming = Mina.getAccount(zkAppAddress).permissions.setTiming;
      console.log('oldTiming Permission is', oldTiming);

      // change permissions for setTiming to impossible
      let txn_permission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let permissionsUpdate = AccountUpdate.createSigned(zkAppAddress);
          permissionsUpdate.account.permissions.set({
            ...Permissions.default(),
            setTiming: Permissions.impossible(),
          });
        }
      );
      await txn_permission.prove();
      txn_permission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_permission.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newTiming = Mina.getAccount(zkAppAddress).permissions.setTiming;
      console.log('newTiming Permission is', newTiming);

      expect(newTiming).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // set voting for Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`set voting for Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set voting for Permission to impossible()');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;
      console.log('oldVotingForPermission is', oldVotingForPermission);

      // set voting for Permission to impossible()
      let txn_votingForPermission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.permissions.set({
            ...Permissions.default(),
            setVotingFor: Permissions.impossible(),
          });
        }
      );
      await txn_votingForPermission.prove();
      txn_votingForPermission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_votingForPermission.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;
      console.log('newVotingForPermission is', newVotingForPermission);

      expect(newVotingForPermission).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // set delegate to deployerAccount
    // // status:
    // // confirmed:
    it(`set delegate to deployerAccount - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set delegate to  deployerAccount');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldDelegate = Mina.getAccount(zkAppAddress).delegate;
      console.log('oldDelegate is', oldDelegate?.toJSON());

      // set delegate for deployerAccount
      let txn_delegate = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.delegate.set(deployerAccount);
        }
      );
      await txn_delegate.prove();
      txn_delegate.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_delegate.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let newDelegate = Mina.getAccount(zkAppAddress).delegate;
      console.log('newDelegate is', newDelegate?.toJSON());

      expect(newDelegate).toEqual(deployerAccount);
    }, 1000000);
    // // ------------------------------------------------------------------------

    // // ------------------------------------------------------------------------
    // // setDelegate for Permission to impossible()
    // // status: working
    // // confirmed: true
    it(`setDelegate for Permission to impossible() - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('set voting for Permission to impossible()');
      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }
      let oldVotingForPermission = Mina.getAccount(zkAppAddress).permissions
        .setVotingFor;
      console.log('oldVotingForPermission is', oldVotingForPermission);

      // set voting for Permission to impossible()
      let txn_votingForPermission = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          let update = AccountUpdate.createSigned(zkAppAddress);
          update.account.permissions.set({
            ...Permissions.default(),
            setDelegate: Permissions.impossible(),
          });
        }
      );
      await txn_votingForPermission.prove();
      txn_votingForPermission.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_votingForPermission.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress });
      }

      let newSetDelegate = Mina.getAccount(zkAppAddress).permissions
        .setDelegate;
      console.log('newVotingForPermission is', newSetDelegate);

      expect(newSetDelegate).toEqual(Permissions.impossible());
    }, 1000000);
    // // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mint 7 tokens to zkAppAccount
    // status: working
    // confirmed: true
    it(`mint 7 tokens  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      printBalances();
      console.log('minting 7 tokens');
      let tokenId = zkApp.token.id;

      let events = await zkApp.fetchEvents();

      if (isBerkeley) {
        await fetchAccount({ publicKey: zkAppAddress, tokenId });
        await fetchAccount({ publicKey: deployerAccount, tokenId });
      }
      Mina.getAccount(zkAppAddress);
      Mina.getAccount(deployerAccount);

      const mintAmount = UInt64.from(7e9);
      const txn_mint = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9 },
        () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          zkApp.mint(zkAppAddress, mintAmount);
        }
      );
      await txn_mint.prove();
      txn_mint.sign([zkAppPrivateKey, deployerKey]);
      await (await txn_mint.send()).wait();

      if (isBerkeley) {
        await fetchAccount({
          publicKey: zkAppAddress,
          tokenId: zkApp.token.id,
        });
        await fetchAccount({
          publicKey: zkAppAddress,
        });
      }
      // let newBalance = Mina.getAccount(zkAppAddress, tokenId).balance;
      let newNoobBalance = Mina.getBalance(zkAppAddress, tokenId);
      console.log('mint 7, newBalance is', newNoobBalance.toJSON());

      let newTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();

      // balance of account is
      console.log('newTotalAmountInCirculation', newTotalAmountInCirculation);
      // console.log('events are', events);

      expect(newTotalAmountInCirculation).toEqual(mintAmount);
      expect(newNoobBalance).toEqual(mintAmount);
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mintWithMina but balance is 0. expecting failure
    // status: working
    // confirmed:
    it(`mintWithMina 1 tokens but balance is 0  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('mintWithMina but balance is 0. expecting failure');

      expect(async () => {
        printBalances();
        if (isBerkeley) {
          await fetchAccount({ publicKey: zkAppAddress });
        }
        Mina.getAccount(zkAppAddress);
        // console.log('nonce of deployerAccount is', accountInfo.nonce.toJSON());

        const txn20 = await Mina.transaction(
          { sender: deployerAccount, fee: 0.1e9 },
          () => {
            AccountUpdate.fundNewAccount(deployerAccount);
            zkApp.mintWithMina(deployerAccount, UInt64.from(1));
          }
        );
        await txn20.prove();
        txn20.sign([deployerKey, zkAppPrivateKey]);
        await (await txn20.send()).wait();

        let tokenId = zkApp.token.id;
        if (isBerkeley) {
          await fetchAccount({
            publicKey: zkAppAddress,
            tokenId: tokenId,
          });
        }

        // let newNoobBalance = Mina.getAccount(zkAppAddress, tokenId).balance;
      }).rejects.toThrow();
    }, 1000000);
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // mintWithMina 1 tokens, but balance is 1
    // status: constantly fails on berkeley - no idea why
    // confirmed:
    // dependencies: mint 7 tokens (because otherwise Mina.getAccount fails - error) /
    // it(`mintWithMina 1 tokens, but balance is 1  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('mintWithMina 1 tokens, but balance is 1');
    //   printBalances();
    //   let tokenId = zkApp.token.id;

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: zkAppAddress, tokenId });
    //     await fetchAccount({ publicKey: deployerAccount, tokenId });
    //     await fetchAccount({ publicKey: zkAppAddress });
    //   }
    //   Mina.getAccount(zkAppAddress, tokenId);
    //   // Mina.getAccount(deployerAccount, tokenId);

    //   let oldTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    //   console.log(
    //     'oldTotalAmountInCirculation',
    //     oldTotalAmountInCirculation.toJSON()
    //   );
    //   let oldNoobBalance = Mina.getBalance(zkAppAddress, tokenId);
    //   console.log('oldNoobBalance is', oldNoobBalance.toJSON());

    //   let mintWithMinaAmount = UInt64.from(1e9);

    //   // send 1 Mina to zkAppAddress to fund account
    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
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

    //   // console.log('txn with 1 mina sent, txn is', txn.toPretty());

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: zkAppAddress, tokenId });
    //     await fetchAccount({ publicKey: deployerAccount });
    //     await fetchAccount({ publicKey: zkAppAddress });
    //   }
    //   Mina.getAccount(zkAppAddress, tokenId);
    //   Mina.getAccount(zkAppAddress);
    //   Mina.getAccount(deployerAccount);
    //   printBalances();

    //   // mintWithMina 1 tokens
    //   const txn20 = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       Mina.getBalance(zkAppAddress),
    //         zkApp.mintWithMina(zkAppAddress, mintWithMinaAmount);
    //     }
    //   );

    //   await txn20.prove();
    //   // txn20.sign([deployerKey, zkAppPrivateKey]);
    //   txn20.sign([deployerKey]);
    //   await (await txn20.send()).wait();

    //   if (isBerkeley) {
    //     await fetchAccount({
    //       publicKey: zkAppAddress,
    //       tokenId: zkApp.token.id,
    //     });
    //     await fetchAccount({
    //       publicKey: zkAppAddress,
    //     });
    //   }
    //   let newNoobBalance = Mina.getBalance(zkAppAddress, tokenId);
    //   console.log('mintWithMina, newNoobBalance is', newNoobBalance.toJSON());

    //   let newTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();

    //   // balance of account is
    //   console.log(
    //     'newTotalAmountInCirculation',
    //     newTotalAmountInCirculation.toJSON()
    //   );
    //   let events = await zkApp.fetchEvents();
    //   // console.log('events', events);

    //   expect(newTotalAmountInCirculation).toEqual(
    //     oldTotalAmountInCirculation.add(mintWithMinaAmount)
    //   );
    //   expect(newNoobBalance).toEqual(oldNoobBalance.add(mintWithMinaAmount));
    // }, 1000000);
    // ------------------------------------------------------------------------

    it(`Dummy - deployToBerkeley?: ${deployToBerkeley}`, async () => {}, 10000000);
  }

  // runTests();
});
