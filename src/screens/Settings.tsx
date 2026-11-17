import { useRef, useState } from 'preact/hooks';
import { addFlavor, patchFlavor, patchSettings, removeFlavor } from '../actions';
import { Stepper } from '../components/Stepper';
import { showToast } from '../components/toast';
import { exportJson, importJson, PLACEHOLDER_BAG_GRAMS, PLACEHOLDER_PROTEIN } from '../db/store';
import type { AppData, Flavor, ThemeId } from '../db/types';
import { blip } from '../fx/sound';

const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'neon', name: 'NEON', desc: 'magenta / cyan glow' },
  { id: 'acid', name: 'ACID', desc: 'hazard yellow / black' },
  { id: 'matrix', name: 'MATRIX', desc: 'green phosphor terminal' }
];

export function Settings(props: { data: AppData }) {
  const { flavors, settings, drinks, bags } = props.data;
  const [openFlavor, setOpenFlavor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = flavors.filter((f) => !f.archived);
  const archived = flavors.filter((f) => f.archived);

  function doExport() {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huel-up-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ text: 'Backup exported' });
  }

  async function doImport(file: File) {
    if (!confirm('Importing REPLACES all current data on this device. Continue?')) return;
    try {
      await importJson(await file.text());
      showToast({ text: 'Backup imported' });
    } catch (e) {
      showToast({ text: `Import failed: ${(e as Error).message}`, tone: 'warn' });
    }
  }

  return (
    <section class="screen">
      <h1 class="screen-title">SYS</h1>

      <div class="panel">
        <h2 class="panel-title">THEME</h2>
        <div class="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              data-theme-preview={t.id}
              class={`theme-card${settings.theme === t.id ? ' on' : ''}`}
              aria-pressed={settings.theme === t.id}
              onClick={() => {
                patchSettings({ theme: t.id });
                if (settings.sound) blip(t.id);
              }}
            >
              <span class="theme-name">{t.name}</span>
              <span class="theme-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">FLAVORS</h2>
        <p class="hint">Enter values from your bag's label. Protein is per 90 g serving.</p>
        <ul class="list">
          {active.map((f) => (
            <FlavorRow
              key={f.id}
              flavor={f}
              currency={settings.currency}
              open={openFlavor === f.id}
              toggle={() => setOpenFlavor(openFlavor === f.id ? null : f.id)}
              used={drinks.some((d) => d.portions.some((p) => p.flavorId === f.id)) || bags.some((b) => b.flavorId === f.id)}
            />
          ))}
        </ul>
        <button
          class="btn wide"
          onClick={() => {
            const name = prompt('Flavor name?')?.trim();
            if (!name) return;
            const ref = active[0];
            addFlavor({
              name,
              color: randomColor(),
              proteinPer90g: ref?.proteinPer90g ?? PLACEHOLDER_PROTEIN,
              bagGrams: ref?.bagGrams ?? PLACEHOLDER_BAG_GRAMS,
              defaultBagPrice: ref?.defaultBagPrice ?? 0,
              needsLabel: true
            });
          }}
        >
          + ADD FLAVOR
        </button>
        {archived.length > 0 && (
          <details class="archived">
            <summary>archived ({archived.length})</summary>
            {archived.map((f) => (
              <div key={f.id} class="row">
                <span class="swatch sm" style={{ background: f.color }} />
                <span class="grow">{f.name}</span>
                <button class="link" onClick={() => patchFlavor(f.id, { archived: false })}>
                  restore
                </button>
              </div>
            ))}
          </details>
        )}
      </div>

      <div class="panel">
        <h2 class="panel-title">TRACKING</h2>
        <div class="field row">
          <span class="grow">
            Low-stock warning at
            <small>only when no sealed bag of that flavor is left</small>
          </span>
          <Stepper
            value={settings.lowStockServings}
            min={0}
            max={30}
            onChange={(v) => patchSettings({ lowStockServings: v })}
            format={(v) => `${v} serv.`}
            label="Low stock threshold"
          />
        </div>
        <div class="field row">
          <span class="grow">
            Grams per scoop
            <small>used to estimate bag levels</small>
          </span>
          <Stepper value={settings.gramsPerScoop} min={10} max={100} onChange={(v) => patchSettings({ gramsPerScoop: v })} format={(v) => `${v} g`} label="Grams per scoop" />
        </div>
        <label class="field row">
          <span class="grow">Currency symbol</span>
          <input class="short" value={settings.currency} maxLength={4} onChange={(e) => patchSettings({ currency: e.currentTarget.value || '€' })} />
        </label>
        <label class="field row toggle">
          <span class="grow">
            Haptics<small>Android only — iOS doesn't allow web vibration</small>
          </span>
          <input type="checkbox" checked={settings.haptics} onChange={(e) => patchSettings({ haptics: e.currentTarget.checked })} />
        </label>
        <label class="field row toggle">
          <span class="grow">Sound</span>
          <input type="checkbox" checked={settings.sound} onChange={(e) => patchSettings({ sound: e.currentTarget.checked })} />
        </label>
      </div>

      <div class="panel">
        <h2 class="panel-title">DATA</h2>
        <p class="hint">
          Everything lives only in this browser on this device. Clearing site data or uninstalling deletes it — export a
          backup now and then.
        </p>
        <div class="modal-actions">
          <button class="btn" onClick={doExport}>
            EXPORT JSON
          </button>
          <button class="btn" onClick={() => fileRef.current?.click()}>
            IMPORT JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) void doImport(f);
              e.currentTarget.value = '';
            }}
          />
        </div>
        <p class="row-sub">
          {drinks.length} drinks · {bags.length} bags · {flavors.length} flavors · v{__APP_VERSION__}
        </p>
      </div>
    </section>
  );
}

function FlavorRow(props: { flavor: Flavor; currency: string; open: boolean; toggle: () => void; used: boolean }) {
  const f = props.flavor;
  const set = (patch: Partial<Flavor>) => patchFlavor(f.id, { ...patch, needsLabel: false });
  return (
    <li class={`panel flavor-row${props.open ? ' open' : ''}`}>
      <button class="row flavor-head" onClick={props.toggle} aria-expanded={props.open}>
        <span class="swatch" style={{ background: f.color }} />
        <span class="grow row-title">
          {f.name}
          {f.needsLabel && <span class="tag warn">VERIFY LABEL</span>}
        </span>
        <span class="row-sub">
          {f.proteinPer90g} g P · {f.bagGrams} g · {f.defaultBagPrice.toFixed(2)} {props.currency}
        </span>
      </button>
      {props.open && (
        <div class="flavor-form">
          <label class="field">
            <span>Name</span>
            <input value={f.name} onChange={(e) => patchFlavor(f.id, { name: e.currentTarget.value.trim() || f.name })} />
          </label>
          <div class="field-grid">
            <label class="field">
              <span>Color</span>
              <input type="color" value={f.color} onInput={(e) => patchFlavor(f.id, { color: e.currentTarget.value })} />
            </label>
            <label class="field">
              <span>Protein / 90 g</span>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={f.proteinPer90g} onChange={(e) => set({ proteinPer90g: Number(e.currentTarget.value) || 0 })} />
            </label>
            <label class="field">
              <span>Bag (g)</span>
              <input type="number" inputMode="numeric" min="1" value={f.bagGrams} onChange={(e) => set({ bagGrams: Number(e.currentTarget.value) || f.bagGrams })} />
            </label>
            <label class="field">
              <span>Price / bag ({props.currency})</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={f.defaultBagPrice} onChange={(e) => set({ defaultBagPrice: Number(e.currentTarget.value) || 0 })} />
            </label>
          </div>
          <p class="hint">Changes apply to new drinks and new bags; past entries keep their logged values.</p>
          <div class="modal-actions">
            {f.needsLabel && (
              <button class="btn small" onClick={() => set({})}>
                VALUES OK
              </button>
            )}
            <span class="grow" />
            <button
              class="btn small danger"
              onClick={() => {
                if (confirm(props.used ? `Archive ${f.name}? History stays.` : `Delete ${f.name}?`)) removeFlavor(f.id);
              }}
            >
              {props.used ? 'ARCHIVE' : 'DELETE'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  return hslToHex(h, 70, 60);
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}
