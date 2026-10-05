/* 過故人莊 — interactive UI (never built in render mode):
 * play overlay, controls (play/pause, scrubber with scene ticks, scene chips, mute),
 * 生字表 / 背誦模式 panels, keyboard, and audio-clock sync. */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P;

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    speak: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.2-5.1" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M4 4v5h5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  const fmt = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

  G.initUI = function (M) {
    const { tl, data } = M;
    const total = data.total;
    const ui = document.getElementById('ui');
    const stage = document.getElementById('stage');

    /* ---------------- audio ---------------- */
    const A = { ok: false, narr: null, bgm: null, muted: false, useClock: false };
    const canM4A = !!document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"');
    A.narr = new Audio();
    A.narr.preload = 'auto';
    const srcs = (canM4A ? ['audio/narration.m4a', 'audio/narration.mp3'] : ['audio/narration.mp3', 'audio/narration.m4a']);
    let si = 0;
    A.ok = !data.estimated; // optimistic: the merged narration is the clock unless it fails to load
    A.narr.addEventListener('error', () => {
      si++;
      if (si < srcs.length) { A.narr.src = srcs[si]; A.narr.load(); return; }
      A.ok = false;
      if (A.useClock) { A.useClock = false; if (playing) tl.play(); }
    });
    if (A.ok) A.narr.src = srcs[0];
    A.bgm = new Audio();
    A.bgm.loop = true; A.bgm.volume = 0.22; A.bgm.preload = 'auto';
    A.bgm.addEventListener('error', () => { A.bgm = null; }, { once: true });
    A.bgm.src = canM4A ? 'audio/bgm.m4a' : 'audio/bgm.mp3';
    let clip = null;
    function playClip(src, start, end) {
      stopClip();
      if (!src && !A.ok) return;
      if (src) { clip = new Audio(src); clip.muted = A.muted; clip.play().catch(() => {}); return; }
      // fall back to a segment of the merged narration
      clip = new Audio(A.narr.currentSrc || srcs[0]);
      clip.muted = A.muted;
      clip.currentTime = start;
      clip.play().catch(() => {});
      const c = clip;
      const stopAt = () => { if (c.currentTime >= end) c.pause(); else if (!c.paused) requestAnimationFrame(stopAt); };
      requestAnimationFrame(stopAt);
    }
    function stopClip() { if (clip) { clip.pause(); clip = null; } }

    /* ---------------- DOM ---------------- */
    ui.innerHTML = `
      <div id="play-overlay" class="overlay">
        <div class="po-card">
          <div class="po-flower">${G.icon('chrysanthemum')}</div>
          <h1 class="kai">過故人莊</h1>
          <p class="po-sub">唐・孟浩然｜小玉與阿庭的農莊之約</p>
          <button class="po-btn" id="po-play">${ICON.play}<span>開始看故事</span></button>
          <p class="po-tip">${data.estimated ? '（目前使用估算時間軸，可能沒有聲音）' : '戴上耳機，跟著一起念吧！'}</p>
        </div>
      </div>
      <div id="controls">
        <div class="ct-row ct-top">
          <div id="scrub" role="slider" aria-label="播放進度" tabindex="0"><div class="sc-track"><div class="sc-fill"></div>${data.scenes.map((s) => `<i class="sc-tick" style="left:${(s.start / total) * 100}%"></i>`).join('')}</div><div class="sc-thumb"></div></div>
          <span id="time" class="ct-time">0:00 / ${fmt(total)}</span>
        </div>
        <div class="ct-row ct-bottom">
          <button class="ct-btn ct-round" id="btn-play" aria-label="播放/暫停">${ICON.play}</button>
          <div id="chips">${data.scenes.map((s, i) => `<button class="chip" data-i="${i}">${s.name}</button>`).join('')}</div>
          <button class="ct-btn ct-round" id="btn-mute" aria-label="靜音">${ICON.sound}</button>
        </div>
        <div class="ct-row ct-panels">
          <button class="ct-pill" id="btn-vocab">生字表</button>
          <button class="ct-pill" id="btn-recite">背誦模式</button>
        </div>
      </div>
      <div id="panel-vocab" class="panel" hidden>
        <div class="pn-sheet">
          <div class="pn-head"><h2 class="kai">生字表</h2><span class="pn-note">點一下字卡，聽聽怎麼念</span><button class="pn-close" aria-label="關閉">${ICON.close}</button></div>
          <div class="pn-body"><div class="vgrid">${data.vocab.map((v, i) => `<button class="vmini" data-i="${i}"><span class="vm-icon">${G.icon(v.icon)}</span><span class="vm-word kai">${v.word}</span><span class="vm-zy">${v.zhuyin}</span><span class="vm-mean">${v.meaning}</span></button>`).join('')}</div></div>
        </div>
        <div id="vbig" hidden><div class="vb-wrap" role="dialog" aria-label="生字卡">
          <div class="vb-tab kai"></div>
          <div class="vb-top"><div class="vb-word"></div><div class="vb-icon"></div></div>
          <div class="vb-mean"></div>
          <p class="vb-ex"></p>
          <div class="vb-actions"><button class="ct-pill" id="vb-say">${ICON.speak}<span>再聽一次</span></button><button class="ct-pill ghost" id="vb-close">關閉</button></div>
        </div></div>
      </div>
      <div id="panel-recite" class="panel" hidden>
        <div class="pn-sheet">
          <div class="pn-head"><h2 class="kai">背誦模式</h2><span class="pn-note">看圖想一想，點空格翻開答案</span><button class="pn-close" aria-label="關閉">${ICON.close}</button></div>
          <div class="lv-bar">${['全部顯示', '隱藏生字', '隱藏一半', '只剩圖'].map((n, i) => `<button class="lv${i === 0 ? ' on' : ''}" data-lv="${i}">${n}</button>`).join('')}</div>
          <div class="pn-body"><div class="rlist">${data.poem.map((l, k) => `
            <div class="rrow" data-k="${k}">
              <div class="rpic">${(G.FRAMES[k] || []).map(([ic]) => `<span>${G.icon(ic)}</span>`).join('')}</div>
              <div class="rtext">${l.map((h, hi) => `<div class="rline">${Array.from(h).map((ch, ci) => `<span class="rch kai" data-h="${hi}" data-c="${ci}"><b>${ch}</b></span>`).join('')}<span class="rp kai">${hi ? '。' : '，'}</span></div>`).join('')}
                <button class="ct-pill small say" data-k="${k}">${ICON.speak}<span>朗讀這一句</span></button></div>
            </div>`).join('')}</div></div>
        </div>
      </div>`;
    const $ = (s) => ui.querySelector(s);
    const overlay = $('#play-overlay'), controls = $('#controls');
    const btnPlay = $('#btn-play'), btnMute = $('#btn-mute');
    const fill = $('.sc-fill'), thumb = $('.sc-thumb'), timeEl = $('#time'), scrub = $('#scrub');
    const chips = Array.from(ui.querySelectorAll('.chip'));

    /* ---------------- layout: fit stage (safe-area aware) ---------------- */
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    function layout() {
      const cs = getComputedStyle(probe);
      const it = parseFloat(cs.paddingTop) || 0, ir = parseFloat(cs.paddingRight) || 0, ib = parseFloat(cs.paddingBottom) || 0, il = parseFloat(cs.paddingLeft) || 0;
      const vw = window.innerWidth - il - ir, vh = window.innerHeight - it - ib;
      const root = document.documentElement;
      const portrait = vw / vh <= 0.72;
      root.classList.toggle('portrait', portrait);
      root.classList.add('docked');
      if (portrait) {
        // control bar spans the bottom of the screen; the stage fits in the area ABOVE it
        root.style.setProperty('--ctl-x', '0px');
        root.style.setProperty('--ctl-w', window.innerWidth + 'px');
        const barH = controls.offsetHeight;
        const availH = vh - barH - 6;
        const s = Math.min(vw / 1080, availH / 1920);
        const w = 1080 * s, h = 1920 * s;
        const x = il + (vw - w) / 2, y = it + (availH - h) / 2;
        stage.style.transform = `translate(${x}px,${y}px) scale(${s})`;
        root.style.setProperty('--stage-x', x + 'px');
        root.style.setProperty('--stage-y', y + 'px');
        root.style.setProperty('--stage-w', w + 'px');
        root.style.setProperty('--stage-h', h + 'px');
        root.style.setProperty('--ctl-top', (window.innerHeight - barH) + 'px');
      } else {
        const cwGuess = Math.min(vw - 24, 640);
        root.style.setProperty('--ctl-w', cwGuess + 'px');
        const barH = controls.offsetHeight;
        const pad = 16;
        const s = Math.min((vw - pad * 2) / 1080, (vh - pad * 2 - barH - 10) / 1920);
        const w = 1080 * s, h = 1920 * s;
        const x = il + (vw - w) / 2, y = it + Math.max(pad, (vh - barH - 10 - h) / 2);
        stage.style.transform = `translate(${x}px,${y}px) scale(${s})`;
        const cw = Math.min(vw - 24, Math.max(w, 600));
        root.style.setProperty('--stage-x', x + 'px');
        root.style.setProperty('--stage-y', y + 'px');
        root.style.setProperty('--stage-w', w + 'px');
        root.style.setProperty('--stage-h', h + 'px');
        root.style.setProperty('--ctl-x', il + (vw - cw) / 2 + 'px');
        root.style.setProperty('--ctl-w', cw + 'px');
        root.style.setProperty('--ctl-top', (y + h + 10) + 'px');
      }
    }
    window.addEventListener('resize', layout);
    layout();

    /* ---------------- playback ---------------- */
    let playing = false, ended = false, lastScene = -1, raf = 0;
    function sceneAt(t) { let i = 0; data.scenes.forEach((s, k) => { if (t >= s.start - 0.01) i = k; }); return i; }
    function render() {
      const t = tl.time();
      const p = t / total;
      fill.style.width = p * 100 + '%';
      thumb.style.left = p * 100 + '%';
      timeEl.textContent = fmt(t) + ' / ' + fmt(total);
      const si = sceneAt(t);
      if (si !== lastScene) { chips.forEach((c, i) => c.classList.toggle('on', i === si)); lastScene = si; const ch = chips[si]; if (ch && ch.scrollIntoView) ch.parentNode.scrollTo({ left: ch.offsetLeft - 40, behavior: 'auto' }); }
      btnPlay.innerHTML = playing ? ICON.pause : ended ? ICON.replay : ICON.play;
    }
    function tick() {
      raf = 0;
      if (!playing) { render(); return; }
      if (A.useClock && A.narr && !A.narr.paused && !A.narr.ended) {
        tl.time(Math.min(A.narr.currentTime, total), false);
      } else if (A.useClock && A.narr && (A.narr.ended || A.narr.currentTime >= (A.narr.duration || 1e9) - 0.03)) {
        A.useClock = false; tl.play(); // finish the tail on GSAP's own clock
      }
      if (tl.time() >= total - 0.01) { pause(); ended = true; }
      render();
      raf = requestAnimationFrame(tick);
    }
    function play() {
      stopClip();
      if (ended || tl.time() >= total - 0.05) { tl.time(0, false); ended = false; }
      playing = true;
      const t = tl.time();
      A.useClock = false;
      if (A.ok && A.narr && (!A.narr.duration || t < A.narr.duration - 0.05)) {
        try { A.narr.currentTime = t; } catch (e) {}
        A.narr.muted = A.muted;
        A.useClock = true;
        tl.pause();
        A.narr.play().catch(() => { A.useClock = false; if (playing) tl.play(); });
      } else tl.play();
      if (A.bgm) { A.bgm.muted = A.muted; A.bgm.play().catch(() => {}); }
      showControls(); scheduleHide();
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function pause() {
      playing = false;
      tl.pause();
      if (A.narr) A.narr.pause();
      if (A.bgm) A.bgm.pause();
      showControls();
      render();
    }
    function seek(t) {
      t = G.clamp(t, 0, total);
      ended = false;
      tl.time(t, false);
      if (A.useClock && A.narr) { try { A.narr.currentTime = t; } catch (e) {} }
      render();
    }
    function toggle() { playing ? pause() : play(); }
    function goScene(d) {
      const i = G.clamp(sceneAt(tl.time() + 0.05) + d, 0, data.scenes.length - 1);
      seek(data.scenes[i].start + (i ? 0.35 : 0));
    }

    /* ---------------- controls are always visible (they never overlap the stage) ---------------- */
    function showControls() {}
    function scheduleHide() {}
    document.getElementById('viewport').addEventListener('click', () => { if (overlay.hidden) toggle(); });

    /* ---------------- wiring ---------------- */
    $('#po-play').addEventListener('click', () => { overlay.hidden = true; play(); });
    btnPlay.addEventListener('click', toggle);
    btnMute.addEventListener('click', () => {
      A.muted = !A.muted;
      if (A.narr) A.narr.muted = A.muted;
      if (A.bgm) A.bgm.muted = A.muted;
      if (clip) clip.muted = A.muted;
      btnMute.innerHTML = A.muted ? ICON.mute : ICON.sound;
      btnMute.classList.toggle('on', A.muted);
    });
    chips.forEach((c) => c.addEventListener('click', () => { const i = +c.dataset.i; seek(data.scenes[i].start + (i ? 0.35 : 0)); if (!overlay.hidden) { overlay.hidden = true; play(); } }));
    let scrubbing = false, wasPlaying = false;
    function scrubTo(e) { const r = scrub.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); }
    scrub.addEventListener('pointerdown', (e) => { scrubbing = true; wasPlaying = playing; if (playing) pause(); scrub.setPointerCapture(e.pointerId); scrubTo(e); });
    scrub.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
    const endScrub = () => { if (!scrubbing) return; scrubbing = false; if (wasPlaying) play(); };
    scrub.addEventListener('pointerup', endScrub);
    scrub.addEventListener('pointercancel', endScrub);
    scrub.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { seek(tl.time() - 5); e.preventDefault(); } if (e.key === 'ArrowRight') { seek(tl.time() + 5); e.preventDefault(); } });
    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (!$('#panel-vocab').hidden || !$('#panel-recite').hidden) { if (e.key === 'Escape') closePanels(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (!overlay.hidden) overlay.hidden = true; toggle(); }
      else if (e.key === 'ArrowLeft' && e.target !== scrub) { e.preventDefault(); goScene(-1); }
      else if (e.key === 'ArrowRight' && e.target !== scrub) { e.preventDefault(); goScene(1); }
      else if (e.key === 'm' || e.key === 'M') btnMute.click();
    });

    /* ---------------- panels ---------------- */
    function openPanel(id) {
      pause();
      const p = $(id);
      p.hidden = false;
      gsap.fromTo(p.querySelector('.pn-sheet'), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.35, ease: 'back.out(1.4)' });
    }
    function closePanels() { stopClip(); ['#panel-vocab', '#panel-recite'].forEach((s) => ($(s).hidden = true)); $('#vbig').hidden = true; }
    $('#btn-vocab').addEventListener('click', () => openPanel('#panel-vocab'));
    $('#btn-recite').addEventListener('click', () => openPanel('#panel-recite'));
    ui.querySelectorAll('.pn-close').forEach((b) => b.addEventListener('click', closePanels));
    ui.querySelectorAll('.panel').forEach((p) => p.addEventListener('click', (e) => { if (e.target === p) closePanels(); }));

    // 生字表
    const vbig = $('#vbig');
    let curWord = null;
    function sayWord(w) {
      const src = data.vocab_audio && data.vocab_audio[w];
      if (src) playClip(src);
    }
    ui.querySelectorAll('.vmini').forEach((b) => b.addEventListener('click', () => {
      const v = data.vocab[+b.dataset.i];
      curWord = v.word;
      const n = Array.from(v.word).length;
      vbig.querySelector('.vb-tab').textContent = '生字';
      vbig.querySelector('.vb-word').innerHTML = G.wordHTML(v, n === 1 ? 104 : 84);
      vbig.querySelector('.vb-icon').innerHTML = G.icon(v.icon);
      vbig.querySelector('.vb-mean').innerHTML = `<span class="vc-eq">＝</span>${G.meaningHTML(v.meaning).html}`;
      vbig.querySelector('.vb-ex').textContent = '例：' + v.example;
      vbig.hidden = false;
      gsap.fromTo(vbig.querySelector('.vb-wrap'), { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(1.6)' });
      sayWord(v.word);
    }));
    $('#vb-say').addEventListener('click', () => curWord && sayWord(curWord));
    $('#vb-close').addEventListener('click', () => { vbig.hidden = true; stopClip(); });
    vbig.addEventListener('click', (e) => { if (e.target === vbig) { vbig.hidden = true; stopClip(); } });

    // 背誦模式
    const KEY = (G.BLANKS || []).map((b) => b.rows.map((r) => { const out = []; let ci = 0; r.forEach((x) => { const n = typeof x === 'string' ? 1 : Array.from(x[0]).length; for (let j = 0; j < n; j++) out.push(typeof x !== 'string'); ci += n; }); return out; }));
    function applyLevel(lv) {
      ui.querySelectorAll('.lv').forEach((b) => b.classList.toggle('on', +b.dataset.lv === lv));
      ui.querySelectorAll('.rrow').forEach((row) => {
        const k = +row.dataset.k;
        row.querySelectorAll('.rch').forEach((el) => {
          const h = +el.dataset.h, c = +el.dataset.c;
          let hide = false;
          if (lv === 1) hide = !!(KEY[k] && KEY[k][h] && KEY[k][h][c]);
          else if (lv === 2) hide = (c + h) % 2 === 0;
          else if (lv === 3) hide = true;
          el.classList.toggle('hid', hide);
          el.classList.remove('peek');
        });
        row.classList.toggle('picsonly', lv === 3);
      });
    }
    ui.querySelectorAll('.lv').forEach((b) => b.addEventListener('click', () => applyLevel(+b.dataset.lv)));
    ui.querySelectorAll('.rch').forEach((el) => el.addEventListener('click', () => {
      if (!el.classList.contains('hid')) return;
      el.classList.toggle('peek');
      if (el.classList.contains('peek')) gsap.fromTo(el.querySelector('b'), { scale: 0.4, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(2)' });
    }));
    ui.querySelectorAll('.say').forEach((b) => b.addEventListener('click', () => {
      const cue = data.cueMap['s6-' + (+b.dataset.k + 2)];
      if (!cue) return;
      // read only the poem line part of the cue when using the merged narration
      const sched = G.reciteSchedule(cue, data.poem[+b.dataset.k]);
      const st = sched[0] ? sched[0][0] - 0.25 : cue.start;
      playClip(cue.audio || null, cue.audio ? 0 : st, cue.end + 0.1);
      gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
    }));

    render();
    showControls();
    document.documentElement.classList.add('ui-ready');
    window.__ui = { play, pause, seek, toggle, A };
  };
})();
