// 自定义光标：三色碎片（蓝主体 + 白边 + 红刃尖）。仅 full 档 + 精细指针；输入框恢复原生；创建失败不隐藏原生光标。
import { subscribe } from '../core/ticker.js';
import { h } from '../core/dom.js';

const LABELS = { open: 'OPEN', play: 'PLAY', download: 'DOWNLOAD', skip: 'SKIP' };

export function initCursor() {
  let el;
  try {
    el = h('div', { class: 'cursor', 'aria-hidden': 'true' }, h('i', { class: 'c-white' }), h('i', { class: 'c-blue' }), h('i', { class: 'c-red' }), h('i', { class: 'c-label' }, 'OPEN'));
    document.body.appendChild(el);
  } catch (e) { console.warn('[cursor] 创建失败，保留原生光标', e); return; }
  const label = el.querySelector('.c-label');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, seen = false;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; x = tx; y = ty; document.documentElement.classList.add('has-cursor'); }
    const t = e.target;
    const typing = t.closest && t.closest('input, textarea, [contenteditable="true"]');
    document.documentElement.classList.toggle('native-cursor', !!typing);
    const hot = t.closest && t.closest('[data-cursor]');
    el.classList.toggle('is-hot', !!hot && !typing);
    if (hot) label.textContent = LABELS[hot.dataset.cursor] || 'OPEN';
  }, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => document.documentElement.classList.remove('has-cursor'));
  document.addEventListener('pointerenter', () => { if (seen) document.documentElement.classList.add('has-cursor'); });
  subscribe(() => {
    x += (tx - x) * 0.38; y += (ty - y) * 0.38;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
}
