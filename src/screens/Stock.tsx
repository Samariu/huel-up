import { useState } from 'preact/hooks';
import { addBags, deleteBag, markEmpty, openBagNow, patchBag, setBagRemaining } from '../actions';
import { Modal } from '../components/Modal';
import { Stepper } from '../components/Stepper';
import { showToast } from '../components/toast';
import type { AppData, Bag, Flavor } from '../db/types';
import { SERVING_GRAMS } from '../db/types';
import { bagRemaining, usageByBag } from '../domain/bags';
import { stockByFlavor } from '../domain/stock';
import { daysBetween, money, num, shortDate } from '../format';

type Dialog =
  | { kind: 'add'; flavor: Flavor }
  | { kind: 'remaining'; bag: Bag; current: number }
  | { kind: 'empty'; bag: Bag; flavor: Flavor }
  | null;

export function Stock(props: { data: AppData }) {
  const { flavors, bags, drinks, settings } = props.data;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const usage = usageByBag(drinks);
  const stock = stockByFlavor(
    flavors.filter((f) => !f.archived || bags.some((b) => b.flavorId === f.id && b.status !== 'empty')),
    bags,
    drinks
  );
  const inMix = new Set(settings.mix.map((m) => m.flavorId));
  const close = () => setDialog(null);

  return (
    <section class="screen">
      <h1 class="screen-title">STOCK</h1>
      <p class="hint">
        Amounts are estimates ({settings.gramsPerScoop} g/scoop, other people's scoops aren't counted). Mark a bag empty
        when it really is — the next sealed bag opens automatically.
      </p>

      <ul class="list">
        {stock.map((s) => {
          const low = s.sealed.length === 0 && s.openServings <= settings.lowStockServings && (inMix.has(s.flavor.id) || s.open.length > 0);
          return (
            <li key={s.flavor.id} class={`panel stock-card${low ? ' low' : ''}`}>
              <header class="row">
                <span class="swatch" style={{ background: s.flavor.color }} />
                <div class="grow">
                  <div class="row-title">
                    {s.flavor.name}
                    {inMix.has(s.flavor.id) && <span class="tag">IN MIX</span>}
                    {low && <span class="tag warn">LOW</span>}
                  </div>
                  <div class="row-sub">
                    {s.sealed.length} sealed · {s.empty.length} finished
                  </div>
                </div>
                <button class="btn small" onClick={() => setDialog({ kind: 'add', flavor: s.flavor })}>
                  + BAG
                </button>
              </header>

              {s.open.map((b) => {
                const rem = bagRemaining(b, usage);
                const pct = Math.max(0, Math.min(100, (rem / b.gramsStart) * 100));
                const est0 = rem <= 0;
                return (
                  <div key={b.id} class="bag open-bag">
                    <div class="bag-line">
                      <span class="bag-state">OPEN</span>
                      <span class="grow">
                        {est0 ? (
                          <b class="warn-text">EST. EMPTY — powder left?</b>
                        ) : (
                          <>
                            ≈ <b>{num(rem / SERVING_GRAMS, 1)}</b> servings · {num(rem)} g
                          </>
                        )}
                      </span>
                      <span class="row-sub">since {b.openedAt ? shortDate(b.openedAt) : '?'}</span>
                    </div>
                    <div class="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <div class="bag-actions">
                      <button class="btn small" onClick={() => setDialog({ kind: 'remaining', bag: b, current: Math.max(0, Math.round(rem)) })}>
                        SET LEFT
                      </button>
                      <button class="btn small danger" onClick={() => setDialog({ kind: 'empty', bag: b, flavor: s.flavor })}>
                        MARK EMPTY
                      </button>
                    </div>
                  </div>
                );
              })}

              {s.open.length === 0 && s.sealed.length > 0 && (
                <div class="bag">
                  <span class="row-sub grow">No open bag.</span>
                  <button class="btn small" onClick={() => openBagNow(s.sealed[0].id)}>
                    OPEN ONE
                  </button>
                </div>
              )}

              {s.sealed.length > 0 && (
                <div class="sealed-row">
                  {s.sealed.map((b) => (
                    <span key={b.id} class="sealed-pill" title={`added ${shortDate(b.addedAt)} · ${money(b.price, settings.currency)}`}>
                      ▮ {shortDate(b.addedAt)}
                      <button class="pill-x" aria-label="Remove sealed bag" onClick={() => {
                        if (confirm(`Remove this sealed ${s.flavor.name} bag (added ${shortDate(b.addedAt)})?`)) deleteBag(b.id);
                      }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {s.empty.length > 0 && (
                <button class="link" onClick={() => setShowHistory(showHistory === s.flavor.id ? null : s.flavor.id)}>
                  {showHistory === s.flavor.id ? '▾' : '▸'} finished bags ({s.empty.length})
                </button>
              )}
              {showHistory === s.flavor.id && (
                <ul class="mini-list">
                  {s.empty.map((b) => (
                    <li key={b.id}>
                      <span>
                        {b.openedAt ? shortDate(b.openedAt) : '?'} → {b.finishedAt ? shortDate(b.finishedAt) : '?'}
                      </span>
                      <span class="row-sub">
                        {b.openedAt && b.finishedAt ? `${daysBetween(b.openedAt, b.finishedAt)} d` : ''} · {num(usage.get(b.id) ?? 0)} g logged
                      </span>
                      <button class="link" onClick={() => patchBag(b.id, { status: 'open', finishedAt: undefined })}>
                        reopen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {dialog?.kind === 'add' && <AddBags flavor={dialog.flavor} currency={settings.currency} onClose={close} />}
      {dialog?.kind === 'remaining' && <SetRemaining bag={dialog.bag} current={dialog.current} onClose={close} />}
      {dialog?.kind === 'empty' && (
        <Modal title={`${dialog.flavor.name}: bag empty?`} onClose={close}>
          <p>
            Marks this bag as finished today
            {bags.some((b) => b.flavorId === dialog.flavor.id && b.status === 'sealed')
              ? ' and opens the next sealed bag.'
              : '. No sealed bag left to open.'}
          </p>
          <div class="modal-actions">
            <button class="btn" onClick={close}>
              CANCEL
            </button>
            <button
              class="btn primary"
              onClick={() => {
                const opened = markEmpty(dialog.bag.id);
                showToast({ text: opened ? `Bag finished · new ${dialog.flavor.name} bag opened` : 'Bag finished' });
                close();
              }}
            >
              MARK EMPTY
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AddBags(props: { flavor: Flavor; currency: string; onClose: () => void }) {
  const { flavor } = props;
  const [count, setCount] = useState(1);
  const [price, setPrice] = useState(String(flavor.defaultBagPrice || ''));
  const [grams, setGrams] = useState(String(flavor.bagGrams));
  return (
    <Modal title={`Add ${flavor.name} bags`} onClose={props.onClose}>
      <label class="field">
        <span>Sealed bags</span>
        <Stepper value={count} min={1} max={20} onChange={setCount} label="Bag count" />
      </label>
      <label class="field">
        <span>Price per bag ({props.currency})</span>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={price} onInput={(e) => setPrice(e.currentTarget.value)} />
      </label>
      <label class="field">
        <span>Powder per bag (g)</span>
        <input type="number" inputMode="numeric" min="1" value={grams} onInput={(e) => setGrams(e.currentTarget.value)} />
      </label>
      {flavor.needsLabel && <p class="hint warn-text">Bag size is a placeholder — check the label and fix it in SYS.</p>}
      <div class="modal-actions">
        <button class="btn" onClick={props.onClose}>
          CANCEL
        </button>
        <button
          class="btn primary"
          onClick={() => {
            addBags(flavor.id, count, Number(price) || 0, Number(grams) || flavor.bagGrams);
            showToast({ text: `+${count} sealed ${flavor.name}` });
            props.onClose();
          }}
        >
          ADD
        </button>
      </div>
    </Modal>
  );
}

function SetRemaining(props: { bag: Bag; current: number; onClose: () => void }) {
  const [servings, setServings] = useState(Math.round((props.current / SERVING_GRAMS) * 2) / 2);
  return (
    <Modal title="How much is really left?" onClose={props.onClose}>
      <p class="hint">Eyeball it. One serving = {SERVING_GRAMS} g. The estimate continues from here.</p>
      <label class="field">
        <span>Servings left</span>
        <Stepper value={servings} step={0.5} max={60} onChange={setServings} label="Servings left" />
      </label>
      <div class="modal-actions">
        <button class="btn" onClick={props.onClose}>
          CANCEL
        </button>
        <button
          class="btn primary"
          onClick={() => {
            setBagRemaining(props.bag.id, servings * SERVING_GRAMS);
            props.onClose();
          }}
        >
          SAVE
        </button>
      </div>
    </Modal>
  );
}
