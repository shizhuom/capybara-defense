import '../platform/polyfills';
import { createPlatform } from '../platform';
import { MinigameApp } from './MinigameApp';

const platform = createPlatform();
const app = new MinigameApp(platform);

(globalThis as { __capyMinigameApp?: MinigameApp }).__capyMinigameApp = app;
