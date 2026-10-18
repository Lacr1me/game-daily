// 场景页入口：渲染循环、季节与天气、拖拽视角、真实统计读取。
import { makeView, readPalette, themeColors } from './view.js';
import { drawScene } from './world.js';
import { loadStats } from './stats.js';

const canvas = document.querySelector('[data-scene-canvas]');
const stage = document.querySelector('[data-scene-stage]');
const chips = Array.from(document.querySelectorAll('[data-season]'));
const fallbackNote = document.querySelector('[data-scene-note]');

if (canvas && stage) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let palette = readPalette(document.documentElement);
  let width = 0;
  let height = 0;
  let dpr = 1;

  const state = {
    theme: document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day',
    season: 'spring',
    t: 0,
    intro: 0,
    yaw: 0,
    targetYaw: 0,
    visitors: [],
    weather: []
  };

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(320, Math.round(rect.width));
    height = Math.max(300, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed(width, height);
  }

  function seed(w, h) {
    const count = w < 560 ? 4 : w < 900 ? 6 : 8;
    state.visitors = Array.from({ length: count }, (_, i) => ({
      x: -4.4 + (8.8 * (i + 0.5)) / count,
      y: 1.4 + (i % 3) * 0.62,
      dir: i % 2 === 0 ? 1 : -1,
      speed: 0.35 + (i % 4) * 0.09,
      phase: i * 1.7,
      scarf: i % 3 === 0
    }));
    const total = Math.round((w * h) / 12000);
    state.weather = Array.from({ length: Math.min(150, Math.max(36, total)) }, () => spawn(true));
  }

  function spawn(initial) {
    const kind = state.season;
    const sizing = kind === 'winter' ? 4 : kind === 'autumn' ? 5 : 3;
    return {
      x: Math.random() * width,
      y: initial ? Math.random() * height : -20,
      vx: kind === 'autumn' ? -0.35 + Math.random() * 0.7 : -0.15 + Math.random() * 0.3,
      vy: kind === 'summer' ? -0.25 - Math.random() * 0.35 : 0.35 + Math.random() * 0.75,
      size: sizing + Math.random() * 3,
      stretch: kind === 'autumn' ? 0.55 : 1,
      alpha: 0.25 + Math.random() * 0.5,
      sway: Math.random() * 6.28,
      color: kind === 'autumn' && Math.random() < 0.5 ? 'blade' : 'white'
    };
  }

  function resetWeather() {
    state.weather = state.weather.map(() => spawn(true));
  }

  let view = makeView(width, height, 0);

  function render() {
    const colors = themeColors(palette, state.theme, state.season);
    view = makeView(width, height, state.yaw);
    drawScene(ctx, view, colors, state, width, height);
  }

  function step(dt) {
    state.t += dt;
    state.intro = Math.min(1, state.intro + dt / 1.1);
    state.yaw += (state.targetYaw - state.yaw) * Math.min(1, dt * 8);

    for (const person of state.visitors) {
      person.x += person.dir * person.speed * dt;
      person.phase += dt * 6;
      if (person.x > 4.7) person.x = -4.7;
      if (person.x < -4.7) person.x = 4.7;
    }

    for (let i = 0; i < state.weather.length; i += 1) {
      const p = state.weather[i];
      p.sway += dt * 1.6;
      p.x += (p.vx + Math.sin(p.sway) * 0.35) * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.y > height + 12 || p.y < -24 || p.x < -24 || p.x > width + 24) {
        state.weather[i] = spawn(false);
      }
    }
  }

  let last = 0;
  let raf = 0;
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
    if (raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setSeason(next) {
    if (next === state.season) return;
    state.season = next;
    resetWeather();
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.season === next));
    }
    if (reduced.matches) render();
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => setSeason(chip.dataset.season));
  }

  // 拖拽微调视角，松手后回正
  let dragging = false;
  let dragStart = 0;
  let dragYaw = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragStart = event.clientX;
    dragYaw = state.targetYaw;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const delta = (event.clientX - dragStart) / Math.max(240, width);
    state.targetYaw = Math.max(-0.32, Math.min(0.32, dragYaw + delta * 1.1));
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    state.targetYaw = 0;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    endDrag();
    state.hover = false;
  });

  // 主题跟随外壳切换
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
      render();
    } else {
      start();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible && !reduced.matches) start();
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !reduced.matches) start();
      else stop();
    }, { threshold: 0.05 });
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
    render();
  } else {
    start();
  }

  loadStats().then((result) => {
    if (!fallbackNote) return;
    if (result.counter && result.live) {
      fallbackNote.textContent = '访问数据来自 GoatCounter，实时读取，匿名统计，不使用 Cookie。';
    } else if (result.counter) {
      const at = result.snapshotAt ? new Date(result.snapshotAt) : null;
      const stamp = at && !Number.isNaN(at.getTime())
        ? ' 统计更新于 ' + at.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '。'
        : '';
      fallbackNote.textContent = '访问数据来自 GoatCounter，匿名统计，不使用 Cookie。' + stamp;
    } else {
      fallbackNote.textContent = '访问统计暂未接通，数字暂不显示。';
    }
  });
}
