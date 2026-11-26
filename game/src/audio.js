// Nusa Wings — original synthesised WebAudio: no recorded or copied
// sound. A propeller engine hum whose pitch and loudness follow the
// throttle, wind noise that grows with airspeed, a touchdown thud and a
// two-note mission chime. Created lazily on the first user gesture so
// browsers allow it; silent until then.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.windGain = null;
    this.windSource = null;
    this.master = null;
  }

  // Call from a user gesture (keydown / click). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // Engine: a low sawtooth (propeller chop) plus a square sub-octave.
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 52;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 26;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc1.connect(engineFilter);
    this.engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // Wind: looped white noise through a band-pass, gain follows speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buf;
    this.windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();
  }

  // Called every frame with the live flight state.
  update(throttle, speed01, airborne) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const rpm = 42 + throttle * 68 + speed01 * 12;
    this.engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    const engineLevel = airborne ? 0.05 + throttle * 0.11 : 0.02 + throttle * 0.09;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    this.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.16, t, 0.15);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  // Short low thud for a touchdown.
  thud(hard) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hard ? 90 : 65, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(hard ? 0.5 : 0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // Two-note chime when a mission stage or mission completes.
  chime(big) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const notes = big ? [523.25, 659.25, 783.99] : [659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(g);
      g.connect(this.master);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  // Harsh buzz for a crash.
  crashBuzz() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  }
}
