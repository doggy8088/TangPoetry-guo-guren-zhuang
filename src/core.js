/* 過故人莊 — core helpers (namespace, palette, PRNG, text timing).
 * Classic script (no ES modules) so the page can still show a friendly
 * message when opened via file://. Everything hangs off window.G. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  G.W = 1080;
  G.H = 1920;
  G.GROUND = 1440; // default feet line for characters

  // Strict palette from docs/DESIGN.md (+ a few documented extras: skin, blush, mouth, pants)
  G.P = {
    paper: '#FBF3E4', paper2: '#F2E6CF',
    ink: '#2B2B2B', ink2: '#6B6257',
    green: '#2F6B4F', green2: '#8CC084', green3: '#C9E4B4',
    hill: '#6FA8B8', hill2: '#4F8699',
    earth: '#D9A441', gold: '#F2C14E', millet: '#F6D55C',
    red: '#C8553D', blue: '#2E6FA7',
    mum: '#F2B33D', mum2: '#E98A2B',
    wood: '#A9743F', wood2: '#7A4E24',
    sky1: '#CFE8F3', sky2: '#EAF6FB',
    dusk1: '#F7B267', dusk2: '#F4845F', dusk3: '#6B4F8A',
    // extras (documented in docs/WEB.md)
    skin: '#F9DCC4', blush: '#F4A6A0', mouth: '#7A3326', tongue: '#EE8C7E',
    navy: '#24507A', white: '#FFFFFF', robe: '#E3DDD2', yard: '#EAD3A2'
  };

  G.SPEAKER_COLOR = { '旁白': '#2F6B4F', '小玉': '#C8553D', '阿庭': '#2E6FA7' };

  const qs = new URLSearchParams(location.search);
  G.isRender = qs.has('render') && qs.get('render') !== '0';

  /** mulberry32 seeded PRNG — the only source of randomness on the stage */
  G.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  G.html = function (str) {
    const t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  };
  G.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  G.r = (n) => Math.round(n * 100) / 100;
  G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- speech-time estimation inside a cue ----------
   * TTS reads roughly uniformly per character with pauses at punctuation.
   * Weighted character positions give a good estimate of *when* a word is
   * spoken, used to sync vocab cards, poem lighting, subtitles chunks. */
  const PAUSE = '，。！？；：、';
  const SILENT = '「」〈〉『』（）《》“”';
  G.charW = (ch) => (PAUSE.includes(ch) ? 2.2 : SILENT.includes(ch) ? 0.15 : ch === '…' ? 2 : 1);
  G.tAt = function (cue, idx) {
    const txt = cue.text;
    let tot = 0, pre = 0;
    for (let i = 0; i < txt.length; i++) {
      const w = G.charW(txt[i]);
      if (i < idx) pre += w;
      tot += w;
    }
    const lead = Math.min(0.3, cue.dur * 0.05);
    const tail = Math.min(0.4, cue.dur * 0.05);
    return cue.start + lead + (pre / tot) * (cue.dur - lead - tail);
  };
  /** time at which `word` is (first|last) spoken in the cue, or null */
  G.tWord = function (cue, word, which) {
    const txt = cue.text;
    let idx = -1;
    if (which === 'last') idx = txt.lastIndexOf(word);
    else {
      idx = txt.indexOf('「' + word + '」');
      if (idx >= 0) idx += 1;
      else idx = txt.indexOf(word);
    }
    if (idx < 0) return null;
    return G.tAt(cue, idx);
  };
  G.idxWord = function (cue, word, from) {
    return cue.text.indexOf(word, from || 0);
  };

  /* ---------- subtitles: split long text into ≤2-line chunks ---------- */
  const OPEN_NO_END = '「〈『（《';
  const CLOSE_NO_START = '，。！？；：、」〉』）》';
  G.splitSubtitle = function (text, maxLine, maxChunk) {
    maxLine = maxLine || 16; maxChunk = maxChunk || 32;
    const phrases = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
      cur += text[i];
      if (PAUSE.includes(text[i])) {
        while (i + 1 < text.length && '」〉』）》'.includes(text[i + 1])) cur += text[++i];
        phrases.push(cur); cur = '';
      }
    }
    if (cur) phrases.push(cur);
    // hard-split very long phrases
    const parts = [];
    phrases.forEach((p) => { while (p.length > maxChunk) { parts.push(p.slice(0, maxLine)); p = p.slice(maxLine); } if (p) parts.push(p); });
    // greedy pack, preferring to end chunks at sentence ends
    const chunks = [];
    let c = '';
    parts.forEach((p) => {
      const endsSentence = /[。！？][」〉』）]*$/.test(c);
      if (c && (c.length + p.length > maxChunk || (endsSentence && c.length >= 14 && c.length + p.length > 22))) { chunks.push(c); c = p; }
      else c += p;
    });
    if (c) chunks.push(c);
    // merge a tiny trailing chunk back if it fits
    if (chunks.length > 1 && chunks[chunks.length - 1].length <= 4 && chunks[chunks.length - 2].length + chunks[chunks.length - 1].length <= maxChunk) {
      const last = chunks.pop(); chunks[chunks.length - 1] += last;
    }
    return chunks.map((ch) => ({ text: ch, lines: G.breakLines(ch, maxLine) }));
  };
  G.breakLines = function (s, maxLine) {
    if (s.length <= maxLine) return [s];
    let best = -1, bestScore = 1e9;
    for (let p = Math.max(1, s.length - maxLine); p <= Math.min(maxLine, s.length - 1); p++) {
      if (CLOSE_NO_START.includes(s[p])) continue;
      if (OPEN_NO_END.includes(s[p - 1])) continue;
      const punct = PAUSE.includes(s[p - 1]) || '」〉』）'.includes(s[p - 1]);
      const score = (punct ? 0 : 6) + Math.abs(p - s.length / 2) * 0.6;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best < 0) best = Math.min(maxLine, s.length - 1);
    return [s.slice(0, best), s.slice(best)];
  };
})();
