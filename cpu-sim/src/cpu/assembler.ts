import { MEMORY_SIZE, OPERAND_MASK, WORD_MASK, encode, opByMnemonic } from './isa.ts';

export type CellKind = 'code' | 'data' | 'empty';

/** How one source line was translated into one byte of memory. */
export interface ListingEntry {
  address: number;
  line: number;
  /** Source text of the line without its comment. */
  text: string;
  label: string | null;
  kind: 'code' | 'data';
  mnemonic: string;
  opcode: number | null;
  operandText: string | null;
  operandSource: 'label' | 'number' | 'none';
  operandValue: number;
  word: number;
}

export interface SymbolEntry {
  name: string;
  address: number;
  line: number;
}

export interface Program {
  source: string;
  memory: number[];
  kinds: CellKind[];
  /** Label defined at each address, if any. */
  labels: (string | null)[];
  listing: ListingEntry[];
  symbols: SymbolEntry[];
}

export interface AssemblyError {
  line: number;
  message: string;
}

export type AssemblyResult = { ok: true; program: Program } | { ok: false; errors: AssemblyError[] };

interface ParsedLine {
  line: number;
  text: string;
  label: string | null;
  mnemonic: string;
  operand: string | null;
}

const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parseNumber(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t.slice(2), 16);
  if (/^0b[01]+$/.test(t)) return parseInt(t.slice(2), 2);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return null;
}

/**
 * Two-pass assembler.
 * Syntax per line:  [label:] MNEMONIC [operand]  |  [label:] DAT value  |  [label:] value
 * Comments start with ';'. Operands may be decimal, 0x hex, 0b binary or a label.
 */
export function assemble(source: string): AssemblyResult {
  const errors: AssemblyError[] = [];
  const parsed: ParsedLine[] = [];
  const symbols: SymbolEntry[] = [];
  const labelAddr = new Map<string, number>();

  // Pass 1: give every instruction / data line an address and remember where each label points.
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const fullText = raw.replace(/;.*$/, '').trim();
    let text = fullText;
    if (!text) return;

    let label: string | null = null;
    const colon = text.indexOf(':');
    if (colon >= 0) {
      label = text.slice(0, colon).trim();
      text = text.slice(colon + 1).trim();
      if (!LABEL_RE.test(label)) {
        errors.push({ line, message: `Invalid label "${label}".` });
        label = null;
      } else if (labelAddr.has(label.toLowerCase())) {
        errors.push({ line, message: `Label "${label}" is defined twice.` });
      } else {
        labelAddr.set(label.toLowerCase(), parsed.length);
        symbols.push({ name: label, address: parsed.length, line });
      }
    }
    if (!text) {
      errors.push({ line, message: 'A label must be followed by an instruction or value on the same line.' });
      return;
    }
    const parts = text.split(/\s+/);
    if (parts.length > 2) {
      errors.push({ line, message: `Too many words: "${text}".` });
      return;
    }
    parsed.push({ line, text: fullText, label, mnemonic: parts[0], operand: parts[1] ?? null });
  });

  if (parsed.length > MEMORY_SIZE) {
    errors.push({
      line: parsed[MEMORY_SIZE].line,
      message: `Program needs ${parsed.length} memory cells but only ${MEMORY_SIZE} exist.`,
    });
  }

  const program: Program = {
    source,
    memory: new Array<number>(MEMORY_SIZE).fill(0),
    kinds: new Array<CellKind>(MEMORY_SIZE).fill('empty'),
    labels: new Array<string | null>(MEMORY_SIZE).fill(null),
    listing: [],
    symbols,
  };

  const resolve = (text: string, line: number): { value: number; from: 'label' | 'number' } | null => {
    const num = parseNumber(text);
    if (num !== null) return { value: num, from: 'number' };
    const addr = labelAddr.get(text.toLowerCase());
    if (addr === undefined) {
      errors.push({ line, message: `Unknown label or number "${text}".` });
      return null;
    }
    return { value: addr, from: 'label' };
  };

  // Pass 2: translate every line into one byte.
  parsed.slice(0, MEMORY_SIZE).forEach((p, addr) => {
    program.labels[addr] = p.label;
    const asNumber = parseNumber(p.mnemonic);
    const base = { address: addr, line: p.line, text: p.text, label: p.label };

    if (p.mnemonic.toUpperCase() === 'DAT' || asNumber !== null) {
      const valueText = asNumber !== null ? p.mnemonic : p.operand;
      if (asNumber !== null && p.operand !== null) {
        errors.push({ line: p.line, message: `Unexpected "${p.operand}" after a data value.` });
        return;
      }
      const resolved = valueText === null ? { value: 0, from: 'number' as const } : resolve(valueText, p.line);
      if (resolved === null) return;
      if (resolved.value > WORD_MASK) {
        errors.push({ line: p.line, message: `Value ${resolved.value} does not fit in 8 bits (0–255).` });
        return;
      }
      program.memory[addr] = resolved.value;
      program.kinds[addr] = 'data';
      program.listing.push({
        ...base,
        kind: 'data',
        mnemonic: 'DAT',
        opcode: null,
        operandText: valueText ?? '0',
        operandSource: resolved.from,
        operandValue: resolved.value,
        word: resolved.value,
      });
      return;
    }

    const op = opByMnemonic(p.mnemonic);
    if (!op) {
      errors.push({ line: p.line, message: `Unknown instruction "${p.mnemonic}".` });
      return;
    }
    let operand = 0;
    let operandSource: ListingEntry['operandSource'] = 'none';
    if (op.operand === 'none') {
      if (p.operand !== null) {
        errors.push({ line: p.line, message: `${op.mnemonic} does not take an operand.` });
        return;
      }
    } else {
      if (p.operand === null) {
        errors.push({ line: p.line, message: `${op.mnemonic} needs ${op.operand === 'address' ? 'an address' : 'a value'}.` });
        return;
      }
      const resolved = resolve(p.operand, p.line);
      if (resolved === null) return;
      if (resolved.value > OPERAND_MASK) {
        errors.push({ line: p.line, message: `Operand ${resolved.value} does not fit in 4 bits (0–15).` });
        return;
      }
      operand = resolved.value;
      operandSource = resolved.from;
    }
    const word = encode(op.code, operand);
    program.memory[addr] = word;
    program.kinds[addr] = 'code';
    program.listing.push({
      ...base,
      kind: 'code',
      mnemonic: op.mnemonic,
      opcode: op.code,
      operandText: p.operand,
      operandSource,
      operandValue: operand,
      word,
    });
  });

  if (errors.length) return { ok: false, errors: errors.sort((a, b) => a.line - b.line) };
  return { ok: true, program };
}
