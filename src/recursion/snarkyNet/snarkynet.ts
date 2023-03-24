// Description: SnarkyNet class to run the model

export { SnarkyNet };

import { CircuitValue, Field, isReady } from 'snarkyjs';
import { InputImage } from './inputImageClass.js';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
import { SnarkyTensor } from './snarkyTensor.js';

await isReady;

class SnarkyNet extends CircuitValue {
  layers: [SnarkyLayer1, SnarkyLayer2];

  constructor(layers: [SnarkyLayer1, SnarkyLayer2]) {
    super();

    // SnarkyLayers
    this.layers = layers; // SnarkyJS Layers
  }

  // predict(inputs: InputImage): Field[] {
  //   console.log('in predict start');
  //   // Prediction method to run the model
  //   // Step 1. Convert initial inputs to a float
  //   let x = [inputs.value];
  //   console.log('in predict after num2Field_t2');
  //   // Step 2. Call the SnarkyLayers
  //   this.layers.forEach((layer) => (x = layer.call(x)));
  //   console.log('in predict after layers.forEach');
  //   // Step 3. Return the output
  //   return x[0];
  // }

  predict(
    inputs: InputImage
  ): { result: Field[]; intermediateResults: Field[][] } {
    console.log('in predict start');
    // Prediction method to run the model
    // Step 1. Convert initial inputs to a float
    let x = [inputs.value];
    console.log('in predict after num2Field_t2');

    // Step 2. Call the SnarkyLayers
    let intermediateResults = []; // Array to store intermediate results

    for (let i = 0; i < this.layers.length; i++) {
      let layer = this.layers[i];
      x = layer.call(x);
      intermediateResults.push(x);
    }
    console.log('in predict after layers operations');

    // Step 3. Parse Classes
    // console.log('x is', x.toString());
    // console.log('x[0] is', x[0].toString());
    let newIntermediateResults = [
      intermediateResults[0][0],
      intermediateResults[1][0],
    ];
    console.log('newIntermediateResults', newIntermediateResults);
    console.log('newIntermediateResults', newIntermediateResults[0].toString());
    console.log('newIntermediateResults', newIntermediateResults[0]);
    console.log('intermediate', intermediateResults);
    console.log('intermediate', intermediateResults.values);
    console.log('intermediate', intermediateResults.toString());
    console.log('intermediate[0]', intermediateResults[0].toString());

    return { result: x[0], intermediateResults: newIntermediateResults };
  }

  // parse_classes(x: Array<Field>): Field[] {
  //   console.log('in parse_classes after output');
  //   console.log(' - Results - ');
  //   for (let i = 0; i < x.length; i++) {
  //     console.log('Classification of', i, ': ', x[i].toString(), '%');
  //   }
  //   return x;
  // }
}
