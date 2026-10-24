const ISAS = [
  {
    name: 'This tiny CPU',
    family: 'LMC-style, 8-bit, accumulator',
    code: ['LDA x        ; ACC ← x', 'ADD y        ; ACC ← ACC + y', 'STA sum      ; sum ← ACC'],
    note: 'One working register (ACC). Every instruction is one byte.',
  },
  {
    name: 'x86-64',
    family: 'Intel / AMD PCs and servers · CISC',
    code: ['mov eax, [x]     ; eax ← x', 'add eax, [y]     ; add from memory', 'mov [sum], eax   ; sum ← eax'],
    note: '16 general registers. Instructions are 1–15 bytes long. Arithmetic can read memory directly.',
  },
  {
    name: 'ARM64 (AArch64)',
    family: 'phones, Apple M-series, Raspberry Pi · RISC',
    code: ['ldr w8, [x0]     ; w8 ← x', 'ldr w9, [x1]     ; w9 ← y', 'add w8, w8, w9   ; registers only', 'str w8, [x2]     ; sum ← w8'],
    note: '31 general registers. Every instruction is 4 bytes. Only load/store touch memory.',
  },
  {
    name: 'RISC-V',
    family: 'open standard, microcontrollers → servers · RISC',
    code: ['lw  t0, 0(a0)    ; t0 ← x', 'lw  t1, 0(a1)    ; t1 ← y', 'add t0, t0, t1', 'sw  t0, 0(a2)    ; sum ← t0'],
    note: '32 registers. Fixed 4-byte instructions (2-byte compressed ones are optional).',
  },
];

const LMC_DIFF: [string, string, string][] = [
  ['Memory', '100 “mailboxes”, decimal', '16 cells, 8-bit binary'],
  ['Same in both', 'LDA · ADD · SUB · STA · OUT · HLT · DAT, labels', 'LDA · ADD · SUB · STA · OUT · HLT · DAT, labels'],
  ['Jumps', 'BRA (always) · BRZ (if zero) · BRP (if ≥ 0)', 'JMP (always) · JZ (if Z) · JC (if carry)'],
  ['Input / constants', 'INP reads a number from the user', 'LDI n loads a small constant'],
];

export function AssemblyExplainer() {
  return (
    <details className="asm-explainer" open>
      <summary>
        <span className="asm-badge">LMC</span>
        About the source text: what is assembly language, and why is it different on every machine?
      </summary>

      <div className="asm-body">
        <section className="asm-intro">
          <article>
            <h4>What is assembly language?</h4>
            <p>
              The CPU only understands <b>machine code</b>: raw numbers like <code>00100110</code>. Assembly language
              gives each of those numbers a short, readable name (a <b>mnemonic</b> such as <code>ADD</code>) plus its
              operand (<code>y</code>). One line of assembly is usually <b>one machine instruction</b>. An{' '}
              <b>assembler</b> translates it, exactly like the demo above does. Labels (<code>loop:</code>,{' '}
              <code>sum:</code>) are names for memory addresses so you don’t have to count cells yourself.
            </p>
          </article>
          <article>
            <h4>
              The language used here: <span className="nowrap">Little Man Computer (LMC)</span>
            </h4>
            <p>
              LMC is a teaching model of a computer created by Stuart Madnick at MIT in 1965. Its assembly language is
              deliberately tiny, so it is widely used to teach how CPUs work. This simulator uses an{' '}
              <b>LMC-style</b> dialect: the same mnemonics and label syntax, adapted to an 8-bit binary machine.
            </p>
            <table className="asm-table">
              <thead>
                <tr>
                  <th />
                  <th>Classic LMC</th>
                  <th>This simulator</th>
                </tr>
              </thead>
              <tbody>
                {LMC_DIFF.map(([what, lmc, ours]) => (
                  <tr key={what}>
                    <th scope="row">{what}</th>
                    <td>{lmc}</td>
                    <td>{ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <h4 className="asm-subhead">Same job, different processors: “sum = x + y”</h4>
        <div className="isa-compare">
          {ISAS.map((isa) => (
            <article key={isa.name} className="isa-card">
              <header>
                <b>{isa.name}</b>
                <span>{isa.family}</span>
              </header>
              <pre>{isa.code.join('\n')}</pre>
              <p>{isa.note}</p>
            </article>
          ))}
        </div>

        <h4 className="asm-subhead">Why is assembly different everywhere?</h4>
        <div className="asm-why">
          <article>
            <span className="asm-why-tag">1 · Processor architecture</span>
            <p>
              Every CPU family has its own <b>instruction set architecture (ISA)</b>: which instructions exist, how many
              registers there are, how instructions are encoded as bits. Assembly is a 1-to-1 mirror of machine code, so
              x86-64, ARM64 and RISC-V each have their own assembly language. A program assembled for one{' '}
              <b>will not run</b> on another. Above, x86-64 can <code>add</code> straight from memory (CISC style),
              while ARM and RISC-V must <code>load</code> into registers first (RISC style).
            </p>
          </article>
          <article>
            <span className="asm-why-tag">2 · Operating system</span>
            <p>
              On the <i>same</i> processor the instructions are identical, but the way a program talks to the OS is not.
              The OS decides the <b>system calls</b> (on Linux x86-64 you put <code>1</code> in <code>rax</code> and run{' '}
              <code>syscall</code> to write; on Windows you call <code>WriteFile</code> through a system library instead),
              the <b>calling convention</b> (Linux passes the first argument in <code>rdi</code>, Windows in{' '}
              <code>rcx</code>) and the <b>executable format</b> (ELF on Linux, PE on Windows, Mach-O on macOS).
            </p>
          </article>
          <article>
            <span className="asm-why-tag">3 · Assembler syntax</span>
            <p>
              Even for the same CPU and OS, different assemblers write things differently. x86 has <b>Intel syntax</b>{' '}
              (<code>mov eax, 5</code>, used by NASM and MASM) and <b>AT&amp;T syntax</b> (<code>movl $5, %eax</code>,
              the GNU assembler’s default) with the operands in opposite order. Directives such as{' '}
              <code>DAT</code> / <code>db</code> / <code>.word</code> differ too.
            </p>
          </article>
          <article>
            <span className="asm-why-tag">Why it matters</span>
            <p>
              This is why high-level languages exist. You write <code>sum = x + y</code> once in C or Rust, and a{' '}
              <b>compiler</b> produces the right assembly for each processor and OS. That is also why apps ship separate
              downloads for “Windows x64”, “macOS ARM” or “Linux x86-64”.
            </p>
          </article>
        </div>
      </div>
    </details>
  );
}
