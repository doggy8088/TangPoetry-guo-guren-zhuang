/* 過故人莊 — load narration.json + timeline.json; build an estimated timeline if the
 * TTS pipeline has not produced script/timeline.json yet. */
(function () {
  'use strict';
  const G = window.G;

  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) { const e = new Error(url + ' ' + res.status); e.status = res.status; throw e; }
    return res.json();
  }

  /** Same spacing rules as the TTS pipeline, with duration ≈ 0.6 + chars/4.3 s */
  G.estimateTimeline = function (nar) {
    const tm = nar.timing || { lead_in: 1, gap_cue: 0.45, gap_scene: 1.4, tail: 4 };
    let t = tm.lead_in;
    let prev = null;
    const cues = nar.cues.map((c) => {
      if (prev) t += (prev.scene !== c.scene ? tm.gap_scene : tm.gap_cue) + (prev.pause_after || 0);
      const dur = 0.6 + c.text.length / 4.3;
      const cue = { id: c.id, scene: c.scene, speaker: c.speaker, text: c.text, start: t, end: t + dur };
      t += dur; prev = c;
      return cue;
    });
    const total = t + tm.tail;
    const scenes = nar.scenes.map((s) => {
      const first = cues.find((c) => c.scene === s.id);
      return { id: s.id, name: s.name, start: Math.max(0, first.start - 0.6) };
    });
    scenes.forEach((s, i) => { s.end = i + 1 < scenes.length ? scenes[i + 1].start : total; });
    return { fps: 30, total, scenes, cues, vocab_audio: {}, estimated: true };
  };

  /** merge narration (content) + timeline (timing) into one normalized model */
  G.normalize = function (nar, tl) {
    const tcMap = {};
    tl.cues.forEach((c) => (tcMap[c.id] = c));
    const est = G.estimateTimeline(nar);
    const estMap = {};
    est.cues.forEach((c) => (estMap[c.id] = c));
    const cues = nar.cues.map((c) => {
      const t = tcMap[c.id] || estMap[c.id];
      const cue = Object.assign({}, c, { start: +t.start, end: +t.end, audio: t.audio || null });
      cue.dur = cue.end - cue.start;
      return cue;
    });
    const cueMap = {};
    cues.forEach((c) => (cueMap[c.id] = c));
    const total = +tl.total || est.total;
    const tScenes = {};
    (tl.scenes || []).forEach((s) => (tScenes[s.id] = s));
    const scenes = nar.scenes.map((s) => {
      const sc = Object.assign({}, s);
      const t = tScenes[s.id];
      const mine = cues.filter((c) => c.scene === s.id);
      sc.start = t ? +t.start : Math.max(0, mine[0].start - 0.6);
      sc.cues = mine;
      return sc;
    });
    scenes[0].start = 0;
    scenes.forEach((s, i) => {
      const t = tScenes[s.id];
      s.end = i + 1 < scenes.length ? scenes[i + 1].start : total;
      if (t && t.end && i === scenes.length - 1) s.end = Math.max(+t.end, total);
    });
    const vocabMap = {};
    nar.vocab.forEach((v) => (vocabMap[v.word] = v));
    return {
      title: nar.title, poet: nar.poet, poem: nar.poem, speakers: nar.speakers,
      vocab: nar.vocab, vocabMap, cues, cueMap, scenes, total,
      fps: tl.fps || 30, vocab_audio: tl.vocab_audio || {}, estimated: !!tl.estimated
    };
  };

  G.loadData = async function () {
    if (location.protocol === 'file:') throw new Error('file:// cannot fetch JSON — run `npm run serve`');
    const nar = await getJSON('script/narration.json');
    let tl;
    try {
      if (/[?&]estimate\b/.test(location.search)) throw new Error('forced estimate');
      tl = await getJSON('script/timeline.json');
      if (!tl || !Array.isArray(tl.cues) || !tl.cues.length) throw new Error('empty timeline');
    } catch (e) {
      tl = G.estimateTimeline(nar);
    }
    return G.normalize(nar, tl);
  };
})();
