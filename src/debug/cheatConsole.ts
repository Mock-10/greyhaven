// The cheat console's one-line text box (docs/14 cheat console; on the Pages build behind Ctrl + Shift + F1,
// decided 2026-10-11). A plain DOM input over the canvas: it's a developer and playtest tool, not game UI.

export class CheatConsole {
  private box: HTMLInputElement | null = null;

  constructor(
    private readonly run: (line: string) => void,
    private readonly onOpenChange: (open: boolean) => void,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (this.box) this.close();
        else this.open();
      }
    });
  }

  get isOpen(): boolean {
    return this.box !== null;
  }

  open(): void {
    if (this.box) return;
    const box = document.createElement('input');
    box.type = 'text';
    box.spellcheck = false;
    box.placeholder = 'CHEAT: HELP · ENTER RUNS · ESC CLOSES';
    Object.assign(box.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      width: 'min(520px, calc(100vw - 24px))',
      padding: '6px 8px',
      font: '14px monospace',
      color: '#e8e0d0',
      background: 'rgba(45, 34, 46, 0.92)',
      border: '1px solid #8a82a8',
      outline: 'none',
      zIndex: '10',
    } satisfies Partial<CSSStyleDeclaration>);
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.close();
      else if (e.key === 'Enter') {
        const line = box.value;
        box.value = '';
        if (line.trim()) this.run(line);
      }
    });
    box.addEventListener('keyup', (e) => e.stopPropagation());
    document.body.appendChild(box);
    box.focus();
    this.box = box;
    this.onOpenChange(true);
  }

  close(): void {
    this.box?.remove();
    this.box = null;
    this.onOpenChange(false);
  }
}
