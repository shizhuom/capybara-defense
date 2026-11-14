import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.runtime', 'browser-tmp');
fs.mkdirSync(runtime, { recursive: true });
const executablePath = process.env.CAPY_CHROME ?? [
  path.join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(file => fs.existsSync(file));
if (!executablePath) throw new Error('Set CAPY_CHROME to an installed Chrome/Edge executable.');
const browser = await chromium.launch({ headless: true, executablePath, env: { ...process.env, TEMP: runtime, TMP: runtime }, args: ['--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking'] });
// An isolated browser context protects the user's normal browser storage.
const page = await browser.newPage({ viewport: { width: 1536, height: 1200 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(12000);
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const mark = text => { checks.push(text); console.log('PASS ' + text); };
const click = action => page.locator(`[data-action="${action}"]`).filter({ visible: true }).first().click();
const modalClick = action => page.locator(`#game-dialog [data-action="${action}"]`).click();
const profile = () => page.evaluate(() => structuredClone(window.__CAPY_DEBUG__.profile));
const state = () => page.evaluate(() => structuredClone(window.__CAPY_DEBUG__.engine.state));
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
const grant = async kind => { await page.locator('#dev-unit').selectOption(kind); await click('grant'); };
async function point(x, y) { const bounds = await page.locator('#battle-canvas').boundingBox(); return { x: bounds.x + x / 640 * bounds.width, y: bounds.y + y / 1386 * bounds.height }; }
async function canvasClick(x, y) { const target = await point(x, y); await page.mouse.click(target.x, target.y); await page.waitForTimeout(160); }
async function canvasDrag(x1, y1, x2, y2) { const a = await point(x1, y1), b = await point(x2, y2); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(160); }
async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit viewport');
  if (await page.locator('#game-dialog').evaluate(dialog => dialog.open)) assert.ok(await page.locator('#game-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1), 'dialog must fit viewport');
}

try {
  await page.addInitScript(() => {
    if (localStorage.getItem('capybara_m2_qa_seeded')) return;
    localStorage.setItem('capybara_m2_qa_seeded', 'yes');
    localStorage.setItem('capybara_defense_v1:language', 'zh-CN');
    localStorage.setItem('capybara_defense_v1:profile', JSON.stringify({ coins: 1200, wins: 3, matches: 4, fragments: ['bamboo_blade', 'orange_wand'], awardedBattles: ['legacy-receipt'] }));
  });
  await page.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
  assert.ok(await page.evaluate(() => !!window.__CAPY_DEBUG__), 'Run against Vite development mode, not the old production build');
  let p = await profile();
  assert.equal(p.coins, 1200); assert.equal(p.wins, 3); assert.equal(p.matches, 4);
  assert.equal(p.schemaVersion, 2); assert.equal(p.weaponFragments.m01_swatter, 2);
  assert.equal(await page.locator('.menu-stats > span:nth-child(3) strong').innerText(), '2');
  assert.deepEqual(p.awardedBattles, ['legacy-receipt']);
  await page.evaluate(() => { window.__m2OriginalRandom = Math.random; Math.random = () => .01; });
  await click('market');
  assert.equal(await page.locator('.shop-card').count(), 3);
  await modalClick('meta-buy:washer'); await modalClick('meta-prop:washer');
  assert.equal(await page.locator('.shop-card').count(), 3);
  assert.equal((await profile()).coins, 1110); assert.ok((await profile()).equippedActiveProps.includes('washer'));
  await modalClick('meta-buy:clay'); await modalClick('meta-prop:clay');
  assert.equal(await page.locator('.shop-card').count(), 3);
  const beforeRefresh = (await profile()).coins; await modalClick('meta-refresh');
  assert.equal((await profile()).coins, beforeRefresh - 20); assert.equal(await page.locator('.shop-card').count(), 3);
  assert.equal(await page.locator('.prop-slot').count(), 8);
  mark('Old save migrates without losing currency, history or receipts; three-item shop buys, equips and refreshes');

  await page.evaluate(() => { window.__CAPY_DEBUG__.profile.freeLotteryTickets = 2; Math.random = () => .5; });
  await modalClick('meta-tab:lottery');
  assert.equal(await page.locator('.lottery-cell').count(), 8);
  const beforeSpin = await profile(); await modalClick('meta-spin');
  assert.equal((await stored()).freeLotteryTickets, beforeSpin.freeLotteryTickets - 1);
  assert.equal((await stored()).coins, beforeSpin.coins + 80);
  const once = await stored();
  await modalClick('en'); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.ok(await page.locator('[data-action="meta-spin"]').isDisabled());
  await modalClick('close-meta'); await click('market'); await modalClick('meta-tab:lottery');
  assert.deepEqual(await stored(), once);
  await page.locator('.lottery-result').waitFor();
  assert.deepEqual(await stored(), once);
  await modalClick('zh-CN'); assert.match(await page.locator('.lottery-result').innerText(), /金币/);
  await modalClick('close-meta');
  await page.evaluate(() => { Math.random = window.__m2OriginalRandom; });
  mark('Lottery spends a free ticket first, saves the prize before animation, and never recharges on language switch or reopen');

  const normal = await profile();
  await click('test-enable'); p = await profile();
  assert.equal(p.coins, 9999); assert.equal(p.unlockedWeapons.length, 36); assert.equal(Object.keys(p.ownedProps).length, 20); assert.equal(Object.keys(p.equippedWeapons).length, 12);
  assert.match(await page.locator('#profile-mode').innerText(), /测试档/);
  const backup = await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup'));
  await click('test-enable'); assert.equal(await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup')), backup);
  await click('test-restore'); assert.deepEqual(await profile(), normal);
  assert.equal(await page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup')), null);
  await click('test-enable');
  mark('Full test save grants 36 weapons, 12 signatures and 20 props; repeated activation preserves the original backup; restore is exact');

  await click('armory'); assert.equal(await page.locator('.weapon-card').count(), 36);
  for (const family of ['melee', 'ranged', 'magic']) { await modalClick(`meta-family:${family}`); assert.equal(await page.locator('.weapon-card').count(), 12); }
  await modalClick('meta-family:melee');
  assert.equal(await page.locator('[data-weapon="m01_swatter"] option[value="bamboo_mafia"]').count(), 0);
  await page.locator('[data-weapon="m01_swatter"]').selectOption('kungfu_po');
  await page.locator('[data-weapon="m01_swatter"]').selectOption('samurai_doge');
  p = await profile(); assert.equal(p.equippedWeapons.samurai_doge, 'm01_swatter'); assert.equal(p.equippedWeapons.kungfu_po, undefined);
  assert.equal(Object.values(p.equippedWeapons).filter(id => id === 'm01_swatter').length, 1);
  assert.ok(await page.locator('.signature-note').count() > 0);
  await page.evaluate(() => { window.__CAPY_DEBUG__.profile.weaponFragments.m01_swatter = 3; });
  for (let rarity = 1; rarity < 5; rarity++) await page.locator(`[data-rarity="${rarity}"]`).uncheck();
  const beforeRecycle = (await profile()).coins; await modalClick('meta-recycle');
  assert.equal((await profile()).coins, beforeRecycle + 16); assert.equal((await profile()).weaponFragments.m01_swatter, 1);
  await modalClick('en'); assert.match(await page.locator('.weapon-card').first().innerText(), /Fly Swatter/);
  await modalClick('close-meta'); await click('zh-CN');
  await page.locator('[data-prop-slot="active:0"]').selectOption('milk_bottle');
  await page.locator('[data-prop-slot="active:1"]').selectOption('glue_trap');
  p = await profile(); assert.deepEqual(p.equippedActiveProps, ['milk_bottle', 'glue_trap']); assert.equal(p.equippedPassiveProps.length, 6);
  mark('Armory filters all three 12-weapon families, prevents cross-family options, transfers a unique weapon, and recycles only selected surplus');

  await click('start');
  await page.evaluate(() => { const e = window.__CAPY_DEBUG__.engine; e.options.autoWaves = false; e.options.ai = false; e.state.enemies = []; });
  let s = await state(); assert.deepEqual(s.sides.player.loadout.equippedActiveProps, p.equippedActiveProps);
  assert.ok(await page.evaluate(() => window.__CAPY_DEBUG__.engine.state.sides.player.loadout.equippedWeapons !== window.__CAPY_DEBUG__.profile.equippedWeapons));
  assert.equal(await page.locator('.battle-prop').count(), 2); assert.equal(await page.locator('.passive-icons > span').count(), 6);
  await click('food'); const initialFood = (await state()).sides.player.food; await click('summon');
  assert.equal((await state()).sides.player.food, initialFood - 10); assert.equal((await state()).units.filter(u => u.side === 'player' && u.location.zone === 'bench').length, 5);
  const oldBench = (await state()).units.filter(u => u.side === 'player' && u.location.zone === 'bench').map(u => u.id);
  await click('summon'); assert.ok((await state()).units.every(u => !oldBench.includes(u.id)));
  await page.evaluate(() => { window.__CAPY_DEBUG__.engine.state.units = []; });
  await grant('hamster');
  await click('prop:milk_bottle'); await canvasClick(114, 1162);
  s = await state(); assert.equal(s.units.find(u => u.side === 'player').level, 2); assert.ok(s.sides.player.propCooldowns.milk_bottle > 0);
  assert.ok(await page.locator('[data-action="prop:milk_bottle"]').isDisabled());
  const road = await page.evaluate(() => { const grid = window.__CAPY_DEBUG__.engine.state.grid; for (let row = 5; row < 10; row++) for (let col = 0; col < 8; col++) if (grid[row][col] === 'R') return { col, row }; });
  const propButton = page.locator('[data-action="prop:glue_trap"]'); await propButton.scrollIntoViewIfNeeded();
  const propBounds = await propButton.boundingBox(), roadPoint = await point(32 + (road.col + .5) * 72, 240 + (road.row + .5) * 72);
  await page.mouse.move(propBounds.x + propBounds.width / 2, propBounds.y + propBounds.height / 2); await page.mouse.down(); await page.mouse.move(roadPoint.x, roadPoint.y, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(180);
  s = await state(); assert.equal(s.traps.length, 1); assert.equal(s.traps[0].col, road.col); assert.equal(s.traps[0].row, road.row);
  await click('sprinkler'); assert.equal((await state()).sides.player.sprinklerUsed, true); assert.ok(await page.locator('[data-action="sprinkler"]').isDisabled());
  await page.evaluate(() => { window.__CAPY_DEBUG__.engine.state.units.find(u => u.side === 'player').statuses.SEALED = 10; });
  await canvasClick(114, 1162); assert.ok(await page.locator('.sealed-warning').isVisible()); assert.ok(await page.locator('#sealed-hint').isVisible());
  await click('en'); assert.match(await page.locator('.sealed-warning').innerText(), /SEALED/);
  await click('zh-CN');
  mark('Battle copies loadout, retains five-card redraw, displays 2+6 props, click-casts milk, DOM-drags a road trap, uses sprinkler once, and shows bilingual seal guidance');

  await page.evaluate(() => {
    const debug = window.__CAPY_DEBUG__, e = debug.engine;
    const unit = e.state.units.find(u => u.side === 'player');
    unit.statuses = {}; unit.location = { zone: 'board', col: 2, row: 7 }; unit.cooldown = 0;
    const enemy = e.spawnEnemy('husky_wrecker', 'player'); enemy.progress = 5; enemy.col = 2; enemy.row = 6; enemy.hp = 1; enemy.speed = 0; e.tick(.1);
    debug.profile.unlockedWeapons = debug.profile.unlockedWeapons.filter(id => id !== 'm02_slipper'); debug.profile.weaponFragments.m02_slipper = 0;
    e.state.sides.ai.loot = ['m02_slipper']; e.state.sides.player.oranges = 20;
  });
  s = await state(); assert.ok(s.sides.player.loot.length > 0); assert.ok(s.sides.player.loot.every(id => /^[mrw]\d{2}_/.test(id)));
  const ticketsBeforeWin = (await profile()).freeLotteryTickets;
  const matchesBeforeWin = (await profile()).matches;
  for (let i = 0; i < 10; i++) await click('skip');
  await page.locator('#game-dialog [data-action="menu"]').waitFor();
  assert.equal((await state()).result.winner, 'player');
  p = await profile(); assert.equal(p.freeLotteryTickets, ticketsBeforeWin + 1); assert.equal(p.matches, matchesBeforeWin + 1); assert.ok(p.unlockedWeapons.includes('m02_slipper'));
  assert.match(await page.locator('.unlock-reward').innerText(), /人字拖/); assert.ok(await page.locator('.ticket-reward').isVisible());
  await modalClick('en'); assert.match(await page.locator('.unlock-reward').innerText(), /Flip-Flop/);
  const awarded = await stored(); await click('menu'); await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await profile(), awarded);
  assert.equal(Number(await page.locator('.menu-stats > span:nth-child(3) strong').innerText()), Object.values(awarded.weaponFragments).reduce((sum, amount) => sum + amount, 0));
  mark('A real boss death drops concrete weapon IDs; winning pools both bags, unlocks a weapon, awards one ticket and survives reload exactly once');

  await page.setViewportSize({ width: 320, height: 844 }); await page.waitForTimeout(180); await noOverflow();
  await click('armory'); await noOverflow(); await modalClick('zh-CN'); await noOverflow(); await modalClick('close-meta');
  await click('market'); await modalClick('meta-tab:lottery'); await noOverflow(); await modalClick('en'); await noOverflow(); await modalClick('close-meta');
  await click('start'); await page.waitForTimeout(180); await noOverflow();
  assert.ok(await page.locator('#battle-props').evaluate(element => element.closest('#stage') !== null));
  await page.locator('#battle-canvas').scrollIntoViewIfNeeded();
  const stageBounds = await page.locator('#stage').boundingBox(), sprinklerBounds = await page.locator('[data-action="sprinkler"]').boundingBox();
  assert.ok(sprinklerBounds.x >= stageBounds.x && sprinklerBounds.x + sprinklerBounds.width <= stageBounds.x + stageBounds.width);
  await click('pause'); const paused = (await state()).time; await page.waitForTimeout(180); assert.equal((await state()).time, paused);
  await modalClick('zh-CN'); await noOverflow(); await click('resume');
  mark('320px menu, armory, lottery, battle and bilingual pause fit without horizontal overflow; sprinkler stays inside the stage');
  assert.deepEqual(errors, []); mark('No console errors or uncaught page errors');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.mkdirSync(path.join(root, 'verification'), { recursive: true });
  fs.writeFileSync(path.join(root, 'verification', 'm2-browser-qa.json'), JSON.stringify({ checks, errors, success: !process.exitCode }, null, 2));
  await browser.close();
}
