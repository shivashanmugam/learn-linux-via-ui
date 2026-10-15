import { MEMORY_SIZE, OPERAND_MASK, WORD_MASK, decode, disassemble, toBin } from './isa.ts';

export type Phase = 'fetch' | 'decode' | 'execute';

export type Unit = 'pc' | 'ir' | 'decoder' | 'flags' | 'mar' | 'mdr' | 'acc' | 'alu' | 'out' | 'ram';

export type Edge =
  | 'pc-mar'
  | 'pc-inc'
  | 'mar-ram'
  | 'ram-mdr'
  | 'mdr-ram'
  | 'mdr-ir'
  | 'ir-dec'
  | 'ir-mar'
  | 'ir-pc'
  | 'ir-acc'
  | 'mdr-alu'
  | 'acc-alu'
  | 'alu-acc'
  | 'alu-flags'
  | 'acc-mdr'
  | 'acc-out';

export interface AluResult {
  op: 'ADD' | 'SUB' | 'PASS';
  a: number;
  b: number;
  result: number;
  z: boolean;
  c: boolean;
}

export interface CpuEvent {
  phase: Phase;
  title: string;
  rtl: string;
  explain: string;
  units: Unit[];
  edges: Edge[];
  memRead?: number;
  memWrite?: number;
  alu?: AluResult;
}

interface Snapshot {
  pc: number;
  acc: number;
  z: boolean;
  c: boolean;
  memory: number[];
  outputLength: number;
}

export interface TraceEntry {
  n: number;
  address: number;
  word: number;
  text: string;
  changes: string[];
}

export interface CpuState {
  memory: number[];
  pc: number;
  ir: number;
  acc: number;
  mar: number;
  mdr: number;
  z: boolean;
  c: boolean;
  output: number[];
  halted: boolean;
  error: string | null;
  /** Index of the next micro-step inside the current instruction (0 = start of fetch). */
  step: number;
  ticks: number;
  instructions: number;
  lastEvent: CpuEvent | null;
  instrStart: Snapshot | null;
  trace: TraceEntry[];
}

export const FETCH_STEPS = 4;
export const DECODE_STEP = FETCH_STEPS;
export const EXECUTE_START = FETCH_STEPS + 1;

export function createCpu(memory: readonly number[]): CpuState {
  const mem = Array.from({ length: MEMORY_SIZE }, (_, i) => (memory[i] ?? 0) & WORD_MASK);
  return {
    memory: mem,
    pc: 0,
    ir: 0,
    acc: 0,
    mar: 0,
    mdr: 0,
    z: false,
    c: false,
    output: [],
    halted: false,
    error: null,
    step: 0,
    ticks: 0,
    instructions: 0,
    lastEvent: null,
    instrStart: null,
    trace: [],
  };
}

export interface PlannedStep {
  phase: Phase;
  label: string;
}

const FETCH_PLAN: PlannedStep[] = [
  { phase: 'fetch', label: 'MAR ← PC' },
  { phase: 'fetch', label: 'MDR ← M[MAR]' },
  { phase: 'fetch', label: 'IR ← MDR' },
  { phase: 'fetch', label: 'PC ← PC + 1' },
];

function executePlan(word: number): string[] {
  const { op } = decode(word);
  switch (op?.mnemonic) {
    case 'LDA':
      return ['MAR ← operand', 'MDR ← M[MAR]', 'ACC ← MDR'];
    case 'ADD':
      return ['MAR ← operand', 'MDR ← M[MAR]', 'ACC ← ACC + MDR'];
    case 'SUB':
      return ['MAR ← operand', 'MDR ← M[MAR]', 'ACC ← ACC − MDR'];
    case 'STA':
      return ['MAR ← operand', 'MDR ← ACC', 'M[MAR] ← MDR'];
    case 'LDI':
      return ['ACC ← operand'];
    case 'JMP':
      return ['PC ← operand'];
    case 'JZ':
      return ['if Z = 1: PC ← operand'];
    case 'JC':
      return ['if C = 1: PC ← operand'];
    case 'OUT':
      return ['OUT ← ACC'];
    case 'HLT':
      return ['stop the clock'];
    default:
      return ['illegal opcode → halt'];
  }
}

/**
 * The list of micro-steps for the instruction currently in flight.
 * Execute steps are only known once the instruction has been copied into IR.
 */
export function microPlan(s: CpuState): { steps: PlannedStep[]; executeKnown: boolean } {
  const executeKnown = s.step > 2;
  const steps: PlannedStep[] = [...FETCH_PLAN, { phase: 'decode', label: 'decode IR' }];
  if (executeKnown) {
    for (const label of executePlan(s.ir)) steps.push({ phase: 'execute', label });
  }
  return { steps, executeKnown };
}

const executeLength = (word: number): number => executePlan(word).length;

export function phaseOf(step: number): Phase {
  if (step < FETCH_STEPS) return 'fetch';
  if (step === DECODE_STEP) return 'decode';
  return 'execute';
}

const snapshot = (s: CpuState): Snapshot => ({
  pc: s.pc,
  acc: s.acc,
  z: s.z,
  c: s.c,
  memory: s.memory,
  outputLength: s.output.length,
});

const bit = (b: boolean): number => (b ? 1 : 0);

function describeChanges(start: Snapshot, end: CpuState): string[] {
  const changes: string[] = [];
  if (start.acc !== end.acc) changes.push(`ACC ${start.acc} → ${end.acc}`);
  start.memory.forEach((v, i) => {
    if (v !== end.memory[i]) changes.push(`M[${i}] ${v} → ${end.memory[i]}`);
  });
  if (start.z !== end.z) changes.push(`Z ${bit(start.z)} → ${bit(end.z)}`);
  if (start.c !== end.c) changes.push(`C ${bit(start.c)} → ${bit(end.c)}`);
  if (end.pc !== ((start.pc + 1) & OPERAND_MASK) && !end.halted) changes.push(`jump → ${end.pc}`);
  for (const v of end.output.slice(start.outputLength)) changes.push(`output ${v}`);
  if (end.halted) changes.push(end.error ? 'error: halted' : 'halted');
  return changes;
}

function alu(op: AluResult['op'], a: number, b: number): AluResult {
  if (op === 'PASS') return { op, a, b, result: b, z: b === 0, c: false };
  const raw = op === 'ADD' ? a + b : a - b;
  const result = raw & WORD_MASK;
  return { op, a, b, result, z: result === 0, c: op === 'ADD' ? raw > WORD_MASK : raw < 0 };
}

function executeStep(s: CpuState, n: CpuState, index: number): CpuEvent {
  const { op, operand, opcode } = decode(s.ir);
  const mnemonic = op?.mnemonic;

  if (mnemonic === 'LDA' || mnemonic === 'ADD' || mnemonic === 'SUB' || mnemonic === 'STA') {
    if (index === 0) {
      n.mar = operand;
      return {
        phase: 'execute',
        title: 'Point at the data',
        rtl: `MAR ← operand (${operand})`,
        explain: `${mnemonic} works with memory cell ${operand}, so the operand part of IR (${toBin(operand, 4)}) is placed in the Memory Address Register.`,
        units: ['ir', 'mar'],
        edges: ['ir-mar'],
      };
    }
    if (mnemonic === 'STA') {
      if (index === 1) {
        n.mdr = s.acc;
        return {
          phase: 'execute',
          title: 'Prepare the data to write',
          rtl: `MDR ← ACC (${s.acc})`,
          explain: `The value to save (${s.acc}) is copied from the accumulator into the Memory Data Register, ready to travel across the data bus.`,
          units: ['acc', 'mdr'],
          edges: ['acc-mdr'],
        };
      }
      const memory = s.memory.slice();
      memory[s.mar] = s.mdr;
      n.memory = memory;
      return {
        phase: 'execute',
        title: 'Write to memory',
        rtl: `M[${s.mar}] ← MDR (${s.mdr})`,
        explain: `Memory cell ${s.mar} is overwritten: it held ${s.memory[s.mar]}, now it holds ${s.mdr}. This is how a program changes the state of memory.`,
        units: ['mar', 'mdr', 'ram'],
        edges: ['mar-ram', 'mdr-ram'],
        memWrite: s.mar,
      };
    }
    if (index === 1) {
      n.mdr = s.memory[s.mar];
      return {
        phase: 'execute',
        title: 'Read the data',
        rtl: `MDR ← M[${s.mar}] (${s.memory[s.mar]})`,
        explain: `Memory returns the value stored in cell ${s.mar}, which is ${s.memory[s.mar]}. It arrives in the Memory Data Register.`,
        units: ['mar', 'ram', 'mdr'],
        edges: ['mar-ram', 'ram-mdr'],
        memRead: s.mar,
      };
    }
    if (mnemonic === 'LDA') {
      const r = alu('PASS', s.acc, s.mdr);
      n.acc = r.result;
      return {
        phase: 'execute',
        title: 'Load the accumulator',
        rtl: `ACC ← MDR (${s.mdr})`,
        explain: `The value passes straight through the ALU into the accumulator. ACC was ${s.acc}, now it is ${r.result}. (A plain load does not change the flags.)`,
        units: ['mdr', 'alu', 'acc'],
        edges: ['mdr-alu', 'alu-acc'],
        alu: r,
      };
    }
    const r = alu(mnemonic, s.acc, s.mdr);
    n.acc = r.result;
    n.z = r.z;
    n.c = r.c;
    const sign = mnemonic === 'ADD' ? '+' : '−';
    const wrap =
      r.c && mnemonic === 'ADD'
        ? ` The true answer ${s.acc + s.mdr} does not fit in 8 bits, so it wraps around and the carry flag C is set.`
        : r.c
          ? ` The true answer ${s.acc - s.mdr} is negative, so it wraps around to ${r.result} and C is set to signal a borrow.`
          : '';
    return {
      phase: 'execute',
      title: 'Compute in the ALU',
      rtl: `ACC ← ACC ${sign} MDR (${s.acc} ${sign} ${s.mdr} = ${r.result})`,
      explain: `The Arithmetic Logic Unit takes A = ACC (${s.acc}) and B = MDR (${s.mdr}) and computes ${r.result}. The result goes back into ACC and the flags are updated: Z = ${bit(r.z)} (${r.z ? 'result is zero' : 'result is not zero'}), C = ${bit(r.c)}.${wrap}`,
      units: ['acc', 'mdr', 'alu', 'flags'],
      edges: ['acc-alu', 'mdr-alu', 'alu-acc', 'alu-flags'],
      alu: r,
    };
  }

  switch (mnemonic) {
    case 'LDI':
      n.acc = operand;
      return {
        phase: 'execute',
        title: 'Load a constant',
        rtl: `ACC ← ${operand}`,
        explain: `The number ${operand} is part of the instruction itself (an "immediate" value), so no memory access is needed. ACC becomes ${operand}.`,
        units: ['ir', 'acc'],
        edges: ['ir-acc'],
      };
    case 'JMP':
      n.pc = operand;
      return {
        phase: 'execute',
        title: 'Jump',
        rtl: `PC ← ${operand}`,
        explain: `The Program Counter is overwritten with ${operand}. The next fetch will read the instruction at address ${operand} instead of continuing in order — this is how loops are built.`,
        units: ['ir', 'pc'],
        edges: ['ir-pc'],
      };
    case 'JZ':
    case 'JC': {
      const flagName = mnemonic === 'JZ' ? 'Z' : 'C';
      const taken = mnemonic === 'JZ' ? s.z : s.c;
      if (taken) n.pc = operand;
      return {
        phase: 'execute',
        title: taken ? 'Condition true → jump' : 'Condition false → no jump',
        rtl: taken ? `${flagName} = 1, so PC ← ${operand}` : `${flagName} = 0, PC stays ${s.pc}`,
        explain: taken
          ? `The control unit checks flag ${flagName}. It is 1, so PC is set to ${operand}. This is how a CPU makes decisions.`
          : `The control unit checks flag ${flagName}. It is 0, so nothing happens and execution continues at address ${s.pc}.`,
        units: taken ? ['flags', 'decoder', 'ir', 'pc'] : ['flags', 'decoder'],
        edges: taken ? ['ir-pc'] : [],
      };
    }
    case 'OUT':
      n.output = [...s.output, s.acc];
      return {
        phase: 'execute',
        title: 'Output',
        rtl: `OUT ← ACC (${s.acc})`,
        explain: `The accumulator value ${s.acc} is sent to the output device, so the result of the computation becomes visible to the outside world.`,
        units: ['acc', 'out'],
        edges: ['acc-out'],
      };
    case 'HLT':
      n.halted = true;
      return {
        phase: 'execute',
        title: 'Halt',
        rtl: 'stop',
        explain: 'The control unit stops the clock. The program has finished; memory and the output hold the final results.',
        units: ['decoder'],
        edges: [],
      };
    default:
      n.halted = true;
      n.error = `Illegal instruction ${toBin(s.ir)} (opcode ${opcode}) at address ${s.instrStart?.pc ?? '?'}`;
      return {
        phase: 'execute',
        title: 'Illegal instruction',
        rtl: 'halt (error)',
        explain: `Opcode ${toBin(opcode, 4)} does not mean anything to this CPU, so it stops. This usually happens when the program counter runs into data instead of code.`,
        units: ['decoder'],
        edges: [],
      };
  }
}

/** Advance the CPU by one clock tick (one micro-step). Pure: returns a new state. */
export function tick(s: CpuState): CpuState {
  if (s.halted) return s;
  const n: CpuState = { ...s, ticks: s.ticks + 1, step: s.step + 1 };
  let ev: CpuEvent;

  switch (s.step) {
    case 0:
      n.instrStart = snapshot(s);
      n.mar = s.pc;
      ev = {
        phase: 'fetch',
        title: 'Send the address',
        rtl: `MAR ← PC (${s.pc})`,
        explain: `The Program Counter says the next instruction lives at address ${s.pc}. That address is copied into the Memory Address Register, which drives the address bus.`,
        units: ['pc', 'mar'],
        edges: ['pc-mar'],
      };
      break;
    case 1:
      n.mdr = s.memory[s.mar];
      ev = {
        phase: 'fetch',
        title: 'Read the instruction',
        rtl: `MDR ← M[${s.mar}] (${toBin(s.memory[s.mar])})`,
        explain: `Memory looks up cell ${s.mar} and puts its contents (${s.memory[s.mar]} = ${toBin(s.memory[s.mar])}) on the data bus. It lands in the Memory Data Register. Memory does not know whether this number is code or data.`,
        units: ['mar', 'ram', 'mdr'],
        edges: ['mar-ram', 'ram-mdr'],
        memRead: s.mar,
      };
      break;
    case 2:
      n.ir = s.mdr;
      ev = {
        phase: 'fetch',
        title: 'Latch into IR',
        rtl: `IR ← MDR (${toBin(s.mdr)})`,
        explain: `Because we are fetching, the byte is treated as an instruction and copied into the Instruction Register.`,
        units: ['mdr', 'ir'],
        edges: ['mdr-ir'],
      };
      break;
    case 3: {
      n.pc = (s.pc + 1) & OPERAND_MASK;
      ev = {
        phase: 'fetch',
        title: 'Advance the program counter',
        rtl: `PC ← PC + 1 (${n.pc})`,
        explain: `PC now points to the following address (${n.pc}), so the next fetch gets the next instruction — unless this instruction is a jump.`,
        units: ['pc'],
        edges: ['pc-inc'],
      };
      break;
    }
    case DECODE_STEP: {
      const { op, opcode, operand } = decode(s.ir);
      const bits = toBin(s.ir);
      ev = {
        phase: 'decode',
        title: op ? `Decode: ${disassemble(s.ir)}` : 'Decode: unknown opcode',
        rtl: `IR ${bits.slice(0, 4)} ${bits.slice(4)} → ${op ? disassemble(s.ir) : '???'}`,
        explain: op
          ? `The control unit splits IR into the opcode ${bits.slice(0, 4)} (${opcode} = ${op.mnemonic}, "${op.name}") and the operand ${bits.slice(4)} (${operand}). ${op.mnemonic} means: ${op.summary}`
          : `The upper four bits ${bits.slice(0, 4)} (${opcode}) are not a known opcode.`,
        units: ['ir', 'decoder'],
        edges: ['ir-dec'],
      };
      break;
    }
    default:
      ev = executeStep(s, n, s.step - EXECUTE_START);
  }

  n.lastEvent = ev;

  if (n.halted || n.step >= EXECUTE_START + executeLength(n.ir)) {
    const start = n.instrStart ?? snapshot(s);
    n.step = 0;
    n.instructions = s.instructions + 1;
    n.trace = [
      ...s.trace,
      {
        n: n.instructions,
        address: start.pc,
        word: n.ir,
        text: disassemble(n.ir),
        changes: describeChanges(start, n),
      },
    ];
  }
  return n;
}

/** Run micro-steps until the current instruction completes. */
export function stepInstruction(s: CpuState): CpuState {
  let n = tick(s);
  while (n.step !== 0 && !n.halted) n = tick(n);
  return n;
}
