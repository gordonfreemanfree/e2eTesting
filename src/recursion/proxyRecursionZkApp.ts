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
import { NeuralNetProof } from './snarkyNet/recursionProof';
import { SmartSnarkyNet10x10 } from './snarkyNet/smartSnarky10x10/smartSnarkyNet10x10';
import { NeuralNetProof_10x10 } from './snarkyNet/smartSnarky10x10/recursionProof10x10';
// import { RecursionZkApp, AddProof } from './recursionZkApp.js';

export class ProxyRecursionZkApp extends SmartContract {
  @state(UInt64) onChainState = State<UInt64>();

  init() {
    super.init();
    this.onChainState.set(UInt64.from(0));
    this.account.permissions.set({
      ...Permissions.default(),
      setVerificationKey: Permissions.signature(),
    });
  }

  @method callPredict(proof: NeuralNetProof, smartSnarkyNetAddress: PublicKey) {
    const smartSnarkyNet = new SmartSnarkyNet(smartSnarkyNetAddress);
    smartSnarkyNet.predict(proof);
  }
}
