// 等轴测投影、配色与多边形工具。整个场景只用方块和硬边多边形，不依赖任何外部库。
const ISO = 0.8660254;

export function makeView(width, height, yaw, zoom = 1, drop = 0) {
  const narrow = width < 560;
  const fit = narrow
    ? Math.min((width * 1.04) / 17.4, (height * 0.52) / 13.6)
    : Math.min((width * 0.9) / 17.4, (height * 0.84) / 13.6);
  const scale = Math.max(9, fit) * zoom;
  return {
    width,
    height,
    scale,
    ox: width / 2,
    oy: height * (narrow ? 0.44 : 0.56) + drop,
    cos: Math.cos(yaw),
    sin: Math.sin(yaw),
    p(x, y, z) {
      const rx = x * this.cos - y * this.sin;
      const ry = x * this.sin + y * this.cos;
      return {
        x: this.ox + (rx - ry) * ISO * this.scale,
        y: this.oy + ((rx + ry) * 0.5 - z) * this.scale
      };
    },
    depth(x, y) {
      return (x * this.cos - y * this.sin) + (x * this.sin + y * this.cos);
    }
  };
}

export function readPalette(root) {
  const cs = getComputedStyle(root);
  const read = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    white: read('--sh-white', '#F4F6FF'),
    klein500: read('--sh-klein-500', '#0537B4'),
    klein700: read('--sh-klein-700', '#0C2B92'),
    klein900: read('--sh-klein-900', '#0A1D6C'),
    klein950: read('--sh-klein-950', '#0D1850'),
    burgundy: read('--sh-burgundy', '#90072A'),
    ink: read('--sh-ink', '#08060A')
  };
}

export function parseColor(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

export function mix(from, to, t) {
  const a = parseColor(from);
  const b = parseColor(to);
  const c = (i) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0');
  return '#' + c('r') + c('g') + c('b');
}

export function alpha(hex, a) {
  const { r, g, b } = parseColor(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function themeColors(pal, theme, season) {
  const night = theme === 'night';
  const foliage = season === 'summer' ? pal.klein500 : pal.klein700;
  return {
    slab: night ? pal.klein900 : pal.klein500,
    slabSide: night ? mix(pal.klein950, pal.ink, 0.35) : pal.klein700,
    slabEdge: pal.white,
    street: night ? pal.klein900 : pal.white,
    streetLine: pal.burgundy,
    wallFront: night ? pal.ink : pal.klein950,
    wallSide: night ? pal.klein950 : pal.klein900,
    roof: pal.white,
    trim: night ? pal.white : pal.klein950,
    blade: pal.burgundy,
    glass: pal.white,
    trunk: night ? pal.klein950 : pal.klein950,
    foliage,
    foliageSide: night ? pal.klein950 : pal.klein900,
    light: pal.white,
    interior: pal.white,
    window: pal.white,
    shelf: night ? pal.klein900 : pal.klein700,
    shelfLight: night ? pal.klein700 : pal.klein500,
    night
  };
}

export function poly(ctx, points, fill) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(ctx, points, stroke, width) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

// 立方体：四个侧面按深度排序后绘制，近面自然盖住远面，因此任意视角都成立。
export function box(ctx, view, x0, y0, z0, x1, y1, z1, colors, fade = 1) {
  if (fade <= 0.01) return;
  const p = (x, y, z) => view.p(x, y, z);
  const faces = [
    { d: view.depth((x0 + x1) / 2, y0), a: [x0, y0], b: [x1, y0], c: colors.side },
    { d: view.depth((x0 + x1) / 2, y1), a: [x0, y1], b: [x1, y1], c: colors.front },
    { d: view.depth(x0, (y0 + y1) / 2), a: [x0, y0], b: [x0, y1], c: colors.side },
    { d: view.depth(x1, (y0 + y1) / 2), a: [x1, y0], b: [x1, y1], c: colors.front }
  ];
  faces.sort((m, n) => m.d - n.d);
  for (const f of faces) {
    poly(ctx, [p(f.a[0], f.a[1], z0), p(f.b[0], f.b[1], z0), p(f.b[0], f.b[1], z1), p(f.a[0], f.a[1], z1)], f.c);
  }
  poly(ctx, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], colors.top);
}

export function faceRect(ctx, view, axis, plane, a0, a1, z0, z1, fill) {
  const p = (a, z) => (axis === 'y' ? view.p(a, plane, z) : view.p(plane, a, z));
  poly(ctx, [p(a0, z0), p(a1, z0), p(a1, z1), p(a0, z1)], fill);
}

export function groundQuad(ctx, view, x0, y0, x1, y1, fill, z = 0.001) {
  poly(ctx, [view.p(x0, y0, z), view.p(x1, y0, z), view.p(x1, y1, z), view.p(x0, y1, z)], fill);
}
