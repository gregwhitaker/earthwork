import * as T from 'three';
import { markDeliveryBay } from './cargo.js';
import {
  group,
  box,
  cyl,
  beam,
  bar,
  mesh,
  material,
  mats,
  makeCanvasTexture,
  wording,
  placard,
  batch,
} from './model.js';
const galvanized = material('#89918b', 0.67, 0.67),
  concrete = material('#aaa899', 0.91),
  lumber = material('#9f7849', 0.87),
  orange = material('#e06523', 0.69),
  chalk = material('#e4d9bb', 0.95);
function cone(root, x, z, scale = 1) {
  const g = group(root, x, 0, z);
  g.scale.setScalar(scale);
  box(g, 0, 0.05, 0, 0.44, 0.095, 0.44, mats.rubber);
  cyl(g, 0, 0.34, 0, 0.043, 0.167, 0.55, orange, 16);
  cyl(g, 0, 0.39, 0, 0.07, 0.099, 0.12, mats.white, 16);
  cyl(g, 0, 0.61, 0, 0.038, 0.043, 0.03, orange, 12);
}
function container(root, x, z, angle, color, label) {
  const g = group(root, x, 0.03, z);
  g.rotation.y = angle;
  const paint = material(color, 0.72, 0.34);
  const w = 6.0,
    d = 2.42,
    h = 2.52;
  box(g, 0, h / 2, 0, w, h, d, paint);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 42; i++)
      box(g, -2.9 + i * 0.141, h / 2, s * (d / 2 + 0.015), 0.05, h - 0.13, 0.061, paint);
    for (const y of [0.1, h - 0.1]) box(g, 0, y, s * (d / 2 + 0.029), w + 0.04, 0.12, 0.085, paint);
    for (const u of [-1, 1]) box(g, u * (w / 2 - 0.02), h / 2, (s * d) / 2, 0.12, h, 0.15, paint);
  }
  for (let i = 0; i < 4; i++) {
    const zz = -0.94 + i * 0.62;
    box(g, -w / 2 - 0.034, 1.21, zz, 0.07, 2.18, 0.04, galvanized);
  }
  for (const side of [-1, 1])
    for (const zz of [-0.83, 0.83])
      box(g, side * (w / 2 + 0.012), 1.28, zz, 0.04, 0.055, 0.3, galvanized);
  if (label) {
    placard(
      g,
      -0.55,
      1.53,
      1.263,
      3.0,
      0.73,
      wording('NORTH YARD', { sub: 'CIVIL WORKS', fg: '#dad6bd' })
    );
    placard(g, 2.43, 1.74, 1.26, 0.52, 0.21, wording('NY · 04', { fg: '#e4d8a3' }));
  }
  return g;
}
function pipeStack(root, x, z) {
  const g = group(root, x, 0, z);
  g.rotation.y = -0.24;
  const r = 0.59,
    inner = 0.456,
    depth = 2.3;
  const pipeColor = material('#b9b6a8', 0.91);
  const inside = material('#74776b', 0.94);
  inside.side = T.BackSide;
  for (const [xx, yy] of [
    [-0.61, r],
    [0.61, r],
    [0, r + 1.035],
  ]) {
    const p = group(g, xx, yy, 0);
    const outer = mesh(p, new T.CylinderGeometry(r, r, depth, 32, 1, true), pipeColor);
    outer.rotation.x = Math.PI / 2;
    const core = mesh(p, new T.CylinderGeometry(inner, inner, depth, 32, 1, true), inside);
    core.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const ring = mesh(p, new T.RingGeometry(inner, r, 32), pipeColor, 0, 0, (s * depth) / 2);
      if (s < 0) ring.rotation.y = Math.PI;
    }
  }
}
function barrier(root, x, z, turn = 0) {
  const g = group(root, x, 0.025, z);
  g.rotation.y = turn;
  const shape = new T.Shape();
  [
    [-0.36, 0],
    [0.36, 0],
    [0.36, 0.15],
    [0.19, 0.55],
    [0.14, 0.84],
    [-0.14, 0.84],
    [-0.19, 0.55],
    [-0.36, 0.15],
  ].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 2.95,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.022,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -1.47);
  const m = mesh(g, geo, concrete);
  m.rotation.y = Math.PI / 2;
  for (const xp of [-1.03, 1.03]) {
    box(g, xp, 0.52, 0.207, 0.22, 0.22, 0.03, mats.white);
    box(g, xp, 0.52, 0.225, 0.14, 0.13, 0.015, orange);
  }
}
function fence(root) {
  const tex = makeCanvasTexture(64, 64, (c) => {
    c.clearRect(0, 0, 64, 64);
    c.lineWidth = 2.8;
    c.strokeStyle = '#767f78';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(64, 64);
    c.moveTo(64, 0);
    c.lineTo(0, 64);
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = '#c9ccc2';
    c.stroke();
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(20, 10);
  const fmat = new T.MeshStandardMaterial({
    map: tex,
    transparent: false,
    alphaTest: 0.34,
    side: T.DoubleSide,
    roughness: 0.86,
  });
  for (const [cx, cz, ang, sections] of [
    [0, -23.7, 0, 12],
    [-24.3, 0.3, Math.PI / 2, 12],
    [24.3, 0.3, Math.PI / 2, 12],
    [0, 24.3, 0, 12],
  ]) {
    const row = group(root, cx, 0, cz);
    row.rotation.y = ang;
    const length = 4.05;
    for (let i = 0; i < sections; i++) {
      const x = (i - sections / 2 + 0.5) * length;
      const panel = mesh(row, new T.PlaneGeometry(length, 1.9), fmat, x, 1.03, 0);
      panel.castShadow = false;
      beam(row, [x - length / 2, 0.1, 0], [x - length / 2, 2.17, 0], 0.043, galvanized);
      beam(row, [x - length / 2, 2.0, 0], [x + length / 2, 2.0, 0], 0.029, galvanized);
    }
  }
}
function crane(root) {
  const g = group(root, -11.5, -0.1, -44);
  g.rotation.y = -0.28;
  const steel = material('#bf953e', 0.7, 0.38),
    wire = material('#4b5048', 0.63, 0.57);
  const h = 17.0,
    r = 0.56;
  for (const x of [-r, r])
    for (const z of [-r, r]) bar(g, [x, 0, z], [x, h, z], 0.105, 0.105, steel);
  for (let i = 0; i < 12; i++) {
    const y = (i * h) / 12;
    for (const z of [-r, r]) {
      bar(g, [-r, y, z], [r, y + h / 12, z], 0.067, 0.067, steel);
      bar(g, [-r, y, z], [r, y, z], 0.07, 0.07, steel);
    }
    for (const x of [-r, r]) bar(g, [x, y, -r], [x, y + h / 12, r], 0.067, 0.067, steel);
  }
  const a = -5,
    b = 19;
  for (const z of [-0.43, 0.43]) beam(g, [a, h, z], [b, h, z], 0.08, steel);
  beam(g, [a, h + 0.93, 0], [b, h + 0.93, 0], 0.075, steel);
  for (let i = a; i < b; i += 1.5)
    for (const z of [-0.43, 0.43]) {
      beam(g, [i, h, z], [i + 0.75, h + 0.93, 0], 0.043, steel);
      beam(g, [i + 0.75, h + 0.93, 0], [i + 1.5, h, z], 0.043, steel);
    }
  bar(g, [0, h + 0.5, 0], [0, h + 3.4, 0], 0.14, 0.14, steel);
  for (const x of [-4, 8, 17]) beam(g, [0, h + 3.4, 0], [x, h + 0.75, 0], 0.027, wire);
  for (let i = 0; i < 3; i++) box(g, -4.7 + i * 0.44, h + 0.1, 0, 0.4, 1.35, 1.29, concrete);
  box(g, 0.98, h - 0.16, 0.55, 1.12, 1.15, 0.92, mats.white);
  box(g, 1.05, h - 0.04, 1.02, 0.83, 0.69, 0.02, mats.glass);
  beam(g, [11, h, 0], [11, h - 6.4, 0], 0.021, wire);
  box(g, 11, h - 6.52, 0, 0.26, 0.31, 0.23, steel);
}
export function makeYard(scene, terrain) {
  const root = group(scene);
  fence(root);
  crane(root);
  container(root, -0.75, -19.6, 0.07, '#43615d', true);
  container(root, 13, -20.8, -0.18, '#995c3e', false);
  pipeStack(root, 3.0, -16.5);
  pipeStack(root, 5.9, -17.1);
  markDeliveryBay(root, terrain);
  for (const [x, z, a] of [
    [-12, -15, 0.08],
    [-15.1, -15.25, 0.08],
    [11, -16, -0.18],
    [14.15, -16.55, -0.18],
    [-19, 6, 1.5],
    [-19, 9.4, 1.5],
    [10, 14, 0.35],
  ])
    barrier(root, x, z, a);
  for (const [x, z, s] of [
    [-1.8, -9.3, 1.1],
    [3.45, -8.8, 1.1],
    [3.65, -2.9, 0.94],
    [-2.35, -2.5, 0.92],
    [-8.1, -14.2, 1.0],
    [-16, -12, 0.9],
    [10.2, -15.4, 0.98],
    [7.6, 9.6, 1],
    [-11, 6, 1],
  ])
    cone(root, x, z, s);
  const marks = group(root);
  const xmin = -1.34,
    xmax = 3.23,
    zmin = -8.55,
    zmax = -3.14;
  for (const x of [xmin, xmax])
    for (const z of [zmin, zmax]) {
      box(marks, x, 0.24, z, 0.049, 0.49, 0.055, lumber);
      box(marks, x, 0.445, z, 0.053, 0.12, 0.06, orange);
    }
  for (const x of [xmin, xmax])
    for (let z = zmin; z < zmax - 0.15; z += 0.58) {
      box(marks, x, terrain.height(x, z) + 0.017, z + 0.16, 0.038, 0.012, 0.33, chalk);
    }
  for (const z of [zmin, zmax])
    for (let x = xmin; x < xmax - 0.15; x += 0.58) {
      box(marks, x + 0.16, terrain.height(x, z) + 0.017, z, 0.33, 0.012, 0.038, chalk);
    }
  const sign = group(root, 3.63, 0, -8.07);
  sign.rotation.y = -0.26;
  box(sign, 0, 0.36, 0, 0.07, 0.72, 0.065, lumber);
  box(sign, 0, 0.71, 0, 1.05, 0.31, 0.065, mats.black);
  placard(sign, 0, 0.713, 0.039, 1, 0.245, wording('DIG AREA', { fg: '#edc35f' }));
  batch(root);
  return root;
}
