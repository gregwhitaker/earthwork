import * as T from 'three';
import { Forklift } from './forklift.js';
import { createCargo, resetCargo, cargoFootprint, deliveredCount } from './cargo.js';
import {
  footprint,
  fixedFootprint,
  overlaps,
  containsPoint,
  corners,
  supportHeight,
} from './driving.js';
import { Terrain } from './terrain.js';
import { makeYard } from './yard.js';
import { Excavator, BUCKET_CAPACITY } from './excavator.js';
import { Truck, TRUCK_CAPACITY } from './truck.js';
import { v, clamp, rad, group, material, mesh } from './model.js';

const shortest = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (t) => t * t * (3 - 2 * t);
const insideYard = (x, z) => Math.abs(x) <= 23.7 && z >= -23.15 && z <= 23.75;
const obstructions = [
  [-0.75, -19.6, 3.15, 1.48],
  [13, -20.8, 3.32, 1.97],
  [4.4, -16.8, 2.85, 1.78],
  [-13.5, -15.1, 3.08, 0.59],
  [12.6, -16.3, 3.16, 0.8],
  [-19, 7.8, 0.65, 3.46],
  [10, 14, 1.58, 0.84],
].map((args) => fixedFootprint(...args));
class DirtParticles {
  constructor(scene) {
    this.max = 110;
    this.cursor = 0;
    this.particles = [];
    this.marker = new T.Object3D();
    this.cloud = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      material('#79563b', 0.96),
      this.max
    );
    this.cloud.frustumCulled = false;
    this.cloud.castShadow = true;
    scene.add(this.cloud);
    for (let i = 0; i < this.max; i++) {
      this.particles.push({ time: 0, p: v(), velocity: v(), size: 0.05, landing: 0 });
      this.marker.scale.setScalar(0);
      this.marker.updateMatrix();
      this.cloud.setMatrixAt(i, this.marker.matrix);
      this.cloud.setColorAt(
        i,
        new T.Color().setRGB(
          0.65 + Math.random() * 0.35,
          0.55 + Math.random() * 0.3,
          0.5 + Math.random() * 0.25
        )
      );
    }
    this.cloud.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  spawn(point, count, landing) {
    for (let j = 0; j < count; j++) {
      const index = this.cursor++ % this.max,
        s = this.particles[index];
      s.p.copy(point);
      s.p.x += (Math.random() - 0.5) * 0.6;
      s.p.z += (Math.random() - 0.5) * 0.6;
      s.velocity.set(
        (Math.random() - 0.5) * 1.35,
        0.2 + Math.random() * 0.95,
        (Math.random() - 0.5) * 1.35
      );
      s.size = 0.025 + Math.random() * 0.065;
      s.time = 1.45;
      s.landing = landing;
    }
  }
  tick(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      const s = this.particles[i];
      if (s.time <= 0) continue;
      dirty = true;
      s.time -= dt;
      s.velocity.y -= 8.8 * dt;
      s.p.addScaledVector(s.velocity, dt);
      if (s.p.y < s.landing) s.time = 0;
      this.marker.scale.setScalar(s.time > 0 ? s.size : 0);
      this.marker.position.copy(s.p);
      this.marker.rotation.y += dt;
      this.marker.updateMatrix();
      this.cloud.setMatrixAt(i, this.marker.matrix);
    }
    if (dirty) this.cloud.instanceMatrix.needsUpdate = true;
  }
  clear() {
    for (const p of this.particles) p.time = 0.001;
    this.tick(0.1);
  }
}
export class Simulation {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.on = callbacks;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#a6c0ca');
    this.scene.fog = new T.FogExp2('#c3c6b1', 0.0065);
    this.camera = new T.PerspectiveCamera(61, 1, 0.055, 700);
    this.camera.rotation.order = 'YXZ';
    const loading = new T.LoadingManager();
    this.ready = new Promise((resolve) => {
      loading.onLoad = resolve;
    });
    const loader = new T.TextureLoader(loading);
    loader.load('./assets/north-yard-sky.jpg', (t) => {
      t.mapping = T.EquirectangularReflectionMapping;
      t.colorSpace = T.SRGBColorSpace;
      this.scene.background = t;
      this.scene.environment = t;
      this.scene.backgroundRotation.y = 2.94;
      this.scene.environmentRotation.y = 2.94;
      this.scene.environmentIntensity = 0.39;
      this.scene.backgroundIntensity = 1.02;
    });
    this.scene.add(new T.HemisphereLight('#e9f1ff', '#b29b79', 1.24));
    this.sun = new T.DirectionalLight('#fff0d4', 2.63);
    this.sun.position.set(-13, 23, 11);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -20,
      right: 20,
      top: 20,
      bottom: -20,
      near: 1,
      far: 75,
    });
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.bias = -0.00022;
    this.scene.add(this.sun, this.sun.target);
    this.terrain = new Terrain(this.scene, loader, this.renderer.capabilities.getMaxAnisotropy());
    this.yard = makeYard(this.scene, this.terrain);
    this.excavator = new Excavator(this.scene);
    this.truck = new Truck(this.scene);
    this.cargo = createCargo(this.scene);
    this.freightCount = this.cargo.filter((load) => load.home.kind).length;
    this.forklift = new Forklift(
      this.scene,
      this.terrain,
      this.cargo,
      callbacks.notice,
      callbacks.sound
    );
    this.machines = { excavator: this.excavator, truck: this.truck, forklift: this.forklift };
    this.dirt = new DirtParticles(this.scene);
    this.footprint = group(this.scene);
    const mark = new T.MeshBasicMaterial({
      color: '#ffcc66',
      transparent: true,
      opacity: 0.79,
      depthWrite: false,
      side: T.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const m = mesh(
        this.footprint,
        new T.RingGeometry(0.39, 0.42, 8, 1, (i * Math.PI) / 2 + 0.13, 0.88),
        mark
      );
      m.rotation.x = -Math.PI / 2;
      m.castShadow = false;
    }
    this.footprint.visible = true;
    this.ray = new T.Raycaster();
    this.keys = new Set();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.paused = false;
    this.time = 0;
    this.reset();
    this.resize();
  }
  reset() {
    this.renderer.shadowMap.needsUpdate = true;
    this.keys.clear();
    this.anim = null;
    this.nextStep = null;
    this.terrain.reset();
    this.excavator.reset(this.terrain.height(0, 0));
    this.truck.reset();
    resetCargo(this.scene, this.terrain, this.cargo);
    this.forklift.reset();
    this.groundVersion = this.terrain.positions.version;
    this.dirt.clear();
    this.loaded = 0;
    this.hauled = 0;
    this.aimedTruck = false;
    this.digSpot = this.excavator.defaultDigSpot();
    this.travelMode = false;
    this.dischargeClock = 0;
    this.vehicle = 'excavator';
    this.mountCamera();
    this.setView(0, 0);
    this.updateMarkers();
  }
  mountCamera() {
    this.excavator.glass.visible = this.vehicle !== 'excavator';
    this.truck.glass.visible = this.vehicle !== 'truck';
    this.machines[this.vehicle].cameraMount.add(this.camera);
    this.camera.position.set(0, 0, 0);
    this.footprint.visible = this.vehicle === 'excavator';
    this.mirrorDue = 0;
    this.setView(0, 0);
  }
  switchTo(name) {
    if (!Object.hasOwn(this.machines, name) || name === this.vehicle) return;
    this.excavator.stopTracks();
    this.forklift.speed = 0;
    this.forklift.steer = 0;
    this.truck.speed = 0;
    this.truck.steer = 0;
    this.keys.clear();
    this.vehicle = name;
    this.mountCamera();
    this.on.changed();
  }
  setTravelMode(enabled) {
    if (this.vehicle !== 'excavator' || this.paused || this.travelMode === enabled) return;
    this.clearInput();
    this.excavator.stopTracks();
    this.travelMode = enabled;
    this.on.changed();
  }
  centerView() {
    this.setView(0, 0);
    if (this.vehicle === 'excavator' && this.travelMode && !this.anim) {
      const angle = Math.abs(shortest(this.excavator.yaw));
      if (angle > 0.005)
        this.startMotion('aim', [{ to: { yaw: 0 }, time: Math.max(0.18, angle / 1.25) }]);
    }
  }
  setView(yaw, pitch) {
    this.lookYaw = clamp(yaw, -Math.PI * 0.99, Math.PI * 0.99);
    this.lookPitch = clamp(pitch, -0.72, 0.84);
    const down = { truck: -0.11, excavator: -0.08, forklift: -0.21 }[this.vehicle];
    const cabOffset =
      this.vehicle === 'excavator' ? rad(6) * clamp((1.35 - this.camera.aspect) / 0.6, 0, 1) : 0;
    this.camera.rotation.set(down + this.lookPitch, this.lookYaw + cabOffset, 0, 'YXZ');
  }
  look(dx, dy) {
    this.setView(this.lookYaw - dx * 0.004, this.lookPitch - dy * 0.0035);
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = w / h;
    const minimumHorizontalFov = 2 * Math.atan(Math.tan(rad(34)) / this.camera.aspect);
    this.camera.fov = clamp(T.MathUtils.radToDeg(minimumHorizontalFov), 67, 95);
    this.camera.updateProjectionMatrix();
    this.setView(this.lookYaw, this.lookPitch);
    this.renderer.setSize(w, h, false);
  }
  clearInput() {
    this.keys.clear();
  }
  axis(positive, negative) {
    return Number(this.keys.has(positive)) - Number(this.keys.has(negative));
  }
  startMotion(name, steps) {
    const keys = ['tipY', 'reach', 'curl', 'yaw'];
    const e = this.excavator;
    e.stopTracks();
    this.anim = { name, steps: steps.map((s) => ({ ...s })), active: null, t: 0 };
    const advance = () => {
      if (!this.anim) return;
      const s = this.anim.steps.shift();
      if (!s) {
        this.anim = null;
        this.on.changed();
        return;
      }
      const from = {},
        to = {};
      for (const k of keys)
        if (s.to[k] !== undefined) {
          from[k] = e[k];
          to[k] = k === 'yaw' ? e[k] + shortest(s.to[k] - e[k]) : s.to[k];
        }
      this.anim.active = { ...s, from, to };
      this.anim.t = 0;
    };
    this.nextStep = advance;
    advance();
    this.on.changed();
  }
  advanceMotion(dt) {
    const anim = this.anim,
      s = anim.active;
    anim.t += dt;
    const t = Math.min(1, anim.t / s.time);
    for (const k of Object.keys(s.to))
      this.excavator[k] = T.MathUtils.lerp(s.from[k], s.to[k], smooth(t));
    this.excavator.update();
    if (t >= 1) {
      s.done?.();
      this.nextStep();
    }
  }
  aimAt(x, z, isTruck = false) {
    if (this.anim || this.paused || this.vehicle !== 'excavator') return false;
    const e = this.excavator,
      t = e.solveTarget(x, z);
    if (!t || t.reach < 2.0 || t.reach > (isTruck ? 7.74 : 7.62)) {
      this.on.notice(
        isTruck
          ? 'Park the truck closer to the excavator.'
          : 'That spot is outside the boom’s reach.'
      );
      return false;
    }
    if (isTruck && (this.truck.tip > 0.08 || this.truck.tipping)) {
      this.on.notice('Lower the truck bed before loading.');
      return false;
    }
    this.setTravelMode(false);
    this.aimedTruck = isTruck;
    const baseHeight = e.chassis.position.y;
    const clearance = isTruck
      ? this.truck.bedCenter().y - baseHeight + 0.54
      : Math.max(1.25, this.terrain.height(x, z) - baseHeight + 1.0);
    this.startMotion('aim', [
      { to: { tipY: Math.max(e.tipY, clearance) }, time: 0.36 },
      {
        to: { yaw: t.yaw, reach: t.reach, tipY: clearance },
        time: 0.66 + Math.abs(shortest(t.yaw - e.yaw)) * 0.23,
      },
    ]);
    return true;
  }
  aimPreset() {
    if (this.excavator.load > 0.005) {
      const p = this.truck.bedCenter();
      this.aimAt(p.x, p.z, true);
    } else {
      const e = this.excavator;
      const last = e.solveTarget(this.digSpot.x, this.digSpot.z);
      const spot =
        last && last.reach >= 2 && last.reach <= 7.62 ? this.digSpot : e.defaultDigSpot();
      this.aimAt(spot.x, spot.z);
    }
  }
  pick(clientX, clientY) {
    if (this.vehicle !== 'excavator' || this.anim || this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(
      {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: 1 - ((clientY - rect.top) / rect.height) * 2,
      },
      this.camera
    );
    const truckHit = this.ray
      .intersectObject(this.truck.root, true)
      .find((h) => h.object.isMesh && h.object.visible);
    const earth = this.ray.intersectObject(this.terrain.mesh, false)[0];
    if (truckHit && (!earth || truckHit.distance < earth.distance)) {
      const p = this.truck.bedCenter();
      this.aimAt(p.x, p.z, true);
      return;
    }
    if (earth) this.aimAt(earth.point.x, earth.point.z);
  }
  scoop() {
    const e = this.excavator,
      p = e.point();
    if (this.truck.overBody(p.x, p.z)) {
      this.aimedTruck = true;
      this.on.changed();
      this.on.notice('Aim at the ground to scoop soil.');
      return;
    }
    if (!this.canWorkGround(p.x, p.z)) {
      this.on.notice('Aim at open ground to dig.');
      return;
    }
    const ground = this.terrain.height(p.x, p.z);
    const surface = ground - e.chassis.position.y;
    if (ground <= -2.58) {
      this.on.notice('Dig alongside the hole to widen it.');
      return;
    }
    this.startMotion('scoop', [
      { to: { tipY: surface + 0.02, curl: 0.46 }, time: 0.56 },
      {
        to: { tipY: surface - 0.19, curl: -0.8 },
        time: 0.48,
        done: () => {
          e.load = this.terrain.move(p.x, p.z, -BUCKET_CAPACITY, e.workingYaw);
          if (e.load > 0) this.digSpot.copy(p);
          this.dirt.spawn(v(p.x, ground + 0.12, p.z), 18, ground - 0.08);
          this.on.sound('dig');
        },
      },
      {
        to: { tipY: Math.min(3.85, Math.max(1.48, surface + 1.3)), curl: -0.91 },
        time: 0.55,
        done: () => {
          this.on.notice(
            e.load > 0.001
              ? 'Soil scooped · Aim at the truck or a spoil pile.'
              : 'Try another patch of ground.'
          );
        },
      },
    ]);
  }
  unloadBucket() {
    const e = this.excavator,
      p = e.point(),
      truck = this.truck;
    const bed = truck.insideBed(p.x, p.z, 0.035);
    if (!bed && !this.canWorkGround(p.x, p.z)) {
      this.on.notice('Move the bucket over open ground or the truck bed.');
      return;
    }
    if (truck.overBody(p.x, p.z) && !bed) {
      this.on.notice('Position the bucket over the open truck bed.');
      return;
    }
    if (bed && (truck.tip > 0.08 || truck.tipping)) {
      this.on.notice('Lower the truck bed before loading.');
      return;
    }
    if (bed && truck.fill >= TRUCK_CAPACITY - 0.001) {
      this.on.notice('The truck is full. Drive it to a dumping spot.');
      return;
    }
    const releaseY = bed
      ? truck.bedCenter().y - e.chassis.position.y + 0.48
      : Math.max(this.terrain.height(p.x, p.z) - e.chassis.position.y + 0.85, e.tipY);
    this.startMotion('dump', [
      { to: { tipY: releaseY }, time: 0.32 },
      { to: { curl: 0.69 }, time: 0.51, done: () => this.transfer(e.point()) },
      { to: { curl: 0.1, tipY: releaseY + 0.08 }, time: 0.4 },
    ]);
  }
  transfer(p) {
    const e = this.excavator,
      t = this.truck,
      bed = t.insideBed(p.x, p.z, 0.055);
    let moved = 0;
    if (bed && t.tip < 0.08 && !t.tipping) {
      moved = Math.min(e.load, TRUCK_CAPACITY - t.fill);
      if (moved < 0.00001) return;
      t.setLoad(t.fill + moved);
      this.loaded += moved;
      this.aimedTruck = true;
      this.dirt.spawn(p, 30, t.root.position.y + 1.45 + (t.fill / TRUCK_CAPACITY) * 0.76);
      this.on.notice('Truck bed loaded · ' + t.fill.toFixed(1) + ' m³ aboard.');
    } else if (!t.overBody(p.x, p.z) && this.canWorkGround(p.x, p.z)) {
      moved = this.terrain.move(p.x, p.z, e.load, e.workingYaw);
      this.dirt.spawn(p, 30, this.terrain.height(p.x, p.z));
      this.aimedTruck = false;
      this.on.notice('Soil deposited on the ground.');
    }
    if (moved <= 0) return;
    e.load = Math.max(0, e.load - moved);
    if (e.load < 0.0001) e.load = 0;
    this.on.sound('drop');
    this.on.changed();
  }
  action() {
    if (this.paused) return;
    if (this.vehicle === 'forklift') {
      this.forklift.action();
      this.on.changed();
      return;
    }
    if (this.vehicle === 'truck') {
      this.toggleTip();
      return;
    }
    if (this.anim) return;
    this.setTravelMode(false);
    if (this.excavator.load > 0.001) this.unloadBucket();
    else this.scoop();
  }
  toggleTip() {
    const t = this.truck;
    if (Math.abs(t.speed) > 0.32) {
      this.on.notice('Bring the truck to a stop before tipping.');
      return;
    }
    t.tipping = !t.tipping;
    this.on.notice(
      t.tipping ? (t.fill ? 'Tipping the load.' : 'Raising the empty bed.') : 'Lowering the bed.'
    );
    this.on.sound('hydraulic');
    this.on.changed();
  }
  get palletsDelivered() {
    return deliveredCount(this.cargo, this.forklift.held);
  }
  canWorkGround(x, z) {
    return (
      insideYard(x, z) &&
      !containsPoint(this.excavator.bodyArea(), x, z) &&
      !containsPoint(this.forklift.bodyArea(), x, z) &&
      !obstructions.some((solid) => containsPoint(solid, x, z)) &&
      !this.cargo.some((load) => containsPoint(cargoFootprint(load), x, z))
    );
  }
  clearYard(area) {
    if (obstructions.some((obstacle) => overlaps(area, obstacle))) return false;
    for (const [x, z] of [[area.x, area.z], ...corners(area)]) {
      if (!insideYard(x, z)) return false;
      const height = this.terrain.height(x, z);
      if (height > 1 || height < -1.1) return false;
    }
    return true;
  }
  canDrive(vehicle) {
    const fork = this.forklift,
      truck = footprint(this.truck.root, 1.18, 3.34, -0.1),
      tracks = this.excavator.bodyArea(),
      body = fork.bodyArea(),
      tines = fork.forkArea();
    if (vehicle !== fork) {
      const moving = vehicle === this.truck ? truck : tracks;
      return (
        !overlaps(truck, tracks) &&
        !overlaps(moving, body) &&
        !overlaps(moving, tines) &&
        this.clearYard(moving) &&
        !this.cargo.some((load) => overlaps(moving, cargoFootprint(load)))
      );
    }
    const blocked = (area) =>
      overlaps(area, truck) || overlaps(area, tracks) || !this.clearYard(area);
    if (blocked(body) || blocked(tines)) return false;
    const carried = fork.held && cargoFootprint(fork.held);
    if (carried && blocked(carried)) return false;
    for (const load of this.cargo) {
      if (load === fork.held) continue;
      const pallet = cargoFootprint(load);
      if (overlaps(body, pallet) || (carried && overlaps(carried, pallet))) return false;
      if (
        overlaps(tines, pallet) &&
        fork.root.position.y + fork.height < load.root.position.y + load.height + 0.05 &&
        !fork.canEnter(load)
      )
        return false;
    }
    return true;
  }
  manualArm(dt) {
    const e = this.excavator;
    const swing = this.axis('KeyA', 'KeyD'),
      lift = this.axis('KeyW', 'KeyS'),
      reach = this.axis('ArrowUp', 'ArrowDown'),
      curl = this.axis('KeyE', 'KeyQ');
    if (!(swing || lift || reach || curl)) return;
    const p = e.point(),
      ground = this.terrain.height(p.x, p.z),
      onTruck = this.truck.overBody(p.x, p.z);
    e.yaw += swing * dt * 0.67;
    e.reach = clamp(e.reach + reach * dt * 1.48, 2.08, 7.7);
    e.tipY = clamp(
      e.tipY + lift * dt * 1.44,
      (onTruck ? this.truck.bedCenter().y + 0.12 : ground - 0.2) - e.chassis.position.y,
      4.75
    );
    e.curl = clamp(e.curl + curl * dt * 1.38, -1.22, 0.85);
    e.update();
    const end = e.point();
    this.aimedTruck = this.truck.insideBed(end.x, end.z);
    if (
      curl < 0 &&
      e.curl < -0.62 &&
      e.load < 0.001 &&
      !this.truck.overBody(end.x, end.z) &&
      this.canWorkGround(end.x, end.z) &&
      end.y <= this.terrain.height(end.x, end.z) + 0.17
    ) {
      e.load = this.terrain.move(end.x, end.z, -BUCKET_CAPACITY, e.workingYaw);
      if (e.load > 0) this.digSpot.copy(end);
      this.dirt.spawn(end, 14, ground - 0.1);
      this.on.sound('dig');
      this.on.changed();
    }
    if (curl > 0 && e.curl > 0.49 && e.load > 0.001) this.transfer(end);
  }
  tipBed(dt) {
    const t = this.truck,
      target = t.tipping ? rad(49) : 0;
    const next = t.tip + Math.sign(target - t.tip) * Math.min(Math.abs(target - t.tip), dt * 0.49);
    if (Math.abs(next - t.tip) > 0.000001) {
      t.tip = next;
      t.updateBed();
    }
    if (t.tip < rad(24) || !t.tipping || t.fill <= 0.00001) {
      this.dischargeClock = 0;
      return;
    }
    this.dischargeClock += dt;
    if (this.dischargeClock < 0.18) return;
    const chunk = Math.min(t.fill, this.dischargeClock * (0.28 + t.tip * 0.95));
    this.dischargeClock = 0;
    const p = t.dischargePoint(),
      ground = this.terrain.height(p.x, p.z);
    const moved = this.terrain.move(p.x, p.z, chunk, t.root.rotation.y);
    t.setLoad(Math.max(0, t.fill - moved));
    if (t.fill < 0.0001) t.setLoad(0);
    this.hauled += moved;
    this.dirt.spawn(v(p.x, Math.max(ground + 0.1, t.root.position.y + 1.4), p.z), 14, ground);
    if (!t.fill) this.on.notice('Truck unloaded · Lower the bed to drive.');
    this.on.changed();
  }
  updateMarkers() {
    const p = this.excavator.point();
    this.footprint.position.set(
      p.x,
      this.truck.insideBed(p.x, p.z)
        ? this.truck.root.position.y + 2.57
        : this.terrain.height(p.x, p.z) + 0.036,
      p.z
    );
  }
  tick(dt) {
    if (this.paused) return;
    this.time += dt;
    if (
      this.anim ||
      this.keys.size ||
      this.excavator.leftSpeed ||
      this.excavator.rightSpeed ||
      Math.abs(this.truck.speed) > 0.01 ||
      Math.abs(this.forklift.speed) > 0.01 ||
      this.forklift.target !== null ||
      this.truck.tipping ||
      this.truck.tip > 0.001
    )
      this.renderer.shadowMap.needsUpdate = true;
    if (this.anim) this.advanceMotion(dt);
    else if (this.vehicle === 'excavator') {
      if (this.travelMode) {
        const e = this.excavator;
        const swing = this.axis('KeyQ', 'KeyE');
        if (swing) {
          e.yaw += swing * dt * 0.67;
          e.update();
        }
        e.drive(dt, this.axis('KeyW', 'KeyS'), this.axis('KeyA', 'KeyD'), this.terrain, (machine) =>
          this.canDrive(machine)
        );
        const p = e.point();
        this.aimedTruck = this.truck.insideBed(p.x, p.z);
      } else this.manualArm(dt);
    }
    if (this.vehicle === 'truck') {
      const t = this.truck;
      const canMove = !t.tipping && t.tip < 0.02;
      t.drive(
        dt,
        canMove ? this.axis('KeyW', 'KeyS') : 0,
        this.axis('KeyA', 'KeyD'),
        this.terrain,
        (x) => this.canDrive(x)
      );
    }
    const operatingForklift = this.vehicle === 'forklift';
    if (operatingForklift) {
      this.forklift.adjustSpacing(dt, this.axis('KeyE', 'KeyQ'));
      this.forklift.drive(dt, this.axis('KeyW', 'KeyS'), this.axis('KeyA', 'KeyD'), (vehicle) =>
        this.canDrive(vehicle)
      );
    }
    this.forklift.lift(dt, operatingForklift ? this.axis('ArrowUp', 'ArrowDown') : 0);
    this.tipBed(dt);
    if (this.groundVersion !== this.terrain.positions.version) {
      this.groundVersion = this.terrain.positions.version;
      for (const load of this.cargo)
        if (load !== this.forklift.held)
          load.root.position.y = supportHeight(this.terrain, cargoFootprint(load));
    }
    this.updateMarkers();
    this.dirt.tick(dt);
    this.excavator.flash(this.time, this.reduced);
    this.truck.flash(this.time, this.reduced);
    this.forklift.flash(this.time, this.reduced);
  }
  heading() {
    const d = this.camera.getWorldDirection(v());
    return ((Math.atan2(d.x, -d.z) * 180) / Math.PI + 360) % 360;
  }
  render() {
    if (this.time >= this.mirrorDue) {
      const owner = this.machines[this.vehicle];
      const mirror = owner.root.userData.mirror;
      mirror.surface.visible = false;
      this.renderer.setRenderTarget(mirror.target);
      this.renderer.render(this.scene, mirror.camera);
      this.renderer.setRenderTarget(null);
      mirror.surface.visible = true;
      this.mirrorDue = this.time + 0.16;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
