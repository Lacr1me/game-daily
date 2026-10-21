// Regenerate the production principle page from the approved Anatomy geometry.
// Build dependencies remain under scripts/ and are not copied into the site.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMachine } from './simple-download-principles/geometry.mjs';
import { CONTENT, SYSTEMS } from './simple-download-principles/content.mjs';
import { SHARD_VERSION } from './check-shard-style.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'scripts/simple-download-principles');
const iconNames = ['arrow-left', 'arrow-right', 'play', 'pause', 'monitor', 'smartphone', 'minus', 'chevron-down', 'link', 'scan-line', 'list-ordered', 'cable', 'sliders-horizontal', 'folder-check', 'plus', 'maximize-2'];
const icons = Object.fromEntries(iconNames.map(name => [name,
  readFileSync(join(source, 'vendor/lucide', name + '.svg'), 'utf8')
    .replace('<svg', '<svg class="sd-ic icon" aria-hidden="true" focusable="false"')
    .replaceAll('stroke-linecap="round"', 'stroke-linecap="square"')
    .replaceAll('stroke-linejoin="round"', 'stroke-linejoin="miter"')
]));
const I = name => icons[name];
const M = makeMachine({ audit: process.argv.includes('--audit') });
const stageIcons = ['link', 'scan-line', 'list-ordered', 'cable', 'sliders-horizontal', 'folder-check'];
const first = CONTENT.steps[0];
const data = JSON.stringify({ CONTENT: { steps: CONTENT.steps }, icons, stageIcons, P: M.P, positions: M.positions, sort: M.sort }).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="zh-CN" class="shard-live" data-theme="day">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <base href="../../">
  <meta name="theme-color" content="#F4F6FF">
  <meta name="description" content="从链接接入到作品归档，交互探索简单下载 Windows 与 Android 的六步工作流程">
  <title>简单下载原理 · Springhues</title>
  <link rel="icon" type="image/png" href="brand-assets/springhues-logo.png">
  <script src="site/boot.js?v=${SHARD_VERSION}"></script>
  <link rel="stylesheet" href="site/css/shard-theme.css?v=${SHARD_VERSION}">
  <link rel="stylesheet" href="site/css/wipe.css?v=${SHARD_VERSION}">
  <link rel="stylesheet" href="site/css/pages-simple-download.css?v=${SHARD_VERSION}">
  <script type="module" src="site/js/shell/shell.js?v=${SHARD_VERSION}"></script>
  <script src="works/simple-download/live.js?v=20261022-principles-1" defer></script>
</head>
<body data-site-page="simple-download" data-sd-title="简单下载原理" data-sd-title-en="HOW IT WORKS" data-platform="windows">
<!-- Geometry: Anatomy, MIT © 2026 Ryan. Icons: Lucide, ISC / MIT.
     Full notices: works/simple-download/licenses/anatomy.txt and licenses/lucide.txt -->
<main id="main" class="sd-page sd-principles" tabindex="-1">
  <header class="principles-intro sd-wrap">
    <div data-sd-reveal="0"><p class="sd-eyebrow">SIMPLE DOWNLOAD</p><h1>一条链接的旅程</h1></div>
    <a id="back-to-intro" class="sd-btn" href="./#work=simple-download-windows" data-sd-reveal="1">${I('arrow-left')}返回介绍</a>
  </header>
  <div class="sd-wrap">
    <section class="principles-demo" aria-label="简单下载交互原理" data-sd-reveal="1">
      <div class="workspace sd-cut-tl-br sd-cut-lg">
        <div class="workspace-bar">
          <div class="section-label"><span class="figure-label" aria-hidden="true">01—06</span><span>下载加工台</span></div>
          <div class="platforms" role="group" aria-label="选择讲解平台">
            <button class="platform-btn sd-chip" type="button" data-platform="windows" aria-pressed="true">${I('monitor')}Windows</button>
            <button class="platform-btn sd-chip" type="button" data-platform="android" aria-pressed="false">${I('smartphone')}Android</button>
          </div>
        </div>
        <div class="machine-layout">
          <div class="drawing-pane">
            <div class="figure-top" aria-hidden="true"><span>RESOURCE PROCESSOR</span></div>
            <div class="iso-plate" id="machine" tabindex="0" role="group" aria-label="下载加工台，左右方向键切换步骤，空格播放或暂停">${M.svg}</div>
            <div class="zoom-tools"><button class="sd-btn icon-btn" type="button" id="zoom" aria-label="放大机械细节" aria-pressed="false">${I('maximize-2')}</button></div>
            <div class="figure-bottom"><span class="figure-hint"><i aria-hidden="true"></i>蓝色托盘代表一份作品</span><span class="readout" data-readout>01 / 06 · 接入</span></div>
          </div>
          <aside class="explanation" aria-label="当前步骤">
            <div class="step-top"><div><span class="step-number" id="step-number">01</span><span class="step-total">/ 06</span></div><span class="step-icon" id="step-icon" aria-hidden="true">${I(stageIcons[0])}</span></div>
            <div class="copy" id="copy">
              <h2 id="step-title">${first.title}</h2><p class="step-lead" id="step-lead">${first.lead}</p><p class="step-body" id="step-body">${first.windows.text}</p>
              <span class="tech-tag" id="step-tag">${first.windows.tag}</span>
              <button class="more-toggle" type="button" id="detail-toggle" aria-expanded="false" aria-controls="step-detail">工作细节 ${I('chevron-down')}</button>
              <div class="reveal" id="step-detail"><div><p class="detail-text" id="detail-text">${first.windows.detail}</p><p class="detail-text" id="mechanism-text">图中 · ${first.mechanism}</p></div></div>
            </div>
            <div class="step-navigation"><button class="sd-btn icon-btn" type="button" id="prev" aria-label="上一步" disabled>${I('arrow-left')}</button><span class="navigation-caption" id="platform-label">Windows</span><button class="sd-btn icon-btn" type="button" id="next" aria-label="下一步">${I('arrow-right')}</button></div>
          </aside>
        </div>
        <div class="stage-nav" role="group" aria-label="选择流程步骤">${CONTENT.steps.map((s, i) => `<button class="stage-btn" type="button" data-step="${i}" aria-label="第 ${i + 1} 步 ${s.short}" ${i === 0 ? 'aria-current="step"' : ''}><span class="num" aria-hidden="true">0${i + 1}</span><span>${s.short}</span>${I(stageIcons[i])}</button>`).join('')}</div>
      </div>
      <div class="transport"><div class="play-controls"><button class="sd-btn sd-btn--blade" type="button" id="play" aria-pressed="true">${I('pause')}<span>暂停演示</span></button><span class="play-state" id="play-state">自动导览</span></div><p class="caption">原理演示 不代表实际下载进度</p></div>
    </section>
    <section class="systems-section" aria-labelledby="systems-title" data-sd-reveal="0">
      <div class="section-heading"><p class="sd-eyebrow" aria-hidden="true">UNDER THE SURFACE</p><h2 class="sd-h2" id="systems-title">两端如何运转</h2></div>
      <div class="systems">${SYSTEMS.map((s, i) => `<article class="system-row"><h3><button class="system-toggle" type="button" aria-expanded="${i === 0}" aria-controls="system-${s.id}" id="toggle-${s.id}"><span class="system-number" aria-hidden="true">0${i + 1}</span><span class="system-title">${s.title}</span><span class="system-summary">${s.kicker}</span>${I('plus')}</button></h3><div class="reveal ${i === 0 ? 'open' : ''}" id="system-${s.id}" aria-labelledby="toggle-${s.id}"><div><div class="system-columns"><article data-system-platform="windows" class="selected"><h4>${I('monitor')} WINDOWS</h4><p>${s.windows}</p></article><article data-system-platform="android"><h4>${I('smartphone')} ANDROID</h4><p>${s.android}</p></article></div></div></div></article>`).join('')}</div>
    </section>
  </div>
  <noscript><p class="sd-note">启用 JavaScript 可探索全部步骤 <a href="./#work=simple-download-windows">返回介绍</a></p></noscript>
</main>
<div id="announcement" class="sd-sr" role="status" aria-live="polite"></div>
<script id="principles-data" type="application/json">${data}</script>
</body>
</html>
`;
writeFileSync(join(root, 'works/simple-download/index.html'), html);
console.log(`Built works/simple-download/index.html (${M.partCount} solids, ${Buffer.byteLength(html)} bytes)`);
