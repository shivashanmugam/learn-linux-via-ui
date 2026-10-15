export const MEMORY_SIZE = 16;
export const WORD_MASK = 0xff;
export const OPERAND_MASK = 0x0f;

export type Mnemonic = 'HLT' | 'LDA' | 'ADD' | 'SUB' | 'STA' | 'LDI' | 'JMP' | 'JZ' | 'JC' | 'OUT';
export type OperandKind = 'none' | 'address' | 'value';

export interface OpInfo {
  code: number;
  mnemonic: Mnemonic;
  operand: OperandKind;
  name: string;
  summary: string;
  rtl: string;
}

export const OPS: readonly OpInfo[] = [
  { code: 0, mnemonic: 'HLT', operand: 'none', name: 'Halt', summary: 'Stop the clock. The program is finished.', rtl: 'stop' },
  { code: 1, mnemonic: 'LDA', operand: 'address', name: 'Load', summary: 'Copy the value stored at address a into the accumulator.', rtl: 'ACC ← M[a]' },
  { code: 2, mnemonic: 'ADD', operand: 'address', name: 'Add', summary: 'Add the value at address a to the accumulator. Sets Z and C.', rtl: 'ACC ← ACC + M[a]' },
  { code: 3, mnemonic: 'SUB', operand: 'address', name: 'Subtract', summary: 'Subtract the value at address a from the accumulator. Sets Z and C (borrow).', rtl: 'ACC ← ACC − M[a]' },
  { code: 4, mnemonic: 'STA', operand: 'address', name: 'Store', summary: 'Write the accumulator into memory at address a.', rtl: 'M[a] ← ACC' },
  { code: 5, mnemonic: 'LDI', operand: 'value', name: 'Load immediate', summary: 'Put the number n (0–15) from the instruction itself into the accumulator.', rtl: 'ACC ← n' },
  { code: 6, mnemonic: 'JMP', operand: 'address', name: 'Jump', summary: 'Continue execution at address a.', rtl: 'PC ← a' },
  { code: 7, mnemonic: 'JZ', operand: 'address', name: 'Jump if zero', summary: 'Jump to a only if the last ALU result was zero (Z = 1).', rtl: 'if Z: PC ← a' },
  { code: 8, mnemonic: 'JC', operand: 'address', name: 'Jump if carry', summary: 'Jump to a only if the last ALU operation carried / borrowed (C = 1).', rtl: 'if C: PC ← a' },
  { code: 9, mnemonic: 'OUT', operand: 'none', name: 'Output', summary: 'Send the accumulator to the output display.', rtl: 'OUT ← ACC' },
];

export const opByCode = (code: number): OpInfo | undefined => OPS.find((o) => o.code === code);

export const opByMnemonic = (mnemonic: string): OpInfo | undefined =>
  OPS.find((o) => o.mnemonic === mnemonic.toUpperCase());

export interface Decoded {
  opcode: number;
  operand: number;
  op: OpInfo | undefined;
}

export function decode(word: number): Decoded {
  const opcode = (word >> 4) & OPERAND_MASK;
  return { opcode, operand: word & OPERAND_MASK, op: opByCode(opcode) };
}

export const encode = (opcode: number, operand: number): number =>
  ((opcode & OPERAND_MASK) << 4) | (operand & OPERAND_MASK);

export function disassemble(word: number): string {
  const { op, operand } = decode(word);
  if (!op) return '???';
  return op.operand === 'none' ? op.mnemonic : `${op.mnemonic} ${operand}`;
}

export const toBin = (n: number, bits = 8): string => (n >>> 0).toString(2).padStart(bits, '0');

export const toHex = (n: number, digits = 2): string => (n >>> 0).toString(16).toUpperCase().padStart(digits, '0');
