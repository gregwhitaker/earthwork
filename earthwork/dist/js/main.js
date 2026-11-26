import { Simulation } from './simulation.js';
import { EngineSound } from './audio.js';
import { BUCKET_CAPACITY } from './excavator.js';
import { TRUCK_CAPACITY } from './truck.js';
import { MAX_FORK_HEIGHT } from './forklift.js';

const $ = (id) => document.getElementById(id),
  canvas = $('scene'),
  dialog = $('dialog'),
  sound = new EngineSound();
const svg = (id) => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const setIcon = (id, name) =>
  $(id)
    .querySelector('use')
    .setAttribute('href', '#i-' + name);
let toastTimer = 0,
  lastLayout = '',
  lastHeading = '',
  hudSignature = '',
  lastTime,
  wasReady = false;
function notice(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2750);
}
export let game;
const touchInput = matchMedia('(pointer: coarse)').matches;
const controls = {
  excavator: [
    [
      'Swing',
      [
        ['A', 'KeyA', 'Swing left'],
        ['D', 'KeyD', 'Swing right'],
      ],
    ],
    [
      'Boom',
      [
        ['W', 'KeyW', 'Raise boom'],
        ['S', 'KeyS', 'Lower boom'],
      ],
    ],
    [
      'Reach',
      [
        ['↑', 'ArrowUp', 'Extend stick'],
        ['↓', 'ArrowDown', 'Retract stick'],
      ],
    ],
    [
      'Bucket',
      [
        ['Q', 'KeyQ', 'Curl bucket'],
        ['E', 'KeyE', 'Open bucket'],
      ],
    ],
  ],
  truck: [
    [
      'Drive / reverse',
      [
        ['W', 'KeyW', 'Drive forward'],
        ['S', 'KeyS', 'Reverse'],
      ],
    ],
    [
      'Steer',
      [
        ['A', 'KeyA', 'Steer left'],
        ['D', 'KeyD', 'Steer right'],
      ],
    ],
    ['Center view', [['C', 'KeyC', 'Center view']]],
    ['Switch cab', [['V', 'KeyV', 'Switch vehicle']]],
  ],
};
controls.forklift = [
  controls.truck[0],
  controls.truck[1],
  [
    'Fork height',
    [
      ['↑', 'ArrowUp', 'Raise forks'],
      ['↓', 'ArrowDown', 'Lower forks'],
    ],
  ],
  [
    'Fork spacing',
    [
      ['Q', 'KeyQ', 'Move forks closer'],
      ['E', 'KeyE', 'Spread forks apart'],
    ],
  ],
];
const vehicleOrder = Object.keys(controls);
const trackControls = [
  controls.truck[0],
  [
    'Turn tracks',
    [
      ['A', 'KeyA', 'Pivot tracks left'],
      ['D', 'KeyD', 'Pivot tracks right'],
    ],
  ],
  [
    'Swing cab',
    [
      ['Q', 'KeyQ', 'Swing cab left'],
      ['E', 'KeyE', 'Swing cab right'],
    ],
  ],
  ['Face tracks', [['C', 'KeyC', 'Face the tracks']]],
];
function controlDeck(vehicle, drivingTracks) {
  const list = $('control-groups');
  list.replaceChildren();
  for (const [name, keys] of drivingTracks ? trackControls : controls[vehicle]) {
    const g = document.createElement('div');
    g.className = 'control-group';
    const pair = document.createElement('div');
    pair.className = 'key-pair';
    for (const [text, code, label] of keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'keycap';
      b.dataset.key = code;
      b.textContent = text;
      b.title = label;
      b.setAttribute('aria-label', label);
      pair.append(b);
    }
    const l = document.createElement('span');
    l.className = 'control-label';
    l.textContent = name;
    g.append(pair, l);
    list.append(g);
  }
}
function selectVehicle(name) {
  if (!game || game.paused || !wasReady) return;
  if (name !== game.vehicle) sound.setReversing(false);
  game.switchTo(name);
  canvas.focus({ preventScroll: true });
  sync();
}
function compass() {
  const heading = game.heading(),
    center = Math.round(heading / 5) * 5;
  const signature = center + ':' + Math.round(heading * 2);
  if (signature === lastHeading) return;
  lastHeading = signature;
  const root = $('bearings'),
    width = $('bearings').clientWidth;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let html = '';
  for (let a = center - 30; a <= center + 30; a += 5) {
    const angle = ((a % 360) + 360) % 360;
    const major = angle % 15 === 0,
      cardinal = angle % 45 === 0;
    const x = width / 2 + ((a - heading) * width) / 53;
    html += `<span aria-hidden="true" class="bearing ${major ? '' : 'minor'} ${cardinal ? 'cardinal' : ''}" style="left:${x.toFixed(1)}px">${cardinal ? labels[angle / 45] : major ? String(angle).padStart(3, '0') : ''}</span>`;
  }
  root.innerHTML = html;
  root.parentElement.setAttribute(
    'aria-label',
    'Heading ' + (Math.round(heading) % 360) + ' degrees'
  );
}
function sync() {
  if (!game) return;
  const { excavator, truck, forklift, vehicle } = game;
  const digging = vehicle === 'excavator',
    lifting = vehicle === 'forklift';
  const drivingTracks = digging && game.travelMode;
  const showDepth = digging && !drivingTracks;
  const layout = drivingTracks ? 'tracks' : vehicle;
  const instrument = digging ? 'bucket' : lifting ? 'forklift' : 'truck';
  if (lastLayout !== layout) {
    lastLayout = layout;
    controlDeck(vehicle, drivingTracks);
    $('excavator-modes').hidden = !digging;
    $('dig-mode').setAttribute('aria-pressed', String(!drivingTracks));
    $('drive-mode').setAttribute('aria-pressed', String(drivingTracks));
    for (const name of vehicleOrder)
      $('choose-' + name).setAttribute('aria-pressed', String(name === vehicle));
    $('load-label').textContent = digging ? 'Bucket load' : lifting ? 'Fork height' : 'Bed load';
    $('secondary-label').textContent = showDepth ? 'Dig depth' : 'Speed';
    $('secondary-note').textContent = showDepth ? 'BELOW GRADE' : 'GROUND SPEED';
    $('load-ticks').hidden = lifting;
    $('fork-spacing').hidden = !lifting;
    setIcon('load-icon', instrument);
    setIcon('action-icon', instrument);
    setIcon('secondary-icon', showDepth ? 'depth' : 'gauge');
    $('hint').innerHTML =
      svg('mouse') +
      (digging
        ? `<span>Drag to look <b>·</b> ${touchInput ? 'Tap' : 'Click'} to aim</span>`
        : '<span>Drag to look around</span>');
  }
  const loaded = excavator.load > 0.001,
    aim = game.aimedTruck;
  const job = game.loaded < 1.999 ? 0 : game.hauled < 1.999 ? 1 : 2;
  let title = ['First haul', 'Deliver the load', 'Free excavation'][job];
  let description = [
    'Load 2.0 m³ of earth into the dump truck.',
    'Tip 2.0 m³ from the truck to make a spoil pile.',
    'Keep digging and hauling to shape North Yard.',
  ][job];
  let progress = Math.min(
    100,
    Math.round((job === 0 ? game.loaded : job === 1 ? game.hauled : 2) * 50)
  );
  let progressText = progress + '%';
  if (lifting) {
    const count = game.palletsDelivered,
      total = game.freightCount;
    title = count === total ? 'Bay stocked' : 'Supply run';
    description =
      count === total
        ? 'All loaded pallets are in the striped bay.'
        : forklift.held
          ? `Carry the ${forklift.held.home.label.toLowerCase()} to the striped pallet bay.`
          : 'Move the three loaded pallets into the striped bay.';
    progress = Math.round((count / total) * 100);
    progressText = `${count} / ${total}`;
  }
  const fraction = digging
    ? excavator.load / BUCKET_CAPACITY
    : lifting
      ? forklift.height / MAX_FORK_HEIGHT
      : truck.fill / TRUCK_CAPACITY;
  const load = digging
    ? Math.round(fraction * 100)
    : lifting
      ? forklift.height.toFixed(1)
      : truck.fill.toFixed(1);
  const unit = digging ? '%' : lifting ? 'm' : 'm³';
  const p = excavator.point();
  const secondary = showDepth
    ? game.terrain.depth(p.x, p.z).toFixed(1)
    : String(Math.round(Math.abs(game.machines[vehicle].speed) * 3.6));
  let action,
    disabled = false;
  if (lifting) {
    disabled = forklift.target !== null;
    action = disabled
      ? forklift.target < forklift.height
        ? 'Setting down…'
        : 'Lifting…'
      : forklift.held
        ? 'Set down pallet'
        : 'Pick up pallet';
  } else if (!digging) action = truck.tipping ? 'Lower bed' : 'Tip bed';
  else if (game.anim) {
    action = { aim: 'Aiming…', scoop: 'Scooping…', dump: 'Emptying…' }[game.anim.name];
    disabled = true;
  } else
    action = loaded ? (truck.insideBed(p.x, p.z, 0.05) ? 'Load truck' : 'Dump soil') : 'Scoop soil';
  const ticks = Math.round(fraction * 10);
  const spacing = lifting ? Math.round(forklift.spacing * 100) : null;
  const trackHeading = drivingTracks
    ? ((Math.round((-excavator.chassis.rotation.y * 180) / Math.PI) % 360) + 360) % 360
    : null;
  const signature = [
    layout,
    load,
    secondary,
    ticks,
    spacing,
    trackHeading,
    title,
    description,
    progressText,
    action,
    disabled,
    loaded,
    aim,
  ].join('|');
  if (signature !== hudSignature) {
    hudSignature = signature;
    $('task-title').textContent = title;
    $('task-description').textContent = description;
    $('task-progress').style.width = progress + '%';
    $('task-percent').textContent = progressText;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', String(progress));
    $('load-value').innerHTML = load + `<span>${unit}</span>`;
    $('secondary-value').innerHTML = secondary + `<span>${showDepth ? 'm' : 'km/h'}</span>`;
    if (drivingTracks)
      $('secondary-note').textContent = `TRACKS ${String(trackHeading).padStart(3, '0')}°`;
    if (lifting) $('fork-spacing').textContent = `SPACING ${spacing} cm`;
    [...$('load-ticks').children].forEach((el, i) => el.classList.toggle('on', i < ticks));
    $('action-label').textContent = action;
    $('action').disabled = disabled;
    $('action').title = action + ' (Space)';
    const assist = $('aim-assist');
    assist.hidden = !digging || !!game.anim || (!loaded && !aim);
    assist.querySelector('span').textContent = loaded ? 'Aim at truck bed' : 'Return to dig area';
  }
  compass();
}
function clearHeld() {
  game?.clearInput();
  document.querySelectorAll('.held').forEach((b) => b.classList.remove('held'));
}
const guide = `<p>Click the ground or the truck to position the bucket. Drag the view to look around the cab.</p><h3>Excavator</h3><p>Choose Dig or Drive, or press T to switch. In Drive, the tracks keep their heading when you swing the cab. Press C to face forward along them.</p><dl><div><dt>Drive forward / reverse</dt><dd>W / S</dd></div><div><dt>Turn tracks left / right</dt><dd>A / D</dd></div><div><dt>Swing cab while driving</dt><dd>Q / E</dd></div></dl><h3>Dig controls</h3><dl><div><dt>Swing left / right</dt><dd>A / D</dd></div><div><dt>Raise / lower boom</dt><dd>W / S</dd></div><div><dt>Extend / retract stick</dt><dd>↑ / ↓</dd></div><div><dt>Curl / open bucket</dt><dd>Q / E</dd></div><div><dt>Scoop or dump soil</dt><dd>Space</dd></div></dl><h3>Dump truck</h3><dl><div><dt>Drive / reverse</dt><dd>W / S</dd></div><div><dt>Steer left / right</dt><dd>A / D</dd></div><div><dt>Tip / lower bed when stopped</dt><dd>Space</dd></div></dl><h3>Forklift</h3><p>Approach from any of the four sides. Match the fork spacing to the openings and drive straight in with the forks low. The spacing gauge measures between the centers of the forks. Back clear of the pallet to use the full range. Lift it, carry it to the striped bay, then lower it onto the ground.</p><dl><div><dt>Drive / reverse</dt><dd>W / S</dd></div><div><dt>Steer left / right</dt><dd>A / D</dd></div><div><dt>Raise / lower forks</dt><dd>↑ / ↓</dd></div><div><dt>Narrow / spread forks</dt><dd>Q / E</dd></div><div><dt>Pick up / set down when stopped</dt><dd>Space</dd></div></dl><h3>All vehicles</h3><dl><div><dt>Switch cab</dt><dd>V</dd></div><div><dt>Toggle fullscreen</dt><dd>F</dd></div><div><dt>Center view</dt><dd>C</dd></div><div><dt>Pause</dt><dd>P / Esc</dd></div></dl>`;
function setPanel(next) {
  if (!wasReady) return;
  game.paused = true;
  clearHeld();
  sound.pause(true);
  $('dialog-tag').textContent = next === 'guide' ? 'FIELD MANUAL' : 'NORTH YARD';
  $('dialog-heading').textContent =
    next === 'guide'
      ? 'Operator guide'
      : next === 'reset'
        ? 'Restart the site?'
        : 'Simulation paused';
  $('dialog-body').innerHTML =
    next === 'guide'
      ? guide
      : next === 'reset'
        ? '<p>Restarting clears the excavation, all vehicle loads, pallet positions, and site progress.</p>'
        : '<p>Your vehicles and the worksite are on hold.</p>';
  $('dialog-actions').replaceChildren();
  const make = (label, fn, primary = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('primary', primary);
    b.addEventListener('click', fn);
    $('dialog-actions').append(b);
  };
  if (next === 'reset') {
    make('Keep playing', closePanel, true);
    make('Restart site', () => {
      game.reset();
      hudSignature = '';
      lastLayout = '';
      closePanel();
      sync();
      notice('North Yard restarted.');
    });
  } else {
    make(next === 'guide' ? 'Back to cab' : 'Resume', closePanel, true);
    if (next === 'pause') make('Restart site', () => setPanel('reset'));
  }
  if (!dialog.open) dialog.showModal();
}
function closePanel() {
  if (dialog.open) dialog.close();
  if (game) game.paused = false;
  sound.pause(false);
  clearHeld();
  canvas.focus({ preventScroll: true });
  lastTime = undefined;
}
async function toggleSound() {
  try {
    const on = await sound.toggle();
    setIcon('sound', on ? 'sound' : 'mute');
    $('sound').setAttribute('aria-pressed', String(on));
    const label = on ? 'Mute sound' : 'Enable sound';
    $('sound').title = label + ' (M)';
    $('sound').setAttribute('aria-label', label);
  } catch {
    notice('Audio is unavailable in this browser.');
  }
}
let expandedInWindow = false,
  changingScreen = false;
const nativeFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function syncFullscreen() {
  const active = nativeFullscreen() || expandedInWindow;
  document.documentElement.classList.toggle('immersive', active);
  const button = $('fullscreen');
  const label = expandedInWindow
    ? 'Exit expanded view'
    : active
      ? 'Exit fullscreen'
      : 'Enter fullscreen';
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', label);
  button.title = label + ' (F)';
  button.querySelector('span').textContent = expandedInWindow
    ? 'Exit view'
    : active
      ? 'Exit fullscreen'
      : 'Fullscreen';
  setIcon('fullscreen', active ? 'exit-fullscreen' : 'fullscreen');
}
async function toggleFullscreen() {
  if (changingScreen) return;
  changingScreen = true;
  const root = document.documentElement;
  try {
    if (nativeFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      await exit.call(document);
    } else if (expandedInWindow) {
      expandedInWindow = false;
    } else {
      const enter = root.requestFullscreen || root.webkitRequestFullscreen;
      const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
      if (enter && enabled !== false) {
        try {
          await enter.call(root);
        } catch {
          expandedInWindow = true;
        }
      } else expandedInWindow = true;
      if (expandedInWindow) notice('Cab view expanded to fill this browser window.');
    }
  } catch {
    if (nativeFullscreen()) notice('Use your browser’s fullscreen control to exit.');
  } finally {
    changingScreen = false;
    syncFullscreen();
    if (!dialog.open) canvas.focus({ preventScroll: true });
  }
}
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);
$('fullscreen').onclick = toggleFullscreen;
syncFullscreen();
function unlockSound() {
  if (sound.enabled && !sound.paused && sound.ctx?.state !== 'running') {
    sound.unlock().catch(() => {});
  }
}
// Browsers require a player gesture before the engine and reverse alarm can play.
document.addEventListener(
  'pointerup',
  (event) => {
    if (wasReady && !dialog.open && !event.target.closest('#sound, #help, #pause')) unlockSound();
  },
  true
);
$('load-ticks').innerHTML = '<i></i>'.repeat(10);
for (const name of vehicleOrder) $('choose-' + name).onclick = () => selectVehicle(name);
for (const [id, drive] of [
  ['dig-mode', false],
  ['drive-mode', true],
]) {
  $(id).onclick = () => {
    if (!wasReady) return;
    game.setTravelMode(drive);
    canvas.focus({ preventScroll: true });
  };
}
$('action').onclick = () => {
  if (wasReady) game.action();
};
$('aim-assist').onclick = () => game.aimPreset();
$('sound').onclick = toggleSound;
$('pause').onclick = () => setPanel('pause');
$('help').onclick = () => setPanel('guide');
$('close-dialog').onclick = closePanel;
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  closePanel();
});
dialog.addEventListener('click', (e) => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    closePanel();
});
const movement = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown']);
function press(code) {
  if (!wasReady || game.paused) return;
  if (code === 'KeyC') {
    game.centerView();
    return;
  }
  if (code === 'KeyT') {
    game.setTravelMode(!game.travelMode);
    return;
  }
  if (code === 'KeyV') {
    selectVehicle(vehicleOrder[(vehicleOrder.indexOf(game.vehicle) + 1) % vehicleOrder.length]);
    return;
  }
  if (!movement.has(code)) return;
  if (
    game.vehicle === 'truck' &&
    (code === 'KeyW' || code === 'KeyS') &&
    (game.truck.tipping || game.truck.tip > 0.02)
  )
    notice('Lower the bed to drive.');
  game.keys.add(code);
  document.querySelector(`[data-key="${code}"]`)?.classList.add('held');
}
function release(code) {
  game?.keys.delete(code);
  document.querySelector(`[data-key="${code}"]`)?.classList.remove('held');
}
window.addEventListener('keydown', (e) => {
  if (!wasReady || e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;
  if (
    code === 'KeyF' ||
    (code === 'Escape' && !dialog.open && (nativeFullscreen() || expandedInWindow))
  ) {
    e.preventDefault();
    if (!e.repeat) toggleFullscreen();
    return;
  }
  if (dialog.open) {
    if (code === 'KeyP' || code === 'KeyH') {
      e.preventDefault();
      closePanel();
    }
    return;
  }
  if (
    code === 'Space' &&
    e.target instanceof HTMLButtonElement &&
    !e.target.classList.contains('keycap') &&
    e.target !== $('action')
  )
    return;
  if (
    !movement.has(code) &&
    !['Space', 'KeyV', 'KeyC', 'KeyT', 'KeyP', 'KeyH', 'KeyM', 'Escape'].includes(code)
  )
    return;
  e.preventDefault();
  if (e.repeat) return;
  if (movement.has(code) || ['Space', 'KeyV', 'KeyC'].includes(code)) unlockSound();
  if (code === 'KeyP' || code === 'Escape') setPanel('pause');
  else if (code === 'KeyH') setPanel('guide');
  else if (code === 'KeyM') toggleSound();
  else if (code === 'Space') game.action();
  else press(code);
});
window.addEventListener('keyup', (e) => release(e.code));
window.addEventListener('blur', clearHeld);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearHeld();
  sound.pause(document.hidden || !!game?.paused);
  lastTime = undefined;
});
const keyTimes = new Map();
$('control-groups').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  e.preventDefault();
  b.setPointerCapture(e.pointerId);
  keyTimes.set(e.pointerId, performance.now());
  press(b.dataset.key);
});
$('control-groups').addEventListener('pointerup', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const began = keyTimes.get(e.pointerId);
  if (
    began !== undefined &&
    performance.now() - began < 80 &&
    movement.has(b.dataset.key) &&
    !game.anim &&
    !game.paused
  ) {
    game.tick(0.065);
  }
  keyTimes.delete(e.pointerId);
  release(b.dataset.key);
});
$('control-groups').addEventListener('pointercancel', (e) => {
  keyTimes.delete(e.pointerId);
  const b = e.target.closest('button');
  if (b) release(b.dataset.key);
});
$('control-groups').addEventListener('click', (e) => {
  if (e.detail !== 0 || !wasReady) return;
  const b = e.target.closest('button');
  if (!b) return;
  press(b.dataset.key);
  if (movement.has(b.dataset.key)) game.tick(0.1);
  release(b.dataset.key);
});
let pointer = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!wasReady || game.paused || e.button > 0) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  pointer = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    drag: false,
  };
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  if (!pointer.drag && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 4) {
    pointer.drag = true;
    canvas.classList.add('dragging');
  }
  if (pointer.drag) game.look(e.clientX - pointer.lastX, e.clientY - pointer.lastY);
  pointer.lastX = e.clientX;
  pointer.lastY = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointer || e.pointerId !== pointer.id) return;
  if (!pointer.drag) game.pick(e.clientX, e.clientY);
  pointer = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('pointercancel', () => {
  pointer = null;
  canvas.classList.remove('dragging');
});
try {
  game = new Simulation(canvas, { notice, changed: sync, sound: (kind) => sound.effect(kind) });
  new ResizeObserver(() => {
    game.resize();
    lastHeading = '';
    if (wasReady && game.paused) game.render();
  }).observe(canvas);
  await game.ready;
  game.render();
  wasReady = true;
  sync();
  $('loading').classList.add('done');
  let hudTime = 0;
  const frame = (time) => {
    const dt = lastTime === undefined ? 0 : Math.max(0, Math.min(0.12, (time - lastTime) / 1000));
    lastTime = time;
    if (!document.hidden && !game.paused) {
      game.tick(dt);
      hudTime += dt;
      if (hudTime > 0.055) {
        hudTime = 0;
        sync();
        sound.update(
          game.vehicle,
          game.vehicle !== 'excavator'
            ? Math.min(1, Math.abs(game.machines[game.vehicle].speed) / 5)
            : game.anim || game.keys.size
              ? 0.72
              : 0,
          game.machines[game.vehicle].speed || 0
        );
      }
      game.render();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  $('loading').innerHTML =
    '<span>North Yard needs WebGL 2. Enable hardware acceleration and reload to enter the cab.</span>';
}
