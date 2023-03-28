// Description: SnarkyNet class to run the model
// SnarkyNet is defined to represent the Deep Neural Network model.
// We use the output of the model to use as input for the NeuralNet ZkProgram

export { SnarkyNet_10x10 };

import { Field, isReady, Struct } from 'snarkyjs';
import { InputImage_10x10 } from './inputImage10x10.js';
import { SnarkyLayer1_10x10, SnarkyLayer2_10x10 } from './snarkyLayer10x10.js';

await isReady;

class SnarkyNet_10x10 extends Struct({
  layers: [SnarkyLayer1_10x10, SnarkyLayer2_10x10],
}) {
  constructor(layers: [SnarkyLayer1_10x10, SnarkyLayer2_10x10]) {
    super({ layers });
    this.layers = layers;
  }
  predict(
    inputs: InputImage_10x10
  ): { result: Field[]; intermediateResults: Field[][] } {
    console.log('in predict start');
    // Prediction method to run the model
    // Step 1. Convert initial inputs to a float
    let x = [inputs.value];
    // console.log('in predict after num2Field_t2');

    // Step 2. Call the SnarkyLayers
    let intermediateResults = []; // Array to store intermediate results

    for (let i = 0; i < this.layers.length; i++) {
      let layer = this.layers[i];
      x = layer.call(x);
      intermediateResults.push(x);
    }
    // console.log('in predict after layers operations');

    // Step 3. Parse Classes
    // console.log('x is', x.toString());
    // console.log('x[0] is', x[0].toString());
    let newIntermediateResults = [
      intermediateResults[0][0],
      intermediateResults[1][0],
    ];

    return { result: x[0], intermediateResults: newIntermediateResults };
  }
}
