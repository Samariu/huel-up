import { dismissToast, useToast } from './toast';

export function Toast() {
  const t = useToast();
  if (!t) return null;
  return (
    <div key={t.id} class={`toast ${t.tone ?? 'ok'}`} role="status" aria-live="polite">
      <span class="toast-text">{t.text}</span>
      {t.action && (
        <button
          class="toast-action"
          onClick={() => {
            t.action!.run();
            dismissToast();
          }}
        >
          {t.action.label}
        </button>
      )}
      <span class="toast-timer" style={{ animationDuration: `${t.ms ?? 5000}ms` }} />
    </div>
  );
}
