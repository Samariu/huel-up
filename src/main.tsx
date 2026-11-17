import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import { loadData } from './db/store';
import './styles/base.css';
import './styles/themes.css';

registerSW({ immediate: true });

const root = document.getElementById('app')!;
loadData()
  .then((data) => {
    document.documentElement.dataset.theme = data.settings.theme;
    render(<App />, root);
  })
  .catch((e) => {
    root.innerHTML = `<p style="padding:24px;font-family:monospace;color:#f55">Storage unavailable: ${String(e)}.<br>Private browsing can block IndexedDB.</p>`;
  });
