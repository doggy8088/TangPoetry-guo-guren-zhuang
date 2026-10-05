/* 過故人莊 — boot: load data, build the stage + ONE paused GSAP master timeline,
 * expose window.player = { ready, duration, seek(t) } for the frame renderer. */
(function () {
  'use strict';
  const G = window.G;

  gsap.defaults({ lazy: false });
  gsap.config({ force3D: false, autoSleep: 60, nullTargetWarn: false });

  let M = null;
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
  ready.catch(() => {});

  const player = (window.player = {
    ready,
    duration: 0,
    /** synchronous, deterministic seek */
    seek(t) {
      if (!M) return;
      M.tl.pause();
      M.tl.time(G.clamp(+t || 0, 0, M.data.total), false);
    },
    get time() { return M ? M.tl.time() : 0; },
    get master() { return M; }
  });

  G.buildStage = function (data) {
    const stage = document.getElementById('stage');
    stage.innerHTML = `<div id="scenes"></div><div id="grain"></div><div id="vignette"></div>
      <div id="layer-recite"></div><div id="layer-cards"></div><div id="layer-subs"></div>
      ${data.estimated ? '<div id="est-badge">估算時間軸</div>' : ''}`;
    const tl = gsap.timeline({ paused: true, autoRemoveChildren: false, smoothChildTiming: false });
    const m = {
      tl, data, sections: [], ctxs: [], talkers: {}, cardCfg: {}, reciteCfg: [], cardTimes: {},
      layers: { recite: stage.querySelector('#layer-recite'), cards: stage.querySelector('#layer-cards'), subs: stage.querySelector('#layer-subs') }
    };
    const scenesEl = stage.querySelector('#scenes');
    data.scenes.forEach((sc) => {
      const S = G.scenes[sc.id] || {};
      const sec = G.html(`<section class="scene" id="scene-${sc.id}" data-scene="${sc.id}">
        <svg class="scene-svg" viewBox="0 0 1080 1920" width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">${S.svg ? S.svg(sc, data) : ''}</svg>
        <div class="scene-html">${S.html ? S.html(sc, data) : ''}</div><div class="shade"></div></section>`);
      scenesEl.appendChild(sec);
      m.sections.push(sec);
    });
    data.scenes.forEach((sc, i) => {
      const S = G.scenes[sc.id] || {};
      const ctx = G.makeCtx(m, sc, m.sections[i]);
      m.ctxs.push(ctx);
      if (S.anim) S.anim(ctx);
    });
    // characters talk while their cue is active
    data.cues.forEach((cue) => {
      if (cue.speaker === '旁白') return;
      const tk = m.talkers[cue.scene] || {};
      const ch = tk[cue.id] || tk[cue.speaker];
      if (ch) ch.talk(cue.start + 0.08, cue.end - 0.1, tk['rest:' + cue.id]);
    });
    G.buildSubtitles(m);
    G.buildCards(m);
    G.buildRecite(m);
    G.buildTransitions(m);
    tl.set({}, {}, data.total); // pin duration
    m.sections.forEach((s, i) => gsap.set(s, { autoAlpha: i === 0 ? 1 : 0, zIndex: i === 0 ? 2 : 1 }));
    // Warm-up: initialise every tween once (in time order) and rewind. Afterwards every
    // animated element carries GSAP-written inline styles, so the DOM produced by seek(t)
    // is identical no matter which times were visited before (pixel-exact determinism).
    tl.time(data.total, false);
    tl.time(0, false);
    return m;
  };

  function allText(data) {
    const parts = [data.title, data.poet, '唐・孟浩然　我會背挑戰時間估算時間軸生字表背誦模式朗讀這一句全部顯示隱藏生字隱藏一半只剩圖開始看故事播放暫停靜音重播下次見九月初九重陽農曆初三初四初五初六初七初八嘎吱啪桑樹桑葉蠶寶寶蠶絲絲綢麻莖纖維繩子布郭斜場圃合Zz？！，。、：「」〈〉（）＝・0123456789'];
    data.cues.forEach((c) => parts.push(c.text, c.speaker));
    data.poem.forEach((l) => parts.push(l.join('')));
    data.vocab.forEach((v) => parts.push(v.word, v.zhuyin, v.meaning, v.example));
    data.scenes.forEach((s) => parts.push(s.name));
    // every glyph actually present on the stage (SVG <text>, cards, subtitles …) so that no
    // Google-Fonts unicode-range subset is fetched lazily mid-render (pixel determinism)
    const stage = document.getElementById('stage');
    if (stage) parts.push(stage.textContent);
    return Array.from(new Set(parts.join('').replace(/\s/g, ''))).join('');
  }

  async function loadFonts(data) {
    if (!document.fonts || !document.fonts.load) return;
    const txt = allText(data);
    const loads = [
      '400 96px "LXGW WenKai TC"', '700 96px "LXGW WenKai TC"',
      '400 56px "Noto Sans TC"', '500 56px "Noto Sans TC"', '700 56px "Noto Sans TC"'
    ].map((f) => document.fonts.load(f, txt).catch(() => []));
    const timeout = new Promise((res) => setTimeout(res, 20000));
    await Promise.race([Promise.all(loads).then(() => document.fonts.ready), timeout]);
  }
  function loadImage(src) {
    return new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = src; });
  }

  function showBootMessage(err) {
    const box = document.getElementById('boot-msg');
    const isFile = location.protocol === 'file:';
    box.innerHTML = `<div class="box"><h2>${isFile ? '請用小伺服器開啟喔！' : '載入失敗'}</h2>
      ${isFile
        ? `<p>瀏覽器不允許 <code>file://</code> 頁面讀取 JSON 劇本。請在專案資料夾執行：</p><p><code>npm run serve</code></p><p>然後打開 <code>http://localhost:5173/</code> 就能看動畫了。</p>`
        : `<p>無法讀取 <code>script/narration.json</code>。</p><p style="color:#6B6257;font-size:15px">${G.esc(err && err.message || err)}</p>`}</div>`;
    box.hidden = false;
  }

  async function boot() {
    document.body.insertAdjacentHTML('afterbegin', G.defs());
    let data;
    try {
      data = await G.loadData();
    } catch (e) {
      showBootMessage(e);
      document.getElementById('loading').style.display = 'none';
      rejectReady(e);
      return;
    }
    try {
      M = G.buildStage(data);
    } catch (e) {
      console.error('[stage] build failed', e);
      rejectReady(e);
      return;
    }
    player.duration = data.total;
    await Promise.all([loadFonts(data), loadImage('assets/paper-grain.svg')]);
    M.tl.time(0, false);
    if (!G.isRender && G.initUI) {
      try { G.initUI(M); } catch (e) { console.error('[ui] init failed', e); }
    }
    resolveReady();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
