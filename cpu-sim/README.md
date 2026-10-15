# Inside a tiny CPU

An interactive, in-browser explanation of how a processor runs a program: how instructions stored in memory are
fetched, decoded and executed, and how each instruction transforms the state of registers and memory until the
result of the computation appears on the output.

Built with **Vite 8**, **React 19** and **TypeScript 7**.

**Live site:** https://shivashanmugam.github.io/linux-as-ui/

## Pages

| Page | Path | Source |
| --- | --- | --- |
| Home (links to both parts) | `/` | `index.html` → `src/pages/HomePage.tsx` |
| Part 1 · The big picture | `/big-picture/` | `big-picture/index.html` → `src/pages/BigPicturePage.tsx` |
| Part 2 · Watch the processor run the program | `/processor/` | `processor/index.html` → `src/pages/ProcessorPage.tsx` |

The pages pass the selected program to each other in the URL (`?example=countdown` or `?src=<program text>`).
Part 1 also accepts `?slide=1..3`. Every page has a GitHub link in the header and a Buy me a coffee link in the footer
(see `src/site.ts` and `src/components/SiteLayout.tsx`).

## Run it

```bash
npm install
npm run dev      # dev server at http://localhost:5173/linux-as-ui/
npm run build    # type-check with tsc 7 and build all pages into dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Deploy

`.github/workflows/deploy.yml` (at the repository root) builds this folder and publishes `dist/` to GitHub Pages on
every push to `main`. The site is served from `/linux-as-ui/`, which is set as `base` in `vite.config.ts`. The repo's
**Settings → Pages → Source** must be set to **GitHub Actions**.

## What you can do

**Part 1 · The big picture** (slides)

1. **What is compute, basically?** An interactive input → rule → output example, the three ingredients (memory,
   processor, program), and the idea of a program moving memory from one *state* to the next.
2. **How does a program get into memory?** The journey from text → assembler → program file → loader → RAM → CPU.
3. **Demo: translating and loading.** An animated, step-by-step view of the assembler. Pass 1 assigns addresses and
   builds the label table. Pass 2 turns each source line into opcode and operand bits and writes the byte into its RAM
   cell. Finally the loader sets `PC = 0` and hands the program over to the CPU.

**Part 2 · Watch the processor run the program**

- **Step** one clock tick at a time and watch each register transfer (`MAR ← PC`, `MDR ← M[MAR]`, …) light up on the
  processor diagram, with a plain-English explanation of what happened and what comes next.
- **Step instruction**, **Run** (by tick or by instruction, adjustable speed) and **Back** (undo any step).
- See memory change: cells being read or written are highlighted, and every changed cell shows its original value.
- Follow the **state-change trace**: every completed instruction lists exactly what it changed.
- **Edit memory** directly (click a value while paused) or write your own program in the assembler editor.
- Load example programs: add, multiply (loop), countdown, larger-of-two (branching), Fibonacci (overflow detection).

## The machine

| Part | Description |
| --- | --- |
| Memory | 16 cells × 8 bits. Program and data share the same memory. |
| Registers | `PC`, `IR`, `MAR`, `MDR`, `ACC` (accumulator), flags `Z` (zero) and `C` (carry / borrow) |
| Instruction format | 1 byte: upper 4 bits opcode, lower 4 bits operand |

| Opcode | Mnemonic | Effect |
| --- | --- | --- |
| 0000 | `HLT` | stop |
| 0001 | `LDA a` | `ACC ← M[a]` |
| 0010 | `ADD a` | `ACC ← ACC + M[a]` (sets Z, C) |
| 0011 | `SUB a` | `ACC ← ACC − M[a]` (sets Z, C = borrow) |
| 0100 | `STA a` | `M[a] ← ACC` |
| 0101 | `LDI n` | `ACC ← n` (0–15) |
| 0110 | `JMP a` | `PC ← a` |
| 0111 | `JZ a` | if Z: `PC ← a` |
| 1000 | `JC a` | if C: `PC ← a` |
| 1001 | `OUT` | output `ACC` |

Assembler syntax: `label: OP operand`, `label: DAT value`, comments start with `;`. Numbers may be decimal, `0x` hex or
`0b` binary.

## Code layout

- `src/cpu/isa.ts` – instruction set, encoding/decoding helpers
- `src/cpu/cpu.ts` – the pure, micro-step CPU engine (`tick`, `stepInstruction`)
- `src/cpu/assembler.ts` – two-pass assembler (also produces the listing and label table used by the loader demo)
- `src/cpu/programs.ts` – example programs
- `src/hooks/useSimulator.ts` – simulation state, history (undo) and run loop
- `src/components/intro/` – intro slide deck: what is compute, program journey, assemble & load demo
- `src/pages/`, `src/entries/` – the three pages and their entry scripts
- `src/site.ts`, `src/components/SiteLayout.tsx` – links, URL helpers, shared header and footer
- `src/components/` – processor diagram, memory view, narration, controls, trace, editor, reference
