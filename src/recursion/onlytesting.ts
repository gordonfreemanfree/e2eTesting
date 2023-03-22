// import {
//   SmartContract,
//   State,
//   UInt64,
//   state,
//   method,
//   Experimental,
//   Field,
//   SelfProof,
//   Signature,
//   PublicKey,
//   PrivateKey,
// } from 'snarkyjs';

// type ProofWithResult<T> = {
//   proof: SelfProof<Field>;
//   result: T;
// };

// // Signature verification method
// function verifySignature(
//   sig: Signature,
//   publicKey: PublicKey,
//   msg: Field[]
// ): boolean {
//   // TODO: Implement signature verification here
//   // Return true if the signature is valid, false otherwise
//   sig.verify(publicKey, msg);
//   return true;
// }

// export const SignatureVerifier = Experimental.ZkProgram({
//   publicInput: Field,

//   methods: {
//     verifySignature: {
//       privateInputs: [SelfProof, Field],

//       method(
//         newState: Field,
//         proof: SelfProof<Field>,
//         sig: Signature,
//         PublicKey: PublicKey,
//         Field: Field[]
//       ) {
//         proof.verify();
//         const isSignatureValid = verifySignature(sig, PublicKey, Field);
//         newState.assertEquals(isSignatureValid);
//       },
//     },

//     verifyAllSignatures: {
//       privateInputs: [SelfProof, SelfProof, SelfProof],

//       method(
//         newState: Field,
//         proof1: SelfProof<Field>,
//         proof2: SelfProof<Field>,
//         proof3: SelfProof<Field>
//       ) {
//         proof1.verify();
//         proof2.verify();
//         proof3.verify();
//         proof1.publicInput.assertEquals(Field(1));
//         proof2.publicInput.assertEquals(Field(1));
//         proof3.publicInput.assertEquals(Field(1));
//         newState.assertEquals(Field(1));
//       },
//     },
//   },
// });

// let testPrivateKey = PrivateKey.random();
// let testPublicKey = testPrivateKey.toPublicKey();

// const myArray: Field[] = [Field(1), Field(2), Field(3)];

// // create Signature
// const sig = Signature.create(testPrivateKey, myArray);
