import * as T from 'three';
import { clamp, mix, mats } from './model.js';

function hash(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function noise(x, z) {
  const a = Math.floor(x),
    b = Math.floor(z);
  let u = x - a,
    w = z - b;
  u = u * u * (3 - 2 * u);
  w = w * w * (3 - 2 * w);
  return mix(mix(hash(a, b), hash(a + 1, b), u), mix(hash(a, b + 1), hash(a + 1, b + 1), u), w);
}
const mounds = [
  [-11, -11, 3.9, 3.0, 2.05],
  [-13.4, -10.7, 2.7, 2.1, 1.18],
  [6.7, -12.5, 4.4, 3.15, 1.95],
  [9, -13.6, 2.9, 2.8, 1.6],
  [12.6, 4.5, 4.2, 3.8, 1.96],
  [14.1, 6.6, 3.0, 2.6, 1.47],
  [-12, 12, 4, 3, 2.45],
];
export class Terrain {
  constructor(scene, loader, anisotropy) {
    this.size = 64;
    this.half = 32;
    this.n = 240;
    this.step = this.size / this.n;
    this.stride = this.n + 1;
    const g = (this.geometry = new T.PlaneGeometry(this.size, this.size, this.n, this.n));
    g.rotateX(-Math.PI / 2);
    this.positions = g.attributes.position;
    this.base = new Float32Array(this.positions.count);
    this.disturbed = new Float32Array(this.positions.count);
    this.originalMix = new Float32Array(this.positions.count);
    const colors = new Float32Array(this.positions.count * 3);
    for (let i = 0; i < this.positions.count; i++) {
      const x = this.positions.getX(i),
        z = this.positions.getZ(i);
      let y = (noise(x * 0.8, z * 0.8) - 0.5) * 0.055 + (noise(x * 2.5, z * 2.5) - 0.5) * 0.022;
      let soil = 0.17 + noise(x * 0.23, z * 0.23) * 0.25;
      for (const [cx, cz, rx, rz, h] of mounds) {
        const r = Math.hypot((x - cx) / rx, (z - cz) / rz);
        if (r > 1.35) continue;
        const irregular =
          (noise(x * 1.2, z * 1.2) - 0.5) * 0.17 + (noise(x * 0.5, z * 0.5) - 0.5) * 0.28;
        const body = Math.max(0, 1 - r + irregular);
        y += h * body;
        soil = Math.max(soil, clamp(body * 5, 0, 1));
      }
      this.base[i] = y;
      this.positions.setY(i, y);
      this.originalMix[i] = this.disturbed[i] = soil;
      const tint = 0.85 + noise(x * 0.39, z * 0.39) * 0.17;
      colors.set([tint, tint * 0.975, tint * 0.95], 3 * i);
    }
    g.setAttribute('looseness', new T.BufferAttribute(this.disturbed, 1));
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const tex = (name, color) => {
      const t = loader.load('./assets/' + name);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = Math.min(8, anisotropy);
      if (color) t.colorSpace = T.SRGBColorSpace;
      return t;
    };
    const base = tex('yard-earth.jpg', true),
      normal = tex('yard-earth-normal.jpg', false),
      loose = tex('cut-soil.jpg', true),
      looseNormal = tex('cut-soil-normal.jpg', false);
    mats.soil.map = loose;
    mats.soil.color.set(0xb79a79);
    mats.soil.needsUpdate = true;
    base.repeat.set(12, 12);
    normal.repeat.copy(base.repeat);
    const mat = new T.MeshStandardMaterial({
      map: base,
      normalMap: normal,
      normalScale: new T.Vector2(0.5, 0.5),
      roughness: 0.96,
      vertexColors: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.looseSoil = { value: loose };
      shader.uniforms.looseNormals = { value: looseNormal };
      shader.vertexShader =
        'attribute float looseness; varying float vLoose; varying vec2 vSiteXZ;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n vLoose=looseness; vSiteXZ=position.xz;'
        );
      shader.fragmentShader =
        'uniform sampler2D looseSoil; uniform sampler2D looseNormals; varying float vLoose; varying vec2 vSiteXZ;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
        vec2 uvSite=vMapUv; float f=clamp(vLoose,0.0,1.0);
        vec3 crust=texture2D(map,uvSite).rgb;
        vec3 earth=texture2D(looseSoil,vSiteXZ*.38).rgb * vec3(.87,.76,.68);
        vec3 ground=mix(crust,earth,f);
        float path=vSiteXZ.x+vSiteXZ.y*.32+sin(vSiteXZ.y*.16)*1.32+2.7;
        float tracks=1.0-smoothstep(.16,.29,abs(abs(path)-.93));
        float chevron=fract((vSiteXZ.y-vSiteXZ.x*.25+abs(abs(path)-.93)*.9)*4.2);
        float tread=tracks*(1.0-smoothstep(.28,.53,chevron))*(1.0-smoothstep(.38,.8,f));
        diffuseColor.rgb*=ground*(1.0-.20*tread-.05*tracks);
      `
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        T.ShaderChunk.normal_fragment_maps.replace(
          'texture2D( normalMap, vNormalMapUv ).xyz',
          'mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(looseNormals,vSiteXZ*.38).xyz,clamp(vLoose,0.0,1.0))'
        )
      );
    };
    this.mesh = new T.Mesh(g, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }
  height(x, z, original = false) {
    const gx = clamp((x + this.half) / this.step, 0, this.n - 0.0001),
      gz = clamp((z + this.half) / this.step, 0, this.n - 0.0001);
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      i = iz * this.stride + ix;
    const at = (k) => (original ? this.base[k] : this.positions.getY(k));
    return mix(
      mix(at(i), at(i + 1), gx - ix),
      mix(at(i + this.stride), at(i + this.stride + 1), gx - ix),
      gz - iz
    );
  }
  depth(x, z) {
    return Math.max(0, this.height(x, z, true) - this.height(x, z));
  }
  move(x, z, volume, angle = 0) {
    if (!volume || Math.abs(x) > this.half - 2 || Math.abs(z) > this.half - 2) return 0;
    const digging = volume < 0,
      radius = digging ? 0.87 : Math.max(0.85, Math.cbrt(volume) * 1.22);
    const reach = radius * 1.25;
    const minX = Math.max(0, Math.floor((x - reach + this.half) / this.step)),
      maxX = Math.min(this.n, Math.ceil((x + reach + this.half) / this.step));
    const minZ = Math.max(0, Math.floor((z - reach + this.half) / this.step)),
      maxZ = Math.min(this.n, Math.ceil((z + reach + this.half) / this.step));
    const points = [];
    let sum = 0,
      actual = 0;
    const cs = Math.cos(angle),
      sn = Math.sin(angle);
    for (let iz = minZ; iz <= maxZ; iz++)
      for (let ix = minX; ix <= maxX; ix++) {
        const i = iz * this.stride + ix,
          dx = this.positions.getX(i) - x,
          dz = this.positions.getZ(i) - z;
        const across = cs * dx - sn * dz,
          along = sn * dx + cs * dz;
        const q =
          (across / (radius * (digging ? 0.85 : 1))) ** 2 +
          (along / (radius * (digging ? 1.25 : 1))) ** 2;
        if (q >= 1) continue;
        const w = Math.pow(1 - q, 1.35);
        points.push([i, w]);
        sum += w;
      }
    if (!sum) return 0;
    const area = this.step ** 2;
    for (const [i, w] of points) {
      const old = this.positions.getY(i);
      const next = clamp(old + (volume * w) / (sum * area), -2.65, this.base[i] + 5);
      this.positions.setY(i, next);
      this.disturbed[i] = Math.min(1, this.disturbed[i] + Math.sqrt(w) * 0.92);
      actual += (next - old) * area;
    }
    this.refresh();
    return Math.abs(actual);
  }
  refresh() {
    this.positions.needsUpdate = true;
    this.geometry.attributes.looseness.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }
  reset() {
    for (let i = 0; i < this.base.length; i++) this.positions.setY(i, this.base[i]);
    this.disturbed.set(this.originalMix);
    this.refresh();
  }
}
