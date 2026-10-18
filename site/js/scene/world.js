// 「切片小店」世界：一块悬浮的切口地块，一间可剖开的小店。
import { poly, line, box, faceRect, groundQuad, mix } from './view.js';

const SLAB = 4.9;
const SLAB_DEPTH = 0.8;
const STREET_Y0 = 1.0;
const STREET_Y1 = 3.6;
const SHOP = { x0: -2.4, y0: -3.5, x1: 1.2, y1: -1.0, h: 2.3 };
const WALL = 0.13;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v) => 1 - Math.pow(1 - clamp01(v), 3);

function item(x, y, delay, draw) {
  return { x, y, delay, draw };
}

function drawFloatShadow(ctx, view, c) {
  if (c.night) return;
  const diamond = [
    view.p(-SLAB, -SLAB, 0), view.p(SLAB, -SLAB, 0),
    view.p(SLAB, SLAB, 0), view.p(-SLAB, SLAB, 0)
  ];
  ctx.save();
  ctx.fillStyle = c.slabSide;
  for (let i = 0; i < 3; i += 1) {
    ctx.globalAlpha = 0.05 - i * 0.012;
    ctx.translate(0, view.scale * (1.1 + i * 0.55));
    ctx.beginPath();
    ctx.moveTo(diamond[0].x, diamond[0].y);
    for (let k = 1; k < 4; k += 1) ctx.lineTo(diamond[k].x, diamond[k].y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSlab(ctx, view, c) {
  const faces = [
    { d: view.depth(0, -SLAB), a: [-SLAB, -SLAB], b: [SLAB, -SLAB] },
    { d: view.depth(-SLAB, 0), a: [-SLAB, -SLAB], b: [-SLAB, SLAB] },
    { d: view.depth(0, SLAB), a: [-SLAB, SLAB], b: [SLAB, SLAB] },
    { d: view.depth(SLAB, 0), a: [SLAB, -SLAB], b: [SLAB, SLAB] }
  ];
  faces.sort((m, n) => m.d - n.d);

  const bottoms = faces.map((f) => [
    view.p(f.a[0], f.a[1], -SLAB_DEPTH),
    view.p(f.b[0], f.b[1], -SLAB_DEPTH)
  ]);
  const tops = faces.map((f) => [
    view.p(f.a[0], f.a[1], 0),
    view.p(f.b[0], f.b[1], 0)
  ]);

  for (let i = 0; i < faces.length; i += 1) {
    poly(ctx, [tops[i][0], tops[i][1], bottoms[i][1], bottoms[i][0]], c.slabSide);
  }
  for (const face of bottoms) {
    line(ctx, face, c.slabEdge, Math.max(1.5, view.scale * 0.035));
  }

  poly(ctx, [
    view.p(-SLAB, -SLAB, 0), view.p(SLAB, -SLAB, 0),
    view.p(SLAB, SLAB, 0), view.p(-SLAB, SLAB, 0)
  ], c.slab);

  ctx.save();
  ctx.globalAlpha = 0.13;
  for (let i = -4; i <= 4; i += 1) {
    line(ctx, [view.p(i, -SLAB, 0.01), view.p(i, SLAB, 0.01)], c.slabEdge, 1);
    line(ctx, [view.p(-SLAB, i, 0.01), view.p(SLAB, i, 0.01)], c.slabEdge, 1);
  }
  ctx.restore();

  const sx = SLAB - 0.42;
  groundQuad(ctx, view, -sx, STREET_Y0, sx, STREET_Y1, c.street, 0.02);
  ctx.save();
  ctx.globalAlpha = 0.9;
  line(ctx, [view.p(-sx, STREET_Y0, 0.03), view.p(sx, STREET_Y0, 0.03)], c.streetLine, 2);
  ctx.restore();
  for (let x = -sx + 0.35; x < sx - 0.3; x += 0.85) {
    line(ctx, [view.p(x, 2.3, 0.03), view.p(x + 0.4, 2.3, 0.03)], c.streetLine, 1.6);
  }
}

function drawShopShadow(ctx, view, c) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  poly(ctx, [
    view.p(SHOP.x0 + 0.2, SHOP.y0 + 0.2, 0.04),
    view.p(SHOP.x1 + 0.9, SHOP.y0 + 0.2, 0.04),
    view.p(SHOP.x1 + 1.1, SHOP.y1 + 0.9, 0.04),
    view.p(SHOP.x0 + 0.4, SHOP.y1 + 1.0, 0.04)
  ], c.slabSide);
  ctx.restore();
}

function windowAt(ctx, view, c, axis, plane, a0, a1, z0, z1, lit) {
  faceRect(ctx, view, axis, plane, a0, a1, z0, z1, c.trim);
  faceRect(ctx, view, axis, plane, a0 + 0.06, a1 - 0.06, z0 + 0.06, z1 - 0.06, c.window);
  if (lit) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    faceRect(ctx, view, axis, plane, a0 - 0.1, a1 + 0.1, z0 - 0.14, z1 + 0.14, c.light);
    ctx.restore();
  }
}

function drawStripedAwning(ctx, view, c) {
  const { x0, x1, y1 } = SHOP;
  const a0 = x0 - 0.12;
  const a1 = x1 + 0.12;
  const depth = 0.62;
  const z = 1.28;
  const strips = 6;
  const step = (a1 - a0) / strips;
  for (let i = 0; i < strips; i += 1) {
    const s0 = a0 + i * step;
    const s1 = s0 + step;
    const fill = i % 2 === 0 ? c.roof : c.wallSide;
    poly(ctx, [
      view.p(s0, y1, z), view.p(s1, y1, z),
      view.p(s1, y1 + depth, z - 0.22), view.p(s0, y1 + depth, z - 0.22)
    ], fill);
  }
  box(ctx, view, a0, y1 + depth - 0.02, z - 0.3, a1, y1 + depth + 0.03, z - 0.22,
    { front: c.blade, side: c.blade, top: c.blade });
}

function drawInterior(ctx, view, c) {
  const { x0, y0, x1, y1 } = SHOP;
  const glow = c.night ? 0.95 : 0.5;
  groundQuad(ctx, view, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, c.interior, 0.05);

  // 后墙三层书架
  const shelfX0 = x0 + 0.3;
  const shelfX1 = x1 - 0.9;
  for (let row = 0; row < 3; row += 1) {
    const z = 0.45 + row * 0.5;
    faceRect(ctx, view, 'y', y0 + 0.2, shelfX0, shelfX1, z, z + 0.05, c.shelf);
    for (let i = 0; i < 8; i += 1) {
      const a = shelfX0 + 0.08 + i * 0.2;
      const h = 0.2 + (i % 3) * 0.05;
      const tone = i % 4 === 0 ? c.blade : i % 3 === 0 ? c.trim : c.shelfLight;
      faceRect(ctx, view, 'y', y0 + 0.22, a, a + 0.13, z + 0.05, z + 0.05 + h, tone);
    }
  }

  // 柜台
  box(ctx, view, x0 + 0.45, y1 - 1.05, 0, x1 - 1.1, y1 - 0.5, 0.74,
    { front: c.shelfLight, side: c.shelf, top: c.interior });
  faceRect(ctx, view, 'y', y1 - 0.5, x0 + 0.45, x1 - 1.1, 0.58, 0.66, c.blade);

  // 店员
  const px = x0 + 0.95;
  const py = y1 - 1.3;
  box(ctx, view, px - 0.12, py - 0.12, 0, px + 0.12, py + 0.12, 0.7,
    { front: c.wallSide, side: c.shelf, top: c.shelf });
  box(ctx, view, px - 0.1, py - 0.1, 0.7, px + 0.1, py + 0.1, 0.92,
    { front: c.interior, side: c.interior, top: c.interior });

  // 吊灯
  const lx = (x0 + x1) / 2 + 0.35;
  const ly = y1 - 1.0;
  box(ctx, view, lx - 0.02, ly - 0.02, 1.75, lx + 0.02, ly + 0.02, 2.12,
    { front: c.trim, side: c.trim, top: c.trim });
  const head = view.p(lx, ly, 1.68);
  const size = view.scale * 0.15;
  ctx.save();
  ctx.globalAlpha = glow * 0.16;
  ctx.fillStyle = c.light;
  ctx.fillRect(head.x - size * 3, head.y - size * 3, size * 6, size * 6);
  ctx.globalAlpha = glow * 0.38;
  ctx.fillRect(head.x - size * 1.6, head.y - size * 1.6, size * 3.2, size * 3.2);
  ctx.restore();

  // 猫
  box(ctx, view, x1 - 1.45, y1 - 0.95, 0.74, x1 - 1.15, y1 - 0.68, 0.86,
    { front: c.light, side: c.shelfLight, top: c.light });
  box(ctx, view, x1 - 1.33, y1 - 0.97, 0.86, x1 - 1.19, y1 - 0.82, 0.97,
    { front: c.light, side: c.light, top: c.light });
}

function drawShop(ctx, view, c, state) {
  const { x0, y0, x1, y1, h } = SHOP;
  const open = clamp01(state.cut);
  const slide = ease(open) * 1.1;
  const wallFade = 1 - ease(open);

  drawShopShadow(ctx, view, c);

  // 后墙与右墙：始终保留
  box(ctx, view, x0, y0, 0, x1, y0 + WALL, h, { front: c.wallSide, side: c.wallSide, top: c.roof });
  box(ctx, view, x1 - WALL, y0, 0, x1, y1, h, { front: c.wallFront, side: c.wallSide, top: c.roof });
  windowAt(ctx, view, c, 'x', x1, -2.9, -2.25, 1.0, 1.7, c.night);
  windowAt(ctx, view, c, 'x', x1, -1.95, -1.3, 1.0, 1.7, c.night);

  if (open > 0.01) {
    ctx.save();
    ctx.globalAlpha = ease(open);
    drawInterior(ctx, view, c);
    ctx.restore();
  }

  // 左墙与前墙：剖开时向外滑走
  if (wallFade > 0.02) {
    ctx.save();
    ctx.globalAlpha = wallFade;
    ctx.translate(-slide * view.scale * 0.3, slide * view.scale * 0.22);

    box(ctx, view, x0, y0, 0, x0 + WALL, y1, h, { front: c.wallFront, side: c.wallSide, top: c.roof });
    box(ctx, view, x0, y1 - WALL, 0, x1, y1, h, { front: c.wallFront, side: c.wallSide, top: c.roof });

    // 店门与橱窗
    faceRect(ctx, view, 'y', y1, -1.9, -1.1, 0, 1.18, c.blade);
    faceRect(ctx, view, 'y', y1, -1.9, -1.1, 1.08, 1.18, c.trim);
    windowAt(ctx, view, c, 'y', y1, -0.45, 0.95, 0.35, 1.18, c.night);

    drawStripedAwning(ctx, view, c);

    // 招牌
    box(ctx, view, x0 - 0.05, y1 - 0.04, 1.5, x1 + 0.05, y1 + 0.08, 2.0,
      { front: c.roof, side: c.roof, top: c.roof });
    faceRect(ctx, view, 'y', y1 + 0.08, x0 + 0.05, x0 + 0.45, 1.6, 1.92, c.blade);
    for (let i = 0; i < 4; i += 1) {
      faceRect(ctx, view, 'y', y1 + 0.08, x0 + 0.62 + i * 0.42, x0 + 0.94 + i * 0.42, 1.7, 1.84, c.trim);
    }
    ctx.restore();
  }

  // 屋顶
  ctx.save();
  ctx.globalAlpha = 1 - ease(open) * 0.92;
  ctx.translate(0, -ease(open) * 1.1 * view.scale);
  const rx0 = x0 - 0.16, ry0 = y0 - 0.14, rx1 = x1 + 0.16, ry1 = y1 + 0.16, rz = h + 0.12;
  box(ctx, view, rx0, ry0, h, rx1, ry1, rz, { front: c.roof, side: c.roof, top: c.roof });
  line(ctx, [
    view.p(rx0, ry0, rz), view.p(rx1, ry0, rz),
    view.p(rx1, ry1, rz), view.p(rx0, ry1, rz), view.p(rx0, ry0, rz)
  ], c.trim, 1.6);
  // 屋顶通风箱与旗杆
  box(ctx, view, 0.1, -2.7, rz, 0.55, -2.25, rz + 0.35,
    { front: c.wallSide, side: c.wallFront, top: c.roof });
  box(ctx, view, -1.85, -3.0, rz, -1.79, -2.94, rz + 0.55,
    { front: c.trim, side: c.trim, top: c.trim });
  poly(ctx, [
    view.p(-1.79, -2.94, rz + 0.5), view.p(-1.34, -2.94, rz + 0.42),
    view.p(-1.79, -2.94, rz + 0.33)
  ], c.blade);
  ctx.restore();
}

function drawTree(ctx, view, c, state, tx, ty, scale = 1) {
  const winter = state.season === 'winter';
  ctx.save();
  ctx.globalAlpha = 0.18;
  poly(ctx, [
    view.p(tx - 0.5, ty - 0.5, 0.03), view.p(tx + 0.6, ty - 0.5, 0.03),
    view.p(tx + 0.7, ty + 0.6, 0.03), view.p(tx - 0.4, ty + 0.6, 0.03)
  ], c.slabSide);
  ctx.restore();

  box(ctx, view, tx - 0.13, ty - 0.13, 0, tx + 0.13, ty + 0.13, 1.05 * scale,
    { front: c.trunk, side: c.trunk, top: c.trunk });

  const blocks = winter
    ? [[-0.85, 0.1, 0.95, 1.4], [-0.55, 0.4, 1.35, 1.72]]
    : [[-1.05, 0.16, 0.9, 1.42], [-0.75, 0.46, 1.38, 1.85], [-0.95, 0.28, 1.8, 2.05]];
  for (const [a, b, z0, z1] of blocks) {
    box(ctx, view, tx + a * scale, ty + a * scale, z0 * scale, tx + b * scale, ty + b * scale, z1 * scale,
      { front: c.foliage, side: c.foliageSide, top: mix(c.foliage, c.interior, 0.28) });
  }
  if (state.season === 'spring') {
    for (const [a, b, z] of [[-1.0, 0.2, 2.05], [-0.7, 0.5, 2.05], [-0.42, 0.22, 1.85]]) {
      box(ctx, view, tx + a, ty + b, z, tx + a + 0.18, ty + b + 0.18, z + 0.07,
        { front: c.roof, side: c.roof, top: c.roof });
    }
  }
  if (state.season === 'autumn') {
    for (const [a, b, z] of [[-0.95, 0.24, 1.45], [-0.46, 0.56, 1.86], [-0.72, 0.1, 1.36]]) {
      box(ctx, view, tx + a, ty + b, z, tx + a + 0.2, ty + b + 0.2, z + 0.08,
        { front: c.blade, side: c.blade, top: c.blade });
    }
  }
  if (winter) {
    box(ctx, view, tx - 0.8, ty + 0.4, 1.72, tx - 0.1, ty + 0.7, 1.79,
      { front: c.roof, side: c.roof, top: c.roof });
  }
}

function drawLamp(ctx, view, c, x, y) {
  box(ctx, view, x - 0.055, y - 0.055, 0, x + 0.055, y + 0.055, 1.6,
    { front: c.trim, side: c.trim, top: c.trim });
  const head = view.p(x, y, 1.7);
  const s = view.scale * 0.13;
  if (c.night) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = c.light;
    ctx.fillRect(head.x - s * 4.4, head.y - s * 4.4, s * 8.8, s * 8.8);
    ctx.globalAlpha = 0.18;
    ctx.fillRect(head.x - s * 2.6, head.y - s * 2.6, s * 5.2, s * 5.2);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.13;
    poly(ctx, [
      view.p(x - 1.1, y - 1.1, 0.02), view.p(x + 1.1, y - 1.1, 0.02),
      view.p(x + 1.1, y + 1.1, 0.02), view.p(x - 1.1, y + 1.1, 0.02)
    ], c.light);
    ctx.restore();
  }
  ctx.fillStyle = c.light;
  ctx.fillRect(head.x - s / 2, head.y - s / 2, s, s);
}

function drawBench(ctx, view, c, x, y) {
  box(ctx, view, x - 0.45, y - 0.16, 0, x + 0.45, y + 0.16, 0.08,
    { front: c.trim, side: c.trim, top: c.trim });
  box(ctx, view, x - 0.38, y - 0.1, 0.08, x + 0.38, y + 0.1, 0.38,
    { front: c.trim, side: c.trim, top: c.trim });
}

function drawCrates(ctx, view, c, x, y) {
  box(ctx, view, x, y, 0, x + 0.42, y + 0.42, 0.3, { front: c.roof, side: c.shelf, top: c.roof });
  box(ctx, view, x + 0.04, y + 0.04, 0.3, x + 0.38, y + 0.38, 0.55, { front: c.roof, side: c.shelf, top: c.roof });
}

function drawVisitor(ctx, view, c, person) {
  const x = person.x;
  const y = person.y;
  const bob = Math.sin(person.phase) * 0.03;
  const w = 0.14;
  const body = 0.42;
  ctx.save();
  ctx.globalAlpha = 0.16;
  poly(ctx, [
    view.p(x - 0.2, y - 0.2, 0.03), view.p(x + 0.2, y - 0.2, 0.03),
    view.p(x + 0.2, y + 0.2, 0.03), view.p(x - 0.2, y + 0.2, 0.03)
  ], c.slabSide);
  ctx.restore();
  box(ctx, view, x - w, y - w, bob, x + w, y + w, body + bob,
    { front: c.wallFront, side: c.trunk, top: c.wallFront });
  box(ctx, view, x - 0.1, y - 0.1, body + bob, x + 0.1, y + 0.1, body + 0.22 + bob,
    { front: c.interior, side: c.interior, top: c.interior });
  if (person.scarf) {
    box(ctx, view, x - w, y - w, body + bob - 0.09, x + w, y + w, body + bob - 0.02,
      { front: c.blade, side: c.blade, top: c.blade });
  }
}

function drawShard(ctx, view, c, shard) {
  const z = shard.z + Math.sin(shard.phase) * 0.18;
  const s = shard.size;
  ctx.save();
  ctx.globalAlpha = shard.alpha;
  box(ctx, view, shard.x - s / 2, shard.y - s / 2, z, shard.x + s / 2, shard.y + s / 2, z + 0.08,
    shard.blade
      ? { front: c.blade, side: c.blade, top: c.blade }
      : { front: c.slabSide, side: c.slabSide, top: c.slab });
  ctx.restore();
}

function drawWeather(ctx, view, c, state, width, height) {
  for (const p of state.weather) {
    ctx.globalAlpha = p.alpha * (c.night ? 0.95 : 0.68);
    ctx.fillStyle = p.blade ? c.blade : c.light;
    const size = p.size;
    ctx.fillRect(p.x, p.y, size, size * p.stretch);
  }
  ctx.globalAlpha = 1;
}

function drawStars(ctx, view, c, state) {
  if (!c.night) return;
  for (const s of state.stars) {
    const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(state.t * s.speed + s.phase));
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillStyle = c.light;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

export function drawScene(ctx, view, c, state, width, height) {
  ctx.clearRect(0, 0, width, height);
  drawStars(ctx, view, c, state);

  ctx.save();
  ctx.globalAlpha = clamp01(state.intro * 2.5);
  drawFloatShadow(ctx, view, c);
  drawSlab(ctx, view, c);
  ctx.restore();

  const items = [
    item((SHOP.x0 + SHOP.x1) / 2, (SHOP.y0 + SHOP.y1) / 2, 0.05, () => drawShop(ctx, view, c, state)),
    item(-3.7, -1.1, 0.14, () => drawTree(ctx, view, c, state, -3.7, -1.1, 0.82)),
    item(3.5, -2.6, 0.18, () => drawTree(ctx, view, c, state, 3.5, -2.6, 0.95)),
    item(-4.2, 1.6, 0.22, () => drawLamp(ctx, view, c, -4.2, 1.6)),
    item(4.2, 1.6, 0.26, () => drawLamp(ctx, view, c, 4.2, 1.6)),
    item(1.9, -1.6, 0.3, () => drawCrates(ctx, view, c, 1.9, -1.6)),
    item(-3.8, 3.9, 0.34, () => drawBench(ctx, view, c, -3.8, 3.9))
  ];
  for (const person of state.visitors) {
    items.push(item(person.x, person.y, 0.4, () => drawVisitor(ctx, view, c, person)));
  }
  for (const shard of state.shards) {
    items.push(item(shard.x, shard.y, 0.12, () => drawShard(ctx, view, c, shard)));
  }

  items.sort((a, b) => view.depth(a.x, a.y) - view.depth(b.x, b.y));
  for (const it of items) {
    const k = clamp01((state.intro - it.delay) / Math.max(0.2, 1 - it.delay));
    if (k <= 0) continue;
    ctx.save();
    ctx.globalAlpha = k;
    it.draw();
    ctx.restore();
  }

  drawWeather(ctx, view, c, state, width, height);
}
