import { useState } from 'react';

type Rule = 'add' | 'sub' | 'max';

const RULES: Record<Rule, { label: string; run: (a: number, b: number) => number }> = {
  add: { label: 'add them', run: (a, b) => a + b },
  sub: { label: 'subtract', run: (a, b) => a - b },
  max: { label: 'pick the larger', run: (a, b) => Math.max(a, b) },
};

const clampInput = (v: string): number => Math.max(0, Math.min(99, Math.trunc(Number(v) || 0)));

export function ComputeSlide() {
  const [a, setA] = useState(7);
  const [b, setB] = useState(5);
  const [rule, setRule] = useState<Rule>('add');
  const result = RULES[rule].run(a, b);

  return (
    <div className="slide-body compute-slide">
      <p className="slide-lead">
        <b>Computing</b> means taking some numbers, following a simple rule, and producing new numbers. Nothing more.
        A calculator, a game and a web browser all work this way. They just do <em>billions</em> of these tiny steps
        every second.
      </p>

      <div className="ipo" aria-label="Input, process, output">
        <div className="ipo-box">
          <span className="ipo-tag">input</span>
          <div className="ipo-inputs">
            <input type="number" min={0} max={99} value={a} onChange={(e) => setA(clampInput(e.target.value))} aria-label="First number" />
            <input type="number" min={0} max={99} value={b} onChange={(e) => setB(clampInput(e.target.value))} aria-label="Second number" />
          </div>
        </div>
        <span className="ipo-arrow">→</span>
        <div className="ipo-box rule">
          <span className="ipo-tag">rule (the program)</span>
          <select value={rule} onChange={(e) => setRule(e.target.value as Rule)} aria-label="Rule">
            {(Object.keys(RULES) as Rule[]).map((r) => (
              <option key={r} value={r}>
                {RULES[r].label}
              </option>
            ))}
          </select>
        </div>
        <span className="ipo-arrow">→</span>
        <div className="ipo-box out">
          <span className="ipo-tag">output</span>
          <span key={`${a}-${b}-${rule}`} className="ipo-result">
            {result}
          </span>
        </div>
      </div>
      <p className="hint center">Change the numbers or the rule. That's one computation.</p>

      <div className="ingredients">
        <article>
          <h4>🗄️ Memory</h4>
          <p>A row of numbered boxes. Each box holds one number. The inputs, the results <em>and the program itself</em> all live here.</p>
        </article>
        <article>
          <h4>⚙️ Processor (CPU)</h4>
          <p>Reads one instruction, does it, then moves on to the next one. It can only do very simple things like copy, add, subtract, compare and jump.</p>
        </article>
        <article>
          <h4>📜 Program</h4>
          <p>The list of instructions. Something has to translate it into numbers and put it into memory first. The next slides show how.</p>
        </article>
      </div>

      <div className="state-change">
        <div>
          <span className="ipo-tag">memory before</span>
          <code>
            x={a} · y={b} · result=<b>0</b>
          </code>
        </div>
        <span className="ipo-arrow">— program runs →</span>
        <div>
          <span className="ipo-tag">memory after</span>
          <code>
            x={a} · y={b} · result=<b className="changed-val">{result}</b>
          </code>
        </div>
      </div>
      <p className="hint center">
        The full contents of memory at any moment are called the <b>state</b>. Running a program means moving step by
        step from a starting state to a final state that contains the answer.
      </p>
    </div>
  );
}
