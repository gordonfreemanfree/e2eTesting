import {
  Circuit,
  Experimental,
  Field,
  isReady,
  Poseidon,
  SelfProof,
  verify,
} from 'snarkyjs';
import { InputImage } from './inputImage.js';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
import { weights_l1_8x8 } from './assets/weights_l1_8x8.js';
import { weights_l2_8x8 } from './assets/weights_l2_8x8.js';
import { image_0_label_7_8x8 } from './assets/image_0_label_7_8x8.js';
import { num2Field_t1, num2Field_t2 } from './utils/scaledWeights2Int65.js';
import { SnarkyNet } from './snarkynet.js';

await isReady;

const NeuralNet = Experimental.ZkProgram({
  publicInput: Circuit.array(Field, 10),

  methods: {
    layer1: {
      privateInputs: [SnarkyLayer1, InputImage],

      method(
        preComputedOutputLayer1: Field[],
        layer1: SnarkyLayer1,
        x: InputImage
      ) {
        let newX = [x.value];
        let result1 = layer1.call(newX);
        let newResult = result1[0];

        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(preComputedOutputLayer1)
        );
      },
    },
    layer2: {
      privateInputs: [SelfProof, SnarkyLayer2],

      method(
        preComputedOutputLayer2: Field[],
        proofLayer1: SelfProof<Field[]>,
        layer2: SnarkyLayer2
      ) {
        // verify that Layer1 proof is correct
        proofLayer1.verify();

        // verify that Layer1 output is used as new input for Layer2
        let outputLayer1 = [proofLayer1.publicInput];
        let outputLayer2 = layer2.call(outputLayer1);
        let newResult = outputLayer2[0];

        // Poseidon.hash(preComputedOutputLayer2).assertEquals(
        //   Poseidon.hash(newResult)
        // );

        // using this to check that the output of layer2 is correct
        // But this is not a correct proof.
        // // Poseidon.hash(newResult).assertEquals(
        // //   Poseidon.hash(preComputedOutputLayer2)
        // );
      },
    },
  },
});

async function main() {
  await isReady;

  function preprocessWeights(weightsScaled: number[][]): Array<Field>[] {
    const weights_l1_preprocessed = num2Field_t2(weightsScaled);
    // const weights_l2_preprocessed = await num2Field_t2(weights_l2);
    return weights_l1_preprocessed;
  }

  function preprocessImage(image: number[]): Array<Field> {
    const imagePreprocessed = num2Field_t1(image);
    console.log('imagePreprocessed', imagePreprocessed.toString());
    return imagePreprocessed;
  }

  console.log('SnarkyJS loaded');

  let snarkyLayer1s = new SnarkyLayer1(
    preprocessWeights(weights_l1_8x8),
    'relu'
  );

  let snarkyLayer2s = new SnarkyLayer2(
    preprocessWeights(weights_l2_8x8),
    'softmax'
  );

  let inputImage = new InputImage(preprocessImage(image_0_label_7_8x8));

  let model = new SnarkyNet([snarkyLayer1s, snarkyLayer2s]);

  let predictionAndSteps = model.predict(inputImage);

  console.log('predictionAndSteps', predictionAndSteps);

  const { verificationKey } = await NeuralNet.compile();

  console.log('verificationKey', verificationKey);

  const proofLayer1 = await NeuralNet.layer1(
    predictionAndSteps.intermediateResults[0],
    snarkyLayer1s,
    inputImage
  );

  console.log('proofLayer1 publicInput is', proofLayer1.publicInput.toString());

  //   console.log('proof', proof);

  //   console.log('proof', proof.toString());

  //   const proofLayer2 = await NeuralNet.layer2(
  //     predictionAndSteps.intermediateResults[1],
  //     proofLayer1,
  //     snarkyLayer2s
  //   );

  const proofLayer2 = await NeuralNet.layer2(
    [
      Field(1),
      Field(2),
      Field(3),
      Field(4),
      Field(5),
      Field(6),
      Field(7),
      Field(8),
      Field(9),
      Field(10),
    ],
    proofLayer1,
    snarkyLayer2s
  );

  console.log(
    'proofLayer2  publicInput is',
    proofLayer2.publicInput.toString()
  );

  const ok = await verify(proofLayer2.toJSON(), verificationKey);
  console.log('ok', ok);
}
main();
