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
  Poseidon,
  verify,
  Permissions,
} from 'snarkyjs';
import fs from 'fs/promises';
import { loopUntilAccountExists } from '../token/utils/utils';
import { getFriendlyDateTime } from '../token/utils/utils';
import { ProxyRecursionZkApp } from './proxyRecursionZkApp.js';
import { SmartSnarkyNet } from './snarkyNet/smartSnarkyNet';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyNet/snarkyLayer';
import {
  preprocessImage,
  preprocessWeights,
} from './snarkyNet/utils/preprocess';
import { weights_l1_8x8 } from './snarkyNet/assets/weights_l1_8x8';
import { weights_l2_8x8 } from './snarkyNet/assets/weights_l2_8x8';
import { Architecture, NeuralNet } from './snarkyNet/recursionProof';
import { InputImage } from './snarkyNet/inputImageClass';
import { image_0_label_7_8x8 } from './snarkyNet/assets/image_0_label_7_8x8';
import { SnarkyNet } from './snarkyNet/snarkynet';
import { image_1_label_2_8x8 } from './snarkyNet/assets/image_1_label_2_8x8';
// import { Add } from './SmartSnarkyNet.js';

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
      smartSnarkyNetPrivateKey: PrivateKey,
      smartSnarkyNetAddress: PublicKey,
      smartSnarkyNetZkApp: SmartSnarkyNet,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey;
    let addZkAppVerificationKey: string | undefined;
    let neuralNetVerificationKey: string;

    let proxyZkAppVerificationKey: { data: string; hash: string } | undefined;
    let smartSnarkyZkAppVerificationKey:
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
        console.log('compiling SmartContracts...');

        ({
          verificationKey: neuralNetVerificationKey,
        } = await NeuralNet.compile());
        console.log('compiling SmartSnarkyNet...');
        ({
          verificationKey: smartSnarkyZkAppVerificationKey,
        } = await SmartSnarkyNet.compile());
        ({
          verificationKey: proxyZkAppVerificationKey,
        } = await ProxyRecursionZkApp.compile());
        console.log('compiling RecursionZkapp...');
        // ({
        //   verificationKey: smartSnarkyZkAppVerificationKey,
        // } = await SmartSnarkyNet.compile());
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

        smartSnarkyNetPrivateKey = PrivateKey.random();
        smartSnarkyNetAddress = smartSnarkyNetPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new SmartSnarkyNet(smartSnarkyNetAddress);
      } else {
        const Local = Mina.LocalBlockchain({ proofsEnabled });
        Mina.setActiveInstance(Local);
        ({
          privateKey: deployerKey,
          publicKey: deployerAccount,
        } = Local.testAccounts[0]);

        proxyZkAppPrivateKey = PrivateKey.random();
        proxyZkAppAddress = proxyZkAppPrivateKey.toPublicKey();

        smartSnarkyNetPrivateKey = PrivateKey.random();
        smartSnarkyNetAddress = smartSnarkyNetPrivateKey.toPublicKey();

        receiverKey = PrivateKey.random();
        receiverAddress = receiverKey.toPublicKey();

        proxyZkApp = new ProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new SmartSnarkyNet(smartSnarkyNetAddress);
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
        smartSnarkyZkAppVerificationKey !== undefined
      ) {
        txn = await Mina.transaction(deployerAccount, () => {
          AccountUpdate.fundNewAccount(deployerAccount);
          AccountUpdate.fundNewAccount(deployerAccount);

          smartSnarkyNetZkApp.deploy({
            verificationKey: smartSnarkyZkAppVerificationKey,
            zkappKey: smartSnarkyNetPrivateKey,
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
            .sign([deployerKey, smartSnarkyNetPrivateKey, proxyZkAppPrivateKey])
            .send()
        ).wait();
        console.log('deployed proxyZkApp local', proxyZkAppAddress.toBase58());
        console.log(
          'deployed recursionZkApp local',
          smartSnarkyNetAddress.toBase58()
        );
      }
    }

    async function berkeleyDeploy() {
      console.log('deploy on Berkeley...');

      let txn;

      if (smartSnarkyZkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.1e9 },
          () => {
            AccountUpdate.fundNewAccount(deployerAccount, 2);

            smartSnarkyNetZkApp.deploy({
              verificationKey: smartSnarkyZkAppVerificationKey,
              zkappKey: smartSnarkyNetPrivateKey,
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
        txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
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

    // it(`deploy zkApps and check verificationKey - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

    //   if (isBerkeley) {
    //     // wait for the account to exist
    //     await loopUntilAccountExists({
    //       account: smartSnarkyNetAddress,
    //       eachTimeNotExist: () =>
    //         console.log(
    //           'waiting for smartSnarkyNetZkApp account to be deployed...',
    //           getFriendlyDateTime()
    //         ),
    //       isZkAppAccount: true,
    //     });

    //     await loopUntilAccountExists({
    //       account: proxyZkAppAddress,
    //       eachTimeNotExist: () =>
    //         console.log(
    //           'waiting for proxyZkApp account to be deployed...',
    //           getFriendlyDateTime()
    //         ),
    //       isZkAppAccount: true,
    //     });
    //   }

    //   if (isBerkeley) {
    //     await fetchAccount({
    //       publicKey: smartSnarkyNetAddress,
    //     });
    //     await fetchAccount({
    //       publicKey: proxyZkAppAddress,
    //     });
    //   }
    //   let actualSmartSnarkyVerificationKey = Mina.getAccount(
    //     smartSnarkyNetAddress
    //   ).zkapp?.verificationKey?.hash;
    //   let actualProxyVerificationKey = Mina.getAccount(proxyZkAppAddress).zkapp
    //     ?.verificationKey?.hash;

    //   expect(actualProxyVerificationKey?.toString()).toEqual(
    //     proxyZkAppVerificationKey?.hash
    //   );
    //   expect(actualSmartSnarkyVerificationKey?.toString()).toEqual(
    //     smartSnarkyZkAppVerificationKey?.hash
    //   );
    // }, 100000000);

    // it(`init the layer hashes to fix architecture - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('init the layer hashes to fix architecture...');
    //   // let amount = UInt64.from(100);
    //   if (isBerkeley) {
    //     await fetchAccount({
    //       publicKey: smartSnarkyNetAddress,
    //     });
    //     await fetchAccount({
    //       publicKey: proxyZkAppAddress,
    //     });
    //   }

    //   let snarkyLayer1s = new SnarkyLayer1(
    //     preprocessWeights(weights_l1_8x8),
    //     'relu'
    //   );

    //   let snarkyLayer2s = new SnarkyLayer2(
    //     preprocessWeights(weights_l2_8x8),
    //     'softmax'
    //   );

    //   let snarkyLayer1sHash = Poseidon.hash(snarkyLayer1s.toFields());
    //   let snarkyLayer2sHash = Poseidon.hash(snarkyLayer2s.toFields());

    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       smartSnarkyNetZkApp.initState(snarkyLayer1s, snarkyLayer2s);
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
    //   await (await txn.send()).wait();

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: smartSnarkyNetAddress });
    //   }
    //   Mina.getAccount(smartSnarkyNetAddress);

    //   let currentLayer1Hash = smartSnarkyNetZkApp.layer1Hash.get();
    //   let currentLayer2Hash = smartSnarkyNetZkApp.layer2Hash.get();

    //   // let currentDummyState = recursionZkApp.dummyState.get();
    //   // console.log('currentDummyState', currentDummyState.toString());

    //   expect(currentLayer1Hash).toEqual(snarkyLayer1sHash);
    //   expect(currentLayer2Hash).toEqual(snarkyLayer2sHash);
    // }, 10000000);

    // it(`proving that input image was indeed a picture of a 2 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('proving that input image was indeed a picture of a 2...');
    //   let snarkyLayer1s = new SnarkyLayer1(
    //     preprocessWeights(weights_l1_8x8),
    //     'relu'
    //   );

    //   let snarkyLayer2s = new SnarkyLayer2(
    //     preprocessWeights(weights_l2_8x8),
    //     'softmax'
    //   );

    //   let inputImage = new InputImage(preprocessImage(image_1_label_2_8x8));

    //   let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

    //   let predictionAndSteps = model.predict(inputImage);

    //   console.log('predictionAndSteps', predictionAndSteps);

    //   // const { verificationKey } = await NeuralNet.compile();

    //   // console.log('verificationKey', verificationKey);

    //   const architecture = new Architecture({
    //     layer1: snarkyLayer1s,
    //     layer2: snarkyLayer2s,
    //     precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
    //     precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
    //   });

    //   const proofLayer1 = await NeuralNet.layer1(architecture, inputImage);
    //   console.log('proofLayer1', proofLayer1);

    //   const proofLayer2 = await NeuralNet.layer2(architecture, proofLayer1);
    //   console.log('proofLayer2', proofLayer2);

    //   const isValidLocal = await verify(proofLayer2, neuralNetVerificationKey);
    //   console.log('isValidLocal', isValidLocal);

    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       proxyZkApp.callPredict(proofLayer2, smartSnarkyNetAddress);
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
    //   await (await txn.send()).wait();

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: smartSnarkyNetAddress });
    //   }
    //   // let currentClassification = smartSnarkyNetZkApp.classification.get();
    //   const currentClassification = smartSnarkyNetZkApp.classification.get();

    //   expect(currentClassification).toEqual(Field(2));
    // }, 10000000);

    // it(`proving that input image was indeed a picture of a 7 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log('proving that input image was indeed a picture of a 7...');
    //   let snarkyLayer1s = new SnarkyLayer1(
    //     preprocessWeights(weights_l1_8x8),
    //     'relu'
    //   );

    //   let snarkyLayer2s = new SnarkyLayer2(
    //     preprocessWeights(weights_l2_8x8),
    //     'softmax'
    //   );

    //   let inputImage = new InputImage(preprocessImage(image_0_label_7_8x8));

    //   let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

    //   let predictionAndSteps = model.predict(inputImage);

    //   console.log('predictionAndSteps', predictionAndSteps);

    //   // const { verificationKey } = await NeuralNet.compile();

    //   // console.log('verificationKey', verificationKey);

    //   const architecture = new Architecture({
    //     layer1: snarkyLayer1s,
    //     layer2: snarkyLayer2s,
    //     precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
    //     precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
    //   });

    //   const proofLayer1 = await NeuralNet.layer1(architecture, inputImage);
    //   console.log('proofLayer1', proofLayer1);

    //   const proofLayer2 = await NeuralNet.layer2(architecture, proofLayer1);
    //   console.log('proofLayer2', proofLayer2);

    //   const isValidLocal = await verify(proofLayer2, neuralNetVerificationKey);
    //   console.log('isValidLocal', isValidLocal);

    //   const txn = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       proxyZkApp.callPredict(proofLayer2, smartSnarkyNetAddress);
    //     }
    //   );
    //   await txn.prove();
    //   txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
    //   await (await txn.send()).wait();

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: smartSnarkyNetAddress });
    //   }
    //   let currentClassification = smartSnarkyNetZkApp.classification.get();

    //   expect(currentClassification).toEqual(Field(7));
    // }, 10000000);

    // it(`changing smartSnarkyNet Permission to impossible to fix architecture  - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   console.log(
    //     'changing smartSnarkyNet Permission to impossible to fix architecture...'
    //   );
    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: smartSnarkyNetAddress });
    //   }

    //   // change permissions for setVerificationKey to impossible
    //   let txn_permission = await Mina.transaction(
    //     { sender: deployerAccount, fee: 0.1e9 },
    //     () => {
    //       let permissionsUpdate = AccountUpdate.createSigned(
    //         smartSnarkyNetAddress
    //       );
    //       permissionsUpdate.account.permissions.set({
    //         ...Permissions.default(),
    //         setVerificationKey: Permissions.impossible(),
    //       });
    //     }
    //   );

    //   await txn_permission.prove();
    //   txn_permission.sign([deployerKey, smartSnarkyNetPrivateKey]);
    //   await (await txn_permission.send()).wait();

    //   if (isBerkeley) {
    //     await fetchAccount({ publicKey: smartSnarkyNetAddress });
    //   }

    //   let currentPermissionSetVerificationKey = Mina.getAccount(
    //     smartSnarkyNetAddress
    //   ).permissions.setVerificationKey;

    //   expect(currentPermissionSetVerificationKey).toEqual(
    //     Permissions.impossible()
    //   );
    // }, 10000000);

    // it(`Dummy test - deployToBerkeley?: ${deployToBerkeley}`, async () => {
    //   expect(true).toEqual(true);
    // }, 10000000);
  }
  runTests();
});
