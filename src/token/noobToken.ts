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
  Field,
} from 'snarkyjs';
const tokenSymbol = 'NOOB';

export class NoobToken extends SmartContract {
  @state(UInt64) totalAmountInCirculation = State<UInt64>();
  deploy(args: DeployArgs) {
    super.deploy(args);
    const permissionToEdit = Permissions.proofOrSignature();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: permissionToEdit,
      setTokenSymbol: permissionToEdit,
      send: Permissions.none(),
      receive: Permissions.none(),
      access: Permissions.none(),
      setZkappUri: permissionToEdit,
    });
  }

  @method init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.from(0));
    this.account.zkappUri.set('www.zkapp.com');
  }

  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64
    // adminSignature: Signature
  ) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);
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
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
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

    // balance.assertGreaterThanOrEqual(amount);
    balance.assertEquals(amount);
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
  // @method sendTokenIfCorrectTime(
  //   senderAddress: PublicKey,
  //   receiverAddress: PublicKey,
  //   amount: UInt64
  // ) {
  //   // getting the current timestamp
  //   let currentTimestamp = this.network.timestamp.get();
  //   this.network.timestamp.assertEquals(currentTimestamp);

  //   // defining the start and end dates
  //   let startDate = UInt64.from(Date.UTC(2023, 17, 3));
  //   let endDate = UInt64.from(Date.UTC(2023, 17, 4));

  //   // checking that the current timestamp is between the start and end dates
  //   this.network.timestamp.assertBetween(startDate, endDate);

  //   this.token.send({
  //     from: senderAddress,
  //     to: receiverAddress,
  //     amount,
  //   });
  // }
}
