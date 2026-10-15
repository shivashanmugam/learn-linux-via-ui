import { useState, type KeyboardEvent } from 'react';
import type { CpuState } from '../cpu/cpu.ts';
import type { Program } from '../cpu/assembler.ts';
import { decode, disassemble, toBin } from '../cpu/isa.ts';

interface Props {
  cpu: CpuState;
  program: Program;
  initialMemory: number[];
  editable: boolean;
  onPoke: (address: number, value: number) => void;
}

function EditableValue({ value, editable, onCommit }: { value: number; editable: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        className="cell-value"
        disabled={!editable}
        title={editable ? 'Click to change this memory cell' : 'Pause to edit memory'}
        onClick={() => setDraft(String(value))}
      >
        {value}
      </button>
    );
  }

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 255 && n !== value) onCommit(n);
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setDraft(null);
  };

  return (
    <input
      className="cell-input"
      type="number"
      min={0}
      max={255}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      aria-label="New value (0-255)"
    />
  );
}

export function MemoryView({ cpu, program, initialMemory, editable, onPoke }: Props) {
  const ev = cpu.lastEvent;
  return (
    <div className="memory">
      <table>
        <thead>
          <tr>
            <th aria-label="Pointers" />
            <th>Addr</th>
            <th>Label</th>
            <th title="Upper 4 bits = opcode, lower 4 bits = operand">Bits</th>
            <th>Value</th>
            <th title="How the CPU would read this byte if it fetched it as an instruction">As instruction</th>
          </tr>
        </thead>
        <tbody>
          {cpu.memory.map((value, addr) => {
            const bits = toBin(value);
            const kind = program.kinds[addr];
            const changed = value !== initialMemory[addr];
            const read = ev?.memRead === addr;
            const written = ev?.memWrite === addr;
            const isPc = cpu.pc === addr && !cpu.halted;
            const classes = [
              `kind-${kind}`,
              isPc ? 'is-pc' : '',
              cpu.mar === addr && cpu.ticks > 0 ? 'is-mar' : '',
              read ? 'read' : '',
              written ? 'written' : '',
              changed ? 'changed' : '',
            ].join(' ');
            return (
              <tr key={`${addr}-${written ? cpu.ticks : 0}`} className={classes}>
                <td className="pointers">
                  {isPc && <span className="ptr ptr-pc">PC▸</span>}
                  {cpu.mar === addr && cpu.ticks > 0 && <span className="ptr ptr-mar">MAR</span>}
                </td>
                <td className="addr">
                  {addr}
                  <span className="addr-bin">{toBin(addr, 4)}</span>
                </td>
                <td className="label">{program.labels[addr] ?? ''}</td>
                <td className="bits">
                  <span className={kind === 'data' ? 'data-bits' : 'opcode'}>{bits.slice(0, 4)}</span>
                  <span className={kind === 'data' ? 'data-bits' : 'operand'}>{bits.slice(4)}</span>
                </td>
                <td className="value">
                  <EditableValue value={value} editable={editable} onCommit={(v) => onPoke(addr, v)} />
                  {changed && <span className="was">was {initialMemory[addr]}</span>}
                </td>
                <td className={`asm${kind === 'code' ? '' : ' dim'}`}>
                  {decode(value).op ? disassemble(value) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="legend">
        <span>
          <i className="sw code" /> code
        </span>
        <span>
          <i className="sw data" /> data
        </span>
        <span>
          <i className="sw read" /> being read
        </span>
        <span>
          <i className="sw written" /> just written
        </span>
        <span>
          <i className="sw changed" /> changed since start
        </span>
      </div>
    </div>
  );
}
