import { useEffect, useRef } from 'react';
import type { LogLine, Screen } from '../../boot/stages.ts';

export function Monitor({ screen, kernelLines }: { screen: Screen; kernelLines: LogLine[] }) {
  return (
    <div className={`monitor screen-${screen}`}>
      <div className="monitor-glass" key={screen}>
        {screen === 'off' && <span className="monitor-off">screen off</span>}
        {screen === 'black' && <span className="monitor-off">powered, nothing drawn yet</span>}
        {screen === 'logo' && (
          <div className="mon-logo">
            <div className="mon-brand">◆ ACME</div>
            <div className="mon-hint">Press F2 to enter Setup · F12 for Boot Menu</div>
          </div>
        )}
        {screen === 'grub' && (
          <div className="mon-grub">
            <div className="grub-title">GNU GRUB version 2.12</div>
            <div className="grub-box">
              <div className="sel">*Ubuntu</div>
              <div>&nbsp;Advanced options for Ubuntu</div>
              <div>&nbsp;UEFI Firmware Settings</div>
            </div>
            <div className="grub-foot">The highlighted entry will be executed automatically in 3s.</div>
          </div>
        )}
        {screen === 'kernel' && (
          <div className="mon-kernel">
            {kernelLines.slice(-11).map((l, i) => (
              <div key={i} className={`klog ${l.src}`}>
                {l.src === 'systemd' ? `[  OK  ] ${l.text}` : l.text}
              </div>
            ))}
            <div className="cursor">_</div>
          </div>
        )}
        {screen === 'login' && (
          <div className="mon-login">
            <div className="mon-clock">09:41</div>
            <div className="avatar">S</div>
            <div className="login-name">Siva</div>
            <div className="login-field">Password ▏</div>
          </div>
        )}
        {screen === 'desktop' && (
          <div className="mon-desktop">
            <div className="topbar">
              <span>Activities</span>
              <span>Thu 09:42</span>
              <span>🔊 🔋</span>
            </div>
            <div className="win term">
              <div className="win-bar">Terminal</div>
              <div className="win-body">
                siva@mypc:~$ uptime
                <br />
                09:42 up 1 min, 1 user
                <br />
                siva@mypc:~$ ▏
              </div>
            </div>
            <div className="win editor">
              <div className="win-bar">notes.txt — Text Editor</div>
              <div className="win-body">Hello, live computer!▏</div>
            </div>
          </div>
        )}
      </div>
      <div className="monitor-stand" />
      {screen === 'kernel' && (
        <p className="hint center">
          Normally hidden behind a splash screen by the <code>quiet splash</code> options; press Esc during boot to see these
          messages.
        </p>
      )}
    </div>
  );
}

const SRC_LABEL: Record<LogLine['src'], string> = {
  firmware: 'firmware',
  shim: 'shim',
  grub: 'grub',
  kernel: 'kernel',
  systemd: 'systemd',
};

export function BootLog({ lines, freshFrom }: { lines: LogLine[]; freshFrom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div className="boot-log" ref={ref}>
      {lines.length === 0 && <p className="placeholder">Nothing has run yet. Messages from each stage appear here.</p>}
      {lines.map((l, i) => (
        <div key={i} className={`boot-line src-${l.src}${i >= freshFrom ? ' fresh' : ''}`}>
          <span className="boot-src">{SRC_LABEL[l.src]}</span>
          <span className="boot-text">{l.text}</span>
        </div>
      ))}
    </div>
  );
}
