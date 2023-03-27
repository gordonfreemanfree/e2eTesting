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
  Reducer,
  Struct,
  isReady,
} from 'snarkyjs';

await isReady;
const tokenSymbol = 'NOOB';
// const INCREMENT = Field(1);

export class NoobToken extends SmartContract {
  reducer = Reducer({ actionType: Field });

  events = {
    'increase-totalAmountInCirculation-to': UInt64,
    'tokens-sent-to': PublicKey,
    'tokens-minted-to': PublicKey,
    'is-Paused': Bool,
  };

  @state(UInt64) totalAmountInCirculation = State<UInt64>();
  @state(UInt64) dummy = State<UInt64>();
  @state(UInt64) isPaused = State<Bool>();
  // used for actions
  @state(Field) actionsHash = State<Field>();
  @state(Field) actionCounter = State<Field>();
  // @state(Field) whiteListMerkleTreeRoot = State<Field>();
  @state(UInt64) startDate = State<UInt64>();

  // init is a method that initializes the contract.
  init() {
    super.init();
    this.account.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.from(0));
    this.dummy.set(UInt64.from(0));
    this.account.zkappUri.set('www.zkapp.com');
    this.isPaused.set(new Bool(false));
    this.actionsHash.set(Reducer.initialActionsHash);
    this.actionCounter.set(Field(0));
    this.account.permissions.set({
      ...Permissions.default(),
      access: Permissions.proofOrSignature(),
      setVerificationKey: Permissions.impossible(),
      editState: Permissions.proofOrSignature(),
    });
  }

  // dummy method to test the reducer
  @method incrementCounter(key: Field) {
    this.reducer.dispatch(key);
  }

  // dummy method to test the reducer
  @method rollUpActions() {
    let actionsHash = this.actionsHash.get();
    this.actionsHash.assertEquals(actionsHash);
    let currentActionCounter = this.actionCounter.get();
    this.actionCounter.assertEquals(currentActionCounter);
    let pendingActions = this.reducer.getActions({
      fromActionHash: actionsHash,
    });

    let { state: newState, actionsHash: newActionsHash } = this.reducer.reduce(
      pendingActions,
      Field,
      (state: Field, _action: Field) => {
        return state.add(_action);
      },
      { state: currentActionCounter, actionsHash: actionsHash }
      // { maxTransactionsWithActions: 10 }
    );
    this.actionsHash.set(newActionsHash);
    Circuit.log('newState is', newState);
    this.actionCounter.set(newState);
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

  @method mint(receiverAddress: PublicKey, amount: UInt64) {
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

  // mintWithMina is a method that mints tokens if the Mina balance is greater than the amount requested.
  // It takes a receiverAddress and amount as parameters.

  // WARNING: This method is only for testing purposes and should not be used in production.
  // it does not move Mina to new location.
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
    // getting the start date
    let currentStartDate = this.startDate.get(); // UInt64.from(Date.UTC(2023, 0, 1)) => 1.Jan.2023
    this.startDate.assertEquals(currentStartDate);

    //  checking that the current timestamp is between the start and end dates
    this.network.timestamp.assertBetween(currentStartDate, endDate);

    // sending NOOB if correct time
    this.token.send({
      from: this.address,
      to: receiverAddress,
      amount: amount,
    });

    // emitting events
    this.emitEvent('tokens-sent-to', receiverAddress);
  }
}
