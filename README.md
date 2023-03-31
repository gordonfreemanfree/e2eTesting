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

### List of tests

1. Surface area 8: deploy zkApps and check verificationKeyHash - expecting success
2. Surface area 1/2: Using proxy zkApp to call another zkApp that verifies a recursive proof - expecting success
3. Surface area 7: try to update hashes with signature while "editstate" is proofOrSignature() - expecting success
4. Surface area 7: set Permission "editState" to proof() - expecting success
5. Surface area 7: try to update hashes with signature while "editstate" is proof() but the method requires a signature - expecting error
6. Surface area 7: set permission "access" to signature() - expecting success
7. Surface area 1/2/7: Using proxy zkApp to call another zkApp that verifies a recursive proof - expecting error because "access" is signature()
8. Surface area 7: changing Permission: "setZkappUri", "setVerificationKey", "setTokenSymbol", "setPermissions" to impossible() to fix architecture and "access" to proof() to still be able to call predict - expecting success
9. Surface area 7: changing Permission "access" to signature, BUT permission "setPermission" is impossible - expecting error

## Runtime

## How to build

```sh
npm run build
```

## How to run tests

1. There is a process variable that is used to switch between local and berkeley tests.
   `./setEnvVars.js`

```sh
npm run test
npm run testw # watch mode
```

## How to run coverage

```sh
npm run coverage
```

## NoobToken

NoobToken is a very basic token contract that is build to test specific scenarios.

### Implementation

NoobToken is a really simple zkApp to test different scenarios. It offers different features:

1. minting can depend upon the account balance of Mina.
2. the minting process can be stopped through a state variable.
3. Events are emmited after every method call.
4. Actions can be used to update a state variable.
5. sending can depend upon timestamp.

### Limitations

1. No method here is intended to be production ready. Everything is for testing purpose.

### List of tests

The tests are splitted up into multiple files. Every test file starts with a new deployment of the zkApp.
`noobTokenAction.test.ts`

1. Surface area 8: checking that zkAppVerificationKey gets deployed correctly - expecting success
2. Surface area 3: Sending actions - expecting success
3. Surface area -: Waiting one block
4. Surface area 3: Reducing actions and updating state - expecting success
5.

## Runtime

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
