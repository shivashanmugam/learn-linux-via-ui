const STAGES = [
  {
    icon: '✍️',
    title: '1 · You write it',
    body: 'A programmer writes instructions as text that people can read.',
    sample: 'ADD y',
  },
  {
    icon: '🔤',
    title: '2 · Translate',
    body: 'An assembler (or a compiler, for languages like C) turns each instruction into a number the CPU understands: machine code.',
    sample: '0010 0110',
  },
  {
    icon: '💾',
    title: '3 · Save as a file',
    body: 'The machine code is saved as a program file on disk, like an .exe or an app. It just sits there until you start it.',
    sample: 'program.bin',
  },
  {
    icon: '📥',
    title: '4 · Load into RAM',
    body: 'When you start the program, the loader (part of the operating system) copies those bytes from disk into RAM, one byte per memory cell.',
    sample: 'RAM[1] = 38',
  },
  {
    icon: '▶️',
    title: '5 · CPU starts',
    body: 'The program counter (PC) is pointed at the first instruction. From then on the CPU fetches, decodes and executes on its own.',
    sample: 'PC = 0',
  },
];

export function JourneySlide() {
  return (
    <div className="slide-body">
      <p className="slide-lead">
        The CPU can only read instructions from <b>memory (RAM)</b>, and only as <b>numbers</b>. It cannot read text and it
        does not fetch from the disk. So before a program can run, two things must happen: the text is
        <b> translated</b> into numbers, and those numbers are <b>copied into RAM</b>.
      </p>
      <ol className="journey">
        {STAGES.map((s, i) => (
          <li key={s.title} style={{ animationDelay: `${i * 0.12}s` }}>
            <span className="journey-icon" aria-hidden>
              {s.icon}
            </span>
            <h4>{s.title}</h4>
            <p>{s.body}</p>
            <code>{s.sample}</code>
          </li>
        ))}
      </ol>
      <div className="callout">
        <b>In this simulator</b> the <kbd>Assemble &amp; load into memory</kbd> button does steps 2–4 instantly. There is no
        disk, so the bytes go straight into RAM. The next slide slows it down so you can watch every line get translated
        and copied into its memory cell.
      </div>
    </div>
  );
}
