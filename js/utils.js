/**
 * JARVIS 3D — Utility helpers + event bus
 */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp  = (a, b, t) => a + (b - a) * t;
export const rand  = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const pad2 = (n) => String(n).padStart(2, '0');

export function formatTime(d = new Date(), h24 = false) {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  let suffix = '';
  if (!h24) {
    suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  return `${h}:${m}:${s}${suffix ? ' ' + suffix : ''}`;
}

export function formatTimeShort(d = new Date()) {
  let h = d.getHours();
  const m = pad2(d.getMinutes());
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

export function formatDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

export function formatDateShort(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit'
  });
}

export function greetingForHour(h = new Date().getHours()) {
  if (h < 5)  return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function prefersReducedMotion() {
  return window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/** Simple deterministic-ish hash for stable pseudo random */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/* ------------------------------------------------------------------
   Tiny event bus — decouples modules
------------------------------------------------------------------ */
class EventBus {
  constructor(){ this.map = new Map(); }
  on(evt, fn){
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn){
    const s = this.map.get(evt);
    if (s) s.delete(fn);
  }
  emit(evt, payload){
    const s = this.map.get(evt);
    if (s) for (const fn of s) { try { fn(payload); } catch(e){ console.warn(e); } }
    const any = this.map.get('*');
    if (any) for (const fn of any) { try { fn(evt, payload); } catch(e){} }
  }
}

export const Bus = new EventBus();

/** Simple FPS meter */
export class FpsMeter {
  constructor(){ this.frames = 0; this.last = performance.now(); this.fps = 60; }
  tick(){
    this.frames++;
    const now = performance.now();
    if (now - this.last >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.last));
      this.frames = 0;
      this.last = now;
    }
    return this.fps;
  }
}
