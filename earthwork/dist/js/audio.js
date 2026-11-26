export class EngineSound {
  constructor() {
    this.enabled = true;
    this.paused = false;
    this.alarm = null;
  }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const c = (this.ctx = new C());
    this.bus = c.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(c.destination);
    this.filter = c.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 205;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.bus);
    this.motor = c.createOscillator();
    this.motor.type = 'sawtooth';
    this.motor.frequency.value = 36;
    const vol = c.createGain();
    vol.gain.value = 0.15;
    this.motor.connect(vol).connect(this.filter);
    this.motor.start();
    this.harmonic = c.createOscillator();
    this.harmonic.type = 'triangle';
    this.harmonic.frequency.value = 72;
    const sub = c.createGain();
    sub.gain.value = 0.12;
    this.harmonic.connect(sub).connect(this.filter);
    this.harmonic.start();
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    // The audio clock keeps the reversing beeps regular even at a low frame rate.
    this.backupTone = c.createBuffer(1, Math.round(c.sampleRate * 0.94), c.sampleRate);
    const samples = this.backupTone.getChannelData(0);
    const duration = 0.36;
    for (let i = 0; i < duration * c.sampleRate; i++) {
      const time = i / c.sampleRate;
      const envelope = Math.min(1, time / 0.012, (duration - time) / 0.023);
      const phase = 2 * Math.PI * 990 * time;
      samples[i] = envelope * (0.86 * Math.sin(phase) + 0.09 * Math.sin(2 * phase));
    }
  }
  async unlock() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.volume();
  }
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) await this.unlock();
    this.volume();
    return this.enabled;
  }
  volume() {
    if (!this.enabled || this.paused) this.setReversing(false);
    if (this.ctx)
      this.bus.gain.setTargetAtTime(
        this.enabled && !this.paused ? 0.38 : 0,
        this.ctx.currentTime,
        0.02
      );
  }
  pause(flag) {
    this.paused = flag;
    this.volume();
  }
  setReversing(reversing) {
    const active = reversing && this.enabled && !this.paused && this.ctx?.state === 'running';
    if (!active) {
      if (this.alarm) {
        const { source, level } = this.alarm;
        const now = this.ctx.currentTime;
        level.gain.setTargetAtTime(0, now, 0.003);
        source.stop(now + 0.018);
        this.alarm = null;
      }
      return;
    }
    if (this.alarm) return;
    const source = this.ctx.createBufferSource();
    const level = this.ctx.createGain();
    level.gain.value = 0.34;
    source.buffer = this.backupTone;
    source.loop = true;
    source.connect(level).connect(this.bus);
    source.onended = () => {
      source.disconnect();
      level.disconnect();
    };
    this.alarm = { source, level };
    source.start();
  }
  update(vehicle, effort, driveSpeed) {
    this.setReversing(vehicle !== 'excavator' && driveSpeed < 0);
    if (!this.enabled || this.paused || !this.ctx) return;
    const f = { truck: 32, forklift: 44, excavator: 37 }[vehicle] + effort * 23;
    this.motor.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.2);
    this.harmonic.frequency.setTargetAtTime(f * 2.02, this.ctx.currentTime, 0.2);
    this.filter.frequency.setTargetAtTime(170 + effort * 170, this.ctx.currentTime, 0.15);
  }
  effect(kind) {
    if (!this.enabled || this.paused || !this.ctx) return;
    const c = this.ctx,
      t = c.currentTime,
      src = c.createBufferSource();
    src.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'hydraulic' ? 730 : kind === 'dig' ? 450 : 250;
    filter.Q.value = 0.8;
    const vol = c.createGain();
    vol.gain.setValueAtTime(0.001, t);
    vol.gain.exponentialRampToValueAtTime(0.27, t + 0.035);
    vol.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    src.connect(filter).connect(vol).connect(this.bus);
    src.start();
    src.stop(t + 0.46);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      vol.disconnect();
    };
  }
}
