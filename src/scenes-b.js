/* 過故人莊 — scenes s4 聊天, s5 約定, s6 圖像記憶, s7 背誦挑戰 */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P, A = G.A, T = G.T;
  const S = (G.scenes = G.scenes || {});

  /** rotate an arm and counter-rotate whatever it holds so the prop stays upright */
  function armProp(c, ch, which, rot, t, d, ease) {
    const prop = ch.el.querySelector(which === 'L' ? '.propL' : '.propR');
    const key = 'prop' + which;
    const prev = ch.st[key] || 0;
    ch.arm(t, which, rot, d, ease);
    c.ft(prop, { rotation: prev }, { rotation: -rot, duration: d || 0.35, ease: ease || 'back.out(1.6)' }, t);
    ch.st[key] = -rot;
  }
  const lantern = (glow) => `${glow ? `<circle r="150" fill="url(#gGlow)" opacity=".8"/>` : ''}<path d="M0-130V-50" stroke="${P.wood2}" stroke-width="5"/><rect x="-24" y="-54" width="48" height="14" rx="5" fill="${P.gold}"/>
    <ellipse rx="62" ry="78" fill="${P.red}"/><path d="M-30-70Q-44 0-30 70M30-70Q44 0 30 70M0-78V78" stroke="#A8432F" stroke-width="5" fill="none"/>
    <rect x="-24" y="66" width="48" height="14" rx="5" fill="${P.gold}"/><path d="M-8 80V120M0 80V126M8 80V120" stroke="${P.gold}" stroke-width="5"/>`;
  /** chrysanthemum bed: returns {back, front} markup; flowers + buds anchored for animation */
  function flowerBed(seed, y0, y1, n, cls, split) {
    const R = G.rng(seed);
    const items = [];
    for (let i = 0; i < n; i++) {
      const x = 20 + ((i + R() * 0.8) / n) * 1040;
      const y = y0 + R() * (y1 - y0);
      items.push({ x, y, s: 0.55 + (y - y0) / (y1 - y0) * 0.45 + R() * 0.15, k: ['mumA', 'mumB', 'mumC', 'mumA'][Math.floor(R() * 4)], i });
    }
    items.sort((a, b) => a.y - b.y);
    const mk = (f) => `<g transform="translate(${G.r(f.x)},${G.r(f.y)})"><path d="M0 0V120" stroke="${P.green}" stroke-width="10"/>${T(0, 70, f.s * 0.9, '<use href="#leafPair"/>')}
      <g class="${cls}-bud"><g transform="scale(${G.r(f.s * 2)})"><use href="#mumBud"/></g></g>
      <g class="${cls}-mum" data-x="${G.r(f.x)}"><g transform="scale(${G.r(f.s)})"><use href="#${f.k}"/></g></g></g>`;
    const back = items.filter((f) => f.y < split).map(mk).join('');
    const front = items.filter((f) => f.y >= split).map(mk).join('');
    return { back, front };
  }
  G.flowerBed = flowerBed;
  function bloom(c, cls, t0, span) {
    const mums = c.qa('.' + cls + '-mum');
    const buds = c.qa('.' + cls + '-bud');
    mums.forEach((m, i) => {
      const x = +m.getAttribute('data-x');
      const t = t0 + (x / 1080) * span + (i % 3) * 0.06;
      c.pop(m, t, { r0: -120, d: 0.6, ease: 'back.out(1.8)' });
      c.unpop(buds[i], t, { d: 0.25 });
    });
  }

  /* =========================== s4 聊天 =========================== */
  const item = (x, y, inner, label, cls) => A(x, y, `<circle r="80" fill="${P.paper2}"/><g transform="scale(.8)">${inner}</g><text class="kai" y="128" text-anchor="middle" font-size="42" fill="${P.ink}">${label}</text>`, cls);
  const arrow = (x, y, cls) => A(x, y, `<path d="M-20 0H14M2-14L18 0L2 14" stroke="${P.ink2}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`, cls);
  S.s4 = {
    svg() {
      const silkworm = `<g transform="translate(-8,10)"><path d="M-70 40C-40 10 40 10 70 40" stroke="${P.green}" stroke-width="0"/>
        <ellipse cx="10" cy="44" rx="74" ry="26" fill="${P.green2}"/>
        ${[-44, -22, 0, 22].map((x, i) => `<circle cx="${x}" cy="${12 - Math.sin(i) * 6}" r="${18 + i}" fill="#fff"/>`).join('')}
        <circle cx="44" cy="0" r="24" fill="#fff"/><circle cx="50" cy="-4" r="3.5" fill="${P.ink}"/><circle cx="38" cy="-4" r="3.5" fill="${P.ink}"/>
        <ellipse cx="54" cy="6" rx="5" ry="3" fill="${P.blush}"/><path d="M40 8Q44 12 48 8" stroke="${P.ink}" stroke-width="2.5" fill="none"/></g>`;
      const chain1 = `
        ${item(130, 0, `<g transform="translate(0,60) scale(.42)">${G.tree()}</g>${[[-24, -40], [20, -54], [32, -20], [-34, -6], [6, -12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${P.dusk3}"/>`).join('')}`, '桑樹', 's4-i s4-a0')}
        ${arrow(233, 0, 's4-ar s4-aa0')}
        ${item(336, 0, `<path d="M0 66C-62 34-66-26-34-60C-14-46 0-60 0-74C0-60 14-46 34-60C66-26 62 34 0 66Z" fill="${P.green}"/><path d="M0 66V-60M0 10L-30-18M0 34L28 6M0-14L22-34" stroke="${P.green2}" stroke-width="5" fill="none"/>`, '桑葉', 's4-i s4-a1')}
        ${arrow(438, 0, 's4-ar s4-aa1')}
        ${item(540, 0, `<g class="s4-worm">${silkworm}</g>`, '蠶寶寶', 's4-i s4-a2')}
        ${arrow(642, 0, 's4-ar s4-aa2')}
        ${item(744, 0, `<ellipse cx="-14" cy="0" rx="42" ry="30" fill="#fff"/><path d="M-50-6C-30 10 0 10 22-8M-48 10C-26 22 0 20 20 6" stroke="${P.paper2}" stroke-width="4" fill="none"/><path d="M26 0C50-30 60 30 76 4" stroke="#fff" stroke-width="6" fill="none"/><circle cx="56" cy="34" r="22" fill="#fff"/><circle cx="56" cy="34" r="10" fill="${P.paper2}"/>`, '蠶絲', 's4-i s4-a3')}
        ${arrow(847, 0, 's4-ar s4-aa3')}
        ${item(950, 0, `<path d="M-64-40C-30-60 0-20 30-40S64-30 64-30V40C40 56 10 20-20 40S-64 46-64 46Z" fill="${P.red}"/><path d="M-50-30C-20-44 0-10 30-28" stroke="${P.gold}" stroke-width="6" fill="none"/><path d="M-40 10C-10-6 10 20 40 2" stroke="#fff" stroke-width="8" opacity=".6" fill="none" stroke-linecap="round"/>`, '絲綢', 's4-i s4-a4')}`;
      const chain2 = `
        ${item(190, 0, `<g transform="translate(0,74)"><rect x="-4" y="-150" width="8" height="150" fill="${P.green}"/>${[[-110, 0.8], [-70, 0.95], [-30, 1.05]].map(([y, s]) => `<g transform="translate(0,${y}) scale(${s})">${[-60, -30, 0, 30, 60].map((r) => `<path d="M0 0C-6-14-4-30 0-40C4-30 6-14 0 0Z" fill="${P.green2}" transform="rotate(${r})"/>`).join('')}</g>`).join('')}</g>`, '麻', 's4-i s4-b0')}
        ${arrow(305, 0, 's4-ar s4-ab0')}
        ${item(420, 0, `<rect x="-10" y="-64" width="20" height="128" rx="8" fill="${P.green2}"/>${[-30, -18, 18, 30].map((x, i) => `<path d="M0 ${-40 + i * 6}C${x} -10 ${x * 1.3} 30 ${x * 1.5} 60" stroke="${i % 2 ? P.earth : P.paper}" stroke-width="5" fill="none" stroke-linecap="round"/>`).join('')}`, '莖纖維', 's4-i s4-b1')}
        ${arrow(535, 0, 's4-ar s4-ab1')}
        ${item(650, 0, `<g fill="none" stroke="${P.earth}" stroke-width="14"><circle r="50"/><circle r="32"/><circle r="14"/></g><g fill="none" stroke="${P.wood}" stroke-width="3" stroke-dasharray="4 8"><circle r="50"/><circle r="32"/></g><path d="M50 0C70 20 60 50 80 60" stroke="${P.earth}" stroke-width="14" fill="none" stroke-linecap="round"/>`, '繩子', 's4-i s4-b2')}
        ${arrow(765, 0, 's4-ar s4-ab2')}
        ${item(880, 0, `<rect x="-62" y="10" width="124" height="40" rx="10" fill="${P.paper2}" stroke="${P.earth}" stroke-width="4"/><rect x="-56" y="-26" width="112" height="40" rx="10" fill="${P.earth}"/><rect x="-50" y="-60" width="100" height="38" rx="10" fill="${P.paper}" stroke="${P.earth}" stroke-width="4"/><path d="M-40-50V-30M-20-50V-30M0-50V-30M20-50V-30M40-50V-30" stroke="${P.earth}" stroke-width="3"/>`, '布', 's4-i s4-b3')}`;
      const head = (ch, txt) => `<circle cx="-110" r="46" fill="${P.red}"/><text class="kai" x="-110" y="20" text-anchor="middle" font-size="60" fill="#fff">${ch}</text><text class="kai" x="-44" y="18" font-size="50" fill="${P.ink}">${txt}</text>`;
      const bubble = `<g transform="translate(660,820)"><g class="s4-bubble"><g transform="translate(-660,-820)" filter="url(#ps2)">
        <rect x="40" y="170" width="1000" height="560" rx="110" fill="${P.paper}"/>
        ${[[120, 200, 70], [300, 168, 70], [500, 160, 74], [700, 168, 72], [900, 196, 70], [1010, 400, 60], [70, 420, 60], [260, 730, 56], [820, 726, 56]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.paper}"/>`).join('')}
        <circle cx="660" cy="806" r="30" fill="${P.paper}"/><circle cx="676" cy="866" r="20" fill="${P.paper}"/><circle cx="688" cy="914" r="12" fill="${P.paper}"/>
        <g transform="translate(0,470)"><g class="s4-chain1">${A(540, -190, head('桑', '桑樹的寶貝'), 's4-h1')}${chain1}</g><g class="s4-chain2">${A(540, -190, head('麻', '麻的用處'), 's4-h2')}${chain2}</g></g>
      </g></g></g>`;
      const people = `
        ${G.adult('dad', { id: 's4-dad', propR: `<g class="cup">${G.cup('wine', 1.2)}</g>` })}
        ${G.adult('mom', { id: 's4-mom', propR: `<g class="cup">${G.cup('wine', 1.2)}</g>` })}
        ${G.kid('yu', { id: 's4-yu', propR: `<g class="cup">${G.cup('tea', 1.1)}</g>` })}
        ${G.kid('ting', { id: 's4-ting', pack: false, propR: `<g class="cup">${G.cup('tea', 1.1)}</g>` })}`;
      const q = (x, y, cls) => A(x, y, `<circle r="44" fill="${P.paper}" stroke="${P.blue}" stroke-width="6"/><text class="sans" y="20" text-anchor="middle" font-size="58" fill="${P.blue}">？</text>`, 's4-q ' + cls, 'filter="url(#ps)"');
      return `
        <rect width="1080" height="1260" fill="url(#gWarm)"/><rect width="1080" height="1260" fill="url(#pDots)"/>
        <g filter="url(#ps)"><circle cx="540" cy="470" r="200" fill="${P.wood2}"/></g>
        <clipPath id="s4-moon"><circle cx="540" cy="470" r="172"/></clipPath>
        <g clip-path="url(#s4-moon)"><rect x="360" y="290" width="360" height="360" fill="url(#gDusk)"/>
          <path d="M360 560Q460 500 560 540Q640 500 720 530V650H360Z" fill="${P.dusk3}" opacity=".8"/><circle cx="610" cy="390" r="30" fill="#FFF6D6"/>
          ${[[440, 360], [480, 420], [660, 470]].map(([x, y]) => T(x, y, 0.22, `<use href="#star4" fill="#FFF6D6"/>`)).join('')}</g>
        <path d="M540 290V650M370 470H710" stroke="${P.wood2}" stroke-width="10" clip-path="url(#s4-moon)"/>
        ${A(150, 300, lantern(true), 's4-lan1', 'filter="url(#ps)"')}${A(930, 300, lantern(true), 's4-lan2', 'filter="url(#ps)"')}
        <rect y="1250" width="1080" height="670" fill="${P.wood2}"/>${[1360, 1520, 1720].map((y) => `<rect y="${y}" width="1080" height="5" fill="${P.wood}" opacity=".45"/>`).join('')}
        ${people}
        <g filter="url(#ps)"><rect x="30" y="1176" width="1020" height="64" rx="16" fill="${P.wood}"/><rect x="50" y="1236" width="980" height="60" fill="${P.wood2}"/><rect x="50" y="1290" width="980" height="10" fill="#5E3B1B"/>
          <rect x="90" y="1296" width="40" height="260" fill="#5E3B1B"/><rect x="950" y="1296" width="40" height="260" fill="#5E3B1B"/></g>
        ${A(300, 1190, G.plateChicken(0.95), 's4-dish s4-d0')}
        ${A(545, 1172, G.bowlMillet(0.9), 's4-dish s4-d1')}
        ${A(790, 1192, G.greensDish(1), 's4-dish s4-d2')}
        ${[0, 1, 2, 3, 4, 5].map((i) => A(800, 1010, `<circle r="7" fill="${P.gold}"/><circle cx="7" cy="-3" r="4" fill="${P.mum}"/>`, `s4-osm s4-osm${i}`)).join('')}
        ${q(170, 900, 's4-q0')}${q(390, 900, 's4-q1')}${q(690, 960, 's4-q2')}
        ${A(905, 900, `<text class="sans" y="40" text-anchor="middle" font-size="150" fill="${P.blue}" stroke="${P.paper}" stroke-width="10" paint-order="stroke">？</text>`, 's4-bigq')}
        ${A(690, 1150, G.sparkles(10, 44, 150, 160), 's4-sparks')}
        ${bubble}`;
    },
    anim(c) {
      const T0 = c.T0, T1 = c.T1;
      const dad = c.char('#s4-dad', { x: 160, y: 1410, s: 0.95, armR: -14 });
      const mom = c.char('#s4-mom', { x: 390, y: 1410, s: 0.95, flip: true });
      const yu = c.char('#s4-yu', { x: 690, y: 1310, s: 0.95 });
      const ting = c.char('#s4-ting', { x: 910, y: 1310, s: 0.95, flip: true });
      [dad, mom, yu, ting].forEach((ch) => ch.idle(T0, T1 + 1));
      c.ft('.s4-lan1', { rotation: -4 }, { rotation: 4, duration: 1.4, repeat: Math.floor((T1 - T0) / 1.4) | 1, yoyo: true, ease: 'sine.inOut' }, T0);
      c.ft('.s4-lan2', { rotation: 3 }, { rotation: -3, duration: 1.3, repeat: Math.floor((T1 - T0) / 1.3) | 1, yoyo: true, ease: 'sine.inOut' }, T0);
      ['.s4-bubble', '.s4-bigq'].forEach((s) => c.init(s, { autoAlpha: 0 }));
      c.init(c.qa('.s4-i, .s4-ar, .s4-h2'), { scale: 0, autoAlpha: 0 });
      c.init(c.qa('.s4-osm'), { autoAlpha: 0 });
      // s4-1: dishes pop, cups raise
      const s41 = c.s('s4-1');
      c.qa('.s4-dish').forEach((d, i) => c.pop(d, s41 + 0.3 + i * 0.45, { y0: -50, d: 0.5 }));
      const tWine = c.w('s4-1', '端起酒杯') - 0.2;
      armProp(c, dad, 'R', -136, tWine, 0.45);
      armProp(c, mom, 'R', -136, tWine + 0.15, 0.45);
      const tTea = c.w('s4-1', '桂花茶') - 0.6;
      armProp(c, yu, 'R', -136, tTea, 0.45);
      armProp(c, ting, 'R', -136, tTea + 0.12, 0.45);
      dad.eyesTo(tWine + 0.4, 'h'); mom.eyesTo(tWine + 0.5, 'h');
      dad.mouthTo(tWine + 0.4, 's'); mom.mouthTo(tWine + 0.5, 's');
      yu.mouthTo(tTea + 0.4, 's'); ting.mouthTo(tTea + 0.5, 's');
      // osmanthus aroma rising from the kids' tea cups
      c.qa('.s4-osm').forEach((o, i) => {
        const t0 = tTea + 0.6 + i * 0.35;
        for (let t = t0; t < c.e('s4-2') - 1.4; t += 2.1) {
          c.ft(o, { x: (i - 2.5) * 10, y: 0, autoAlpha: 0, scale: 0.6 }, { x: (i - 2.5) * 26 + (i % 2 ? 20 : -20), y: -170, autoAlpha: 1, scale: 1.2, duration: 1.2, ease: 'sine.out' }, t);
          c.ft(o, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5 }, t + 1.2);
        }
      });
      // s4-2: 把 = 拿著; cups clink; question marks
      const s42 = c.s('s4-2'), e42 = c.e('s4-2');
      c.ft([dad.armR, mom.armR], { rotation: -136 }, { rotation: -126, duration: 0.18, repeat: 3, yoyo: true }, c.w('s4-2', '「把酒」'));
      c.card('s4-2', { top: 330 });
      const tQ = c.w('s4-2', '聊什麼呢') - 0.2;
      c.qa('.s4-q').forEach((q, i) => c.pop(q, tQ + i * 0.15, { d: 0.45, ease: 'back.out(2.5)' }));
      armProp(c, dad, 'R', -14, tQ - 0.6, 0.4, 'power2.inOut');
      armProp(c, mom, 'R', -12, tQ - 0.5, 0.4, 'power2.inOut');
      armProp(c, yu, 'R', -12, tQ - 0.6, 0.4, 'power2.inOut');
      armProp(c, ting, 'R', -12, tQ - 0.5, 0.4, 'power2.inOut');
      [dad, mom, yu].forEach((ch, i) => ch.tilt(tQ + i * 0.1, i % 2 ? 8 : -8).tilt(e42 + 0.2, 0));
      c.unpop(c.qa('.s4-q'), e42 + 0.25, { stagger: 0.05 });
      // s4-3: 桑 chain in 小玉's thought bubble
      const s43 = c.s('s4-3');
      c.pop('.s4-bubble', s43 - 0.3, { s0: 0.3, d: 0.55, ease: 'back.out(1.4)' });
      // the title row (桑 + 桑樹的寶貝) is part of the bubble; the first icon follows within 0.3 s
      c.pop('.s4-h2', c.s('s4-5') - 0.1, { d: 0.45 });
      const k1 = [['桑樹', 0], ['桑葉', 1], ['蠶寶寶', 2], ['吐的絲', 3], ['絲綢', 4]];
      let prevT = s43 - 0.3;
      k1.forEach(([w, i]) => {
        let t = i === 0 ? s43 - 0.05 : Math.max(c.w('s4-3', w) - 0.2, prevT + 0.45);
        prevT = t;
        c.pop('.s4-a' + i, t, { d: 0.5 });
        if (i > 0) c.pop('.s4-aa' + (i - 1), t - 0.2, { d: 0.3 });
      });
      c.ft('.s4-worm', { x: 0 }, { x: 6, duration: 0.15, repeat: 9, yoyo: true }, c.w('s4-3', '蠶寶寶') + 0.4);
      yu.eyesTo(s43, 'n');
      // s4-4: 阿庭 wonders
      const s44 = c.s('s4-4'), e44 = c.e('s4-4');
      c.fadeOut('.s4-chain1', c.s('s4-5') - 0.35, 0.3);
      ting.tilt(s44, 14, 0.4).tilt(e44 + 0.3, 0, 0.4);
      c.pop('.s4-bigq', s44, { d: 0.5, ease: 'elastic.out(1,.5)', r0: -30, r: 8 });
      c.unpop('.s4-bigq', e44 + 0.3);
      // s4-5: 麻 chain + 小玉's clothes shine
      const k2 = [['麻是', 0], ['莖', 1], ['繩子', 2], ['布', 3]];
      k2.forEach(([w, i]) => {
        const t = c.w('s4-5', w) - 0.2;
        c.pop('.s4-b' + i, t, { d: 0.5 });
        if (i > 0) c.pop('.s4-ab' + (i - 1), t - 0.2, { d: 0.3 });
      });
      const tCloth = c.w('s4-5', '衣服') - 0.1;
      c.ft('#s4-yu .sheen', { opacity: 0 }, { opacity: 0.55, duration: 0.25, repeat: 3, yoyo: true }, tCloth);
      c.pop('.s4-sparks', tCloth, { d: 0.5 });
      c.qa('.s4-sparks .spark').forEach((sp, i) => c.ft(sp, { rotation: 0 }, { rotation: 90, duration: 1.2, ease: 'none' }, tCloth));
      c.unpop('.s4-sparks', tCloth + 1.8);
      yu.eyesTo(tCloth, 'h');
      c.talker('小玉', yu); c.talker('阿庭', ting);
      c.talker('rest:s4-5', 's');
      // s4-6: words + everyone toasts again
      const s46 = c.s('s4-6'), e46 = c.e('s4-6');
      c.unpop('.s4-bubble', s46 - 0.2, { d: 0.35 });
      c.card('s4-6', { top: 400 });
      const tToast = c.w('s4-6', '把酒話桑麻', 0.8, 'last') - 0.4;
      armProp(c, dad, 'R', -136, tToast, 0.45);
      armProp(c, mom, 'R', -136, tToast + 0.1, 0.45);
      armProp(c, yu, 'R', -136, tToast + 0.05, 0.45);
      armProp(c, ting, 'R', -136, tToast + 0.15, 0.45);
      [dad, mom, yu, ting].forEach((ch) => ch.eyesTo(tToast, 'h'));
    }
  };

  /* =========================== s5 約定 =========================== */
  S.s5 = {
    svg() {
      const bed = flowerBed(505, 1240, 1900, 46, 's5', 1440);
      const pages = ['初四', '初五', '初六', '初七', '初八'].map((d, i) => A(0, -180, `<g transform="translate(0,180)">${G.calendarPage('九月', d, '', P.red)}</g>`, `s5-page s5-page${i}`)).join('');
      const pinky = `<circle r="384" fill="${P.paper}"/><circle r="360" fill="${P.paper2}"/>
        ${Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return T(Math.cos(a) * 372, Math.sin(a) * 372, 0.95, `<use href="#${['mumA', 'mumB', 'mumC'][i % 3]}"/>`); }).join('')}
        <clipPath id="s5-pclip"><circle r="352"/></clipPath>
        <g clip-path="url(#s5-pclip)">
          <path d="M-420 250L-90 40" stroke="${P.red}" stroke-width="130" stroke-linecap="round"/><path d="M-140 70L-104 128" stroke="${P.gold}" stroke-width="22"/>
          <path d="M420 250L90 40" stroke="${P.blue}" stroke-width="130" stroke-linecap="round"/><path d="M140 70L104 128" stroke="${P.paper}" stroke-width="22"/>
          <path d="M-70-40C-60-150 40-150 30-60" stroke="${P.skin}" stroke-width="36" fill="none" stroke-linecap="round"/>
          <ellipse cx="-62" cy="24" rx="82" ry="70" fill="${P.skin}"/><path d="M-110 20Q-80 4-50 20M-104 50Q-76 36-48 52" stroke="#E8BFA0" stroke-width="6" fill="none" stroke-linecap="round"/>
          <ellipse cx="62" cy="30" rx="82" ry="70" fill="#F4CDB0"/><path d="M110 26Q80 10 50 26M104 56Q76 42 48 58" stroke="#E2B395" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M70-30C60-130-40-130-30-50" stroke="#F4CDB0" stroke-width="36" fill="none" stroke-linecap="round"/>
          <text class="kai" y="-200" text-anchor="middle" font-size="64" fill="${P.red}">勾勾手指</text>
        </g>
        ${G.sparkles(12, 909, 300, 260)}`;
      return `
        <rect width="1080" height="1920" fill="url(#gSky)"/>
        <rect class="s5-dusk" width="1080" height="1920" fill="url(#gDusk)"/>
        ${A(800, 420, `<circle r="140" fill="url(#gGlow)"/><circle r="84" fill="url(#gSun)"/><circle class="s5-sunred" r="84" fill="${P.mum2}"/>`, 's5-sun')}
        ${G.cloud(240, 300, 0.9, 's5-c1', 0.9)}${G.cloud(700, 220, 0.6, 's5-c2', 0.85)}
        <path d="M0 900Q160 800 340 860Q520 770 700 850Q880 790 1080 840V1920H0Z" fill="${P.hill}"/>
        <path d="M0 960Q260 880 520 940Q760 880 1080 930V1920H0Z" fill="${P.hill2}"/>
        <rect class="s5-tint" y="840" width="1080" height="1080" fill="${P.dusk3}"/>
        <path d="M0 1120Q540 1080 1080 1120V1920H0Z" fill="${P.yard}"/>
        ${T(170, 1150, 0.95, G.farmhouse())}
        <g filter="url(#ps)"><rect x="770" y="960" width="30" height="300" rx="8" fill="${P.wood2}"/><rect x="1010" y="960" width="30" height="300" rx="8" fill="${P.wood2}"/>
          <path d="M740 970L905 900L1070 970Z" fill="${P.ink2}"/><rect x="750" y="962" width="310" height="16" rx="6" fill="${P.ink}"/></g>
        ${G.fence(1040, 1080, 1140, 50)}${G.fence(500, 770, 1150, 54)}
        <rect class="s5-tint2" y="1120" width="1080" height="800" fill="${P.dusk2}"/>
        ${bed.back}
        ${A(330, 1440, `<ellipse cx="0" cy="0" rx="80" ry="14" fill="#3B2A16" opacity=".22"/>`, 's5-shY')}
        ${A(760, 1440, `<ellipse cx="0" cy="0" rx="80" ry="14" fill="#3B2A16" opacity=".22"/>`, 's5-shT')}
        ${G.kid('yu', { id: 's5-yu' })}
        ${G.kid('ting', { id: 's5-ting', pack: true })}
        ${bed.front}
        ${A(250, 650, `<g filter="url(#ps2)"><g transform="translate(0,0)">${G.calendarPage('九月', '初九', '重陽', P.red)}</g>${pages}<rect x="-150" y="-196" width="300" height="24" rx="10" fill="${P.ink2}"/><circle cx="-80" cy="-184" r="10" fill="${P.wood2}"/><circle cx="80" cy="-184" r="10" fill="${P.wood2}"/></g>
          ${G.sparkles(8, 55, 220, 240)}`, 's5-cal')}
        ${A(540, 1240, G.sparkles(9, 321, 130, 90), 's5-hookspark')}
        ${A(540, 960, pinky, 's5-pinky', 'filter="url(#ps2)"')}`;
    },
    anim(c) {
      const T0 = c.T0, T1 = c.T1;
      const s51 = c.s('s5-1'), e51 = c.e('s5-1'), s52 = c.s('s5-2');
      c.init('.s5-dusk', { opacity: 0 }); c.init('.s5-sunred', { opacity: 0 });
      c.init('.s5-tint', { opacity: 0 }); c.init('.s5-tint2', { opacity: 0 });
      ['.s5-cal', '.s5-pinky'].forEach((s) => c.init(s, { autoAlpha: 0, scale: 0 }));
      // sunset
      const sunD = e51 - s51 + 3;
      c.ft('.s5-dusk', { opacity: 0 }, { opacity: 1, duration: sunD, ease: 'sine.inOut' }, s51);
      c.ft('.s5-sun', { y: 0 }, { y: 400, duration: sunD + 2, ease: 'sine.inOut' }, s51);
      c.ft('.s5-sunred', { opacity: 0 }, { opacity: 0.85, duration: sunD, ease: 'sine.inOut' }, s51);
      c.ft('.s5-tint', { opacity: 0 }, { opacity: 0.22, duration: sunD, ease: 'sine.inOut' }, s51);
      c.ft('.s5-tint2', { opacity: 0 }, { opacity: 0.16, duration: sunD, ease: 'sine.inOut' }, s51);
      c.ft('.s5-c1', { x: 0 }, { x: 120, duration: T1 - T0, ease: 'none' }, T0);
      c.ft('.s5-c2', { x: 0 }, { x: -80, duration: T1 - T0, ease: 'none' }, T0);
      c.ft(['.s5-shY', '.s5-shT'].map((s) => c.q(s)), { scaleX: 1, x: 0 }, { scaleX: 2.6, x: -130, duration: sunD, ease: 'sine.inOut' }, s51);
      const yu = c.char('#s5-yu', { x: 330, y: 1440 });
      const ting = c.char('#s5-ting', { x: 760, y: 1440 });
      gsap.set(ting.eyes, { x: 10 }); ting.st.ex = 10;
      yu.idle(T0, T1 + 1); ting.idle(T0, T1 + 1);
      ting.walk(s51 + 0.6, s51 + 2.0, 0.32); ting.moveTo(s51 + 0.6, 1.4, 860, null, 'sine.inOut');
      yu.look(s51 + 1, 10, 0);
      // s5-2 阿庭 turns around, happy eyes
      ting.face(s52 - 0.3, -1); ting.look(s52 - 0.3, 0, 0);
      ting.moveTo(s52 - 0.2, 0.8, 740, null, 'power2.out');
      ting.eyesTo(s52, 'h');
      ting.hop(s52 + 0.6, 1, 34);
      yu.look(s52, 0, 0);
      c.ft('.s5-shT', { x: -130 }, { x: -230, duration: 0.8 }, s52 - 0.2);
      // s5-3 calendar + chrysanthemums bloom
      const tCal = c.w('s5-3', '「待到重陽日」') - 0.5;
      c.ft('.s5-cal', { autoAlpha: 0, scale: 0, rotation: -20 }, { autoAlpha: 1, scale: 0.92, rotation: -4, duration: 0.55, ease: 'back.out(1.7)' }, tCal);
      const tLand = c.w('s5-3', '九月九日');
      c.qa('.s5-page').forEach((p, i, arr) => {
        const t = tLand - 1.25 + i * 0.25;
        c.ft(p, { scaleY: 1, autoAlpha: 1 }, { scaleY: 0, autoAlpha: 0.2, duration: 0.2, ease: 'power2.in' }, t);
        c.set(p, { autoAlpha: 0 }, t + 0.2);
      });
      c.init('.s5-cal .spark', { scale: 0, autoAlpha: 0 });
      c.qa('.s5-cal .spark').forEach((sp, i) => c.ft(sp, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, repeat: 3, yoyo: true, ease: 'sine.inOut' }, tLand + 0.05 + i * 0.06));
      c.ft('.s5-cal', { scale: 0.92 }, { scale: 1.02, duration: 0.2, repeat: 1, yoyo: true }, tLand);
      yu.arm(tCal, 'L', 120, 0.4).arm(tLand + 1.5, 'L', 12, 0.4, 'power2.inOut');
      const tBloom = c.w('s5-3', '菊花') - 0.4;
      bloom(c, 's5', tBloom, 2.4);
      yu.eyesTo(tBloom + 0.5, 's'); ting.eyesTo(tBloom + 0.5, 's');
      const tTogether = c.w('s5-3', '一起「就菊花」');
      yu.hop(tTogether, 2, 40, 0.22); ting.hop(tTogether + 0.1, 2, 40, 0.22);
      yu.eyesTo(tTogether + 1, 'h'); ting.eyesTo(tTogether + 1, 'h');
      c.talker('小玉', yu); c.talker('阿庭', ting);
      // s5-4 words; calendar leaves
      const s54 = c.s('s5-4');
      c.ft('.s5-cal', { autoAlpha: 1, scale: 0.92 }, { autoAlpha: 0, scale: 0, duration: 0.35, ease: 'back.in(1.6)' }, s54 - 0.3);
      const tJiu = c.w('s5-4', '「就」') - 0.1;
      yu.lean(tJiu, -12, 0.5).tilt(tJiu, -10, 0.5).eyesTo(tJiu, 'h');
      yu.lean(tJiu + 2.4, 0, 0.5).tilt(tJiu + 2.4, 0, 0.5);
      // s5-5 pinky promise (step closer, arms out)
      const s55 = c.s('s5-5');
      yu.walk(s55 - 0.4, s55 + 0.5, 0.3); yu.moveTo(s55 - 0.4, 0.9, 410, null, 'sine.inOut');
      ting.walk(s55 - 0.4, s55 + 0.5, 0.3); ting.moveTo(s55 - 0.4, 0.9, 670, null, 'sine.inOut');
      yu.eyesTo(s55, 'n'); ting.eyesTo(s55, 'n');
      yu.arm(s55 + 0.6, 'R', -92, 0.4); ting.arm(s55 + 0.6, 'R', -92, 0.4);
      yu.eyesTo(s55 + 1.2, 'h'); ting.eyesTo(s55 + 1.2, 'h');
      // s5-6 close-up medallion of the hooked pinkies
      const s56 = c.s('s5-6'), e56 = c.e('s5-6');
      c.ft('.s5-pinky', { autoAlpha: 0, scale: 0, rotation: -12 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.5)' }, s56 - 0.2);
      c.init('.s5-pinky .spark', { scale: 0, autoAlpha: 0 });
      c.qa('.s5-pinky .spark').forEach((sp, i) => c.ft(sp, { scale: 0, autoAlpha: 0, rotation: 0 }, { scale: 1.3, autoAlpha: 1, rotation: 45, duration: 0.45, repeat: 5, yoyo: true, ease: 'sine.inOut' }, s56 + 0.5 + i * 0.12));
      const tFollow = c.w('s5-6', '跟著念') - 0.9;
      c.ft('.s5-pinky', { scale: 1, autoAlpha: 1 }, { scale: 0.2, autoAlpha: 0, duration: 0.5, ease: 'back.in(1.4)' }, tFollow);
      c.pop('.s5-hookspark', tFollow + 0.3, { d: 0.5 });
      c.qa('.s5-hookspark .spark').forEach((sp, i) => c.ft(sp, { rotation: 0, scale: 1 }, { rotation: 60, scale: 1.4, duration: 0.5, repeat: 7, yoyo: true, ease: 'sine.inOut' }, tFollow + 0.4 + i * 0.07));
      c.card('s5-6', { top: 430, times: [tFollow + 0.2] });
      c.card('s5-4', { top: 520 });
    }
  };

  /* =========================== s6 圖像記憶 =========================== */
  const FRAMES = [
    [['chicken', 82, 150, 150], ['millet-bowl', 205, 168, 140], ['letter', 318, 140, 130]],
    [['tree-hug', 110, 146, 180], ['wall', 250, 196, 120], ['mountain-giant', 322, 106, 140]],
    [['window', 100, 140, 170], ['hand-cup', 236, 176, 130], ['mulberry-hemp', 330, 150, 130]],
    [['calendar-99', 96, 140, 156], ['chrysanthemum', 214, 162, 136], ['pinky', 322, 150, 150]]
  ];
  G.FRAMES = FRAMES;
  const FRAME_WORDS = [['雞', '黃米飯', '邀請信'], ['綠樹', '牆外', '青山'], ['窗戶', '杯子', '桑樹和麻'], ['日曆', '菊花', '開得滿院子']];
  const ROW_Y = (k) => 150 + k * 334;
  S.s6 = {
    svg(sc, data) {
      return `<rect width="1080" height="1920" fill="${P.paper}"/><rect width="1080" height="1920" fill="url(#pDots)"/>
        ${T(70, 1880, 1.1, '<use href="#mumA"/>')}${T(1010, 1860, 1.3, '<use href="#mumB"/>')}${T(960, 70, 0.8, '<use href="#mumC"/>')}
        ${A(540, 76, `<rect x="-250" y="-46" width="500" height="92" rx="46" fill="${P.green}"/><text class="kai" y="22" text-anchor="middle" font-size="58" fill="${P.paper}">四張圖・背全詩</text>`, 's6-head', 'filter="url(#ps)"')}
        ${FRAMES.map((items, k) => A(260, ROW_Y(k) + 150, `
          <rect class="s6-glow" x="-232" y="-172" width="464" height="344" rx="30" fill="none" stroke="${P.millet}" stroke-width="18"/>
          <rect x="-214" y="-154" width="428" height="308" rx="20" fill="${P.wood}"/>
          <rect x="-198" y="-138" width="396" height="276" rx="12" fill="#fff"/>
          <g transform="translate(-198,-138)">${items.map(([ic, x, y, sz], j) => G.iconAt(ic, x, y, sz, `s6-it s6-it${k}-${j}`)).join('')}</g>
          <rect x="-60" y="-176" width="120" height="40" fill="${[P.millet, P.green3, P.sky1, P.blush][k]}" opacity=".85" transform="rotate(${k % 2 ? 4 : -4})"/>
          ${A(-206, -144, `<circle r="38" fill="${P.red}"/><text class="sans" y="16" text-anchor="middle" font-size="44" fill="#fff">${k + 1}</text>`, 's6-num')}`, 's6-frame s6-frame' + k, 'filter="url(#ps2)"')).join('')}`;
    },
    html(sc, data) {
      return data.poem.map((l, k) => `<div class="pm s6-poem s6-poem${k}" style="top:${ROW_Y(k) + 36}px">${G.poemRowHTML(l[0], '，', 'h0')}${G.poemRowHTML(l[1], '。', 'h1')}</div>`).join('');
    },
    anim(c) {
      const data = c.data;
      const s61 = c.s('s6-1');
      c.pop('.s6-head', c.T0 + 0.4, { d: 0.5 });
      c.init(c.qa('.s6-glow'), { autoAlpha: 0 });
      c.qa('.s6-frame').forEach((f, k) => {
        c.init(f, { autoAlpha: 0, y: -320, rotation: k % 2 ? 10 : -10 });
        c.ft(f, { autoAlpha: 0, y: -320, rotation: k % 2 ? 10 : -10 }, { autoAlpha: 1, y: 0, rotation: k % 2 ? 1.5 : -1.5, duration: 0.65, ease: 'back.out(1.4)' }, s61 + 0.2 + k * 0.45);
      });
      c.init(c.qa('.s6-it'), { scale: 0, autoAlpha: 0 });
      c.qa('.s6-poem').forEach((p) => { c.init(p, { autoAlpha: 0, x: 40 }); p.querySelectorAll('.rc-row').forEach((r) => G.dimChars(r)); });
      ['s6-2', 's6-3', 's6-4', 's6-5'].forEach((id, k) => {
        const cue = c.C(id);
        FRAME_WORDS[k].forEach((w, j) => {
          const t = c.w(id, w, 0.1 + j * 0.15) - 0.3;
          c.pop('.s6-it' + k + '-' + j, t, { d: 0.5, r0: -20, ease: 'back.out(2)' });
        });
        const sched = G.reciteSchedule(cue, data.poem[k]);
        const first = sched[0] ? sched[0][0] : cue.start + cue.dur * 0.5;
        const poemEl = c.q('.s6-poem' + k);
        c.ft(poemEl, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power2.out' }, first - 0.8);
        poemEl.querySelectorAll('.rc-row').forEach((row, hi) => { if (sched[hi]) G.lightChars(c.tl, row, sched[hi]); });
        c.ft('.s6-frame' + k, { scale: 1 }, { scale: 1.04, duration: 0.25, repeat: 1, yoyo: true, ease: 'sine.inOut' }, first - 0.3);
      });
      const e65 = c.e('s6-5');
      c.ft(c.qa('.s6-glow'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, repeat: 3, yoyo: true, stagger: 0.15, ease: 'sine.inOut' }, e65 - 1.6);
      c.set(c.qa('.s6-glow'), { autoAlpha: 1 }, e65 + 0.6);
    }
  };

  /* =========================== s7 背誦挑戰 =========================== */
  const BLANKS = [
    { rows: [['故', '人', '具', ['雞黍', ['chicken-millet']]], ['邀', '我', '至', ['田家', ['field-house']]]] },
    { rows: [['綠', '樹', '村', '邊', ['合', ['tree-hug']]], ['青', '山', '郭', '外', ['斜', ['slanted-hill']]]] },
    { rows: [['開', '軒', '面', ['場圃', ['grain-yard', 'vegetable-garden']]], ['把', '酒', '話', ['桑麻', ['mulberry-hemp']]]] },
    { rows: [['待', '到', ['重陽', ['calendar-99']], '日'], ['還', '來', '就', ['菊花', ['chrysanthemum']]]] }
  ];
  G.BLANKS = BLANKS;
  const LINE_ICONS = [['chicken-millet', 'letter'], ['tree-hug', 'slanted-hill'], ['window', 'mulberry-hemp'], ['calendar-99', 'chrysanthemum']];
  function qCardHTML(k) {
    const b = BLANKS[k];
    const rows = b.rows.map((r, ri) => `<div class="q-row">${r.map((x) => {
      if (typeof x === 'string') return `<span class="q-ch kai">${x}</span>`;
      const [w, icons] = x;
      const n = Array.from(w).length;
      return `<span class="q-tile n${n}" data-w="${w}"><span class="q-front">${icons.map((ic) => G.icon(ic)).join('')}</span><span class="q-back kai">${w}</span></span>`;
    }).join('')}<span class="q-ch q-p kai">${ri === 0 ? '，' : '。'}</span></div>`).join('');
    return `<div class="q-card q-card${k}"><div class="q-head"><span class="q-num">第 ${k + 1} 句</span><span class="q-think"><i></i><i></i><i></i></span></div>${rows}</div>`;
  }
  S.s7 = {
    svg() {
      const bed = flowerBed(707, 1250, 1900, 40, 's7', 1440);
      const flag = (col, mirror) => `<g class="flag"><rect x="-5" y="-200" width="10" height="220" rx="4" fill="${P.wood2}"/><path d="M5-200H128L106-160L128-120H5Z" fill="${col}"/><text class="kai" transform="translate(60,-146)${mirror ? ' scale(-1,1)' : ''}" text-anchor="middle" font-size="36" fill="#fff">挑戰</text></g>`;
      const confetti = (() => {
        const R = G.rng(77); let s = '';
        const cols = [P.red, P.blue, P.gold, P.green2, P.mum2, P.millet, P.hill];
        for (let i = 0; i < 90; i++) {
          const x = R() * 1080, sh = R();
          const col = cols[i % cols.length];
          const body = sh < 0.4 ? `<rect x="-10" y="-6" width="20" height="12" rx="3" fill="${col}"/>` : sh < 0.7 ? `<circle r="8" fill="${col}"/>` : `<path d="M-10 6L0-10L10 6Z" fill="${col}"/>`;
          s += A(G.r(x), -60, body, 's7-cf', `data-r="${G.r(R())}" data-s="${G.r(R())}"`);
        }
        return s;
      })();
      const medal = `<g class="s7-rays">${Array.from({ length: 16 }, (_, i) => `<path d="M-26-200L0-420L26-200Z" fill="${P.millet}" opacity=".6" transform="rotate(${i * 22.5})"/>`).join('')}</g>
        <path d="M-120 140L-180 380L-110 340L-70 400L-30 170Z" fill="${P.red}"/><path d="M120 140L180 380L110 340L70 400L30 170Z" fill="${P.red}"/>
        <g transform="scale(4.3)"><use href="#mumA"/></g>
        <circle r="150" fill="${P.paper}"/><circle r="136" fill="none" stroke="${P.gold}" stroke-width="8"/>
        <text class="kai" y="-20" text-anchor="middle" font-size="62" fill="${P.red}">我會背</text>
        <text class="kai" y="64" text-anchor="middle" font-size="66" font-weight="700" fill="${P.ink}">過故人莊</text>
        ${G.sparkles(10, 31, 330, 330)}`;
      return `<rect width="1080" height="1920" fill="${P.paper}"/><rect width="1080" height="1920" fill="url(#pDots)"/>
        ${T(60, 70, 0.9, '<use href="#mumB"/>')}${T(1020, 90, 1.0, '<use href="#mumA"/>')}${T(40, 1460, 0.8, '<use href="#mumC"/>')}${T(1040, 1440, 0.9, '<use href="#mumA"/>')}
        <g class="s7-end">
          <rect width="1080" height="1920" fill="url(#gSky)"/>
          ${G.cloud(220, 420, 0.9, 's7-ec1')}${G.cloud(860, 560, 0.7, 's7-ec2')}
          <path d="M0 960Q180 860 380 920Q560 830 760 910Q920 860 1080 900V1920H0Z" fill="${P.hill}"/>
          <path d="M0 1040Q300 960 600 1020Q840 970 1080 1010V1920H0Z" fill="${P.hill2}"/>
          <path d="M0 1130Q540 1080 1080 1130V1920H0Z" fill="${P.green2}"/>
          ${T(860, 1150, 0.5, G.farmhouse())}${T(660, 1140, 0.45, G.tree())}${T(1040, 1150, 0.4, G.tree({ tone: 'light' }))}
          ${bed.back}
          ${G.kid('yu', { id: 's7-yu' })}${G.kid('ting', { id: 's7-ting', pack: true })}
          ${bed.front}
          <rect class="s7-fade" width="1080" height="1920" fill="${P.paper}"/>
          ${A(540, 330, `<rect x="-430" y="-150" width="860" height="300" rx="60" fill="${P.paper}" opacity=".94"/><text class="kai" y="20" text-anchor="middle" font-size="140" font-weight="700" fill="${P.ink}">過故人莊</text><text class="kai" y="110" text-anchor="middle" font-size="54" fill="${P.red}">唐・孟浩然</text>`, 's7-endtitle', 'filter="url(#ps2)"')}
        </g>
        ${A(540, 640, `<g filter="url(#ps2)">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M0-90L22-280L-22-280Z" fill="${P.gold}" transform="rotate(${i * 45})"/>`).join('')}<rect x="-380" y="-110" width="760" height="220" rx="60" fill="${P.red}"/><text class="kai" y="40" text-anchor="middle" font-size="120" font-weight="700" fill="#fff">挑戰時間！</text></g>`, 's7-title')}
        <g class="s7-prog">${[0, 1, 2, 3].map((k) => A(300 + k * 160, 300, `<circle r="58" fill="${P.paper2}" stroke="${P.edge || '#EADBC0'}" stroke-width="6"/><text class="sans" y="16" text-anchor="middle" font-size="44" fill="${P.ink2}" opacity=".5">${k + 1}</text>${A(0, 0, `<g transform="scale(1.05)"><use href="#mumA"/></g>`, 's7-star s7-star' + k)}`, 's7-slot')).join('')}</g>
        ${A(-30, 1500, G.kid('yu', { id: 's7-pyu', propR: flag(P.red) }), 's7-peekL')}
        ${A(1110, 1500, G.kid('ting', { id: 's7-pting', propR: flag(P.blue, true), pack: true }), 's7-peekR')}
        ${A(540, 760, medal, 's7-medal', 'filter="url(#ps2)"')}
        <g class="s7-confetti">${confetti}</g>`;
    },
    html(sc, data) {
      const poem = `<div class="s7-poem pm2">
        <div class="s7-ttl"><span class="rc-row t"><span class="rc"><i class="rc-dot"></i><b>過</b></span><span class="rc"><i class="rc-dot"></i><b>故</b></span><span class="rc"><i class="rc-dot"></i><b>人</b></span><span class="rc"><i class="rc-dot"></i><b>莊</b></span></span><div class="s7-poet kai">唐・孟浩然</div></div>
        ${data.poem.map((l, k) => `<div class="s7-line s7-line${k}"><div class="s7-ic">${G.icon(LINE_ICONS[k][0])}</div><div class="s7-txt">${G.poemRowHTML(l[0], '，', 'h0')}${G.poemRowHTML(l[1], '。', 'h1')}</div></div>`).join('')}
      </div>`;
      return poem + `<div class="s7-qs">${BLANKS.map((_, k) => qCardHTML(k)).join('')}</div>`;
    },
    anim(c) {
      const data = c.data, T0 = c.T0, T1 = c.T1;
      const s71 = c.s('s7-1'), cue1 = c.C('s7-1');
      // ---- A: whole poem lights line by line ----
      c.init('.s7-end', { autoAlpha: 0 });
      ['.s7-title', '.s7-medal'].forEach((s) => c.init(s, { autoAlpha: 0, scale: 0 }));
      c.init('.s7-confetti', { autoAlpha: 0 });
      const poem = c.q('.s7-poem');
      c.init(poem, { autoAlpha: 0, y: 40 });
      c.ft(poem, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, T0 + 0.3);
      const lines = c.qa('.s7-line');
      lines.forEach((l) => { c.init(l, { autoAlpha: 0.35 }); l.querySelectorAll('.rc-row').forEach((r) => G.dimChars(r)); });
      const ttlRow = c.q('.s7-ttl .rc-row');
      G.dimChars(ttlRow);
      const ti = cue1.text.indexOf('過故人莊');
      G.lightChars(c.tl, ttlRow, [0, 1, 2, 3].map((k) => G.tAt(cue1, ti + k)));
      let from = ti + 4;
      data.poem.forEach((l, k) => {
        const times = l.map((h) => { const idx = cue1.text.indexOf(h, from); from = idx + 5; return Array.from(h).map((_, j) => G.tAt(cue1, idx + j)); });
        c.ft(lines[k], { autoAlpha: 0.35, scale: 1 }, { autoAlpha: 1, scale: 1.03, duration: 0.3 }, times[0][0] - 0.4);
        c.ft(lines[k], { scale: 1.03 }, { scale: 1, duration: 0.3 }, times[1][4] + 0.3);
        lines[k].querySelectorAll('.rc-row').forEach((r, hi) => G.lightChars(c.tl, r, times[hi]));
      });
      // ---- B: challenge time — kids peek in with flags ----
      const s72 = c.s('s7-2'), e72 = c.e('s7-2');
      c.ft(poem, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -60, duration: 0.5, ease: 'power2.in' }, s72 - 0.3);
      c.ft('.s7-title', { autoAlpha: 0, scale: 0, rotation: -10 }, { autoAlpha: 1, scale: 1, rotation: -3, duration: 0.6, ease: 'elastic.out(1,.5)' }, s72 + 0.2);
      c.ft('.s7-title', { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 0.4, duration: 0.35, ease: 'back.in(1.6)' }, e72 - 0.1);
      const pyu = c.char('#s7-pyu', { x: 0, y: 0, s: 1.05 });
      const pting = c.char('#s7-pting', { x: 0, y: 0, s: 1.05, flip: true });
      const peekL = c.mover('.s7-peekL', { x: -260, rotation: 22 });
      const peekR = c.mover('.s7-peekR', { x: 260, rotation: -22 });
      peekL.to(s72 + 0.4, 0.6, { x: 60, rotation: 16 }, 'back.out(1.5)');
      peekR.to(s72 + 0.6, 0.6, { x: -60, rotation: -16 }, 'back.out(1.5)');
      pyu.idle(s72, T1); pting.idle(s72, T1);
      armProp(c, pyu, 'R', -150, s72 + 0.9, 0.4); armProp(c, pting, 'R', -150, s72 + 1.1, 0.4);
      pyu.eyesTo(s72 + 0.9, 's'); pting.eyesTo(s72 + 1.1, 's');
      pyu.mouthTo(s72 + 0.9, 's'); pting.mouthTo(s72 + 1.1, 's');
      c.ft(c.qa('.s7-peekL .flag, .s7-peekR .flag'), { rotation: -6 }, { rotation: 6, duration: 0.5, repeat: Math.floor((c.s('s7-11') - s72) / 0.5) | 1, yoyo: true, ease: 'sine.inOut' }, s72 + 1.3);
      // ---- C: four fill-in-the-blank cards ----
      const cards = c.qa('.q-card');
      c.init('.s7-prog', { autoAlpha: 0, y: -40 });
      c.ft('.s7-prog', { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, c.s('s7-3') - 0.6);
      c.init(c.qa('.s7-star'), { scale: 0, autoAlpha: 0 });
      cards.forEach((cd) => c.init(cd, { autoAlpha: 0, x: 1100 }));
      c.init(c.qa('.q-back'), { scaleX: 0 });
      c.init(c.qa('.q-think i'), { scale: 0.4, autoAlpha: 0.3 });
      const pairs = [['s7-3', 's7-4'], ['s7-5', 's7-6'], ['s7-7', 's7-8'], ['s7-9', 's7-10']];
      pairs.forEach(([qid, aid], k) => {
        const Q = c.C(qid), Acue = c.C(aid), cd = cards[k];
        c.ft(cd, { autoAlpha: 0, x: 1100, rotation: 6 }, { autoAlpha: 1, x: 0, rotation: k % 2 ? 1 : -1, duration: 0.6, ease: 'back.out(1.2)' }, Q.start - 0.35);
        const tiles = cd.querySelectorAll('.q-tile');
        c.ft(tiles, { scale: 1 }, { scale: 1.07, duration: 0.35, repeat: Math.max(1, Math.floor((Acue.start - Q.end) / 0.35)) | 1, yoyo: true, ease: 'sine.inOut' }, Q.end - 0.1);
        cd.querySelectorAll('.q-think i').forEach((dot, j) => c.ft(dot, { scale: 0.4, autoAlpha: 0.3 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)' }, Q.end + 0.2 + j * ((Acue.start - Q.end - 0.4) / 3)));
        tiles.forEach((tile) => {
          const w = tile.getAttribute('data-w');
          const idx = Acue.text.indexOf(w);
          const t = G.tAt(Acue, Math.max(0, idx)) - 0.12;
          c.ft(tile.querySelector('.q-front'), { scaleX: 1 }, { scaleX: 0, duration: 0.14, ease: 'power2.in' }, t);
          c.ft(tile.querySelector('.q-back'), { scaleX: 0 }, { scaleX: 1, duration: 0.24, ease: 'back.out(2)' }, t + 0.14);
          c.ft(tile, { y: 0 }, { y: -16, duration: 0.15, repeat: 1, yoyo: true }, t + 0.14);
        });
        c.ft(cd, { scale: 1 }, { scale: 1.04, duration: 0.25, repeat: 1, yoyo: true }, Acue.end - 0.6);
        [pyu, pting].forEach((ch, i) => ch.hop(Acue.start + 0.3 + i * 0.1, 2, 36, 0.2));
        c.pop('.s7-star' + k, Acue.end - 0.5, { r0: -180, d: 0.7, ease: 'back.out(2.2)' });
        if (k < 3) c.ft(cd, { x: 0, autoAlpha: 1 }, { x: -1100, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, pairs[k + 1] && c.s(pairs[k + 1][0]) - 0.4);
      });
      // ---- D: full poem returns, confetti ----
      const e710 = c.e('s7-10'), s711 = c.s('s7-11');
      c.ft(cards[3], { x: 0, autoAlpha: 1 }, { x: -1100, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, e710 - 0.2);
      c.ft('.s7-prog', { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -60, duration: 0.4, ease: 'power2.in' }, e710 + 0.2);
      peekL.to(e710 - 0.2, 0.5, { x: -300 }, 'power2.in');
      peekR.to(e710 - 0.2, 0.5, { x: 300 }, 'power2.in');
      c.ft(poem, { autoAlpha: 0, y: -60, scale: 1 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.3)' }, e710 + 0.1);
      c.ft(c.qa('.s7-poem .rc b'), { color: P.ink }, { color: P.red, duration: 0.3, stagger: 0.012 }, e710 + 0.3);
      c.set('.s7-confetti', { autoAlpha: 1 }, e710 - 0.1);
      c.qa('.s7-cf').forEach((p) => {
        const r = +p.getAttribute('data-r'), s = +p.getAttribute('data-s');
        const t = e710 - 0.1 + r * 1.2, d = 2.6 + s * 1.6;
        c.ft(p, { y: -80 - r * 200, x: 0, rotation: 0 }, { y: 2050, x: (s - 0.5) * 260, rotation: (r - 0.5) * 900, duration: d, ease: 'power1.in' }, t);
      });
      // ---- E: badge ----
      c.ft(poem, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0.15, scale: 0.94, duration: 0.4 }, s711 - 0.2);
      c.ft('.s7-medal', { autoAlpha: 0, scale: 0, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.8, ease: 'elastic.out(1,.55)' }, s711);
      c.ft('.s7-medal .s7-rays', { rotation: 0 }, { rotation: 90, duration: 8, ease: 'none' }, s711);
      c.init('.s7-medal .spark', { scale: 0, autoAlpha: 0 });
      c.qa('.s7-medal .spark').forEach((sp, i) => c.ft(sp, { scale: 0, autoAlpha: 0 }, { scale: 1.2, autoAlpha: 1, duration: 0.4, repeat: 5, yoyo: true, ease: 'sine.inOut' }, s711 + 0.4 + i * 0.1));
      // ---- F: farewell end card ----
      const s712 = c.s('s7-12');
      c.ft(poem, { autoAlpha: 0.15 }, { autoAlpha: 0, duration: 0.3 }, s712 - 0.5);
      c.ft('.s7-end', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, s712 - 0.5);
      c.ft('.s7-medal', { scale: 1, x: 0, y: 0 }, { scale: 0.34, x: 380, y: -650, duration: 0.7, ease: 'power2.inOut' }, s712 - 0.5);
      const yu = c.char('#s7-yu', { x: 360, y: 1440 }), ting = c.char('#s7-ting', { x: 720, y: 1440, flip: true });
      yu.idle(s712 - 0.6, T1 + 1); ting.idle(s712 - 0.6, T1 + 1);
      yu.mouthTo(s712 - 0.5, 's'); ting.mouthTo(s712 - 0.5, 's');
      yu.wave(s712 + 0.1, 4, 'L');
      yu.eyesTo(s712 + 0.1, 'h');
      ting.wave(c.s('s7-13') - 0.1, 3, 'L');
      ting.eyesTo(c.s('s7-13'), 'h');
      const s714 = c.s('s7-14');
      yu.hop(s714 + 0.2, 2, 40, 0.24); ting.hop(s714 + 0.3, 2, 40, 0.24);
      yu.wave(s714 + 1.3, 4, 'R'); ting.wave(s714 + 1.3, 4, 'R');
      c.ft('.s7-ec1', { x: 0 }, { x: 80, duration: T1 - s712 + 1, ease: 'none' }, s712 - 0.6);
      c.init('.s7-fade', { opacity: 0 });
      c.ft('.s7-fade', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'sine.inOut' }, T1 - 1.7);
      c.ft('.s7-endtitle', { y: 0, scale: 1 }, { y: 520, scale: 1.12, duration: 1.4, ease: 'sine.inOut' }, T1 - 1.7);
      c.ft('.s7-medal', { x: 380, y: -650, scale: 0.34 }, { x: 0, y: 330, scale: 0.42, duration: 1.4, ease: 'sine.inOut' }, T1 - 1.7);
      c.talker('s7-12', yu); c.talker('s7-13', ting);
      c.talker('rest:s7-12', 's'); c.talker('rest:s7-13', 's');
    }
  };
})();
