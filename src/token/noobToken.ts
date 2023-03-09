import {
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  UInt64,
  PublicKey,
  Signature,
} from 'snarkyjs';
const tokenSymbol = 'NOOB';

export class NoobToken extends SmartContract {
  @state(UInt64) totalAmountInCirculation = State<UInt64>();
  deploy(args: DeployArgs) {
    super.deploy(args);
    const permissionToEdit = Permissions.proof();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: permissionToEdit,
      setTokenSymbol: permissionToEdit,
      send: permissionToEdit,
      // receive: permissionToEdit,
    });
  }

  @method init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.from(0));
  }
  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64
    // adminSignature: Signature
  ) {
    // let totalAmountInCirculation = this.totalAmountInCirculation.get();
    // this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    // let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);
    // adminSignature
    //   .verify(
    //     this.address,
    //     amount.toFields().concat(receiverAddress.toFields())
    //   )
    //   .assertTrue();
    this.token.mint({
      address: receiverAddress,
      amount,
    });
    // this.totalAmountInCirculation.set(newTotalAmountInCirculation);
  }

  @method sendTokens(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64
  ) {
    this.token.send({
      from: senderAddress,
      to: receiverAddress,
      amount: amount,
    });
  }

  @method mintWithMina(receiverAddress: PublicKey, amount: UInt64) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    let balance = this.account.balance.get();
    this.account.balance.assertEquals(balance);

    balance.assertGreaterThanOrEqual(amount);
    this.token.mint({
      address: receiverAddress,
      amount,
    });
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
  }

  //   @method increaseVesting(
  //     senderAddress: PublicKey,
  //     amount: UInt64,
  //     lockupPeriod: UInt64
  //   ) { }

  // This method should work again with snarkyjs 0.9.2
  @method sendIfCorrectTime(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64,
    startTime: UInt64,
    endTime: UInt64
  ) {
    // this.network.timestamp.assertBetween(startTime, endTime);
    this.token.send({
      from: senderAddress,
      to: receiverAddress,
      amount,
    });
  }
}
