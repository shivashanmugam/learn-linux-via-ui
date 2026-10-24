import { OPS, toBin } from '../cpu/isa.ts';

export function IsaReference() {
  return (
    <section className="panel isa" id="instruction-set">
      <h2>Instruction set</h2>
      <p>
        Every instruction is one byte: the upper 4 bits are the <span className="opcode">opcode</span> (what to do) and the
        lower 4 bits are the <span className="operand">operand</span> (a memory address <code>a</code> or a small number{' '}
        <code>n</code>). Opcodes 10–15 are unused and stop the CPU.
      </p>
      <table>
        <thead>
          <tr>
            <th>Opcode</th>
            <th>Mnemonic</th>
            <th>Effect</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {OPS.map((op) => (
            <tr key={op.code}>
              <td>
                <code className="opcode">{toBin(op.code, 4)}</code> <span className="dim">({op.code})</span>
              </td>
              <td>
                <code>
                  {op.mnemonic}
                  {op.operand === 'address' ? ' a' : op.operand === 'value' ? ' n' : ''}
                </code>
              </td>
              <td>
                <code>{op.rtl}</code>
              </td>
              <td>{op.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Concepts() {
  return (
    <details className="panel concepts">
      <summary>Quick recap: memory, registers and the fetch → decode → execute cycle</summary>
      <div className="concept-grid">
        <article>
          <h3>1 · Memory is just numbered boxes</h3>
          <p>
            Memory here has 16 cells (addresses 0–15), each holding one byte (0–255). The <em>program</em> and the{' '}
            <em>data</em> live side by side in the same memory — both are just numbers. Whether a byte is an instruction
            or a value depends only on how the CPU uses it.
          </p>
        </article>
        <article>
          <h3>2 · The processor has a few registers</h3>
          <p>
            <b>PC</b> remembers where the next instruction is. <b>IR</b> holds the instruction being executed.{' '}
            <b>MAR</b>/<b>MDR</b> talk to memory (address and data). <b>ACC</b> is the working number, the <b>ALU</b> does
            arithmetic, and the <b>flags</b> remember whether the last result was zero (Z) or overflowed (C).
          </p>
        </article>
        <article>
          <h3>3 · Fetch → Decode → Execute, forever</h3>
          <p>
            On every instruction the CPU <b>fetches</b> the byte at PC from memory, <b>decodes</b> it into an operation and
            an operand, then <b>executes</b> it as a few tiny register transfers. Each transfer happens on one tick of the
            clock — press <kbd>Step</kbd> to see them one at a time.
          </p>
        </article>
        <article>
          <h3>4 · A program transforms state</h3>
          <p>
            The program starts with memory in one state. Each instruction changes a little bit of state (a register, a flag,
            a memory cell). After the last instruction, memory and the output hold the <em>answer</em>. The trace panel lists
            exactly what changed at each step.
          </p>
        </article>
      </div>
    </details>
  );
}
