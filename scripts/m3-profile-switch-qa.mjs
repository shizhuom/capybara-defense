import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.runtime', 'browser-tmp');
const output = path.join(root, 'verification');
fs.mkdirSync(runtime, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const label = process.argv.find(value => value.startsWith('--label='))?.slice(8) ?? 'latest';
if (!/^[a-z]+$/.test(label)) throw Error('Use a plain alphabetic label.');
const executablePath = process.env.CAPY_CHROME ?? [
  path.join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find(file => fs.existsSync(file));
if (!executablePath) throw Error('Set CAPY_CHROME to installed Chrome/Edge.');
const browser = await chromium.launch({ headless: true, executablePath, env: { ...process.env, TEMP: runtime, TMP: runtime }, args: ['--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking'] });
const cases = [], errors = [];
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('capybara_defense_v1:profile')));
const backup = page => page.evaluate(() => localStorage.getItem('capybara_defense_v1:normalProfileBackup'));
const click = (page, action) => page.locator(`[data-action="${action}"]`).filter({ visible: true }).first().click();
const isMenu = page => page.locator('#menu-screen').isVisible();
const waitFrames = page => page.waitForTimeout(500);
async function setup() {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1100 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    if (localStorage.getItem('capybara_defense_v1:profileSwitchSeed')) return;
    localStorage.setItem('capybara_defense_v1:profileSwitchSeed', 'yes');
    localStorage.setItem('capybara_defense_v1:profile', JSON.stringify({ coins: 123, wins: 0, matches: 0, stars: 0, fragments: [], awardedBattles: [] }));
    localStorage.setItem('capybara_defense_v1:language', 'zh-CN');
  });
  await page.goto('http://127.0.0.1:4175/?dev=1', { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => typeof window.__CAPY_DEBUG__), 'undefined', 'Use actual production4175');
  await page.locator('.keyboard-card').evaluate(el => { el.open = true; });
  return { page, context };
}
async function surrender(page) { await click(page, 'pause'); await click(page, 'surrender'); await page.locator('#game-dialog [data-action="menu"]').waitFor(); }
async function caseRun(name, fn) {
  const { page, context } = await setup(); const evidence = {};
  try { await fn(page, evidence); cases.push({ name, passed: true, evidence }); console.log(`PASS ${name}`); }
  catch (error) { cases.push({ name, passed: false, error: String(error.stack ?? error), evidence }); console.error(`FAIL ${name}: ${error.message}`); }
  finally { await context.close(); }
}

try {
  await caseRun('Playing test restore discards old battle and restores exact backup without delayed or new-battle leakage', async (page, evidence) => {
    await click(page, 'test-enable'); const original = JSON.parse(await backup(page));
    await click(page, 'start');
    for (const kind of ['panda', 'hat_bamboo']) { await page.locator('#dev-unit').selectOption(kind); await click(page, 'grant'); }
    await page.locator('[data-target="bench:0"]').click(); await page.locator('[data-target="bench:1"]').click();
    assert.match(await page.locator('[data-target="bench:1"]').getAttribute('aria-label'), /功夫/);
    await click(page, 'test-restore'); evidence.returnedToMenu = await isMenu(page);
    evidence.backupRemoved = await backup(page) === null; evidence.afterRestore = await stored(page);
    await waitFrames(page); evidence.afterFrames = await stored(page);
    if (!evidence.returnedToMenu) { await surrender(page); evidence.afterOldBattleSettlement = await stored(page); }
    assert.ok(evidence.returnedToMenu, 'restored normal profile must not retain playing test engine');
    assert.ok(evidence.backupRemoved); assert.deepEqual(evidence.afterRestore, original); assert.deepEqual(evidence.afterFrames, original);
    await click(page, 'start'); await waitFrames(page);
    assert.equal(await page.locator('#keyboard-controls .pet-icon').count(), 0, 'new normal battle has no test units');
    assert.deepEqual(await stored(page), original);
    await surrender(page); const settled = await stored(page);
    assert.equal(settled.matches, original.matches + 1); assert.equal(settled.coins, original.coins); assert.equal(settled.stars, original.stars);
    assert.deepEqual(settled.mergedHeroes, original.mergedHeroes); assert.deepEqual(settled.unlockedAvatars, original.unlockedAvatars);
    await click(page, 'menu'); await page.reload({ waitUntil: 'networkidle' }); assert.deepEqual(await stored(page), settled);
    evidence.normalBattleAfterRestore = settled;
  });
  await caseRun('Playing normal enable discards old battle; repeated enable preserves active test battle and original backup', async (page, evidence) => {
    await click(page, 'start'); await click(page, 'summon'); await click(page, 'test-enable');
    evidence.returnedToMenu = await isMenu(page); const firstBackup = await backup(page), full = await stored(page);
    evidence.backup = JSON.parse(firstBackup); assert.equal(evidence.backup.coins, 123); assert.equal(evidence.backup.matches, 0);
    assert.ok(evidence.returnedToMenu, 'enabling test profile must discard playing normal engine');
    await waitFrames(page); assert.deepEqual(await stored(page), full);
    await click(page, 'start'); await click(page, 'summon');
    const bench = await page.locator('.keyboard-nests').innerHTML(); await click(page, 'test-enable');
    assert.equal(await isMenu(page), false); assert.equal(await backup(page), firstBackup);
    assert.equal(await page.locator('.keyboard-nests').innerHTML(), bench);
    await waitFrames(page); assert.deepEqual(await stored(page), full);
    evidence.repeatedEnableRetainedBattle = true;
  });
  await caseRun('Normal restore without backup retains the current ordinary battle', async (page, evidence) => {
    await click(page, 'start'); await click(page, 'summon');
    const bench = await page.locator('.keyboard-nests').innerHTML(); assert.equal(await backup(page), null);
    await click(page, 'test-restore'); assert.equal(await isMenu(page), false); assert.equal(await backup(page), null);
    assert.equal(await page.locator('.keyboard-nests').innerHTML(), bench);
    await waitFrames(page); await surrender(page); const settled = await stored(page);
    assert.equal(settled.matches, 1); assert.equal(settled.coins, 123); assert.equal(settled.stars, 0); assert.deepEqual(settled.mergedHeroes, []);
    evidence.normalSettlement = settled;
  });
  await caseRun('Restore profile write failure preserves active test battle, backup, test save and test controls', async (page, evidence) => {
    await click(page, 'test-enable'); await click(page, 'start'); await click(page, 'summon');
    const current = await stored(page), originalBackup = await backup(page), bench = await page.locator('.keyboard-nests').innerHTML();
    const rank = await page.locator('#dev-rank').inputValue(), wallet = await page.locator('.menu-stats').textContent();
    await page.evaluate(() => { window.__profileSwitchSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'capybara_defense_v1:profile') throw Error('QA profile write blocked'); return window.__profileSwitchSetItem.call(this, key, value); }; });
    await click(page, 'test-restore'); await waitFrames(page);
    assert.equal(await isMenu(page), false); assert.equal(await backup(page), originalBackup); assert.deepEqual(await stored(page), current);
    assert.equal(await page.locator('.keyboard-nests').innerHTML(), bench); assert.equal(await page.locator('[data-action="summon"]').isEnabled(), true);
    assert.equal(await page.locator('#dev-rank').inputValue(), rank); assert.equal(await page.locator('.menu-stats').textContent(), wallet);
    assert.match(await page.locator('#toast').innerText(), /存储|保存/);
    evidence.failedRestorePreservedAll = true;
    await page.evaluate(() => { Storage.prototype.setItem = window.__profileSwitchSetItem; });
    await click(page, 'test-restore'); assert.equal(await isMenu(page), true); assert.deepEqual(await stored(page), JSON.parse(originalBackup));
  });
} finally {
  await browser.close();
  const result = { label, production: true, success: cases.every(item => item.passed) && errors.length === 0, cases, errors };
  fs.writeFileSync(path.join(output, `m3-profile-switch-qa-${label}.json`), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(output, 'm3-profile-switch-qa.json'), JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}
