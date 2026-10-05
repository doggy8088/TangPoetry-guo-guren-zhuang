/* 過故人莊 — stage engine: per-scene context helpers, character controller,
 * subtitles, vocab cards, recite strips and page-turn transitions.
 * Everything is placed on ONE paused GSAP master timeline (M.tl). */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P;

  const prepped = new WeakSet();
  function prep(els) {
    els.forEach((el) => {
      if (prepped.has(el)) return;
      prepped.add(el);
      if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') gsap.set(el, { svgOrigin: '0 0' });
    });
  }
  G.prep = prep;

  function resolve(root, target) {
    if (!target) return [];
    if (typeof target === 'string') {
      const els = Array.from(root.querySelectorAll(target));
      if (!els.length) console.warn('[stage] selector matched nothing:', target);
      return els;
    }
    if (target instanceof Element) return [target];
    return Array.from(target).filter(Boolean);
  }

  /* ---------------- scene context ---------------- */
  G.makeCtx = function (M, sc, sec) {
    const tl = M.tl, data = M.data;
    const R = (t) => resolve(sec, t);
    const ctx = {
      M, tl, data, sc, sec, T0: sc.start, T1: sc.end,
      rng: G.rng(G.hash(sc.id)),
      C: (id) => data.cueMap[id],
      s: (id) => data.cueMap[id].start,
      e: (id) => data.cueMap[id].end,
      d: (id) => data.cueMap[id].dur,
      at: (id, f) => { const c = data.cueMap[id]; return c.start + c.dur * f; },
      /** time a word is spoken in cue id (falls back to fraction fb of the cue) */
      w: (id, word, fb, which) => { const c = data.cueMap[id]; const t = G.tWord(c, word, which); return t == null ? c.start + c.dur * (fb || 0) : t; },
      q: (sel) => sec.querySelector(sel),
      qa: (sel) => Array.from(sec.querySelectorAll(sel)),
      R,
      init(target, vars) { const els = R(target); prep(els); if (els.length) gsap.set(els, vars); return els; },
      ft(target, from, to, pos) {
        const els = R(target); if (!els.length) return;
        if (typeof pos === 'number' && pos < 0.002) pos = 0.002;
        prep(els);
        tl.fromTo(els, from, Object.assign({ immediateRender: false }, to), pos);
      },
      to(target, vars, pos) { const els = R(target); if (!els.length) return; prep(els); tl.to(els, vars, pos); },
      set(target, vars, pos) { const els = R(target); if (!els.length) return; prep(els); if (typeof pos === 'number' && pos < 0.002) pos = 0.002; tl.set(els, vars, pos); },
      mover(target, st) { return new G.Mover(ctx, target, st); },
      /** cross-cut between two shot groups */
      cut(from, to, t, d) {
        d = d || 0.5;
        const a = R(from)[0], b = R(to)[0];
        if (!a || !b) return;
        const after = a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
        if (after) { ctx.ft(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power1.inOut' }, t); ctx.set(a, { autoAlpha: 0 }, t + d); }
        else { ctx.set(b, { autoAlpha: 1 }, t); ctx.ft(a, { autoAlpha: 1 }, { autoAlpha: 0, duration: d, ease: 'power1.inOut' }, t); }
      },
      /** flap a bird's wing during [t0,t1] */
      flap(birdSel, t0, t1, period) {
        period = period || 0.13;
        const wing = R(birdSel)[0].querySelector('.wing');
        const n = Math.max(1, Math.floor((t1 - t0) / (period * 2)));
        ctx.init(wing, { rotation: 50 });
        ctx.ft(wing, { rotation: 50 }, { rotation: -25, duration: period, repeat: n * 2 - 1, yoyo: true, ease: 'sine.inOut' }, t0);
      },
      /** paper pop-in (element must start hidden: call init/hidden first or pass init:true) */
      pop(target, pos, o) {
        o = o || {};
        const els = R(target); if (!els.length) return;
        const from = { scale: o.s0 != null ? o.s0 : 0, autoAlpha: 0, rotation: o.r0 || 0 };
        if (o.y0 != null) from.y = o.y0;
        ctx.init(els, from);
        const to = { scale: o.s || 1, autoAlpha: 1, rotation: o.r || 0, duration: o.d || 0.5, ease: o.ease || 'back.out(1.7)', stagger: o.stagger || 0 };
        if (o.y0 != null) to.y = o.y || 0;
        ctx.ft(els, from, to, pos);
      },
      /** pop out (scale to 0) */
      unpop(target, pos, o) {
        o = o || {};
        ctx.ft(target, { scale: o.s || 1, autoAlpha: 1 }, { scale: 0, autoAlpha: 0, duration: o.d || 0.3, ease: 'back.in(1.6)', stagger: o.stagger || 0 }, pos);
      },
      fadeIn(target, pos, d, o) { ctx.init(target, { autoAlpha: 0 }); ctx.ft(target, { autoAlpha: 0 }, Object.assign({ autoAlpha: 1, duration: d || 0.4, ease: 'power1.out' }, o || {}), pos); },
      fadeOut(target, pos, d, o) { ctx.ft(target, { autoAlpha: 1 }, Object.assign({ autoAlpha: 0, duration: d || 0.4, ease: 'power1.in' }, o || {}), pos); },
      /** stroke draw-on for <path> with pathLength=1 */
      draw(target, pos, d, o) {
        ctx.init(target, { strokeDasharray: '1 1', strokeDashoffset: 1 });
        ctx.ft(target, { strokeDashoffset: 1 }, Object.assign({ strokeDashoffset: 0, duration: d || 0.8, ease: 'power1.inOut' }, o || {}), pos);
      },
      /** looping yoyo between a and b for [t0,t1]; ends at a */
      loop(target, prop, a, b, t0, t1, period, ease) {
        const n = Math.floor((t1 - t0) / (period * 2));
        if (n < 1) return;
        ctx.ft(target, { [prop]: a }, { [prop]: b, duration: period, repeat: n * 2 - 1, yoyo: true, ease: ease || 'sine.inOut' }, t0);
      },
      /** camera: move group so that point (px,py) at scale s lands on (qx,qy) */
      camState(px, py, s, qx, qy) { return { x: G.r(qx - px * s), y: G.r(qy - py * s), scale: s }; },
      char(target, o) { const el = R(target)[0]; return new Char(ctx, el, o || {}); },
      talker(key, ch) { (M.talkers[sc.id] = M.talkers[sc.id] || {})[key] = ch; },
      card(cueId, cfg) { M.cardCfg[cueId] = cfg; },
      recite(cfg) { M.reciteCfg.push(cfg); }
    };
    return ctx;
  };

  /* ---------------- character controller ---------------- */
  function Char(ctx, el, o) {
    this.ctx = ctx; this.el = el;
    const q = (s) => el.querySelector(s);
    this.flipG = q('.ch-flip'); this.bob = q('.ch-bob'); this.breath = q('.ch-breath');
    this.head = q('.head'); this.armL = q('.armL'); this.armR = q('.armR');
    this.legL = q('.legL'); this.legR = q('.legR'); this.eyes = q('.eyes');
    this.eyeL = q('.eyeL'); this.eyeR = q('.eyeR'); this.mouth = q('.mouth'); this.shadow = q('.ch-shadow');
    this.seed = G.hash((el.id || '') + ctx.sc.id + (o.seed || 0));
    this.R = G.rng(this.seed);
    this.st = { x: o.x || 0, y: o.y || 0, s: o.s || 1, f: o.flip ? -1 : 1, armL: o.armL != null ? o.armL : 12, armR: o.armR != null ? o.armR : -12, head: 0, lean: 0, ex: 0, ey: 0 };
    prep([el, this.flipG, this.bob, this.breath, this.head, this.armL, this.armR, this.legL, this.legR, this.eyes, this.eyeL, this.eyeR, this.shadow].filter(Boolean));
    gsap.set(el, { x: this.st.x, y: this.st.y, scale: this.st.s });
    gsap.set(this.flipG, { scaleX: this.st.f });
    if (this.armL) gsap.set(this.armL, { rotation: this.st.armL });
    if (this.armR) gsap.set(this.armR, { rotation: this.st.armR });
    if (o.hidden) gsap.set(el, { autoAlpha: 0 });
  }
  Char.prototype = {
    ft(t, from, to, pos) { this.ctx.ft(t, from, to, pos); },
    show(t, d) { this.ctx.ft(this.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d || 0.3 }, t); return this; },
    hide(t, d) { this.ctx.ft(this.el, { autoAlpha: 1 }, { autoAlpha: 0, duration: d || 0.3 }, t); return this; },
    moveTo(t, d, x, y, ease) {
      const st = this.st;
      this.ft(this.el, { x: st.x, y: st.y }, { x: x, y: y == null ? st.y : y, duration: d, ease: ease || 'power2.inOut' }, t);
      st.x = x; if (y != null) st.y = y;
      return this;
    },
    scaleTo(t, d, s, ease) { this.ft(this.el, { scale: this.st.s }, { scale: s, duration: d, ease: ease || 'power2.inOut' }, t); this.st.s = s; return this; },
    face(t, dir) {
      const f = dir < 0 ? -1 : 1;
      if (f === this.st.f) return this;
      this.ft(this.flipG, { scaleX: this.st.f }, { scaleX: f, duration: 0.22, ease: 'power2.inOut' }, t);
      this.st.f = f; return this;
    },
    arm(t, which, rot, d, ease) {
      const k = which === 'L' ? 'armL' : 'armR';
      this.ft(this[k], { rotation: this.st[k] }, { rotation: rot, duration: d || 0.35, ease: ease || 'back.out(1.6)' }, t);
      this.st[k] = rot; return this;
    },
    /** wave: raise arm, wiggle n times, lower. returns end time */
    wave(t, n, which, d) {
      which = which || 'R'; n = n || 3; d = d || 0.22;
      const k = which === 'L' ? 'armL' : 'armR';
      const sgn = which === 'L' ? 1 : -1;
      const rest = this.st[k];
      this.arm(t, which, sgn * 150, 0.3);
      this.ft(this[k], { rotation: sgn * 150 }, { rotation: sgn * 118, duration: d, repeat: n * 2 - 1, yoyo: true, ease: 'sine.inOut' }, t + 0.3);
      const tEnd = t + 0.3 + d * n * 2;
      this.arm(tEnd, which, rest, 0.35, 'power2.inOut');
      return tEnd + 0.35;
    },
    hop(t, n, h, d) {
      n = n || 1; h = h || 50; d = d || 0.3;
      this.ft(this.bob, { y: 0 }, { y: -h, duration: d, repeat: n * 2 - 1, yoyo: true, ease: 'power2.out' }, t);
      if (this.shadow) this.ft(this.shadow, { scale: 1 }, { scale: 0.7, duration: d, repeat: n * 2 - 1, yoyo: true, ease: 'power2.out' }, t);
      return t + n * 2 * d;
    },
    /** jump from current pos to x (arc) */
    jumpTo(t, d, x, y, h) {
      this.moveTo(t, d, x, y, 'power1.inOut');
      this.ft(this.bob, { y: 0 }, { y: -(h || 120), duration: d / 2, repeat: 1, yoyo: true, ease: 'power2.out' }, t);
      return t + d;
    },
    tilt(t, deg, d) { this.ft(this.head, { rotation: this.st.head }, { rotation: deg, duration: d || 0.35, ease: 'back.out(1.5)' }, t); this.st.head = deg; return this; },
    lean(t, deg, d) { this.ft(this.bob, { rotation: this.st.lean }, { rotation: deg, duration: d || 0.4, ease: 'power2.inOut' }, t); this.st.lean = deg; return this; },
    look(t, dx, dy, d) {
      if (!this.eyes) return this;
      this.ft(this.eyes, { x: this.st.ex, y: this.st.ey }, { x: dx, y: dy || 0, duration: d || 0.25, ease: 'power2.out' }, t);
      this.st.ex = dx; this.st.ey = dy || 0; return this;
    },
    eyesTo(t, state) { if (this.eyes) this.ctx.set(this.eyes, { attr: { 'data-e': state } }, t); return this; },
    mouthTo(t, state) { if (this.mouth) this.ctx.set(this.mouth, { attr: { 'data-m': state } }, t); return this; },
    pack(t, on) { this.ctx.set(this.el, { attr: { 'data-pack': on ? 1 : 0 } }, t); return this; },
    talk(t0, t1, rest) {
      if (!this.mouth) return this;
      const R = G.rng(G.hash(this.seed + ':' + t0.toFixed(2)));
      const states = ['o', 'm', 's', 'o', 'm', 'c'];
      let prev = 'c';
      for (let t = t0; t < t1 - 0.1; t += 0.12) {
        let s = states[Math.floor(R() * states.length)];
        if (s === prev) s = prev === 'o' ? 'c' : 'o';
        this.ctx.set(this.mouth, { attr: { 'data-m': s } }, G.r(t));
        prev = s;
      }
      this.ctx.set(this.mouth, { attr: { 'data-m': rest || 'c' } }, G.r(t1));
      return this;
    },
    idle(t0, t1, o) {
      o = o || {};
      const span = t1 - t0;
      if (this.breath && span > 3) {
        const n = Math.floor(span / 3);
        this.ft(this.breath, { scaleY: 1 }, { scaleY: 1.018, duration: 1.5, repeat: n * 2 - 1, yoyo: true, ease: 'sine.inOut' }, t0);
      }
      if (this.eyeL && o.blink !== false) {
        let t = t0 + 0.8 + this.R() * 1.8;
        while (t < t1 - 0.3) {
          this.ft([this.eyeL, this.eyeR], { scaleY: 1 }, { scaleY: 0.1, duration: 0.07, repeat: 1, yoyo: true, ease: 'power1.inOut' }, G.r(t));
          t += 3 + this.R() * 1.2;
        }
      }
      return this;
    },
    /** walk in place (legs/arms swing + bob) for [t0,t1] */
    walk(t0, t1, step) {
      step = step || 0.32;
      const n = Math.max(1, Math.floor((t1 - t0) / step) - 1);
      const sw = 24, asw = 22;
      const legs = [this.legL, this.legR];
      // ramp in
      this.ft(this.legL, { rotation: 0 }, { rotation: sw, duration: step / 2, ease: 'sine.out' }, t0);
      this.ft(this.legR, { rotation: 0 }, { rotation: -sw, duration: step / 2, ease: 'sine.out' }, t0);
      this.ft(this.legL, { rotation: sw }, { rotation: -sw, duration: step, repeat: n - 1, yoyo: true, ease: 'sine.inOut' }, t0 + step / 2);
      this.ft(this.legR, { rotation: -sw }, { rotation: sw, duration: step, repeat: n - 1, yoyo: true, ease: 'sine.inOut' }, t0 + step / 2);
      const endL = n % 2 === 1 ? -sw : sw;
      const tE = t0 + step / 2 + step * n;
      this.ft(this.legL, { rotation: endL }, { rotation: 0, duration: step / 2, ease: 'sine.in' }, tE);
      this.ft(this.legR, { rotation: -endL }, { rotation: 0, duration: step / 2, ease: 'sine.in' }, tE);
      // arms swing opposite to legs
      const aL = this.st.armL, aR = this.st.armR;
      this.ft(this.armL, { rotation: aL }, { rotation: aL - asw, duration: step / 2, ease: 'sine.out' }, t0);
      this.ft(this.armR, { rotation: aR }, { rotation: aR + asw, duration: step / 2, ease: 'sine.out' }, t0);
      this.ft(this.armL, { rotation: aL - asw }, { rotation: aL + asw, duration: step, repeat: n - 1, yoyo: true, ease: 'sine.inOut' }, t0 + step / 2);
      this.ft(this.armR, { rotation: aR + asw }, { rotation: aR - asw, duration: step, repeat: n - 1, yoyo: true, ease: 'sine.inOut' }, t0 + step / 2);
      const eA = n % 2 === 1 ? asw : -asw;
      this.ft(this.armL, { rotation: aL + eA }, { rotation: aL, duration: step / 2 }, tE);
      this.ft(this.armR, { rotation: aR - eA }, { rotation: aR, duration: step / 2 }, tE);
      // bob: one bounce per step
      this.ft(this.bob, { y: 0 }, { y: -12, duration: step / 2, repeat: n * 2 + 1, yoyo: true, ease: 'sine.inOut' }, t0);
      return tE + step / 2;
    }
  };
  G.Char = Char;

  /** generic tracked mover for non-character elements (cameras, birds, props) */
  function Mover(ctx, target, st) {
    this.ctx = ctx;
    this.el = ctx.R(target)[0];
    this.st = Object.assign({ x: 0, y: 0, scale: 1, rotation: 0 }, st || {});
    prep([this.el]);
    gsap.set(this.el, this.st);
  }
  Mover.prototype.to = function (t, d, vars, ease) {
    const from = {}, to = { duration: d, ease: ease || 'power2.inOut' };
    Object.keys(vars).forEach((k) => { from[k] = this.st[k] != null ? this.st[k] : 0; to[k] = vars[k]; this.st[k] = vars[k]; });
    this.ctx.ft(this.el, from, to, t);
    return this;
  };
  Mover.prototype.set = function (t, vars) {
    Object.assign(this.st, vars);
    this.ctx.set(this.el, vars, t);
    return this;
  };
  G.Mover = Mover;

  /* ---------------- subtitles ---------------- */
  G.buildSubtitles = function (M) {
    const { tl, data } = M;
    const layer = M.layers.subs;
    data.cues.forEach((cue, ci) => {
      const chunks = G.splitSubtitle(cue.text, 16, 32);
      let idx = 0;
      const starts = chunks.map((ch, k) => { const t = k === 0 ? cue.start - 0.05 : G.tAt(cue, idx); idx += ch.text.length; return t; });
      const next = data.cues[ci + 1];
      const joined = next && next.scene === cue.scene && next.start - cue.end < 1.0;
      const holdEnd = joined ? next.start - 0.05 : cue.end + 0.3;
      const color = G.SPEAKER_COLOR[cue.speaker] || P.green;
      chunks.forEach((ch, k) => {
        const el = G.html(`<div class="sub" data-cue="${cue.id}"><div class="sub-card${ch.lines.length > 1 ? ' two' : ''}"><span class="sub-tag" style="background:${color}">${cue.speaker}</span><div class="sub-text">${ch.lines.map(G.esc).join('<br>')}</div></div></div>`);
        layer.appendChild(el);
        gsap.set(el, { autoAlpha: 0 });
        const t0 = starts[k], t1 = k + 1 < chunks.length ? starts[k + 1] : holdEnd;
        if (k === 0) tl.fromTo(el, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out', immediateRender: false }, t0);
        else tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, immediateRender: false }, t0);
        if (k + 1 < chunks.length) tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, t1);
        else tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: joined ? 0.12 : 0.3, immediateRender: false }, t1);
      });
    });
  };

  /* ---------------- vocab cards ---------------- */
  function zhuyinHTML(syl) {
    const m = syl.match(/^([^ˊˇˋ˙]*)([ˊˇˋ˙]?)$/);
    const body = m ? m[1] : syl, tone = m ? m[2] : '';
    const light = tone === '˙';
    return `<span class="zy">${light ? '<span class="tn-l">˙</span>' : ''}${Array.from(body).map((c) => `<span class="zs">${c}</span>`).join('')}${tone && !light ? `<span class="tn">${tone}</span>` : ''}</span>`;
  }
  G.wordHTML = function (v, size) {
    const chars = Array.from(v.word);
    const syl = v.zhuyin.trim().split(/\s+/);
    return chars.map((c, i) => `<span class="zu"><span class="han" style="font-size:${size}px">${c}</span>${syl[i] ? zhuyinHTML(syl[i]) : ''}</span>`).join('');
  };
  G.meaningHTML = function (m) {
    const n = m.length;
    if (n <= 9) return { html: G.esc(m), fs: 68 };
    if (n <= 12) return { html: G.esc(m), fs: 58 };
    // two lines: break at （ or ， nearest to middle
    let best = Math.ceil(n / 2), bs = 1e9;
    for (let i = 3; i < n - 2; i++) {
      const ok = m[i] === '（' ? i : '，、'.includes(m[i - 1]) ? i : -1;
      if (ok < 0) continue;
      const sc = Math.abs(i - n / 2);
      if (sc < bs) { bs = sc; best = i; }
    }
    const l1 = m.slice(0, best), l2 = m.slice(best);
    const fs = Math.min(52, Math.floor(690 / Math.max(l1.length, l2.length)));
    return { html: G.esc(l1) + '<br>' + G.esc(l2), fs };
  };
  G.cardHTML = function (v, extraCls) {
    const n = Array.from(v.word).length;
    const size = n === 1 ? 236 : 150;
    const mm = G.meaningHTML(v.meaning);
    return `<div class="vcard ${extraCls || ''}">
      <div class="vc-tab kai">${G.esc(v.word)}</div>
      <div class="vc-body"><div class="vc-word n${n}">${G.wordHTML(v, size)}</div>
      <div class="vc-icon">${G.icon(v.icon)}</div></div>
      <div class="vc-mean" style="font-size:${mm.fs}px"><span class="vc-eq">＝</span><span class="vc-mt">${mm.html}</span></div>
    </div>`;
  };

  G.buildCards = function (M) {
    const { tl, data } = M;
    const layer = M.layers.cards;
    data.cues.filter((c) => c.vocab && c.vocab.length).forEach((cue) => {
      const cfg = M.cardCfg[cue.id] || {};
      const top = cfg.top != null ? cfg.top : 500;
      const follow = cue.text.indexOf('跟著念');
      const outT = cue.end - 0.3;
      let last = cue.start - 0.7;
      const n = cue.vocab.length;
      const times = cue.vocab.map((w, i) => {
        let t = cfg.times && cfg.times[i] != null ? cfg.times[i] : null;
        if (t == null) {
          let idx = cue.text.indexOf('「' + w + '」');
          idx = idx >= 0 ? idx + 1 : cue.text.indexOf(w);
          if (idx >= 0 && (follow < 0 || idx < follow)) t = G.tAt(cue, idx) - 0.15;
          else t = cue.start + 0.4 + i * 1.2;
        }
        t = Math.max(t, cue.start + 0.15, last + 0.9);
        t = Math.min(t, outT - 1.4 - (n - 1 - i) * 0.6);
        last = t;
        return t;
      });
      const R = G.rng(G.hash(cue.id));
      const els = cue.vocab.map((w, i) => {
        const v = data.vocabMap[w];
        const el = G.html(G.cardHTML(v));
        el.style.top = top + 'px';
        el.querySelector('.vc-tab').style.left = (48 + i * 176) + 'px';
        layer.appendChild(el);
        gsap.set(el, { autoAlpha: 0 });
        return el;
      });
      const ys = els.map(() => 0), ss = els.map(() => 1);
      els.forEach((el, i) => {
        const rot = G.r((R() - 0.5) * 4);
        tl.fromTo(el, { autoAlpha: 0, y: 340, rotation: rot * 3, scale: 0.9 }, { autoAlpha: 1, y: 0, rotation: rot, scale: 1, duration: 0.6, ease: 'back.out(1.4)', immediateRender: false }, times[i]);
        for (let j = 0; j < i; j++) {
          const ny = -(i - j) * (cfg.dy || 66), ns = G.r(Math.pow(0.965, i - j));
          tl.fromTo(els[j], { y: ys[j], scale: ss[j] }, { y: ny, scale: ns, duration: 0.45, ease: 'power2.out', immediateRender: false }, times[i] + 0.05);
          ys[j] = ny; ss[j] = ns;
        }
      });
      els.forEach((el, i) => {
        tl.fromTo(el, { autoAlpha: 1, y: ys[i] }, { autoAlpha: 0, y: ys[i] + 160, duration: 0.32, ease: 'power2.in', immediateRender: false }, outT + (n - 1 - i) * 0.04);
      });
      M.cardTimes[cue.id] = times;
    });
  };

  /* ---------------- recite strip (poem line lighting) ---------------- */
  /** per half: array of 5 spoken times, or null if that half isn't read in this cue */
  G.reciteSchedule = function (cue, halves) {
    const txt = cue.text;
    const fi = txt.indexOf('跟著念');
    const from = fi >= 0 ? fi : 0;
    return halves.map((h) => {
      let idx = txt.indexOf(h, from);
      if (idx < 0) idx = txt.lastIndexOf(h);
      if (idx < 0) return null;
      return Array.from(h).map((_, k) => G.tAt(cue, idx + k));
    });
  };
  G.poemRowHTML = function (half, punct, cls) {
    return `<div class="rc-row ${cls || ''}">${Array.from(half).map((c) => `<span class="rc"><i class="rc-dot"></i><b>${c}</b></span>`).join('')}<span class="rc-p">${punct}</span></div>`;
  };
  /** light characters of a row element at given times */
  G.lightChars = function (tl, rowEl, times, o) {
    o = o || {};
    const chars = rowEl.querySelectorAll('.rc');
    chars.forEach((c, k) => {
      const t = times[k];
      if (t == null) return;
      const b = c.querySelector('b'), dot = c.querySelector('.rc-dot');
      tl.fromTo(b, { color: o.dim || '#B9AE9F', scale: 1 }, { color: o.lit || P.ink, scale: 1.22, duration: 0.17, ease: 'power2.out', immediateRender: false }, t);
      tl.fromTo(b, { scale: 1.22 }, { scale: 1, duration: 0.28, ease: 'back.out(2)', immediateRender: false }, t + 0.17);
      if (dot) tl.fromTo(dot, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }, t);
    });
  };
  G.preLight = function (rowEl, o) {
    o = o || {};
    rowEl.querySelectorAll('.rc b').forEach((b) => gsap.set(b, { color: o.lit || P.ink }));
    rowEl.querySelectorAll('.rc-dot').forEach((d) => gsap.set(d, { scale: 1, autoAlpha: 1 }));
  };
  G.dimChars = function (rowEl, o) {
    o = o || {};
    rowEl.querySelectorAll('.rc b').forEach((b) => gsap.set(b, { color: o.dim || '#B9AE9F', scale: 1 }));
    rowEl.querySelectorAll('.rc-dot').forEach((d) => gsap.set(d, { scale: 0, autoAlpha: 0 }));
  };

  G.buildRecite = function (M) {
    const { tl, data } = M;
    const layer = M.layers.recite;
    const doneHalves = {};
    const items = [];
    data.cues.forEach((cue) => {
      if (cue.recite == null || cue.scene === 's6' || cue.scene === 's7') return;
      items.push({ cue, line: cue.recite });
    });
    M.reciteCfg.forEach((c) => items.push(Object.assign({ preview: true }, c, { cue: data.cueMap[c.cue] })));
    items.sort((a, b) => a.cue.start - b.cue.start);
    items.forEach((it) => {
      const { cue, line } = it;
      const halves = data.poem[line];
      let sched;
      if (it.preview) {
        // preview: one half floats in and lights quickly around a spoken word
        const t = it.at != null ? it.at : G.tWord(cue, it.word || halves[it.half]) || cue.start + 0.5;
        sched = halves.map((h, hi) => (hi === it.half ? Array.from(h).map((_, k) => t + 0.5 + k * 0.16) : null));
      } else sched = G.reciteSchedule(cue, halves);
      const rows = halves.map((h, hi) => {
        if (sched[hi]) return 'read';
        if (!it.preview && doneHalves[line + ':' + hi]) return 'pre';
        return null;
      });
      const html = halves.map((h, hi) => (rows[hi] ? G.poemRowHTML(h, hi === 0 ? '，' : '。', 'h' + hi) : '')).join('');
      const el = G.html(`<div class="recite${it.preview ? ' preview' : ''}" data-cue="${cue.id}"><div class="rc-paper">${html}</div></div>`);
      layer.appendChild(el);
      gsap.set(el, { autoAlpha: 0 });
      let first = 1e9;
      const rowEls = el.querySelectorAll('.rc-row');
      let ri = 0;
      halves.forEach((h, hi) => {
        if (!rows[hi]) return;
        const rowEl = rowEls[ri++];
        if (rows[hi] === 'pre') { G.preLight(rowEl); return; }
        G.dimChars(rowEl);
        G.lightChars(tl, rowEl, sched[hi]);
        first = Math.min(first, sched[hi][0]);
        if (!it.preview) doneHalves[line + ':' + hi] = true;
      });
      const tIn = Math.max(cue.start + 0.1, first - 1.1);
      let tOut = cue.end + 0.25;
      const next = data.cues[data.cues.indexOf(cue) + 1];
      if (next && next.start < tOut + 0.3) tOut = Math.max(cue.end, next.start - 0.1);
      tl.fromTo(el, { autoAlpha: 0, y: -60, scale: 0.92 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.5)', immediateRender: false }, tIn);
      // whole line glow at the end when the full couplet is shown
      const allLast = sched.filter(Boolean).map((s) => s[s.length - 1]);
      const lastT = Math.max.apply(null, allLast);
      if (!it.preview && rowEls.length === 2) {
        const paper = el.querySelector('.rc-paper');
        tl.fromTo(paper, { scale: 1 }, { scale: 1.05, duration: 0.3, repeat: 1, yoyo: true, ease: 'sine.inOut', immediateRender: false }, Math.min(lastT + 0.45, tOut - 0.65));
      }
      tl.fromTo(el, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -40, duration: 0.35, ease: 'power2.in', immediateRender: false }, tOut);
    });
  };

  /* ---------------- scene transitions: "paper sheet" push-wipe ----------------
   * The incoming scene slides in from the right on top of the outgoing one (soft shadow on
   * its leading edge, static CSS box-shadow); the outgoing scene drifts left a little and
   * dims. Only translation + opacity — scene content is never scaled or skewed. */
  G.buildTransitions = function (M) {
    const { tl, data } = M;
    const secs = M.sections;
    const subs = M.layers.subs;
    data.scenes.forEach((sc, i) => {
      if (i === 0) return;
      const cur = secs[i], prev = secs[i - 1];
      const t = G.r(sc.start - 0.35);
      const D = 0.7;
      tl.set(cur, { autoAlpha: 1, zIndex: 6, x: 1080 }, t);
      tl.set(prev, { zIndex: 5 }, t);
      tl.fromTo(cur, { x: 1080 }, { x: 0, duration: D, ease: 'power2.inOut', immediateRender: false }, t);
      tl.fromTo(prev, { x: 0 }, { x: -260, duration: D, ease: 'power2.inOut', immediateRender: false }, t);
      tl.fromTo(prev.querySelector('.shade'), { opacity: 0 }, { opacity: 0.3, duration: D, ease: 'power1.in', immediateRender: false }, t);
      tl.fromTo(subs, { opacity: 1 }, { opacity: 0.55, duration: 0.15, repeat: 1, yoyo: true, ease: 'sine.inOut', immediateRender: false }, t + D / 2 - 0.15);
      tl.set(prev, { autoAlpha: 0, zIndex: 1 }, t + D + 0.02);
      tl.set(cur, { zIndex: 2 }, t + D + 0.02);
    });
  };
})();
