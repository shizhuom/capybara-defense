import './ui/styles.css';
import { GameApp } from './ui/GameApp';

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
