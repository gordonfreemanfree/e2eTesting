import {
  isReady,
  shutdown,
  Field,
  SelfProof,
  Experimental,
  SmartContract,
  state,
  method,
  DeployArgs,
  Proof,
  Permissions,
} from 'snarkyjs';

// Define a state object to represent the rollup state
class RollupState extends Field {}

// Define the rollup zkProgram
const Rollup = Experimental.ZkProgram({
  publicInput: RollupState,

  methods: {
    add: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: RollupState,
        earlierProof1: SelfProof<RollupState>,
        earlierProof2: SelfProof<RollupState>
      ) {
        // Verify the two earlier proofs
        earlierProof1.verify();
        earlierProof2.verify();

        // Compute the sum of the two earlier states
        const sum = earlierProof1.publicInput.add(earlierProof2.publicInput);

        // Check that the computed state matches the new state
        newState.assertEquals(sum);
      },
    },
  },
});

// Define a type to represent a proof with a result value of type Field
type FieldProof = Proof<RollupState> & { result: Field };

// Define a function to add two Field elements and return a FieldProof
async function add(a: Field, b: Field): Promise<FieldProof> {
  // Generate a proof of the addition
  const proof = await Rollup.add(RollupState.add(a, b));

  // Return the proof with the resulting sum as the result value
  return { ...proof, result: a.add(b) };
}

// Define a function to add multiple Field elements and return their sum as a FieldProof
async function addMany(numbers: Field[]): Promise<FieldProof> {
  // Start with an initial state of zero
  let state = RollupState.zero();

  // Iterate over the numbers and add them to the rollup system
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i];

    // Generate a proof of the addition and update the rollup state
    const proof = await add(state, number);
    state = proof.publicInput;
  }

  // Return the final rollup state as the result value
  return { ...proof, result: state };
}

// Define a smart contract that uses the RollupProof to update the state of the rollup system
class RollupContract extends SmartContract {
  @state(RollupState) state = State<RollupState>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(state: RollupState) {
    this.state.set(state);
  }

  @method add(proof: FieldProof) {
    const currentState = this.state.get();
    this.state.assertEquals(currentState);

    proof.verify();

    this.state.set(proof.publicInput);
  }
}

async function main() {
  await isReady;

  console.log('SnarkyJS loaded');

  console.log('Adding numbers using a rollup system...');

  // Define some numbers to add together
  const numbers = [Field(3), Field(7), Field(2), Field(5)];

  // Add the numbers together using a rollup system and get a proof of the sum
  const proof = await addMany(numbers);

  console.log('Result:', proof.result.toString());

  console.log('Verifying rollup proof...');

  // Verify the rollup proof using the Rollup zkProgram's verification key
  const { verificationKey } = await Rollup.compile();
  const ok = await proof.verify();
  console.log('Verification result:', ok);

  console.log('Shutting down...');

  await shutdown();
}

// Run the main function
main();
