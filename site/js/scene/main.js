// 场景页：整屏悬浮岛、镜头推入、剖开小店、季节扫过切换、实时数字。
import { makeView, readPalette, themeColors, alpha } from './view.js';
import { drawScene } from './world.js';
import { loadStats } from './stats.js';

const stage = document.querySelector('[data-scene-stage]');
const canvas = document.querySelector('[data-scene-canvas]');
const chips = Array.from(document.querySelectorAll('[data-season]'));
const cutButton = document.querySelector('[data-cut-toggle]');
const seasonLabel = document.querySelector('[data-season-label]');
const note = document.querySelector('[data-scene-note]');

if (stage && canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let palette = readPalette(document.documentElement);
  let width = 0;
  let height = 0;

  const SEASON_NAME = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

  const state = {
    theme: document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day',
    season: 'spring',
    t: 0,
    intro: 0,
    cut: 0,
    cutTarget: 0,
    yaw: 0,
    parallax: 0,
    parallaxTarget: 0,
    drag: 0,
    dragTarget: 0,
    wipe: 1,
    wipeSeason: 'spring',
    visitors: [],
    weather: [],
    shards: [],
    stars: []
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function seed() {
    const count = width < 560 ? 4 : width < 980 ? 6 : 8;
    state.visitors = Array.from({ length: count }, (_, i) => ({
      x: rand(-4.3, 4.3),
      y: rand(1.5, 3.2),
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: rand(0.32, 0.62),
      phase: rand(0, 6.28),
      scarf: i % 3 === 0
    }));

    state.shards = Array.from({ length: 9 }, (_, i) => ({
      x: rand(-9, 9),
      y: rand(-9, 3),
      z: rand(-2.6, 2.4),
      size: rand(0.5, 1.5),
      phase: rand(0, 6.28),
      alpha: rand(0.32, 0.9),
      blade: i === 3
    }));

    state.stars = Array.from({ length: 46 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.62,
      size: Math.random() < 0.2 ? 3 : 2,
      phase: rand(0, 6.28),
      speed: rand(0.6, 1.8)
    }));

    reseedWeather();
  }

  function spawnParticle() {
    const depth = Math.random();
    const kind = state.season;
    const size = (kind === 'winter' ? 3.4 : kind === 'autumn' ? 4.4 : 2.6) * (0.5 + depth * 1.6);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (kind === 'autumn' ? -0.35 : -0.12) + Math.random() * 0.45,
      vy: kind === 'summer' ? -(0.25 + depth * 0.5) : 0.3 + depth * 1.1,
      size,
      stretch: kind === 'autumn' ? 0.5 : 1,
      alpha: 0.2 + depth * 0.5,
      depth,
      depthScale: 1,
      sway: rand(0, 6.28),
      blade: kind === 'autumn' && Math.random() < 0.55
    };
  }

  function reseedWeather() {
    const total = Math.round((width * height) / 14000);
    const count = Math.min(170, Math.max(40, total));
    state.weather = Array.from({ length: count }, spawnParticle);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(320, Math.round(rect.width));
    height = Math.max(320, Math.round(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.visitors.length) seed();
    else state.stars = state.stars.map((s) => ({ ...s, x: Math.min(width, s.x), y: Math.min(height * 0.62, s.y) }));
  }

  function viewFor() {
    const intro = 1 - Math.pow(1 - Math.min(1, state.intro), 3);
    const zoom = 0.84 + 0.16 * intro;
    const drop = (1 - intro) * 46 + Math.sin(state.t * 0.5) * 2;
    const yaw = state.yaw + Math.sin(state.t * 0.16) * 0.035 + state.parallax * 0.06 + state.drag;
    return makeView(width, height, yaw, zoom, drop);
  }

  function step(dt) {
    state.t += dt;
    state.intro = Math.min(1, state.intro + dt / 1.35);
    state.cut += (state.cutTarget - state.cut) * Math.min(1, dt * 4);
    state.parallax += (state.parallaxTarget - state.parallax) * Math.min(1, dt * 3);
    state.drag += (state.dragTarget - state.drag) * Math.min(1, dt * 6);
    if (state.wipe < 1) state.wipe = Math.min(1, state.wipe + dt / 0.55);

    for (const p of state.visitors) {
      p.x += p.dir * p.speed * dt;
      p.phase += dt * 5.2;
      if (p.x > 4.4) p.x = -4.4;
      if (p.x < -4.4) p.x = 4.4;
    }

    for (let i = 0; i < state.weather.length; i += 1) {
      const p = state.weather[i];
      p.sway += dt * 1.4;
      p.x += (p.vx + Math.sin(p.sway) * 0.4) * dt * 60 * (0.4 + p.depth);
      p.y += p.vy * dt * 60 * (0.4 + p.depth);
      if (p.y > height + 14 || p.y < -26 || p.x < -30 || p.x > width + 30) {
        state.weather[i] = spawnParticle();
        state.weather[i].y = p.vy < 0 ? height + 10 : -10;
        state.weather[i].x = Math.random() * width;
      }
    }
  }

  function render() {
    const colors = themeColors(palette, state.theme, state.season);
    const view = viewFor();
    drawScene(ctx, view, colors, state, width, height);
    if (state.wipe < 1) drawWipe(colors);
  }

  function drawWipe(colors) {
    const p = state.wipe;
    const x = -0.55 * width + p * 2.1 * width;
    const slant = height * 0.32;
    const bands = [
      { offset: 0, w: width * 0.16, color: colors.blade },
      { offset: width * 0.07, w: width * 0.24, color: alpha(colors.wallSide, 0.9) },
      { offset: width * 0.17, w: width * 0.34, color: colors.roof }
    ];
    for (const band of bands) {
      const left = x + band.offset;
      ctx.beginPath();
      ctx.moveTo(left, 0);
      ctx.lineTo(left + band.w, 0);
      ctx.lineTo(left + band.w - slant, height);
      ctx.lineTo(left - slant, height);
      ctx.closePath();
      ctx.fillStyle = band.color;
      ctx.fill();
    }
  }

  let raf = 0;
  let last = 0;
  let visible = true;

  function frame(now) {
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    render();
    if (visible && !reduced.matches) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function start() {
    if (raf || reduced.matches) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setSeason(next, instant = false) {
    if (next === state.season || !SEASON_NAME[next]) return;
    state.wipeSeason = next;
    if (instant || reduced.matches) {
      state.season = next;
      reseedWeather();
      state.wipe = 1;
      render();
    } else {
      state.season = next;
      state.wipe = 0;
      reseedWeather();
    }
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.season === next));
    }
    if (seasonLabel) seasonLabel.textContent = SEASON_NAME[next];
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => setSeason(chip.dataset.season));
  }

  function setCut(next) {
    state.cutTarget = next ? 1 : 0;
    if (cutButton) {
      cutButton.setAttribute('aria-pressed', String(Boolean(next)));
      const label = cutButton.querySelector('[data-cut-label]');
      if (label) label.textContent = next ? '合上小店' : '剖开小店';
    }
    if (reduced.matches) {
      state.cut = state.cutTarget;
      render();
    }
  }

  if (cutButton) cutButton.addEventListener('click', () => setCut(state.cutTarget < 0.5));

  // 拖动微调视角；轻点剖面开合
  let pointerDown = false;
  let startX = 0;
  let startY = 0;
  let moved = 0;

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    moved = 0;
    startX = event.clientX;
    startY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.parallaxTarget = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    if (!pointerDown) return;
    const dx = event.clientX - startX;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(event.clientY - startY));
    state.dragTarget = Math.max(-0.55, Math.min(0.55, (dx / Math.max(240, width)) * 1.4));
  });

  function release(event) {
    if (!pointerDown) return;
    pointerDown = false;
    if (moved < 8) setCut(state.cutTarget < 0.5);
    state.dragTarget = 0;
    if (event && event.pointerId !== undefined && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    if (pointerDown) return;
    state.parallaxTarget = 0;
    state.dragTarget = 0;
  });

  const themeObserver = new MutationObserver(() => {
    const next = document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day';
    if (next === state.theme) return;
    state.theme = next;
    palette = readPalette(document.documentElement);
    if (reduced.matches) render();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reduced.addEventListener('change', () => {
    if (reduced.matches) {
      stop();
      state.intro = 1;
      state.wipe = 1;
      render();
    } else {
      start();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0.02 });
    io.observe(stage);
  }

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced.matches) render();
    });
    ro.observe(stage);
  }

  resize();
  render();
  if (reduced.matches) {
    state.intro = 1;
    state.wipe = 1;
    render();
  } else {
    start();
  }

  loadStats().then((result) => {
    if (!note) return;
    if (result.counter && result.live) {
      note.textContent = '数据实时读取，匿名统计，不使用 Cookie。';
    } else if (result.counter) {
      const at = result.snapshotAt ? new Date(result.snapshotAt) : null;
      const stamp = at && !Number.isNaN(at.getTime())
        ? ' 快照更新于 ' + at.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '。'
        : '';
      note.textContent = '匿名统计，不使用 Cookie。' + stamp;
    } else {
      note.textContent = '访问统计暂未接通，数字暂不显示。';
    }
  });
}
