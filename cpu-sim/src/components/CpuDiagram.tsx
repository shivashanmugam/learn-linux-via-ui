import type { ReactNode } from 'react';
import type { CpuState, Edge, Unit } from '../cpu/cpu.ts';
import { decode, disassemble, toBin } from '../cpu/isa.ts';

const EDGE_PATHS: Record<Edge, string> = {
  'pc-mar': 'M160 60 H240',
  'pc-inc': 'M60 30 C60 4, 120 4, 120 30',
  'mar-ram': 'M380 60 H596',
  'ram-mdr': 'M596 160 H380',
  'mdr-ram': 'M380 178 H596',
  'mdr-ir': 'M240 170 H160',
  'ir-dec': 'M90 200 V250',
  'ir-mar': 'M160 152 H200 V80 H240',
  'ir-pc': 'M45 140 V90',
  'ir-acc': 'M160 188 H195 V412 H240',
  'mdr-alu': 'M345 200 V250',
  'acc-alu': 'M240 382 H220 V230 H275 V250',
  'alu-acc': 'M310 320 V370',
  'alu-flags': 'M368 285 H393',
  'acc-mdr': 'M380 388 H470 V192 H380',
  'acc-out': 'M310 430 V452 H545 V430',
};

const EDGES = Object.keys(EDGE_PATHS) as Edge[];

interface BoxProps {
  unit: Unit;
  x: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  subtitle: string;
  active: Set<Unit>;
  children: ReactNode;
}

function Box({ unit, x, y, w = 140, h = 60, title, subtitle, active, children }: BoxProps) {
  return (
    <g className={`unit unit-${unit}${active.has(unit) ? ' active' : ''}`}>
      <title>{subtitle}</title>
      <rect x={x} y={y} width={w} height={h} rx={8} />
      <text x={x + 10} y={y + 17} className="unit-title">
        {title}
      </text>
      {children}
    </g>
  );
}

function RegValue({ x, y, value, bits = 8 }: { x: number; y: number; value: number; bits?: number }) {
  return (
    <g key={value} className="reg-value">
      <text x={x + 10} y={y + 47} className="unit-value">
        {value}
      </text>
      <text x={x + 130} y={y + 47} className="unit-bin" textAnchor="end">
        {toBin(value, bits)}
      </text>
    </g>
  );
}

interface DiagramProps {
  cpu: CpuState;
  /** When set, clicking a part of the diagram reports which unit was clicked. */
  onUnitClick?: (unit: Unit) => void;
  className?: string;
}

const UNIT_CLASS = /^unit-(pc|ir|decoder|flags|mar|mdr|acc|alu|out|ram)$/;

export function CpuDiagram({ cpu, onUnitClick, className }: DiagramProps) {
  const ev = cpu.lastEvent;
  const active = new Set<Unit>(ev?.units ?? []);
  const activeEdges = new Set<Edge>(ev?.edges ?? []);
  const irBits = toBin(cpu.ir);
  const decoded = decode(cpu.ir);
  const alu = ev?.alu;
  const aluText = alu
    ? alu.op === 'PASS'
      ? `pass B = ${alu.result}`
      : `${alu.a} ${alu.op === 'ADD' ? '+' : '−'} ${alu.b} = ${alu.result}`
    : 'idle';
  const lastOut = cpu.output.at(-1);
  const phase = cpu.halted ? 'halted' : (ev?.phase ?? 'ready');

  return (
    <svg
      className={`cpu-diagram${onUnitClick ? ' clickable' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 640 470"
      role="img"
      aria-label="Diagram of the processor"
      onClick={
        onUnitClick &&
        ((e) => {
          const group = (e.target as Element).closest('.unit');
          const match = group && [...group.classList].map((c) => UNIT_CLASS.exec(c)).find(Boolean);
          if (match) onUnitClick(match[1] as Unit);
        })
      }
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head active" />
        </marker>
      </defs>

      <rect x={8} y={20} width={170} height={430} rx={12} className="cu-frame" />
      <text x={93} y={464} className="frame-label" textAnchor="middle">
        CONTROL UNIT
      </text>

      {EDGES.filter((e) => !activeEdges.has(e)).map((e) => (
        <path key={e} d={EDGE_PATHS[e]} className="edge" markerEnd="url(#arrow)" />
      ))}
      {EDGES.filter((e) => activeEdges.has(e)).map((e) => (
        <path key={`${e}-${cpu.ticks}`} d={EDGE_PATHS[e]} className="edge active" markerEnd="url(#arrow-active)" />
      ))}
      <text x={90} y={12} className="edge-label" textAnchor="middle">
        +1
      </text>
      <text x={488} y={52} className="edge-label" textAnchor="middle">
        address bus
      </text>
      <text x={488} y={152} className="edge-label" textAnchor="middle">
        data bus
      </text>

      <g className={`unit unit-ram${active.has('ram') ? ' active' : ''}`}>
        <rect x={596} y={20} width={36} height={200} rx={8} />
        <text x={614} y={120} className="ram-label" textAnchor="middle" transform="rotate(90 614 120)">
          MEMORY (RAM) →
        </text>
      </g>

      <Box unit="pc" x={20} y={30} title="PC" subtitle="Program Counter: address of the next instruction" active={active}>
        <RegValue x={20} y={30} value={cpu.pc} bits={4} />
      </Box>
      <Box unit="mar" x={240} y={30} title="MAR" subtitle="Memory Address Register: which memory cell to access" active={active}>
        <RegValue x={240} y={30} value={cpu.mar} bits={4} />
      </Box>
      <Box unit="ir" x={20} y={140} title="IR" subtitle="Instruction Register: the instruction being executed" active={active}>
        <g key={cpu.ir} className="reg-value">
          <text x={30} y={187} className="unit-bin big">
            <tspan className="opcode">{irBits.slice(0, 4)}</tspan>
            <tspan className="operand" dx={4}>
              {irBits.slice(4)}
            </tspan>
          </text>
          <text x={150} y={157} className="unit-sub" textAnchor="end">
            {decoded.op ? disassemble(cpu.ir) : '???'}
          </text>
        </g>
      </Box>
      <Box unit="mdr" x={240} y={140} title="MDR" subtitle="Memory Data Register: data travelling to or from memory" active={active}>
        <RegValue x={240} y={140} value={cpu.mdr} />
      </Box>
      <Box unit="decoder" x={20} y={250} h={70} title="DECODER" subtitle="Turns the opcode into control signals" active={active}>
        <text x={30} y={286} className="unit-sub">
          phase: <tspan className={`phase-text ${phase}`}>{phase}</tspan>
        </text>
        <text x={30} y={308} className="unit-sub">
          op: {cpu.step > 4 || (cpu.step === 0 && cpu.ticks > 0) ? (decoded.op?.name ?? 'unknown') : '—'}
        </text>
      </Box>
      <Box unit="acc" x={240} y={370} title="ACC" subtitle="Accumulator: the CPU's working register" active={active}>
        <RegValue x={240} y={370} value={cpu.acc} />
      </Box>
      <Box unit="out" x={490} y={370} w={110} title="OUTPUT" subtitle="Output device" active={active}>
        <text key={cpu.output.length} x={545} y={417} className="unit-value reg-value" textAnchor="middle">
          {lastOut ?? '—'}
        </text>
      </Box>

      <g className={`unit unit-alu${active.has('alu') ? ' active' : ''}`}>
        <title>Arithmetic Logic Unit: does the actual computation</title>
        <polygon points="240,250 380,250 355,320 265,320" />
        <text x={275} y={265} className="port-label" textAnchor="middle">
          A
        </text>
        <text x={345} y={265} className="port-label" textAnchor="middle">
          B
        </text>
        <text x={310} y={282} className="unit-title" textAnchor="middle">
          ALU
        </text>
        <text key={cpu.ticks} x={310} y={305} className={`unit-sub${alu ? ' reg-value' : ''}`} textAnchor="middle">
          {aluText}
        </text>
      </g>

      <g className={`unit unit-flags${active.has('flags') ? ' active' : ''}`}>
        <title>Flags: Z = last result was zero, C = carry / borrow</title>
        <rect x={393} y={260} width={62} height={50} rx={8} />
        <circle cx={410} cy={278} r={6} className={`led${cpu.z ? ' on' : ''}`} />
        <text x={422} y={282} className="unit-sub">
          Z={cpu.z ? 1 : 0}
        </text>
        <circle cx={410} cy={298} r={6} className={`led${cpu.c ? ' on' : ''}`} />
        <text x={422} y={302} className="unit-sub">
          C={cpu.c ? 1 : 0}
        </text>
      </g>
    </svg>
  );
}
