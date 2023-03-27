# Mina zkApp: E2etesting

This template uses TypeScript.
The Repo consists of two zkApps - noobToken and smartSnarkyNet

## SmartSnarkyNet

The SmartSnarkyNet is a basic implementation of a Neural Net that classifies images.
The zkApp gets called by a proxy zkApp to be able to change the SmartSnarkyNet without having to change the API from the frontend. It basically is used to test Call stack composobality. We are sending only one proof to the zkApp that verifys it and updates the state to the classification.
So if you privately input a picture of a 7 the state will be updated to a 7.

### Implementation

We are using a few tricks here.

1. InputImage has to be scaled to 8x8 grayscale. In order to get rid off Floats we simply multiply each pixel by a factor. This needs to be done in order to use the pixels as Fields. (factor is 10^3)
2. The weights of the NN are trained with a custom constraint function so that weights will be constraint to positive values. Again we simply multiply the Floats with a factor to be able to use them as Fields.
3.

## How to build

```sh
npm run build
```

## How to run tests

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
