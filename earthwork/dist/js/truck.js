import * as T from 'three';
import { driveChassis } from './driving.js';
import { tireProfile } from './tread-marks.js';
const handling = {
  forward: 6.2,
  reverse: 3.7,
  turn: 0.157,
  acceleration: 0.7,
  drag: 2.65,
  steerResponse: 5,
};
import {
  v,
  group,
  box,
  rounded,
  cyl,
  beam,
  bar,
  tube,
  mesh,
  profile,
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

export const TRUCK_CAPACITY = 5;
const truckTire = tireProfile(0.594, 0.397, 27, 0.38);
const vermilion = material('#b85230', 0.64, 0.26),
  lip = material('#cd7045', 0.64, 0.3),
  cream = material('#e4dfca', 0.52, 0.28),
  grill = material('#383d37', 0.67, 0.48),
  tyre = material('#272b28', 0.95),
  windowMat = material('#709092', 0.16, 0.5, { transparent: true, opacity: 0.82 });
const bedPanel = material('#ffffff', 0.65, 0.28, {
  map: makeCanvasTexture(768, 256, (c, w, h) => {
    const random = seeded(471);
    const tone = c.createLinearGradient(0, 0, 0, h);
    tone.addColorStop(0, '#be6641');
    tone.addColorStop(0.25, '#b65533');
    tone.addColorStop(0.83, '#ac502e');
    tone.addColorStop(1, '#844a30');
    c.fillStyle = tone;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      c.fillStyle = random() > 0.46 ? 'rgba(250,210,147,.09)' : 'rgba(81,54,29,.12)';
      c.fillRect(random() * w, random() * h, random() * 4 + 0.4, random() * 2 + 1);
    }
    for (let i = 0; i < 90; i++) {
      const x = random() * w,
        y = random() * h;
      c.fillStyle = 'rgba(69,47,30,.09)';
      c.fillRect(x, y, random() * 2.2 + 0.4, 8 + random() * 34);
    }
    for (let i = 0; i < 140; i++) {
      const x = random() * w,
        y = h * (0.72 + random() * 0.28);
      c.fillStyle = 'rgba(212,165,109,.26)';
      c.fillRect(x, y, 1 + random() * 8, 0.5 + random());
    }
  }),
});
function fender(parent, x, z) {
  const points = [];
  for (let i = 0; i <= 14; i++) {
    const a = (Math.PI * i) / 14;
    points.push([Math.cos(a) * 0.71, Math.sin(a) * 0.71]);
  }
  for (let i = 14; i >= 0; i--) {
    const a = (Math.PI * i) / 14;
    points.push([Math.cos(a) * 0.62, Math.sin(a) * 0.62]);
  }
  const p = group(parent, x, 0.603, z);
  p.rotation.y = -Math.PI / 2;
  profile(p, points, 0.39, mats.dark, { bevel: 0.016 });
}
function wheel(body, x, z) {
  const wheel = group(body, x, 0.603, z),
    side = Math.sign(x);
  wheel.userData.tire = truckTire;
  wheel.rotation.order = 'YXZ';
  const { radius, width, lugs, slope, blockLength } = truckTire;
  const tire = cyl(wheel, 0, 0, 0, radius, radius, 0.37, tyre, 32);
  tire.rotation.z = Math.PI / 2;
  const angle = Math.atan(slope);
  for (let i = 0; i < lugs; i++) {
    const a = (i * 2 * Math.PI) / lugs;
    for (const half of [-1, 1]) {
      const tread = box(
        wheel,
        (half * width) / 4,
        Math.cos(a) * 0.573,
        Math.sin(a) * 0.573,
        (width / 2 - 0.01) / Math.cos(angle),
        0.064,
        blockLength,
        mats.rubber
      );
      tread.rotation.set(a, half * angle, 0);
    }
  }
  const sidewall = cyl(wheel, side * 0.19, 0, 0, 0.508, 0.525, 0.045, tyre, 32);
  sidewall.rotation.z = Math.PI / 2;
  const rim = cyl(wheel, side * 0.221, 0, 0, 0.32, 0.32, 0.052, mats.metal, 24);
  rim.rotation.z = Math.PI / 2;
  const inner = cyl(wheel, side * 0.256, 0, 0, 0.232, 0.232, 0.048, mats.dark, 20);
  inner.rotation.z = Math.PI / 2;
  const hub = cyl(wheel, side * 0.291, 0, 0, 0.148, 0.148, 0.045, mats.pin, 16);
  hub.rotation.z = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const nut = cyl(
      wheel,
      side * 0.29,
      0.207 * Math.cos(a),
      0.207 * Math.sin(a),
      0.027,
      0.027,
      0.038,
      mats.silver,
      6
    );
    nut.rotation.z = Math.PI / 2;
  }
  batch(wheel);
  return wheel;
}
function dashboard(cab) {
  const dash = group(cab);
  box(dash, 0, 1.84, -3.14, 2.23, 0.29, 0.48, mats.dark);
  box(dash, -0.57, 1.98, -2.98, 0.73, 0.22, 0.23, mats.black);
  const gauges = makeCanvasTexture(512, 190, (c, w, h) => {
    c.fillStyle = '#222923';
    c.fillRect(0, 0, w, h);
    for (let j = 0; j < 2; j++) {
      const x = 118 + j * 274;
      c.strokeStyle = '#c7cfc2';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, 105, 80, Math.PI * 0.76, Math.PI * 2.24);
      c.stroke();
      for (let i = 0; i < 13; i++) {
        const a = Math.PI * (0.76 + (i * 1.48) / 12);
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 66, 105 + Math.sin(a) * 66);
        c.lineTo(x + Math.cos(a) * 78, 105 + Math.sin(a) * 78);
        c.stroke();
      }
      c.strokeStyle = '#dfad44';
      c.beginPath();
      c.moveTo(x, 105);
      c.lineTo(x - 51, 125);
      c.stroke();
    }
    c.fillStyle = '#a7b0a0';
    c.font = '18px monospace';
    c.fillText('km/h', 93, 140);
    c.fillText('RPM', 375, 140);
  });
  placard(dash, -0.57, 1.99, -2.852, 0.67, 0.2, gauges);
  beam(dash, [-0.54, 1.68, -3], [-0.54, 1.94, -2.64], 0.054, mats.dark);
  const steering = group(cab, -0.54, 1.97, -2.63);
  steering.rotation.x = -0.44;
  mesh(steering, new T.TorusGeometry(0.254, 0.029, 10, 32), mats.rubber);
  for (const a of [Math.PI / 2 + Math.PI, 0, 0.92 * Math.PI])
    bar(steering, [0, 0, 0], [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0], 0.039, 0.043, mats.dark);
  box(steering, 0, 0, 0, 0.15, 0.12, 0.055, mats.rubber);
  batch(steering);
  batch(dash);
  return steering;
}
function bodyModel(root) {
  const g = group(root);
  box(g, 0, 0.78, 0.04, 1.59, 0.3, 6.57, mats.dark);
  for (let s of [-1, 1]) {
    box(g, s * 0.63, 1.04, 0.12, 0.18, 0.31, 6.21, mats.black);
    box(g, s * 1.07, 1.12, -0.45, 0.34, 0.26, 0.67, mats.metal);
    box(g, s * 1.01, 0.75, -2.36, 0.33, 0.12, 0.95, mats.pin);
    box(g, s * 1.13, 0.91, -2.26, 0.16, 0.1, 0.75, grill);
    box(g, s * 1.05, 0.53, 3.02, 0.38, 0.77, 0.07, mats.rubber);
  }
  rounded(g, 0, 1.32, -2.44, 2.29, 0.72, 1.79, 0.09, cream);
  rounded(g, 0, 1.66, -2.42, 2.32, 0.38, 1.82, 0.073, cream);
  box(g, 0, 1.51, -3.345, 1.48, 0.51, 0.055, grill);
  for (let k = 0; k < 5; k++) box(g, 0, 1.34 + k * 0.079, -3.383, 1.39, 0.024, 0.035, mats.metal);
  rounded(g, 0, 1.01, -3.39, 2.35, 0.26, 0.18, 0.044, mats.dark);
  for (const s of [-1, 1]) {
    box(g, s * 0.94, 1.33, -3.376, 0.31, 0.18, 0.047, mats.white);
    box(g, s * 1.09, 1.35, -3.401, 0.067, 0.13, 0.025, lip);
    bar(g, [s * 1.145, 1.82, -3.27], [s * 1.105, 2.99, -3.11], 0.073, 0.09, cream);
    bar(g, [s * 1.14, 1.81, -1.58], [s * 1.11, 2.98, -1.63], 0.084, 0.105, cream);
    bar(g, [s * 1.14, 1.85, -1.97], [s * 1.11, 2.96, -2.01], 0.05, 0.07, mats.black);
    fender(g, s * 1.01, -2.33);
    rounded(g, s * 1.16, 1.76, -2.05, 0.03, 0.049, 0.19, 0.014, mats.black);
    for (const z of [-3.2, -1.78]) box(g, s * 1.156, 1.54, z, 0.014, 0.57, 0.012, mats.pin);
    box(g, s * 1.137, 2.91, -2.4, 0.042, 0.05, 1.41, mats.dark);
    box(g, s * 0.87, 3.113, -3.04, 0.14, 0.044, 0.084, lip);
    box(g, s * 1.17, 1.6, -2.44, 0.018, 0.055, 1.67, vermilion);
    tube(
      g,
      [
        [s * 1.13, 2.6, -3.0],
        [s * 1.41, 2.61, -3.07],
        [s * 1.49, 2.55, -3.03],
        [s * 1.49, 2.38, -3.02],
      ],
      0.023,
      mats.black
    );
    rounded(g, s * 1.49, 2.38, -3.02, 0.155, 0.286, 0.072, 0.018, mats.black);
    if (s < 0) {
      const mirror = group(root, s * 1.49, 2.38, -3.02);
      root.userData.mirror = rearViewMirror(mirror, 0.131, 0.255, 0.041, [-0.23, -0.21, 1]);
    } else box(g, s * 1.49, 2.38, -2.979, 0.128, 0.254, 0.012, mats.silver);
  }
  rounded(g, 0, 3.03, -2.37, 2.34, 0.15, 1.71, 0.057, cream);
  box(g, 0, 2.94, -3.15, 2.31, 0.075, 0.12, mats.dark);
  box(g, 0, 2.35, -1.565, 2.26, 1.22, 0.095, cream);
  box(g, 0, 2.31, -1.5, 1.35, 0.46, 0.035, windowMat);
  box(g, 0, 2.16, -1.46, 0.92, 0.39, 0.04, grill);
  for (const x of [-0.55, 0.57]) {
    box(g, x, 1.57, -2.19, 0.62, 0.16, 0.55, mats.rubber);
    box(g, x, 1.85, -1.9, 0.59, 0.55, 0.13, mats.rubber);
  }
  box(g, 0.91, 2.0, -1.31, 0.11, 1.5, 0.13, mats.pin);
  bar(g, [0.91, 2.76, -1.31], [0.93, 2.87, -1.24], 0.12, 0.12, mats.dark);
  for (const s of [-1, 1]) {
    box(g, s * 0.97, 0.97, 3.23, 0.28, 0.14, 0.09, vermilion);
    box(g, s * 1.06, 1.27, 1.77, 0.46, 0.09, 2.49, mats.black);
  }
  placard(
    g,
    0,
    1.066,
    -3.492,
    0.48,
    0.116,
    wording('N Y  214', { fg: '#24271e', bg: '#e1dcc5' }),
    Math.PI
  );
  const plaque = wording('NORTH YARD', { fg: '#333c37', sub: 'CIVIL WORKS' });
  for (const s of [-1, 1])
    placard(g, s * 1.155, 1.41, -2.42, 0.7, 0.215, plaque, (s * Math.PI) / 2);
  for (const xx of [-0.62, 0.36])
    bar(g, [xx, 1.85, -3.3], [xx + 0.38, 1.99, -3.277], 0.021, 0.02, mats.rubber);
  batch(g);
  const glass = group(root);
  const front = box(glass, 0, 2.38, -3.203, 2.19, 1.08, 0.02, windowMat);
  front.rotation.x = 0.15;
  for (const s of [-1, 1]) box(glass, s * 1.118, 2.39, -2.45, 0.018, 1.04, 1.51, windowMat);
  return glass;
}
const bedWidth = 2.46,
  bedLength = 4.34,
  hingeZ = 3.13,
  floorY = 1.42;
function bedModel(bed) {
  const p = group(bed);
  const mid = -bedLength / 2;
  box(p, 0, 0, mid, bedWidth, 0.13, bedLength, vermilion);
  box(p, 0, 0.074, mid, bedWidth - 0.13, 0.026, bedLength - 0.11, mats.steel);
  for (const s of [-1, 1]) {
    box(p, s * (bedWidth / 2 - 0.055), 0.56, mid, 0.11, 1.12, bedLength, bedPanel);
    box(p, (s * bedWidth) / 2, 0.12, mid, 0.13, 0.105, bedLength + 0.05, lip);
    box(p, (s * bedWidth) / 2, 1.115, mid, 0.13, 0.12, bedLength + 0.08, lip);
    for (let k = 0; k < 6; k++) {
      const z = -0.15 - k * 0.805;
      const rib = bar(
        p,
        [s * (bedWidth / 2 + 0.025), 0.17, z - 0.04],
        [s * (bedWidth / 2 + 0.025), 1.06, z - 0.19],
        0.11,
        0.12,
        lip
      );
    }
    for (let k = 0; k < 7; k++) {
      const z = -0.43 - k * 0.56;
      box(
        p,
        s * (bedWidth / 2 + 0.072),
        0.127,
        z,
        0.012,
        0.046,
        0.17,
        k % 2 ? mats.white : vermilion
      );
    }
    const sticker = wording('NY  /  214', { fg: '#ead7ad' });
    placard(p, s * (bedWidth / 2 + 0.067), 0.65, -2.0, 0.56, 0.16, sticker, (s * Math.PI) / 2);
  }
  box(p, 0, 0.75, -bedLength + 0.05, bedWidth, 1.55, 0.1, vermilion);
  rounded(p, 0, 1.55, -bedLength - 0.23, bedWidth + 0.11, 0.1, 0.62, 0.023, lip);
  batch(p);
  const gate = group(bed, 0, 1.1, -0.018);
  box(gate, 0, -0.48, 0, bedWidth - 0.12, 1.0, 0.102, vermilion);
  for (const x of [-1.05, -0.56, 0, 0.56, 1.05]) box(gate, x, -0.49, 0.065, 0.1, 0.95, 0.095, lip);
  box(gate, 0, -0.95, 0.036, bedWidth - 0.12, 0.1, 0.13, lip);
  batch(gate);
  const geom = new T.PlaneGeometry(bedWidth - 0.19, bedLength - 0.18, 14, 24);
  geom.rotateX(-Math.PI / 2);
  const soil = mesh(bed, geom, mats.soil, 0, 0.086, mid);
  soil.visible = false;
  return { gate, soil };
}
export class Truck {
  constructor(scene) {
    this.root = group(scene);
    this.glass = bodyModel(this.root);
    this.steering = dashboard(this.root);
    this.wheels = [];
    for (const z of [-2.33, 1.26, 2.61])
      for (const s of [-1, 1]) this.wheels.push(wheel(this.root, s * 1.0, z));
    this.bed = group(this.root, 0, floorY, hingeZ);
    Object.assign(this, bedModel(this.bed));
    this.flash = beacon(this.root, -0.42, 3.105, -2.54, 0.68);
    this.cameraMount = group(this.root, -0.43, 2.48, -2.22);
    this.reset();
  }
  reset() {
    this.root.position.set(-3.56, 0, -7.09);
    this.root.rotation.set(0, 1.18, 0);
    this.speed = 0;
    this.steer = 0;
    this.fill = 0;
    this.tip = 0;
    this.tipping = false;
    this.wheels.forEach((wheel) => wheel.rotation.set(0, 0, 0));
    this.steering.rotation.z = 0;
    this.updateBed();
    this.setLoad(0);
    this.root.updateWorldMatrix(true, true);
  }
  updateBed() {
    this.bed.rotation.x = this.tip;
    this.gate.rotation.x = -this.tip * 1.15;
  }
  setLoad(volume) {
    this.fill = clamp(volume, 0, TRUCK_CAPACITY);
    this.soil.visible = this.fill > 0.001;
    if (!this.soil.visible) return;
    const geometry = this.soil.geometry;
    const { width, height, widthSegments, heightSegments } = geometry.parameters;
    const positions = geometry.attributes.position;
    const fraction = this.fill / TRUCK_CAPACITY;
    const spread = Math.cbrt(fraction);
    const baseLayer = 0.48 * Math.max(0, (fraction - 0.42) / 0.58) ** 1.4;
    let totalWeight = 0;
    // Integrate the pile over the bed grid so each bucket contributes its actual volume.
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) / (0.35 + 0.84 * spread);
      const z = positions.getZ(i) / (0.55 + 1.66 * spread);
      const ridge = Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z);
      const weight = baseLayer + ridge * (1 + 0.06 * Math.sin(z * 7 + x * 3));
      positions.setY(i, weight);
      const col = i % (widthSegments + 1),
        row = Math.floor(i / (widthSegments + 1));
      const edgeX = col === 0 || col === widthSegments ? 0.5 : 1;
      const edgeZ = row === 0 || row === heightSegments ? 0.5 : 1;
      totalWeight += weight * edgeX * edgeZ;
    }
    const scale = this.fill / ((totalWeight * width * height) / (widthSegments * heightSegments));
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) * scale);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }
  bedCenter() {
    return this.root.localToWorld(v(0, floorY + 1.18, hingeZ - bedLength / 2));
  }
  insideBed(x, z, margin = 0) {
    const p = this.root.worldToLocal(v(x, this.root.position.y + floorY, z));
    return (
      Math.abs(p.x) < bedWidth / 2 - 0.065 + margin &&
      p.z > hingeZ - bedLength + 0.07 - margin &&
      p.z < hingeZ - 0.07 + margin
    );
  }
  overBody(x, z) {
    const p = this.root.worldToLocal(v(x, this.root.position.y, z));
    return Math.abs(p.x) < 1.27 && p.z > -3.52 && p.z < 3.28;
  }
  dischargePoint() {
    return this.root.localToWorld(v(0, 0.1, hingeZ + 0.83));
  }
  drive(dt, throttle, steering, terrain, allowed) {
    driveChassis(this, dt, throttle, steering, terrain, allowed, handling);
    this.wheels[0].rotation.y = this.wheels[1].rotation.y = this.steer * 0.38;
    this.steering.rotation.z = this.steer * 1.1;
  }
}
