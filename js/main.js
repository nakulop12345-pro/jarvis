/**
 * JARVIS 3D — Entry point.
 * Boot sequence, wiring, keyboard shortcuts, settings.
 */
import { CONFIG } from './config.js';
import { Memory } from './memory.js';
import { AudioEngine } from './audio.js';
import { SpeechEngine } from './speech.js';
import { UI } from './ui.js';
import { Scene3D, autoQuality } from './three-scene.js';
import { Jarvis } from './jarvis.js';
import { Bus, sleep, prefersReducedMotion, greetingForHour, pick } from './utils.js';

/* ============================================================
   BOOT OVERLAY CONTROLLER
============================================================ */
const $ = (id) => document.getElementById(id);

const bootEl      = $('boot');
const bootStatus  = $('boot-status');
const bootBar     = $('boot-bar');
const bootLog     = $('boot-log');
const startBtn    = $('start-btn');
const standbyEl   = $('standby');
const wakeBtn     = $('wake-btn');

/* ============================================================
   MAIN
============================================================ */
async function main(){
  /* ---------------- memory + engines ---------------- */
  const memory = new Memory();
  const visits = memory.startSession();

  const audio  = new AudioEngine();
  const speech = new SpeechEngine();
  const ui     = new UI(memory);

  /* ---------------- scene ---------------- */
  const canvas = $('scene');
  const scene  = new Scene3D(canvas, { quality: memory.get('quality') || 'AUTO' });

  /* ---------------- jarvis ---------------- */
  const jarvis = new Jarvis({ memory, speech, audio, ui, scene });

  // expose for debugging / extensibility
  window.JARVIS = { memory, audio, speech, ui, scene, jarvis, CONFIG, Bus };

  /* ---------------- restore preferences ---------------- */
  audio.setEnabled(memory.get('soundOn') !== false);
  ui.setSoundLabel(memory.get('soundOn') !== false);
  ui.setVoiceLabel(memory.get('voiceOn') !== false);

  scene.setPower(0);
  scene.start();

  /* ---------------- boot log ---------------- */
  const logLines = [
    'core: allocating render pipeline',
    'core: geometry buffers <b>OK</b>',
    'holo: shader compile <b>OK</b>',
    'audio: engine <b>READY</b>',
    'voice: synthesis <b>' + (speech.supportedTTS ? 'READY' : 'UNAVAILABLE') + '</b>',
    'voice: recognition <b>' + (speech.supportedSTT ? 'READY' : 'UNAVAILABLE') + '</b>',
    'memory: local store <b>OK</b>',
    'env: quality tier <b>' + scene.qualityName + '</b>',
    'sys: awaiting operator'
  ];

  let logIndex = 0;
  const logTimer = setInterval(() => {
    if (logIndex >= logLines.length){
      clearInterval(logTimer);
      bootEl.classList.add('ready');
      bootStatus.textContent = 'READY';
      return;
    }
    const d = document.createElement('div');
    d.innerHTML = '&gt; ' + logLines[logIndex];
    bootLog.appendChild(d);
    if (bootLog.children.length > 8) bootLog.removeChild(bootLog.firstChild);
    bootBar.style.width = Math.round(((logIndex + 1) / logLines.length) * 100) + '%';
    logIndex++;
  }, 220);

  bootStatus.textContent = 'INITIALIZING';

  /* ============================================================
     START
  ============================================================ */
  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    audio.init();
    audio.resume();
    audio.boot();

    bootEl.classList.add('awake');
    bootStatus.textContent = 'MATERIALIZING';

    // Fade in the 3D core behind the overlay
    scene.setPower(1);

    await sleep(1500);
    bootEl.classList.add('online');
    bootStatus.textContent = 'ONLINE';
    audio.online();

    await sleep(1400);
    bootEl.classList.add('finished');
    await sleep(500);
    bootEl.classList.add('hidden');

    ui.show();
    ui.updateMemoryInfo();
    ui.updateEnvironment();
    ui.setMode('home');

    const returning = visits > 1 && memory.hasName();

    // Give the user a beat to see the core before the greeting
    await sleep(700);
    jarvis.boot({ returning });

    // Update diagnostics continuously
    startDiagnosticsLoop();
  }, { once: true });

  /* ============================================================
     DIAGNOSTICS LOOP
  ============================================================ */
  function startDiagnosticsLoop(){
    let last = performance.now();
    let latencySamples = [];

    setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      latencySamples.push(dt);
      if (latencySamples.length > 20) latencySamples.shift();
      const avg = latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length;

      // Derived "load" is a real frame-time based metric, labelled honestly
      const load = Math.min(100, Math.max(0, (avg / 33.3) * 100));

      ui.updateDiagnostics({
        fps: scene.getFps(),
        quality: scene.qualityName,
        latency: avg,
        load
      });
      ui.updateEnvironment();
    }, 1000);
  }

  /* ============================================================
     AUDIO REACTIVITY LOOP
  ============================================================ */
  (function reactLoop(){
    requestAnimationFrame(reactLoop);
    jarvis.updateAudioReactivity();
  })();

  /* ============================================================
     CONTROLS
  ============================================================ */
  $('btn-mic').addEventListener('click', () => {
    audio.resume();
    jarvis.toggleListening();
  });

  $('btn-speak').addEventListener('click', () => {
    jarvis.setVoiceEnabled(!jarvis.voiceEnabled);
  });

  $('btn-sound').addEventListener('click', () => {
    audio.resume();
    jarvis.setSoundEnabled(!jarvis.soundEnabled);
  });

  $('btn-home').addEventListener('click', () => {
    jarvis.handleInput('go home');
  });
  $('btn-space').addEventListener('click', () => {
    jarvis.handleInput('enter space mode');
  });
  $('btn-car').addEventListener('click', () => {
    jarvis.handleInput('enter car mode');
  });

  $('btn-fullscreen').addEventListener('click', () => {
    jarvis.handleInput('fullscreen');
  });

  $('btn-shutdown').addEventListener('click', () => {
    jarvis.handleInput('shutdown');
  });

  $('btn-help').addEventListener('click', () => ui.openDrawer('help'));
  $('help-close').addEventListener('click', () => ui.closeDrawers());

  $('btn-settings').addEventListener('click', () => ui.openDrawer('settings'));
  $('settings-close').addEventListener('click', () => ui.closeDrawers());

  $('clear-memory').addEventListener('click', () => {
    memory.clear();
    memory.startSession();
    ui.updateMemoryInfo();
    ui.toast('LOCAL MEMORY CLEARED');
    audio.success();
  });

  /* ---------------- settings binding ---------------- */
  ui.populateSettings({ voices: speech.getVoices(), memory });
  setTimeout(() => ui.populateSettings({ voices: speech.getVoices(), memory }), 1600);

  const setVoiceSelect = $('set-voice');
  setVoiceSelect.addEventListener('change', () => {
    memory.set('voiceURI', setVoiceSelect.value || null);
    speech.setVoiceByURI(setVoiceSelect.value);
    ui.toast('VOICE UPDATED');
  });

  const setRate = $('set-rate');
  setRate.addEventListener('input', () => {
    const v = Number(setRate.value);
    memory.set('voiceRate', v);
    $('val-rate').textContent = v.toFixed(2);
  });

  const setPitch = $('set-pitch');
  setPitch.addEventListener('input', () => {
    const v = Number(setPitch.value);
    memory.set('voicePitch', v);
    $('val-pitch').textContent = v.toFixed(2);
  });

  const setQuality = $('set-quality');
  setQuality.addEventListener('change', () => {
    const v = setQuality.value;
    memory.set('quality', v);
    if (v === 'AUTO'){
      scene.setQuality(autoQuality());
    } else {
      scene.setQuality(v);
    }
    ui.toast('QUALITY: ' + scene.qualityName);
  });

  const setName = $('set-name');
  setName.addEventListener('change', () => {
    const v = setName.value.trim();
    if (v.length >= 2){
      memory.set('name', v.charAt(0).toUpperCase() + v.slice(1));
      ui.updateMemoryInfo();
      ui.toast('OPERATOR NAME SAVED');
    }
  });

  /* ============================================================
     KEYBOARD
  ============================================================ */
  window.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

    if (e.key === 'Escape'){
      if (ui.anyDrawerOpen()) ui.closeDrawers();
      else jarvis.stopListening();
      return;
    }
    if (typing) return;

    switch (e.code){
      case 'Space':
        e.preventDefault();
        audio.resume();
        jarvis.toggleListening();
        break;
      case 'Digit1':
        jarvis.handleInput('go home');
        break;
      case 'Digit2':
        jarvis.handleInput('enter space mode');
        break;
      case 'Digit3':
        jarvis.handleInput('enter car mode');
        break;
      case 'KeyF':
        jarvis.handleInput('fullscreen');
        break;
      case 'KeyM':
        jarvis.setVoiceEnabled(!jarvis.voiceEnabled);
        break;
      case 'KeyS':
        jarvis.setSoundEnabled(!jarvis.soundEnabled);
        break;
    }
  });

  /* ============================================================
     SHUTDOWN / WAKE
  ============================================================ */
  Bus.on('shutdown', () => {
    scene.setPower(0);
    ui.hide();
    ui.clearConversation();
    setTimeout(() => {
      standbyEl.classList.remove('hidden');
      standbyEl.setAttribute('aria-hidden', 'false');
    }, 900);
  });

  wakeBtn.addEventListener('click', async () => {
    standbyEl.classList.add('hidden');
    standbyEl.setAttribute('aria-hidden', 'true');

    audio.init();
    audio.resume();
    audio.activation();
    scene.setPower(1);
    await sleep(900);
    ui.show();
    ui.setMode(scene.camRig.mode);
    audio.online();
    const greet = PersonalityGreeting();
    ui.addMessage('jarvis', greet, { typing: true });
    if (jarvis.voiceEnabled) jarvis.speak(greet);
  });

  function PersonalityGreeting(){
    const name = memory.getName();
    const g = greetingForHour();
    const pool = [
      `${g}${name ? ', ' + name : ''}. Systems restored.`,
      `Back online. ${g}${name ? ', ' + name : ''}.`,
      `Systems restored. Standing by.`
    ];
    return pick(pool);
  }

  /* ============================================================
     VISIBILITY / PERFORMANCE
  ============================================================ */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.stop();
    else scene.start();
  });

  /* Network status */
  window.addEventListener('online',  () => { ui.updateEnvironment(); ui.toast('NETWORK ONLINE'); });
  window.addEventListener('offline', () => { ui.updateEnvironment(); ui.toast('NETWORK OFFLINE', 'warn'); });
}

/* ============================================================
   GO
============================================================ */
main().catch(err => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot){
    boot.innerHTML = `
      <div style="font-family:monospace;color:#ff6f6f;text-align:center;padding:32px;max-width:560px">
        <div style="letter-spacing:.3em;margin-bottom:16px">JARVIS 3D · STARTUP FAILURE</div>
        <div style="color:#8fa3b4;font-size:12px;line-height:1.7">
          ${String(err && err.message || err)}<br><br>
          This usually means WebGL is unavailable or the Three.js CDN could not be reached.
        </div>
      </div>`;
  }
});
