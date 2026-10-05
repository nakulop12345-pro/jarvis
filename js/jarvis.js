/**
 * JARVIS 3D — The brain.
 * State machine, command dispatch, thinking sequence, speech,
 * memory, and bridge to the 3D scene and HUD.
 */
import { CONFIG } from './config.js';
import { Personality } from './personality.js';
import { classify, looksLikeQuestion } from './commands.js';
import { buildPlan, stepDelay } from './reasoning.js';
import { Bus, sleep, pick, greetingForHour, clamp } from './utils.js';

const STATES = [
  'IDLE','LISTENING','THINKING','ANALYZING','RESPONDING',
  'SPEAKING','EXECUTING','ERROR','CURIOUS','READY'
];

export class Jarvis {
  constructor({ memory, speech, audio, ui, scene }){
    this.memory = memory;
    this.speech = speech;
    this.audio = audio;
    this.ui = ui;
    this.scene = scene;

    this.state = 'IDLE';
    this.mode = 'home';
    this.busy = false;
    this.powered = false;
    this.history = [];
    this.abortToken = 0;

    this.voiceEnabled = !!memory.get('voiceOn');
    this.soundEnabled = !!memory.get('soundOn');

    this._bindBus();
  }

  /* ============================================================
     SETUP
  ============================================================ */
  _bindBus(){
    Bus.on('mode-changed', (mode) => {
      this.mode = mode;
      this.memory.set('lastMode', mode);
      this.ui.setMode(mode);
      this.ui.updateMemoryInfo();
    });
  }

  /* ============================================================
     STATE
  ============================================================ */
  setState(state){
    if (!STATES.includes(state)) return;
    if (this.state === state) return;
    this.state = state;
    this.ui.setState(state);
    this.scene.setState(state);
    Bus.emit('state', state);
  }

  async setStateFor(ms, state){
    this.setState(state);
    await sleep(ms);
  }

  /* ============================================================
     BOOT
  ============================================================ */
  async boot({ returning = false } = {}){
    this.powered = true;
    this.scene.setPower(1);

    this.ui.setVoiceLabel(this.voiceEnabled);
    this.ui.setSoundLabel(this.soundEnabled);

    const name = this.memory.getName();
    let greetText;

    if (returning && name){
      greetText = Personality.returning({ name });
    } else if (name){
      greetText = Personality.greeting({ name });
    } else {
      greetText = Personality.greeting({});
    }

    this.ui.addMessage('jarvis', greetText, { typing: true });
    this.audio.notification();

    this.setState('READY');
    await sleep(400);
    this.setState('IDLE');

    if (this.voiceEnabled){
      this.speak(greetText);
    }

    Bus.emit('booted');
  }

  /* ============================================================
     INPUT
  ============================================================ */
  async handleInput(text, { source = 'voice' } = {}){
    if (!text || !text.trim()) return;
    if (this.busy) {
      this.ui.toast('BUSY — ONE MOMENT', 'warn');
      return;
    }

    this.busy = true;
    const token = ++this.abortToken;

    this.ui.addMessage('user', text);
    this.history.push({ role: 'user', content: text });
    this.audio.blip();

    const intent = classify(text);

    try {
      await this._think(intent, token);
      if (token !== this.abortToken) return;
      await this._execute(intent, token);
    } catch (e){
      console.warn(e);
      this._fail('generic');
    } finally {
      if (token === this.abortToken){
        this.busy = false;
        if (this.state !== 'ERROR') this.setState('IDLE');
      }
    }
  }

  /* ============================================================
     THINKING SEQUENCE
  ============================================================ */
  async _think(intent, token){
    this.setState('THINKING');
    this.audio.thinking();

    const plan = buildPlan(intent);

    for (let i = 0; i < plan.length; i++){
      if (token !== this.abortToken) return;
      const step = plan[i];

      if (step.kind === 'done') this.setState('ANALYZING');

      this.ui.addMessage('jarvis', step.label, {
        step: true,
        done: step.kind === 'done',
        warn: step.kind === 'warn'
      });

      if (step.kind === 'done') this.audio.processing();
      else this.audio.blip();

      await sleep(stepDelay());
    }

    await sleep(120);
  }

  /* ============================================================
     EXECUTION
  ============================================================ */
  async _execute(intent, token){
    const id = intent.id;

    switch (id){
      /* ---------------- informational ---------------- */
      case 'time':
        return this._respond(Personality.time());

      case 'date':
        return this._respond(Personality.date());

      case 'greeting':
        this.setState('CURIOUS');
        await sleep(200);
        return this._respond(Personality.greeting({ name: this.memory.getName() }));

      case 'capabilities':
        return this._respond(Personality.capabilities());

      case 'alive':
        return this._respond(Personality.alive());

      case 'smart':
        return this._respond(Personality.smart());

      case 'feelings':
        return this._respond(Personality.feelings());

      case 'creator':
        return this._respond(Personality.creator());

      case 'getName':
        return this._respond(
          this.memory.getName()
            ? `You're ${this.memory.getName()}. Stored locally in this browser.`
            : `You haven't told me. Say "my name is ..." and I'll remember it locally.`
        );

      /* ---------------- memory ---------------- */
      case 'setName': {
        const name = String(intent.value || '').trim().replace(/\s+/g, ' ');
        if (!name || name.length < 2){
          return this._respond(`I didn't catch a usable name.`);
        }
        const pretty = name.charAt(0).toUpperCase() + name.slice(1);
        this.memory.set('name', pretty);
        this.ui.updateMemoryInfo();
        return this._respond(`Understood, ${pretty}. I'll remember that locally.`);
      }

      case 'clearMemory': {
        this.memory.clear();
        this.memory.startSession();
        this.ui.updateMemoryInfo();
        this.ui.toast('LOCAL MEMORY CLEARED');
        return this._respond(Personality.ack('memoryClear'));
      }

      /* ---------------- status ---------------- */
      case 'status': {
        const stats = {
          fps: this.scene.getFps(),
          quality: this.scene.qualityName,
          mode: this.mode.toUpperCase()
        };
        return this._respond(Personality.status({ stats }));
      }

      /* ---------------- modes ---------------- */
      case 'spaceMode': {
        this.setState('EXECUTING');
        this.audio.modeShift();
        this.ui.addMessage('jarvis', 'SPACE MODE ACTIVATED', { step: true, done: true });
        this.scene.setMode('space');
        await sleep(420);
        return this._respond(Personality.spaceMode());
      }

      case 'carMode': {
        this.setState('EXECUTING');
        this.audio.modeShift();
        this.ui.addMessage('jarvis', 'CAR MODE ACTIVATED', { step: true, done: true });
        this.scene.setMode('car');
        await sleep(420);
        return this._respond(Personality.carMode());
      }

      case 'homeMode': {
        this.setState('EXECUTING');
        this.audio.modeShift();
        this.ui.addMessage('jarvis', 'HOME MODE RESTORED', { step: true, done: true });
        this.scene.setMode('home');
        await sleep(320);
        return this._respond(Personality.homeMode());
      }

      /* ---------------- display ---------------- */
      case 'fullscreen': {
        this.setState('EXECUTING');
        const ok = await this._toggleFullscreen();
        return this._respond(ok ? Personality.ack('fullscreen') : `Fullscreen isn't available here.`);
      }

      /* ---------------- web ---------------- */
      case 'openUrl': {
        const raw = String(intent.value || '').trim();
        if (!raw) return this._respond(Personality.unknown());
        const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        this.setState('EXECUTING');
        this.audio.success();
        await sleep(280);
        try {
          const w = window.open(url, '_blank', 'noopener,noreferrer');
          if (!w) {
            return this._respond(`Your browser blocked the new tab. Try clicking the link manually: ${url}`);
          }
          return this._respond(Personality.ack('open') + ` ${raw}`);
        } catch {
          return this._respond(`I couldn't open that address.`);
        }
      }

      case 'search': {
        const q = String(intent.value || '').trim();
        if (!q) return this._respond(Personality.unknown());
        this.setState('EXECUTING');
        await sleep(220);
        const url = 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
        window.open(url, '_blank', 'noopener,noreferrer');
        return this._respond(`Searching for "${q}".`);
      }

      /* ---------------- controls ---------------- */
      case 'stop': {
        this.abortToken++;
        this.speech.stopSpeaking();
        this.speech.abortListening();
        this.ui.setMicActive(false);
        this.setState('IDLE');
        this.audio.blip();
        return this._respond(Personality.ack('stop'));
      }

      case 'reset': {
        this.setState('EXECUTING');
        this.abortToken++;
        this.speech.stopSpeaking();
        this.ui.clearConversation();
        this.scene.setMode('home');
        this.audio.success();
        await sleep(300);
        this.ui.addMessage('jarvis', 'INTERFACE RESET', { step: true, done: true });
        return this._respond(Personality.ack('reset'));
      }

      case 'restart': {
        this.setState('EXECUTING');
        this.abortToken++;
        this.speech.stopSpeaking();
        this.ui.clearConversation();
        this.scene.setMode('home');
        this.scene.setPower(0);
        this.audio.shutdown();
        await sleep(900);
        this.scene.setPower(1);
        this.audio.boot();
        await sleep(700);
        return this._respond(Personality.ack('restart'));
      }

      case 'shutdown': {
        this.setState('EXECUTING');
        this._respond(Personality.ack('shutdown'), { speak: false });
        this.audio.shutdown();
        await sleep(600);
        Bus.emit('shutdown');
        return;
      }

      case 'help': {
        this.ui.openDrawer('help');
        return this._respond(
          `I can handle time, date, interface modes, fullscreen, opening links, searching, system status, and a small amount of local memory. Say "what can you do" for the full list.`
        );
      }

      /* ---------------- nothing matched ---------------- */
      case 'empty':
        return;

      default: {
        // Optional remote AI hook (disabled by default)
        if (CONFIG.AI_ENABLED && CONFIG.AI_ENDPOINT){
          const remote = await this._askRemote(intent.raw);
          if (remote) return this._respond(remote);
        }
        this.setState('CURIOUS');
        await sleep(280);
        return this._respond(Personality.unknown());
      }
    }
  }

  /* ============================================================
     RESPOND
  ============================================================ */
  async _respond(text, { speak = true } = {}){
    if (!text) return;

    this.setState('RESPONDING');
    this.ui.addMessage('jarvis', text, { typing: true });
    this.history.push({ role: 'assistant', content: text });

    if (speak && this.voiceEnabled){
      await this.speak(text);
    } else {
      await sleep(Math.min(2400, 500 + text.length * 24));
    }

    // Persist a trimmed history
    if (this.history.length > 24) this.history = this.history.slice(-24);
  }

  speak(text){
    if (!this.voiceEnabled) return Promise.resolve();
    this.setState('SPEAKING');
    const rate = Number(this.memory.get('voiceRate') ?? 1);
    const pitch = Number(this.memory.get('voicePitch') ?? 1);

    return this.speech.speak(text, {
      rate, pitch,
      volume: CONFIG.SPEECH_VOLUME,
      onStart: () => this.setState('SPEAKING')
    }).then(() => {
      if (this.state === 'SPEAKING') this.setState('IDLE');
    });
  }

  _fail(kind){
    this.setState('ERROR');
    this.audio.error();
    const msg = Personality.error(kind);
    this.ui.addMessage('jarvis', msg, { error: true });
    if (this.voiceEnabled) this.speak(msg);
    setTimeout(() => {
      if (this.state === 'ERROR') this.setState('IDLE');
    }, 2200);
  }

  /* ============================================================
     LISTENING
  ============================================================ */
  startListening(){
    if (!this.speech.supportedSTT){
      this.ui.toast('SPEECH RECOGNITION UNSUPPORTED', 'err');
      this._respond(`This browser doesn't support speech recognition. Chrome, Edge, and Safari do.`, { speak: false });
      return;
    }
    if (this.busy){
      this.ui.toast('BUSY', 'warn');
      return;
    }

    this.setState('LISTENING');
    this.ui.setMicActive(true);
    this.audio.listening();

    this.speech.onResult = (text) => {
      this.ui.setMicActive(false);
      this.handleInput(text, { source: 'voice' });
    };
    this.speech.onPartial = (text) => {
      // live preview in the HUD (replaces previous partial)
      Bus.emit('partial', text);
    };
    this.speech.onEnd = () => {
      this.ui.setMicActive(false);
      if (this.state === 'LISTENING'){
        this.setState('IDLE');
      }
    };
    this.speech.onError = (err) => {
      this.ui.setMicActive(false);
      if (err === 'not-allowed' || err === 'service-not-allowed'){
        this.ui.toast('MICROPHONE PERMISSION DENIED', 'err');
        this._respond(`I need microphone access to hear you.`, { speak: false });
      } else if (err === 'no-speech'){
        this._respond(Personality.noSpeech());
      } else {
        this.setState('IDLE');
      }
    };

    this.speech.startListening();
  }

  stopListening(){
    this.speech.stopListening();
    this.ui.setMicActive(false);
    if (this.state === 'LISTENING') this.setState('IDLE');
  }

  toggleListening(){
    if (this.speech.listening) this.stopListening();
    else this.startListening();
  }

  /* ============================================================
     TOGGLES
  ============================================================ */
  setVoiceEnabled(on){
    this.voiceEnabled = !!on;
    this.memory.set('voiceOn', this.voiceEnabled);
    this.ui.setVoiceLabel(this.voiceEnabled);
    if (!this.voiceEnabled) this.speech.stopSpeaking();
    this.ui.toast(this.voiceEnabled ? 'VOICE OUTPUT ON' : 'VOICE OUTPUT OFF');
  }

  setSoundEnabled(on){
    this.soundEnabled = !!on;
    this.memory.set('soundOn', this.soundEnabled);
    this.audio.setEnabled(this.soundEnabled);
    this.ui.setSoundLabel(this.soundEnabled);
    this.ui.toast(this.soundEnabled ? 'INTERFACE SOUND ON' : 'INTERFACE SOUND OFF');
  }

  async _toggleFullscreen(){
    try {
      if (!document.fullscreenElement){
        await document.documentElement.requestFullscreen();
        return true;
      } else {
        await document.exitFullscreen();
        return true;
      }
    } catch {
      return false;
    }
  }

  /* ============================================================
     REMOTE AI (optional, disabled by default)
  ============================================================ */
  async _askRemote(prompt){
    if (!CONFIG.AI_ENABLED || !CONFIG.AI_ENDPOINT) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.AI_TIMEOUT_MS);
    try {
      const res = await fetch(CONFIG.AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: CONFIG.AI_MODEL || undefined,
          history: this.history.slice(-8)
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.text === 'string' ? data.text : null;
    } catch {
      return null;
    }
  }

  /* ============================================================
     AUDIO REACTIVITY DRIVER
  ============================================================ */
  updateAudioReactivity(){
    const s = this.state;
    let level = 0;

    if (s === 'LISTENING'){
      level = this.speech.getMicLevel();
    } else if (s === 'SPEAKING' || s === 'RESPONDING'){
      level = this.speech.getSpeakLevel();
    } else if (s === 'THINKING' || s === 'ANALYZING'){
      level = 0.12 + Math.abs(Math.sin(performance.now() / 700)) * 0.18;
    } else if (s === 'EXECUTING'){
      level = 0.45 + Math.abs(Math.sin(performance.now() / 220)) * 0.35;
    } else if (s === 'ERROR'){
      level = Math.abs(Math.sin(performance.now() / 130)) * 0.7;
    } else {
      level = 0.05 + Math.abs(Math.sin(performance.now() / 1400)) * 0.08;
    }

    this.scene.setAudioLevel(level);

    // Also pulse the audio engine lightly while speaking
    if (s === 'SPEAKING' && Math.random() < 0.08){
      this.audio.speakEnvelope(level);
    }
  }
}
