/**
 * JARVIS 3D — HUD controller.
 * All HUD DOM writes funnel through here.
 */
import { CONFIG } from './config.js';
import { Bus, escapeHtml, formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(memory){
    this.memory = memory;
    this.el = {
      hud: $('hud'),
      mode: $('hud-mode'),
      statusWord: $('status-word'),
      statusDot: $('status-dot'),
      clock: $('clock'),

      dSession: $('d-session'),
      dLatency: $('d-latency'),
      dFps: $('d-fps'),
      dQuality: $('d-quality'),
      dLoad: $('d-load'),

      mUser: $('m-user'),
      mVisits: $('m-visits'),
      mMode: $('m-mode'),

      context: $('context'),
      eRes: $('e-res'),
      eLocale: $('e-locale'),
      eNet: $('e-net'),
      eBat: $('e-bat'),

      conversation: $('conversation'),
      toast: $('toast'),

      btnMic: $('btn-mic'),
      btnSpeak: $('btn-speak'),
      btnSound: $('btn-sound'),
      labelSpeak: $('label-speak'),
      labelSound: $('label-sound'),

      btnHome: $('btn-home'),
      btnSpace: $('btn-space'),
      btnCar: $('btn-car'),

      btnSettings: $('btn-settings'),
      btnHelp: $('btn-help'),
      btnFullscreen: $('btn-fullscreen'),
      btnShutdown: $('btn-shutdown'),

      settings: $('settings'),
      settingsClose: $('settings-close'),
      setVoice: $('set-voice'),
      setRate: $('set-rate'),
      setPitch: $('set-pitch'),
      setQuality: $('set-quality'),
      setName: $('set-name'),
      valRate: $('val-rate'),
      valPitch: $('val-pitch'),

      help: $('help'),
      helpClose: $('help-close'),

      clearMemory: $('clear-memory'),
      toastEl: $('toast')
    };

    this.messages = [];
    this._toastTimer = null;
    this._clockTimer = null;
    this._startTime = Date.now();
  }

  /* ================= LIFECYCLE ================= */

  show(){
    this.el.hud.classList.remove('hidden');
    this.el.hud.setAttribute('aria-hidden', 'false');
    this._startClock();
  }

  hide(){
    this.el.hud.classList.add('hidden');
    this.el.hud.setAttribute('aria-hidden', 'true');
    this._stopClock();
  }

  _startClock(){
    if (this._clockTimer) return;
    const tick = () => {
      if (this.el.clock) this.el.clock.textContent = formatTime(new Date(), true);
    };
    tick();
    this._clockTimer = setInterval(tick, 1000);
  }

  _stopClock(){
    if (this._clockTimer){ clearInterval(this._clockTimer); this._clockTimer = null; }
  }

  /* ================= STATE ================= */

  setState(state){
    if (this.el.hud.dataset.state === state) return;
    this.el.hud.dataset.state = state;
    if (this.el.statusWord) this.el.statusWord.textContent = state;
  }

  setMode(mode){
    const label = mode.toUpperCase();
    if (this.el.mode) this.el.mode.textContent = label;
    if (this.el.mMode) this.el.mMode.textContent = label;

    [this.el.btnHome, this.el.btnSpace, this.el.btnCar].forEach(b => b && b.classList.remove('active'));
    if (mode === 'home'  && this.el.btnHome)  this.el.btnHome.classList.add('active');
    if (mode === 'space' && this.el.btnSpace) this.el.btnSpace.classList.add('active');
    if (mode === 'car'   && this.el.btnCar)   this.el.btnCar.classList.add('active');

    this.setContext([
      ['ENVIRONMENT', label],
      ['CORE', 'ONLINE'],
      ['SESSION', this._sessionLength()]
    ]);
  }

  _sessionLength(){
    const s = Math.floor((Date.now() - this._startTime) / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }

  /* ================= DIAGNOSTICS ================= */

  updateDiagnostics({ fps, quality, latency, load }){
    if (fps != null && this.el.dFps) this.el.dFps.textContent = `${fps} FPS`;
    if (quality && this.el.dQuality) this.el.dQuality.textContent = quality;
    if (latency != null && this.el.dLatency) this.el.dLatency.textContent = `${Math.round(latency)} MS`;
    if (load != null && this.el.dLoad) this.el.dLoad.textContent = `${Math.round(load)}%`;
    if (this.el.dSession) this.el.dSession.textContent = this._sessionLength();
  }

  updateMemoryInfo(){
    const m = this.memory;
    if (this.el.mUser) this.el.mUser.textContent = m.getName() || 'UNSET';
    if (this.el.mVisits) this.el.mVisits.textContent = String(m.get('visits') || 1);
    if (this.el.mMode) this.el.mMode.textContent = String(m.get('lastMode') || 'home').toUpperCase();
  }

  updateEnvironment(){
    if (this.el.eRes) this.el.eRes.textContent = `${window.innerWidth}×${window.innerHeight}`;
    if (this.el.eLocale) this.el.eLocale.textContent = (navigator.language || 'en').toUpperCase();
    if (this.el.eNet) this.el.eNet.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
    if (this.el.eNet) this.el.eNet.className = 'row-v ' + (navigator.onLine ? 'ok' : 'err');
    if (this.el.eBat) {
      if (navigator.getBattery) {
        navigator.getBattery().then(b => {
          this.el.eBat.textContent = `${Math.round(b.level * 100)}%${b.charging ? ' ⚡' : ''}`;
        }).catch(()=>{ this.el.eBat.textContent = 'UNAVAILABLE'; });
      } else {
        this.el.eBat.textContent = 'UNAVAILABLE';
      }
    }
  }

  /* ================= CONTEXT ================= */

  setContext(items){
    if (!this.el.context) return;
    this.el.context.innerHTML = '';
    (items || []).forEach(([k, v]) => {
      const d = document.createElement('div');
      d.className = 'context-item';
      d.innerHTML = `<b>${escapeHtml(k)}</b> · ${escapeHtml(String(v))}`;
      this.el.context.appendChild(d);
    });
  }

  /* ================= CONVERSATION ================= */

  addMessage(role, text, { step = false, done = false, warn = false, error = false, typing = false } = {}){
    if (!this.el.conversation) return null;

    const el = document.createElement('div');
    el.className = 'msg';
    if (role === 'user') el.classList.add('user');
    if (step)  el.classList.add('step');
    if (done)  el.classList.add('done');
    if (warn)  el.classList.add('warn');
    if (error) el.classList.add('error');
    if (typing) el.classList.add('typing');

    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <div class="msg-head">
        <span class="msg-role">${role === 'user' ? 'OPERATOR' : 'JARVIS'}</span>
        <span class="msg-time">${time}</span>
      </div>
      <div class="msg-body">${escapeHtml(text)}</div>
    `;

    this.el.conversation.appendChild(el);
    this.messages.push(el);

    while (this.messages.length > CONFIG.MAX_CONVERSATION_ITEMS){
      const old = this.messages.shift();
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }

    // force layout so animation runs
    void el.offsetHeight;
    return el;
  }

  clearConversation(){
    if (!this.el.conversation) return;
    this.el.conversation.innerHTML = '';
    this.messages = [];
  }

  /* ================= TOASTS ================= */

  toast(text, kind = ''){
    const el = this.el.toastEl || this.el.toast;
    if (!el) return;
    el.textContent = text;
    el.className = 'toast show ' + kind;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.className = 'toast ' + kind;
    }, 2600);
  }

  /* ================= BUTTON STATES ================= */

  setMicActive(active){
    if (!this.el.btnMic) return;
    this.el.btnMic.classList.toggle('active', !!active);
  }

  setVoiceLabel(on){
    if (this.el.labelSpeak) this.el.labelSpeak.textContent = on ? 'VOICE ON' : 'VOICE OFF';
    if (this.el.btnSpeak) this.el.btnSpeak.classList.toggle('active', !on);
  }

  setSoundLabel(on){
    if (this.el.labelSound) this.el.labelSound.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    if (this.el.btnSound) this.el.btnSound.classList.toggle('active', !on);
  }

  /* ================= DRAWERS ================= */

  openDrawer(which){
    this.closeDrawers();
    const el = which === 'settings' ? this.el.settings : this.el.help;
    if (el){ el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
  }

  closeDrawers(){
    [this.el.settings, this.el.help].forEach(el => {
      if (el){ el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
    });
  }

  anyDrawerOpen(){
    return (this.el.settings && this.el.settings.classList.contains('open')) ||
           (this.el.help && this.el.help.classList.contains('open'));
  }

  /* ================= SETTINGS BINDING ================= */

  populateSettings({ voices, memory }){
    const sel = this.el.setVoice;
    if (sel){
      sel.innerHTML = '';
      if (!voices || !voices.length){
        const o = document.createElement('option');
        o.textContent = 'Default system voice';
        o.value = '';
        sel.appendChild(o);
        sel.disabled = true;
      } else {
        voices.forEach(v => {
          const o = document.createElement('option');
          o.value = v.voiceURI;
          o.textContent = `${v.name} — ${v.lang}`;
          sel.appendChild(o);
        });
        sel.value = memory.get('voiceURI') || '';
      }
    }

    if (this.el.setRate){
      this.el.setRate.value = String(memory.get('voiceRate') ?? 1);
      if (this.el.valRate) this.el.valRate.textContent = Number(this.el.setRate.value).toFixed(2);
    }
    if (this.el.setPitch){
      this.el.setPitch.value = String(memory.get('voicePitch') ?? 1);
      if (this.el.valPitch) this.el.valPitch.textContent = Number(this.el.setPitch.value).toFixed(2);
    }
    if (this.el.setQuality){
      this.el.setQuality.value = memory.get('quality') || 'AUTO';
    }
    if (this.el.setName){
      this.el.setName.value = memory.getName() || '';
    }
  }
}
