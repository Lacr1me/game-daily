// 「切片小店」场景绘制：等轴测方块，无圆角、无外部资源。
import { poly, line, box, faceRect } from './view.js';

const GROUND = 4.8;
const STREET_Y0 = 0.8;
const STREET_Y1 = 3.2;

const SHOP = { x0: -2.4, y0: -3.8, x1: 1.6, y1: -1.0, h: 2.4 };

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function itemDepth(view, x, y) {
  return view.depth(x, y);
}

function groundDiamond(view) {
  return [
    view.p(-GROUND, -GROUND, 0),
    view.p(GROUND, -GROUND, 0),
    view.p(GROUND, GROUND, 0),
    view.p(-GROUND, GROUND, 0)
  ];
}

function drawGround(ctx, view, c) {
  const diamond = groundDiamond(view);
  poly(ctx, diamond, c.ground);
  ctx.save();
  ctx.globalAlpha = 0.7;
  line(ctx, [...diamond, diamond[0]], c.groundAlt, 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = -4; i <= 4; i += 1) {
    line(ctx, [view.p(i, -GROUND, 0.01), view.p(i, GROUND, 0.01)], c.groundAlt, 1);
    line(ctx, [view.p(-GROUND, i, 0.01), view.p(GROUND, i, 0.01)], c.groundAlt, 1);
  }
  ctx.restore();

  const sx = GROUND - 0.55;
  poly(ctx, [
    view.p(-sx, STREET_Y0, 0.02),
    view.p(sx, STREET_Y0, 0.02),
    view.p(sx, STREET_Y1, 0.02),
    view.p(-sx, STREET_Y1, 0.02)
  ], c.street);

  ctx.save();
  ctx.globalAlpha = 0.85;
  line(ctx, [view.p(-sx, STREET_Y0, 0.03), view.p(sx, STREET_Y0, 0.03)], c.blade, 2);
  ctx.restore();
}

function drawShadow(ctx, view, x0, y0, x1, y1, c, dx = 0.5, dy = 0.6) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  poly(ctx, [
    view.p(x0 + dx, y0 + dx, 0.01),
    view.p(x1 + dx, y0 + dx, 0.01),
    view.p(x1 + dx, y1 + dy, 0.01),
    view.p(x0 + dx, y1 + dy, 0.01)
  ], c.groundAlt);
  ctx.restore();
}

function drawShop(ctx, view, c, state) {
  const { x0, y0, x1, y1, h } = SHOP;
  drawShadow(ctx, view, x0, y0, x1, y1, c, 0.5, 0.9);

  box(ctx, view, x0, y0, 0, x1, y1, h, { front: c.wallB, side: c.wallA, top: c.roof });

  // 屋檐：白顶在白底上要靠描边才看得出轮廓
  const rx0 = x0 - 0.16, ry0 = y0 - 0.14, rx1 = x1 + 0.16, ry1 = y1 + 0.14, rz = h + 0.1;
  box(ctx, view, rx0, ry0, h, rx1, ry1, rz,
    { front: c.roof, side: c.roof, top: c.roof });
  line(ctx, [
    view.p(rx0, ry0, rz), view.p(rx1, ry0, rz),
    view.p(rx1, ry1, rz), view.p(rx0, ry1, rz), view.p(rx0, ry0, rz)
  ], c.trim, 1.4);
  line(ctx, [
    view.p(rx0, ry1, rz), view.p(rx1, ry1, rz)
  ], c.trim, 2);

  // 遮阳篷：水平硬边板，红刃收边
  box(ctx, view, x0 - 0.12, y1, 1.48, x1 + 0.12, y1 + 0.82, 1.6,
    { front: c.awning, side: c.awning, top: c.roof });
  line(ctx, [
    view.p(x0 - 0.12, y1 + 0.82, 1.48),
    view.p(x1 + 0.12, y1 + 0.82, 1.48)
  ], c.blade, 3);

  // 门
  faceRect(ctx, view, 'y', y1, -0.35, 0.45, 0, 1.12, c.blade);
  faceRect(ctx, view, 'y', y1, -0.35, 0.45, 1.02, 1.12, c.roof);

  // 侧窗：夜里发光
  const lit = state.theme === 'night';
  for (const [a, b] of [[-3.18, -2.52], [-2.08, -1.42]]) {
    faceRect(ctx, view, 'x', x1, a - 0.06, b + 0.06, 1.12, 1.86, c.trim);
    faceRect(ctx, view, 'x', x1, a, b, 1.2, 1.78, c.glass);
    if (lit) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      faceRect(ctx, view, 'x', x1, a - 0.22, b + 0.22, 0.92, 2.05, c.light);
      ctx.restore();
    }
  }

  // 招牌：白色板 + 红刃
  box(ctx, view, x0 + 0.2, y1 - 0.06, 1.68, x1 - 0.2, y1 + 0.06, 2.12,
    { front: c.roof, side: c.roof, top: c.roof });
  faceRect(ctx, view, 'y', y1 + 0.06, x0 + 0.45, x0 + 0.95, 1.78, 2.02, c.blade);
}

function drawTree(ctx, view, c, state) {
  const tx = 4.0;
  const ty = -3.1;
  const winter = state.season === 'winter';
  drawShadow(ctx, view, tx - 0.5, ty - 0.5, tx + 0.5, ty + 0.5, c, 0.25, 0.3);
  box(ctx, view, tx - 0.15, ty - 0.15, 0, tx + 0.15, ty + 0.15, 1.05,
    { front: c.trunk, side: c.trunk, top: c.trunk });

  const blocks = winter
    ? [[-0.92, 0.22, 1.0, 1.52], [-0.62, 0.48, 1.46, 1.9]]
    : [
        [-1.1, 0.2, 0.95, 1.52],
        [-0.82, 0.48, 1.46, 1.96],
        [-0.98, 0.32, 1.9, 2.16]
      ];
  for (const [a, b, z0, z1] of blocks) {
    box(ctx, view, tx + a, ty + a, z0, tx + b, ty + b, z1,
      { front: c.foliageFront, side: c.foliageSide, top: c.foliageFront });
  }

  if (state.season === 'spring') {
    const dots = [[-1.06, 0.16, 2.16], [-0.76, 0.46, 2.16], [-0.5, 0.18, 1.96]];
    for (const [a, b, z] of dots) {
      box(ctx, view, tx + a, ty + b, z, tx + a + 0.2, ty + b + 0.2, z + 0.1,
        { front: c.roof, side: c.roof, top: c.roof });
    }
  }
  if (state.season === 'autumn') {
    const leaves = [[-1.02, 0.24, 1.52], [-0.5, 0.56, 1.96], [-0.72, 0.1, 1.44]];
    for (const [a, b, z] of leaves) {
      box(ctx, view, tx + a, ty + b, z, tx + a + 0.22, ty + b + 0.22, z + 0.12,
        { front: c.blade, side: c.blade, top: c.blade });
    }
  }
  if (state.season === 'winter') {
    const capZ = 1.9;
    box(ctx, view, tx - 0.84, ty + 0.44, capZ, tx - 0.14, ty + 0.76, capZ + 0.08,
      { front: c.roof, side: c.roof, top: c.roof });
  }
}

function drawLamp(ctx, view, c, state, x, y) {
  box(ctx, view, x - 0.06, y - 0.06, 0, x + 0.06, y + 0.06, 1.5,
    { front: c.trim, side: c.trim, top: c.trim });
  const head = view.p(x, y, 1.62);
  const size = 0.16 * view.scale;
  if (state.theme === 'night') {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = c.light;
    ctx.fillRect(head.x - size * 3, head.y - size * 3, size * 6, size * 6);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(head.x - size * 2, head.y - size * 2, size * 4, size * 4);
    ctx.restore();
  }
  ctx.fillStyle = c.light;
  ctx.fillRect(head.x - size / 2, head.y - size / 2, size, size);
}

function drawVisitor(ctx, view, c, person) {
  const x = person.x;
  const y = person.y;
  const bob = Math.sin(person.phase) * 0.035;
  const body = 0.44;
  const wide = 0.16;
  ctx.save();
  ctx.globalAlpha = 0.16;
  poly(ctx, [
    view.p(x - 0.24, y - 0.24, 0.01),
    view.p(x + 0.24, y - 0.24, 0.01),
    view.p(x + 0.24, y + 0.24, 0.01),
    view.p(x - 0.24, y + 0.24, 0.01)
  ], c.groundAlt);
  ctx.restore();
  box(ctx, view, x - wide, y - wide, bob, x + wide, y + wide, body + bob,
    { front: c.wallB, side: c.trunk, top: c.wallB });
  box(ctx, view, x - 0.12, y - 0.12, body + bob, x + 0.12, y + 0.12, body + 0.26 + bob,
    { front: c.roof, side: c.roof, top: c.roof });
  if (person.scarf) {
    box(ctx, view, x - wide, y - wide, body + bob - 0.11, x + wide, y + wide, body + bob - 0.02,
      { front: c.blade, side: c.blade, top: c.blade });
  }
}

function drawCrates(ctx, view, c, state) {
  drawShadow(ctx, view, 1.85, -1.66, 2.6, -1.0, c, 0.2, 0.25);
  box(ctx, view, 1.92, -1.62, 0, 2.44, -1.12, 0.34,
    { front: c.roof, side: c.dim, top: c.roof });
  box(ctx, view, 1.98, -1.56, 0.34, 2.38, -1.18, 0.64,
    { front: c.roof, side: c.dim, top: c.roof });
  if (state.season === 'winter') {
    ctx.save();
    ctx.globalAlpha = 0.9;
    box(ctx, view, 1.94, -1.6, 0.64, 2.42, -1.14, 0.7,
      { front: c.roof, side: c.roof, top: c.roof });
    ctx.restore();
  }
}

function drawRows(ctx, view, c, state) {
  const items = [];
  items.push({ d: itemDepth(view, (SHOP.x0 + SHOP.x1) / 2, (SHOP.y0 + SHOP.y1) / 2), delay: 0.0, draw: () => drawShop(ctx, view, c, state) });
  items.push({ d: itemDepth(view, 4.0, -3.1), delay: 0.16, draw: () => drawTree(ctx, view, c, state) });
  items.push({ d: itemDepth(view, 2.2, -1.3), delay: 0.22, draw: () => drawCrates(ctx, view, c, state) });
  items.push({ d: itemDepth(view, -4.1, 1.6), delay: 0.26, draw: () => drawLamp(ctx, view, c, state, -4.1, 1.6) });
  items.push({ d: itemDepth(view, 3.9, 1.1), delay: 0.32, draw: () => drawLamp(ctx, view, c, state, 3.9, 1.1) });
  for (const person of state.visitors) {
    items.push({ d: itemDepth(view, person.x, person.y), delay: 0.4, draw: () => drawVisitor(ctx, view, c, person) });
  }
  items.sort((a, b) => a.d - b.d);
  for (const item of items) {
    const k = clamp01((state.intro - item.delay) / (1 - item.delay || 1));
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 34);
    item.draw();
    ctx.restore();
  }
}

function drawWeather(ctx, view, c, state, width, height) {
  const list = state.weather;
  if (!list || !list.length) return;
  ctx.save();
  for (const p of list) {
    ctx.globalAlpha = p.alpha * (state.theme === 'night' ? 0.9 : 0.75);
    ctx.fillStyle = p.color === 'blade' ? c.blade : c.roof;
    ctx.fillRect(p.x, p.y, p.size, p.size * p.stretch);
  }
  ctx.restore();
}

export function drawScene(ctx, view, colors, state, width, height) {
  ctx.clearRect(0, 0, width, height);
  drawGround(ctx, view, colors);
  drawRows(ctx, view, colors, state);
  drawWeather(ctx, view, colors, state, width, height);
}

