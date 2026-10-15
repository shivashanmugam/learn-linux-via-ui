import { useCallback, useEffect, useReducer } from 'react';
import { createCpu, stepInstruction, tick, type CpuState } from '../cpu/cpu.ts';
import type { Program } from '../cpu/assembler.ts';
import { WORD_MASK } from '../cpu/isa.ts';

export type RunMode = 'micro' | 'instruction';

const HISTORY_LIMIT = 3000;

interface SimState {
  cpu: CpuState;
  history: CpuState[];
  program: Program;
  initialMemory: number[];
  running: boolean;
}

type Action =
  | { type: 'tick' }
  | { type: 'instruction' }
  | { type: 'back' }
  | { type: 'reset' }
  | { type: 'load'; program: Program }
  | { type: 'poke'; address: number; value: number }
  | { type: 'running'; running: boolean };

function advance(state: SimState, next: CpuState): SimState {
  if (next === state.cpu) return { ...state, running: false };
  const history = [...state.history, state.cpu];
  if (history.length > HISTORY_LIMIT) history.shift();
  return { ...state, cpu: next, history, running: state.running && !next.halted };
}

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'tick':
      return advance(state, tick(state.cpu));
    case 'instruction':
      return advance(state, stepInstruction(state.cpu));
    case 'back': {
      const prev = state.history.at(-1);
      if (!prev) return state;
      return { ...state, cpu: prev, history: state.history.slice(0, -1), running: false };
    }
    case 'reset':
      return { ...state, cpu: createCpu(state.initialMemory), history: [], running: false };
    case 'load':
      return {
        cpu: createCpu(action.program.memory),
        history: [],
        program: action.program,
        initialMemory: action.program.memory,
        running: false,
      };
    case 'poke': {
      const value = Math.max(0, Math.min(WORD_MASK, Math.trunc(action.value)));
      const memory = state.cpu.memory.slice();
      memory[action.address] = value;
      const atStart = state.cpu.ticks === 0;
      return {
        ...state,
        cpu: { ...state.cpu, memory },
        history: atStart ? state.history : [...state.history, state.cpu],
        initialMemory: atStart ? memory : state.initialMemory,
      };
    }
    case 'running':
      return { ...state, running: action.running && !state.cpu.halted };
  }
}

export function useSimulator(initial: Program, mode: RunMode, delayMs: number) {
  const [state, dispatch] = useReducer(reducer, initial, (program) => ({
    cpu: createCpu(program.memory),
    history: [],
    program,
    initialMemory: program.memory,
    running: false,
  }));

  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => dispatch({ type: mode === 'micro' ? 'tick' : 'instruction' }), delayMs);
    return () => window.clearInterval(id);
  }, [state.running, mode, delayMs]);

  return {
    ...state,
    canGoBack: state.history.length > 0,
    tick: useCallback(() => dispatch({ type: 'tick' }), []),
    stepInstruction: useCallback(() => dispatch({ type: 'instruction' }), []),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    reset: useCallback(() => dispatch({ type: 'reset' }), []),
    load: useCallback((program: Program) => dispatch({ type: 'load', program }), []),
    poke: useCallback((address: number, value: number) => dispatch({ type: 'poke', address, value }), []),
    setRunning: useCallback((running: boolean) => dispatch({ type: 'running', running }), []),
  };
}
