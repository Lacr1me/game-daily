// 写实微缩街角书店：程序纹理、环境反射、可透过玻璃看到的店内、软阴影。
// three.js 已内置在 vendor/three；不加载任何外部图片或字体文件。
import * as THREE from '../../../vendor/three/three.module.min.js';

const SHOP = {
  x0: -2.8, x1: 1.2,
  z0: -3.4, z1: 0.6,
  h1: 2.8, h2: 2.5,
  wall: 0.22
};

const DAY = {
  sky: '#F4F6FF', skyLow: '#C9D3F0',
  sun: '#FFFFFF', sunI: 3.4,
  hemiSky: '#FFFFFF', hemiGround: '#8E9CCB', hemiI: 0.9,
  exposure: 0.94,
  interior: '#FFE7C2', interiorI: 1.6,
  lamp: '#FFE7C2', lampI: 0,
  window: '#C6D2F2',
  glassOpacity: 0.1
};

const NIGHT = {
  sky: '#070B22', skyLow: '#12204F',
  sun: '#8FA2E8', sunI: 0.5,
  hemiSky: '#5D6FB5', hemiGround: '#05081A', hemiI: 0.55,
  exposure: 1.25,
  interior: '#FFCE85', interiorI: 5.5,
  lamp: '#FFD9A0', lampI: 14,
  window: '#FFD9A0',
  glassOpacity: 0.06
};

function canvasTexture(width, height, paint, { repeat = 1, repeatY = repeat } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeatY);
  texture.anisotropy = 4;
  return texture;
}

function noise(ctx, width, height, amount, alpha) {
  for (let i = 0; i < amount; i += 1) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    const size = 1 + Math.random() * 2;
    ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
  }
}

function makeAsphalt() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#20264A';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 9000, 0.07);
    ctx.strokeStyle = 'rgba(10,14,34,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i += 1) {
      ctx.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k += 1) {
        x += (Math.random() - 0.5) * 80;
        y += (Math.random() - 0.5) * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, { repeat: 6 });
}

function makeSidewalk() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#E3E8F7';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 4000, 0.05);
    ctx.strokeStyle = 'rgba(120,134,180,0.35)';
    ctx.lineWidth = 3;
    const step = w / 4;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(w, i * step); ctx.stroke();
    }
  }, { repeat: 3 });
}

function makeStucco() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#F2F4FE';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 7000, 0.045);
  }, { repeat: 2 });
}

function makeWood() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7A1226';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h);
    }
  }, { repeat: 2 });
}

function makeAwning() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    const stripes = 10;
    const step = w / stripes;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#F4F6FF' : '#90072A';
      ctx.fillRect(i * step, 0, step + 1, h);
    }
    noise(ctx, w, h, 1200, 0.05);
  }, { repeat: 1 });
}

function makeSignTexture(font) {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#F4F6FF';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#90072A';
    ctx.fillRect(0, 0, 26, h);
    ctx.fillStyle = '#0D1850';
    ctx.font = `700 112px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '10px';
    ctx.fillText('SLICE SHOP', 70, h / 2 + 4);
  });
}

function makeShadowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function createExperience({ canvas, stage }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAY.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 160);
  const target = new THREE.Vector3(0, 2.15, 0.4);
  const view = { azimuth: 0.58, polar: 1.16, radius: 32, zoom: 1 };

  function environment(top, mid) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, top);
    g.addColorStop(0.52, mid);
    g.addColorStop(1, '#05070F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  const envDay = environment('#FFFFFF', '#C9D3F0');
  const envNight = environment('#16224F', '#070B22');
  scene.environment = envDay;

  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiI);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.set(9, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.5;
  scene.add(sun);

  const rim = new THREE.DirectionalLight('#9FB6FF', 0.55);
  rim.position.set(-9, 6, -8);
  scene.add(rim);

  const textures = {
    asphalt: makeAsphalt(),
    sidewalk: makeSidewalk(),
    stucco: makeStucco(),
    wood: makeWood(),
    awning: makeAwning(),
    shadow: makeShadowTexture()
  };

  const materials = [];
  function standard(options) {
    const m = new THREE.MeshStandardMaterial(options);
    materials.push(m);
    return m;
  }

  const wallMat = standard({ color: '#FFFFFF', map: textures.stucco, roughness: 0.86, metalness: 0, envMapIntensity: 0.6 });
  const trimMat = standard({ color: '#0D1850', roughness: 0.42, metalness: 0.25, envMapIntensity: 0.9 });
  const bladeMat = standard({ color: '#90072A', roughness: 0.5, metalness: 0.1 });
  const kleinMat = standard({ color: '#0C2B92', roughness: 0.55, metalness: 0.15 });
  const woodMat = standard({ color: '#FFFFFF', map: textures.wood, roughness: 0.62, metalness: 0.05 });
  const sidewalkMat = standard({ color: '#FFFFFF', map: textures.sidewalk, roughness: 0.9, metalness: 0 });
  const asphaltMat = standard({ color: '#FFFFFF', map: textures.asphalt, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.9 });
  const awningMat = standard({ color: '#FFFFFF', map: textures.awning, roughness: 0.85, metalness: 0 });
  const metalMat = standard({ color: '#1B2350', roughness: 0.35, metalness: 0.75, envMapIntensity: 1.1 });
  const interiorMat = standard({ color: '#C9BCA6', roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
  const shelfMat = standard({ color: '#8A6A50', roughness: 0.8, metalness: 0 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#DCE6FF',
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: DAY.glassOpacity,
    depthWrite: false,
    envMapIntensity: 0.45,
    side: THREE.DoubleSide
  });
  materials.push(glassMat);

  const shadowMat = new THREE.MeshBasicMaterial({ map: textures.shadow, transparent: true, depthWrite: false, opacity: 0.85 });
  materials.push(shadowMat);

  const block = new THREE.Group();
  scene.add(block);

  function box(parent, w, h, d, material, x, y, z, { cast = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  function cyl(parent, rt, rb, h, seg, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function contact(parent, x, z, size, opacity = 0.85) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), shadowMat.clone());
    mesh.material.opacity = opacity;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.012, z);
    mesh.renderOrder = 1;
    parent.add(mesh);
    return mesh;
  }

  // ── 地块、马路、人行道 ───────────────────────────────────────
  const S = 5.2;
  const C = 0.75;
  const shape = new THREE.Shape();
  shape.moveTo(-S + C, -S);
  shape.lineTo(S, -S);
  shape.lineTo(S, S - C);
  shape.lineTo(S - C, S);
  shape.lineTo(-S, S);
  shape.lineTo(-S, -S + C);
  shape.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.85, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, standard({ color: '#EDF1FC', roughness: 0.92, metalness: 0 }));
  slab.position.y = -0.85;
  slab.receiveShadow = true;
  slab.castShadow = true;
  block.add(slab);

  const road = box(block, 9.6, 0.04, 3.0, asphaltMat, 0, 0.02, 3.9, { cast: false });
  road.material.map.repeat.set(7, 2);
  box(block, 9.6, 0.18, 0.22, standard({ color: '#C9D1EA', roughness: 0.85, metalness: 0 }), 0, 0.09, 2.28, { cast: false });
  const walk = box(block, 9.6, 0.1, 1.5, sidewalkMat, 0, 0.05, 1.5, { cast: false });
  walk.material.map.repeat.set(6, 1);

  // 路面标线：略微抬高并禁用深度偏移冲突
  const lineMat = new THREE.MeshBasicMaterial({ color: '#F4F6FF' });
  materials.push(lineMat);
  for (let i = 0; i < 8; i += 1) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.5), lineMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-2.4 + i * 0.72, 0.052, 3.35);
    block.add(stripe);
  }
  const centre = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 0.1), new THREE.MeshBasicMaterial({ color: '#90072A' }));
  centre.rotation.x = -Math.PI / 2;
  centre.position.set(0, 0.05, 4.6);
  block.add(centre);

  // ── 小店主体 ────────────────────────────────────────────────
  const shop = new THREE.Group();
  block.add(shop);

  const W = SHOP.x1 - SHOP.x0;
  const D = SHOP.z1 - SHOP.z0;
  const cx = (SHOP.x0 + SHOP.x1) / 2;
  const T = SHOP.wall;

  // 后墙、左墙
  box(shop, W, SHOP.h1, T, wallMat, cx, SHOP.h1 / 2, SHOP.z0 + T / 2);
  box(shop, T, SHOP.h1, D, wallMat, SHOP.x0 + T / 2, SHOP.h1 / 2, SHOP.z0 + D / 2);
  // 室内地坪
  box(shop, W - T, 0.06, D - T, interiorMat, cx, 0.03, SHOP.z0 + D / 2, { cast: false });
  // 室内后墙板
  box(shop, W - T * 2, SHOP.h1 - 0.1, 0.04, interiorMat, cx, SHOP.h1 / 2, SHOP.z0 + T + 0.05, { cast: false });

  // 一层正面墙：开窗与门的真实洞口
  const fz = SHOP.z1 - T / 2;
  const openX0 = -2.35, openX1 = -0.05;
  const doorX0 = 0.35, doorX1 = 1.05;
  const openY0 = 0.42, openY1 = 2.18;
  // 左垛
  box(shop, openX0 - SHOP.x0, SHOP.h1, T, wallMat, (SHOP.x0 + openX0) / 2, SHOP.h1 / 2, fz);
  // 中垛
  box(shop, doorX0 - openX1, SHOP.h1, T, wallMat, (openX1 + doorX0) / 2, SHOP.h1 / 2, fz);
  // 右垛
  box(shop, SHOP.x1 - doorX1, SHOP.h1, T, wallMat, (doorX1 + SHOP.x1) / 2, SHOP.h1 / 2, fz);
  // 窗下墙
  box(shop, openX1 - openX0, openY0, T, wallMat, (openX0 + openX1) / 2, openY0 / 2, fz);
  // 窗上墙
  box(shop, openX1 - openX0, SHOP.h1 - openY1, T, wallMat, (openX0 + openX1) / 2, (openY1 + SHOP.h1) / 2, fz);
  // 门上墙
  box(shop, doorX1 - doorX0, SHOP.h1 - 2.2, T, wallMat, (doorX0 + doorX1) / 2, (2.2 + SHOP.h1) / 2, fz);

  // 二楼
  const y2 = SHOP.h1;
  box(shop, W - 0.1, SHOP.h2, D - 0.1, wallMat, cx, y2 + SHOP.h2 / 2, SHOP.z0 + (D - 0.1) / 2);
  // 楼层分隔线
  box(shop, W + 0.04, 0.14, D + 0.04, trimMat, cx, y2 + 0.02, SHOP.z0 + D / 2);
  // 屋顶沿口
  box(shop, W + 0.2, 0.16, D + 0.2, trimMat, cx, y2 + SHOP.h2 + 0.08, SHOP.z0 + D / 2);

  // 二楼窗（凹入的深色玻璃 + 白框）
  const upperGlass = standard({ color: '#2A3670', roughness: 0.12, metalness: 0.5, envMapIntensity: 1.4 });
  for (const wx of [-1.75, -0.35, 0.85]) {
    box(shop, 0.92, 1.3, 0.06, upperGlass, wx, y2 + 1.35, SHOP.z1 - 0.02, { cast: false });
    box(shop, 1.06, 0.08, 0.1, standard({ color: '#F4F6FF', roughness: 0.7 }), wx, y2 + 2.03, SHOP.z1 - 0.01);
    box(shop, 1.06, 0.08, 0.1, standard({ color: '#F4F6FF', roughness: 0.7 }), wx, y2 + 0.67, SHOP.z1 - 0.01);
    box(shop, 0.08, 1.3, 0.1, standard({ color: '#F4F6FF', roughness: 0.7 }), wx - 0.5, y2 + 1.35, SHOP.z1 - 0.01);
    box(shop, 0.08, 1.3, 0.1, standard({ color: '#F4F6FF', roughness: 0.7 }), wx + 0.5, y2 + 1.35, SHOP.z1 - 0.01);
  }

  // 右墙：同样留出真实洞口
  const rx = SHOP.x1 - T / 2;
  const sideZ0 = -2.05, sideZ1 = -0.15;
  box(shop, T, SHOP.h1, sideZ0 - SHOP.z0, wallMat, rx, SHOP.h1 / 2, (SHOP.z0 + sideZ0) / 2);
  box(shop, T, SHOP.h1, SHOP.z1 - sideZ1, wallMat, rx, SHOP.h1 / 2, (sideZ1 + SHOP.z1) / 2);
  box(shop, T, 0.72, sideZ1 - sideZ0, wallMat, rx, 0.36, (sideZ0 + sideZ1) / 2);
  box(shop, T, SHOP.h1 - 2.18, sideZ1 - sideZ0, wallMat, rx, (2.18 + SHOP.h1) / 2, (sideZ0 + sideZ1) / 2);

  const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(sideZ1 - sideZ0, 1.46), glassMat);
  sideGlass.rotation.y = Math.PI / 2;
  sideGlass.position.set(SHOP.x1 - 0.06, 1.45, (sideZ0 + sideZ1) / 2);
  shop.add(sideGlass);
  box(shop, 0.1, 0.09, sideZ1 - sideZ0 + 0.1, trimMat, SHOP.x1 - 0.05, 0.72, (sideZ0 + sideZ1) / 2);
  box(shop, 0.1, 0.09, sideZ1 - sideZ0 + 0.1, trimMat, SHOP.x1 - 0.05, 2.18, (sideZ0 + sideZ1) / 2);

  // 店内：书架、书、柜台、吊灯、店员
  const shelfX0 = SHOP.x0 + 0.5;
  const shelfX1 = SHOP.x1 - 1.5;
  for (let row = 0; row < 3; row += 1) {
    const y = 0.55 + row * 0.62;
    box(shop, shelfX1 - shelfX0, 0.05, 0.34, shelfMat, (shelfX0 + shelfX1) / 2, y, SHOP.z0 + 0.45, { cast: false });
    for (let i = 0; i < 10; i += 1) {
      const bw = 0.07 + Math.random() * 0.03;
      const bh = 0.26 + Math.random() * 0.08;
      const tone = i % 5 === 0 ? '#90072A' : i % 4 === 0 ? '#0537B4' : i % 3 === 0 ? '#F4F6FF' : '#0D1850';
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.24),
        standard({ color: tone, roughness: 0.75 })
      );
      book.position.set(shelfX0 + 0.12 + i * 0.17, y + 0.03 + bh / 2, SHOP.z0 + 0.45);
      book.castShadow = false;
      shop.add(book);
    }
  }
  // 橱窗前陈列台：给室内前景一点层次
  box(shop, 1.7, 0.52, 0.46, shelfMat, -1.25, 0.26, -0.1, { cast: false });
  box(shop, 1.76, 0.05, 0.52, standard({ color: '#F4F6FF', roughness: 0.6 }), -1.25, 0.545, -0.1, { cast: false });
  for (let i = 0; i < 6; i += 1) {
    const tone = ['#90072A', '#0537B4', '#0D1850', '#F4F6FF'][i % 4];
    box(shop, 0.26, 0.06, 0.32, standard({ color: tone, roughness: 0.72 }), -1.95 + i * 0.28, 0.6, -0.1, { cast: false });
  }

  box(shop, 1.5, 0.95, 0.6, shelfMat, 0.05, 0.475, -0.35, { cast: false });
  box(shop, 1.56, 0.06, 0.66, standard({ color: '#F4F6FF', roughness: 0.6 }), 0.05, 0.98, -0.35);
  // 店员
  const clerk = new THREE.Group();
  clerk.position.set(0.05, 0, -0.75);
  const clerkBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.5, 4, 12), standard({ color: '#0D1850', roughness: 0.85 }));
  clerkBody.position.y = 0.55;
  clerkBody.castShadow = true;
  clerk.add(clerkBody);
  const clerkHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), standard({ color: '#F1E3D4', roughness: 0.7 }));
  clerkHead.position.y = 1.0;
  clerkHead.castShadow = true;
  clerk.add(clerkHead);
  shop.add(clerk);

  // 吊灯
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#FFE7C2', emissive: new THREE.Color('#FFCB88'), emissiveIntensity: 0.6 });
  materials.push(bulbMat);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), bulbMat);
  bulb.position.set(0.1, 2.05, -1.1);
  shop.add(bulb);
  cyl(shop, 0.012, 0.012, 0.5, 6, trimMat, 0.1, 2.35, -1.1);

  const interiorLight = new THREE.PointLight('#FFCB88', DAY.interiorI, 7, 2);
  interiorLight.position.set(0.1, 2.0, -1.0);
  shop.add(interiorLight);

  // 玻璃：橱窗、门
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(openX1 - openX0, openY1 - openY0), glassMat);
  frontGlass.position.set((openX0 + openX1) / 2, (openY0 + openY1) / 2, SHOP.z1 - 0.05);
  shop.add(frontGlass);

  // 窗框与门框（略微嵌入墙体，避免共面）
  box(shop, openX1 - openX0 + 0.1, 0.09, 0.16, trimMat, (openX0 + openX1) / 2, openY0, SHOP.z1 - 0.04);
  box(shop, openX1 - openX0 + 0.1, 0.09, 0.16, trimMat, (openX0 + openX1) / 2, openY1, SHOP.z1 - 0.04);
  box(shop, 0.08, openY1 - openY0, 0.16, trimMat, openX0, (openY0 + openY1) / 2, SHOP.z1 - 0.04);
  box(shop, 0.08, openY1 - openY0, 0.16, trimMat, openX1, (openY0 + openY1) / 2, SHOP.z1 - 0.04);

  box(shop, 0.76, 2.26, 0.18, woodMat, (doorX0 + doorX1) / 2, 1.13, SHOP.z1 - 0.05);
  box(shop, 0.62, 0.06, 0.02, metalMat, (doorX0 + doorX1) / 2 + 0.1, 1.05, SHOP.z1 + 0.045);

  // 遮阳篷（斜面 + 条纹贴图）
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 1.05), awningMat);
  awning.position.set(-1.2, 2.32, SHOP.z1 + 0.5);
  awning.rotation.x = -0.32;
  awning.castShadow = true;
  awning.receiveShadow = true;
  shop.add(awning);
  box(shop, 2.72, 0.1, 0.1, trimMat, -1.2, 2.44, SHOP.z1 + 0.02);

  // 招牌：Anton 字体贴图 + 自发光
  const signCanvas = makeSignTexture('Anton, "Arial Narrow", sans-serif');
  const signMat = new THREE.MeshStandardMaterial({
    map: signCanvas,
    emissive: new THREE.Color('#FFFFFF'),
    emissiveMap: signCanvas,
    emissiveIntensity: 0.12,
    roughness: 0.7
  });
  materials.push(signMat);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.62, 0.1), signMat);
  sign.position.set(-1.2, 2.86, SHOP.z1 + 0.06);
  sign.castShadow = true;
  shop.add(sign);

  // 屋顶设备
  box(shop, 0.7, 0.5, 0.55, metalMat, 0.6, y2 + SHOP.h2 + 0.42, -2.2);
  box(shop, 0.2, 0.36, 0.2, metalMat, -1.5, y2 + SHOP.h2 + 0.36, -2.9);
  cyl(shop, 0.06, 0.06, 1.2, 8, metalMat, -2.1, y2 + SHOP.h2 + 0.75, -3.0);

  // ── 街道物件 ────────────────────────────────────────────────
  const props = new THREE.Group();
  block.add(props);

  function streetLamp(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    cyl(g, 0.055, 0.08, 3.4, 12, metalMat, 0, 1.7, 0);
    const arm = cyl(g, 0.03, 0.03, 0.8, 8, metalMat, 0.34, 3.32, 0);
    arm.rotation.z = Math.PI / 2;
    const headMat = new THREE.MeshStandardMaterial({ color: '#F4F6FF', emissive: new THREE.Color('#FFD9A0'), emissiveIntensity: 0 });
    materials.push(headMat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.24), headMat);
    head.position.set(0.68, 3.3, 0);
    g.add(head);
    const light = new THREE.PointLight('#FFD9A0', 0, 7, 2);
    light.position.set(0.68, 3.1, 0);
    g.add(light);
    props.add(g);
    return { head: headMat, light };
  }
  const lamps = [streetLamp(-4.0, 1.55), streetLamp(4.1, 1.55), streetLamp(1.9, 4.9)];

  function tree(x, z, s) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    cyl(g, 0.1, 0.15, 1.3, 10, standard({ color: '#3B2A1E', roughness: 0.95 }), 0, 0.65, 0);
    const foliageMat = standard({ color: '#0C2B92', roughness: 0.9, flatShading: true });
    for (const [dx, dy, dz, r] of [[0, 1.75, 0, 0.72], [-0.45, 1.4, 0.15, 0.5], [0.42, 1.48, -0.12, 0.46], [0.05, 2.2, -0.05, 0.42]]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), foliageMat);
      blob.position.set(dx, dy, dz);
      blob.castShadow = true;
      blob.receiveShadow = true;
      g.add(blob);
    }
    props.add(g);
    contact(props, x, z, 1.8 * s, 0.5);
    return foliageMat;
  }
  const trees = [tree(-3.7, 0.9, 0.9), tree(3.5, 0.7, 1.0), tree(3.0, -3.6, 1.1)];

  // 花箱
  for (const [x, z] of [[-2.9, 2.05], [1.9, 2.05]]) {
    box(props, 1.1, 0.36, 0.42, standard({ color: '#0D1850', roughness: 0.8 }), x, 0.18, z);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), standard({ color: '#0537B4', roughness: 0.9, flatShading: true }));
    bush.position.set(x, 0.55, z);
    bush.castShadow = true;
    props.add(bush);
  }

  // 长椅
  const benchWood = standard({ color: '#6B4A32', roughness: 0.85, metalness: 0 });
  box(props, 1.4, 0.07, 0.42, benchWood, -3.3, 0.45, 2.05);
  box(props, 1.4, 0.36, 0.06, benchWood, -3.3, 0.66, 2.24);
  for (const dx of [-0.58, 0.58]) box(props, 0.06, 0.42, 0.06, metalMat, -3.3 + dx, 0.21, 2.05);

  // 自行车
  const bike = new THREE.Group();
  bike.position.set(2.5, 0, 1.6);
  bike.rotation.y = -0.35;
  for (const dx of [-0.42, 0.42]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 10, 24), metalMat);
    wheel.position.set(dx, 0.25, 0);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    bike.add(wheel);
  }
  box(bike, 0.8, 0.04, 0.04, bladeMat, 0, 0.48, 0);
  box(bike, 0.04, 0.36, 0.04, bladeMat, -0.28, 0.31, 0);
  box(bike, 0.04, 0.52, 0.04, bladeMat, 0.3, 0.33, 0);
  props.add(bike);
  contact(props, 2.5, 1.6, 1.5, 0.45);

  // 邮筒与垃圾桶
  cyl(props, 0.15, 0.17, 0.62, 14, bladeMat, 2.95, 0.31, 2.1);
  cyl(props, 0.16, 0.16, 0.05, 14, metalMat, 2.95, 0.65, 2.1);
  cyl(props, 0.19, 0.17, 0.66, 14, standard({ color: '#1B2350', roughness: 0.7 }), -1.9, 0.33, 2.15);

  // 路牌
  cyl(props, 0.025, 0.025, 1.6, 8, metalMat, -0.6, 0.8, 2.35);
  box(props, 0.56, 0.24, 0.03, standard({ color: '#F4F6FF', roughness: 0.6 }), -0.6, 1.5, 2.35);
  box(props, 0.56, 0.24, 0.03, kleinMat, -0.6, 1.24, 2.35);

  // ── 行人 ────────────────────────────────────────────────────
  const people = [];
  const skinMat = standard({ color: '#E8D6C4', roughness: 0.75 });
  for (let i = 0; i < 5; i += 1) {
    const g = new THREE.Group();
    const coat = standard({ color: i % 3 === 0 ? '#0D1850' : i % 3 === 1 ? '#0C2B92' : '#90072A', roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.62, 6, 14), coat);
    body.position.y = 0.52;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), skinMat);
    head.position.y = 1.02;
    head.castShadow = true;
    g.add(head);
    g.position.set(-3.6 + i * 1.6, 0, 1.35 + (i % 2) * 0.5);
    g.userData = { dir: i % 2 === 0 ? 1 : -1, speed: 0.34 + (i % 3) * 0.1, phase: i * 1.6 };
    block.add(g);
    contact(block, g.position.x, g.position.z, 0.7, 0.35);
    people.push(g);
  }

  // ── 季节粒子 ────────────────────────────────────────────────
  const COUNT = 260;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 1] = Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: new THREE.Color('#F4F6FF'), size: 0.07, transparent: true, opacity: 0.9, depthWrite: false
  });
  materials.push(particleMat);
  const particles = new THREE.Points(particleGeo, particleMat);
  block.add(particles);

  // ── 状态 ────────────────────────────────────────────────────
  let theme = 'day';
  let season = 'spring';
  let intro = 0;
  let time = 0;
  let dragging = false;
  let lastX = 0;
  let azimuthTarget = view.azimuth;
  let parallax = 0;
  let parallaxTarget = 0;

  function applyTheme(next) {
    theme = next;
    const c = next === 'night' ? NIGHT : DAY;
    scene.environment = next === 'night' ? envNight : envDay;
    renderer.toneMappingExposure = c.exposure;
    hemi.color = new THREE.Color(c.hemiSky);
    hemi.groundColor = new THREE.Color(c.hemiGround);
    hemi.intensity = c.hemiI;
    sun.color = new THREE.Color(c.sun);
    sun.intensity = c.sunI;
    rim.intensity = next === 'night' ? 0.22 : 0.55;
    interiorLight.color = new THREE.Color(c.interior);
    interiorLight.intensity = c.interiorI;
    bulbMat.emissiveIntensity = next === 'night' ? 2.2 : 0.5;
    glassMat.opacity = c.glassOpacity;
    glassMat.color = new THREE.Color(c.window);
    for (const lamp of lamps) {
      lamp.head.emissiveIntensity = next === 'night' ? 2.4 : 0;
      lamp.light.intensity = c.lampI;
    }
    signMat.emissiveIntensity = next === 'night' ? 1.1 : 0.12;
    upperGlass.emissive = new THREE.Color(next === 'night' ? '#FFD9A0' : '#000000');
    upperGlass.emissiveIntensity = next === 'night' ? 1.6 : 0;
    upperGlass.color = new THREE.Color(next === 'night' ? '#7A5B3A' : '#2A3670');
    applySeason(season);
  }

  function applySeason(next) {
    season = next;
    const day = theme === 'day';
    const foliage = day
      ? (next === 'spring' ? '#0C2B92' : next === 'summer' ? '#0537B4' : next === 'autumn' ? '#90072A' : '#EDF1FC')
      : (next === 'winter' ? '#C9D4F2' : '#0B1A52');
    for (const mat of trees) mat.color = new THREE.Color(foliage);
    particleMat.color = new THREE.Color(next === 'autumn' ? '#90072A' : day ? '#F4F6FF' : '#9FB3E8');
    particleMat.size = next === 'winter' ? 0.1 : next === 'autumn' ? 0.1 : 0.06;
    particleMat.opacity = next === 'spring' ? 0.75 : 0.9;
    asphaltMat.envMapIntensity = next === 'winter' ? 1.3 : 0.9;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(320, rect.height);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const size = 4.15;
    camera.left = -size * aspect;
    camera.right = size * aspect;
    camera.top = size;
    camera.bottom = -size;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    const azimuth = view.azimuth + Math.sin(time * 0.16) * 0.025 + parallax * 0.045;
    const polar = view.polar;
    const radius = view.radius;
    camera.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth)
    );
    camera.lookAt(target);
    camera.zoom = (0.88 + 0.12 * (1 - Math.pow(1 - Math.min(1, intro), 3))) * view.zoom;
    camera.updateProjectionMatrix();
  }

  function step(dt) {
    time += dt;
    intro = Math.min(1, intro + dt / 1.7);
    parallax += (parallaxTarget - parallax) * Math.min(1, dt * 3);
    view.azimuth += (azimuthTarget - view.azimuth) * Math.min(1, dt * 6);

    for (const person of people) {
      const data = person.userData;
      person.position.x += data.dir * data.speed * dt;
      if (person.position.x > 4.3) person.position.x = -4.3;
      if (person.position.x < -4.3) person.position.x = 4.3;
      person.position.y = Math.abs(Math.sin(time * 5 + data.phase)) * 0.025;
    }

    const pos = particleGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.22) * (season === 'summer' ? 0.3 : 1);
      pos[i * 3] += Math.sin(time * 1.2 + i) * dt * 0.16;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 8;
        pos[i * 3] = (Math.random() - 0.5) * 15;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
    updateCamera();
  }

  function bind() {
    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      parallaxTarget = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      if (!dragging) return;
      const dx = (event.clientX - lastX) / rect.width;
      lastX = event.clientX;
      azimuthTarget = Math.max(-0.85, Math.min(0.85, azimuthTarget - dx * 1.5));
    });
    const end = () => { dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (!dragging) parallaxTarget = 0; });
  }

  resize();
  applyTheme('day');
  applySeason('spring');
  updateCamera();
  bind();

  return {
    scene,
    camera,
    renderer,
    step,
    resize,
    setTheme: applyTheme,
    setSeason: applySeason
  };
}
