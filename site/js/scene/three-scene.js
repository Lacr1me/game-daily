// 三维微缩街景：柔光、接触阴影、可切换季节与昼夜。three.js 已内置在 vendor/three。
import * as THREE from '../../../vendor/three/three.module.min.js';

const COLORS = {
  day: {
    sky: '#F4F6FF',
    ground: '#F4F6FF',
    groundSide: '#C3CCEE',
    road: '#0C2B92',
    roadLine: '#F4F6FF',
    walk: '#E6EAFB',
    wall: '#F4F6FF',
    wallSide: '#DCE2F7',
    trim: '#0D1850',
    klein: '#0537B4',
    kleinDeep: '#0C2B92',
    blade: '#90072A',
    glass: '#9FB3E8',
    foliage: '#0C2B92',
    trunk: '#0D1850',
    lamp: '#F4F6FF',
    window: '#C9D4F2'
  },
  night: {
    sky: '#0A0F2E',
    ground: '#0D1850',
    groundSide: '#080C24',
    road: '#080C24',
    roadLine: '#2C3FA0',
    walk: '#0A1D6C',
    wall: '#12245E',
    wallSide: '#0D1850',
    trim: '#050A1E',
    klein: '#0C2B92',
    kleinDeep: '#0A1D6C',
    blade: '#90072A',
    glass: '#F4F6FF',
    foliage: '#0F2266',
    trunk: '#050A1E',
    lamp: '#FFFFFF',
    window: '#FFF4D8'
  }
};

const SEASON = {
  spring: { foliage: 'day:#0C2B92', accent: '#F4F6FF' },
  summer: { foliage: 'day:#0537B4', accent: '#F4F6FF' },
  autumn: { foliage: 'day:#90072A', accent: '#90072A' },
  winter: { foliage: 'day:#E9EDFB', accent: '#F4F6FF' }
};

function mat(color, { rough = 0.92, metal = 0, emissive = null, emissiveIntensity = 0 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: rough,
    metalness: metal,
    emissive: emissive ? new THREE.Color(emissive) : new THREE.Color('#000000'),
    emissiveIntensity
  });
}

export function createExperience({ canvas, stage }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = null;

  const camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 120);
  const target = new THREE.Vector3(0, 2.0, 0.5);
  const cameraState = { azimuth: 0.52, polar: 1.12, radius: 30, zoom: 1 };

  const hemi = new THREE.HemisphereLight('#FFFFFF', '#7C8CC7', 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#FFFFFF', 3.6);
  sun.position.set(7, 13, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 45;
  sun.shadow.bias = -0.0007;
  sun.shadow.radius = 3;
  scene.add(sun);

  const fill = new THREE.DirectionalLight('#B9C4EE', 0.7);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  const world = new THREE.Group();
  scene.add(world);

  const materials = [];
  function M(color, opts) {
    const m = mat(color, opts);
    materials.push(m);
    return m;
  }

  function addBox(parent, w, h, d, material, x, y, z, { cast = true, receive = true, rotY = 0 } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, rTop, rBottom, h, segments, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // ── 地块：切角方台 ──────────────────────────────────────────
  const block = new THREE.Group();
  world.add(block);

  const shape = new THREE.Shape();
  const S = 4.6;
  const C = 0.7;
  shape.moveTo(-S + C, -S);
  shape.lineTo(S, -S);
  shape.lineTo(S, S - C);
  shape.lineTo(S - C, S);
  shape.lineTo(-S, S);
  shape.lineTo(-S, -S + C);
  shape.closePath();
  const extrude = new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false });
  extrude.rotateX(-Math.PI / 2);
  const platform = new THREE.Mesh(extrude, M('#F4F6FF'));
  platform.position.y = -1.05;
  platform.castShadow = true;
  platform.receiveShadow = true;
  block.add(platform);

  // 人行道与马路
  addBox(block, 8.6, 0.06, 3.2, M('#E6EAFB'), 0, 0.03, 2.2, { cast: false });
  addBox(block, 8.6, 0.04, 2.0, M('#0C2B92'), 0, 0.02, 4.6, { cast: false });
  for (let i = 0; i < 7; i += 1) {
    addBox(block, 0.42, 0.05, 0.9, M('#F4F6FF'), -2.1 + i * 0.7, 0.045, 4.6, { cast: false });
  }
  addBox(block, 8.6, 0.03, 0.08, M('#90072A'), 0, 0.045, 3.7, { cast: false });

  // ── 小店 ───────────────────────────────────────────────────
  const shop = new THREE.Group();
  shop.position.set(-0.3, 0, 0.2);
  block.add(shop);

  const wall = M('#F4F6FF');
  const wallSide = M('#DCE2F7');
  const trim = M('#0D1850');
  const klein = M('#0537B4');
  const kleinDeep = M('#0C2B92');
  const bladeM = M('#90072A');
  const glassDay = M('#9FB3E8', { rough: 0.25, metal: 0.15 });
  const glassNight = M('#FFF4D8', { rough: 0.35, emissive: '#FFF4D8', emissiveIntensity: 0.9 });

  // 一层
  addBox(shop, 4.0, 2.6, 3.2, wall, 0, 1.3, 0);
  addBox(shop, 4.02, 0.18, 3.22, klein, 0, 2.56, 0);
  // 二层
  addBox(shop, 3.8, 2.2, 3.0, wall, 0, 3.7, -0.05);
  addBox(shop, 3.86, 0.16, 3.06, klein, 0, 4.86, -0.05);
  // 屋顶
  addBox(shop, 3.96, 0.14, 3.12, trim, 0, 4.95, -0.05);
  addBox(shop, 0.5, 0.34, 0.5, wallSide, 1.1, 5.2, -0.4);
  addBox(shop, 0.34, 0.5, 0.34, wallSide, -1.1, 5.28, -0.8);
  addBox(shop, 0.1, 0.9, 0.1, trim, -1.6, 5.5, 0.6);

  // 一楼橱窗与门（正面朝 +z）
  const front = 1.62;
  addBox(shop, 2.1, 1.7, 0.08, glassDay, -0.75, 1.35, front);
  addBox(shop, 2.2, 0.1, 0.14, trim, -0.75, 2.24, front + 0.02);
  addBox(shop, 2.2, 0.1, 0.14, trim, -0.75, 0.5, front + 0.02);
  addBox(shop, 0.08, 1.74, 0.14, trim, -1.8, 1.35, front + 0.02);
  addBox(shop, 0.08, 1.74, 0.14, trim, 0.3, 1.35, front + 0.02);
  addBox(shop, 0.06, 1.7, 0.12, trim, -0.75, 1.35, front + 0.02);

  addBox(shop, 1.0, 2.0, 0.1, bladeM, 1.3, 1.0, front + 0.02);
  addBox(shop, 0.7, 1.72, 0.12, glassDay, 1.3, 1.02, front + 0.08);
  addBox(shop, 0.08, 0.5, 0.08, M('#F4F6FF'), 1.62, 1.0, front + 0.15);

  // 遮阳篷：斜向红白条纹，贴着墙面
  const awning = new THREE.Group();
  awning.position.set(0, 2.34, front + 0.02);
  shop.add(awning);
  for (let i = 0; i < 8; i += 1) {
    const stripe = i % 2 === 0 ? M('#F4F6FF') : bladeM;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.335, 0.05, 1.04), stripe);
    mesh.position.set(-1.99 + i * 0.335 + 0.1675, -0.16, 0.52);
    mesh.rotation.x = -0.3;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    awning.add(mesh);
  }
  addBox(shop, 2.72, 0.1, 0.06, trim, -0.66, 2.36, front + 0.05);

  // 招牌
  addBox(shop, 2.9, 0.56, 0.1, new THREE.MeshStandardMaterial({
    color: new THREE.Color('#F4F6FF'), emissive: new THREE.Color('#F4F6FF'), emissiveIntensity: 0.1, roughness: 0.85
  }), -0.6, 2.8, front + 0.05);
  addBox(shop, 0.34, 0.44, 0.12, bladeM, -1.9, 2.8, front + 0.07);
  for (let i = 0; i < 4; i += 1) {
    addBox(shop, 0.3, 0.1, 0.12, trim, -1.36 + i * 0.44, 2.86, front + 0.07);
  }

  // 二楼窗
  for (const x of [-1.05, 0.45]) {
    addBox(shop, 1.15, 1.25, 0.08, glassDay, x, 3.75, 1.52);
    addBox(shop, 1.26, 0.1, 0.12, trim, x, 4.42, 1.54);
    addBox(shop, 1.26, 0.1, 0.12, trim, x, 3.08, 1.54);
    addBox(shop, 0.08, 1.3, 0.12, trim, x - 0.58, 3.75, 1.54);
    addBox(shop, 0.08, 1.3, 0.12, trim, x + 0.58, 3.75, 1.54);
  }
  // 侧窗
  addBox(shop, 0.08, 1.2, 1.1, glassDay, 1.98, 3.75, -0.3);
  addBox(shop, 0.08, 1.2, 1.0, glassDay, -1.98, 3.75, -0.3);
  addBox(shop, 0.05, 1.3, 1.15, trim, -2.03, 3.05, -0.3);
  // 侧墙海报与侧门
  addBox(shop, 0.04, 0.9, 0.66, bladeM, 2.02, 1.6, 0.2);
  addBox(shop, 0.05, 0.12, 0.44, M('#F4F6FF'), 2.05, 1.85, 0.2);
  addBox(shop, 0.05, 0.3, 0.44, M('#F4F6FF'), 2.05, 1.35, 0.2);
  addBox(shop, 0.06, 1.5, 0.9, kleinDeep, 2.03, 0.75, -1.05);
  // 门口地垫与门把
  addBox(shop, 0.06, 0.06, 0.06, M('#F4F6FF'), 0.95, 1.0, front + 0.14);
  // 悬挂小招牌
  addBox(shop, 0.5, 0.34, 0.05, kleinDeep, 2.1, 2.5, 1.1);
  addBox(shop, 0.02, 0.3, 0.02, trim, 1.9, 2.85, 1.1);
  addBox(shop, 0.02, 0.3, 0.02, trim, 2.3, 2.85, 1.1);

  // ── 街道物件 ───────────────────────────────────────────────
  const props = new THREE.Group();
  block.add(props);

  function lamp(x, z) {
    addCyl(props, 0.055, 0.075, 3.0, 10, trim, x, 1.5, z);
    addCyl(props, 0.03, 0.03, 0.9, 8, trim, x + 0.42, 2.94, z).rotation.z = Math.PI / 2;
    const head = addBox(props, 0.36, 0.12, 0.26, M('#F4F6FF'), x + 0.8, 2.9, z);
    head.material.emissive = new THREE.Color('#FFF4D8');
    head.material.emissiveIntensity = 0;
    return head;
  }
  const lampHeads = [lamp(-3.5, 2.1), lamp(3.6, 2.1), lamp(0.6, 4.9)];

  function tree(x, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    addCyl(g, 0.11, 0.16, 1.2, 8, M('#0D1850'), 0, 0.6, 0);
    const canopyMat = M('#0C2B92');
    for (const [dx, dy, dz, r] of [[0, 1.55, 0, 0.62], [-0.42, 1.28, 0.12, 0.44], [0.4, 1.34, -0.1, 0.4], [0.05, 1.9, -0.05, 0.36]]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), canopyMat);
      blob.position.set(dx, dy, dz);
      blob.castShadow = true;
      blob.receiveShadow = true;
      g.add(blob);
    }
    props.add(g);
    return { group: g, material: canopyMat };
  }
  const trees = [tree(-3.4, -2.4, 1.0), tree(3.2, -3.0, 1.15), tree(4.2, 1.2, 0.8)];

  // 花盆
  for (const [x, z] of [[-2.6, 1.9], [1.9, 1.9]]) {
    addCyl(props, 0.18, 0.15, 0.34, 8, M('#90072A'), x, 0.17, z);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), M('#0537B4'));
    bush.position.set(x, 0.52, z);
    bush.castShadow = true;
    props.add(bush);
  }

  // 长椅
  addBox(props, 1.4, 0.08, 0.4, M('#0D1850'), -2.6, 0.42, 3.2);
  addBox(props, 1.4, 0.4, 0.06, M('#0D1850'), -2.6, 0.62, 3.4);
  addBox(props, 0.06, 0.42, 0.06, M('#0D1850'), -3.24, 0.21, 3.2);
  addBox(props, 0.06, 0.42, 0.06, M('#0D1850'), -1.96, 0.21, 3.2);

  // 自行车
  const bike = new THREE.Group();
  bike.position.set(2.55, 0, 2.5);
  bike.rotation.y = -0.3;
  const tyre = M('#0D1850');
  for (const dx of [-0.42, 0.42]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 20), tyre);
    wheel.position.set(dx, 0.24, 0);
    wheel.rotation.y = Math.PI / 2;
    wheel.castShadow = true;
    bike.add(wheel);
  }
  addBox(bike, 0.8, 0.05, 0.05, M('#90072A'), 0, 0.46, 0);
  addBox(bike, 0.05, 0.34, 0.05, M('#90072A'), -0.28, 0.3, 0);
  addBox(bike, 0.05, 0.5, 0.05, M('#90072A'), 0.3, 0.32, 0);
  props.add(bike);

  // 电线杆（立在建筑后方，不挡店面）
  addCyl(props, 0.07, 0.1, 4.2, 8, M('#0D1850'), -4.25, 2.1, -1.4);
  const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#0D1850') });
  for (const offset of [4.05, 3.9]) {
    const points = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      points.push(new THREE.Vector3(-4.25 + t * 6.4, offset - Math.sin(t * Math.PI) * 0.22, -1.4 + t * 0.6));
    }
    props.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMat));
  }

  // 邮筒
  addBox(props, 0.26, 0.5, 0.26, M('#90072A'), 2.7, 0.26, 2.0);
  addBox(props, 0.3, 0.06, 0.3, M('#0D1850'), 2.7, 0.53, 2.0);
  addCyl(props, 0.03, 0.03, 0.22, 6, M('#0D1850'), 2.7, 0.11, 2.0);
  // 门口地垫
  addBox(props, 0.9, 0.02, 0.5, M('#0C2B92'), 1.0, 0.02, 2.15);
  // 墙面空调
  for (const x of [-1.1, 1.3]) {
    addBox(props, 0.42, 0.3, 0.24, M('#E6EAFB'), x, 3.0, 1.6);
    addBox(props, 0.34, 0.22, 0.02, M('#0D1850'), x, 3.0, 1.73);
  }
  // 路牌
  addCyl(props, 0.025, 0.025, 1.5, 6, M('#0D1850'), -1.4, 0.75, 3.5);
  addBox(props, 0.5, 0.22, 0.03, M('#F4F6FF'), -1.4, 1.45, 3.5);
  addBox(props, 0.5, 0.22, 0.03, M('#0537B4'), -1.4, 1.2, 3.5);

  // ── 行人 ───────────────────────────────────────────────────
  const people = [];
  const bodyMat = M('#0D1850');
  const headMat = M('#F4F6FF');
  for (let i = 0; i < 5; i += 1) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.26, 4, 8), bodyMat);
    body.position.y = 0.34;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), headMat);
    head.position.y = 0.62;
    head.castShadow = true;
    g.add(head);
    if (i % 2 === 0) {
      const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 8), M('#90072A'));
      scarf.position.y = 0.48;
      g.add(scarf);
    }
    g.position.set(-3.6 + i * 1.7, 0, 2.7 + (i % 2) * 0.8);
    g.userData = { dir: i % 2 === 0 ? 1 : -1, speed: 0.32 + (i % 3) * 0.12, phase: i * 1.7 };
    block.add(g);
    people.push(g);
  }

  // ── 季节粒子 ───────────────────────────────────────────────
  const COUNT = 220;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: new THREE.Color('#F4F6FF'), size: 0.07, transparent: true, opacity: 0.85, depthWrite: false
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  block.add(particles);

  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 13;
    positions[i * 3 + 1] = Math.random() * 7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 13;
    speeds[i] = 0.5 + Math.random() * 1.2;
  }

  // ── 星空 ───────────────────────────────────────────────────
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i += 1) {
    const r = 26 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r + 4;
    starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: new THREE.Color('#FFFFFF'), size: 0.13, transparent: true, opacity: 0, depthWrite: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── 灯光切换用 ─────────────────────────────────────────────
  const lampLights = lampHeads.map((head) => {
    const light = new THREE.PointLight('#FFF4D8', 0, 6, 2);
    light.position.copy(head.position).add(new THREE.Vector3(0, -0.05, 0));
    block.add(light);
    return light;
  });

  const glassMeshes = [];
  shop.traverse((object) => {
    if (object.isMesh && object.material === glassDay) glassMeshes.push(object);
  });

  let theme = 'day';
  let season = 'spring';
  let open = 0;
  let openTarget = 0;
  let intro = 0;
  let time = 0;
  let dragging = false;
  let lastX = 0;
  let azimuthTarget = cameraState.azimuth;
  let parallax = 0;
  let parallaxTarget = 0;

  const glassMaterials = [glassDay];
  const windowMaterials = [glassNight, glassDay];

  function applyTheme(next) {
    theme = next;
    hemi.color = new THREE.Color(theme === 'day' ? '#FFFFFF' : '#5D6FB5');
    hemi.groundColor = new THREE.Color(theme === 'day' ? '#7C8CC7' : '#050A1E');
    hemi.intensity = theme === 'day' ? 1.25 : 0.75;
    sun.color = new THREE.Color(theme === 'day' ? '#FFFFFF' : '#7E91D8');
    sun.intensity = theme === 'day' ? 3.6 : 0.9;
    fill.intensity = theme === 'day' ? 0.55 : 0.2;
    starMat.opacity = theme === 'day' ? 0 : 0.9;
    for (const light of lampLights) light.intensity = theme === 'day' ? 0 : 7;
    for (const head of lampHeads) head.material.emissiveIntensity = theme === 'day' ? 0 : 1.4;
    for (const mesh of glassMeshes) mesh.material = theme === 'day' ? glassDay : glassNight;
    particleMat.color = new THREE.Color(theme === 'day' ? '#F4F6FF' : '#9FB3E8');
    renderer.toneMappingExposure = theme === 'day' ? 1.05 : 1.25;
  }

  function applySeason(next) {
    season = next;
    const c = COLORS[theme];
    const foliage = theme === 'day'
      ? (next === 'spring' ? '#0A1D6C' : next === 'summer' ? '#0C2B92' : next === 'autumn' ? '#90072A' : '#E9EDFB')
      : (next === 'winter' ? '#C9D4F2' : '#0B1A52');
    for (const t of trees) t.material.color = new THREE.Color(foliage);
    particleMat.color = new THREE.Color(next === 'autumn' ? '#90072A' : theme === 'day' ? '#F4F6FF' : '#9FB3E8');
    particleMat.size = next === 'winter' ? 0.09 : next === 'autumn' ? 0.1 : 0.07;
    void c;
  }

  function applyOpen() {
    shop.position.y = -open * 0.0;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(320, rect.height);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewSize = 4.25;
    camera.left = -viewSize * aspect;
    camera.right = viewSize * aspect;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    const radius = cameraState.radius;
    const polar = cameraState.polar;
    const azimuth = cameraState.azimuth + Math.sin(time * 0.18) * 0.03 + parallax * 0.05;
    camera.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth)
    );
    camera.lookAt(target);
    camera.zoom = (0.86 + 0.14 * (1 - Math.pow(1 - Math.min(1, intro), 3))) * cameraState.zoom;
    camera.updateProjectionMatrix();
  }

  function step(dt) {
    time += dt;
    intro = Math.min(1, intro + dt / 1.6);
    open += (openTarget - open) * Math.min(1, dt * 3.2);
    parallax += (parallaxTarget - parallax) * Math.min(1, dt * 3);
    cameraState.azimuth += (azimuthTarget - cameraState.azimuth) * Math.min(1, dt * 5);

    for (const person of people) {
      const data = person.userData;
      person.position.x += data.dir * data.speed * dt;
      if (person.position.x > 4.0) { person.position.x = -4.0; }
      if (person.position.x < -4.0) { person.position.x = 4.0; }
      person.position.y = Math.abs(Math.sin(time * 5 + data.phase)) * 0.03;
    }

    const pos = particleGeo.attributes.position.array;
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3 + 1] -= speeds[i] * dt * (season === 'summer' ? 0.25 : 1);
      pos[i * 3] += Math.sin(time * 1.4 + i) * dt * 0.18;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 7;
        pos[i * 3] = (Math.random() - 0.5) * 13;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 13;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;

    stars.rotation.y = time * 0.01;
    updateCamera();
  }

  function setTheme(next) {
    applyTheme(next);
    applySeason(season);
  }

  function setSeason(next) {
    applySeason(next);
  }

  function setOpen(next) {
    openTarget = next ? 1 : 0;
  }

  function bindInput() {
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
      azimuthTarget = Math.max(-0.9, Math.min(0.9, azimuthTarget - dx * 1.6));
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
  bindInput();

  return {
    scene,
    camera,
    renderer,
    step,
    resize,
    setTheme,
    setSeason,
    setOpen,
    getOpen: () => open,
    dispose() {
      renderer.dispose();
      for (const m of materials) m.dispose();
    }
  };
}
