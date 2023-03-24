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
  Circuit,
  Bool,
} from 'snarkyjs';
const tokenSymbol = 'NOOB';

export class NoobToken extends SmartContract {
  events = {
    'increase-totalAmountInCirculation-to': UInt64,
    'tokens-sent-to': PublicKey,
    'tokens-minted-to': PublicKey,
    'is-Paused': Bool,
  };

  @state(UInt64) totalAmountInCirculation = State<UInt64>();
  @state(UInt64) dummy = State<UInt64>();
  @state(UInt64) isPaused = State<Bool>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    const permissionToEdit = Permissions.proofOrSignature();
    this.account.permissions.set({
      ...Permissions.default(),
      editState: permissionToEdit,
      setTokenSymbol: permissionToEdit,
      // send: Permissions.none(),
      // receive: Permissions.none(),
      // access: Permissions.none(),
      setZkappUri: permissionToEdit,
      setTiming: permissionToEdit,
    });
  }

  // init is a method that initializes the contract.
  @method init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.from(0));
    this.dummy.set(UInt64.from(0));
    this.account.zkappUri.set('www.zkapp.com');
    this.isPaused.set(new Bool(false));
  }

  // method to allow the contract owner to pause the contract
  @method pause(isPaused: Bool) {
    let currentIsPaused = this.isPaused.get();
    this.isPaused.assertEquals(currentIsPaused);

    this.isPaused.set(isPaused);
    // this makes sure that the function can only be called by the contract owner
    this.requireSignature();
    this.emitEvent('is-Paused', isPaused);
  }

  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64
    // adminSignature: Signature
  ) {
    // check if the contract is paused
    let currentisPaused = this.isPaused.get();
    this.isPaused.assertEquals(currentisPaused);
    currentisPaused.assertEquals(new Bool(false));

    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    this.token.mint({
      address: receiverAddress,
      amount,
    });
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);

    // emit events
    this.emitEvent('tokens-minted-to', receiverAddress);
    this.emitEvent(
      'increase-totalAmountInCirculation-to',
      newTotalAmountInCirculation
    );
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
    this.emitEvent('tokens-sent-to', receiverAddress);
  }

  // mintWithMina is a method that mints tokens with Mina. It takes a receiverAddress and amount as parameters.
  // It adds the amount to the totalAmountInCirculation and mints the amount to the receiverAddress.
  // The amount is converted to a UInt64 before being added to totalAmountInCirculation.

  @method mintWithMina(receiverAddress: PublicKey, amount: UInt64) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    let balance = this.account.balance.get();
    this.account.balance.assertEquals(balance);

    balance.assertGreaterThanOrEqual(amount);
    // balance.assertEquals(amount);
    this.token.mint({
      address: receiverAddress,
      amount,
    });
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);

    // emitting events
    this.emitEvent('tokens-minted-to', receiverAddress);
    this.emitEvent('increase-totalAmountInCirculation-to', amount);
  }

  // This function checks that the current timestamp is between the start and end dates and sends NOOB if correct time
  // if the current timestamp is not between the start and end dates, the function will fail

  // endDate is used as input to the method to make sure testing is possible. In production, endDate should probably be a constant.
  // dependecy: need to have minted at least 1 NOOB token to zkAppAddress before calling this method
  // this function is used to send NOOB tokens to a specified address if the current timestamp is between the start and end dates
  // parameters:
  // - receiverAddress: the address to which the NOOB tokens will be sent
  // - amount: the amount of NOOB tokens to be sent
  // - endDate: the end date

  @method sendNOOBIfCorrectTime(
    receiverAddress: PublicKey,
    amount: UInt64,
    endDate: UInt64
  ) {
    // defining the start date
    let startDate = UInt64.from(1672531200000); // UInt64.from(Date.UTC(2023, 0, 1)) => 1.Jan.2023

    //  checking that the current timestamp is between the start and end dates
    this.network.timestamp.assertBetween(startDate, endDate);

    // sending NOOB if correct time
    this.token.send({
      from: this.address,
      to: receiverAddress,
      amount: amount,
    });

    // emitting events
    this.emitEvent('tokens-sent-to', receiverAddress);
  }

  //   @method increaseVesting(
  //     senderAddress: PublicKey,
  //     amount: UInt64,
  //     lockupPeriod: UInt64
  //   ) { }
}
