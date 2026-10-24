import { useState } from 'react';
import { createCpu, type CpuEvent, type CpuState, type Edge, type Unit } from '../cpu/cpu.ts';
import { OPS, encode, type OpInfo } from '../cpu/isa.ts';
import { CpuDiagram } from './CpuDiagram.tsx';

interface Stop {
  id: string;
  name: string;
  short: string;
  units: Unit[];
  edges: Edge[];
  what: string;
  why: string;
  real: string;
  phase?: CpuEvent['phase'];
  showAlu?: boolean;
}

const ALL_UNITS: Unit[] = ['pc', 'mar', 'ir', 'mdr', 'decoder', 'alu', 'flags', 'acc', 'out', 'ram'];

const STOPS: Stop[] = [
  {
    id: 'overview',
    name: 'The whole processor',
    short: 'Overview',
    units: ALL_UNITS,
    edges: [],
    what:
      'A processor is a small set of storage boxes (registers), one calculator (the ALU) and a control unit that decides, on every clock tick, which box copies its value into which other box. Memory sits outside the processor and is connected to it by wires called buses.',
    why:
      'Each part does exactly one job. Splitting the work this way keeps every part simple, and the control unit combines them, one tiny step at a time, into anything a program asks for. A program is just a list of instructions, short commands like ADD (add) or STA (store) that each use a few of these parts. Whenever a part mentions an instruction, its meaning is listed underneath.',
    real: 'A real CPU has the same building blocks, just many more of them and much faster: billions of ticks per second instead of one per click.',
  },
  {
    id: 'ram',
    name: 'Memory (RAM)',
    short: 'Memory',
    units: ['ram'],
    edges: ['mar-ram', 'ram-mdr', 'mdr-ram'],
    what: 'A row of numbered cells outside the processor. Each cell holds one byte. Here there are 16 cells (addresses 0–15).',
    why:
      'The processor itself can only hold a handful of numbers. The program and all of its data have to live somewhere bigger, and memory is that place. The CPU can only reach a cell by sending its address.',
    real: 'Your computer has billions of bytes of RAM. Because it is much slower than the CPU, real chips also keep small, fast copies of recently used memory called caches.',
  },
  {
    id: 'buses',
    name: 'Address bus & data bus',
    short: 'Buses',
    units: ['mar', 'mdr', 'ram'],
    edges: ['mar-ram', 'ram-mdr', 'mdr-ram'],
    what:
      'Two bundles of wires between the processor and memory. The address bus carries “which cell?”, always from the CPU to memory. The data bus carries the value itself, in either direction.',
    why:
      'Memory needs to know both where and what. Separate wires for each let the CPU name a cell and move its contents without mixing the two up.',
    real: 'A 64-bit computer can move 64 bits (8 bytes) across its data bus at once. The width of the address bus sets how much memory the CPU can reach.',
  },
  {
    id: 'pc',
    name: 'Program Counter (PC)',
    short: 'PC',
    units: ['pc'],
    edges: ['pc-inc', 'pc-mar', 'ir-pc'],
    phase: 'fetch',
    what: 'Holds the address of the next instruction to fetch. After every fetch it adds 1 (the +1 loop at the top).',
    why:
      'Instructions are just numbers sitting in memory. Without the PC the processor would not know where it is in the program. Jump instructions (JMP “jump”, JZ “jump if zero”, JC “jump if carry”) work by overwriting the PC, which is how loops and if/else happen.',
    real: 'On x86 it is called the instruction pointer (RIP). Every function call, return and branch in every program is ultimately a change to this one register.',
  },
  {
    id: 'mar',
    name: 'Memory Address Register (MAR)',
    short: 'MAR',
    units: ['mar'],
    edges: ['pc-mar', 'ir-mar', 'mar-ram'],
    phase: 'fetch',
    what:
      'Holds the address the CPU wants to access right now and puts it on the address bus. Addresses come from two places: the PC (when fetching an instruction) or the operand of the IR (when reading or writing data).',
    why:
      'Memory needs a stable address held steady while it looks up the cell. Having one dedicated “gateway” register means the rest of the CPU can keep changing without disturbing the memory access in progress.',
    real: 'Modern CPUs translate addresses before they reach memory (virtual memory), so every program can believe it owns address 0 upwards.',
  },
  {
    id: 'mdr',
    name: 'Memory Data Register (MDR)',
    short: 'MDR',
    units: ['mdr'],
    edges: ['ram-mdr', 'mdr-ram', 'mdr-ir', 'mdr-alu', 'acc-mdr'],
    what:
      'Holds the value that just arrived from memory, or that is about to be written to memory. Every byte going in or out of the processor passes through here.',
    why:
      'Memory and the CPU work at different speeds and times. The MDR is a waiting area: memory can drop a value off, and the CPU picks it up on the next tick, sending it to the IR (if it is an instruction) or to the ALU (if it is data).',
    real: 'In real chips this role is played by load/store buffers and the cache interface, which can handle many memory transfers at once.',
  },
  {
    id: 'ir',
    name: 'Instruction Register (IR)',
    short: 'IR',
    units: ['ir'],
    edges: ['mdr-ir', 'ir-dec', 'ir-mar', 'ir-pc', 'ir-acc'],
    phase: 'decode',
    what:
      'Holds the instruction currently being carried out. Its top 4 bits are the opcode (what to do, orange) and its bottom 4 bits are the operand (which address or number, blue).',
    why:
      'The MDR is needed again during execution, for example to read the number that an ADD (add) instruction needs. So the instruction is copied into its own register where it stays put until the instruction is finished.',
    real: 'Real CPUs fetch and decode many instructions ahead of time in a pipeline, so they work on several instructions at once.',
  },
  {
    id: 'decoder',
    name: 'Decoder & control unit',
    short: 'Control unit',
    units: ['decoder', 'ir', 'pc'],
    edges: ['ir-dec'],
    phase: 'decode',
    what:
      'Reads the opcode in the IR and works out which steps the instruction needs. On each clock tick it switches on exactly the paths needed (for example “copy MDR into ACC”) and nothing else. The PC, IR and decoder together form the control unit (the dashed box).',
    why:
      'All the other parts are passive: they hold values or wait for input. Something has to conduct the orchestra, deciding what happens on each tick. That is the control unit. The clock gives it a steady beat to follow.',
    real: 'A CPU’s clock speed (e.g. 4 GHz) is how many of these ticks happen per second: four billion.',
  },
  {
    id: 'alu',
    name: 'Arithmetic Logic Unit (ALU)',
    short: 'ALU',
    units: ['alu'],
    edges: ['acc-alu', 'mdr-alu', 'alu-acc', 'alu-flags'],
    phase: 'execute',
    showAlu: true,
    what:
      'The calculator. It takes two inputs, A (from the accumulator) and B (from the MDR), and produces one result. This one can add, subtract, or pass B straight through.',
    why:
      'This is the only part that actually computes. Every other part just stores or moves numbers. Keeping the maths in one place means there is only one complicated circuit to build.',
    real: 'Real ALUs also do AND, OR, XOR, shifts and comparisons. Modern CPUs have several ALUs plus separate units for multiplication, decimals (floating point) and vectors.',
  },
  {
    id: 'acc',
    name: 'Accumulator (ACC)',
    short: 'ACC',
    units: ['acc'],
    edges: ['alu-acc', 'acc-alu', 'acc-mdr', 'acc-out', 'ir-acc'],
    phase: 'execute',
    what:
      'The processor’s working register, its scratch pad. Results of the ALU land here, and the next calculation starts from here. Two instructions work on it directly: STA (“store accumulator”) copies its value into a memory cell, and OUT (“output”) sends it to the output.',
    why:
      'Going to memory for every intermediate result would be slow. Keeping the current value inside the CPU lets a chain of operations (load, add, add, subtract…) run without leaving the processor.',
    real: 'Instead of a single accumulator, x86-64 has 16 general-purpose registers and ARM64 has 31. More registers mean even fewer trips to memory.',
  },
  {
    id: 'flags',
    name: 'Flags (Z and C)',
    short: 'Flags',
    units: ['flags'],
    edges: ['alu-flags'],
    phase: 'execute',
    what:
      'Two single-bit lights set by the ALU after every ADD (add) or SUB (subtract) instruction. Z = 1 means the result was zero. C = 1 means the result carried (was too big for 8 bits) or borrowed (went below zero).',
    why:
      'They let a program make decisions. Two conditional jump instructions read them: JZ (“jump if zero”) jumps only when Z = 1, and JC (“jump if carry”) jumps only when C = 1. Otherwise the program just carries on with the next instruction. This is how loops stop and how “if x > y” is answered: subtract y from x and check whether it borrowed.',
    real: 'x86 and ARM have more flags: a sign (negative) flag and an overflow flag for signed numbers. Every if statement in a high-level language compiles down to a compare that sets flags, followed by a conditional jump.',
  },
  {
    id: 'out',
    name: 'Output',
    short: 'Output',
    units: ['out'],
    edges: ['acc-out'],
    phase: 'execute',
    what: 'A simple output device. The OUT (“output”) instruction copies the accumulator here so the result of the computation becomes visible.',
    why: 'A computation is only useful if its result can leave the processor, whether to a screen, a file or a network.',
    real: 'Real computers talk to devices (screens, disks, network cards) through special memory addresses or I/O ports, usually managed by the operating system’s drivers.',
  },
];

const UNIT_TO_STOP: Record<Unit, string> = {
  ram: 'ram',
  pc: 'pc',
  mar: 'mar',
  mdr: 'mdr',
  ir: 'ir',
  decoder: 'decoder',
  alu: 'alu',
  acc: 'acc',
  flags: 'flags',
  out: 'out',
};

/** Instructions named anywhere in a stop's text, in instruction-set order. */
function mentionedOps(stop: Stop): OpInfo[] {
  const text = `${stop.what} ${stop.why} ${stop.real}`;
  return OPS.filter((op) => new RegExp(`\\b${op.mnemonic}\\b`).test(text));
}

const operandHint = (op: OpInfo) => (op.operand === 'address' ? ' a' : op.operand === 'value' ? ' n' : '');

/** A fixed snapshot: the "Add two numbers" program, partway through ADD y. */
function snapshot(stop: Stop, index: number): CpuState {
  const base = createCpu([21, 38, 71, 144, 0, 7, 5, 0]);
  return {
    ...base,
    pc: 2,
    ir: encode(2, 6),
    mar: 6,
    mdr: 5,
    acc: stop.showAlu ? 12 : 7,
    output: [],
    step: 0,
    ticks: index + 1,
    lastEvent: {
      phase: stop.phase ?? 'execute',
      title: stop.name,
      rtl: '',
      explain: '',
      units: stop.units,
      edges: stop.edges,
      alu: stop.showAlu ? { op: 'ADD', a: 7, b: 5, result: 12, z: false, c: false } : undefined,
    },
  };
}

export function ProcessorTour({ simulatorId }: { simulatorId: string }) {
  const [index, setIndex] = useState(0);
  const stop = STOPS[index];
  const go = (i: number) => setIndex(Math.max(0, Math.min(STOPS.length - 1, i)));
  const last = index === STOPS.length - 1;

  return (
    <section className="panel tour" aria-labelledby="tour-title">
      <header className="tour-head">
        <div>
          <span className="deck-kicker">Step 1 · Before running anything</span>
          <h2 id="tour-title" className="deck-title">
            Meet the processor: what each part is and why it exists
          </h2>
        </div>
        <a className="hint" href={`#${simulatorId}`}>
          Skip to the simulation ↓
        </a>
      </header>

      <div className="tour-grid">
        <div className="tour-diagram">
          <CpuDiagram
            cpu={snapshot(stop, index)}
            className={index === 0 ? undefined : 'tour-focus'}
            onUnitClick={(u) => go(STOPS.findIndex((s) => s.id === UNIT_TO_STOP[u]))}
          />
          <p className="hint center">
            Tip: click any box in the diagram to jump to its explanation. The values shown are a snapshot of the “Add two
            numbers” program in the middle of <code>ADD y</code>.
          </p>
        </div>

        <div className="tour-side">
          <nav className="tour-parts" aria-label="Processor parts">
            {STOPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={i === index ? 'active' : i < index ? 'seen' : ''}
                aria-current={i === index}
                onClick={() => go(i)}
              >
                {s.short}
              </button>
            ))}
          </nav>

          <article className="tour-card" key={stop.id}>
            <span className="tour-count">
              {index + 1} / {STOPS.length}
            </span>
            <h3>{stop.name}</h3>
            <div className="tour-row">
              <span className="tour-label">What it is</span>
              <p>{stop.what}</p>
            </div>
            <div className="tour-row why">
              <span className="tour-label">Why it exists</span>
              <p>{stop.why}</p>
            </div>
            <div className="tour-row real">
              <span className="tour-label">In a real CPU</span>
              <p>{stop.real}</p>
            </div>
            {mentionedOps(stop).length > 0 && (
              <div className="tour-row ops">
                <span className="tour-label">Instructions mentioned here</span>
                <ul className="tour-ops">
                  {mentionedOps(stop).map((op) => (
                    <li key={op.mnemonic}>
                      <code>
                        {op.mnemonic}
                        {operandHint(op)}
                      </code>
                      <span>
                        <b>{op.name}.</b> {op.summary} <span className="dim">({op.rtl})</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="dim small-note">
                  <code>a</code> = a memory address, <code>n</code> = a small number. The full list is in the{' '}
                  <a href="#instruction-set">instruction set</a> at the bottom of the page.
                </p>
              </div>
            )}
          </article>

          <div className="tour-nav">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>
              ◀ Previous
            </button>
            {last ? (
              <a className="button run" href={`#${simulatorId}`}>
                Now watch them work together ↓
              </a>
            ) : (
              <button type="button" className="primary" onClick={() => go(index + 1)}>
                Next: {STOPS[index + 1].short} ▶
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
