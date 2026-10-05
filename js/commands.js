/**
 * JARVIS 3D — Command interpretation.
 * Regex-driven intent classifier with natural variation support.
 */

const norm = (s) =>
  ' ' + String(s || '')
    .toLowerCase()
    .replace(/[^\w\s\.\-\/:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';

const stripWake = (s) =>
  s.replace(/\b(hey\s+)?(jarvis|jervis|javis|jarvas|travis)\b/g, ' ')
   .replace(/\s+/g, ' ')
   .trim();

/* ---------------------------------------------------------------
   Intent definitions. Order matters — first match wins.
--------------------------------------------------------------- */
const INTENTS = [
  /* ---------------- TIME ---------------- */
  {
    id: 'time',
    patterns: [
      /\bwhat(?:'s| is)? the time\b/,
      /\bwhat time is it\b/,
      /\btell me the time\b/,
      /\bcurrent time\b/,
      /\btime (?:now|please)\b/,
      /\bdo you have the time\b/,
      /\bgot the time\b/
    ]
  },

  /* ---------------- DATE ---------------- */
  {
    id: 'date',
    patterns: [
      /\bwhat(?:'s| is)? (?:the )?date\b/,
      /\bwhat day is it\b/,
      /\btoday(?:'s)? date\b/,
      /\bcurrent date\b/,
      /\btell me the date\b/
    ]
  },

  /* ---------------- GREETING ---------------- */
  {
    id: 'greeting',
    patterns: [
      /\bhello\b/, /\bhi\b/, /\bhey\b/, /\bgood (?:morning|afternoon|evening|night)\b/,
      /\bgreetings\b/, /\bhow are you\b/, /\bhow(?:'s| is) it going\b/
    ]
  },

  /* ---------------- CAPABILITIES ---------------- */
  {
    id: 'capabilities',
    patterns: [
      /\bwhat can you do\b/, /\byour capabilities\b/, /\bwhat are you capable of\b/,
      /\bwhat do you do\b/, /\bhelp me understand what you can\b/,
      /\blist (?:of )?commands\b/, /\bwhat commands\b/
    ]
  },

  /* ---------------- IDENTITY ---------------- */
  { id: 'alive',    patterns: [/\bare you alive\b/, /\bare you conscious\b/, /\bare you sentient\b/, /\bare you real\b/, /\bdo you exist\b/] },
  { id: 'smart',    patterns: [/\bare you smart\b/, /\bare you intelligent\b/, /\bhow smart are you\b/] },
  { id: 'feelings', patterns: [/\bdo you have feelings\b/, /\bdo you feel\b/, /\bcan you feel\b/, /\bdo you have emotions\b/] },
  { id: 'creator',  patterns: [/\bwho (?:made|created|built) you\b/, /\bwho is your (?:creator|maker)\b/, /\bwhere do you come from\b/] },

  /* ---------------- NAME ---------------- */
  {
    id: 'setName',
    patterns: [
      /^\s*my name is ([a-z0-9' \-]{2,24})\s*$/,
      /^\s*call me ([a-z0-9' \-]{2,24})\s*$/,
      /^\s*i am ([a-z0-9' \-]{2,24})\s*$/,
      /^\s*i'm ([a-z0-9' \-]{2,24})\s*$/
    ],
    extract: (m) => m[1].trim()
  },
  {
    id: 'getName',
    patterns: [/\bwhat(?:'s| is) my name\b/, /\bdo you know my name\b/, /\bwho am i\b/]
  },

  /* ---------------- MEMORY ---------------- */
  {
    id: 'clearMemory',
    patterns: [
      /\bclear (?:your )?memory\b/, /\bforget (?:me|everything|my name)\b/,
      /\bwipe (?:your )?memory\b/, /\breset memory\b/, /\bdelete my data\b/
    ]
  },

  /* ---------------- SYSTEM STATUS ---------------- */
  {
    id: 'status',
    patterns: [
      /\bsystem status\b/, /\bstatus report\b/, /\bdiagnostics\b/,
      /\bhow are the systems\b/, /\breport status\b/, /\bstatus\b/
    ]
  },

  /* ---------------- MODES ---------------- */
  {
    id: 'spaceMode',
    patterns: [
      /\b(?:enter|activate|go to|switch to|start|open|engage|launch) (?:the )?space(?: mode)?\b/,
      /\bspace mode\b/, /\bstar ?field\b/, /\bgo to space\b/, /\bnavigate\b/
    ]
  },
  {
    id: 'carMode',
    patterns: [
      /\b(?:enter|activate|go to|switch to|start|open|engage|launch) (?:the )?car(?: mode)?\b/,
      /\bcar mode\b/, /\bvehicle mode\b/, /\bautomotive\b/, /\bgarage\b/, /\bworkshop\b/
    ]
  },
  {
    id: 'homeMode',
    patterns: [
      /\b(?:go|return|back) (?:to )?home\b/, /\bhome mode\b/,
      /\bexit (?:space|car)(?: mode)?\b/, /\bmain menu\b/, /\breset view\b/
    ]
  },

  /* ---------------- FULLSCREEN ---------------- */
  {
    id: 'fullscreen',
    patterns: [/\bfull ?screen\b/, /\bexpand (?:the )?display\b/, /\bmaximize\b/]
  },

  /* ---------------- OPEN URL ---------------- */
  {
    id: 'openUrl',
    patterns: [
      /\bopen\s+((?:https?:\/\/)?[\w\-]+(?:\.[\w\-]+)+(?:\/\S*)?)\s*$/,
      /\bgo to\s+((?:https?:\/\/)?[\w\-]+(?:\.[\w\-]+)+(?:\/\S*)?)\s*$/,
      /\blaunch\s+((?:https?:\/\/)?[\w\-]+(?:\.[\w\-]+)+(?:\/\S*)?)\s*$/
    ],
    extract: (m) => m[1]
  },

  /* ---------------- SEARCH ---------------- */
  {
    id: 'search',
    patterns: [
      /\bsearch(?: for)?\s+(.+)$/,
      /\blook up\s+(.+)$/,
      /\bgoogle\s+(.+)$/,
      /\bfind\s+(.+)$/
    ],
    extract: (m) => m[1].trim()
  },

  /* ---------------- CONTROLS ---------------- */
  { id: 'stop',   patterns: [/\b(?:stop|silence|quiet|shut up|halt|cancel)\b/] },
  { id: 'reset',  patterns: [/\breset(?: the)?(?: system| interface| everything)?\b/, /\bstart over\b/, /\brestore defaults\b/] },
  { id: 'restart',patterns: [/\brestart\b/, /\breboot\b/, /\breload the system\b/] },
  { id: 'shutdown',patterns: [/\bshut ?down\b/, /\bpower (?:off|down)\b/, /\bgo to (?:sleep|standby)\b/, /\bstandby\b/, /\bsleep\b/] },
  { id: 'help',   patterns: [/\bhelp\b/, /\bwhat should i say\b/, /\bhow do i use this\b/] }
];

/**
 * Classify a raw utterance.
 * @returns {{ id:string, value?:string, raw:string, matched:string }}
 */
export function classify(rawInput){
  const cleaned = stripWake(norm(rawInput)).trim();
  const padded = ' ' + cleaned + ' ';

  if (!cleaned) return { id: 'empty', raw: rawInput, matched: '' };

  for (const intent of INTENTS){
    for (const re of intent.patterns){
      const m = padded.match(re) || cleaned.match(re);
      if (m){
        const value = intent.extract ? intent.extract(m) : (m[1] || null);
        return { id: intent.id, value, raw: rawInput, matched: m[0].trim() };
      }
    }
  }

  return { id: 'unknown', raw: rawInput, matched: '' };
}

/** Estimate whether the input is a question (used for nicer fallbacks) */
export function looksLikeQuestion(s){
  return /\?\s*$/.test(s) || /^(what|who|when|where|why|how|is|are|can|do|does|will|would)\b/i.test(s.trim());
}
