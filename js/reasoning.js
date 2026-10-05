/**
 * JARVIS 3D — Local reasoning / planning layer.
 * Produces a short, high-level status sequence shown in the HUD.
 * It never exposes private chain-of-thought — only concise summaries.
 */
import { Personality } from './personality.js';
import { pick, shuffle } from './utils.js';

/** Intents that warrant a full multi-step plan */
const DEEP_INTENTS = new Set([
  'spaceMode', 'carMode', 'homeMode', 'shutdown', 'restart',
  'reset', 'status', 'openUrl', 'search', 'fullscreen',
  'clearMemory', 'setName'
]);

const LIGHT_INTENTS = new Set([
  'time', 'date', 'greeting', 'capabilities', 'alive',
  'smart', 'feelings', 'creator', 'getName', 'help', 'stop'
]);

/**
 * Build a plan of high-level steps for a classified intent.
 * @param {{id:string, value?:string}} intent
 * @returns {Array<{label:string, kind:'step'|'done'|'warn'}>}
 */
export function buildPlan(intent){
  const t = Personality.thinking;
  const id = intent.id;

  if (LIGHT_INTENTS.has(id)){
    // Shorter sequence, still feels considered
    const first = pick(t.understand);
    const last  = pick(t.respond);
    return [
      { label: first, kind: 'step' },
      { label: last,  kind: 'step' }
    ].filter(Boolean);
  }

  if (DEEP_INTENTS.has(id)){
    const steps = [];
    steps.push({ label: pick(t.understand), kind: 'step' });

    if (id === 'openUrl' || id === 'search'){
      steps.push({ label: `Command type: web`, kind: 'step' });
      steps.push({ label: `Target: ${String(intent.value || '').slice(0, 40)}`, kind: 'step' });
    } else if (id === 'spaceMode' || id === 'carMode' || id === 'homeMode'){
      steps.push({ label: `Command type: environment`, kind: 'step' });
      steps.push({ label: `Target: ${modeLabel(id)}`, kind: 'step' });
    } else if (id === 'shutdown' || id === 'restart' || id === 'reset'){
      steps.push({ label: `Command type: power`, kind: 'step' });
    } else if (id === 'status'){
      steps.push({ label: `Command type: diagnostics`, kind: 'step' });
    } else if (id === 'clearMemory' || id === 'setName'){
      steps.push({ label: `Command type: local memory`, kind: 'step' });
    } else if (id === 'fullscreen'){
      steps.push({ label: `Command type: display`, kind: 'step' });
    }

    steps.push({ label: pick(t.check), kind: 'step' });
    steps.push({ label: pick(t.plan),  kind: 'done' });
    steps.push({ label: pick(t.execute), kind: 'step' });
    return steps;
  }

  // unknown / empty
  return [
    { label: pick(t.understand), kind: 'step' },
    { label: pick(t.classify),   kind: 'step' },
    { label: 'No matching capability', kind: 'warn' }
  ];
}

/** Randomise step delays so timing feels organic */
export function stepDelay(){
  return 220 + Math.random() * 260;
}

/** Shuffle helper re-export for convenience */
export { shuffle };

function modeLabel(id){
  if (id === 'spaceMode') return 'SPACE MODE';
  if (id === 'carMode')   return 'CAR MODE';
  return 'HOME';
}
