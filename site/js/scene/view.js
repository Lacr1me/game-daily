// 等轴测投影与配色读取。不依赖任何外部库，颜色全部来自站点 token。
const ISO = 0.8660254;

// 地面半宽 4.8：菱形横向 16.63 个单位，纵向从屋脊到地面最远角 10.46 个单位。
const SPAN_X = 16.63;
const SPAN_Y = 10.46;
const TOP_UNITS = 5.66;

export function makeView(width, height, yaw) {
  const scale = Math.max(10, Math.min((width * 0.94) / SPAN_X, (height * 0.94) / SPAN_Y));
  const top = (height - SPAN_Y * scale) / 2;
  return {
    scale,
    ox: width / 2,
    oy: top + TOP_UNITS * scale,
    cos: Math.cos(yaw),
    sin: Math.sin(yaw),
    p(x, y, z) {
      const rx = x * this.cos - y * this.sin;
      const ry = x * this.sin + y * this.cos;
      return {
        x: this.ox + (rx - ry) * ISO * this.scale,
        y: this.oy + ((rx + ry) * 0.5 - z) * this.scale,
        d: rx + ry
      };
    },
    depth(x, y) {
      return (x * this.cos - y * this.sin) + (x * this.sin + y * this.cos);
    }
  };
}

export function readPalette(root) {
  const cs = getComputedStyle(root);
  const read = (name, fallback) => {
    const value = cs.getPropertyValue(name).trim();
    return value || fallback;
  };
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

export function themeColors(pal, theme, season) {
  const day = theme !== 'night';
  const foliageFront = season === 'summer' ? pal.klein500 : pal.klein700;
  const foliageSide = pal.klein950;
  return {
    ground: day ? pal.klein500 : pal.klein900,
    groundAlt: day ? pal.klein700 : pal.klein700,
    street: day ? pal.white : pal.klein900,
    wallA: day ? pal.klein500 : pal.klein900,
    wallB: pal.klein700,
    awning: day ? pal.klein950 : pal.klein500,
    roof: pal.white,
    trim: day ? pal.klein950 : pal.white,
    blade: pal.burgundy,
    glass: pal.white,
    trunk: pal.klein950,
    foliageFront,
    foliageSide,
    light: pal.white,
    dim: day ? pal.klein700 : pal.klein500
  };
}

export function poly(ctx, points, fill) {
  if (!points.length) return;
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

// 一个立方体只画朝向观察者的三个面：+y 面、+x 面、顶面。
export function box(ctx, view, x0, y0, z0, x1, y1, z1, colors) {
  const p = (x, y, z) => view.p(x, y, z);
  poly(ctx, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], colors.front);
  poly(ctx, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], colors.side);
  poly(ctx, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], colors.top);
}

export function faceRect(ctx, view, axis, plane, a0, a1, z0, z1, fill) {
  const p = (a, z) => (axis === 'y' ? view.p(a, plane, z) : view.p(plane, a, z));
  poly(ctx, [p(a0, z0), p(a1, z0), p(a1, z1), p(a0, z1)], fill);
}
