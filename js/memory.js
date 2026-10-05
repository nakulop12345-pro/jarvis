/**
 * JARVIS 3D — Local memory (localStorage only)
 * Nothing is ever transmitted.
 */
import { CONFIG } from './config.js';

const DEFAULTS = () => ({
  name: null,
  voiceOn: true,
  soundOn: true,
  voiceRate: 1.0,
  voicePitch: 1.0,
  voiceURI: null,
  quality: 'AUTO',
  lastMode: 'home',
  visits: 0,
  firstSeen: Date.now(),
  lastSeen: Date.now(),
  theme: 'deep'
});

export class Memory {
  constructor(){
    this.data = this._load();
  }

  _load(){
    try {
      const raw = localStorage.getItem(CONFIG.MEMORY_KEY);
      if (!raw) return DEFAULTS();
      const parsed = JSON.parse(raw);
      return Object.assign(DEFAULTS(), parsed);
    } catch {
      return DEFAULTS();
    }
  }

  save(){
    try { localStorage.setItem(CONFIG.MEMORY_KEY, JSON.stringify(this.data)); }
    catch { /* storage disabled — degrade silently */ }
  }

  get(key){ return this.data[key]; }

  set(key, val){
    this.data[key] = val;
    this.save();
  }

  /** Called on each session start */
  startSession(){
    this.data.visits = (this.data.visits || 0) + 1;
    this.data.lastSeen = Date.now();
    this.save();
    return this.data.visits;
  }

  clear(){
    try { localStorage.removeItem(CONFIG.MEMORY_KEY); } catch {}
    this.data = DEFAULTS();
    this.save();
  }

  isReturning(){ return this.data.visits > 1; }

  hasName(){ return typeof this.data.name === 'string' && this.data.name.trim().length > 0; }

  getName(){ return this.hasName() ? this.data.name.trim() : null; }
}
