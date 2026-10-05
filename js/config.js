/**
 * JARVIS 3D — Configuration
 * -------------------------------------------------------------
 * Optional remote AI. Leave AI_ENABLED = false to run fully
 * offline using the built-in local reasoning engine.
 *
 * NEVER commit API keys here. If you want a live model, deploy
 * a small serverless proxy (Cloudflare Worker, Vercel function,
 * etc.) that holds the key server-side, then point AI_ENDPOINT
 * at that proxy.
 *
 * Expected proxy contract:
 *   POST { AI_ENDPOINT }
 *   body: { prompt: string, history: [{role, content}] }
 *   response: { text: string }
 * -------------------------------------------------------------
 */
export const CONFIG = {
  AI_ENABLED: false,
  AI_ENDPOINT: '',
  AI_MODEL: '',
  AI_TIMEOUT_MS: 12000,

  APP_NAME: 'JARVIS 3D',
  VERSION: '1.0.0',

  DEFAULT_LANG: 'en-US',

  SPEECH_RATE: 1.0,
  SPEECH_PITCH: 1.0,
  SPEECH_VOLUME: 1.0,

  MAX_CONVERSATION_ITEMS: 8,

  QUALITY: {
    LOW:    { dpr: 1.0,  bloom: false, bloomStrength: 0.0, particles: 700,  segments: 1 },
    MEDIUM: { dpr: 1.25, bloom: true,  bloomStrength: 0.55, particles: 1600, segments: 2 },
    HIGH:   { dpr: 1.6,  bloom: true,  bloomStrength: 0.75, particles: 3200, segments: 3 },
    ULTRA:  { dpr: 2.0,  bloom: true,  bloomStrength: 1.0,  particles: 6000, segments: 4 }
  },

  MEMORY_KEY: 'jarvis3d.memory.v1',
  SESSION_KEY: 'jarvis3d.session.v1'
};
