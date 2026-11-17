import { setMix } from '../actions';
import { Stepper } from '../components/Stepper';
import type { AppData } from '../db/types';
import { mixTotalScoops } from '../domain/log';
import { stockByFlavor } from '../domain/stock';
import { num } from '../format';

export function Mix(props: { data: AppData }) {
  const { flavors, bags, drinks, settings } = props.data;
  const active = flavors.filter((f) => !f.archived);
  const stock = new Map(stockByFlavor(active, bags, drinks).map((s) => [s.flavor.id, s]));
  const scoops = (id: string) => settings.mix.find((m) => m.flavorId === id)?.scoops ?? 0;
  const total = mixTotalScoops(settings.mix);

  function set(id: string, v: number) {
    const rest = settings.mix.filter((m) => m.flavorId !== id);
    // keep flavor order stable (order of the flavor list)
    const next = [...rest, { flavorId: id, scoops: v }].sort(
      (a, b) => active.findIndex((f) => f.id === a.flavorId) - active.findIndex((f) => f.id === b.flavorId)
    );
    setMix(next);
  }

  function solo(id: string) {
    setMix([{ flavorId: id, scoops: Math.max(1, total || 2) }]);
  }

  return (
    <section class="screen">
      <h1 class="screen-title">MIX</h1>
      <p class="hint">Every tap on FUEL logs this mix until you change it.</p>

      <div class={`total-readout${total === 2 ? '' : ' off'}`}>
        <b>{num(total, total % 1 ? 1 : 0)}</b> scoops · <b>{num(total * settings.gramsPerScoop)}</b> g
        {total !== 2 && total > 0 && <span class="total-note">standard is 2 scoops — fine if intended</span>}
        {total === 0 && <span class="total-note">add at least one scoop</span>}
      </div>

      <ul class="list">
        {active.map((f) => {
          const s = stock.get(f.id)!;
          const v = scoops(f.id);
          return (
            <li key={f.id} class={`panel row mix-row${v > 0 ? ' on' : ''}`}>
              <span class="swatch" style={{ background: f.color }} />
              <div class="grow">
                <div class="row-title">{f.name}</div>
                <div class="row-sub">
                  {s.open.length ? `open ≈ ${num(s.openServings, 1)} serv.` : 'no open bag'} · {s.sealed.length} sealed
                </div>
              </div>
              <button class="chip" onClick={() => solo(f.id)} title="Use only this flavor">
                SOLO
              </button>
              <Stepper label={`${f.name} scoops`} value={v} max={6} step={0.5} onChange={(n) => set(f.id, n)} />
            </li>
          );
        })}
      </ul>
      {active.length === 0 && <p class="hint">No flavors yet — add some in SYS.</p>}
    </section>
  );
}
