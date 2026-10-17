// 窗口载体（常用于桌面软件）：横向窗口。标题栏带窗口名与三个装饰按钮（aria-hidden 的 span，不是 button）。
import { shell } from './common.js';

export default {
  type: 'window',
  shapes: { s: [5, 4], m: [6, 4], l: [7, 5] },
  create(work, category, ctx) {
    const { h } = ctx;
    return shell(h, 'window', work, category, ctx, [
      h('div', { class: 'win-bar', 'aria-hidden': 'true' },
        h('span', { class: 'win-title' }, work.name + '.exe'),
        h('span', { class: 'win-btns' }, h('span', {}), h('span', {}), h('span', {}))),
      h('div', { class: 'win-body' },
        h('div', { class: 'win-side', 'aria-hidden': 'true' }, h('i', {}), h('i', {}), h('i', {}), h('i', {})),
        h('div', { class: 'win-main' },
          h('h3', {}, work.name),
          h('p', {}, work.intro),
          work.version ? h('span', { class: 'win-ver' }, work.version) : null))
    ]);
  }
};
