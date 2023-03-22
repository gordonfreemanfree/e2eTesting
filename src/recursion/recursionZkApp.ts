import {
  SmartContract,
  State,
  UInt64,
  state,
  method,
  Experimental,
  Field,
  SelfProof,
} from 'snarkyjs';

type ProofWithResult<T> = {
  proof: SelfProof<Field>;
  result: T;
};

export const Add = Experimental.ZkProgram({
  publicInput: Field,

  methods: {
    init: {
      privateInputs: [],

      method(state: Field) {
        state.assertEquals(Field(0));
      },
    },

    addNumber: {
      privateInputs: [SelfProof, Field],

      method(
        newState: Field,
        earlierProof: SelfProof<Field>,
        numberToAdd: Field
      ) {
        earlierProof.verify();
        newState.assertEquals(earlierProof.publicInput.add(numberToAdd));
      },
    },

    add: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: Field,
        earlierProof1: SelfProof<Field>,
        earlierProof2: SelfProof<Field>
      ) {
        earlierProof1.verify();
        earlierProof2.verify();
        newState.assertEquals(
          earlierProof1.publicInput.add(earlierProof2.publicInput)
        );
      },
    },
  },
});

export let AddProof_ = Experimental.ZkProgram.Proof(Add);
export class AddProof extends AddProof_ {}

export class RecursionZkApp extends SmartContract {
  @state(UInt64) dummyState = State<UInt64>();

  @method init() {
    super.init();
    this.dummyState.set(UInt64.from(0));
  }

  @method increaseDummyState(amount: UInt64) {
    let currentDummyState = this.dummyState.get();
    this.dummyState.assertEquals(currentDummyState);

    this.dummyState.set(currentDummyState.add(amount));
  }

  @method proofVerification(proof: AddProof) {
    proof.verify();

    let currentDummyState = this.dummyState.get();
    this.dummyState.assertEquals(currentDummyState);

    this.dummyState.set(UInt64.from(400));
  }
}
