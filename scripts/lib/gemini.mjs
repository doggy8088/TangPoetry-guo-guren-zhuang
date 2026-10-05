// Gemini API helpers: TTS synthesis + transcription (for QA).
// The API key is read from GEMINI_API_KEY and is never logged: every error
// message passes through redact() before it leaves this module.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const TTS_MODEL = 'gemini-3.8-flash-tts';
export const STT_MODEL = 'gemini-2.5-flash';
export const TRANSCRIBE_PROMPT = '請逐字轉寫這段音檔的內容（繁體中文），只輸出轉寫文字。';

/**
 * TTS prompt. The English direction goes under a DIRECTOR'S NOTES heading and the
 * line under TRANSCRIPT (layout from Google's Gemini TTS prompting guide).
 * The plain `${direction}\n\n${text}` layout made the model read the direction
 * aloud in 7 of 8 test generations (2026-10-05); this layout leaked in 1 of 26.
 */
export const ttsPrompt = (direction, text) => `### DIRECTOR'S NOTES\n${direction}\n\n### TRANSCRIPT\n${text}`;

const BACKOFF_MS = [1000, 2000, 4000, 8000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function apiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY is not set');
  return k;
}

export function redact(s) {
  const k = process.env.GEMINI_API_KEY;
  const str = String(s);
  return k ? str.split(k).join('***') : str;
}

export class GeminiError extends Error {
  constructor(message, status = 0) {
    super(redact(message));
    this.name = 'GeminiError';
    this.status = status;
  }
}

// Honour google.rpc.RetryInfo ("retryDelay": "17s") when the server sends one.
function retryDelayFrom(body) {
  try {
    const j = JSON.parse(body);
    for (const d of j?.error?.details ?? []) {
      const m = /^([\d.]+)s$/.exec(d?.retryDelay ?? '');
      if (m) return parseFloat(m[1]) * 1000;
    }
  } catch { /* not JSON */ }
  return 0;
}

/**
 * POST models/{model}:generateContent with retry on network errors, 429 and 5xx
 * (exponential backoff 1s, 2s, 4s, 8s; a larger server-provided retryDelay wins).
 */
export async function generateContent(model, body, { timeoutMs = 180_000, log = () => {} } = {}) {
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey())}`;
  for (let attempt = 0; ; attempt++) {
    let res, text;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await res.text();
    } catch (e) {
      const why = redact(`${e?.name ?? 'Error'}: ${e?.cause?.code ?? e?.message ?? e}`);
      if (attempt < BACKOFF_MS.length) {
        log(`    ${model}: network error (${why}); retry in ${BACKOFF_MS[attempt] / 1000}s`);
        await sleep(BACKOFF_MS[attempt]);
        continue;
      }
      throw new GeminiError(`${model}: network error after ${attempt + 1} tries: ${why}`);
    }
    if (res.ok) {
      try { return JSON.parse(text); }
      catch { throw new GeminiError(`${model}: invalid JSON response`, res.status); }
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < BACKOFF_MS.length) {
      const wait = Math.min(60_000, Math.max(BACKOFF_MS[attempt], retryDelayFrom(text)));
      log(`    ${model}: HTTP ${res.status}; retry in ${(wait / 1000).toFixed(1)}s`);
      await sleep(wait);
      continue;
    }
    throw new GeminiError(`${model}: HTTP ${res.status}: ${text.slice(0, 400)}`, res.status);
  }
}

/** Wrap raw little-endian 16-bit PCM in a WAV header. */
export function pcmToWav(pcm, sampleRate = 24000, channels = 1) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/**
 * Synthesize speech. Style lives in the prompt text (systemInstruction is not
 * supported by the TTS model). Returns a WAV Buffer (24 kHz mono s16le).
 */
export async function synthesize({ prompt, voice, log }) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  const j = await generateContent(TTS_MODEL, body, { log });
  const cand = j?.candidates?.[0];
  const part = cand?.content?.parts?.find((p) => p?.inlineData?.data);
  if (!part) {
    throw new GeminiError(`TTS returned no audio (finishReason=${cand?.finishReason ?? 'n/a'})`, 200);
  }
  const buf = Buffer.from(part.inlineData.data, 'base64');
  const mime = part.inlineData.mimeType ?? '';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF') return buf;
  // Fallback for raw PCM responses (e.g. "audio/L16;codec=pcm;rate=24000").
  const rate = Number(/rate=(\d+)/i.exec(mime)?.[1] ?? 24000);
  return pcmToWav(buf, rate, 1);
}

/** Transcribe a WAV buffer with gemini-2.5-flash. Returns plain text. */
export async function transcribe(wav, { prompt = TRANSCRIBE_PROMPT, log } = {}) {
  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType: 'audio/wav', data: Buffer.from(wav).toString('base64') } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  };
  const j = await generateContent(STT_MODEL, body, { timeoutMs: 120_000, log });
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim();
}

/**
 * Convert several Chinese strings to Hanyu Pinyin (one syllable per character)
 * with one structured text call. Used only to make the QA similarity
 * homophone-aware. Returns an object with the same keys as `texts`.
 */
export async function toPinyin(texts, { log } = {}) {
  const keys = Object.keys(texts);
  const body = {
    contents: [{
      parts: [{
        text: 'Convert each value of this JSON object to Hanyu Pinyin as used in Taiwan Mandarin: one syllable per ' +
          'Chinese character, choosing polyphone readings from context, syllables separated by single spaces, no tones, ' +
          'no punctuation. Keep Arabic digits and Latin words as they are. Return a JSON object with the same keys.\n\n' +
          JSON.stringify(texts),
      }],
    }],
    generationConfig: {
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: Object.fromEntries(keys.map((k) => [k, { type: 'STRING' }])), required: keys },
    },
  };
  const j = await generateContent(STT_MODEL, body, { timeoutMs: 60_000, log });
  const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  try { return JSON.parse(text); }
  catch { throw new GeminiError('pinyin conversion returned invalid JSON'); }
}
