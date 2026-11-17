import { useState } from 'preact/hooks';
import { deleteDrink, drinkNow } from '../actions';
import { showToast } from '../components/toast';
import type { AppData } from '../db/types';
import { mixTotalScoops } from '../domain/log';
import { lowStockFlavors } from '../domain/stock';
import { filterRange, streaks } from '../domain/stats';
import { buzz } from '../fx/haptics';
import { blip } from '../fx/sound';
import { ago, mixLabel, num } from '../format';

export function Fuel(props: { data: AppData; goTo: (tab: 'mix' | 'stock') => void }) {
  const { flavors, drinks, bags, settings } = props.data;
  const [glitch, setGlitch] = useState(0);
  const now = Date.now();
  const today = filterRange(drinks, 'today', now);
  const streak = streaks(drinks, now).current;
  const last = drinks[drinks.length - 1];
  const low = lowStockFlavors(flavors, bags, drinks, settings.mix, settings.lowStockServings);
  const mixOk = mixTotalScoops(settings.mix) > 0 && settings.mix.some((m) => flavors.some((f) => f.id === m.flavorId));
  const theme = settings.theme;

  function fuel() {
    if (!mixOk) {
      props.goTo('mix');
      return;
    }
    const r = drinkNow();
    if (!r) return;
    setGlitch((n) => n + 1);
    if (settings.haptics) buzz();
    if (settings.sound) blip(theme);
    const protein = r.drink.portions.reduce((s, p) => s + p.protein, 0);
    const grams = r.drink.portions.reduce((s, p) => s + p.grams, 0);
    const extra = [
      r.opened.length ? `opened new ${r.opened.map((b) => flavors.find((f) => f.id === b.flavorId)?.name).join(', ')} bag` : '',
      r.missing.length ? `no bag for ${r.missing.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join(' · ');
    showToast({
      text: `+1 LOGGED · ${grams} g · ${num(protein)} g protein${extra ? ` · ${extra}` : ''}`,
      tone: r.missing.length ? 'warn' : 'ok',
      action: { label: 'UNDO', run: () => deleteDrink(r.drink.id, r.opened.map((b) => b.id)) },
      ms: 6000
    });
  }

  return (
    <section class="screen fuel">
      <header class="fuel-head">
        <h1 class="logo" data-text="HUEL//UP">
          HUEL//UP
        </h1>
        <div class="fuel-meta">
          <span class="readout">
            <b>{String(today.length).padStart(2, '0')}</b> today
          </span>
          <span class="readout">
            <b>{streak}</b> day streak
          </span>
        </div>
      </header>

      {low.length > 0 && (
        <button class="banner warn" onClick={() => props.goTo('stock')}>
          <span class="banner-icon">!</span>
          <span>
            LOW STOCK: {low.map((s) => `${s.flavor.name} (${s.open.length ? `≈${num(s.openServings, 1)} serv.` : 'none left'})`).join(', ')} — no sealed bags in the cupboard
          </span>
        </button>
      )}

      <div class="fuel-center">
        <div class={`fuel-wrap${glitch ? ' glitching' : ''}`} key={glitch}>
          <button class="fuel-btn" onClick={fuel} aria-label="Log one drink">
            <span class="fuel-inner">
              <span class="fuel-label" data-text={theme === 'matrix' ? '> fuel_up' : 'FUEL UP'}>
                {theme === 'matrix' ? '> fuel_up' : 'FUEL UP'}
              </span>
              <span class="fuel-sub">{mixOk ? 'tap when you drank one' : 'set a mix first'}</span>
            </span>
          </button>
        </div>
      </div>

      <button class="mix-line" onClick={() => props.goTo('mix')}>
        <span class="mix-tag">MIX</span>
        <span class="mix-val">{mixOk ? mixLabel(settings.mix, flavors) : '— none —'}</span>
        <span class="mix-edit">EDIT ›</span>
      </button>
      <p class="last-line">{last ? `last fuel ${ago(last.at, now)}` : 'no fuel logged yet'}</p>
    </section>
  );
}
