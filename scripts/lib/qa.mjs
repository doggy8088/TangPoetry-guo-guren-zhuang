// Text-vs-transcript QA for TTS clips.
//
// Checks per attempt:
//   sim      Levenshtein ratio of normalized text vs full transcript  >= threshold
//   lenRatio transcript length / text length                          <= 1.25
//   telltale no instruction words / Latin words in the full transcript
//   head     first HEAD_SECONDS re-transcribed in the original language: must be
//            Chinese and match the beginning of the text. This exists because a
//            clip in which the model reads the English direction aloud is often
//            transcribed as just the Chinese line: the transcriber obeys the
//            spoken "read only the line below" instruction.
//   rate     trimmed duration must be plausible for the character count
//            (a direction read aloud adds 10-15 s).

export const HEAD_SECONDS = 6;
export const HEAD_PROMPT =
  'Transcribe this audio verbatim, in exactly the language(s) actually spoken. Do not translate: ' +
  'English speech stays in English; Mandarin is written in Traditional Chinese characters. Output only the transcript.';
export const HEAD_MIN_PREFIX_SIM = 0.4;

const TELLTALE = [
  'narrator', 'voicing', 'mandarin', 'verbatim', 'taiwanese', 'storytelling', 'director', 'transcript',
  '導演', '指示', '語氣', '旁白：', '旁白:', '配音', '逐字', '普通話', '國語', '台灣', '臺灣',
];

const CN_DIGITS = { '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };

/** Strip punctuation, symbols, whitespace (incl. 「」〈〉); lower-case; fold CJK digits. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\s]/gu, '')
    .replace(/[〇零一二三四五六七八九]/g, (c) => CN_DIGITS[c]);
}

export function levenshtein(a, b) {
  const A = Array.isArray(a) ? a : [...a], B = Array.isArray(b) ? b : [...b];
  if (!A.length) return B.length;
  if (!B.length) return A.length;
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

export function similarity(a, b) {
  const la = Array.isArray(a) ? a.length : [...a].length, lb = Array.isArray(b) ? b.length : [...b].length;
  if (!la && !lb) return 1;
  return 1 - levenshtein(a, b) / Math.max(la, lb);
}

/** Pinyin string -> array of toneless syllables ("zhì dào" / "zhi4 dao4" -> ["zhi","dao"]). */
export function syllables(p) {
  return String(p ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[0-9]/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Syllable-level Levenshtein ratio: homophone substitutions (黍/薯, 庭/婷, 至/志) cost nothing. */
export const pinyinSimilarity = (refPinyin, hypPinyin) => similarity(syllables(refPinyin), syllables(hypPinyin));

/** Best similarity of `head` against any prefix of `text` of about the same length. */
export function prefixSimilarity(head, text) {
  const H = Array.isArray(head) ? head : [...head], T = Array.isArray(text) ? text : [...text];
  if (!H.length) return 0;
  let best = 0;
  for (let L = Math.max(1, H.length - 3); L <= Math.min(T.length, H.length + 3); L++) {
    best = Math.max(best, similarity(H, T.slice(0, L)));
  }
  return best;
}

/** Prefix similarity on toneless pinyin syllables (homophone-aware head check). */
export const pinyinPrefixSimilarity = (headPinyin, refPinyin) => prefixSimilarity(syllables(headPinyin), syllables(refPinyin));

// English words typical of a direction read aloud. Whole-word matches only, and
// no pinyin syllables (e.g. "you", "a"): the head transcriber sometimes writes an
// isolated syllable as pinyin ("把" -> "pa"), which must not count as a leak.
const EN_WORDS = new Set(['are', 'the', 'of', 'read', 'only', 'text', 'below', 'line', 'speak', 'voice', 'voicing',
  'story', 'warm', 'gentle', 'lively', 'natural', 'pace', 'child', 'children', 'girl', 'boy', 'adding', 'nothing',
  'notes', 'cheerful', 'curious', 'kind', 'farm', 'countryside', 'never', 'slow', 'clear', 'animated', 'audio', 'profile']);

function telltalesIn(transcript, sourceText) {
  const t = String(transcript).toLowerCase();
  const src = String(sourceText).toLowerCase();
  const found = TELLTALE.filter((w) => t.includes(w) && !src.includes(w));
  const english = (t.match(/[a-z]+(?:'[a-z]+)?/g) ?? []).map((w) => w.replace(/'.*$/, '')).filter((w) => EN_WORDS.has(w));
  found.push(...new Set(english.slice(0, 6)));
  return [...new Set(found)];
}

/** Max plausible trimmed duration for a line of `chars` normalized characters. */
export const maxPlausibleDuration = (chars) => 2.5 + chars / 2.0;

/**
 * Evaluate one attempt. When the head window covers the whole clip
 * (`headCoversClip`), the head transcript is a second full transcription and
 * similarity uses the better of the two (short clips are noisy to transcribe).
 * `pinyinSim` / `headPinyinSim` (optional) are syllable-level scores; the
 * effective `sim` / `headSim` are the higher of the character and pinyin scores.
 * @returns {{pass:boolean, score:number, sim:number, charSim:number, pinyinSim:number|null, lenRatio:number, telltale:string[],
 *            headSim:number|null, rateOk:boolean, reasons:string[]}}
 */
export function evaluate({ text, transcript, headTranscript, headCoversClip = false, duration, threshold, pinyinSim = null, headPinyinSim = null }) {
  const nt = normalize(text);
  const chars = [...nt].length;
  const candidates = [transcript];
  if (headCoversClip && headTranscript) candidates.push(headTranscript);
  let sim = -1, lenRatio = 0;
  for (const c of candidates) {
    const nc = normalize(c), s = similarity(nt, nc);
    if (s > sim) { sim = s; lenRatio = chars ? [...nc].length / chars : 0; }
  }
  const charSim = sim;
  if (pinyinSim != null && pinyinSim > sim) sim = pinyinSim; // homophone-aware score
  const telltale = telltalesIn(transcript, text);
  const reasons = [];
  if (sim < threshold) reasons.push(`sim ${sim.toFixed(3)} < ${threshold}`);
  if (lenRatio > 1.25) reasons.push(`lenRatio ${lenRatio.toFixed(2)} > 1.25`);
  if (telltale.length) reasons.push(`telltale [${telltale.join(', ')}]`);

  let headSim = null;
  if (headTranscript != null) {
    const headTell = telltalesIn(headTranscript, text);
    headSim = prefixSimilarity(normalize(headTranscript), nt);
    if (headPinyinSim != null && headPinyinSim > headSim) headSim = headPinyinSim;
    if (headTell.length) reasons.push(`head telltale [${headTell.join(', ')}]`);
    if (headSim < HEAD_MIN_PREFIX_SIM) reasons.push(`head does not match text start (${headSim.toFixed(2)})`);
  }
  const maxDur = maxPlausibleDuration(chars);
  const rateOk = duration <= maxDur;
  if (!rateOk) reasons.push(`duration ${duration.toFixed(2)}s > plausible ${maxDur.toFixed(1)}s`);

  const pass = reasons.length === 0;
  // Ranking score for "best attempt" when nothing passes: similarity, heavily
  // penalized for structural failures (instruction leak / implausible length).
  const score = sim - (telltale.length ? 0.5 : 0) - (rateOk ? 0 : 0.5)
    - (headSim != null && headSim < HEAD_MIN_PREFIX_SIM ? 0.5 : 0) - Math.max(0, lenRatio - 1.25);
  return { pass, score, sim, charSim, pinyinSim, lenRatio, telltale, headSim, rateOk, reasons };
}
