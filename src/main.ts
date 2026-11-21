import './ui/styles.css';
import { GameApp } from './ui/GameApp';
import './ui/p7.css';
import './ui/p8.css';
import './ui/p9.css';
import './ui/p10.css';
import './ui/p11.css';
import './ui/p12.css';
import './ui/p13-settlement.css';
import './ui/p13.css';
import './ui/p14.css';
import './ui/p15.css';
import './ui/p16.css';
import './ui/p17.css';
import './ui/p18-garden-wood.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app mount point');
const app = new GameApp(root);

if (import.meta.env.DEV) {
  Object.defineProperty(window, '__CAPY_DEBUG__', {
    configurable: true,
    value: {
      get engine() { return app.engine; },
      get profile() { return app.profile; },
      start() { app.start(); },
    },
  });
}
