import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { Toast } from './components/Toast';
import { useAppData } from './db/store';
import { lowStockFlavors } from './domain/stock';
import { Fuel } from './screens/Fuel';
import { Mix } from './screens/Mix';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';
import { Stock } from './screens/Stock';
import { click } from './fx/sound';

type Tab = 'fuel' | 'mix' | 'stock' | 'stats' | 'sys';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'fuel', label: 'FUEL', icon: '⚡' },
  { id: 'mix', label: 'MIX', icon: '⧉' },
  { id: 'stock', label: 'STOCK', icon: '▤' },
  { id: 'stats', label: 'STATS', icon: '▥' },
  { id: 'sys', label: 'SYS', icon: '⚙' }
];

const THEME_COLORS = { neon: '#0a0a12', acid: '#0b0b0b', matrix: '#020a04' } as const;

export function App() {
  const data = useAppData();
  const [tab, setTab] = useState<Tab>('fuel');
  const { theme } = data.settings;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const lowCount = lowStockFlavors(data.flavors, data.bags, data.drinks, data.settings.mix, data.settings.lowStockServings).length;

  return (
    <div class="app">
      <main class="content">
        {tab === 'fuel' && <Fuel data={data} goTo={setTab} />}
        {tab === 'mix' && <Mix data={data} />}
        {tab === 'stock' && <Stock data={data} />}
        {tab === 'stats' && <Stats data={data} />}
        {tab === 'sys' && <Settings data={data} />}
      </main>
      <Toast />
      <nav class="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              if (t.id !== tab && data.settings.sound) click();
              setTab(t.id);
            }}
          >
            <span class="tab-icon" aria-hidden="true">
              {t.icon}
              {t.id === 'stock' && lowCount > 0 && <span class="dot" />}
            </span>
            <span class="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
