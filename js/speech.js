/**
 * JARVIS 3D — Speech input (SpeechRecognition) and
 * output (SpeechSynthesis) with mic-level analysis.
 *
 * Everything degrades gracefully if unsupported.
 */

export class SpeechEngine {
  constructor(){
    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.listening = false;
    this.supportedSTT = !!this.Recognition;
    this.supportedTTS = 'speechSynthesis' in window;

    this.voices = [];
    this.selectedVoice = null;

    this.onResult = null;
    this.onPartial = null;
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;

    /* Mic analyser (optional, requires getUserMedia) */
    this.analyser = null;
    this.audioCtx = null;
    this.micStream = null;
    this.micData = null;
    this.micLevel = 0;
    this.micAvailable = false;

    /* Speech envelope (simulated from boundary events + duration) */
    this.speakLevel = 0;
    this._speakTarget = 0;

    if (this.supportedTTS) this._loadVoices();
  }

  /* ================= TTS ================= */

  _loadVoices(){
    const load = () => {
      try {
        this.voices = window.speechSynthesis.getVoices() || [];
      } catch { this.voices = []; }
    };
    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined){
      window.speechSynthesis.onvoiceschanged = load;
    }
    // some browsers need a delayed re-poll
    setTimeout(load, 400);
    setTimeout(load, 1500);
  }

  getVoices(){ return this.voices; }

  /** Prefer a calm, low-register English voice when available */
  autoPickVoice(){
    if (!this.voices.length) return null;
    const pref = [
      /Google UK English Male/i,
      /Microsoft (Guy|Ryan|David)/i,
      /Daniel/i,
      /Alex/i,
      /Google US English/i,
      /Samantha/i,
      /Microsoft Aria/i,
      /en-GB/i,
      /en-US/i
    ];
    for (const p of pref){
      const v = this.voices.find(v => p.test(v.name) || p.test(v.lang));
      if (v) return v;
    }
    return this.voices[0];
  }

  setVoiceByURI(uri){
    this.selectedVoice = this.voices.find(v => v.voiceURI === uri) || null;
  }

  speak(text, { rate = 1, pitch = 1, volume = 1, onStart, onEnd, onBoundary } = {}){
    return new Promise((resolve) => {
      if (!this.supportedTTS || !text){
        if (onEnd) onEnd();
        return resolve();
      }
      try { window.speechSynthesis.cancel(); } catch {}

      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      if (this.selectedVoice) u.voice = this.selectedVoice;
      u.lang = (this.selectedVoice && this.selectedVoice.lang) || 'en-US';

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        this._speakTarget = 0;
        if (onEnd) onEnd();
        resolve();
      };

      u.onstart = () => { if (onStart) onStart(); };
      u.onend = finish;
      u.onerror = finish;
      u.onboundary = () => {
        this._speakTarget = 0.55 + Math.random() * 0.45;
        if (onBoundary) onBoundary();
      };

      // Simulated envelope while speaking
      this._speakTarget = 0.6;
      this._speakInterval = setInterval(() => {
        this._speakTarget = 0.35 + Math.random() * 0.65;
      }, 130);

      try {
        window.speechSynthesis.speak(u);
      } catch {
        clearInterval(this._speakInterval);
        finish();
      }

      // Safety: if onend never fires
      setTimeout(() => {
        clearInterval(this._speakInterval);
        finish();
      }, Math.min(30000, 1600 + text.length * 90));
    });
  }

  stopSpeaking(){
    if (this.supportedTTS){
      try { window.speechSynthesis.cancel(); } catch {}
    }
    this._speakTarget = 0;
    if (this._speakInterval) clearInterval(this._speakInterval);
  }

  isSpeaking(){
    return this.supportedTTS && window.speechSynthesis.speaking;
  }

  /** 0..1 output level for visual reactivity */
  getSpeakLevel(){
    const target = this.isSpeaking() ? this._speakTarget : 0;
    this.speakLevel += (target - this.speakLevel) * 0.18;
    return this.speakLevel;
  }

  /* ================= STT ================= */

  initRecognition(lang = 'en-US'){
    if (!this.supportedSTT) return null;
    if (this.recognition) return this.recognition;

    const R = new this.Recognition();
    R.lang = lang;
    R.continuous = false;
    R.interimResults = true;
    R.maxAlternatives = 1;

    R.onstart = () => {
      this.listening = true;
      if (this.onStart) this.onStart();
    };

    R.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++){
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += tr;
        else interim += tr;
      }
      if (interim && this.onPartial) this.onPartial(interim.trim());
      if (final && this.onResult) this.onResult(final.trim());
    };

    R.onerror = (e) => {
      this.listening = false;
      if (this.onError) this.onError(e.error || 'unknown');
    };

    R.onend = () => {
      this.listening = false;
      if (this.onEnd) this.onEnd();
      this.stopMicAnalysis();
    };

    this.recognition = R;
    return R;
  }

  startListening(){
    if (!this.supportedSTT) return false;
    const r = this.initRecognition();
    if (!r) return false;
    try { r.start(); } catch { /* already started */ }
    this.startMicAnalysis();
    return true;
  }

  stopListening(){
    if (this.recognition && this.listening){
      try { this.recognition.stop(); } catch {}
    }
    this.stopMicAnalysis();
  }

  abortListening(){
    if (this.recognition){
      try { this.recognition.abort(); } catch {}
    }
    this.stopMicAnalysis();
  }

  /* ================= MIC ANALYSIS ================= */

  async startMicAnalysis(){
    if (this.micAvailable) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.audioCtx = new AC();
      const src = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);
      this.analyser = analyser;
      this.micStream = stream;
      this.micData = new Uint8Array(analyser.frequencyBinCount);
      this.micAvailable = true;
    } catch {
      this.micAvailable = false;
    }
  }

  stopMicAnalysis(){
    if (this.micStream){
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx){
      this.audioCtx.close().catch(()=>{});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.micAvailable = false;
    this.micLevel = 0;
  }

  /** 0..1 real mic level, or a simulated breathing fallback */
  getMicLevel(){
    if (this.analyser && this.micData){
      this.analyser.getByteFrequencyData(this.micData);
      let sum = 0;
      const n = Math.min(64, this.micData.length);
      for (let i = 0; i < n; i++) sum += this.micData[i];
      const avg = sum / n / 255;
      this.micLevel += (avg * 2.4 - this.micLevel) * 0.25;
      return Math.min(1, this.micLevel);
    }
    if (this.listening){
      // simulated subtle activity when listening without analyser
      this.micLevel = 0.18 + Math.abs(Math.sin(performance.now() / 380)) * 0.22;
      return this.micLevel;
    }
    return 0;
  }
}
