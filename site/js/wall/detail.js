// 详情与共享元素转场：原生 FLIP（WAAPI）→ View Transitions → 直接显示。
// 路由：打开 pushState('#work=slug')；关闭用 history.back()（本页压入）或 replaceState（深链直入）。
import { app } from '../core/app.js';
import { h } from '../core/dom.js';
import { getTier } from '../core/tier.js';
import { canAnimateRects, playRectMorph, rectOf } from '../core/flip.js';
import { openLayer } from '../core/focus.js';
import { parseHash } from '../core/url.js';
import { toast } from '../ui/toast.js';

let cards = [];
let current = null; // { card, slug, hit, release, pushed, prevCat, trigger }
let busy = false;

const $ = id => document.getElementById(id);
const reduced = () => getTier() === 'calm';

function cleanHash(prevCat) {
  const url = location.pathname + location.search + (prevCat && prevCat !== 'all' ? '#cat=' + prevCat : '');
  history.replaceState(null, '', url);
}

function linkEl(link, work) {
  if (link.href === '#') {
    return h('a', { href: '#', 'aria-disabled': 'true', 'data-kind': link.kind, 'data-placeholder': '' }, link.label);
  }
  const external = /^https:/i.test(link.href);
  return h('a', { href: link.href, 'data-kind': link.kind, target: external ? '_blank' : null, rel: external ? 'noopener noreferrer' : null }, link.label);
}

function buildBody(card, skipLinks) {
  const { work, category } = card;
  const kids = [];
  kids.push(h('div', { class: 'detail-kicker' }, h('span', {}, category.en), work.isNew ? h('span', { class: 'tag', style: 'position:static' }, 'NEW') : null));
  const title = h('h2', { id: 'detailTitle', tabindex: '-1' }, work.name);
  kids.push(title);
  kids.push(h('p', {}, work.intro));
  if (work.tags.length) kids.push(h('div', { class: 'chips' }, ...work.tags.map(t => h('span', {}, t))));
  const meta = [];
  meta.push(h('div', {}, h('dt', {}, '分类'), h('dd', {}, category.name)));
  if (work.platform) meta.push(h('div', {}, h('dt', {}, '平台'), h('dd', {}, work.platform)));
  if (work.version) meta.push(h('div', {}, h('dt', {}, '版本'), h('dd', {}, work.version)));
  if (work.updatedAt) meta.push(h('div', {}, h('dt', {}, '更新'), h('dd', {}, h('time', { datetime: work.updatedAt }, work.updatedAt))));
  kids.push(h('dl', { class: 'meta' }, ...meta));
  if (work.shots.length) {
    kids.push(h('div', { class: 'shots', 'aria-label': '截图' }, ...work.shots.map(s => h('figure', { style: '--r:' + s.ratio },
      s.src ? h('img', { src: s.src, alt: s.label, loading: 'lazy' }) : h('span', {}, s.label)))));
  }
  if (!skipLinks && work.links.length) {
    const acts = [];
    if (work.source) acts.push(h('a', { href: work.source.base, 'data-latest': work.source.base === 'minsheng/' ? 'minsheng' : 'game' }, '阅读最新一期'));
    work.links.forEach(l => acts.push(linkEl(l, work)));
    kids.push(h('div', { class: 'actions' }, ...acts));
  }
  return { nodes: kids, title };
}

function stageWrap(card) {
  return h('div', { class: 'detail-card', 'data-carrier': card.root.dataset.carrier });
}

function moveIn(card, wrap) {
  const { face, hit } = card;
  if (hit.parentNode === face) hit.remove();
  wrap.appendChild(face);
  face.style.setProperty('--press', '1');
}
function moveOut(card) {
  const { face, hit, root } = card;
  root.appendChild(face);
  face.appendChild(hit); // hit 回到 face 末尾；z-index 保证 .card-link 在其上
}

function fadeChildren(el) {
  if (reduced() || !el.animate) return;
  [...el.children].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 280 + i * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
}

export async function openWork(slug, opts = {}) {
  const { fromHistory = false, deep = false, trigger = null } = opts;
  if (busy) return;
  const card = cards.find(c => c.work.slug === slug);
  if (!card) { toast('没有找到这个作品'); cleanHash(app.category); return; }
  if (current) {
    if (current.slug === slug) return;
    await closeWork({ fromHistory: true, immediate: true });
  }
  busy = true;
  const detail = $('detail'), panel = $('detailPanel'), stage = $('detailStage'), body = $('detailBody');
  const prevCat = app.category;
  const pageCarrier = card.root.dataset.carrier === 'page' && !!card.face.querySelector('.card-link');
  const { nodes, title } = buildBody(card, pageCarrier);
  body.replaceChildren(...nodes);
  const wrap = stageWrap(card);
  stage.replaceChildren(wrap);
  detail.hidden = false;
  document.documentElement.classList.add('detail-open');
  current = { card, slug, prevCat, pushed: false, trigger: trigger || card.hit, release: null };
  if (!fromHistory && !deep) { history.pushState({ work: slug, prevCat }, '', '#work=' + slug); current.pushed = true; }
  const animate = !deep && !fromHistory && !reduced();
  try {
    if (animate && canAnimateRects()) {
      panel.style.transition = 'opacity .3s linear'; panel.style.transform = 'none';
      const first = rectOf(card.face);
      moveIn(card, wrap);
      detail.classList.add('is-open');
      const last = rectOf(card.face);
      await playRectMorph(card.face, first, last, { duration: 750, ease: 'power3InOut', scale: true }).finished;
      fadeChildren(body);
    } else if (animate && document.startViewTransition) {
      card.face.style.viewTransitionName = 'work-face';
      const vt = document.startViewTransition(() => { moveIn(card, wrap); detail.classList.add('is-open'); });
      try { await vt.finished; } catch { /* 转场被打断，状态已更新 */ }
      card.face.style.viewTransitionName = '';
      fadeChildren(body);
    } else {
      moveIn(card, wrap);
      detail.classList.add('is-open');
    }
  } catch (e) {
    console.error('[detail] 转场失败，直接显示', e);
    if (card.face.parentNode !== wrap) moveIn(card, wrap);
    detail.classList.add('is-open');
  } finally {
    panel.style.transition = ''; panel.style.transform = '';
    busy = false;
  }
  if (!current || current.slug !== slug) return;
  current.release = openLayer({ el: detail, trigger: current.trigger, initialFocus: title, onEscape: () => requestClose() });
  app.archive && app.archive.applyLinks(document);
}

// 用户发起的关闭：本页压入过历史则 back()，由 popstate 驱动真正的关闭
export function requestClose() {
  if (!current || busy) return;
  if (current.pushed && history.state && history.state.work === current.slug) history.back();
  else closeWork({ fromHistory: false });
}

export async function closeWork({ fromHistory = false, immediate = false } = {}) {
  if (!current || busy) return;
  busy = true;
  const cur = current;
  const detail = $('detail'), stage = $('detailStage');
  const { card } = cur;
  const animate = !immediate && !reduced() && !!card.root.isConnected;
  detail.classList.remove('is-open');
  card.root.style.zIndex = '80';
  try {
    if (animate && canAnimateRects()) {
      const first = rectOf(card.face);
      moveOut(card);
      const last = rectOf(card.face);
      await playRectMorph(card.face, first, last, { duration: 600, ease: 'power3InOut', scale: true }).finished;
    } else if (animate && document.startViewTransition) {
      card.face.style.viewTransitionName = 'work-face';
      const vt = document.startViewTransition(() => moveOut(card));
      try { await vt.finished; } catch { /* 忽略 */ }
      card.face.style.viewTransitionName = '';
    } else {
      moveOut(card);
      if (!immediate && !reduced()) await new Promise(r => setTimeout(r, 120));
    }
  } catch (e) {
    console.error('[detail] 关闭转场失败', e);
    if (card.face.parentNode !== card.root) moveOut(card);
  } finally {
    card.root.style.zIndex = '';
    detail.hidden = true;
    stage.replaceChildren();
    document.documentElement.classList.remove('detail-open');
    current = null;
    busy = false;
  }
  cur.release && cur.release({ restore: !immediate });
  // 地址栏：不是本页压入的（深链直入）用 replaceState 恢复到打开前的筛选
  if (!fromHistory) cleanHash(cur.prevCat);
}

function onPopState() {
  const { work, cat } = parseHash(location.hash);
  if (work) {
    if (!current || current.slug !== work) openWork(work, { fromHistory: true });
  } else {
    if (current) closeWork({ fromHistory: true });
    if (app.setCategory) app.setCategory(cat || 'all', { silent: true, immediate: true });
  }
}

export function initDetail(cardList) {
  cards = cardList;
  app.openWork = openWork;
  $('detailClose').addEventListener('click', requestClose);
  $('detail').querySelector('[data-detail-close]').addEventListener('click', requestClose);
  // 作品卡的 .card-hit 点击：拦截默认的 hash 跳转，走 pushState
  $('worksWall').addEventListener('click', e => {
    const hit = e.target.closest && e.target.closest('a.card-hit');
    if (!hit || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openWork(hit.dataset.slug, { trigger: hit });
  });
  // 占位链接：不跳顶部、不改 hash
  $('detail').addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-placeholder]');
    if (!a) return;
    e.preventDefault();
    toast('占位链接，暂未提供');
  });
  window.addEventListener('popstate', onPopState);
}
export function isDetailOpen() { return !!current; }
