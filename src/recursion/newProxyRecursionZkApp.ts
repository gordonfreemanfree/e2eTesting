import {
  SmartContract,
  State,
  UInt64,
  state,
  method,
  PublicKey,
  Permissions,
} from 'snarkyjs';
import { SmartSnarkyNet } from './snarkyNet/smartSnarkyNet';
import { NeuralNetProof, newNeuralNetProof } from './snarkyNet/recursionProof';
import { newSmartSnarkyNet } from './snarkyNet/newSmartSnarkyNet';

export class newProxyRecursionZkApp extends SmartContract {
  @state(UInt64) onChainState = State<UInt64>();

  init() {
    super.init();
    this.onChainState.set(UInt64.from(0));
    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey: Permissions.signature(),
    });
  }

  @method callPredict(
    proof: newNeuralNetProof,
    smartSnarkyNetAddress: PublicKey
  ) {
    const smartSnarkyNet = new newSmartSnarkyNet(smartSnarkyNetAddress);
    smartSnarkyNet.predict(proof);
  }
}
