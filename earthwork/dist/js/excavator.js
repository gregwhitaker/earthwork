import * as T from 'three';
import {
  v,
  group,
  box,
  rounded,
  cyl,
  beam,
  bar,
  tube,
  profile,
  mesh,
  crossPin,
  material,
  mats,
  placard,
  wording,
  makeCanvasTexture,
  batch,
  beacon,
  rearViewMirror,
  clamp,
  seeded,
} from './model.js';

export const BUCKET_CAPACITY = 0.5;
const L1 = 5.15,
  L2 = 3.45,
  baseY = 1.2,
  baseX = 0.7,
  baseZ = -0.19,
  lipX = -0.58,
  lipY = -0.94;
const warning = makeCanvasTexture(384, 160, (c, w, h) => {
  c.fillStyle = '#e7dbbd';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#181c18';
  c.fillRect(3, 3, w - 6, 42);
  c.fillStyle = '#ecc343';
  c.font = 'bold 33px Arial';
  c.fillText('⚠  WARNING', 11, 36);
  c.fillStyle = '#232720';
  for (let i = 0; i < 6; i++) {
    c.fillRect(15, 57 + i * 13, 158 - (i % 3) * 12, 4);
    c.fillRect(200, 57 + i * 13, 152 - (i % 4) * 14, 4);
  }
});
function paintedPlate(p, outline, width, seed) {
  const sx = outline.map((v) => v[0]),
    sy = outline.map((v) => v[1]);
  const minX = Math.min(...sx) - 0.07,
    maxX = Math.max(...sx) + 0.07,
    minY = Math.min(...sy) - 0.07,
    maxY = Math.max(...sy) + 0.07;
  const tex = makeCanvasTexture(1024, 384, (c, w, h) => {
    const r = seeded(seed),
      grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e6ae32');
    grad.addColorStop(0.4, '#e1a022');
    grad.addColorStop(0.79, '#d69a20');
    grad.addColorStop(1, '#bf841e');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7800; i++) {
      c.fillStyle = r() > 0.45 ? 'rgba(91,64,33,.075)' : 'rgba(255,232,163,.10)';
      c.fillRect(r() * w, r() * h, r() * 2.8 + 1, r() * 2.2 + 0.5);
    }
    for (let i = 0; i < 94; i++) {
      const x = r() * w,
        y = r() * h;
      c.strokeStyle = r() > 0.4 ? 'rgba(80,65,42,.19)' : 'rgba(255,232,181,.28)';
      c.lineWidth = 0.4 + r() * 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 3 + r() * 11, y + r() * 3 - 1.5);
      c.stroke();
    }
    c.beginPath();
    outline.forEach(([x, y], i) => {
      const px = ((x - minX) / (maxX - minX)) * w,
        py = ((maxY - y) / (maxY - minY)) * h;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    });
    c.closePath();
    c.lineWidth = 3;
    c.strokeStyle = '#f0bd4a';
    c.stroke();
  });
  const side = material('white', 0.51, 0.28, { map: tex });
  const m = profile(p, outline, width, [side, mats.yellow], { bevel: 0.035 });
  const a = m.geometry.attributes;
  for (let i = 0; i < a.uv.count; i++)
    if (Math.abs(a.normal.getZ(i)) > 0.85)
      a.uv.setXY(
        i,
        (a.position.getX(i) - minX) / (maxX - minX),
        (a.position.getY(i) - minY) / (maxY - minY)
      );
  return m;
}
function boomModel(root) {
  const p = group(root);
  const outline = [
    [-0.2, -0.18],
    [-0.26, 0.11],
    [-0.11, 0.32],
    [0.5, 0.48],
    [1.23, 0.89],
    [1.73, 1.13],
    [2.09, 1.18],
    [2.56, 1.09],
    [3.64, 0.78],
    [4.63, 0.42],
    [5.12, 0.27],
    [5.33, 0.15],
    [5.37, -0.045],
    [5.21, -0.19],
    [4.91, -0.19],
    [3.57, 0.18],
    [2.48, 0.42],
    [1.99, 0.41],
    [1.66, 0.27],
    [0.76, -0.18],
    [0.18, -0.31],
  ];
  paintedPlate(p, outline, 0.48, 89);
  for (const z of [-0.28, 0.28]) {
    profile(
      p,
      [
        [-0.2, -0.19],
        [-0.25, 0.11],
        [-0.07, 0.33],
        [0.32, 0.33],
        [0.64, 0.18],
        [0.45, -0.19],
        [0.14, -0.31],
      ],
      0.055,
      mats.edge,
      { z }
    );
    profile(
      p,
      [
        [4.63, -0.06],
        [4.9, 0.27],
        [5.12, 0.31],
        [5.34, 0.16],
        [5.36, -0.04],
        [5.21, -0.21],
        [4.89, -0.19],
      ],
      0.056,
      mats.edge,
      { z }
    );
  }
  for (let j = 0; j < 3; j++) {
    const z = -0.21 + j * 0.155;
    tube(
      p,
      [
        [0.16, 0.38, z],
        [0.54, 0.66, z],
        [1.14, 1.0, z],
        [1.79, 1.27, z],
        [2.17, 1.3, z],
        [2.71, 1.14, z],
        [3.74, 0.84, z],
        [4.51, 0.62, z],
        [4.93, 0.52, z],
      ],
      0.047,
      mats.rubber
    );
  }
  for (const [x, y, a] of [
    [0.88, 0.84, 0.5],
    [2.21, 1.3, -0.17],
    [3.7, 0.86, -0.29],
    [4.52, 0.63, -0.25],
  ]) {
    const clip = box(p, x, y, 0, 0.1, 0.09, 0.48, mats.pin);
    clip.rotation.z = a;
  }
  placard(
    p,
    2.89,
    0.74,
    -0.282,
    1.44,
    0.26,
    wording('EARTHWORK', { fg: '#232925', italics: true }),
    Math.PI
  ).rotation.z = 0.24;
  placard(p, 1.64, 0.65, -0.283, 0.38, 0.17, warning, Math.PI);
  for (const z of [-0.29, 0.29]) {
    profile(
      p,
      [
        [1.59, 0.57],
        [1.67, 0.38],
        [1.8, 0.23],
        [1.96, 0.17],
        [2.1, 0.25],
        [2.14, 0.49],
        [2.22, 0.62],
      ],
      0.095,
      mats.edge,
      { z }
    );
  }
  crossPin(p, 1.94, 0.32, 0, 1.06, 0.125);
  crossPin(p, 0, 0, 0, 0.76, 0.2);
  crossPin(p, L1, 0, 0, 0.73, 0.17);
  return p;
}
function stickModel(root) {
  const p = group(root);
  const pts = [
    [-0.57, 0.13],
    [-0.5, 0.36],
    [-0.2, 0.48],
    [0.18, 0.43],
    [0.68, 0.33],
    [1.45, 0.24],
    [2.55, 0.16],
    [3.44, 0.15],
    [3.6, 0.07],
    [3.63, -0.1],
    [3.51, -0.22],
    [3.23, -0.22],
    [2.19, -0.28],
    [1.02, -0.37],
    [0.31, -0.37],
    [-0.12, -0.23],
    [-0.45, -0.12],
  ];
  paintedPlate(p, pts, 0.37, 36);
  for (const z of [-0.211, 0.211]) {
    profile(
      p,
      [
        [2.97, -0.18],
        [3.21, 0.14],
        [3.51, 0.16],
        [3.63, 0.04],
        [3.6, -0.12],
        [3.5, -0.23],
        [3.22, -0.23],
      ],
      0.044,
      mats.edge,
      { z }
    );
  }
  for (const z of [-0.12, 0.09])
    tube(
      p,
      [
        [-0.32, 0.38, z],
        [-0.05, 0.57, z],
        [0.42, 0.46, z],
        [0.82, 0.39, z],
        [1.12, 0.32, z],
        [1.57, 0.31, z],
      ],
      0.034,
      mats.rubber
    );
  crossPin(p, L2, 0, 0, 0.58, 0.14);
  crossPin(p, -0.36, 0.14, 0, 0.55, 0.12);
  placard(
    p,
    1.09,
    -0.03,
    -0.226,
    0.72,
    0.19,
    wording('EW 220', { fg: '#252b27', italics: true }),
    Math.PI
  );
  placard(p, 2.27, -0.04, -0.226, 0.33, 0.15, warning, Math.PI);
  return p;
}
const shell = [
  [0.02, 0.048],
  [0.37, 0.03],
  [0.54, -0.12],
  [0.64, -0.37],
  [0.61, -0.59],
  [0.47, -0.77],
  [0.24, -0.88],
  [-0.12, -0.94],
  [-0.52, -0.92],
  [-0.64, -0.85],
];
function bucketModel(root) {
  const p = group(root),
    w = 1.18;
  const profilePts = [
    [-0.08, 0.12],
    [0.33, 0.12],
    ...shell.slice(2),
    [-0.47, -0.61],
    [-0.3, -0.39],
    [-0.18, -0.14],
  ];
  for (const z of [-w / 2, w / 2]) {
    profile(p, profilePts, 0.073, mats.steel, { z, bevel: 0.022 });
    tube(
      p,
      shell.slice(2).map(([x, y]) => [x, y, z + Math.sign(z) * 0.039]),
      0.024,
      mats.worn
    );
  }
  const coords = [],
    uv = [];
  for (let i = 1; i < shell.length; i++) {
    const a = shell[i - 1],
      b = shell[i];
    coords.push(
      a[0],
      a[1],
      -w / 2,
      a[0],
      a[1],
      w / 2,
      b[0],
      b[1],
      w / 2,
      a[0],
      a[1],
      -w / 2,
      b[0],
      b[1],
      w / 2,
      b[0],
      b[1],
      -w / 2
    );
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(coords, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geom.computeVertexNormals();
  const inner = material('#534c40', 0.65, 0.54, { side: T.DoubleSide });
  mesh(p, geom, inner);
  box(p, -0.54, -0.878, 0, 0.22, 0.115, 1.31, mats.worn);
  for (let i = 0; i < 5; i++) {
    const z = -0.49 + i * 0.245;
    profile(
      p,
      [
        [-0.46, -0.81],
        [-0.57, -0.806],
        [-0.77, -0.89],
        [-0.8, -0.947],
        [-0.6, -0.935],
        [-0.46, -0.91],
      ],
      0.115,
      mats.worn,
      { z, bevel: 0.012 }
    );
  }
  for (const z of [-0.33, 0.33]) {
    profile(
      p,
      [
        [-0.21, -0.18],
        [-0.2, 0.08],
        [-0.09, 0.23],
        [0.1, 0.22],
        [0.18, 0.07],
        [0.35, -0.1],
        [0.27, -0.2],
      ],
      0.12,
      mats.dark,
      { z }
    );
  }
  crossPin(p, 0, 0, 0, 0.93, 0.125);
  const soil = mesh(p, new T.SphereGeometry(1, 17, 9), mats.soil, -0.04, -0.56, 0);
  soil.scale.set(0.41, 0.32, 0.53);
  soil.visible = false;
  return { p, soil };
}
function piston(root, a, b, r) {
  const g = group(root);
  const shell = cyl(g, 0, 0, 0, r, r, 1, mats.dark, 16),
    rod = cyl(g, 0, 0, 0, r * 0.6, r * 0.6, 1, mats.silver, 16),
    collar = cyl(g, 0, 0, 0, r * 1.08, r * 1.08, 0.1, mats.pin, 16);
  const start = v(),
    end = v(),
    axis = v(),
    up = v(0, 1, 0);
  return () => {
    a.getWorldPosition(start);
    b.getWorldPosition(end);
    root.worldToLocal(start);
    root.worldToLocal(end);
    axis.subVectors(end, start);
    const distance = axis.length();
    g.position.copy(start);
    g.quaternion.setFromUnitVectors(up, axis.normalize());
    const barrel = Math.min(distance * 0.83, r * 13.8);
    shell.position.y = barrel / 2;
    shell.scale.y = barrel;
    collar.position.y = barrel - 0.03;
    rod.position.y = (barrel + distance) / 2;
    rod.scale.y = Math.max(0.02, distance - barrel);
  };
}
function cab(house) {
  const structure = group(house);
  const x = -1.03;
  const left = -2.25,
    right = 0.2;
  for (const xx of [left, right]) {
    bar(
      structure,
      [xx, 1.38, -0.5],
      [xx + (xx === left ? 0.11 : -0.09), 3.62, -0.38],
      0.083,
      0.103,
      mats.black
    );
    bar(structure, [xx, 1.37, 0.99], [xx, 3.62, 0.99], 0.1, 0.11, mats.black);
    bar(structure, [xx, 3.61, -0.39], [xx, 3.65, 1.03], 0.1, 0.1, mats.dark);
  }
  rounded(structure, x, 3.67, 0.28, 2.52, 0.14, 1.57, 0.032, mats.yellow);
  box(structure, x, 3.58, -0.42, 2.4, 0.085, 0.095, mats.rubber);
  box(structure, x, 1.36, 0.23, 2.13, 0.13, 1.5, mats.dark);
  box(structure, x, 1.61, -0.49, 2.4, 0.15, 0.13, mats.black);
  box(structure, left, 1.6, 0.24, 0.075, 0.46, 1.52, mats.yellow);
  box(structure, left, 2.02, 0.25, 0.07, 0.068, 1.47, mats.black);
  box(structure, x, 2.0, 1.03, 2.14, 0.7, 0.11, mats.yellow);
  box(structure, x, 1.98, 0.58, 0.68, 0.15, 0.67, mats.rubber);
  box(structure, x, 2.22, 0.89, 0.68, 0.53, 0.12, mats.rubber);
  bar(structure, [-0.03, 1.66, -0.516], [-0.69, 1.82, -0.51], 0.026, 0.028, mats.black);
  bar(structure, [-0.7, 1.82, -0.51], [-0.36, 2.25, -0.5], 0.028, 0.022, mats.black);
  box(structure, right + 0.005, 1.88, -0.31, 0.09, 0.25, 0.11, mats.rubber);
  bar(structure, [left + 0.08, 3.2, -0.36], [left - 0.24, 3.31, -0.58], 0.033, 0.037, mats.black);
  const mirror = group(house, left - 0.24, 3.13, -0.58);
  mirror.rotation.y = 0.24;
  rounded(mirror, 0, 0, 0, 0.23, 0.31, 0.055, 0.021, mats.black);
  house.userData.mirror = rearViewMirror(mirror, 0.192, 0.267, 0.03, [0.15, -0.15, 1]);
  batch(structure);
  const glassGroup = group(house);
  const glass = material('#829c9b', 0.18, 0.48, {
    transparent: true,
    opacity: 0.54,
    side: T.DoubleSide,
  });
  box(glassGroup, x, 2.56, -0.436, 2.34, 1.87, 0.015, glass);
  box(glassGroup, left + 0.045, 2.77, 0.28, 0.014, 1.45, 1.37, glass);
  box(glassGroup, x, 2.92, 0.99, 1.96, 1.12, 0.014, glass);
  return glassGroup;
}
function undercarriage(scene, turret) {
  const base = group(scene);
  for (const side of [-1, 1]) {
    const track = group(base, side * 1.06, 0, 0);
    box(track, 0, 0.5, 0, 0.6, 0.7, 3.64, mats.rubber);
    for (const z of [-1.71, -1.0, -0.29, 0.42, 1.13, 1.75]) {
      const wheel = cyl(track, 0, 0.52, z, 0.34, 0.34, 0.65, mats.dark);
      wheel.rotation.z = Math.PI / 2;
      const hub = cyl(track, 0.34 * side, 0.53, z, 0.17, 0.17, 0.05, mats.pin);
      hub.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 19; i++) {
      for (const y of [0.11, 0.89]) {
        const z = -1.76 + i * 0.195;
        box(track, 0, y, z, 0.69, 0.12, 0.158, mats.steel);
        box(track, 0, y + (y > 0.5 ? 0.08 : -0.06), z, 0.69, 0.037, 0.044, mats.worn);
      }
    }
    for (const end of [-1, 1])
      for (let i = 1; i < 6; i++) {
        const a = (i * Math.PI) / 6;
        const pad = box(
          track,
          0,
          0.5 + 0.39 * Math.cos(a),
          end * (1.76 + 0.39 * Math.sin(a)),
          0.69,
          0.13,
          0.17,
          mats.steel
        );
        pad.rotation.x = end * a;
      }
  }
  box(base, 0, 0.67, 0, 1.98, 0.39, 2.51, mats.dark);
  cyl(base, 0, 1.01, 0, 1.26, 1.29, 0.23, mats.pin, 32);
  batch(base);
  const engine = group(turret);
  rounded(engine, 0.08, 1.28, 0.14, 3.3, 0.44, 3.35, 0.09, mats.yellow);
  rounded(engine, 0.18, 1.53, 1.5, 3.21, 0.61, 0.72, 0.14, mats.yellow);
  box(engine, 0.2, 1.37, 1.87, 3.23, 0.19, 0.11, mats.dark);
  rounded(engine, 0.86, 1.72, 0.64, 1.32, 0.59, 1.67, 0.07, mats.yellow);
  for (let i = 0; i < 10; i++)
    box(engine, 0.9, 2.026, 0.16 + i * 0.093, 0.91, 0.018, 0.029, mats.black);
  cyl(engine, 1.2, 2.21, 1.13, 0.065, 0.075, 0.43, mats.dark);
  placard(engine, 0.37, 1.62, 1.867, 1.36, 0.25, wording('EARTHWORK', { fg: '#302b21' }));
  batch(engine);
}
export class Excavator {
  constructor(scene) {
    this.root = group(scene);
    undercarriage(scene, this.root);
    this.glass = cab(this.root);
    this.flash = beacon(this.root, -0.17, 3.75, 0.79, 0.21);
    this.cameraMount = group(this.root, -1.02, 2.97, 0.71);
    this.rig = group(this.root, baseX, baseY, baseZ);
    this.rig.rotation.y = Math.PI / 2;
    this.boom = group(this.rig);
    batch(boomModel(this.boom));
    this.stick = group(this.boom, L1);
    batch(stickModel(this.stick));
    this.bucket = group(this.stick, L2);
    const bucket = bucketModel(this.bucket);
    this.soil = bucket.soil;
    this.soil.removeFromParent();
    batch(bucket.p);
    bucket.p.add(this.soil);
    this.lip = group(this.bucket, lipX, lipY, 0);
    this.actuators = [];
    for (const side of [-1, 1])
      this.actuators.push(
        piston(
          this.rig,
          group(this.rig, -0.11, -0.11, side * 0.41),
          group(this.boom, 1.94, 0.32, side * 0.41),
          0.13
        )
      );
    this.actuators.push(
      piston(this.rig, group(this.boom, 2.26, 1.21, 0), group(this.stick, -0.41, 0.16, 0), 0.135)
    );
    this.actuators.push(
      piston(
        this.rig,
        group(this.stick, 0.59, 0.41, -0.08),
        group(this.bucket, 0.18, 0.19, -0.08),
        0.095
      )
    );
    this.reset();
  }
  reset() {
    this.yaw = 0;
    this.reach = 5.28;
    this.tipY = 0.79;
    this.curl = 0.04;
    this.load = 0;
    this.update();
  }
  solveTarget(x, z) {
    const r = Math.hypot(x, z);
    if (r < baseX) return null;
    const reach = Math.sqrt(r * r - baseX * baseX) + baseZ;
    return { reach, yaw: Math.atan2(-x, -z) + Math.atan2(baseX, reach - baseZ) };
  }
  point() {
    return this.lip.getWorldPosition(v());
  }
  update() {
    this.root.rotation.y = this.yaw;
    const co = Math.cos(this.curl),
      si = Math.sin(this.curl);
    const x = this.reach - (lipX * co - lipY * si),
      y = this.tipY - baseY - (lipX * si + lipY * co);
    const d = clamp(Math.hypot(x, y), L1 - L2 + 0.012, L1 + L2 - 0.012);
    const dir = Math.atan2(y, x),
      boomAngle = dir + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const stickAngle = Math.atan2(
      Math.sin(dir) * d - L1 * Math.sin(boomAngle),
      Math.cos(dir) * d - L1 * Math.cos(boomAngle)
    );
    this.boom.rotation.z = boomAngle;
    this.stick.rotation.z = stickAngle - boomAngle;
    this.bucket.rotation.z = this.curl - stickAngle;
    this.soil.visible = this.load > 0.003;
    this.root.updateWorldMatrix(true, true);
    this.actuators.forEach((f) => f());
  }
}
