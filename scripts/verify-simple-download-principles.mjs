import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadPlaywright } from './collect-steam-discovery.mjs';
import { CONTENT } from './simple-download-principles/content.mjs';

const base = process.argv.find(arg => arg.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:4287';
const out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) || 'output/playwright/simple-download-principles');
await mkdir(out, { recursive: true });
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1050 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => {
      if (!localStorage.getItem('springhues.home.theme')) localStorage.setItem('springhues.home.theme', 'day');
      sessionStorage.setItem('springhues.home.introSeen', '1');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const platform of ['windows', 'android']) {
      if (platform === 'android') await page.evaluate(() => localStorage.setItem('springhues.home.theme', 'day'));
      await page.goto(`${base}/#work=simple-download-${platform}`, { waitUntil: 'domcontentloaded' });
      const entry = page.locator(`.actions a[href="works/simple-download/?platform=${platform}"]`).first();
      await entry.waitFor({ state: 'visible' });
      await entry.scrollIntoViewIfNeeded();
      await page.waitForTimeout(width === 390 ? 100 : 650);
      assert.equal(await entry.innerText(), '工作原理');
      assert.equal(await entry.getAttribute('target'), null, '站内入口必须在当前标签打开');
      const entryBox = await entry.boundingBox();
      assert.ok(entryBox.height >= 44, '入口触控区域至少 44px');
      await page.screenshot({ path: path.join(out, `${width}-${platform}-entry.png`) });
      await entry.click();
      await page.waitForURL(`**/works/simple-download/?platform=${platform}`);
      await page.locator('#machine').waitFor();
      await page.locator('.sd-top').waitFor();
      await page.waitForFunction(() => window.__ANATOMY__);
      await page.waitForTimeout(width === 390 ? 100 : 850);
      assert.equal(await page.locator(`.platform-btn[data-platform="${platform}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().platform), platform);
      assert.equal(await page.locator('#step-body').innerText(), CONTENT.steps[0][platform].text, '入口首次展示对应平台说明');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'day');
      const back = page.locator('#back-to-intro');
      assert.ok((await back.getAttribute('href')).endsWith(`#work=simple-download-${platform}`));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '页面不得横向溢出');
      assert.deepEqual(await page.locator('main button').evaluateAll(buttons => buttons.filter(button => getComputedStyle(button).borderRadius !== '0px').map(button => button.id || button.className)), [], '控件使用站点直角与切角形状');
      await page.locator('[data-step="2"]').click();
      await page.waitForFunction(() => document.querySelector('#machine').dataset.settled === 'true');
      await page.locator('#machine').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => window.__ANATOMY__.getState().step === 3);
      await page.locator('#detail-toggle').click();
      assert.equal(await page.locator('#detail-toggle').getAttribute('aria-expanded'), 'true');
      await page.locator('#detail-toggle').click();
      await page.locator('#zoom').click();
      assert.equal(await page.locator('#zoom').getAttribute('aria-pressed'), 'true');
      await page.locator('#zoom').click();
      const other = platform === 'windows' ? 'android' : 'windows';
      await page.locator(`.platform-btn[data-platform="${other}"]`).click();
      assert.equal(new URL(page.url()).searchParams.get('platform'), other);
      assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().step), 3, '平台切换保留步骤');
      const skip = page.locator('.sd-skip');
      assert.equal(new URL(await skip.getAttribute('href')).searchParams.get('platform'), other);
      await skip.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().platform), other, '跳到正文保留当前平台');
      assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().step), 3, '跳到正文保留当前步骤');
      await page.locator(`.platform-btn[data-platform="${platform}"]`).click();
      await page.locator('[data-step="2"]').click();
      await page.waitForFunction(() => document.querySelector('#machine').dataset.settled === 'true');
      if (width === 390) {
        assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().reduced), true);
        assert.equal(await page.locator('#play').isDisabled(), true);
      }
      await page.evaluate(() => { document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(out, `${width}-${platform}-page.png`), fullPage: width === 390 });
      await page.getByRole('button', { name: '切换到夜间主题（当前昼间）', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'night');
      await page.waitForTimeout(width === 390 ? 100 : 700);
      assert.equal(await page.evaluate(() => localStorage.getItem('springhues.home.theme')), 'night');
      await page.getByRole('button', { name: '打开菜单', exact: true }).click();
      await page.locator('#sdMenu').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('.wipe')?.getAnimations({ subtree: true }).length);
      await page.keyboard.press('Escape');
      await page.locator('#sdMenu').waitFor({ state: 'hidden' });
      if (platform === 'android') await page.screenshot({ path: path.join(out, `${width}-night.png`), fullPage: width === 390 });
      await back.click();
      await page.waitForURL(`**/#work=simple-download-${platform}`);
      await page.locator(`.actions a[href="works/simple-download/?platform=${platform}"]`).first().waitFor({ state: 'visible' });
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'night', '返回介绍后沿用站点主题');
      results.push({ width, platform, entry: true, initialPlatform: true, keyboard: true, theme: true, menuEscape: true, returnToDetail: true });
    }
    await page.goto(`${base}/works/simple-download/?platform=invalid`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ANATOMY__);
    assert.equal(await page.evaluate(() => window.__ANATOMY__.getState().platform), 'windows');
    assert.deepEqual(errors, [], '页面不得产生未捕获错误');
    await context.close();
  }
  await writeFile(path.join(out, 'verification.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, cases: results.length, results, screenshots: out }));
} finally {
  await browser.close();
}
