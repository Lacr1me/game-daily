// 手机载体（常用于 Android 软件）：竖屏手机。斜切机身 + 刘海缺口，屏幕默认暗，hover / focus 时点亮。
import { shell, pad2 } from './common.js';

export default {
  type: 'phone',
  shapes: { s: [3, 6], m: [3, 7], l: [4, 8] },
  create(work, category, ctx) {
    const { h } = ctx;
    return shell(h, 'phone', work, category, ctx, [
      h('i', { class: 'ph-notch', 'aria-hidden': 'true' }),
      h('div', { class: 'ph-screen', 'aria-hidden': 'true' },
        h('div', { class: 'ph-ui' }, h('i', {}), h('i', {}), h('i', {}), h('i', {}), h('div', { class: 'ph-grid' }, h('b', {}), h('b', {}), h('b', {}), h('b', {}))),
        h('span', { class: 'ph-no' }, pad2(ctx.index || 0))),
      h('div', { class: 'ph-meta' },
        h('h3', {}, work.name),
        h('p', {}, (work.platform || category.en) + (work.version ? ' · ' + work.version : '')))
    ]);
  }
};
