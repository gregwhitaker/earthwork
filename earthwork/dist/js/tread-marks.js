import * as T from 'three';

// The belt mesh and its ground impressions use the same shoe geometry, in metres.
export const TRACK_GAUGE = 2.12,
  TRACK_WIDTH = 0.69,
  TRACK_RUN = 3.52,
  TRACK_RADIUS = 0.39;
export const SHOE_COUNT = 48,
  SHOE_PITCH = (2 * (TRACK_RUN + Math.PI * TRACK_RADIUS)) / SHOE_COUNT;
const saturate = (value) => Math.max(0, Math.min(1, value));

export class TreadMarks {
  constructor(groundSize) {
    this.groundSize = groundSize;
    this.resolution = 2048;
    this.scale = this.resolution / groundSize;
    this.depth = new Uint8Array(this.resolution ** 2);
    this.texture = new T.DataTexture(this.depth, this.resolution, this.resolution, T.RedFormat);
    this.texture.name = 'Crawler impressions';
    this.texture.minFilter = this.texture.magFilter = T.LinearFilter;
    this.texture.needsUpdate = true;
    // This second view stays on the CPU. WebGL uploads just the changed rectangle.
    this.source = new T.DataTexture(this.depth, this.resolution, this.resolution, T.RedFormat);
    this.dirty = new T.Box2();
    this.lastDistance = [NaN, NaN];
  }
  record(chassis, distances) {
    if (
      distances.every((distance, i) => Math.abs(distance - this.lastDistance[i]) < SHOE_PITCH * 0.4)
    )
      return;
    const yaw = chassis.rotation.y,
      cos = Math.cos(yaw),
      sin = Math.sin(yaw);
    for (let i = 0; i < 2; i++) {
      const offset = (i - 0.5) * TRACK_GAUGE;
      const x = chassis.position.x + cos * offset,
        z = chassis.position.z - sin * offset;
      // A shoe on the lower run stays planted as the chassis moves over it.
      const phase = 1.5 * TRACK_RUN + Math.PI * TRACK_RADIUS - distances[i];
      this.paint(x, z, yaw, TRACK_WIDTH / 2, TRACK_RUN / 2, (across, along, old) => {
        const edge =
          saturate((TRACK_WIDTH / 2 - Math.abs(across)) / 0.042) *
          saturate((TRACK_RUN / 2 - Math.abs(along)) / 0.055);
        const shoe = (along + phase) / SHOE_PITCH;
        const gap = Math.abs(shoe - Math.round(shoe)) * SHOE_PITCH;
        const plate = saturate((0.089 - gap) / 0.025);
        const cleat = saturate((0.049 - gap) / 0.027);
        return Math.max(old, Math.round(edge * (43 + 49 * plate + 155 * cleat)));
      });
      this.lastDistance[i] = distances[i];
    }
  }
  erase(x, z, yaw, acrossRadius, alongRadius) {
    this.paint(x, z, yaw, acrossRadius, alongRadius, (across, along, old) => {
      const q = (across / acrossRadius) ** 2 + (along / alongRadius) ** 2;
      return Math.round(old * saturate((q - 0.8) / 0.2));
    });
  }
  paint(x, z, yaw, halfWidth, halfLength, update) {
    const cos = Math.cos(yaw),
      sin = Math.sin(yaw),
      scale = this.scale;
    const cx = (x + this.groundSize / 2) * scale,
      cz = (z + this.groundSize / 2) * scale;
    const rx = (Math.abs(cos) * halfWidth + Math.abs(sin) * halfLength) * scale;
    const rz = (Math.abs(sin) * halfWidth + Math.abs(cos) * halfLength) * scale;
    const x0 = Math.max(0, Math.floor(cx - rx)),
      x1 = Math.min(this.resolution, Math.ceil(cx + rx));
    const z0 = Math.max(0, Math.floor(cz - rz)),
      z1 = Math.min(this.resolution, Math.ceil(cz + rz));
    let changed = false;
    for (let iz = z0; iz < z1; iz++) {
      const dz = (iz + 0.5 - cz) / scale;
      for (let ix = x0; ix < x1; ix++) {
        const dx = (ix + 0.5 - cx) / scale;
        const across = dx * cos - dz * sin,
          along = dx * sin + dz * cos;
        if (Math.abs(across) > halfWidth || Math.abs(along) > halfLength) continue;
        const index = iz * this.resolution + ix,
          old = this.depth[index];
        const next = update(across, along, old);
        if (next !== old) {
          this.depth[index] = next;
          changed = true;
        }
      }
    }
    if (changed) {
      this.dirty.min.x = Math.min(this.dirty.min.x, x0);
      this.dirty.min.y = Math.min(this.dirty.min.y, z0);
      this.dirty.max.x = Math.max(this.dirty.max.x, x1);
      this.dirty.max.y = Math.max(this.dirty.max.y, z1);
    }
  }
  upload(renderer) {
    if (this.dirty.isEmpty()) return;
    renderer.copyTextureToTexture(this.source, this.texture, this.dirty, this.dirty.min);
    this.dirty.makeEmpty();
  }
  reset() {
    this.depth.fill(0);
    this.lastDistance.fill(NaN);
    this.dirty.makeEmpty();
    this.texture.needsUpdate = true;
  }
}
