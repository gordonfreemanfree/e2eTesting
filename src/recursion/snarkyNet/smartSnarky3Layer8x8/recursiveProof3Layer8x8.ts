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
import { InputImage_8x8 } from './inputImage8x8';
import { SnarkyLayer1_8x8, SnarkyLayer2_10x10 } from './snarkyLayer3Layer8x8.js';

await isReady;

class Architecture extends Struct({
  inputLayer: SnarkyLayer1_8x8,
  middleLayer: SnarkyLayer2_10x10,
  outputLayer: SnarkyLayer2_10x10,
//   precomputedOutputLayer1: Circuit.array(Field, 10),
//   precomputedOutputLayer2: Circuit.array(Field, 10),
}) {
    static baseCase(
        inputLayer: SnarkyLayer1_8x8,
        inputImage: InputImage_8x8
    ) {
        let newX = [inputImage.value];
        let result1 = inputLayer.call(newX);
        let newResult = result1[0];
        return newResult
    }

    static recursiveCase(
        input: ,
        outputLayer: SnarkyLayer2_10x10) {
        
    }

    static createMerged(state1: Architecture, state2: Architecture) {
        return new Architecture({
            inputLayer: state1.inputLayer,
            outputLayer: state2.outputLayer,
        })
    }
    
    static assertEquals(state1: Architecture, state2: Architecture) {
        state1.inputLayer.assertEquals(state2.inputLayer);
        state1.outputLayer.assertEquals(state2.outputLayer);
    }


}

const NeuralNet3Layer8x8 = Experimental.ZkProgram({
  publicInput: Architecture,

  methods: {
    firstStep: {
      privateInputs: [InputImage_8x8],

      method(
        architecture: Architecture,
        // layer1: SnarkyLayer1,
        inputImage: InputImage_8x8
      ) {
        let newX = [inputImage.value];
        let result1 = architecture.inputLayer.call(newX);
        let newResult = result1[0];

        // this guarantees that the output of layer1 is correct and is used as input for layer2
        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(architecture.precomputedOutputLayer1)
        );
      },
    },
    layerStep: {
      privateInputs: [SelfProof],

      method(architecture: Architecture, proofLayer1: SelfProof<Architecture>) {
        // verify that Layer1 proof is correct
        proofLayer1.verify();

        // verify that Layer1 output is used as new input for Layer2
        // let outputLayer1 = [proofLayer1.publicInput.precomputedOutputLayer1];
        Poseidon.hash(architecture.inputLayer.toFields()).assertEquals(Poseidon.hash( proofLayer1.publicInput.precomputedOutputLayer1[0].toFields()));

        let outputLayer2 = architecture.outputLayer.call(outputLayer1);
        let newResult = outputLayer2[0];

        // using this to check that the output of layer2 is correct
        Poseidon.hash(newResult).assertEquals(
          Poseidon.hash(architecture.precomputedOutputLayer2)
        );
      },
    },
  },
});

export class NeuralNetProof3Layer8x8 extends Experimental.ZkProgram.Proof(NeuralNet3Layer8x8) {}
export { Architecture, NeuralNet3Layer8x8 };
