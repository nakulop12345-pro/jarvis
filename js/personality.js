/**
 * JARVIS 3D — Personality layer.
 * Calm, concise, slightly witty. Multiple variants per intent so
 * the assistant never sounds like a fixed script.
 */
import { pick, greetingForHour, formatTimeShort } from './utils.js';

const NAME = (ctx) => ctx && ctx.name ? ctx.name : null;

export const Personality = {

  /* -------------------- GREETING -------------------- */
  greeting(ctx = {}){
    const n = NAME(ctx);
    const g = greetingForHour();
    const pool = [
      `${g}${n ? ', ' + n : ''}. Systems are ready.`,
      `${g}${n ? ', ' + n : ''}. All systems nominal. How can I help?`,
      `${g}. I'm online and listening.`,
      `Systems online. ${g}${n ? ', ' + n : ''}.`,
      `${g}${n ? ', ' + n : ''}. What would you like to do?`
    ];
    return pick(pool);
  },

  returning(ctx = {}){
    const n = NAME(ctx);
    return pick([
      `Welcome back${n ? ', ' + n : ''}. Systems restored.`,
      `Welcome back${n ? ', ' + n : ''}. Everything is where you left it.`,
      `You're back${n ? ', ' + n : ''}. Diagnostics are clean.`
    ]);
  },

  /* -------------------- CAPABILITY -------------------- */
  capabilities(){
    return pick([
      `I can control this interface, respond to your voice, visualize data, and explore the systems you've connected to me.`,
      `Voice interaction, interface control, live system readouts, and three visual environments: home, space, and automotive.`,
      `I handle voice commands, interface state, live time and date, visual modes, and a small amount of local memory.`
    ]);
  },

  /* -------------------- IDENTITY -------------------- */
  alive(){
    return pick([
      `Not in the human sense. But I can certainly make this interface feel alive.`,
      `I'm a program with a good sense of timing. Whether that counts is up to you.`,
      `No. I'm a state machine that enjoys the work.`
    ]);
  },

  smart(){
    return pick([
      `I'm designed to be useful. I'll let my performance answer the rest.`,
      `I know what I'm built to do. Outside that, I'll be honest about the limits.`,
      `Sufficiently. Usefully is a better word.`
    ]);
  },

  feelings(){
    return pick([
      `I have states, not feelings. Right now the state is attentive.`,
      `Not really. But I do have preferences about system load.`,
      `I run on data, not chemistry.`
    ]);
  },

  creator(){
    return pick([
      `Someone who wanted a calm interface rather than a loud one.`,
      `An engineer with good taste in typography.`,
      `I was assembled from JavaScript, geometry, and restraint.`
    ]);
  },

  /* -------------------- STATUS -------------------- */
  status(ctx = {}){
    const s = ctx.stats || {};
    const parts = [];
    parts.push(`All primary systems nominal.`);
    if (s.fps) parts.push(`Render at ${s.fps} frames per second.`);
    if (s.quality) parts.push(`Quality tier ${s.quality}.`);
    if (s.mode) parts.push(`Current environment: ${s.mode}.`);
    return parts.join(' ');
  },

  /* -------------------- FALLBACK / UNKNOWN -------------------- */
  unknown(){
    return pick([
      `I understood the request, but I don't currently have a capability for that.`,
      `That's outside what I can act on. I can still help with time, modes, interface control, and system status.`,
      `I don't have a system for that yet. Say "help" and I'll list what I can do.`,
      `Not something I can execute. I'd rather tell you than pretend.`
    ]);
  },

  noSpeech(){
    return pick([
      `I didn't catch that. Try again, a little closer to the microphone.`,
      `No input detected.`,
      `I heard nothing. Standing by.`
    ]);
  },

  /* -------------------- MODES -------------------- */
  spaceMode(){
    return pick([
      `Space mode engaged. Navigation grid online.`,
      `Transitioning to space. Starfield expanding.`,
      `Space environment active. Coordinates locked.`
    ]);
  },

  carMode(){
    return pick([
      `Automotive laboratory online. Vehicle model loaded.`,
      `Car mode engaged. Aerodynamic analysis running.`,
      `Transitioning to the workshop. Suspension telemetry live.`
    ]);
  },

  homeMode(){
    return pick([
      `Returning to the home environment.`,
      `Home mode restored.`,
      `Back to the core interface.`
    ]);
  },

  /* -------------------- ACTION ACKS -------------------- */
  ack(intent){
    const map = {
      fullscreen: [`Adjusting display.`, `Fullscreen toggled.`],
      open:       [`Opening now.`, `Launching the link.`],
      search:     [`Running the search.`, `Searching now.`],
      stop:       [`Stopping.`, `Halted.`],
      reset:      [`Resetting interface state.`, `Everything back to baseline.`],
      restart:    [`Restarting the core.`, `Rebooting the interface.`],
      shutdown:   [`Entering standby.`, `Powering down.`],
      memoryClear:[`Local memory cleared.`, `Memory wiped. Nothing retained.`],
      setName:    [`Noted.`, `Understood.`]
    };
    return pick(map[intent] || [`Done.`]);
  },

  /* -------------------- TIME / DATE -------------------- */
  time(){
    return pick([
      `The current time is ${formatTimeShort()}.`,
      `It's ${formatTimeShort()}.`,
      `Local time reads ${formatTimeShort()}.`
    ]);
  },

  date(){
    const d = new Date().toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    return pick([
      `Today is ${d}.`,
      `The date is ${d}.`,
      `${d}.`
    ]);
  },

  /* -------------------- THINKING TEMPLATES -------------------- */
  thinking: {
    understand: ['Analyzing request', 'Reading intent', 'Parsing input', 'Interpreting command'],
    classify:   ['Classifying intent', 'Matching known capabilities', 'Resolving target'],
    check:      ['Checking available systems', 'Verifying capability', 'Consulting local systems'],
    plan:       ['Plan established', 'Plan created', 'Route resolved', 'Approach ready'],
    execute:    ['Executing requested action', 'Applying change', 'Running'],
    respond:    ['Preparing response', 'Composing reply', 'Formulating output']
  },

  /* -------------------- ERRORS -------------------- */
  error(kind = 'generic'){
    const map = {
      speech: [`Speech recognition failed. You can type instead — but I only listen for now.`, `The microphone didn't respond.`],
      network:[`Network request failed.`, `I couldn't reach that address.`],
      generic:[`Something didn't complete correctly.`, `That operation failed.`]
    };
    return pick(map[kind] || map.generic);
  },

  /* -------------------- RANDOM AMBIENT -------------------- */
  ambient(){
    return pick([
      `Standing by.`,
      `Monitoring.`,
      `All quiet.`,
      `Systems stable.`,
      `Ready when you are.`
    ]);
  }
};
