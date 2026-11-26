import * as T from 'three';
import {
  group,
  v,
  box,
  rounded,
  mesh,
  cyl,
  bar,
  beam,
  tube,
  profile,
  material,
  mats,
  batch,
  placard,
  wording,
  rearViewMirror,
  beacon,
  clamp,
  rad,
} from './model.js';
import { driveChassis, footprint, overlaps, supportHeight } from './driving.js';
import { cargoFootprint, PALLET_BLOCK, SLOT_TOP } from './cargo.js';

export const MAX_FORK_HEIGHT = 2.72;
const LOW = 0.08,
  CARRY = 0.64;
const TINE_WIDTH = 0.106;
const MIN_SPACING = 0.18,
  MAX_SPACING = 1.02,
  DEFAULT_SPACING = 0.54;
const liftHandling = {
  forward: 3.8,
  reverse: 2.65,
  turn: 0.47,
  acceleration: 1.35,
  drag: 4.0,
  steerResponse: 6.5,
};
const loadedHandling = { ...liftHandling, forward: 2.8, reverse: 2.0 };
const paint = material('#d68928', 0.48, 0.31),
  bright = material('#eda641', 0.52, 0.24),
  frame = material('#3b4542', 0.55, 0.51),
  polished = material('#8d9890', 0.31, 0.69);
function tire(root, x, z, r, depth) {
  const g = group(root, x, r, z),
    side = Math.sign(x);
  const tread = cyl(g, 0, 0, 0, r * 0.98, r * 0.98, depth, mats.rubber, 26);
  tread.rotation.z = Math.PI / 2;
  for (let i = 0; i < 23; i++) {
    const a = (i * 2 * Math.PI) / 23;
    const lug = box(
      g,
      0,
      Math.cos(a) * r * 0.968,
      Math.sin(a) * r * 0.968,
      depth * 1.01,
      r * 0.075,
      0.063,
      mats.rubber
    );
    lug.rotation.x = a;
  }
  const rim = cyl(g, side * depth * 0.51, 0, 0, r * 0.6, r * 0.6, 0.045, bright, 24);
  rim.rotation.z = Math.PI / 2;
  const hub = cyl(g, side * (depth * 0.55 + 0.023), 0, 0, r * 0.25, r * 0.24, 0.045, mats.dark);
  hub.rotation.z = Math.PI / 2;
  for (let n = 0; n < 6; n++) {
    const a = (n * Math.PI) / 3;
    const nut = cyl(
      g,
      side * (depth * 0.55 + 0.035),
      r * 0.38 * Math.cos(a),
      r * 0.38 * Math.sin(a),
      0.022,
      0.022,
      0.021,
      mats.pin,
      6
    );
    nut.rotation.z = Math.PI / 2;
  }
  batch(g);
  return g;
}
function chassis(root) {
  const g = group(root);
  rounded(g, 0, 0.48, 0.075, 1.23, 0.28, 2.25, 0.09, frame);
  rounded(g, 0, 0.72, 0.75, 1.36, 0.56, 1.12, 0.14, paint);
  rounded(g, 0, 0.95, 0.69, 1.25, 0.14, 0.99, 0.045, bright);
  rounded(g, 0, 0.71, 1.31, 1.11, 0.14, 0.07, 0.018, frame);
  placard(g, 0, 0.86, 1.312, 0.69, 0.14, wording('NORTH YARD', { fg: '#302b20' }));
  for (const s of [-1, 1]) {
    rounded(g, s * 0.63, 0.6, -0.65, 0.26, 0.24, 0.77, 0.058, paint);
    box(g, s * 0.65, 0.35, -0.01, 0.18, 0.075, 0.44, mats.pin);
    for (let i = 0; i < 6; i++)
      box(g, s * 0.682, 0.715, 0.53 + i * 0.093, 0.013, 0.16, 0.031, mats.black);
    placard(
      g,
      s * 0.682,
      0.81,
      0.37,
      0.31,
      0.11,
      wording('FL 25', { fg: '#262b24' }),
      (s * Math.PI) / 2
    );
    bar(g, [s * 0.6, 0.72, -0.68], [s * 0.61, 2.28, -0.51], 0.066, 0.074, frame);
    bar(g, [s * 0.59, 0.98, 0.86], [s * 0.59, 2.29, 0.76], 0.075, 0.084, frame);
    bar(g, [s * 0.62, 2.3, -0.58], [s * 0.62, 2.3, 0.82], 0.078, 0.075, frame);
    box(g, s * 0.53, 2.26, -0.58, 0.16, 0.09, 0.1, mats.dark);
    box(g, s * 0.53, 2.26, -0.638, 0.133, 0.062, 0.018, mats.white);
  }
  for (const z of [-0.56, 0.78]) box(g, 0, 2.3, z, 1.31, 0.079, 0.081, frame);
  for (let i = 0; i < 6; i++) box(g, -0.49 + i * 0.198, 2.34, 0.1, 0.068, 0.046, 1.27, frame);
  rounded(g, 0, 0.95, 0.24, 0.52, 0.19, 0.55, 0.065, mats.rubber);
  const back = rounded(g, 0, 1.19, 0.51, 0.53, 0.5, 0.13, 0.069, mats.rubber);
  back.rotation.x = 0.11;
  rounded(g, 0, 1.01, -0.53, 1.08, 0.19, 0.28, 0.051, paint);
  box(g, 0, 1.113, -0.53, 0.99, 0.052, 0.26, mats.dark);
  box(g, 0.28, 1.16, -0.49, 0.25, 0.075, 0.11, mats.black);
  placard(
    g,
    0.282,
    1.166,
    -0.428,
    0.19,
    0.06,
    wording('NY · FL25', { fg: '#bbd4a5', bg: '#2d3934' })
  );
  beam(g, [-0.23, 0.83, -0.49], [-0.23, 1.19, -0.22], 0.043, frame);
  for (let i = 0; i < 3; i++) {
    const x = 0.32 + i * 0.075;
    bar(g, [x, 0.85, -0.04], [x, 0.99, -0.14], 0.022, 0.022, mats.pin);
    const knob = mesh(g, new T.SphereGeometry(0.039, 9, 6), mats.black, x, 0.997, -0.14);
    knob.scale.y = 1.3;
  }
  batch(g);
  const wheel = group(root, -0.23, 1.22, -0.245);
  wheel.rotation.x = -0.48;
  mesh(wheel, new T.TorusGeometry(0.19, 0.021, 9, 30), mats.rubber);
  for (const a of [-Math.PI / 2, 0.49, 2.65])
    bar(wheel, [0, 0, 0], [Math.cos(a) * 0.178, Math.sin(a) * 0.178, 0], 0.025, 0.028, mats.dark);
  rounded(wheel, 0, 0, 0, 0.1, 0.08, 0.049, 0.013, mats.black);
  batch(wheel);
  const mirror = group(root, -0.62, 1.95, -0.5);
  mirror.rotation.y = 0.27;
  rounded(mirror, 0, 0, 0, 0.148, 0.216, 0.044, 0.016, mats.black);
  root.userData.mirror = rearViewMirror(mirror, 0.125, 0.18, 0.029, [0.12, -0.18, 1]);
  return wheel;
}
function mast(root) {
  const fixed = group(root);
  for (const s of [-1, 1]) {
    const x = s * 0.54;
    box(fixed, x, 1.14, -0.94, 0.106, 2.14, 0.14, frame);
    box(fixed, x, 1.14, -1.016, 0.13, 2.14, 0.032, mats.dark);
    box(fixed, x, 1.14, -0.867, 0.13, 2.14, 0.032, mats.dark);
    cyl(fixed, s * 0.43, 0.73, -0.91, 0.045, 0.05, 1.18, mats.black);
    tube(
      fixed,
      [
        [s * 0.43, 0.22, -0.87],
        [s * 0.42, 0.27, -0.78],
        [s * 0.42, 0.5, -0.76],
        [s * 0.43, 0.68, -0.83],
      ],
      0.015,
      mats.rubber
    );
  }
  box(fixed, 0, 2.2, -0.94, 1.19, 0.081, 0.151, frame);
  box(fixed, 0, 0.26, -0.96, 1.19, 0.16, 0.16, frame);
  batch(fixed);
  const telescoping = group(root),
    inner = group(telescoping);
  for (const s of [-1, 1]) {
    box(inner, s * 0.462, 1.16, -1.026, 0.068, 1.97, 0.083, polished);
    box(inner, s * 0.42, 1.14, -1.016, 0.035, 1.94, 0.057, frame);
    cyl(inner, s * 0.43, 1.49, -0.91, 0.023, 0.023, 1.24, mats.silver);
    for (let i = 0; i < 40; i++)
      box(inner, s * 0.412, 0.26 + i * 0.046, -1.078, 0.036, 0.02, 0.022, mats.pin);
    const sheave = cyl(inner, s * 0.432, 2.086, -1.0, 0.073, 0.073, 0.066, mats.dark, 16);
    sheave.rotation.z = Math.PI / 2;
  }
  box(inner, 0, 2.1, -1.028, 1.01, 0.067, 0.086, polished);
  batch(inner);
  const carriage = group(root),
    steel = group(carriage);
  for (const y of [0.18, 0.49]) box(steel, 0, y, -1.095, 1.17, 0.11, 0.095, frame);
  for (const s of [-1, 1]) {
    box(steel, s * 0.58, 0.43, -1.1, 0.05, 0.85, 0.055, frame);
    for (const y of [0.22, 0.49]) {
      const roller = cyl(steel, s * 0.49, y, -1.03, 0.075, 0.075, 0.058, mats.pin);
      roller.rotation.z = Math.PI / 2;
    }
  }
  box(steel, 0, 0.85, -1.1, 1.2, 0.046, 0.055, frame);
  for (const x of [-0.31, 0, 0.31]) box(steel, x, 0.675, -1.1, 0.028, 0.315, 0.041, frame);
  const tines = [-1, 1].map((side) => {
    const fork = group(carriage, (side * DEFAULT_SPACING) / 2, 0, -1.15);
    fork.rotation.y = Math.PI / 2;
    box(fork, -0.055, 0.5, 0, 0.11, 0.12, TINE_WIDTH + 0.035, frame);
    box(fork, -0.042, 0.567, 0, 0.09, 0.018, TINE_WIDTH + 0.014, bright);
    profile(
      fork,
      [
        [-0.073, 0.56],
        [0.016, 0.56],
        [0.017, 0.057],
        [0.074, 0],
        [0.97, 0],
        [1.22, -0.016],
        [1.23, -0.037],
        [0.97, -0.061],
        [0.025, -0.061],
        [-0.073, 0.018],
      ],
      TINE_WIDTH,
      mats.worn,
      { bevel: 0.007 }
    );
    return batch(fork);
  });
  batch(steel);
  return { telescoping, carriage, tines };
}

export class Forklift {
  constructor(scene, terrain, cargo, notice, effect) {
    this.scene = scene;
    this.terrain = terrain;
    this.cargo = cargo;
    this.notice = notice;
    this.effect = effect;
    this.root = group(scene);
    this.root.name = 'Forklift';
    this.steering = chassis(this.root);
    this.wheels = [];
    for (const [z, r, d] of [
      [-0.69, 0.366, 0.22],
      [0.8, 0.277, 0.192],
    ])
      for (const side of [-1, 1]) this.wheels.push(tire(this.root, side * 0.61, z, r, d));
    Object.assign(this, mast(this.root));
    this.cameraMount = group(this.root, -0.055, 1.74, 0.36);
    this.flash = beacon(this.root, 0.47, 2.38, 0.66, 0.04);
    this.reset();
  }
  reset() {
    this.root.position.set(5.4, this.terrain.height(5.4, -5.7), -5.7);
    this.root.rotation.set(0, -Math.PI / 2, 0);
    this.speed = 0;
    this.steer = 0;
    this.held = null;
    this.target = null;
    this.height = LOW;
    this.spacing = DEFAULT_SPACING;
    this.wheels.forEach((w) => w.rotation.set(0, 0, 0));
    this.steering.rotation.z = 0;
    this.pose();
  }
  pose() {
    this.carriage.position.y = this.height;
    this.telescoping.position.y = Math.max(0, this.height - 1.46);
    this.tines[0].position.x = -this.spacing / 2;
    this.tines[1].position.x = this.spacing / 2;
    this.root.updateWorldMatrix(true, true);
  }
  bodyArea() {
    return footprint(this.root, 0.72, 1.2, 0.12);
  }
  forkArea(spacing = this.spacing) {
    return footprint(this.root, (spacing + TINE_WIDTH) / 2, 0.63, -1.75);
  }
  aligned(load, spacing = this.spacing) {
    const area = cargoFootprint(load),
      p = this.root.worldToLocal(v(area.x, 0, area.z));
    if (p.z >= -1.38 || Math.abs(p.x) > 0.235) return false;
    const angle = this.root.rotation.y - Math.atan2(area.sin, area.cos);
    const endOn = Math.abs(Math.cos(angle));
    const sideOn = Math.abs(Math.sin(angle));
    const facing = Math.max(endOn, sideOn);
    if (facing < Math.cos(rad(19))) return false;
    // Each blade must clear the center and outer blocks through the full depth of its pocket.
    const end = endOn >= sideOn;
    const inner = (end ? PALLET_BLOCK.width : PALLET_BLOCK.depth) / 2;
    const outer = (end ? PALLET_BLOCK.x : PALLET_BLOCK.z) - inner;
    const skew = Math.min(endOn, sideOn) * (end ? PALLET_BLOCK.z : PALLET_BLOCK.x);
    const margin = (Math.abs(p.x) + TINE_WIDTH / 2 + skew) / facing;
    const center = spacing / (2 * facing);
    const clearanceTolerance = 0.025;
    return (
      center - margin >= inner - clearanceTolerance && center + margin <= outer + clearanceTolerance
    );
  }
  adjustSpacing(dt, direction) {
    if (!direction) return;
    const next = clamp(this.spacing + direction * 0.42 * dt, MIN_SPACING, MAX_SPACING);
    if (next === this.spacing) return;
    const swept = this.forkArea(Math.max(this.spacing, next));
    const tip = this.root.position.y + this.height;
    for (const load of this.cargo) {
      if (load !== this.held && tip > load.root.position.y + load.height + 0.065) continue;
      if (overlaps(swept, cargoFootprint(load)) && this.aligned(load) && !this.aligned(load, next))
        return;
    }
    this.spacing = next;
    this.pose();
  }
  canEnter(load) {
    if (!this.aligned(load)) return false;
    const tip = this.root.position.y + this.height;
    return tip >= load.root.position.y + 0.015 && tip <= load.root.position.y + SLOT_TOP + 0.036;
  }
  candidate() {
    for (const load of this.cargo) {
      if (!this.canEnter(load)) continue;
      const p = this.root.worldToLocal(load.root.position.clone());
      if (p.z >= -2.18 && p.z <= -1.57) return load;
    }
    return null;
  }
  attach(load) {
    const y = load.root.position.y;
    this.height = y + SLOT_TOP - this.root.position.y;
    this.pose();
    this.carriage.attach(load.root);
    this.held = load;
    this.effect('hydraulic');
    this.notice(load.home.label + ' on the forks.');
  }
  release(y) {
    const load = this.held;
    this.scene.attach(load.root);
    load.root.position.y = y;
    this.held = null;
    this.effect('drop');
    this.notice(load.home.label + ' set down.');
  }
  action() {
    if (this.target !== null) return;
    if (Math.abs(this.speed) > 0.55) {
      this.notice('Stop the forklift to handle a pallet.');
      return;
    }
    if (this.held) {
      this.target = LOW;
      return;
    }
    const load = this.candidate();
    if (!load) {
      this.notice(
        this.height > 0.2
          ? 'Lower the forks before entering the pallet.'
          : 'Line up with both pallet openings. Use Q / E to adjust the fork spacing.'
      );
      return;
    }
    this.attach(load);
    this.target = CARRY;
  }
  lift(dt, direction) {
    if (direction) this.target = null;
    if (!direction && this.target === null) return;
    const goal = direction ? (direction > 0 ? MAX_FORK_HEIGHT : LOW) : this.target;
    const up = goal > this.height;
    if (up && !this.held) {
      const load = this.candidate();
      if (load && this.height + dt * 0.94 >= load.root.position.y + SLOT_TOP - this.root.position.y)
        this.attach(load);
    }
    const next =
      this.height +
      Math.sign(goal - this.height) *
        Math.min(Math.abs(goal - this.height), dt * (up ? 0.91 : 0.77));
    if (!up && this.held) {
      const floor = supportHeight(this.terrain, cargoFootprint(this.held));
      const contact = floor + SLOT_TOP - this.root.position.y;
      if (next <= contact + 0.003) {
        this.height = Math.max(LOW, contact);
        this.pose();
        this.release(floor);
        this.target = direction ? null : LOW;
        return;
      }
    }
    this.height = clamp(next, LOW, MAX_FORK_HEIGHT);
    if (Math.abs(this.height - goal) < 0.001) this.target = null;
    this.pose();
  }
  drive(dt, throttle, steer, allowed) {
    const distance = driveChassis(
      this,
      dt,
      throttle,
      steer,
      this.terrain,
      allowed,
      this.held ? loadedHandling : liftHandling
    );
    this.wheels.forEach((wheel, i) => {
      wheel.rotation.order = 'YXZ';
      wheel.rotation.y = i >= 2 ? -this.steer * 0.61 : 0;
      wheel.rotation.x -= distance / (i < 2 ? 0.366 : 0.277);
    });
    this.steering.rotation.z = this.steer * 1.55;
  }
}
