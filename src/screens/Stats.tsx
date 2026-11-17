import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { deleteDrink, drinkNow, editDrink } from '../actions';
import { BarChart } from '../components/BarChart';
import { Modal } from '../components/Modal';
import { Stepper } from '../components/Stepper';
import { showToast } from '../components/toast';
import type { AppData, Drink, MixEntry } from '../db/types';
import { usageByBag } from '../domain/bags';
import { dailySeries, filterRange, flavorShares, streaks, totals, type RangeId } from '../domain/stats';
import { daysBetween, kg, money, num, shortDate, time, toLocalInput } from '../format';

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'today', label: 'TODAY' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' }
];

export function Stats(props: { data: AppData }) {
  const { flavors, drinks, bags, settings } = props.data;
  const [range, setRange] = useState<RangeId>('7d');
  const [editing, setEditing] = useState<Drink | 'new' | null>(null);
  const [limit, setLimit] = useState(30);
  const now = Date.now();
  const inRange = filterRange(drinks, range, now);
  const t = totals(inRange);
  const shares = flavorShares(inRange);
  const shareTotal = shares.reduce((s, x) => s + x.grams, 0) || 1;
  const st = streaks(drinks, now);
  const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : drinks.length ? daysBetween(drinks[0].at, now) : 1;
  const series = dailySeries(drinks, 30, now);
  const name = (id: string) => flavors.find((f) => f.id === id)?.name ?? '?';
  const color = (id: string) => flavors.find((f) => f.id === id)?.color ?? '#888';

  // finished-bag lifetime
  const usage = usageByBag(drinks);
  const finished = bags.filter((b) => b.status === 'empty' && b.openedAt && b.finishedAt);
  const avgBagDays = finished.length
    ? finished.reduce((s, b) => s + daysBetween(b.openedAt!, b.finishedAt!), 0) / finished.length
    : null;
  const avgBagServ = finished.length ? finished.reduce((s, b) => s + (usage.get(b.id) ?? 0), 0) / finished.length / 90 : null;

  const history = [...drinks].reverse().slice(0, limit);
  let lastDay = '';

  return (
    <section class="screen">
      <h1 class="screen-title">STATS</h1>
      <div class="tabs" role="tablist">
        {RANGES.map((r) => (
          <button key={r.id} role="tab" aria-selected={range === r.id} class={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div class="tiles">
        <Tile label="drinks" value={num(t.drinks)} sub={range === 'today' ? '' : `${num(t.drinks / days, 1)}/day`} />
        <Tile label="fuel" value={kg(t.grams)} sub="powder" />
        <Tile label="protein" value={`${num(t.protein)} g`} sub={range === 'today' ? '' : `${num(t.protein / days)} g/day`} />
        <Tile label="spent" value={money(t.cost, settings.currency)} sub={t.drinks ? `${money(t.cost / t.drinks, settings.currency)}/drink` : ''} />
      </div>

      <div class="panel">
        <h2 class="panel-title">LAST 30 DAYS</h2>
        <BarChart data={series} />
      </div>

      <div class="tiles">
        <Tile label="streak" value={`${st.current} d`} sub="current" />
        <Tile label="best" value={`${st.longest} d`} sub="longest streak" />
        <Tile label="bag lasts" value={avgBagDays ? `${num(avgBagDays, 1)} d` : '—'} sub={avgBagServ ? `≈${num(avgBagServ, 1)} logged serv.` : 'no finished bags yet'} />
        <Tile label="all time" value={num(drinks.length)} sub={kg(totals(drinks).grams)} />
      </div>

      <div class="panel">
        <h2 class="panel-title">FLAVORS</h2>
        {shares.length === 0 && <p class="hint">No drinks in this range.</p>}
        {shares.map((s) => (
          <div key={s.flavorId} class="share">
            <div class="share-head">
              <span>
                <span class="swatch sm" style={{ background: color(s.flavorId) }} /> {name(s.flavorId)}
              </span>
              <span class="row-sub">
                {num(s.scoops, 1)} scoops · {num((s.grams / shareTotal) * 100)}%
              </span>
            </div>
            <div class="meter">
              <span style={{ width: `${(s.grams / shareTotal) * 100}%`, background: color(s.flavorId) }} />
            </div>
          </div>
        ))}
      </div>

      <div class="panel">
        <header class="row">
          <h2 class="panel-title grow">HISTORY</h2>
          <button class="btn small" onClick={() => setEditing('new')}>
            + PAST DRINK
          </button>
        </header>
        {history.length === 0 && <p class="hint">Nothing logged yet.</p>}
        <ul class="history">
          {history.map((d) => {
            const dk = shortDate(d.at);
            const header = dk !== lastDay ? ((lastDay = dk), <li class="history-day">{dk}</li>) : null;
            return (
              <Fragment key={d.id}>
                {header}
                <li>
                  <button class="history-row" onClick={() => setEditing(d)}>
                    <span class="history-time">{time(d.at)}</span>
                    <span class="grow">
                      {d.portions.map((p) => (
                        <span key={p.flavorId} class="mini-chip">
                          <span class="swatch sm" style={{ background: color(p.flavorId) }} />
                          {p.scoops}× {name(p.flavorId)}
                        </span>
                      ))}
                    </span>
                    <span class="row-sub">{num(d.portions.reduce((s, p) => s + p.protein, 0))} g P</span>
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
        {drinks.length > limit && (
          <button class="btn small wide" onClick={() => setLimit(limit + 50)}>
            LOAD MORE
          </button>
        )}
      </div>

      {editing && <DrinkEditor data={props.data} drink={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Tile(props: { label: string; value: string; sub?: string }) {
  return (
    <div class="tile panel">
      <span class="tile-label">{props.label}</span>
      <span class="tile-value">{props.value}</span>
      {props.sub && <span class="tile-sub">{props.sub}</span>}
    </div>
  );
}

function DrinkEditor(props: { data: AppData; drink: Drink | null; onClose: () => void }) {
  const { flavors, settings } = props.data;
  const d = props.drink;
  const [when, setWhen] = useState(toLocalInput(d?.at ?? Date.now()));
  const [mix, setMixState] = useState<MixEntry[]>(
    d ? d.portions.map((p) => ({ flavorId: p.flavorId, scoops: p.scoops })) : settings.mix
  );
  const visible = flavors.filter((f) => !f.archived || mix.some((m) => m.flavorId === f.id));
  const val = (id: string) => mix.find((m) => m.flavorId === id)?.scoops ?? 0;
  const set = (id: string, v: number) =>
    setMixState(
      [...mix.filter((m) => m.flavorId !== id), { flavorId: id, scoops: v }]
        .filter((m) => m.scoops > 0)
        .sort((a, b) => visible.findIndex((f) => f.id === a.flavorId) - visible.findIndex((f) => f.id === b.flavorId))
    );
  const at = new Date(when).getTime();
  const valid = !Number.isNaN(at) && mix.some((m) => m.scoops > 0);

  return (
    <Modal title={d ? 'Edit drink' : 'Add past drink'} onClose={props.onClose}>
      <label class="field">
        <span>When</span>
        <input type="datetime-local" value={when} max={toLocalInput(Date.now())} onInput={(e) => setWhen(e.currentTarget.value)} />
      </label>
      <div class="field">
        <span>Mix</span>
        {visible.map((f) => (
          <div key={f.id} class="row mix-mini">
            <span class="swatch sm" style={{ background: f.color }} />
            <span class="grow">{f.name}</span>
            <Stepper value={val(f.id)} max={6} step={0.5} onChange={(v) => set(f.id, v)} label={`${f.name} scoops`} />
          </div>
        ))}
      </div>
      {d && <p class="hint">Changing the mix re-assigns it to the currently open bags.</p>}
      <div class="modal-actions">
        {d && (
          <button
            class="btn danger"
            onClick={() => {
              if (confirm('Delete this drink?')) {
                deleteDrink(d.id);
                showToast({ text: 'Drink deleted' });
                props.onClose();
              }
            }}
          >
            DELETE
          </button>
        )}
        <span class="grow" />
        <button
          class="btn primary"
          disabled={!valid}
          onClick={() => {
            if (d) editDrink(d.id, at, mix);
            else drinkNow(at, mix);
            showToast({ text: d ? 'Drink updated' : 'Past drink added' });
            props.onClose();
          }}
        >
          SAVE
        </button>
      </div>
    </Modal>
  );
}
