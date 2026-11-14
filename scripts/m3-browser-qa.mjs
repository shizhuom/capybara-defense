import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Run only after the integration owner freezes source and confirms dev4175.
// This script never starts, stops, or changes a server, and uses isolated storage.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.runtime', 'browser-tmp');
const output = path.join(root, 'verification');
fs.mkdirSync(runtime, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const executablePath = process.env.CAPY_CHROME ?? [
  path.join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(file => fs.existsSync(file));
if (!executablePath) throw new Error('Set CAPY_CHROME to installed Chrome/Edge.');
const browser = await chromium.launch({ headless: true, executablePath, env: { ...process.env, TEMP: runtime, TMP: runtime }, args: ['--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking'] });
const context = await browser.newContext({ viewport: { width: 1536, height: 1200 }, deviceScaleFactor: 1 });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const checks = [], errors = [], screenshots = [];
const captureErrors = target => {
  target.on('pageerror', error => errors.push(error.message));
  target.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
};
captureErrors(page);
const mark = message => { checks.push(message); console.log('PASS ' + message); };
const click = action => page.locator(`[data-action="${action}"]`).filter({ visible: true }).first().click();
const modalClick = action => page.locator(`#game-dialog [data-action="${action}"]`).click();
const profile = () => page.evaluate(() => structuredClone(window.__CAPY_DEBUG__.profile));
const state = () => page.evaluate(() => structuredClone(window.__CAPY_DEBUG__.engine.state));
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
const snap = async name => { const filename = `m3-${name}.png`; const modal = await page.locator('#game-dialog').evaluate(el => el.open); await page.screenshot({ path: path.join(output, filename), fullPage: !modal }); screenshots.push(filename); };
async function fit() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page fits viewport');
  if (await page.locator('#game-dialog').evaluate(el => el.open)) assert.ok(await page.locator('#game-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'dialog fits viewport');
}
async function quietBattle() {
  await page.evaluate(() => { const e = window.__CAPY_DEBUG__.engine; e.options.autoWaves = false; e.options.ai = false; e.state.enemies = []; });
}
async function watchSound() {
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').findLast(entry => new URL(entry.name).pathname === '/src/ui/SoundManager.ts');
    const { SoundManager } = await import(resource?.name ?? '/src/ui/SoundManager.ts');
    const play = SoundManager.prototype.play;
    const tone = SoundManager.prototype.tone;
    window.__m3Cues = []; window.__m3EffectNotes = 0;
    SoundManager.prototype.play = function(cue) { window.__m3Sound = this; window.__m3Cues.push(cue); return play.call(this, cue); };
    SoundManager.prototype.tone = function(note, bus, at) { if (bus === this.effects) window.__m3EffectNotes++; return tone.call(this, note, bus, at); };
  });
}
const cueCount = cue => page.evaluate(cue => (window.__m3Cues ?? []).filter(value => value === cue).length, cue);
async function win() {
  await page.evaluate(() => window.__CAPY_DEBUG__.engine.adjustOranges(-999, 'ai'));
  await page.locator('#game-dialog [data-action="menu"]').waitFor();
}
async function reviewRegressions() {
  const failures = [];
  const isolated = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const mapPage = await isolated.newPage(); captureErrors(mapPage);
  const action = (target, value) => target.locator(`[data-action="${value}"]`).filter({ visible: true }).first().click();
  const guard = p => ({ stars: p.stars, highestStars: p.highestStars, selectedMap: p.selectedMap, unlockedAvatars: p.unlockedAvatars });
  try {
    await mapPage.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
    const original = await mapPage.evaluate(() => structuredClone(window.__CAPY_DEBUG__.profile));
    assert.equal(original.stars, 0); assert.equal(await mapPage.locator('#menu-map option').count(), 2);
    assert.equal(await mapPage.locator('#dev-map option').count(), 5, 'rank0 sandbox must offer auto plus all four maps');
    const finish = async () => { await action(mapPage, 'pause'); await action(mapPage, 'surrender'); await action(mapPage, 'menu'); };
    for (const mapId of ['sunny_backyard', 'sakura_onsen', 'midnight_kitchen', 'cat_tower_maze']) {
      const rawBefore = await mapPage.evaluate(() => localStorage.getItem('capybara_defense_v1:profile'));
      await mapPage.locator('#dev-map').selectOption(mapId);
      assert.equal(await mapPage.evaluate(() => localStorage.getItem('capybara_defense_v1:profile')), rawBefore, 'sandbox choice must not persist');
      await action(mapPage, 'start');
      assert.equal(await mapPage.evaluate(() => window.__CAPY_DEBUG__.engine.state.mapId), mapId);
      assert.deepEqual(guard(await mapPage.evaluate(() => window.__CAPY_DEBUG__.profile)), guard(original));
      await finish(); assert.equal(await mapPage.locator('#menu-map option').count(), 2);
      assert.deepEqual(guard(await mapPage.evaluate(() => JSON.parse(localStorage.getItem('capybara_defense_v1:profile')))), guard(original));
    }
    await mapPage.locator('#dev-map').selectOption('cat_tower_maze'); await mapPage.locator('#menu-map').selectOption('sunny_backyard');
    assert.equal(await mapPage.locator('#dev-map').inputValue(), 'auto'); await action(mapPage, 'start');
    assert.equal(await mapPage.evaluate(() => window.__CAPY_DEBUG__.engine.state.mapId), 'sunny_backyard'); await finish();
    await mapPage.locator('#dev-map').selectOption('cat_tower_maze'); await mapPage.locator('#dev-map').selectOption('auto'); await action(mapPage, 'start');
    assert.equal(await mapPage.evaluate(() => window.__CAPY_DEBUG__.engine.state.mapId), 'sunny_backyard'); await finish();
    await mapPage.locator('#dev-map').selectOption('cat_tower_maze'); await action(mapPage, 'test-enable'); await action(mapPage, 'test-restore');
    assert.equal(await mapPage.locator('#dev-map').inputValue(), 'auto'); assert.equal(await mapPage.locator('#menu-map option').count(), 2);
    await mapPage.locator('#dev-map').selectOption('cat_tower_maze'); await action(mapPage, 'reset');
    assert.equal(await mapPage.locator('#dev-map').inputValue(), 'auto'); assert.equal(await mapPage.locator('#menu-map option').count(), 2);
    mark('Normal rank0 sandbox selects all four maps without changing stars, map unlocks or achievements; normal selection, restore and reset clear its page-only override');
  } catch (error) { failures.push(`Sandbox override: ${error.message}`); }
  const audioPage = await isolated.newPage(); captureErrors(audioPage);
  try {
    await audioPage.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
    await audioPage.evaluate(async () => {
      const resource = performance.getEntriesByType('resource').findLast(entry => new URL(entry.name).pathname === '/src/ui/SoundManager.ts');
      const { SoundManager } = await import(resource?.name ?? '/src/ui/SoundManager.ts'); const play = SoundManager.prototype.play, tone = SoundManager.prototype.tone;
      window.__reviewNotes = 0;
      SoundManager.prototype.play = function(cue) { window.__reviewSound = this; return play.call(this, cue); };
      SoundManager.prototype.tone = function(note, bus, at) { if (bus === this.effects) window.__reviewNotes++; return tone.call(this, note, bus, at); };
    });
    await action(audioPage, 'start'); await action(audioPage, 'food'); await action(audioPage, 'summon'); await audioPage.waitForTimeout(100);
    await audioPage.evaluate(() => { window.__reviewContext = window.__reviewSound.context; window.__reviewTimer = window.__reviewSound.timer; });
    const initial = await audioPage.evaluate(() => ({ running: window.__reviewContext?.state, notes: window.__reviewNotes }));
    assert.equal(initial.running, 'running'); assert.ok(initial.notes > 0);
    for (let cycle = 0; cycle < 2; cycle++) {
      const hidden = await audioPage.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        return { disposed: window.__reviewSound.disposed, same: window.__reviewSound.context === window.__reviewContext, ducked: window.__reviewSound.ducked };
      });
      assert.equal(hidden.disposed, false, 'persisted pagehide must retain manager'); assert.ok(hidden.same); assert.ok(hidden.ducked);
      await audioPage.waitForTimeout(100); assert.equal(await audioPage.evaluate(() => window.__reviewSound.ducked), true);
      await audioPage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      assert.equal(await audioPage.evaluate(() => window.__reviewSound.ducked), false);
      const noteCount = await audioPage.evaluate(() => window.__reviewNotes);
      await action(audioPage, 'summon');
      assert.ok(await audioPage.evaluate(() => window.__reviewSound.context === window.__reviewContext && window.__reviewSound.timer === window.__reviewTimer));
      assert.ok(await audioPage.evaluate(() => window.__reviewNotes) > noteCount);
    }
    await audioPage.evaluate(() => window.__reviewContext.suspend());
    const notesBeforeResume = await audioPage.evaluate(() => window.__reviewNotes);
    await action(audioPage, 'summon'); await audioPage.waitForTimeout(100); await action(audioPage, 'summon');
    assert.equal(await audioPage.evaluate(() => window.__reviewContext.state), 'running');
    assert.ok(await audioPage.evaluate(() => window.__reviewSound.context === window.__reviewContext && window.__reviewSound.timer === window.__reviewTimer));
    assert.ok(await audioPage.evaluate(() => window.__reviewNotes) > notesBeforeResume);
    await audioPage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    assert.deepEqual(await audioPage.evaluate(() => ({ disposed: window.__reviewSound.disposed, context: window.__reviewSound.context, timer: window.__reviewSound.timer })), { disposed: true, context: null, timer: null });
    mark('Synthetic persisted pagehide/pageshow twice retains playable context and timer; suspended context resumes by gesture; permanent pagehide releases audio (no claim of actual BFCache hit)');
  } catch (error) { failures.push(`Page lifecycle: ${error.message}`); }
  await isolated.close();
  fs.writeFileSync(path.join(output, 'm3-review-regressions.json'), JSON.stringify({ success: failures.length === 0, failures }, null, 2));
  assert.deepEqual(failures, [], 'M3 final-review regressions');
}

try {
  await reviewRegressions();
  if (!process.argv.includes('--regression-only')) {
  await page.addInitScript(() => {
    if (localStorage.getItem('capybara_defense_v1:m3QaSeeded')) return;
    localStorage.setItem('capybara_defense_v1:m3QaSeeded', 'yes');
    localStorage.setItem('capybara_defense_v1:language', 'zh-CN');
    localStorage.setItem('capybara_defense_v1:profile', JSON.stringify({ coins: 1234, wins: 3, matches: 7, fragments: ['bamboo_blade'], awardedBattles: ['m3-legacy-receipt'] }));
  });
  await page.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
  assert.ok(await page.evaluate(() => !!window.__CAPY_DEBUG__), 'M3 QA requires frozen Vite development server on 4175');
  let p = await profile(); assert.equal(p.coins, 1234); assert.equal(p.wins, 3); assert.equal(p.matches, 7);
  assert.deepEqual(p.awardedBattles, ['m3-legacy-receipt']); assert.equal(p.stars, 3); assert.equal(p.selectedMap, 'auto');
  assert.equal(p.weaponFragments.m01_swatter, 1); assert.equal(await page.locator('#dev-rank option').count(), 54);
  assert.equal(await page.locator('#dev-boss option').count(), 12);
  await snap('desktop-menu'); mark('M1 save preserves coins, wins, matches, fragments and receipts; M3 defaults and 54 ranks / 12 bosses appear');

  await click('brand'); assert.equal(await page.locator('.avatar-card').count(), 16);
  assert.ok(await page.locator('[data-action="avatar:zen_capy"]').isDisabled());
  await modalClick('avatar:hamster'); assert.equal((await stored()).avatarId, 'hamster');
  await modalClick('en'); assert.match(await page.locator('#dialog-title').innerText(), /Avatar/); await fit();
  await snap('desktop-profile'); await modalClick('close-profile');
  await click('leaderboard'); assert.equal(await page.locator('.leaderboard-row').count(), 16); assert.equal(await page.locator('[data-player="true"]').count(), 1);
  const boardStars = await page.locator('.leaderboard-row > strong').allTextContents();
  assert.deepEqual(boardStars.map(value => Number(value.replace(/\D/g, ''))), [...boardStars.map(value => Number(value.replace(/\D/g, '')))].sort((a, b) => b - a));
  await snap('desktop-leaderboard'); await modalClick('close-profile');
  mark('16 unique avatar SVGs show transparent conditions; selection persists; bilingual 15 NPC plus player leaderboard sorts immediately');

  await click('settings');
  for (const [key, value] of [['musicVolume', '.17'], ['soundVolume', '0']]) {
    await page.locator(`[data-setting="${key}"]`).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    assert.equal((await stored()).settings[key], Number(value));
    assert.equal((await profile()).settings[key], Number(value));
  }
  await page.locator('[data-setting="showDamageNumbers"]').uncheck(); assert.equal((await stored()).settings.showDamageNumbers, false);
  const settingsBeforeFailure = (await profile()).settings;
  await page.evaluate(() => { window.__m3OriginalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'capybara_defense_v1:profile') throw Error('QA storage denied'); return window.__m3OriginalSetItem.call(this, key, value); }; });
  await page.locator('[data-setting="musicVolume"]').evaluate(el => { el.value = '.91'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.deepEqual((await profile()).settings, settingsBeforeFailure);
  await page.evaluate(() => { Storage.prototype.setItem = window.__m3OriginalSetItem; });
  await snap('desktop-settings'); await modalClick('close-profile'); await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual((await profile()).settings, settingsBeforeFailure);
  mark('Settings save and apply on range input, accept mute, preserve damage switch across reload, and leave memory unchanged on storage failure');

  const normal = await profile();
  await watchSound();
  await page.locator('#dev-tools').evaluate(el => { el.open = true; });
  await click('test-enable'); p = await profile();
  assert.equal(p.unlockedAvatars.length, 16); assert.equal(p.mergedHeroes.length, 12); assert.ok(p.stars >= 180);
  assert.equal(await page.locator('#menu-map option').count(), 5);
  const backup = await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup'));
  await click('test-enable'); assert.equal(await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup')), backup);
  await click('settings'); await page.locator('[data-setting="soundVolume"]').evaluate(el => { el.value = '.35'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await modalClick('close-profile');
  await click('leaderboard'); assert.equal(await page.locator('.leaderboard-row').first().getAttribute('data-player'), 'true'); await modalClick('close-profile');
  await click('armory'); assert.equal(await page.locator('[data-loadout-hero]').count(), 12); assert.equal(await page.locator('.weapon-sticker [data-sticker]').count(), 36);
  await modalClick('meta-sort:orange'); assert.equal(await page.locator('.weapon-card').first().getAttribute('data-weapon-rarity'), '4');
  await modalClick('meta-sort:default'); assert.equal(await page.locator('.weapon-card').first().getAttribute('data-weapon-id'), 'm01_swatter');
  await snap('desktop-armory'); await modalClick('zh-CN'); await modalClick('close-meta');
  mark('M3 full test profile unlocks all maps and avatars without replacing backup; armory has 12 loadouts, 36 weapon stickers and reversible orange/default order');

  await click('market'); await modalClick('meta-tab:lottery');
  const ticks = await cueCount('lottery_tick'), lotteryWins = await cueCount('lottery_win');
  await modalClick('meta-spin'); const lotteryOnce = await stored();
  await modalClick('en'); await modalClick('close-meta'); await click('market');
  await page.locator('.lottery-result').waitFor(); assert.deepEqual(await stored(), lotteryOnce);
  assert.ok(await cueCount('lottery_tick') > ticks + 20); assert.equal(await cueCount('lottery_win'), lotteryWins + 1);
  await modalClick('zh-CN'); await snap('desktop-lottery'); assert.equal(await cueCount('lottery_win'), lotteryWins + 1); await modalClick('close-meta');
  mark('Real lottery steps and award emit one sequence of ticks and one win cue across language switch and reopen, with no repeated transaction');

  for (const mapId of ['sunny_backyard', 'sakura_onsen', 'midnight_kitchen', 'cat_tower_maze']) {
    await page.locator('#menu-map').selectOption(mapId); await page.locator('#dev-rank').selectOption('30');
    await click('start'); await quietBattle(); let s = await state(); assert.equal(s.mapId, mapId); assert.equal(s.rankIndex, 30);
    const summonCues = await cueCount('summon'), noteCount = await page.evaluate(() => window.__m3EffectNotes);
    await click('summon'); assert.equal((await state()).units.filter(unit => unit.side === 'player' && unit.location.zone === 'bench').length, 5);
    assert.equal(await cueCount('summon'), summonCues + 1);
    assert.ok(await page.evaluate(() => window.__m3EffectNotes) > noteCount, 'non-muted browser synthesizes actual SFX notes');
    // Use the accessible controls to place a real summoned unit on this map's open tile.
    await page.locator('.keyboard-card').evaluate(el => { el.open = true; });
    const open = s.grid.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y }))).find(cell => cell.y >= 5 && cell.tile === 'O');
    await page.locator('[data-target="bench:0"]').click(); await page.locator(`[data-target="cell:${open.x}:${open.y}"]`).click();
    assert.ok((await state()).units.some(unit => unit.side === 'player' && unit.location.zone === 'board'));
    // Spawn and advance an actual enemy through this engine's configured path.
    const moved = await page.evaluate(() => { const e = window.__CAPY_DEBUG__.engine, enemy = e.spawnEnemy('rat', 'player'); const start = { col: enemy.col, row: enemy.row }; e.tick(2); return { start, end: { col: enemy.col, row: enemy.row }, progress: enemy.progress }; });
    assert.ok(moved.progress > 0); assert.notDeepEqual(moved.start, moved.end);
    await page.evaluate(() => { window.__m3AudioContext = window.__m3Sound.context; window.__m3AudioTimer = window.__m3Sound.timer; });
    await click('brand'); assert.equal((await state()).phase, 'paused'); const pausedTime = (await state()).time;
    await page.waitForTimeout(150); assert.equal((await state()).time, pausedTime); await modalClick('close-profile'); assert.equal((await state()).phase, 'playing');
    await click('pause'); await modalClick('settings'); await modalClick('close-profile'); assert.equal((await state()).phase, 'paused');
    assert.ok(await page.locator('#game-dialog [data-action="resume"]').isVisible()); await click('resume');
    assert.ok(await page.evaluate(() => window.__m3Sound.context === window.__m3AudioContext && window.__m3Sound.timer === window.__m3AudioTimer));
    await snap(`desktop-battle-${mapId}`); const victories = await cueCount('victory'); await win();
    assert.equal(await cueCount('victory'), victories + 1); await modalClick('menu');
  }
  mark('All four maps start with selected map/rank, real summon and placement, advancing path enemy, and profile/settings preserve active versus existing pause');

  // Real merge commands must record achievements before the battle is settled.
  await page.evaluate(() => { const p = window.__CAPY_DEBUG__.profile; p.mergedHeroes = []; p.unlockedAvatars = p.unlockedAvatars.filter(id => id !== 'kungfu_panda'); });
  await click('start'); await quietBattle();
  for (const kind of ['panda', 'hat_bamboo']) { await page.locator('#dev-unit').selectOption(kind); await click('grant'); }
  const legendaryCues = await cueCount('merge_hero'), upgradeCues = await cueCount('merge_upgrade');
  await page.locator('[data-target="bench:0"]').click(); await page.locator('[data-target="bench:1"]').click();
  await page.waitForFunction(() => window.__CAPY_DEBUG__.profile.mergedHeroes.includes('kungfu_po'));
  assert.ok((await stored()).unlockedAvatars.includes('kungfu_panda')); await win(); await modalClick('menu');
  assert.equal(await cueCount('merge_hero'), legendaryCues + 1); assert.equal(await cueCount('merge_upgrade'), upgradeCues);
  // A rank-9 win crosses rank 10 and unlocks its avatar at the real settlement.
  await page.locator('#dev-rank').selectOption('9');
  await page.evaluate(() => { const p = window.__CAPY_DEBUG__.profile; p.stars = 19; p.highestStars = 19; p.winStreak = 0; p.unlockedAvatars = p.unlockedAvatars.filter(id => id !== 'sakura_capy'); });
  await click('start'); await quietBattle(); const matches = (await profile()).matches;
  await win(); p = await profile(); assert.equal(p.stars, 20); assert.equal(p.matches, matches + 1);
  assert.match(await page.locator('.rank-result').innerText(), /晋级/); assert.match(await page.locator('.rank-result').innerText(), /樱花/);
  const once = await stored(); await modalClick('en'); await modalClick('zh-CN'); assert.deepEqual(await stored(), once);
  await snap('desktop-promotion'); await modalClick('menu'); await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await profile(), once);
  mark('Actual legendary merge records its avatar immediately; real rank-9 settlement promotes to rank 10 and shows new avatar, with one receipt across language/reload');

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(120); await fit(); await snap(`${width}-menu`);
    await click('brand'); await fit(); await snap(`${width}-profile`); await modalClick('en'); await fit(); await modalClick('close-profile');
    await click('leaderboard'); await fit(); await snap(`${width}-leaderboard`); await modalClick('close-profile');
    await click('armory'); await fit(); await snap(`${width}-armory`); await modalClick('close-meta');
    await click('settings'); await fit(); await snap(`${width}-settings`); await modalClick('close-profile');
    await click('start'); await quietBattle();
    await page.locator('#dev-tools').evaluate(el => { el.open = true; }); await page.locator('#dev-unit').selectOption('hamster'); await click('grant');
    await page.locator('.keyboard-card').evaluate(el => { el.open = true; }); await page.locator('[data-target="bench:0"]').click();
    await page.evaluate(() => { window.__CAPY_DEBUG__.engine.state.units.find(unit => unit.side === 'player').statuses.SEALED = 10; });
    await page.waitForTimeout(180); await page.locator('#stage').scrollIntoViewIfNeeded(); await fit();
    const seal = await page.locator('#sealed-hint').boundingBox(), stage = await page.locator('#stage').boundingBox();
    assert.ok(seal && seal.x >= stage.x && seal.x + seal.width <= stage.x + stage.width);
    assert.ok(seal.y + seal.height < stage.y + stage.height * (981 / 1386) - 3, 'seal leaves at least 3px above actual canvas capsule');
    await snap(`${width}-battle-sealed`);
    const stageFile = `m3-${width}-battle-stage.png`; await page.locator('#stage').screenshot({ path: path.join(output, stageFile) }); screenshots.push(stageFile);
    await click('pause'); await modalClick('surrender'); await modalClick('menu'); await click('zh-CN');
  }
  mark('Desktop and 320/390 layouts fit in both languages; avatars, board, settings, armory and battle screenshots captured; seal clears status capsule');

  await page.locator('#dev-tools').evaluate(el => { el.open = true; }); await click('test-restore'); assert.deepEqual(await profile(), normal);
  await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await profile(), normal);
  assert.equal(await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup')), null);
  mark('All M3 test progress discards on restore; exact normal save including settings and receipts survives reload');

  const silent = await context.newPage(); captureErrors(silent);
  await silent.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined }); Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined }); });
  await silent.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
  await silent.locator('[data-action="start"]').click(); await silent.locator('[data-action="summon"]').click(); await silent.locator('[data-action="pause"]').click();
  await silent.close(); assert.deepEqual(errors, []);
  mark('Missing WebAudio safely supports gesture, summon and pause; no console errors or uncaught page errors');
  }
} catch (error) {
  console.error(error); errors.push(String(error.stack ?? error)); process.exitCode = 1;
  try { await snap('failure'); } catch { /* Page may already be unavailable. */ }
} finally {
  fs.writeFileSync(path.join(output, 'm3-browser-qa.json'), JSON.stringify({ success: !process.exitCode, checks, errors, screenshots }, null, 2));
  await browser.close();
}
