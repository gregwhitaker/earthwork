import * as T from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export const clamp = T.MathUtils.clamp;
export const mix = T.MathUtils.lerp;
export const rad = T.MathUtils.degToRad;
export const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export function seeded(seed = 1) {
  return () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent?.add(g);
  return g;
}
export const material = (color, roughness = 0.73, metalness = 0.05, extra = {}) =>
  new T.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const mats = {
  yellow: material('#e9a516', 0.52, 0.24),
  edge: material('#efb635', 0.56, 0.26),
  ochre: material('#a36a13', 0.67, 0.32),
  black: material('#252a27', 0.63, 0.38),
  rubber: material('#222725', 0.91),
  metal: material('#707a75', 0.49, 0.72),
  silver: material('#c0c8c3', 0.25, 0.9),
  pin: material('#707669', 0.39, 0.77),
  dark: material('#34403d', 0.75, 0.31),
  steel: material('#534e42', 0.7, 0.63),
  worn: material('#958a75', 0.53, 0.67),
  soil: material('#60472d', 1),
  white: material('#dfddd0', 0.69, 0.25),
  glass: material('#739da5', 0.12, 0.53),
  red: material('#ab4a27', 0.56, 0.35),
};
export function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const cube = new T.BoxGeometry(1, 1, 1);
export function box(p, x, y, z, w, h, d, mat = mats.black) {
  const a = mesh(p, cube, mat, x, y, z);
  a.scale.set(w, h, d);
  return a;
}
export function rounded(p, x, y, z, w, h, d, r, mat = mats.black) {
  return mesh(p, new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);
}
export function cyl(p, x, y, z, top, bottom, h, mat = mats.black, segments = 16) {
  return mesh(p, new T.CylinderGeometry(top, bottom, h, segments), mat, x, y, z);
}
export function beam(p, a, b, r, mat = mats.black, r2 = r, n = 12) {
  const A = v(...a),
    B = v(...b);
  const m = mesh(p, new T.CylinderGeometry(r2, r, B.distanceTo(A), n), mat);
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(up, B.sub(A).normalize());
  return m;
}
const up = v(0, 1, 0);
export function bar(p, a, b, w, d, mat = mats.black) {
  const A = v(...a),
    B = v(...b);
  const m = box(p, 0, 0, 0, w, B.distanceTo(A), d, mat);
  m.position.addVectors(A, B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(up, B.sub(A).normalize());
  return m;
}
export function tube(p, points, r, mat = mats.rubber) {
  const path = new T.CatmullRomCurve3(points.map((q) => v(...q)));
  return mesh(p, new T.TubeGeometry(path, Math.max(8, points.length * 4), r, 7, false), mat);
}
export function profile(p, points, width, mat = mats.yellow, { z = 0, bevel = 0.025 } = {}) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, z - width / 2);
  return mesh(p, geo, mat);
}
export function crossPin(p, x, y, z, length, r = 0.12) {
  beam(p, [x, y, z - length / 2], [x, y, z + length / 2], r, mats.pin);
  for (const side of [-1, 1]) {
    const end = z + (side * length) / 2;
    beam(p, [x, y, end], [x, y, end + side * 0.025], r * 0.62, mats.dark, r * 0.62, 6);
  }
}
export function makeCanvasTexture(width, height, paint) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  paint(c.getContext('2d'), width, height);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function placard(p, x, y, z, w, h, texture, rotation = 0) {
  const material = new T.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 0.7,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: T.DoubleSide,
  });
  const m = mesh(p, new T.PlaneGeometry(w, h), material, x, y, z);
  m.rotation.y = rotation;
  m.castShadow = false;
  return m;
}
export function wording(
  label,
  { fg = '#eee3bc', bg = '', sub = '', align = 'center', italics = false } = {}
) {
  return makeCanvasTexture(768, 192, (c, w, h) => {
    if (bg) {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
    }
    c.fillStyle = fg;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.font = `${italics ? 'italic ' : ''}bold ${sub ? 93 : 119}px "Arial Narrow", Arial, sans-serif`;
    c.fillText(label, align === 'center' ? w / 2 : 16, sub ? h * 0.38 : h * 0.53, w * 0.94);
    if (sub) {
      c.font = 'bold 36px monospace';
      c.fillText(sub, w / 2, h * 0.79, w * 0.92);
    }
  });
}
// Bake each rigid assembly by material. Moving joints keep their own local frames.
export function batch(root) {
  root.updateWorldMatrix(true, true);
  const inverse = new T.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.isInstancedMesh) return;
    const key = o.material.uuid + o.castShadow + o.receiveShadow;
    let item = groups.get(key);
    if (!item) {
      item = {
        mat: o.material,
        cast: o.castShadow,
        receive: o.receiveShadow,
        parts: [],
        original: [],
      };
      groups.set(key, item);
    }
    const xform = new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld);
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(xform);
    item.parts.push(geo);
    item.original.push(o);
  });
  for (const item of groups.values()) {
    const g = mergeGeometries(item.parts);
    if (!g) continue;
    for (const obj of item.original) obj.removeFromParent();
    const m = new T.Mesh(g, item.mat);
    m.castShadow = item.cast;
    m.receiveShadow = item.receive;
    root.add(m);
    item.parts.forEach((g) => g.dispose());
  }
  return root;
}
// A low-resolution rear-facing camera gives the operator a live side mirror.
export function rearViewMirror(holder, width, height, offset, direction) {
  const target = new T.WebGLRenderTarget(144, Math.round((144 * height) / width), { samples: 0 });
  target.texture.colorSpace = T.SRGBColorSpace;
  const surface = mesh(
    holder,
    new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: target.texture, color: '#d3dbd7', toneMapped: false }),
    0,
    0,
    offset
  );
  surface.castShadow = surface.receiveShadow = false;
  const uv = surface.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const camera = new T.PerspectiveCamera(70, width / height, 0.06, 360);
  camera.position.set(0, 0, offset + 0.1);
  camera.lookAt(camera.position.clone().add(v(...direction)));
  holder.add(camera);
  return { surface, camera, target };
}
// The rotating reflector shows through a ribbed amber lens. Its halo follows the same phase.
const amberBase = material('#352f22', 0.54, 0.44),
  amberRim = material('#ad6418', 0.45, 0.45);
let glowMap;
export function beacon(parent, x, y, z, phase) {
  const g = group(parent, x, y, z);
  g.name = 'Roof beacon';
  cyl(g, 0, 0.035, 0, 0.13, 0.15, 0.07, amberBase);
  cyl(g, 0, 0.082, 0, 0.112, 0.128, 0.045, amberRim);
  const lens = material('#ffa91f', 0.23, 0.18, { emissive: '#ff8a09', emissiveIntensity: 0.3 });
  const bulb = cyl(g, 0, 0.164, 0, 0.09, 0.108, 0.145, lens, 20);
  bulb.name = 'Amber lens';
  cyl(g, 0, 0.246, 0, 0.062, 0.09, 0.024, lens, 20);
  for (let i = 0; i < 3; i++)
    cyl(g, 0, 0.122 + i * 0.041, 0, 0.11 - i * 0.004, 0.11 - i * 0.004, 0.008, amberRim, 20);
  if (!glowMap)
    glowMap = makeCanvasTexture(96, 96, (c, w, h) => {
      const grd = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grd.addColorStop(0, '#fff5b4');
      grd.addColorStop(0.17, '#ffbf46c9');
      grd.addColorStop(0.45, '#ff920541');
      grd.addColorStop(1, '#ff8d0000');
      c.fillStyle = grd;
      c.fillRect(0, 0, w, h);
    });
  const halo = new T.Sprite(
    new T.SpriteMaterial({
      map: glowMap,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
  );
  halo.position.y = 0.18;
  halo.scale.set(0.72, 0.72, 1);
  g.add(halo);
  const light = new T.PointLight(0xff9f24, 0.12, 1.7, 2);
  light.position.y = 0.19;
  g.add(light);
  return (time, reduced) => {
    const t = Math.max(0, Math.cos((time * 0.8 + phase) * Math.PI * 2));
    const bright = reduced ? 0.25 + 0.075 * t : Math.pow(t, 4);
    lens.emissiveIntensity = 0.24 + bright * 3.1;
    halo.material.opacity = 0.08 + bright * 0.84;
    light.intensity = 0.05 + bright * 0.67;
  };
}
