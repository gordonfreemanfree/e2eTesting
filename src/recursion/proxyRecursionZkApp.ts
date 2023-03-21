import {
  SmartContract,
  State,
  UInt64,
  state,
  method,
  PublicKey,
} from 'snarkyjs';
import { RecursionZkApp } from './recursionZkApp.js';

export class ProxyRecursionZkApp extends SmartContract {
  @state(UInt64) onChainState = State<UInt64>();

  @method init() {
    super.init();
    this.onChainState.set(UInt64.from(0));
  }

  @method callRecursionDummyState(
    amount: UInt64,
    RecursionZkAppAddress: PublicKey
  ) {
    const recursionZkApp = new RecursionZkApp(RecursionZkAppAddress);
    recursionZkApp.increaseDummyState(amount);
  }
}
