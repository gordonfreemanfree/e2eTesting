# Mina zkApp: E2etesting

The Repo consists of two zkApps - noobToken and smartSnarkyNet

## SmartSnarkyNet

The SmartSnarkyNet is a basic implementation of a Neural Net that classifies images.
The zkApp gets called by a proxy zkApp to be able to change the SmartSnarkyNet without having to change the API from the frontend. It basically is used to test Call stack composobality. We are sending only one proof to the zkApp that verifys it and updates the state to the classification.
So if you privately input a picture of a 7 the state will be updated to a 7.

### Implementation

We are using a few tricks here.

1. InputImage is scaled to 8x8 grayscale. In order to get rid off Floats we simply multiply each pixel by a factor. This needs to be done in order to use the pixels as Fields. (factor is 10^3)
2. The weights of the NN are trained with a custom constraint function so that weights will be constraint to positive values. Again we simply multiply the Floats with a factor to be able to use them as Fields. (factor is 10^3)
3. During the matrix multiplication we have to do a kind of normalization because we ran into overflows. Our cheap trick is that we simply devide by another factor.
4. For every Layer we generate a seperate proof. In our case we used a 2 Layer NN. The first proof is generated in a zkProgram called NeuralNet. We then verify the first proof during the second proof generation and also make sure that the output of proof 1 is used as input for proof 2. Lastley we send the second proof through the proxy to the smartSnarkyNet. In there the validity of the proof is checked. It is also checked that the layers used for proof generation are the ones stored as hashes in the smartSnarkyNet. Finally the predict method finds the highest value in the output of proof2 and sets its classification state to the index of the highest value which represents the classification. (This step should probably also be done in the zkProgram).
   `So what's the point of using a zkProgram here?`
   We can use this method to generate larger proofs and bypass circuit limitations.

### Limitations

1. We weren't able to do sufficient accuracy tests after the whole scaling and normalization steps. In our very limited tests (20) we found one false classification.
2. The overall accuracy after the training process and before the implemention into circuits was around about 80%.

### Acknowledgement

The project used Malkofos SnarkyNet-MNIST-Digits
"https://github.com/Makalfo/SnarkyNet-MNIST-Digits"
as a starting point, but improved the concept of zk ML Application by
porting the prediction into a circuit.

## How to build

```sh
npm run build
```

## How to run tests

There is a process variable that is used to switch between local and berkeley tests.
`setEnvVars.js`

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## License

[Apache-2.0](LICENSE)
