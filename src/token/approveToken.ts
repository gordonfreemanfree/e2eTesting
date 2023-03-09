import { SmartContract, UInt64, method } from 'snarkyjs';

export class ApproveToken extends SmartContract {
  @method approveSend() {
    let amount = UInt64.from(1_000);
    this.balance.subInPlace(amount);
  }
}
