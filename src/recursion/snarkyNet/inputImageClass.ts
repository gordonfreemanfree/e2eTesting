// This file is used to generate an InputImage class that is used to store the image matrix and use in the circuit.

export { InputImage };

import { Field, CircuitValue, arrayProp, Struct, Circuit } from 'snarkyjs';

// This is the class that will be used to store the image matrix
// the size of the matrix is 1x64
class InputImage extends CircuitValue {
  @arrayProp(Field, 64) value: Array<Field>;

  constructor(value: Array<Field>) {
    super();
    this.value = this.num2Int64_t1(value);
  }
  num2Int64_t1(x: Array<Field>): Array<Field> {
    let y = Array();
    x.forEach((value, index) => (y[index] = this.num2Int64(value)));
    return y;
  }
  num2Int64(x: Field): Field {
    return Field(x);
  }
}

// class InputImage extends Struct({
//   value: Circuit.array(Field, 64),
// }) {
//   static num2Int64_t1(x: Field[]): Field[] {
//     let y = Array();
//     x.forEach((value, index) => (y[index] = this.num2Int64(value)));
//     return y;
//   }
//   static num2Int64(x: Field): Field {
//     return Field(x);
//   }
// }
