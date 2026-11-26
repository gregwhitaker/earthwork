import {
  group,
  box,
  rounded,
  cyl,
  batch,
  material,
  mats,
  placard,
  wording,
  makeCanvasTexture,
  seeded,
} from './model.js';
import { footprint, fixedFootprint, containsPoint, corners, supportHeight } from './driving.js';

export const PALLET_WIDTH = 1.34,
  PALLET_DEPTH = 1.16,
  SLOT_TOP = 0.143;
export const DELIVERY_BAY = fixedFootprint(15.8, -5.7, 3.05, 3.15);
const loads = [
  { label: 'Water drums', kind: 'water', x: 7.43, z: -5.7, yaw: -Math.PI / 2 },
  { label: 'Form oil drums', kind: 'oil', x: 7.55, z: -2.96, yaw: -Math.PI / 2 },
  { label: 'Bagged cement', kind: 'cement', x: 7.67, z: -8.49, yaw: -Math.PI / 2 },
  { label: 'Empty pallets', layers: 4, x: -11, z: -17.4, yaw: 0 },
  { label: 'Empty pallets', layers: 2, x: -12.8, z: -18, yaw: 0 },
  { label: 'Empty pallets', layers: 3, x: 11.3, z: 2.4, yaw: 0 },
];
const timberTexture = makeCanvasTexture(256, 64, (c, w, h) => {
  const rand = seeded(560);
  c.fillStyle = '#aa8558';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 250; i++) {
    c.fillStyle = rand() > 0.5 ? 'rgba(78,51,29,.19)' : 'rgba(224,193,150,.18)';
    c.fillRect(rand() * w, rand() * h, 10 + rand() * 100, 0.4 + rand() * 1.1);
  }
});
const timber = material('#ffffff', 0.91, 0.01, { map: timberTexture });
const timberDark = material('#8a6c48', 0.91),
  blue = material('#35677d', 0.53, 0.35),
  red = material('#ab542f', 0.56, 0.29),
  strap = material('#54513c', 0.8, 0.15),
  paper = material('#ccb791', 0.94),
  paperDark = material('#b7a17b', 0.94);
const drumLabels = {
  water: wording('WATER', { sub: 'NORTH YARD', fg: '#e6e4cc', bg: '#31596a' }),
  oil: wording('FORM OIL', { sub: 'NORTH YARD', fg: '#f0dac1', bg: '#884826' }),
};
const cementLabel = wording('CEMENT', { fg: '#3f5148', bg: '#c9bb99' });
function palletBase(p, y) {
  for (const z of [-0.49, 0, 0.49]) box(p, 0, y + 0.018, z, PALLET_WIDTH, 0.036, 0.14, timber);
  for (const x of [-0.54, 0, 0.54])
    for (const z of [-0.48, 0, 0.48]) box(p, x, y + 0.085, z, 0.16, 0.105, 0.17, timberDark);
  for (const x of [-0.54, 0, 0.54]) box(p, x, y + 0.135, 0, 0.16, 0.017, PALLET_DEPTH, timberDark);
  for (let i = 0; i < 6; i++) {
    const z = -0.49 + i * 0.195;
    box(p, 0, y + SLOT_TOP + 0.021, z, PALLET_WIDTH, 0.042, 0.169, timber);
  }
}
function drum(p, x, z, kind) {
  const g = group(p, x, 0.185, z),
    paint = kind === 'water' ? blue : red;
  cyl(g, 0, 0.417, 0, 0.267, 0.267, 0.82, paint, 24);
  for (const y of [0.025, 0.246, 0.587, 0.817]) {
    const rim = cyl(g, 0, y, 0, 0.279, 0.279, 0.026, y < 0.04 || y > 0.8 ? mats.pin : paint, 24);
    rim.castShadow = false;
  }
  cyl(g, 0, 0.831, 0, 0.253, 0.253, 0.018, paint, 24);
  cyl(g, 0.124, 0.847, 0.092, 0.038, 0.038, 0.018, mats.pin, 12);
  cyl(g, -0.125, 0.846, -0.074, 0.02, 0.02, 0.014, mats.dark, 8);
  placard(g, 0, 0.445, 0.27, 0.28, 0.12, drumLabels[kind]);
  placard(g, 0, 0.445, -0.27, 0.28, 0.12, drumLabels[kind], Math.PI);
}
function bagStack(p) {
  for (let row = 0; row < 4; row++) {
    const y = 0.263 + row * 0.158;
    for (const s of [-1, 1]) {
      const bag = rounded(
        p,
        row % 2 ? s * 0.294 : 0,
        y,
        row % 2 ? 0 : s * 0.244,
        row % 2 ? 0.55 : 1.1,
        0.165,
        row % 2 ? 0.93 : 0.453,
        0.071,
        row % 2 ? paperDark : paper
      );
      bag.rotation.y = (row % 2 ? 0.013 : -0.012) * s;
    }
  }
  for (const x of [-0.38, 0.38]) {
    box(p, x, 0.829, 0, 0.035, 0.015, 0.94, strap);
    for (const z of [-0.472, 0.472]) box(p, x, 0.5, z, 0.035, 0.65, 0.013, strap);
  }
  placard(p, 0, 0.582, 0.48, 0.37, 0.104, cementLabel);
}
export function createCargo(scene) {
  return loads.map((home) => {
    const root = group(scene);
    root.name = home.label;
    for (let i = 0; i < (home.layers || 1); i++) palletBase(root, i * 0.185);
    if (home.kind === 'cement') bagStack(root);
    else if (home.kind) {
      for (const x of [-0.32, 0.32])
        for (const z of home.kind === 'water' ? [0.0] : [-0.275, 0.275])
          drum(root, x, z, home.kind);
    }
    batch(root);
    return {
      root,
      home,
      height: home.kind === 'cement' ? 0.86 : home.kind ? 1.04 : home.layers * 0.185,
    };
  });
}
export const cargoFootprint = (load) => footprint(load.root, PALLET_WIDTH / 2, PALLET_DEPTH / 2);
export function resetCargo(scene, terrain, cargo) {
  for (const load of cargo) {
    const { root, home } = load;
    scene.add(root);
    root.rotation.set(0, home.yaw, 0);
    root.position.set(home.x, 0, home.z);
    root.position.y = supportHeight(terrain, cargoFootprint(load));
  }
}
export function deliveredCount(cargo, held) {
  return cargo.filter(
    (load) =>
      load.home.kind &&
      load !== held &&
      corners(cargoFootprint(load)).every(([x, z]) => containsPoint(DELIVERY_BAY, x, z))
  ).length;
}
export function markDeliveryBay(parent, terrain) {
  const b = DELIVERY_BAY,
    paint = material('#d8ae49', 0.96),
    x0 = b.x - b.halfWidth,
    x1 = b.x + b.halfWidth,
    z0 = b.z - b.halfLength,
    z1 = b.z + b.halfLength;
  // Short segments follow the existing ground height across the staging pad.
  for (const x of [x0, x1])
    for (let z = z0 + 0.26; z < z1; z += 0.66)
      box(parent, x, terrain.height(x, z) + 0.027, z, 0.09, 0.018, 0.5, paint);
  for (const z of [z0, z1])
    for (let x = x0 + 0.25; x < x1; x += 0.66)
      box(parent, x, terrain.height(x, z) + 0.027, z, 0.5, 0.018, 0.09, paint);
  for (let z = z0 + 0.3; z < z1 - 0.12; z += 0.52) {
    const m = box(
      parent,
      x0 + 0.25,
      terrain.height(x0 + 0.25, z) + 0.031,
      z,
      0.095,
      0.018,
      0.45,
      paint
    );
    m.rotation.y = -0.65;
  }
  const sign = group(parent, x1 + 0.6, terrain.height(x1 + 0.6, b.z), b.z);
  sign.rotation.y = -Math.PI / 2;
  for (const x of [-0.57, 0.57]) box(sign, x, 0.67, 0, 0.064, 1.35, 0.064, mats.metal);
  rounded(sign, 0, 1.2, 0, 1.72, 0.54, 0.08, 0.018, mats.dark);
  placard(
    sign,
    0,
    1.2,
    0.045,
    1.6,
    0.44,
    wording('PALLET BAY', { fg: '#f6d477', sub: 'NORTH YARD' })
  );
}
