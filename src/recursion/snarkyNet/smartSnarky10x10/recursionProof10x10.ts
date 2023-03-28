// This file contains the NeuralNet ZkProgram.
// This is the main file that is used to generate the proof.

import {
  Circuit,
  Experimental,
  Field,
  isReady,
  Poseidon,
  SelfProof,
  Struct,
} from 'snarkyjs';
import { InputImage_10x10 } from './inputImage10x10.js';
import { SnarkyLayer1_10x10, SnarkyLayer2_10x10 } from './snarkyLayer10x10.js';

await isReady;

class Architecture_10x10 extends Struct({
  layer1: SnarkyLayer1_10x10,
  layer2: SnarkyLayer2_10x10,
  precomputedOutputLayer1: Circuit.array(Field, 10),
  precomputedOutputLayer2: Circuit.array(Field, 10),
}) {}

const NeuralNet_10x10 = Experimental.ZkProgram({
  publicInput: Architecture_10x10,

  methods: {
    layer1: {
      privateInputs: [InputImage_10x10],

      method(
        architecture: Architecture_10x10,
        // layer1: SnarkyLayer1,
        x: InputImage_10x10
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

      method(
        architecture: Architecture_10x10,
        proofLayer1: SelfProof<Architecture_10x10>
      ) {
        // verify that Layer1 proof is correct
        proofLayer1.verify();

        // verify that Layer1 output is used as new input for Layer2
        let outputLayer1 = [proofLayer1.publicInput.precomputedOutputLayer1];

        let outputLayer2 = architecture.layer2.call(outputLayer1);
        let newResult = outputLayer2[0];

        // using this to check that the output of layer2 is correct
        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(architecture.precomputedOutputLayer2)
        );
      },
    },
  },
});

export class NeuralNetProof_10x10 extends Experimental.ZkProgram.Proof(
  NeuralNet_10x10
) {}
export { Architecture_10x10, NeuralNet_10x10 };
