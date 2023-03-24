import {
  AccountUpdate,
  Circuit,
  Experimental,
  Field,
  isReady,
  Mina,
  Poseidon,
  PrivateKey,
  SelfProof,
  Struct,
  verify,
} from 'snarkyjs';
import { InputImage } from './inputImageClass.js';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
import { weights_l1_8x8 } from './assets/weights_l1_8x8.js';
import { weights_l2_8x8 } from './assets/weights_l2_8x8.js';
import { image_0_label_7_8x8 } from './assets/image_0_label_7_8x8.js';
import { num2Field_t1, num2Field_t2 } from './utils/scaledWeights2Int65.js';
import { SnarkyNet } from './snarkynet.js';
import { SmartSnarkyNet } from './smartSnarkyNet.js';

await isReady;

class Architecture extends Struct({
  layer1: SnarkyLayer1,
  layer2: SnarkyLayer2,
  precomputedOutputLayer1: Circuit.array(Field, 10),
  precomputedOutputLayer2: Circuit.array(Field, 10),
}) {}

const NeuralNet = Experimental.ZkProgram({
  publicInput: Architecture,

  methods: {
    layer1: {
      privateInputs: [InputImage],

      method(
        architecture: Architecture,
        // layer1: SnarkyLayer1,
        x: InputImage
      ) {
        let newX = [x.value];
        let result1 = architecture.layer1.call(newX);
        let newResult = result1[0];

        // this guarantees that the output of layer1 is correct and is used as input for layer2
        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(architecture.precomputedOutputLayer1)
        );
      },
    },
    layer2: {
      privateInputs: [SelfProof],

      method(architecture: Architecture, proofLayer1: SelfProof<Architecture>) {
        // verify that Layer1 proof is correct
        proofLayer1.verify();

        // verify that Layer1 output is used as new input for Layer2
        let outputLayer1 = [proofLayer1.publicInput.precomputedOutputLayer1];

        let outputLayer2 = architecture.layer2.call(outputLayer1);
        let newResult = outputLayer2[0];

        // using this to check that the output of layer2 is correct
        // But this is not a correct proof.
        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(architecture.precomputedOutputLayer2)
        );
      },
    },
  },
});

// export let NeuralNetProof_ = Experimental.ZkProgram.Proof(NeuralNet);
// export class NeuralNetProof extends NeuralNetProof_ { }
export class NeuralNetProof extends Experimental.ZkProgram.Proof(NeuralNet) {}
export { Architecture, NeuralNet };
