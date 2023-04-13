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
import { loopUntilAccountExists } from '../../token/utils/utils';
import { getFriendlyDateTime } from '../../token/utils/utils';
import { ProxyRecursionZkApp } from '../proxyRecursionZkApp.js';
import { SmartSnarkyNet } from '../snarkyNet/smartSnarkyNet';
import { SnarkyLayer1, SnarkyLayer2 } from '../snarkyNet/snarkyLayer';
import {
  preprocessImage,
  preprocessWeights,
} from '../snarkyNet/utils/preprocess';
import { weights_l1_8x8 } from '../snarkyNet/assets/weights_l1_8x8';
import { weights_l2_8x8 } from '../snarkyNet/assets/weights_l2_8x8';
import {
  Architecture,
  NeuralNet,
  newArchitecture,
  newNeuralNet,
} from '../snarkyNet/recursionProof';
import { InputImage } from '../snarkyNet/inputImageClass';
import { image_0_label_7_8x8 } from '../snarkyNet/assets/image_0_label_7_8x8';
import { SnarkyNet } from '../snarkyNet/snarkynet';
import { image_1_label_2_8x8 } from '../snarkyNet/assets/image_1_label_2_8x8';
import {
  SnarkyLayerStruct1,
  SnarkyLayerStruct2,
} from '../snarkyNet/newSnarkyLayer';
import { newSnarkyNet } from '../snarkyNet/newSnarkynet';
import { newProxyRecursionZkApp } from '../newProxyRecursionZkApp';
import { newSmartSnarkyNet } from '../snarkyNet/newSmartSnarkyNet';

console.log('process.env.TEST_ON_BERKELEY', process.env.TEST_ON_BERKELEY);

const isBerkeley = process.env.TEST_ON_BERKELEY == 'true' ? true : false;

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
      proxyZkApp: newProxyRecursionZkApp,
      smartSnarkyNetPrivateKey: PrivateKey,
      smartSnarkyNetAddress: PublicKey,
      smartSnarkyNetZkApp: newSmartSnarkyNet,
      receiverKey: PrivateKey,
      receiverAddress: PublicKey;
    let addZkAppVerificationKey: string | undefined;
    let neuralNetVerificationKey: string;

    let proxyZkAppVerificationKey: { data: string; hash: Field } | undefined;
    let smartSnarkyZkAppVerificationKey:
      | { data: string; hash: Field }
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
        } = await newNeuralNet.compile());
        console.log('compiling SmartSnarkyNet...');
        ({
          verificationKey: smartSnarkyZkAppVerificationKey,
        } = await newSmartSnarkyNet.compile());
        console.log('compiling RecursionZkapp...');

        ({
          verificationKey: proxyZkAppVerificationKey,
        } = await newProxyRecursionZkApp.compile());

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
        let config = configJson.deployAliases['proxyrecursionzkapp'];
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

        proxyZkApp = new newProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new newSmartSnarkyNet(smartSnarkyNetAddress);
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

        proxyZkApp = new newProxyRecursionZkApp(proxyZkAppAddress);
        smartSnarkyNetZkApp = new newSmartSnarkyNet(smartSnarkyNetAddress);
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
      console.log('calling faucet...');
      try {
        await Mina.faucet(deployerAccount);
      } catch (e) {
        console.log('error calling faucet', e);
      }
      console.log('waiting for account to exist...');
      try {
        await loopUntilAccountExists({
          account: deployerAccount,
          eachTimeNotExist: () =>
            console.log(
              'waiting for deployerAccount account to be funded...',
              getFriendlyDateTime()
            ),
          isZkAppAccount: false,
        });
      } catch (e) {
        console.log('error waiting for deployerAccount to exist', e);
      }

      console.log('calling faucet...done');

      console.log('deploy on Berkeley...');

      let txn;

      if (smartSnarkyZkAppVerificationKey !== undefined) {
        txn = await Mina.transaction(
          { sender: deployerAccount, fee: 0.2e9 },
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

    it(`1. deploy zkApps and check verificationKeys and hashes stored - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('deploying zkApps...');
      deployToBerkeley ? await berkeleyDeploy() : await localDeploy();

      if (isBerkeley) {
        // wait for the account to exist
        await loopUntilAccountExists({
          account: smartSnarkyNetAddress,
          eachTimeNotExist: () =>
            console.log(
              'waiting for smartSnarkyNetZkApp account to be deployed...',
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

      if (isBerkeley) {
        await fetchAccount({
          publicKey: smartSnarkyNetAddress,
        });
        await fetchAccount({
          publicKey: proxyZkAppAddress,
        });
      }
      let actualSmartSnarkyVerificationKeyHash = Mina.getAccount(
        smartSnarkyNetAddress
      ).zkapp?.verificationKey?.hash;
      let actualProxyVerificationKeyHash = Mina.getAccount(proxyZkAppAddress)
        .zkapp?.verificationKey?.hash;

      expect(actualProxyVerificationKeyHash).toEqual(
        proxyZkAppVerificationKey?.hash
      );
      expect(actualSmartSnarkyVerificationKeyHash).toEqual(
        smartSnarkyZkAppVerificationKey?.hash
      );
    }, 100000000);

    it(`2. proving that input image was indeed a picture of a 2 - deployToBerkeley?: ${deployToBerkeley}`, async () => {
      console.log('proving that input image was indeed a picture of a 2...');
      let snarkyLayer1s = new SnarkyLayerStruct1(
        preprocessWeights(weights_l1_8x8)
      );

      let snarkyLayer2s = new SnarkyLayerStruct2(
        preprocessWeights(weights_l2_8x8)
      );

      let inputImage = new InputImage({
        value: preprocessImage(image_1_label_2_8x8),
      });

      let model = new newSnarkyNet([snarkyLayer1s, snarkyLayer2s]);

      let predictionAndSteps = model.predict(inputImage);

      const architecture = new newArchitecture({
        layer1: snarkyLayer1s,
        layer2: snarkyLayer2s,
        precomputedOutputLayer1: predictionAndSteps.intermediateResults[0],
        precomputedOutputLayer2: predictionAndSteps.intermediateResults[1],
      });

      console.log(
        'precomputedOutputLayer1 [1]',
        predictionAndSteps.intermediateResults[1]
      );
      console.log(
        'precomputedOutputLayer2 [1] toLocaleString',
        predictionAndSteps.intermediateResults[1].toLocaleString()
      );

      console.log(
        'precomputedOutputLayer2 [1][1] toJSON',
        predictionAndSteps.intermediateResults[1][1].toJSON()
      );

      const proofLayer1 = await newNeuralNet.layer1(architecture, inputImage);
      // console.log('proofLayer1', proofLayer1);

      const proofLayer2 = await newNeuralNet.layer2(architecture, proofLayer1);
      // console.log('proofLayer2', proofLayer2);

      const isValidLocal = await verify(proofLayer2, neuralNetVerificationKey);
      console.log('isValidLocal', isValidLocal);

      const txn = await Mina.transaction(
        { sender: deployerAccount, fee: 0.1e9, memo: '2. call predict' },
        () => {
          proxyZkApp.callPredict(proofLayer2, smartSnarkyNetAddress);
        }
      );
      await txn.prove();
      txn.sign([deployerKey, smartSnarkyNetPrivateKey]);
      await (await txn.send()).wait();

      if (isBerkeley) {
        await fetchAccount({ publicKey: smartSnarkyNetAddress });
      }
      // let currentClassification = smartSnarkyNetZkApp.classification.get();
      const currentClassification = smartSnarkyNetZkApp.classification.get();
      const currentLayer1Hash = smartSnarkyNetZkApp.layer1Hash.get();
      const currentLayer2Hash = smartSnarkyNetZkApp.layer2Hash.get();
      // checking classification and the hashes of layers
      //   expect(Poseidon.hash(snarkyLayer1s.toFields())).toEqual(
      //     currentLayer1Hash
      //   );
      //   expect(Poseidon.hash(snarkyLayer2s.toFields())).toEqual(
      //     currentLayer2Hash
      //   );
      expect(currentClassification).toEqual(Field(2));
    }, 10000000);
  }
  runTests();
});
