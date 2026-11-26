import * as T from 'three';

// Horizontal footprints use the same forward (-Z) convention as the vehicle meshes.
export function footprint(root, halfWidth, halfLength, offsetZ = 0) {
  root.updateWorldMatrix(true, false);
  const m = root.matrixWorld.elements;
  return {
    x: m[12] + m[8] * offsetZ,
    z: m[14] + m[10] * offsetZ,
    cos: m[0],
    sin: m[8],
    halfWidth,
    halfLength,
  };
}
export function fixedFootprint(x, z, halfWidth, halfLength) {
  return { x, z, halfWidth, halfLength, cos: 1, sin: 0 };
}
export function containsPoint(area, x, z) {
  const dx = x - area.x,
    dz = z - area.z;
  return (
    Math.abs(dx * area.cos - dz * area.sin) <= area.halfWidth &&
    Math.abs(dx * area.sin + dz * area.cos) <= area.halfLength
  );
}
export function overlaps(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const c = Math.abs(a.cos * b.cos + a.sin * b.sin),
    s = Math.abs(a.sin * b.cos - a.cos * b.sin);
  return (
    Math.abs(dx * a.cos - dz * a.sin) < a.halfWidth + b.halfWidth * c + b.halfLength * s &&
    Math.abs(dx * a.sin + dz * a.cos) < a.halfLength + b.halfWidth * s + b.halfLength * c &&
    Math.abs(dx * b.cos - dz * b.sin) < b.halfWidth + a.halfWidth * c + a.halfLength * s &&
    Math.abs(dx * b.sin + dz * b.cos) < b.halfLength + a.halfWidth * s + a.halfLength * c
  );
}
export function corners(area) {
  const points = [];
  for (const x of [-area.halfWidth, area.halfWidth])
    for (const z of [-area.halfLength, area.halfLength]) {
      points.push([area.x + x * area.cos + z * area.sin, area.z - x * area.sin + z * area.cos]);
    }
  return points;
}
export function supportHeight(terrain, area) {
  return Math.max(
    terrain.height(area.x, area.z),
    ...corners(area).map(([x, z]) => terrain.height(x, z))
  );
}
export function moveChassis(root, dt, distance, turn, terrain, allowed) {
  const oldYaw = root.rotation.y,
    oldX = root.position.x,
    oldZ = root.position.z;
  let accepted = true;
  if (distance || turn) {
    root.rotation.y += turn;
    root.position.x -= Math.sin(root.rotation.y) * distance;
    root.position.z -= Math.cos(root.rotation.y) * distance;
    accepted = allowed();
    if (!accepted) {
      root.rotation.y = oldYaw;
      root.position.x = oldX;
      root.position.z = oldZ;
    }
  }
  root.position.y = T.MathUtils.damp(
    root.position.y,
    terrain.height(root.position.x, root.position.z),
    5,
    dt
  );
  return accepted;
}
function rollTires(vehicle, marks, oldX, oldZ, oldYaw, direction) {
  const { root, wheels } = vehicle;
  const oldCos = Math.cos(oldYaw),
    oldSin = Math.sin(oldYaw);
  const cos = Math.cos(root.rotation.y),
    sin = Math.sin(root.rotation.y);
  for (const wheel of wheels) {
    const { x, z } = wheel.position;
    const startX = oldX + oldCos * x + oldSin * z,
      startZ = oldZ - oldSin * x + oldCos * z;
    const endX = root.position.x + cos * x + sin * z,
      endZ = root.position.z - sin * x + cos * z;
    const dx = endX - startX,
      dz = endZ - startZ;
    // Inside and outside tires cover different distances in a turn.
    const travel = direction * Math.hypot(dx, dz);
    const yaw = Math.atan2(-direction * dx, -direction * dz);
    const tire = wheel.userData.tire;
    const phase = (Math.PI - wheel.rotation.x) * tire.radius + travel / 2;
    wheel.rotation.x -= travel / tire.radius;
    marks.recordTire(tire, (startX + endX) / 2, (startZ + endZ) / 2, yaw, travel, phase);
  }
}
export function driveChassis(vehicle, dt, throttle, steering, terrain, allowed, handling) {
  vehicle.steer = T.MathUtils.damp(vehicle.steer, steering, handling.steerResponse, dt);
  const target = throttle * (throttle < 0 ? handling.reverse : handling.forward);
  vehicle.speed = T.MathUtils.damp(
    vehicle.speed,
    target,
    throttle ? handling.acceleration : handling.drag,
    dt
  );
  if (Math.abs(vehicle.speed) < 0.018) vehicle.speed = 0;
  const distance = vehicle.speed * dt;
  const { x, z } = vehicle.root.position,
    yaw = vehicle.root.rotation.y;
  if (
    moveChassis(vehicle.root, dt, distance, vehicle.steer * distance * handling.turn, terrain, () =>
      allowed(vehicle)
    )
  ) {
    if (distance) rollTires(vehicle, terrain.treadMarks, x, z, yaw, Math.sign(distance));
    return distance;
  }
  vehicle.speed = 0;
  return 0;
}
