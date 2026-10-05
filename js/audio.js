/**
 * JARVIS 3D — Procedural interface audio (Web Audio API).
 * All sounds are synthesized live. No external assets, no autoplay
 * before user gesture.
 */

export class AudioEngine {
  constructor(){
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noiseBuffer = null;
  }

  init(){
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._buildNoise();
    } catch { this.ctx = null; }
  }

  resume(){
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
  }

  setEnabled(v){
    this.enabled = !!v;
    if (this.master) this.master.gain.value = v ? 0.55 : 0;
  }

  _buildNoise(){
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
  }

  _now(){ return this.ctx.currentTime; }

  /* ---------------------------------------------------------
     Primitive: shaped oscillator tone
  --------------------------------------------------------- */
  tone({
    freq = 440, dur = 0.2, type = 'sine',
    gain = 0.18, attack = 0.008, release = 0.12,
    slideTo = null, delay = 0
  } = {}){
    if (!this.ctx || !this.enabled) return;
    const t0 = this._now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);

    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.05);
  }

  /* Filtered noise burst */
  noise({
    dur = 0.25, gain = 0.08, type = 'bandpass',
    freq = 900, q = 1.4, delay = 0, sweepTo = null
  } = {}){
    if (!this.ctx || !this.enabled || !this._noiseBuffer) return;
    const t0 = this._now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---------------------------------------------------------
     Named cues
  --------------------------------------------------------- */
  boot(){
    this.tone({ freq: 55, dur: 2.2, type: 'sine', gain: 0.14, attack: 0.6, release: 1.0 });
    this.tone({ freq: 110, dur: 1.8, type: 'sine', gain: 0.06, attack: 0.9, release: 1.0, delay: 0.2 });
    this.noise({ dur: 2.4, gain: 0.02, type: 'lowpass', freq: 700, sweepTo: 2600, delay: 0.1 });
  }

  activation(){
    this.tone({ freq: 220, dur: 0.18, type: 'triangle', gain: 0.1, slideTo: 660 });
    this.tone({ freq: 660, dur: 0.5, type: 'sine', gain: 0.07, delay: 0.14, slideTo: 990 });
  }

  online(){
    this.tone({ freq: 392, dur: 0.3, type: 'sine', gain: 0.1 });
    this.tone({ freq: 587, dur: 0.4, type: 'sine', gain: 0.09, delay: 0.14 });
    this.tone({ freq: 784, dur: 0.6, type: 'sine', gain: 0.07, delay: 0.3 });
  }

  listening(){
    this.tone({ freq: 880, dur: 0.1, type: 'sine', gain: 0.08 });
    this.tone({ freq: 1320, dur: 0.22, type: 'sine', gain: 0.06, delay: 0.09 });
  }

  processing(){
    for (let i = 0; i < 4; i++){
      this.tone({
        freq: 500 + i * 140, dur: 0.055, type: 'square',
        gain: 0.035, delay: i * 0.075
      });
    }
  }

  thinking(){
    this.tone({ freq: 300, dur: 0.5, type: 'sine', gain: 0.04, slideTo: 520 });
    this.noise({ dur: 0.7, gain: 0.012, type: 'bandpass', freq: 1400, sweepTo: 3200, q: 3 });
  }

  notification(){
    this.tone({ freq: 1046, dur: 0.13, type: 'sine', gain: 0.09 });
    this.tone({ freq: 1568, dur: 0.34, type: 'sine', gain: 0.07, delay: 0.11 });
  }

  success(){
    this.tone({ freq: 523, dur: 0.13, type: 'triangle', gain: 0.1 });
    this.tone({ freq: 784, dur: 0.16, type: 'triangle', gain: 0.09, delay: 0.11 });
    this.tone({ freq: 1046, dur: 0.4, type: 'sine', gain: 0.07, delay: 0.24 });
  }

  error(){
    this.tone({ freq: 220, dur: 0.16, type: 'sawtooth', gain: 0.09, slideTo: 150 });
    this.tone({ freq: 180, dur: 0.32, type: 'sawtooth', gain: 0.07, delay: 0.14, slideTo: 110 });
  }

  shutdown(){
    this.tone({ freq: 440, dur: 1.4, type: 'sine', gain: 0.11, slideTo: 55, release: 0.9 });
    this.noise({ dur: 1.6, gain: 0.02, type: 'lowpass', freq: 2000, sweepTo: 180 });
  }

  modeShift(){
    this.tone({ freq: 140, dur: 1.1, type: 'sine', gain: 0.09, slideTo: 520, attack: 0.3, release: 0.7 });
    this.noise({ dur: 1.0, gain: 0.03, type: 'bandpass', freq: 400, sweepTo: 3400, q: 2 });
  }

  blip(){
    this.tone({ freq: 1200, dur: 0.035, type: 'sine', gain: 0.045 });
  }

  speakEnvelope(level){
    // light reactive pulse while speaking
    if (!this.ctx || !this.enabled) return;
    this.tone({
      freq: 220 + level * 180,
      dur: 0.06,
      type: 'sine',
      gain: 0.012 + level * 0.02
    });
  }
}
