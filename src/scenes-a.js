/* 過故人莊 — scenes s0 片頭, s1 邀請, s2 路上, s3 開窗.
 * Each scene: svg(sc,data) → markup inside a 1080×1920 <svg>; anim(ctx) → tweens on the master timeline. */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P, A = G.A, T = G.T;
  const S = (G.scenes = G.scenes || {});

  const sky = (h, fill) => `<rect width="1080" height="${h || 1920}" fill="${fill || 'url(#gSky)'}"/>`;
  const cloud = (x, y, s, cls, op) => A(x, y, `<use href="#cloud" transform="scale(${s})" opacity="${op || 0.95}"/>`, cls || '');
  const sun = (x, y, r, cls) => A(x, y, `<circle r="${r * 1.5}" fill="url(#gGlow)" opacity=".7"/><circle r="${r}" fill="url(#gSun)"/>`, cls || '');
  G.sky = sky; G.cloud = cloud; G.sunAt = sun;

  /** gently curved horizontal field bands with perspective spacing */
  function bands(y0, n, colors, w, curve) {
    let s = '', y = y0;
    w = w || 1080; curve = curve == null ? 46 : curve;
    for (let i = 0; i < n; i++) {
      const h = 30 + i * 9;
      s += `<path d="M0 ${y}Q${w / 2} ${y - curve} ${w} ${y}V${y + h}Q${w / 2} ${y + h - curve} 0 ${y + h}Z" fill="${colors[i % colors.length]}"/>`;
      y += h + 26 + i * 12;
    }
    return s;
  }
  G.bands = bands;
  /** rolling hills strip [0,w] */
  function hillStrip(w, base, amp, step, fill, seed) {
    const R = G.rng(seed || 1);
    let d = `M0 ${base}`;
    for (let x = 0; x < w; x += step) {
      const peak = base - amp * (0.55 + R() * 0.45);
      d += `Q${x + step / 2} ${G.r(peak)} ${x + step} ${base + (R() - 0.5) * 30}`;
    }
    return `<path d="${d}V1920H0Z" fill="${fill}"/>`;
  }
  G.hillStrip = hillStrip;
  const fence = (x0, x1, y, step) => {
    let s = `<rect x="${x0}" y="${y + 22}" width="${x1 - x0}" height="12" rx="6" fill="${P.wood}"/><rect x="${x0}" y="${y + 58}" width="${x1 - x0}" height="12" rx="6" fill="${P.wood}"/>`;
    for (let x = x0 + 8; x < x1; x += step) s += `<rect x="${x}" y="${y}" width="18" height="98" rx="8" fill="${P.wood2}"/>`;
    return `<g filter="url(#ps)">${s}</g>`;
  };
  G.fence = fence;
  const gardenRows = (x, y, cols, rows, dx, dy, s) => {
    let o = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) o += T(x + c * dx + (r % 2) * dx / 2, y + r * dy, s, (r + c) % 3 === 2 ? '<use href="#radish"/>' : '<use href="#cabbage"/>');
    return o;
  };
  G.gardenRows = gardenRows;
  const tagLabel = (x, y, text, cls, o) => A(x, y, G.label(text, Object.assign({ fs: 72, bg: P.red, color: '#fff', w: 120 }, o || {})), cls);
  G.tagLabel = tagLabel;

  /* =========================== s0 片頭 =========================== */
  S.s0 = {
    svg() {
      const title = ['過', '故', '人', '莊'];
      return `
      ${sky()}
      ${sun(880, 300, 76, 's0-sun')}
      ${cloud(210, 300, 1.15, 's0-c1')}${cloud(840, 560, 0.8, 's0-c2')}${cloud(560, 170, 0.6, 's0-c3', 0.8)}
      <path d="M0 1050Q130 930 270 990Q420 880 580 980Q720 870 880 970Q990 920 1080 975V1920H0Z" fill="${P.hill}"/>
      <path d="M0 1110Q170 1020 340 1080Q530 990 710 1090Q890 1030 1080 1070V1920H0Z" fill="${P.hill2}"/>
      <path d="M0 1180Q540 1116 1080 1180V1920H0Z" fill="${P.green2}"/>
      ${bands(1228, 7, [P.gold, P.green3])}
      ${T(705, 1222, 0.42, G.tree({ tone: 'light' }))}${T(1000, 1230, 0.4, G.tree())}
      ${T(850, 1226, 0.36, G.farmhouse())}
      ${T(150, 1236, 0.5, G.tree())}
      ${A(540, 560, `
        <clipPath id="s0-clip"><rect class="s0-cliprect" x="0" y="-262" width="0" height="524"/></clipPath>
        <g clip-path="url(#s0-clip)">
          <rect x="-392" y="-250" width="784" height="500" rx="10" fill="${P.paper}"/>
          <rect x="-362" y="-222" width="724" height="444" rx="8" fill="none" stroke="${P.red}" stroke-width="5" opacity=".55"/>
          <path d="M-392 -250H392" stroke="${P.paper2}" stroke-width="10"/>
          ${title.map((ch, i) => A(-270 + i * 180, 0, `<circle class="s0-tdot" r="80" fill="${P.millet}" opacity=".8"/><text class="kai s0-tt" x="0" y="58" text-anchor="middle" font-size="172" font-weight="700" fill="${P.ink}">${ch}</text>`, 's0-tch')).join('')}
          <g class="s0-author"><text class="kai" x="248" y="188" text-anchor="end" font-size="48" fill="${P.ink2}">唐・孟浩然</text></g>
          ${A(306, 172, `<rect x="-30" y="-30" width="60" height="60" rx="9" fill="${P.red}"/><text class="kai" y="15" text-anchor="middle" font-size="42" fill="${P.paper}">孟</text>`, 's0-seal')}
        </g>
        ${A(0, 0, `<rect x="-24" y="-282" width="48" height="564" rx="18" fill="${P.wood2}"/><rect x="-14" y="-270" width="10" height="540" rx="5" fill="${P.wood}" opacity=".6"/><circle cy="-298" r="22" fill="${P.wood}"/><circle cy="298" r="22" fill="${P.wood}"/>`, 's0-rollL')}
        ${A(0, 0, `<rect x="-24" y="-282" width="48" height="564" rx="18" fill="${P.wood2}"/><rect x="4" y="-270" width="10" height="540" rx="5" fill="${P.wood}" opacity=".6"/><circle cy="-298" r="22" fill="${P.wood}"/><circle cy="298" r="22" fill="${P.wood}"/>`, 's0-rollR')}
      `, 's0-scroll', 'filter="url(#ps2)"')}
      ${A(-140, 230, G.bird({ id: 's0-birdin' }), 's0-bird')}
      ${G.poet({ id: 's0-poet' })}
      ${G.kid('yu', { id: 's0-yu' })}
      ${G.kid('ting', { id: 's0-ting', pack: true })}`;
    },
    anim(c) {
      const T1 = c.T1, e01 = c.e('s0-1'), s02 = c.s('s0-2');
      c.ft('.s0-c1', { x: 0 }, { x: 110, duration: T1, ease: 'none' }, 0);
      c.ft('.s0-c2', { x: 0 }, { x: -90, duration: T1, ease: 'none' }, 0);
      c.ft('.s0-c3', { x: 0 }, { x: 60, duration: T1, ease: 'none' }, 0);
      c.loop('.s0-sun', 'scale', 1, 1.07, 0, T1, 2.2);
      // scroll unrolls
      c.init('.s0-scroll', { scale: 0.7, autoAlpha: 0 });
      c.ft('.s0-scroll', { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.05);
      c.ft('.s0-rollL', { x: 0 }, { x: -394, duration: 1.5, ease: 'power2.inOut' }, 0.45);
      c.ft('.s0-rollR', { x: 0 }, { x: 394, duration: 1.5, ease: 'power2.inOut' }, 0.45);
      c.ft('.s0-cliprect', { attr: { x: 0, width: 0 } }, { attr: { x: -394, width: 788 }, duration: 1.5, ease: 'power2.inOut' }, 0.45);
      c.init('.s0-tdot', { scale: 0, autoAlpha: 0 });
      c.qa('.s0-tch').forEach((el, i) => {
        c.init(el, { autoAlpha: 0, y: -120, scale: 1.5 });
        c.ft(el, { autoAlpha: 0, y: -120, scale: 1.5 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' }, 1.5 + i * 0.3);
      });
      c.fadeIn('.s0-author', 2.9, 0.5);
      c.init('.s0-seal', { autoAlpha: 0, scale: 2.6, rotation: -26 });
      c.ft('.s0-seal', { autoAlpha: 0, scale: 2.6, rotation: -26 }, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.32, ease: 'power4.in' }, 3.3);
      c.ft('.s0-scroll', { y: 0 }, { y: 8, duration: 0.12, repeat: 1, yoyo: true, ease: 'power1.out' }, 3.62);
      // bird crosses the sky
      const bird = c.mover('.s0-bird', { x: 0, y: 0 });
      bird.to(2.2, 6, { x: 1380 }, 'none');
      c.loop('#s0-birdin .bird-bob', 'y', -14, 14, 2.2, 8.2, 0.45);
      c.flap('#s0-birdin', 2.2, 8.2);
      // 孟浩然 paper puppet pops up, waves, bows, sinks
      const poet = c.char('#s0-poet', { x: 250, y: 2560, s: 0.95 });
      const tP = c.w('s0-1', '孟浩然') - 0.8;
      poet.moveTo(tP, 0.9, 250, 1452, 'back.out(1.2)');
      poet.idle(tP, e01 + 0.5);
      poet.wave(tP + 0.9, 3, 'R');
      const tB = c.w('s0-1', '寫下了');
      poet.lean(tB, 9, 0.5).lean(tB + 1.0, 0, 0.5);
      poet.moveTo(e01 - 0.3, 0.8, 250, 2560, 'power2.in');
      c.set('#s0-poet', { autoAlpha: 0 }, e01 + 0.6);
      // s0-2: scroll shrinks into the header band
      c.ft('.s0-scroll', { y: 0, scale: 1 }, { y: -340, scale: 0.56, duration: 0.9, ease: 'power2.inOut' }, s02 - 0.5);
      const words = [['過', [0]], ['故人', [1, 2]], ['莊', [3]]];
      const tch = c.qa('.s0-tch');
      words.forEach(([w, idxs]) => {
        const t = c.w('s0-2', w) - 0.15;
        idxs.forEach((i) => {
          c.ft(tch[i].querySelector('.s0-tdot'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 0.85, duration: 0.45, ease: 'back.out(2)' }, t);
          c.ft(tch[i].querySelector('text'), { fill: P.ink }, { fill: P.red, duration: 0.3 }, t);
          c.ft(tch[i], { rotation: 0 }, { rotation: -8, duration: 0.15, repeat: 3, yoyo: true }, t);
        });
      });
      const tAll = G.tWord(c.C('s0-2'), '過故人莊', 'last') || c.at('s0-2', 0.5);
      c.ft(tch, { scale: 1 }, { scale: 1.16, duration: 0.2, repeat: 1, yoyo: true, ease: 'sine.inOut', stagger: 0.14 }, tAll);
      // the two friends hop in
      const yu = c.char('#s0-yu', { x: -170, y: 1440 });
      const ting = c.char('#s0-ting', { x: 1250, y: 1440, flip: true });
      const tK = c.w('s0-2', '小玉和阿庭') - 0.3;
      yu.jumpTo(tK, 0.55, 90, 1440, 120); yu.jumpTo(tK + 0.62, 0.55, 320, 1440, 120);
      ting.jumpTo(tK + 0.3, 0.55, 990, 1440, 120); ting.jumpTo(tK + 0.92, 0.55, 760, 1440, 120);
      yu.mouthTo(tK + 1.2, 's'); ting.mouthTo(tK + 1.4, 's');
      yu.wave(tK + 1.3, 4, 'R'); ting.wave(tK + 1.6, 4, 'R');
      yu.idle(tK + 1.2, T1 + 1); ting.idle(tK + 1.5, T1 + 1);
      yu.eyesTo(c.e('s0-2') - 1.2, 'h'); ting.eyesTo(c.e('s0-2') - 1.0, 'h');
    }
  };

  /* =========================== s1 邀請 =========================== */
  S.s1 = {
    svg() {
      const R = G.rng(101);
      // ---- yard ----
      const photo = `<g transform="rotate(-5)">
          <rect x="-196" y="-156" width="392" height="312" rx="16" fill="${P.wood2}"/>
          <rect x="-174" y="-134" width="348" height="268" fill="${P.sky2}"/>
          <path d="M-174 60Q0 30 174 60V134H-174Z" fill="${P.green3}"/>
          ${T(-62, 128, 0.42, G.kid('yu', { id: 's1-pyu' }))}${T(62, 128, 0.42, G.kid('ting', { id: 's1-pting' }))}
          <rect x="-64" y="-176" width="128" height="40" fill="${P.millet}" opacity=".75" transform="rotate(5)"/>
        </g>
        ${T(0, 214, 1, G.label('故人＝老朋友', { fs: 48, bg: P.paper, color: P.red, w: 360 }))}`;
      const yard = `<g class="s1-yard"><g class="s1-camY">
        ${sky(1120)}
        ${cloud(220, 230, 1.0, 's1-yc1')}${cloud(860, 400, 0.72, 's1-yc2')}
        <path d="M0 900Q180 780 380 860Q560 760 760 850Q920 790 1080 840V1120H0Z" fill="${P.hill}"/>
        <path d="M0 960Q240 880 480 940Q700 870 1080 930V1120H0Z" fill="${P.hill2}"/>
        <rect y="1010" width="1080" height="120" fill="${P.green2}"/>
        ${T(300, 1010, 0.95, G.tree())}${T(970, 1022, 0.9, G.tree({ tone: 'light' }))}${T(130, 1046, 0.72, G.tree({ tone: 'light' }))}
        <path d="M0 1080Q540 1040 1080 1080V1920H0Z" fill="${P.yard}"/>
        ${T(640, 1102, 1, G.farmhouse())}
        ${fence(0, 330, 1130, 54)}
        <rect x="748" y="1196" width="360" height="250" rx="34" fill="${P.wood}"/>
        ${gardenRows(806, 1262, 3, 3, 96, 70, 0.78)}
        ${A(170, 1330, G.chicken({ id: 's1-ch1' }), 's1-ch1A', 'transform="scale(-.95,.95)"')}
        ${A(300, 1238, G.chicken({ id: 's1-ch2' }), 's1-ch2A', 'transform="scale(.75)"')}
        ${A(640, 1392, G.chicken({ id: 's1-ch3' }), 's1-ch3A', 'transform="scale(.85)"')}
        ${G.kid('yu', { id: 's1-yu', propR: `<g class="yu-letter" transform="translate(14,-8) rotate(-20)">${G.envelope(74, 52)}</g>` })}
        ${A(440, 950, G.lightbulb(), 's1-bulb')}
        ${A(1260, 640, G.bird({ id: 's1-bird', letter: true }), 's1-birdA')}
        </g>
        ${A(282, 380, photo, 's1-photo')}
      </g>`;
      // ---- kitchen ----
      const kitchen = `<g class="s1-kitchen">
        <rect width="1080" height="1300" fill="${P.paper2}"/><rect width="1080" height="1300" fill="url(#pDots)"/>
        <g transform="translate(850,520)" filter="url(#ps)"><rect x="-150" y="-130" width="300" height="260" rx="14" fill="${P.wood2}"/><rect x="-128" y="-108" width="256" height="216" fill="${P.sky1}"/><path d="M-128 40Q0-10 128 40V108H-128Z" fill="${P.hill}"/><path d="M-128 80Q0 50 128 80V108H-128Z" fill="${P.green2}"/><path d="M0-108V108M-128 0H128" stroke="${P.wood2}" stroke-width="10"/></g>
        <g filter="url(#ps)"><path d="M90 150Q300 200 520 150" stroke="${P.wood2}" stroke-width="6" fill="none"/>
          ${[130, 200, 270, 340, 410, 480].map((x, i) => `<g transform="translate(${x},${Math.round(160 + Math.sin(i * 1.3) * 10 + 22)}) rotate(${(i % 2 ? 8 : -6)})">${i % 3 === 1
            ? `<ellipse cy="40" rx="20" ry="48" fill="${P.millet}"/><path d="M-20 0C-20 30 0 40 0 40C0 40 20 30 20 0" fill="${P.green2}"/>`
            : `<path d="M-10 0C-14 40-6 70 4 84C10 60 12 30 10 0Z" fill="${P.red}"/><rect x="-6" y="-8" width="12" height="12" rx="4" fill="${P.green}"/>`}</g>`).join('')}</g>
        <rect x="560" y="640" width="200" height="16" rx="6" fill="${P.wood2}"/>
        <g filter="url(#ps)"><rect x="578" y="572" width="54" height="68" rx="14" fill="${P.earth}"/><rect x="646" y="556" width="46" height="84" rx="12" fill="${P.blue}"/><rect x="706" y="590" width="40" height="50" rx="10" fill="${P.red}"/></g>
        <rect y="980" width="1080" height="320" fill="url(#pPlank)"/>
        <rect y="1300" width="1080" height="620" fill="${P.wood2}"/>
        ${[1380, 1500, 1660, 1840].map((y) => `<rect y="${y}" width="1080" height="5" fill="${P.wood}" opacity=".45"/>`).join('')}
        <g transform="translate(250,1300)" filter="url(#ps)">
          <rect x="-236" y="-404" width="472" height="404" rx="18" fill="${P.earth}"/><rect x="-236" y="-404" width="472" height="404" rx="18" fill="url(#pBrick)"/>
          <rect x="-256" y="-430" width="512" height="44" rx="14" fill="${P.ink2}"/>
          <path d="M-84 0V-130Q0-214 84-130V0Z" fill="${P.ink}"/>
          ${A(0, -20, `<path d="M-60 0C-70-60-30-80-20-120C0-80 10-110 4-150C40-110 60-70 60 0Z" fill="${P.mum2}"/><path d="M-36 0C-40-40-14-56-8-84C8-56 30-60 36 0Z" fill="${P.mum}"/><path d="M-14 0C-14-20 0-30 0-44C10-28 16-18 14 0Z" fill="${P.millet}"/>`, 's1-fire')}
        </g>
        <g transform="translate(250,872)"><ellipse rx="160" ry="26" fill="${P.ink}"/></g>
        ${A(250, 866, `<path d="M-136 0Q0-118 136 0Z" fill="${P.wood}"/><path d="M-136 0Q0-118 136 0" fill="none" stroke="${P.wood2}" stroke-width="8"/><rect x="-18" y="-108" width="36" height="28" rx="9" fill="${P.wood2}"/>`, 's1-lid', 'filter="url(#ps)"')}
        ${[[190, 760, 1], [250, 740, 1.15], [318, 770, 0.95]].map(([x, y, s], i) => A(x, y, `<g transform="scale(${s})">${G.steam('', 150, '#fff')}</g>`, `s1-steam s1-steam${i}`)).join('')}
        ${A(250, 820, `${G.steam('', 220, '#fff').replace('stroke-width="10"', 'stroke-width="18"')}<g transform="translate(-60,20)">${G.steam('', 160, '#fff')}</g><g transform="translate(60,20)">${G.steam('', 170, '#fff')}</g>`, 's1-puff')}
        <g filter="url(#ps)"><rect x="560" y="1150" width="540" height="48" rx="12" fill="${P.wood}"/><rect x="580" y="1196" width="520" height="40" fill="${P.wood2}"/>
          <rect x="606" y="1230" width="32" height="220" fill="${P.wood2}"/><rect x="1010" y="1230" width="32" height="220" fill="${P.wood2}"/></g>
        ${A(730, 1150, G.plateChicken(1.1), 's1-plate')}
        ${A(940, 1118, G.bowlMillet(1.05), 's1-bowl')}
        ${A(440, 1050, `<circle r="58" fill="${P.green3}" stroke="${P.paper}" stroke-width="8"/><path d="M-28 0L-8 22L30-22" stroke="${P.green}" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="s1-checkp"/>`, 's1-check', 'filter="url(#ps)"')}
        ${G.kid('yu', { id: 's1-kyu' })}
        ${A(790, 800, `<clipPath id="s1-lensclip"><circle r="160"/></clipPath>
          <rect x="-16" y="150" width="34" height="170" rx="15" fill="${P.wood2}" transform="rotate(-38)"/>
          <g clip-path="url(#s1-lensclip)"><rect x="-170" y="-170" width="340" height="340" fill="url(#pGrainBig)"/></g>
          <circle r="160" fill="none" stroke="${P.paper2}" stroke-width="24"/><circle r="172" fill="none" stroke="${P.wood2}" stroke-width="7"/>
          <path d="M-104-50Q-84-108-30-128" stroke="#fff" stroke-width="16" opacity=".65" fill="none" stroke-linecap="round"/>`, 's1-mag', 'filter="url(#ps2)"')}
      </g>`;
      // ---- journey (parallax) ----
      let jmid = `<rect y="1000" width="3900" height="920" fill="${P.green2}"/>`;
      // paddy terraces: long gently-waving bands in perspective
      [[1040, 46, P.gold], [1120, 58, P.green3], [1218, 72, P.gold], [1340, 90, P.green3], [1490, 110, P.gold], [1670, 130, P.green3]].forEach(([y, h, col], i) => {
        let d = `M0 ${y}`;
        for (let x = 0; x < 2400; x += 400) d += `Q${x + 200} ${y + (i % 2 ? -22 : 22)} ${x + 400} ${y}`;
        d += `V${y + h}`;
        for (let x = 2400; x > 0; x -= 400) d += `Q${x - 200} ${y + h + (i % 2 ? -22 : 22)} ${x - 400} ${y + h}`;
        jmid += `<path d="${d}Z" fill="${col}"/>`;
      });
      jmid += `<path d="M1700 1000C1560 1180 1860 1380 1700 1580C1590 1720 1760 1840 1700 1920" stroke="${P.hill2}" stroke-width="150" fill="none"/>
               <path d="M1700 1000C1560 1180 1860 1380 1700 1580C1590 1720 1760 1840 1700 1920" stroke="${P.sky1}" stroke-width="96" fill="none"/>
               <path d="M1690 1120c20 10 40 10 60 0M1730 1400c20 10 40 10 60 0M1650 1660c20 10 40 10 60 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/>`;
      [[300, 1050, 0.8], [760, 1040, 0.9], [1180, 1060, 0.75], [2050, 1040, 0.85], [2260, 1060, 0.7]].forEach(([x, y, s]) => (jmid += T(x, y, s, G.tree({ tone: R() > 0.5 ? 'light' : 'dark' }))));
      jmid += `<rect x="2380" y="1260" width="1520" height="660" fill="${P.paper2}"/>`;
      [[2520, 1270, 220, 170], [2790, 1260, 200, 200], [3060, 1268, 230, 160], [3700, 1266, 220, 180]].forEach(([x, y, w, h], i) => (jmid += T(x, y, 1, G.roofHouse(w, h, i % 2 ? P.red : P.ink2))));
      jmid += T(3330, 1300, 1.5, G.townhouse());
      const journey = `<g class="s1-journey">${sky()}${sun(860, 260, 64)}${cloud(300, 330, 0.9, 's1-jc1')}${cloud(760, 520, 0.6, 's1-jc2')}${cloud(120, 640, 0.5, 's1-jc3')}
        <g class="s1-jfar">${hillStrip(3200, 1000, 150, 300, P.hill, 3)}${hillStrip(3200, 1040, 90, 220, P.hill2, 5)}</g>
        <g class="s1-jmid">${jmid}</g>
        ${A(360, 700, `<g transform="scale(1.5)">${G.bird({ id: 's1-jbird', letter: true })}</g>`, 's1-jbirdA')}
      </g>`;
      // ---- 阿庭's room ----
      const books = [P.red, P.blue, P.gold, P.green, P.mum2, P.hill2, P.red, P.green2];
      const room = `<g class="s1-room">
        <rect width="1080" height="1300" fill="${P.paper2}"/><rect width="1080" height="1300" fill="url(#pDots)"/>
        <rect y="1000" width="1080" height="300" fill="${P.hill}" opacity=".35"/>
        <rect y="1290" width="1080" height="630" fill="${P.wood}"/>${[1400, 1560, 1760].map((y) => `<rect y="${y}" width="1080" height="5" fill="${P.wood2}" opacity=".4"/>`).join('')}
        <rect y="1282" width="1080" height="18" fill="${P.wood2}"/>
        <g transform="translate(250,620)" filter="url(#ps)"><rect x="-210" y="-210" width="420" height="400" rx="16" fill="${P.wood2}"/><rect x="-186" y="-186" width="372" height="352" fill="${P.sky1}"/>
          ${T(-90, 160, 0.5, G.roofHouse(200, 160, P.red))}${T(110, 166, 0.45, G.roofHouse(220, 170, P.ink2))}
          <path d="M0-186V166M-186-10H186" stroke="${P.wood2}" stroke-width="12"/><rect x="-236" y="166" width="472" height="34" rx="10" fill="${P.wood}"/></g>
        <g filter="url(#ps)"><rect x="790" y="760" width="260" height="540" rx="10" fill="${P.wood}"/>
          ${[0, 1, 2].map((r) => `<rect x="806" y="${790 + r * 160}" width="228" height="140" fill="${P.wood2}"/>${[0, 1, 2, 3, 4].map((b) => `<rect x="${816 + b * 42}" y="${800 + r * 160 + (b % 2) * 14}" width="34" height="${126 - (b % 2) * 14}" rx="5" fill="${books[(r * 3 + b) % books.length]}"/>`).join('')}`).join('')}</g>
        <circle cx="902" cy="560" r="10" fill="${P.wood2}"/>
        ${A(902, 640, `<path d="M-40-70Q0-110 40-70" stroke="${P.mum}" stroke-width="12" fill="none"/><rect x="-66" y="-72" width="132" height="140" rx="32" fill="${P.gold}"/><rect x="-52" y="-10" width="104" height="46" rx="14" fill="${P.mum}"/>`, 's1-hookpack', 'filter="url(#ps)"')}
        ${A(330, 790, G.bird({ id: 's1-rbird', letter: true }), 's1-rbirdA')}
        ${G.kid('ting', { id: 's1-ting' })}
        ${A(540, 690, `<rect x="-420" y="-262" width="840" height="524" rx="26" fill="#fff"/>
          <rect x="-396" y="-238" width="792" height="476" rx="18" fill="none" stroke="${P.paper2}" stroke-width="6"/>
          ${A(-336, 0, `<rect x="0" y="0" width="124" height="66" rx="12" fill="${P.millet}"/>`, 's1-hl1')}
          ${A(12, 0, `<rect x="0" y="0" width="124" height="66" rx="12" fill="${P.millet}"/>`, 's1-hl2')}
          <text class="kai" font-size="58" fill="${P.ink}"><tspan x="-330" y="-122">阿庭：</tspan><tspan x="-330" y="-24">我準備了雞肉和黍飯，</tspan><tspan x="-330" y="52">邀請你到我家田家作客！</tspan><tspan x="200" y="170">小玉</tspan></text>
          <g transform="translate(340,150) scale(.7)"><use href="#heart" fill="${P.red}"/></g>`, 's1-letter', 'filter="url(#ps2)"')}
      </g>`;
      // ---- map for s1-8 ----
      const map = `<g class="s1-map">
        ${sky(1000)}${cloud(250, 260, 0.8, 's1-mc1')}${cloud(820, 200, 0.6, 's1-mc2')}
        <path d="M0 980Q200 880 420 950Q640 860 860 940Q980 900 1080 930V1920H0Z" fill="${P.hill}"/>
        <path d="M0 1040Q540 990 1080 1040V1920H0Z" fill="${P.green2}"/>
        ${bands(1090, 6, [P.green3, P.gold], 1080, 30)}
        <path class="s1-road" d="M170 1290C330 1420 470 1120 640 1250C760 1340 820 1200 880 1200" stroke="${P.yard}" stroke-width="46" fill="none" stroke-linecap="round" pathLength="1"/>
        ${T(160, 1300, 0.62, G.townhouse({ win: false }))}
        ${T(890, 1240, 0.56, G.farmhouse())}
        ${T(720, 1180, 0.5, G.tree())}${T(1030, 1250, 0.45, G.tree({ tone: 'light' }))}
        ${A(880, 1010, `<path d="M-30-40L0 0L30-40Z" fill="${P.red}"/><circle cy="-60" r="34" fill="${P.red}"/><circle cy="-60" r="14" fill="#fff"/>`, 's1-pin')}
        ${G.kid('ting', { id: 's1-mting', pack: true })}
        ${A(170, 980, G.bird({ id: 's1-mbird', letter: true }), 's1-mbirdA')}
      </g>`;
      return yard + kitchen + journey + room + map;
    },
    anim(c) {
      const T1 = c.T1;
      ['.s1-kitchen', '.s1-journey', '.s1-room', '.s1-map'].forEach((s) => c.init(s, { autoAlpha: 0 }));
      // ---------- s1-1 yard ----------
      const yu = c.char('#s1-yu', { x: 440, y: 1440 });
      c.init('#s1-yu .yu-letter', { autoAlpha: 0 });
      yu.idle(c.T0, c.e('s1-2') + 0.5);
      yu.idle(c.s('s1-5') - 0.4, c.e('s1-5') + 0.5);
      c.ft('.s1-yc1', { x: 0 }, { x: 80, duration: T1 - c.T0, ease: 'none' }, c.T0);
      c.ft('.s1-yc2', { x: 0 }, { x: -60, duration: T1 - c.T0, ease: 'none' }, c.T0);
      // chickens peck & strut
      ['#s1-ch1', '#s1-ch2', '#s1-ch3'].forEach((id, i) => {
        const head = c.q(id + ' .chick-head');
        let t = c.T0 + 0.3 + i * 0.7;
        while (t < c.e('s1-1') + 0.5) {
          c.ft(head, { rotation: 0 }, { rotation: -38, duration: 0.16, repeat: 3, yoyo: true, ease: 'power1.inOut' }, G.r(t));
          t += 1.9 + i * 0.35;
        }
      });
      c.ft('.s1-ch1A', { x: 0 }, { x: 70, duration: 2.4, repeat: 3, yoyo: true, ease: 'sine.inOut' }, c.T0 + 0.5);
      c.ft('.s1-ch3A', { x: 0 }, { x: -60, duration: 2.0, repeat: 3, yoyo: true, ease: 'sine.inOut' }, c.T0 + 1.2);
      const tChick = c.w('s1-1', '好多雞');
      c.ft('#s1-ch2 .chick-body', { y: 0 }, { y: -26, duration: 0.18, repeat: 3, yoyo: true, ease: 'power2.out' }, tChick);
      c.ft('#s1-ch3 .chick-body', { y: 0 }, { y: -22, duration: 0.18, repeat: 3, yoyo: true, ease: 'power2.out' }, tChick + 0.15);
      yu.hop(c.s('s1-1') + 0.4, 1, 40);
      // photo of the two old friends
      gsap.set(c.q('#s1-pyu .armR'), { rotation: -38 });
      gsap.set(c.q('#s1-pting .armL'), { rotation: 38 });
      c.set(['#s1-pyu .eyes', '#s1-pting .eyes'].map((s) => c.q(s)), { attr: { 'data-e': 'h' } }, c.T0 + 0.1);
      c.set(['#s1-pyu .mouth', '#s1-pting .mouth'].map((s) => c.q(s)), { attr: { 'data-m': 's' } }, c.T0 + 0.1);
      const tPhoto = c.w('s1-1', '從小就是好朋友') - 0.2;
      c.pop('.s1-photo', tPhoto, { r0: -20, d: 0.6 });
      c.ft('.s1-photo', { rotation: 0 }, { rotation: 3, duration: 1.2, repeat: 3, yoyo: true, ease: 'sine.inOut' }, tPhoto + 0.6);
      c.unpop('.s1-photo', c.s('s1-2') - 0.2);
      // ---------- s1-2 close-up + lightbulb ----------
      const cam = c.mover('.s1-camY', { x: 0, y: 0, scale: 1 });
      const s12 = c.s('s1-2'), e12 = c.e('s1-2');
      cam.to(s12 - 0.35, 0.9, c.camState(440, 1150, 1.7, 540, 820));
      yu.eyesTo(s12 + 0.25, 's');
      c.pop('.s1-bulb', s12 + 0.7, { d: 0.55, ease: 'elastic.out(1,.5)', y0: 40 });
      c.ft('.s1-bulb .rays', { rotation: 0, scale: 0.8 }, { rotation: 45, scale: 1.15, duration: 0.8, repeat: Math.floor((e12 - s12) / 0.8), yoyo: true, ease: 'sine.inOut' }, s12 + 0.9);
      yu.hop(s12 + 1.4, 2, 34, 0.22);
      yu.arm(s12 + 1.4, 'L', 150, 0.3).arm(s12 + 2.6, 'L', 12, 0.4, 'power2.inOut');
      c.unpop('.s1-bulb', e12 - 0.15);
      yu.eyesTo(e12 + 0.1, 'n');
      c.talker('s1-2', yu);
      // ---------- s1-3 kitchen ----------
      const s13 = c.s('s1-3'), e13 = c.e('s1-3');
      c.cut('.s1-yard', '.s1-kitchen', s13 - 0.45, 0.5);
      const kyu = c.char('#s1-kyu', { x: 300, y: 1440 });
      kyu.idle(s13 - 0.5, c.e('s1-4') + 0.5);
      // fire flicker + steam loops through the kitchen shots
      c.ft('.s1-fire', { scaleY: 1, scaleX: 1 }, { scaleY: 1.18, scaleX: 0.92, duration: 0.22, repeat: Math.floor((c.e('s1-4') - s13 + 1) / 0.22) | 1, yoyo: true, ease: 'sine.inOut' }, s13 - 0.5);
      c.qa('.s1-steam').forEach((el, i) => {
        c.init(el, { autoAlpha: 0 });
        c.ft(el, { y: 0, autoAlpha: 0.9, scaleX: 1 }, { y: -110, autoAlpha: 0, scaleX: 1.35, duration: 1.7, repeat: Math.floor((c.e('s1-4') - s13 + 1) / 1.7), ease: 'none' }, s13 - 0.5 + i * 0.55);
      });
      c.init('.s1-puff', { autoAlpha: 0, scale: 0.6 });
      const tChicken = c.w('s1-3', '雞肉');
      kyu.walk(tChicken - 0.9, tChicken + 0.1, 0.3); kyu.moveTo(tChicken - 0.9, 1.0, 560, null, 'sine.inOut');
      c.pop('.s1-plate', tChicken, { y0: -60, d: 0.55 });
      kyu.hop(tChicken + 0.2, 1, 30);
      const tMillet = c.w('s1-3', '蒸了');
      kyu.walk(tMillet - 1.2, tMillet - 0.2, 0.3); kyu.moveTo(tMillet - 1.2, 1.0, 330, null, 'sine.inOut');
      c.ft('.s1-lid', { y: 0, rotation: 0 }, { y: -90, rotation: -16, duration: 0.45, ease: 'back.out(2)' }, tMillet);
      c.ft('.s1-puff', { autoAlpha: 0, scale: 0.6, y: 0 }, { autoAlpha: 1, scale: 1.1, y: -60, duration: 0.6, ease: 'power2.out' }, tMillet + 0.05);
      c.ft('.s1-puff', { autoAlpha: 1, y: -60 }, { autoAlpha: 0, y: -160, duration: 0.9, ease: 'power1.in' }, tMillet + 0.65);
      c.ft('.s1-lid', { y: -90, rotation: -16 }, { y: 0, rotation: 0, duration: 0.4, ease: 'bounce.out' }, tMillet + 1.4);
      kyu.walk(tMillet + 0.9, tMillet + 1.9, 0.3); kyu.moveTo(tMillet + 0.9, 1.0, 600, null, 'sine.inOut');
      c.pop('.s1-bowl', tMillet + 1.6, { y0: -60, d: 0.55 });
      kyu.eyesTo(tMillet + 1.9, 'h'); kyu.mouthTo(tMillet + 1.9, 's');
      const tShu = c.w('s1-3', '「黍」') - 0.2;
      c.pop('.s1-mag', tShu, { d: 0.6, r0: -30 });
      c.ft('.s1-mag', { x: 0, y: 0 }, { x: 18, y: -14, duration: 1.1, repeat: 3, yoyo: true, ease: 'sine.inOut' }, tShu + 0.6);
      c.unpop('.s1-mag', c.w('s1-3', '「雞黍」') - 0.55);
      // ---------- s1-4 ready! ----------
      const s14 = c.s('s1-4');
      c.pop('.s1-check', s14 + 0.1, { d: 0.45 });
      c.draw('.s1-checkp', s14 + 0.4, 0.45, { ease: 'power2.out' });
      kyu.hop(s14 + 0.3, 2, 36, 0.22);
      kyu.arm(s14 + 0.3, 'L', 150, 0.3).arm(s14 + 1.6, 'L', 12, 0.4, 'power2.inOut');
      kyu.arm(s14 + 0.3, 'R', -150, 0.3).arm(s14 + 1.6, 'R', -12, 0.4, 'power2.inOut');
      c.recite({ cue: 's1-4', line: 0, half: 0, word: '「具雞黍」' });
      // ---------- s1-5 letter + bird ----------
      const s15 = c.s('s1-5'), e15 = c.e('s1-5');
      cam.to(s15 - 1.0, 0.1, c.camState(560, 1080, 1.28, 540, 860));
      yu.eyesTo(s15 - 0.9, 'n'); yu.mouthTo(s15 - 0.9, 'c');
      c.cut('.s1-kitchen', '.s1-yard', s15 - 0.45, 0.5);
      c.set('#s1-yu .yu-letter', { autoAlpha: 1 }, s15 - 0.4);
      yu.arm(s15 + 0.1, 'R', -150, 0.4);
      const bird = c.mover('.s1-birdA', { x: 0, y: 0 });
      c.flap('#s1-bird', s15 + 0.2, e15 + 0.6);
      c.init('#s1-bird .bird-letter', { autoAlpha: 0 });
      bird.to(s15 + 0.2, 1.6, { x: -640, y: 440 }, 'power2.out');
      const tGrab = s15 + 2.0;
      c.set('#s1-yu .yu-letter', { autoAlpha: 0 }, tGrab);
      c.set('#s1-bird .bird-letter', { autoAlpha: 1 }, tGrab);
      bird.to(tGrab + 0.15, 1.6, { x: 60, y: -260 }, 'power2.in');
      yu.arm(tGrab + 0.2, 'R', -12, 0.4, 'power2.inOut');
      yu.wave(tGrab + 0.7, 3, 'L');
      c.talker('s1-5', yu);
      // ---------- s1-6 journey ----------
      const s16 = c.s('s1-6'), e16 = c.e('s1-6');
      c.cut('.s1-yard', '.s1-journey', s16 - 0.45, 0.5);
      const pan0 = s16 - 0.45, panD = e16 + 0.2 - pan0;
      c.ft('.s1-jfar', { x: 0 }, { x: -900, duration: panD, ease: 'sine.inOut' }, pan0);
      c.ft('.s1-jmid', { x: 0 }, { x: -2690, duration: panD, ease: 'sine.inOut' }, pan0);
      c.ft('.s1-jc1', { x: 0 }, { x: -260, duration: panD, ease: 'none' }, pan0);
      const jb = c.mover('.s1-jbirdA', { x: 0, y: 0 });
      c.flap('#s1-jbird', pan0, e16 + 0.3);
      c.ft('#s1-jbird .bird-bob', { y: -24 }, { y: 24, duration: 0.5, repeat: Math.floor(panD / 0.5) - 2, yoyo: true, ease: 'sine.inOut' }, pan0);
      c.ft('.s1-jc2', { x: 0 }, { x: -420, duration: panD, ease: 'none' }, pan0);
      c.ft('.s1-jc3', { x: 0 }, { x: -340, duration: panD, ease: 'none' }, pan0);
      jb.to(e16 - 1.4, 1.5, { x: 450, y: 470, scale: 0.75 }, 'power2.inOut');
      // ---------- s1-7 阿庭 reads the letter ----------
      const s17 = c.s('s1-7'), e17 = c.e('s1-7');
      c.cut('.s1-journey', '.s1-room', s17 - 0.35, 0.45);
      const ting = c.char('#s1-ting', { x: 600, y: 1440, flip: true });
      ting.idle(s17 - 0.4, e17 + 0.5);
      ting.eyesTo(s17 + 0.05, 's');
      ting.hop(s17 + 0.1, 1, 50);
      c.ft('#s1-rbird .bird-bob', { y: 0 }, { y: -10, duration: 0.3, repeat: 7, yoyo: true, ease: 'sine.inOut' }, s17);
      c.ft('#s1-rbird .wing', { rotation: 50 }, { rotation: 20, duration: 0.2, repeat: 3, yoyo: true }, s17 + 0.2);
      c.init('#s1-rbird .wing', { rotation: 50 });
      c.init(['.s1-hl1', '.s1-hl2'].map((s) => c.q(s)), { scaleX: 0 });
      const tOpen = s17 + 0.9;
      c.set('#s1-rbird .bird-letter', { autoAlpha: 0 }, tOpen);
      c.pop('.s1-letter', tOpen, { s0: 0.1, d: 0.6, ease: 'back.out(1.3)', r0: 12, r: -2 });
      c.ft('.s1-hl1', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power2.out' }, c.w('s1-7', '邀請') - 0.1);
      c.ft('.s1-hl2', { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: 'power2.out' }, c.w('s1-7', '田家') - 0.1);
      const tGo = c.w('s1-7', '太棒了') - 0.25;
      c.unpop('.s1-letter', tGo, { d: 0.35 });
      ting.eyesTo(tGo, 'h');
      ting.hop(tGo + 0.2, 2, 70, 0.24);
      ting.arm(tGo + 0.2, 'L', 150, 0.3).arm(tGo + 1.3, 'L', 12, 0.4, 'power2.inOut');
      ting.arm(tGo + 0.2, 'R', -150, 0.3).arm(tGo + 1.3, 'R', -12, 0.4, 'power2.inOut');
      const pk = c.mover('.s1-hookpack', { x: 0, y: 0, rotation: 0, scale: 1 });
      const tPk = c.w('s1-7', '馬上出發') - 0.3;
      pk.to(tPk, 0.55, { x: -300, y: 560, rotation: -200, scale: 0.7 }, 'power2.in');
      c.set('.s1-hookpack', { autoAlpha: 0 }, tPk + 0.55);
      ting.pack(tPk + 0.55, true);
      ting.hop(tPk + 0.55, 1, 40, 0.2);
      c.talker('s1-7', ting);
      // ---------- s1-8 map ----------
      const s18 = c.s('s1-8'), e18 = c.e('s1-8');
      c.cut('.s1-room', '.s1-map', s18 - 0.4, 0.5);
      c.draw('.s1-road', s18, 2.4);
      c.pop('.s1-pin', c.w('s1-8', '「至」'), { y0: -80, ease: 'bounce.out', d: 0.7 });
      const mt = c.char('#s1-mting', { x: 170, y: 1290, s: 0.4 });
      mt.idle(s18 - 0.4, e18 + 0.5);
      const pts = [[300, 1330], [450, 1240], [560, 1200], [700, 1270], [800, 1250], [860, 1210]];
      let tw = s18 + 0.6;
      const stepD = (e18 - 3.2 - tw) / pts.length;
      mt.walk(tw, tw + stepD * pts.length, 0.3);
      pts.forEach(([x, y]) => { mt.moveTo(tw, stepD, x, y, 'none'); tw += stepD; });
      mt.eyesTo(tw, 'h'); mt.hop(tw + 0.1, 2, 50, 0.2);
      const mb = c.mover('.s1-mbirdA', { x: 0, y: 0 });
      c.flap('#s1-mbird', s18 - 0.4, e18);
      mb.to(s18, e18 - s18 - 2.6, { x: 640, y: 40 }, 'sine.inOut');
      c.ft('#s1-mbird .bird-bob', { y: -20 }, { y: 20, duration: 0.6, repeat: Math.floor((e18 - s18) / 0.6), yoyo: true, ease: 'sine.inOut' }, s18 - 0.4);
      c.ft('.s1-mc1', { x: 0 }, { x: 70, duration: e18 - s18 + 1, ease: 'none' }, s18 - 0.4);
      c.card('s1-8', { top: 520 });
    }
  };

  /* =========================== s2 路上 =========================== */
  S.s2 = {
    svg() {
      // walk shot layers
      let near = `<rect y="1320" width="3800" height="600" fill="${P.green3}"/><rect y="1376" width="3800" height="190" fill="${P.yard}"/>`;
      const R = G.rng(202);
      for (let x = 60; x < 3800; x += 300) near += `<g filter="url(#ps)"><rect x="${x}" y="1240" width="20" height="120" rx="8" fill="${P.wood2}"/><rect x="${x - 40}" y="1270" width="300" height="12" rx="6" fill="${P.wood}"/></g>`;
      for (let i = 0; i < 26; i++) {
        const x = i * 146 + R() * 60, y = 1600 + R() * 260;
        near += T(x, y, 0.9 + R() * 0.6, '<use href="#grass"/>');
        if (i % 3 === 0) near += `<circle cx="${x + 40}" cy="${1700 + R() * 160}" r="${9 + R() * 6}" fill="${[P.mum, P.red, '#fff'][i % 3]}"/>`;
        if (i % 2 === 0) near += `<ellipse cx="${x + 80}" cy="${1420 + R() * 120}" rx="${14 + R() * 10}" ry="${8 + R() * 4}" fill="${P.paper2}"/>`;
      }
      let mid = `<rect y="1100" width="3200" height="260" fill="${P.green2}"/>`;
      for (let i = 0; i < 14; i++) mid += `<rect x="${i * 230}" y="${1120 + (i % 2) * 60}" width="200" height="70" rx="14" fill="${i % 2 ? P.gold : P.green3}"/>`;
      [[200, 1110], [640, 1120], [1100, 1105], [1500, 1115], [1950, 1110], [2400, 1120]].forEach(([x, y], i) => (mid += T(x, y, 0.55 + (i % 2) * 0.1, G.tree({ tone: i % 2 ? 'light' : 'dark' }))));
      const village = `${T(-130, 0, 0.62, G.tree())}${T(150, 0, 0.6, G.tree({ tone: 'light' }))}${T(-40, 4, 1, G.roofHouse(120, 90, P.ink2, P.earth))}${T(70, 8, 1, G.roofHouse(110, 80, P.red, P.paper2))}${T(10, 10, 0.5, G.tree())}`;
      const walk = `<g class="s2-walk">${sky()}${sun(180, 300, 70)}
        ${cloud(720, 260, 0.95, 's2-wc1')}${cloud(300, 440, 0.7, 's2-wc2')}
        <g class="s2-wfar">${hillStrip(2600, 980, 160, 320, P.hill, 21)}${hillStrip(2600, 1040, 100, 240, P.hill2, 22)}</g>
        ${A(860, 1104, village, 's2-vil')}
        <g class="s2-wmid">${mid}</g>
        <g class="s2-wnear">${near}</g>
        ${G.kid('ting', { id: 's2-ting', pack: true })}
      </g>`;
      // overview
      const cx = 540, cy = 1150;
      const treeRing = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        treeRing.push({ i, x: cx + Math.cos(a) * 330, y: cy + 30 + Math.sin(a) * 190 });
      }
      const sorted = treeRing.slice().sort((a, b) => a.y - b.y);
      let arms = '';
      for (let i = 0; i < 10; i++) {
        const a = treeRing[i], b = treeRing[(i + 1) % 10];
        const ax = a.x, ay = a.y - 70, bx = b.x, by = b.y - 70;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const ox = mx - cx, oy = my - cy;
        const L = Math.hypot(ox, oy) || 1;
        const qx = mx + (ox / L) * 50, qy = my + (oy / L) * 36 - 12;
        arms += `<path class="s2-arm s2-arm${i}" d="M${G.r(ax)} ${G.r(ay)}Q${G.r(qx)} ${G.r(qy)} ${G.r(bx)} ${G.r(by)}" stroke="${P.green}" stroke-width="22" fill="none" stroke-linecap="round" pathLength="1"/>`;
        arms += A(qx * 0.5 + mx * 0.5, qy * 0.5 + my * 0.5 + 2, `<circle r="19" fill="${P.green2}" stroke="${P.green}" stroke-width="5"/>`, `s2-hand s2-hand${i}`);
      }
      const houses = [[460, 1120, P.ink2, P.earth], [630, 1112, P.red, P.paper2], [540, 1210, P.ink2, P.paper2], [400, 1220, P.red, P.earth], [690, 1222, P.ink2, P.earth]]
        .map(([x, y, r, w]) => T(x, y, 1, G.roofHouse(110, 76, r, w))).join('');
      const giant = `<g transform="rotate(-24)">
          <path d="M-90 0Q-62-26-34 0M34 0Q62-26 90 0" stroke="${P.ink}" stroke-width="10" fill="none" stroke-linecap="round"/>
          <path d="M-36 60Q0 92 36 60" stroke="${P.ink}" stroke-width="10" fill="none" stroke-linecap="round"/>
          <ellipse cx="-120" cy="44" rx="34" ry="18" fill="${P.blush}" opacity=".8"/><ellipse cx="120" cy="44" rx="34" ry="18" fill="${P.blush}" opacity=".8"/>
        </g>`;
      const over = `<g class="s2-over"><g class="s2-cam">
        ${sky(1000)}${cloud(200, 170, 0.8, 's2-oc1')}${cloud(900, 120, 0.6, 's2-oc2')}
        <g class="s2-mtn"><path d="M-80 800C200 720 520 560 780 420C900 352 1010 300 1160 262V980H-80Z" fill="${P.hill}"/>
          <path d="M-80 870C300 820 720 660 1160 560V990H-80Z" fill="${P.hill2}"/>
          ${[[150, 760, 0.5], [260, 720, 0.42], [420, 650, 0.46], [960, 330, 0.36], [1040, 300, 0.32]].map(([x, y, sc]) => T(x, y, sc, `<path d="M0-150L60 0H-60Z" fill="${P.green}"/><path d="M0-200L44-90H-44Z" fill="${P.green}"/><rect x="-8" y="0" width="16" height="24" fill="${P.wood2}"/>`)).join('')}
          ${A(640, 600, `<g transform="scale(1.45)">${giant}</g>`, 's2-giant')}</g>
        <clipPath id="s2-dashclip"><rect class="s2-dashrect" x="0" y="0" width="0" height="1000"/></clipPath>
        <path d="M30 760C300 680 560 540 790 404C900 344 1000 300 1120 266" stroke="${P.red}" stroke-width="12" fill="none" stroke-dasharray="26 20" stroke-linecap="round" clip-path="url(#s2-dashclip)"/>
        ${A(860, 220, `<text class="kai" font-size="64" font-weight="700" fill="${P.hill2}" stroke="${P.paper}" stroke-width="6" paint-order="stroke">Z</text>`, 's2-z s2-z0')}
        ${A(920, 160, `<text class="kai" font-size="80" font-weight="700" fill="${P.hill2}" stroke="${P.paper}" stroke-width="6" paint-order="stroke">Z</text>`, 's2-z s2-z1')}
        ${A(990, 90, `<text class="kai" font-size="96" font-weight="700" fill="${P.hill2}" stroke="${P.paper}" stroke-width="6" paint-order="stroke">Z</text>`, 's2-z s2-z2')}
        <path d="M-40 900Q540 860 1120 900V1920H-40Z" fill="${P.green3}"/>
        ${bands(1440, 4, [P.gold, P.green2], 1080, 20)}
        <ellipse class="s2-wallglow" cx="${cx}" cy="${cy}" rx="482" ry="276" fill="none" stroke="${P.millet}" stroke-width="64" opacity="0"/>
        <ellipse cx="${cx}" cy="${cy + 6}" rx="482" ry="276" fill="none" stroke="${P.wood}" stroke-width="40"/>
        <ellipse cx="${cx}" cy="${cy}" rx="482" ry="276" fill="none" stroke="${P.earth}" stroke-width="36"/>
        <ellipse cx="${cx}" cy="${cy - 10}" rx="482" ry="276" fill="none" stroke="${P.gold}" stroke-width="10" stroke-dasharray="24 30"/>
        <ellipse cx="${cx}" cy="${cy + 30}" rx="400" ry="230" fill="${P.green2}"/>
        ${houses}
        ${arms}
        ${sorted.map((t) => A(t.x, t.y, G.tree({ face: true, tone: t.i % 2 ? 'light' : 'dark' }).replace('class="tree"', 'class="tree" transform="scale(.56)"'), `s2-tree s2-tree${t.i}`)).join('')}
        ${A(cx, cy - 10, `<use href="#heart" fill="${P.red}" transform="scale(1.6)"/>`, 's2-heart', 'filter="url(#ps2)"')}
        ${tagLabel(120, 900, '郭', 's2-tagGuo')}
        ${tagLabel(940, 330, '斜', 's2-tagXie')}
      </g></g>`;
      const portrait = A(150, 1310, `<circle r="128" fill="${P.paper}" stroke="${P.blue}" stroke-width="10"/>
        <clipPath id="s2-pclip"><circle r="118"/></clipPath>
        <g clip-path="url(#s2-pclip)"><rect x="-130" y="-130" width="260" height="260" fill="${P.sky2}"/><rect x="-130" y="60" width="260" height="80" fill="${P.green3}"/>${G.kid('ting', { id: 's2-pting', pack: true })}</g>`, 's2-portrait', 'filter="url(#ps2)"');
      return walk + over + portrait;
    },
    anim(c) {
      const T0 = c.T0, T1 = c.T1;
      const s21 = c.s('s2-1'), e21 = c.e('s2-1'), s22 = c.s('s2-2');
      c.init('.s2-over', { autoAlpha: 0 });
      // ---- walking with parallax ----
      const ting = c.char('#s2-ting', { x: 420, y: 1480 });
      gsap.set(ting.eyes, { x: 9 }); ting.st.ex = 9;
      ting.idle(T0, s22 + 0.5);
      const w0 = T0 + 0.1, w1 = s22 + 0.2;
      ting.walk(w0, w1, 0.34);
      c.ft('.s2-wfar', { x: 0 }, { x: -260, duration: w1 - w0, ease: 'none' }, w0);
      c.ft('.s2-wmid', { x: 0 }, { x: -760, duration: w1 - w0, ease: 'none' }, w0);
      c.ft('.s2-wnear', { x: 0 }, { x: -1900, duration: w1 - w0, ease: 'none' }, w0);
      c.ft('.s2-wc1', { x: 0 }, { x: -80, duration: w1 - w0, ease: 'none' }, w0);
      c.ft('.s2-vil', { scale: 0.5 }, { scale: 1.05, duration: w1 - w0, ease: 'sine.in' }, w0);
      ting.eyesTo(c.w('s2-1', '看見了'), 's');
      ting.tilt(c.w('s2-1', '看見了'), -6, 0.4);
      // ---- overview: trees ring the village ----
      c.cut('.s2-walk', '.s2-over', s22 - 0.45, 0.6);
      const cam = c.mover('.s2-cam', c.camState(540, 1170, 1.55, 540, 1080));
      cam.to(s22 - 0.45, 1.8, c.camState(540, 1170, 1.3, 540, 1100), 'power2.out');
      const trees = [];
      for (let i = 0; i < 10; i++) trees.push(c.q('.s2-tree' + i));
      trees.forEach((el, i) => c.pop(el, s22 + 0.3 + i * 0.3, { r0: -25, d: 0.5, ease: 'back.out(2)' }));
      const tArms = s22 + 0.3 + 10 * 0.3 + 0.1;
      for (let i = 0; i < 10; i++) {
        c.draw('.s2-arm' + i, tArms + i * 0.2, 0.35, { ease: 'power2.out' });
        c.pop('.s2-hand' + i, tArms + i * 0.2 + 0.3, { d: 0.3 });
      }
      const s23 = c.s('s2-3'), e23 = c.e('s2-3');
      trees.forEach((el, i) => c.ft(el, { rotation: 0 }, { rotation: i % 2 ? 4 : -4, duration: 0.9, repeat: Math.max(1, Math.floor((e23 - s23) / 0.9)) | 1, yoyo: true, ease: 'sine.inOut' }, s23));
      c.pop('.s2-heart', c.w('s2-3', '擁抱') - 0.4, { d: 0.7, ease: 'elastic.out(1,.45)' });
      c.ft('.s2-heart', { scale: 1 }, { scale: 1.15, duration: 0.35, repeat: 5, yoyo: true, ease: 'sine.inOut' }, c.w('s2-3', '擁抱') + 0.4);
      c.unpop('.s2-heart', e23 + 0.1);
      c.card('s2-3', { top: 290 });
      c.recite({ cue: 's2-3', line: 1, half: 0, word: '綠樹村邊合' });
      // ---- 郭 and 斜 ----
      const s24 = c.s('s2-4');
      cam.to(s24 - 0.3, 2.2, { x: 0, y: 0, scale: 1 }, 'power2.inOut');
      const tGuo = c.w('s2-4', '「郭」') - 0.2;
      c.ft('.s2-wallglow', { opacity: 0 }, { opacity: 0.9, duration: 0.45, repeat: 5, yoyo: true, ease: 'sine.inOut' }, tGuo);
      c.pop('.s2-tagGuo', tGuo, { d: 0.5, r0: -20, r: -6 });
      const tXie = c.w('s2-4', '斜斜地') - 0.3;
      c.ft('.s2-dashrect', { attr: { width: 0 } }, { attr: { width: 1100 }, duration: 1.6, ease: 'power1.inOut' }, tXie);
      c.pop('.s2-tagXie', tXie + 1.2, { d: 0.5, r0: 20, r: 8 });
      // ---- sleeping giant ----
      const s25 = c.s('s2-5'), e26 = c.e('s2-6');
      c.fadeIn('.s2-giant', s25 + 0.1, 0.6);
      c.ft('.s2-mtn', { scaleY: 1 }, { scaleY: 1.012, duration: 1.4, repeat: Math.floor((e26 - s25) / 1.4) | 1, yoyo: true, ease: 'sine.inOut' }, s25);
      gsap.set(c.q('.s2-mtn'), { svgOrigin: '540 990' });
      c.qa('.s2-z').forEach((z, i) => {
        c.init(z, { autoAlpha: 0, y: 30, scale: 0.6 });
        for (let t = s25 + 0.6 + i * 0.4; t < e26 - 1.6; t += 2.6) {
          c.ft(z, { autoAlpha: 0, y: 30, scale: 0.6 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' }, t);
          c.ft(z, { autoAlpha: 1, y: 0, scale: 1 }, { autoAlpha: 0, y: -40, scale: 0.6, duration: 0.8, ease: 'sine.in' }, t + 1.2);
        }
      });
      // ---- 阿庭 portrait while he speaks off-screen ----
      const pt = c.char('#s2-pting', { x: 0, y: 250, s: 0.82 });
      pt.idle(s22 - 0.4, e26);
      c.init('.s2-portrait', { autoAlpha: 0, scale: 0 });
      [['s2-2', 'h'], ['s2-5', 's']].forEach(([id, eye]) => {
        c.ft('.s2-portrait', { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, c.s(id) - 0.3);
        pt.eyesTo(c.s(id), eye);
        c.ft('.s2-portrait', { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 0, duration: 0.3, ease: 'back.in(1.6)' }, c.e(id) + 0.1);
      });
      c.talker('阿庭', pt);
    }
  };

  /* =========================== s3 開窗 =========================== */
  S.s3 = {
    svg() {
      const lantern = `<path d="M0-90V-50" stroke="${P.wood2}" stroke-width="5"/><rect x="-24" y="-54" width="48" height="14" rx="5" fill="${P.gold}"/>
        <ellipse rx="62" ry="78" fill="${P.red}"/><path d="M-30-70Q-44 0-30 70M30-70Q44 0 30 70M0-78V78" stroke="#A8432F" stroke-width="5" fill="none"/>
        <rect x="-24" y="66" width="48" height="14" rx="5" fill="${P.gold}"/><path d="M-8 80V120M0 80V126M8 80V120" stroke="${P.gold}" stroke-width="5"/>`;
      const door = `<g class="s3-door">
        <rect width="1080" height="1440" fill="${P.earth}"/><rect width="1080" height="1440" fill="url(#pBrick)"/>
        <rect width="1080" height="250" fill="url(#pTileD)"/><rect y="240" width="1080" height="26" fill="${P.ink}"/>
        ${A(150, 400, lantern, 's3-lan1', 'filter="url(#ps)"')}${A(930, 400, lantern, 's3-lan2', 'filter="url(#ps)"')}
        <g filter="url(#ps)"><rect x="170" y="540" width="500" height="910" rx="10" fill="${P.wood2}"/>
          <rect x="204" y="574" width="432" height="866" fill="#3E2C1C"/>
          <path d="M204 574L150 520V1480L204 1440Z" fill="${P.wood}"/><path d="M636 574L690 520V1480L636 1440Z" fill="${P.wood}"/>
          <rect x="96" y="560" width="54" height="600" rx="6" fill="${P.red}"/><rect x="690" y="560" width="54" height="600" rx="6" fill="${P.red}"/>
          ${[640, 760, 880, 1000, 1120].map((y) => `<rect x="114" y="${y}" width="18" height="18" fill="${P.gold}" transform="rotate(45 123 ${y + 9})"/><rect x="708" y="${y}" width="18" height="18" fill="${P.gold}" transform="rotate(45 717 ${y + 9})"/>`).join('')}
          <rect x="300" y="470" width="240" height="64" rx="10" fill="${P.red}"/><text class="kai" x="420" y="518" text-anchor="middle" font-size="46" fill="${P.gold}">小玉家</text></g>
        <rect y="1430" width="1080" height="490" fill="${P.yard}"/><rect x="150" y="1424" width="540" height="22" rx="8" fill="${P.ink2}"/>
        ${T(960, 1440, 1, `<path d="M-60 0L-48-80H48L60 0Z" fill="${P.red}"/><rect x="-66" y="-92" width="132" height="20" rx="8" fill="#A8432F"/>`)}
        ${A(960, 1350, `<circle cx="-30" cy="-30" r="50" fill="${P.green}"/><circle cx="34" cy="-36" r="46" fill="${P.green}"/><circle cy="-70" r="46" fill="${P.green2}"/>${[[-40, -60], [10, -90], [40, -40], [-10, -30]].map(([x, y]) => T(x, y, 0.3, '<use href="#mumBud"/>')).join('')}`, 's3-pot')}
        ${G.kid('yu', { id: 's3-yu' })}
        ${G.kid('ting', { id: 's3-ting', pack: true })}
        ${A(568, 1140, `<g class="burst">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M0-40L10-120L-10-120Z" fill="${P.gold}" transform="rotate(${i * 45})"/>`).join('')}</g><circle r="44" fill="${P.millet}"/><text class="kai" x="0" y="-150" text-anchor="middle" font-size="88" font-weight="700" fill="${P.red}">啪！</text>`, 's3-burst')}
        ${[0, 1, 2].map((i) => `<path class="s3-aroma s3-aroma${i}" d="M${300 + i * 30} ${1000 + i * 60}C${400 + i * 20} ${930 + i * 50} ${460} ${1080 + i * 30} ${560 + i * 10} ${1010 + i * 40}S${640} ${1000 + i * 30} ${690} ${1060 + i * 20}" stroke="${[P.mum2, P.gold, P.mum][i]}" stroke-width="12" fill="none" stroke-linecap="round" pathLength="1"/>`).join('')}
        ${[0, 1, 2].map((i) => A(720 + i * 60, 960 - i * 40, `<use href="#heart" fill="${P.red}" transform="scale(${0.6 - i * 0.12})"/>`, `s3-love s3-love${i}`)).join('')}
      </g>`;
      // room with lattice window
      const leaf = (sgn) => `<rect x="${sgn > 0 ? 0 : -340}" y="0" width="340" height="720" fill="url(#pLattice)"/><rect x="${sgn > 0 ? 0 : -340}" y="0" width="340" height="720" fill="none" stroke="${P.wood2}" stroke-width="22"/>
        <rect x="${sgn > 0 ? 30 : -310}" y="300" width="280" height="120" fill="none" stroke="${P.wood2}" stroke-width="10"/><circle cx="${sgn * 300}" cy="360" r="12" fill="${P.gold}"/>`;
      const view = `<clipPath id="s3-winclip"><rect x="200" y="360" width="680" height="720"/></clipPath>
        <g clip-path="url(#s3-winclip)">
          ${sky(1100)}${cloud(380, 470, 0.6)}${sun(760, 470, 44)}
          <path d="M200 700Q400 600 600 680Q760 620 880 660V1080H200Z" fill="${P.hill}"/>
          <path d="M200 760Q540 700 880 750V1080H200Z" fill="${P.green2}"/>
          <path class="s3-yard" d="M200 820Q360 790 520 806V1080H200Z" fill="url(#pYard)"/>
          ${T(300, 1030, 0.9, G.chicken({ id: 's3-chick' }))}
          <g transform="translate(450,880) rotate(28)"><rect x="-6" y="0" width="12" height="150" rx="5" fill="${P.wood}"/><rect x="-36" y="146" width="72" height="12" rx="5" fill="${P.wood2}"/>${[-30, -15, 0, 15, 30].map((x) => `<rect x="${x - 2.5}" y="156" width="5" height="18" fill="${P.wood2}"/>`).join('')}</g>
          <path d="M520 806L560 800V1080H520Z" fill="${P.yard}"/>
          <path d="M560 800Q720 784 880 800V1080H560Z" fill="${P.wood}"/>
          ${gardenRows(600, 860, 3, 3, 96, 76, 0.8)}
        </g>`;
      const room = `<g class="s3-room"><g class="s3-cam">
        <rect width="1080" height="1360" fill="url(#pPlank)"/>
        <rect y="1340" width="1080" height="900" fill="${P.wood2}"/>${[1440, 1600, 1800, 2000].map((y) => `<rect y="${y}" width="1080" height="5" fill="${P.wood}" opacity=".5"/>`).join('')}
        <rect y="1330" width="1080" height="20" fill="#5E3B1B"/>
        <rect class="s3-winframe" x="168" y="328" width="744" height="784" rx="22" fill="${P.wood2}" filter="url(#ps2)"/>
        <rect class="s3-winglow" x="150" y="310" width="780" height="820" rx="30" fill="none" stroke="${P.millet}" stroke-width="20" opacity="0"/>
        ${view}
        <rect x="200" y="360" width="680" height="720" fill="#3E2C1C" class="s3-dark"/>
        <path class="s3-rays" d="M200 1080H880L1100 1920H-20Z" fill="${P.millet}" opacity="0"/>
        <rect class="s3-hlA" x="206" y="790" width="316" height="284" rx="26" fill="none" stroke="${P.millet}" stroke-width="16"/>
        <rect class="s3-hlB" x="556" y="784" width="318" height="290" rx="26" fill="none" stroke="${P.millet}" stroke-width="16"/>
        ${A(200, 360, leaf(1), 's3-leafL')}${A(880, 360, leaf(-1), 's3-leafR')}
        <rect x="150" y="1088" width="780" height="40" rx="12" fill="${P.wood}" filter="url(#ps)"/>
        ${tagLabel(362, 740, '場', 's3-tagA')}${tagLabel(716, 734, '圃', 's3-tagB')}
        ${G.kid('yu', { id: 's3-ryu' })}
        ${G.kid('ting', { id: 's3-rting', pack: true })}
      </g>
      ${A(900, 300, `<path d="M-150 0L-110-50L-130-110L-60-90L-10-140L30-90L100-120L100-60L160-30L110 20L140 80L60 70L20 130L-30 80L-100 110L-100 50Z" fill="${P.paper}" stroke="${P.red}" stroke-width="8" stroke-linejoin="round"/><text class="kai" y="20" text-anchor="middle" font-size="76" font-weight="700" fill="${P.red}">嘎吱</text>`, 's3-creak', 'filter="url(#ps2)"')}
      </g>`;
      return door + room;
    },
    anim(c) {
      const T0 = c.T0;
      c.init('.s3-room', { autoAlpha: 0 });
      const s31 = c.s('s3-1'), e31 = c.e('s3-1'), s32 = c.s('s3-2'), e32 = c.e('s3-2');
      c.ft('.s3-lan1', { rotation: -5 }, { rotation: 5, duration: 1.3, repeat: 5, yoyo: true, ease: 'sine.inOut' }, T0);
      c.ft('.s3-lan2', { rotation: 4 }, { rotation: -4, duration: 1.2, repeat: 5, yoyo: true, ease: 'sine.inOut' }, T0);
      // 小玉 bursts out of the door, 阿庭 walks in
      const yu = c.char('#s3-yu', { x: 420, y: 1400, s: 0.82 });
      c.init('#s3-yu', { autoAlpha: 0 });
      c.ft('#s3-yu', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, s31 - 0.1);
      yu.walk(s31 - 0.1, s31 + 0.8, 0.22);
      yu.moveTo(s31 - 0.1, 0.9, 430, 1446, 'power2.out'); yu.scaleTo(s31 - 0.1, 0.9, 1, 'power2.out');
      yu.idle(s31, c.e('s3-2') + 0.5);
      const ting = c.char('#s3-ting', { x: 1260, y: 1446, flip: true });
      ting.walk(T0, s31 + 0.6, 0.3);
      ting.moveTo(T0, s31 + 0.6 - T0, 700, null, 'power1.out');
      ting.idle(T0, e32 + 0.5);
      const tHi = c.w('s3-1', '快進來') - 0.4;
      yu.arm(tHi, 'R', -150, 0.3); ting.arm(tHi, 'R', -150, 0.3);
      c.pop('.s3-burst', tHi + 0.3, { d: 0.4, ease: 'back.out(3)', r0: -30 });
      c.ft('.s3-burst .burst', { rotation: 0 }, { rotation: 30, duration: 1.2, ease: 'none' }, tHi + 0.3);
      c.unpop('.s3-burst', tHi + 1.3);
      yu.hop(tHi + 0.3, 1, 40); ting.hop(tHi + 0.35, 1, 40);
      yu.arm(tHi + 1.0, 'R', -12, 0.4, 'power2.inOut'); ting.arm(tHi + 1.0, 'R', -12, 0.4, 'power2.inOut');
      yu.eyesTo(tHi + 0.3, 'h'); ting.eyesTo(tHi + 0.3, 'h');
      c.talker('s3-1', yu);
      // 阿庭 sniffs the yummy smell
      c.qa('.s3-aroma').forEach((p, i) => {
        c.draw(p, s32 - 0.4 + i * 0.2, 0.8, { ease: 'sine.out' });
        c.ft(p, { y: 0, autoAlpha: 1 }, { y: -30, autoAlpha: 0, duration: 0.7 }, e32 + 0.1 + i * 0.1);
      });
      ting.tilt(s32 - 0.2, -10, 0.4).tilt(e32 + 0.2, 0, 0.4);
      ting.lean(s32 - 0.2, 6, 0.4).lean(e32 + 0.2, 0, 0.4);
      c.qa('.s3-love').forEach((h, i) => {
        c.pop(h, s32 + 0.3 + i * 0.25, { d: 0.4 });
        c.ft(h, { y: 0 }, { y: -80, duration: 1.4, ease: 'sine.out' }, s32 + 0.3 + i * 0.25);
      });
      c.ft(c.qa('.s3-love'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4 }, e32 + 0.4);
      c.talker('s3-2', ting);
      // ---------- room: the window opens ----------
      const s33 = c.s('s3-3'), e33 = c.e('s3-3'), s34 = c.s('s3-4'), e34 = c.e('s3-4'), s35 = c.s('s3-5'), e35 = c.e('s3-5');
      c.cut('.s3-door', '.s3-room', s33 - 0.4, 0.5);
      const ryu = c.char('#s3-ryu', { x: 250, y: 1450 });
      const rting = c.char('#s3-rting', { x: 820, y: 1450, flip: true });
      ryu.idle(s33 - 0.5, c.T1); rting.idle(s33 - 0.5, c.T1);
      const tWalk = s33 + 0.2;
      ryu.walk(tWalk, tWalk + 1.2, 0.3); ryu.moveTo(tWalk, 1.2, 380, null, 'sine.inOut');
      rting.walk(tWalk + 0.3, tWalk + 1.3, 0.3); rting.moveTo(tWalk + 0.3, 1.0, 720, null, 'sine.inOut');
      const tCreak = c.w('s3-3', '嘎吱') - 0.3;
      ryu.arm(tCreak - 0.6, 'L', 168, 0.35).arm(tCreak - 0.6, 'R', -168, 0.35);
      c.init('.s3-leafL', { scaleX: 1, skewY: 0 }); c.init('.s3-leafR', { scaleX: 1, skewY: 0 });
      c.ft('.s3-leafL', { scaleX: 1, skewY: 0 }, { scaleX: 0.55, skewY: -4, duration: 0.35, ease: 'power1.in' }, tCreak);
      c.ft('.s3-leafR', { scaleX: 1, skewY: 0 }, { scaleX: 0.55, skewY: 4, duration: 0.35, ease: 'power1.in' }, tCreak);
      c.ft('.s3-leafL', { scaleX: 0.55, skewY: -4 }, { scaleX: -0.3, skewY: -12, duration: 0.8, ease: 'elastic.out(1,.55)' }, tCreak + 0.5);
      c.ft('.s3-leafR', { scaleX: 0.55, skewY: 4 }, { scaleX: -0.3, skewY: 12, duration: 0.8, ease: 'elastic.out(1,.55)' }, tCreak + 0.5);
      c.ft('.s3-dark', { opacity: 1 }, { opacity: 0, duration: 0.6 }, tCreak + 0.1);
      c.ft('.s3-rays', { opacity: 0 }, { opacity: 0.22, duration: 0.8 }, tCreak + 0.4);
      c.pop('.s3-creak', tCreak, { d: 0.35, ease: 'back.out(3)', r0: -15, r: 4 });
      c.ft('.s3-creak', { x: 0 }, { x: 8, duration: 0.06, repeat: 7, yoyo: true }, tCreak + 0.1);
      c.unpop('.s3-creak', tCreak + 1.6);
      ryu.arm(tCreak + 0.9, 'L', 12, 0.4, 'power2.inOut').arm(tCreak + 0.9, 'R', -12, 0.4, 'power2.inOut');
      ryu.eyesTo(tCreak + 0.6, 's'); rting.eyesTo(tCreak + 0.7, 's');
      rting.hop(tCreak + 0.7, 1, 36);
      // zoom into the view: 場 and 圃
      const cam = c.mover('.s3-cam', { x: 0, y: 0, scale: 1 });
      cam.to(s34 - 0.3, 1.1, c.camState(540, 830, 1.32, 540, 760));
      c.init(['.s3-hlA', '.s3-hlB'].map((s) => c.q(s)), { autoAlpha: 0 });
      const tA = c.w('s3-4', '「場」') - 0.25, tB = c.w('s3-4', '「圃」') - 0.25;
      ryu.eyesTo(s34, 'n');
      ryu.arm(tA - 0.3, 'L', 158, 0.35);
      c.ft('.s3-hlA', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, repeat: 3, yoyo: true }, tA);
      c.set('.s3-hlA', { autoAlpha: 1 }, tA + 1.25);
      c.pop('.s3-tagA', tA, { d: 0.5, r0: -30, r: -6 });
      ryu.arm(tB - 0.4, 'L', 12, 0.35, 'power2.inOut').arm(tB - 0.3, 'R', -150, 0.35);
      c.ft('.s3-hlB', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, repeat: 3, yoyo: true }, tB);
      c.set('.s3-hlB', { autoAlpha: 1 }, tB + 1.25);
      c.pop('.s3-tagB', tB, { d: 0.5, r0: 30, r: 6 });
      ryu.arm(e34 - 0.2, 'R', -12, 0.4, 'power2.inOut');
      c.ft('#s3-chick', { x: 0 }, { x: 60, duration: 1.6, repeat: 5, yoyo: true, ease: 'sine.inOut' }, s34);
      c.talker('s3-4', ryu);
      // s3-5: words of 開軒面場圃
      cam.to(s35 - 0.3, 1.0, c.camState(540, 700, 1.0, 540, 600));
      c.ft(c.qa('.s3-hlA, .s3-hlB'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, s35 - 0.3);
      const W = (w) => c.w('s3-5', '「' + w + '」') - 0.15;
      c.ft('.s3-winglow', { opacity: 0 }, { opacity: 1, duration: 0.3, repeat: 3, yoyo: true }, W('軒'));
      c.ft(c.qa('.s3-leafL, .s3-leafR'), { rotation: 0 }, { rotation: 3, duration: 0.12, repeat: 5, yoyo: true }, W('軒'));
      ryu.look(W('面'), 0, -8); rting.look(W('面'), 0, -8);
      ryu.tilt(W('面'), -8); rting.tilt(W('面'), -8);
      c.ft('.s3-hlA', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, repeat: 3, yoyo: true }, W('場'));
      c.ft('.s3-hlB', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, repeat: 3, yoyo: true }, W('圃'));
      ryu.look(W('圃') + 1.5, 0, 0); rting.look(W('圃') + 1.5, 0, 0);
      ryu.tilt(W('圃') + 1.5, 0); rting.tilt(W('圃') + 1.5, 0);
      ryu.eyesTo(e35 - 3, 'h'); rting.eyesTo(e35 - 3, 'h');
      c.card('s3-5', { top: 900, dy: 40 });
    }
  };
})();
