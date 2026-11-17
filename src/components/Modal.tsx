import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Modal(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [props.onClose]);
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="modal panel" role="dialog" aria-modal="true" aria-label={props.title}>
        <header class="modal-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" aria-label="Close" onClick={props.onClose}>
            ✕
          </button>
        </header>
        <div class="modal-body">{props.children}</div>
      </div>
    </div>
  );
}
