// Description: Smart Contract utilizing SnarkyNet and SnarkyLayers for an implmenetation of a Deep Neural Network
// for the MNIST Handwritten Digits Dataset: http://yann.lecun.com/exdb/mnist/

import {
  UInt64,
  Field,
  SmartContract,
  method,
  state,
  State,
  Circuit,
  DeployArgs,
  Permissions,
  Poseidon,
} from 'snarkyjs';
import { SnarkyLayer1, SnarkyLayer2 } from './snarkyLayer.js';
import { InputImage } from './inputImage.js';
import { SnarkyNet } from './snarkynet.js';

export class SmartSnarkyNet extends SmartContract {
  // Field State to store the classification
  @state(Field) classification = State<Field>(); // stored state for classification
  @state(Field) layer1Hash = State<Field>(); // stored state for classification
  @state(Field) layer2Hash = State<Field>(); // stored state for classification

  // model: SnarkyNet; // model object

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.classification.set(Field(0));
    this.layer1Hash.set(Field(0));
    this.layer2Hash.set(Field(0));
  }

  // TODO: make this a real init method
  @method initState(layer1: SnarkyLayer1, layer2: SnarkyLayer2) {
    super.init();
    // Initialize contract state
    this.classification.set(Field(0));
    this.layer1Hash.set(Poseidon.hash(layer1.toFields()));
    this.layer2Hash.set(Poseidon.hash(layer2.toFields()));
    // TODO:
    this.requireSignature();
  }

  @method predict(
    input: InputImage,
    layer1: SnarkyLayer1,
    layer2: SnarkyLayer2
  ) {
    // create the model
    let model = new SnarkyNet([layer1, layer2]);

    // check that the layers are correct
    let layerState = this.layer1Hash.get();
    this.layer1Hash.assertEquals(layerState);
    this.layer1Hash.assertEquals(Poseidon.hash(layer1.toFields()));

    // check that the layers are correct
    let layerState2 = this.layer2Hash.get();
    this.layer2Hash.assertEquals(layerState2);
    this.layer2Hash.assertEquals(Poseidon.hash(layer2.toFields()));

    // run the model and obtain the predictions
    let currentModel = model;
    let predictionAndSteps = currentModel.predict(input);
    let prediction = predictionAndSteps.result;
    console.log('prediction: ', prediction);
    // console.log('prediction to string: ', prediction.toString());

    // find the max value and its index
    // TODO: make this a loop
    // there is a bug that prevents this from working in a loop
    // looks complicated but it simply finds the max value and its index
    let max01 = Field(0);
    let classification01 = Field(0);

    [max01, classification01] = Circuit.if(
      prediction[0].greaterThan(prediction[1]),
      (() => {
        // TRUE
        return [prediction[0], Field(0)];
      })(),
      (() => {
        // FALSE
        classification01 = Field(1);
        return [prediction[1], Field(1)];
      })()
    );

    let max12 = Field(0);
    let classification12 = Field(0);
    [max12, classification12] = Circuit.if(
      max01.greaterThan(prediction[2]),
      (() => {
        // TRUE
        return [max01, classification01];
      })(),
      (() => {
        // FALSE
        return [prediction[2], Field(2)];
      })()
    );

    let max23 = Field(0);
    let classification23 = Field(0);
    [max23, classification23] = Circuit.if(
      max12.greaterThan(prediction[3]),
      (() => {
        // TRUE
        return [max12, classification12];
      })(),
      (() => {
        // FALSE
        return [prediction[3], Field(3)];
      })()
    );

    let max34 = Field(0);
    let classification34 = Field(0);
    [max34, classification34] = Circuit.if(
      max23.greaterThan(prediction[4]),
      (() => {
        // TRUE
        return [max23, classification23];
      })(),
      (() => {
        // FALSE
        return [prediction[4], Field(4)];
      })()
    );

    let max45 = Field(0);
    let classification45 = Field(0);
    [max45, classification45] = Circuit.if(
      max34.greaterThan(prediction[5]),
      (() => {
        // TRUE

        return [max34, classification34];
      })(),
      (() => {
        // FALSE

        return [prediction[5], Field(5)];
      })()
    );

    let max56 = Field(0);
    let classification56 = Field(0);

    [max56, classification56] = Circuit.if(
      max45.greaterThan(prediction[6]),
      (() => {
        // TRUE

        return [max45, classification45];
      })(),
      (() => {
        // FALSE

        return [prediction[6], Field(6)];
      })()
    );

    let max67 = Field(0);
    let classification67 = Field(0);
    [max67, classification67] = Circuit.if(
      max56.greaterThan(prediction[7]),
      (() => {
        // TRUE

        return [max56, classification56];
      })(),
      (() => {
        // FALSE

        return [prediction[7], Field(7)];
      })()
    );

    let max78 = Field(0);
    let classification78 = Field(0);
    [max78, classification78] = Circuit.if(
      max67.greaterThan(prediction[8]),
      (() => {
        // TRUE

        return [max67, classification67];
      })(),
      (() => {
        // FALSE

        return [prediction[8], Field(8)];
      })()
    );

    let max89 = Field(0);
    let classification89 = Field(0);
    [max89, classification89] = Circuit.if(
      max78.greaterThan(prediction[9]),
      (() => {
        // TRUE

        return [max78, classification78];
      })(),
      (() => {
        // FALSE

        return [prediction[9], Field(9)];
      })()
    );
    // ---------------------------- set the classification ----------------------------
    let classification = this.classification.get();
    this.classification.assertEquals(classification);
    this.classification.set(classification89);
  }
}
