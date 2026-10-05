/* 過故人莊 — paper-cut art library. Every builder returns an SVG markup string.
 * Conventions:
 *  - Characters are drawn with feet at local (0,0); props around their own pivot.
 *  - Animatable parts are wrapped as <g transform="translate(px,py)"><g class="part">…</g></g>
 *    so GSAP can rotate/scale them around local (0,0) (svgOrigin "0 0"). */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P;
  const A = (G.A = function (x, y, inner, cls, attrs) {
    return `<g transform="translate(${G.r(x)},${G.r(y)})"><g class="${cls || ''}" ${attrs || ''}>${inner}</g></g>`;
  });
  G.T = (x, y, s, inner, extra) => `<g transform="translate(${G.r(x)},${G.r(y)})${s && s !== 1 ? ` scale(${s})` : ''}${extra || ''}">${inner}</g>`;

  /* ---------- petal paths (one <path> per flower layer) ---------- */
  function ellipsePetal(cx, rx, ry, a) {
    const k = 0.5523, c = Math.cos(a), s = Math.sin(a);
    const R = (x, y) => `${G.r(x * c - y * s)},${G.r(x * s + y * c)}`;
    const L = cx - rx, Rr = cx + rx;
    return `M${R(L, 0)}C${R(L, -k * ry)} ${R(cx - k * rx, -ry)} ${R(cx, -ry)}C${R(cx + k * rx, -ry)} ${R(Rr, -k * ry)} ${R(Rr, 0)}C${R(Rr, k * ry)} ${R(cx + k * rx, ry)} ${R(cx, ry)}C${R(cx - k * rx, ry)} ${R(L, k * ry)} ${R(L, 0)}Z`;
  }
  G.petals = function (r, n, width, rot) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rot || 0);
      d += ellipsePetal(r * 0.55, r * 0.47, r * (width || 0.15), a);
    }
    return d;
  };

  /* ---------- global <defs>: filters, gradients, patterns, symbols ---------- */
  G.defs = function () {
    const mum = (id, c1, c2, c3) => `<g id="${id}">
      <path d="${G.petals(50, 18, 0.16, 0)}" fill="${c2}"/>
      <path d="${G.petals(40, 16, 0.16, 0.2)}" fill="${c1}"/>
      <path d="${G.petals(26, 12, 0.2, 0.1)}" fill="${c3}"/>
      <circle r="10" fill="${P.earth}"/><circle r="5" fill="${P.mum2}"/></g>`;
    const grains = (() => {
      const R = G.rng(7); let s = '';
      for (let i = 0; i < 14; i++) s += `<ellipse cx="${G.r(R() * 40)}" cy="${G.r(R() * 40)}" rx="2.6" ry="2" fill="${R() > 0.5 ? P.gold : P.earth}" opacity=".85"/>`;
      return s;
    })();
    return `<svg id="g-defs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>
  <filter id="ps" x="-15%" y="-15%" width="130%" height="140%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="6" stdDeviation="0" flood-color="#5B4126" flood-opacity=".16"/></filter>
  <filter id="ps2" x="-25%" y="-15%" width="150%" height="135%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="7" stdDeviation="1.5" flood-color="#5B4126" flood-opacity=".2"/></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient>
  <linearGradient id="gDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.dusk3}"/><stop offset=".55" stop-color="${P.dusk2}"/><stop offset="1" stop-color="${P.dusk1}"/></linearGradient>
  <linearGradient id="gWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6E3BF"/><stop offset="1" stop-color="${P.paper2}"/></linearGradient>
  <radialGradient id="gGlow"><stop offset="0" stop-color="${P.millet}" stop-opacity=".75"/><stop offset="1" stop-color="${P.millet}" stop-opacity="0"/></radialGradient>
  <radialGradient id="gSun"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".55" stop-color="${P.millet}"/><stop offset="1" stop-color="${P.gold}"/></radialGradient>
  <pattern id="pBrick" width="64" height="32" patternUnits="userSpaceOnUse"><path d="M0 .5H64M0 16.5H64M16 0V16M48 16V32" stroke="${P.wood}" stroke-width="2.5" opacity=".35" fill="none"/></pattern>
  <pattern id="pBrickR" width="64" height="32" patternUnits="userSpaceOnUse"><path d="M0 .5H64M0 16.5H64M16 0V16M48 16V32" stroke="${P.wood2}" stroke-width="2.5" opacity=".25" fill="none"/></pattern>
  <pattern id="pPlank" width="90" height="400" patternUnits="userSpaceOnUse"><rect width="90" height="400" fill="${P.wood}"/><rect x="0" width="4" height="400" fill="${P.wood2}" opacity=".5"/><path d="M30 60q8 10 0 20M62 220q-8 12 0 22" stroke="${P.wood2}" stroke-width="3" fill="none" opacity=".35"/></pattern>
  <pattern id="pTileD" width="34" height="40" patternUnits="userSpaceOnUse"><rect width="34" height="40" fill="${P.ink2}"/><rect x="0" width="6" height="40" fill="#58504A"/></pattern>
  <pattern id="pTileR" width="34" height="40" patternUnits="userSpaceOnUse"><rect width="34" height="40" fill="${P.red}"/><rect x="0" width="6" height="40" fill="#A8432F"/></pattern>
  <pattern id="pMillet" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${P.millet}"/>${grains}</pattern>
  <pattern id="pGrainBig" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="${P.millet}"/>${(() => { const R = G.rng(11); let s = ''; for (let i = 0; i < 26; i++) { const x = R() * 120, y = R() * 120; s += `<ellipse cx="${G.r(x)}" cy="${G.r(y)}" rx="9" ry="7.5" fill="${R() > 0.5 ? P.gold : '#F9E07E'}"/><circle cx="${G.r(x - 3)}" cy="${G.r(y - 3)}" r="2.4" fill="#fff" opacity=".7"/>`; } return s; })()}</pattern>
  <pattern id="pYard" width="60" height="40" patternUnits="userSpaceOnUse"><rect width="60" height="40" fill="${P.gold}"/><path d="M6 8h10M34 22h12M14 32h8M44 6h8" stroke="${P.earth}" stroke-width="4" stroke-linecap="round"/></pattern>
  <pattern id="pDots" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="24" cy="24" r="2.4" fill="${P.paper2}"/></pattern>
  <pattern id="pLattice" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="${P.paper}"/><path d="M0 0H40V40M20 0V40M0 20H40" stroke="${P.wood2}" stroke-width="5" fill="none"/></pattern>
  ${mum('mumA', P.mum, P.mum2, P.millet)}
  ${mum('mumB', P.millet, P.mum, '#FBE7A1')}
  ${mum('mumC', P.mum2, P.red, P.mum)}
  <g id="mumBud"><path d="M0 0C-10 -6-12-22 0-30C12-22 10-6 0 0Z" fill="${P.green2}"/><path d="M-5-22C-3-30 3-30 5-22Z" fill="${P.mum}"/></g>
  <g id="leafPair"><path d="M0 0C-30-6-46-30-40-46C-18-40-6-22 0 0Z" fill="${P.green}"/><path d="M0 0C30-10 48-34 40-52C16-44 4-24 0 0Z" fill="${P.green2}"/></g>
  <g id="cabbage"><circle r="34" fill="${P.green2}"/><path d="M-30-6C-20-30 20-30 30-6C14-16-14-16-30-6Z" fill="${P.green}"/><circle cy="2" r="20" fill="${P.green3}"/><path d="M0-14V18M-12 0Q0 6 12 0" stroke="${P.green2}" stroke-width="3" fill="none"/></g>
  <g id="radish"><path d="M0 0C-16-20-26-46-14-64C-6-46-2-26 0 0Z" fill="${P.green}"/><path d="M0 0C10-24 24-44 40-50C30-30 16-14 0 0Z" fill="${P.green2}"/><path d="M0 0C-2-30 2-52 8-70C14-46 8-24 0 0Z" fill="${P.green2}"/><ellipse cy="8" rx="13" ry="10" fill="#fff"/></g>
  <g id="star4"><path d="M0-30C4-8 8-4 30 0C8 4 4 8 0 30C-4 8-8 4-30 0C-8-4-4-8 0-30Z"/></g>
  <g id="heart"><path d="M0 26C-30 6-44-10-34-26C-26-38-8-36 0-22C8-36 26-38 34-26C44-10 30 6 0 26Z"/></g>
  <g id="cloud"><path d="M-90 0C-92-28-64-42-42-30C-32-62 20-66 34-36C54-50 88-36 84-8C102-6 102 16 84 16H-80C-100 16-102 0-90 0Z" fill="#fff"/></g>
  <g id="grass"><path d="M-14 0Q-12-20-20-34Q-4-18-2 0ZM-2 0Q0-26 4-42Q10-20 8 0ZM8 0Q16-18 26-26Q18-8 18 0Z" fill="${P.green}"/></g>
</defs></svg>`;
  };

  /* ---------- characters ---------- */
  const EYE = `<g class="e-n"><ellipse rx="9.5" ry="11.5" fill="${P.ink}"/><circle cx="3.2" cy="-4.4" r="3.6" fill="#fff"/></g>
    <path class="e-h" d="M-12 4Q0-10 12 4" fill="none" stroke="${P.ink}" stroke-width="5.5" stroke-linecap="round"/>
    <g class="e-s"><ellipse rx="11.5" ry="13.5" fill="${P.ink}"/><path d="M3-11l2.2 5.4 5.4 2.2-5.4 2.2L3 4.2.8-1.2-4.6-3.4.8-5.6Z" fill="#fff"/><circle cx="-4.5" cy="5.5" r="2.2" fill="#fff"/></g>`;
  const MOUTH = (y, s) => A(0, y, `<path class="m-c" d="M-12-3Q0 8 12-3" fill="none" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/>
    <g class="m-o"><ellipse cy="2" rx="11" ry="12" fill="${P.mouth}"/><ellipse cy="8" rx="6.5" ry="4" fill="${P.tongue}"/></g>
    <path class="m-m" d="M-15-5Q0-8 15-5Q12 10 0 10Q-12 10-15-5Z" fill="${P.mouth}"/>
    <g class="m-s"><path d="M-19-6Q0-2 19-6Q15 17 0 17Q-15 17-19-6Z" fill="${P.mouth}"/><path d="M-9 10Q0 4 9 10Q5 15 0 15Q-5 15-9 10Z" fill="${P.tongue}"/></g>`,
    'mouth', `data-m="c"${s ? ` transform="scale(${s})"` : ''}`);
  const EYES = (dx, y, e) => `<g class="eyes" data-e="${e || 'n'}">${A(-dx, y, EYE, 'eyeL')}${A(dx, y, EYE, 'eyeR')}</g>`;

  /** 小玉 ('yu') or 阿庭 ('ting'); feet at (0,0), ~380 tall */
  G.kid = function (kind, o) {
    o = o || {};
    const yu = kind === 'yu';
    const cloth = yu ? P.red : P.blue, trim = yu ? P.gold : P.paper, pants = yu ? P.paper2 : P.navy, shoe = yu ? P.red : P.wood2;
    const leg = (s) => A(s * 21, -92, `<rect x="-14" y="-6" width="28" height="80" rx="14" fill="${pants}"/><ellipse cx="${s * 5}" cy="80" rx="21" ry="12" fill="${shoe}"/>`, s < 0 ? 'legL' : 'legR');
    const arm = (s) => A(s * 52, -196, `<rect x="-15" y="-10" width="30" height="88" rx="15" fill="${cloth}"/><rect x="-15" y="62" width="30" height="12" rx="5" fill="${trim}"/><circle cy="88" r="15.5" fill="${P.skin}"/><g class="prop${s < 0 ? 'L' : 'R'}" transform="translate(0,88)">${(s < 0 ? o.propL : o.propR) || ''}</g>`, s < 0 ? 'armL' : 'armR');
    const hairYu = `
      ${A(-66, -150, `<circle r="31" fill="${P.ink}"/><g transform="translate(20,22) rotate(-30)"><path d="M0 0L-20-12V12ZM0 0L20-12V12Z" fill="${P.red}"/><circle r="6.5" fill="${P.gold}"/></g>`, 'hairL')}
      ${A(66, -150, `<circle r="31" fill="${P.ink}"/><g transform="translate(-20,22) rotate(30)"><path d="M0 0L-20-12V12ZM0 0L20-12V12Z" fill="${P.red}"/><circle r="6.5" fill="${P.gold}"/></g>`, 'hairR')}`;
    const bangsYu = `<path d="M-81-82C-84-140-42-166 0-166C42-166 84-140 81-82C72-100 58-112 42-112C32-112 24-106 20-118C8-104-14-104-24-120C-36-104-60-104-81-82Z" fill="${P.ink}"/>`;
    const hairTing = `<path d="M-82-78C-88-146-40-170 4-168C50-168 86-140 81-80C74-102 62-114 46-118C48-106 42-98 32-96C32-110 24-120 12-124C2-108-24-106-40-116C-52-102-70-96-82-78Z" fill="${P.ink}"/>
      <g class="tuft"><path d="M4-164C-4-198 26-214 38-194C26-202 12-194 18-164Z" fill="${P.ink}"/></g>`;
    const pack = yu ? '' : `<g class="pk"><rect x="-68" y="-206" width="136" height="122" rx="30" fill="${P.gold}"/><rect x="-54" y="-140" width="108" height="40" rx="12" fill="${P.mum}"/></g>`;
    const straps = yu ? '' : `<g class="pk"><path d="M-30-210L-40-126M30-210L40-126" stroke="${P.mum}" stroke-width="11" stroke-linecap="round"/></g>`;
    return `<g class="ch ch-${kind}"${o.id ? ` id="${o.id}"` : ''} data-pack="${o.pack ? 1 : 0}">
  <ellipse class="ch-shadow" cx="0" cy="0" rx="76" ry="13" fill="#3B2A16" opacity=".14"/>
  <g class="ch-flip"><g class="ch-bob"><g class="ch-breath" filter="url(#ps2)">
    ${pack}
    ${leg(-1)}${leg(1)}
    <path d="M-34-214C-48-212-56-200-58-186L-68-100C-70-86-62-80-50-80H50C62-80 70-86 68-100L58-186C56-200 48-212 34-214Z" fill="${cloth}"/>
    <path d="M-66-92C-30-84 30-84 66-92" stroke="${trim}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M-14-206C0-180 14-160 34-148" stroke="${trim}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="24" cy="-128" r="5" fill="${trim}"/><circle cx="24" cy="-108" r="5" fill="${trim}"/>
    <g class="sheen" opacity="0"><path d="M-58-186L-68-100C-70-86-62-80-50-80H50C62-80 70-86 68-100L58-186Z" fill="#fff"/></g>
    ${straps}
    ${A(0, -208, `<rect x="-14" y="-16" width="28" height="22" fill="${P.skin}"/>
      ${yu ? hairYu : ''}
      <ellipse cx="0" cy="-84" rx="86" ry="83" fill="${P.ink}"/>
      <circle cx="-78" cy="-72" r="13" fill="${P.skin}"/><circle cx="78" cy="-72" r="13" fill="${P.skin}"/>
      <ellipse cx="0" cy="-76" rx="78" ry="74" fill="${P.skin}"/>
      ${yu ? bangsYu : hairTing}
      ${EYES(28, -66)}
      <ellipse cx="-50" cy="-42" rx="15" ry="9" fill="${P.blush}" opacity=".9"/><ellipse cx="50" cy="-42" rx="15" ry="9" fill="${P.blush}" opacity=".9"/>
      ${MOUTH(-30)}`, 'head')}
    ${arm(-1)}${arm(1)}
  </g></g></g>
</g>`;
  };

  /** adult: 'dad' | 'mom' — ~470 tall */
  G.adult = function (kind, o) {
    o = o || {};
    const dad = kind === 'dad';
    const robe = dad ? P.green : P.earth, trim = dad ? P.paper2 : P.red;
    const arm = (s) => A(s * 60, -282, `<rect x="-17" y="-10" width="34" height="112" rx="17" fill="${robe}"/><rect x="-17" y="86" width="34" height="12" rx="5" fill="${trim}"/><circle cy="112" r="17" fill="${P.skin}"/><g class="prop${s < 0 ? 'L' : 'R'}" transform="translate(0,112)">${(s < 0 ? o.propL : o.propR) || ''}</g>`, s < 0 ? 'armL' : 'armR');
    const hair = dad
      ? `<circle cx="0" cy="-166" r="24" fill="${P.ink}"/><rect x="-22" y="-160" width="44" height="9" rx="4" fill="${P.gold}"/>
         <ellipse cx="0" cy="-80" rx="78" ry="78" fill="${P.ink}"/>`
      : `<ellipse cx="0" cy="-150" rx="50" ry="34" fill="${P.ink}"/><path d="M36-170L70-196" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/><circle cx="72" cy="-198" r="9" fill="${P.mum2}"/>
         <ellipse cx="0" cy="-80" rx="80" ry="80" fill="${P.ink}"/>`;
    const front = dad
      ? `<path d="M-74-64C-74-136-36-156 0-156C36-156 74-136 74-64C60-104 30-118 0-118C-30-118-60-104-74-64Z" fill="${P.ink}"/>
         <path d="M-24-28Q-12-40 0-30Q12-40 24-28Q12-32 0-24Q-12-32-24-28Z" fill="${P.ink}"/>`
      : `<path d="M-76-60C-80-136-36-158 0-158C36-158 80-136 76-60C70-98 44-122 6-126C-20-112-50-100-76-60Z" fill="${P.ink}"/>`;
    return `<g class="ch ch-${kind}"${o.id ? ` id="${o.id}"` : ''}>
  <ellipse class="ch-shadow" cx="0" cy="0" rx="86" ry="14" fill="#3B2A16" opacity=".14"/>
  <g class="ch-flip"><g class="ch-bob"><g class="ch-breath" filter="url(#ps2)">
    <rect x="-40" y="-40" width="30" height="40" rx="10" fill="${P.ink}"/><rect x="10" y="-40" width="30" height="40" rx="10" fill="${P.ink}"/>
    <path d="M-40-300C-58-298-66-282-68-264L-84-40C-86-24-76-16-62-16H62C76-16 86-24 84-40L68-264C66-282 58-298 40-300Z" fill="${robe}"/>
    <path d="M-20-296C0-262 18-240 46-226" stroke="${trim}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="-70" y="-198" width="140" height="20" rx="8" fill="${trim}"/>
    ${A(0, -294, `<rect x="-15" y="-16" width="30" height="24" fill="${P.skin}"/>
      ${hair}
      <circle cx="-74" cy="-70" r="13" fill="${P.skin}"/><circle cx="74" cy="-70" r="13" fill="${P.skin}"/>
      <ellipse cx="0" cy="-72" rx="72" ry="70" fill="${P.skin}"/>
      ${front}
      <path d="M-44-96Q-30-104-16-98M16-98Q30-104 44-96" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${EYES(28, -70)}
      <ellipse cx="-46" cy="-40" rx="13" ry="8" fill="${P.blush}" opacity=".8"/><ellipse cx="46" cy="-40" rx="13" ry="8" fill="${P.blush}" opacity=".8"/>
      ${MOUTH(dad ? -12 : -26)}`, 'head')}
    ${arm(-1)}${arm(1)}
  </g></g></g>
</g>`;
  };

  /** 孟浩然 as a paper puppet on a stick */
  G.poet = function (o) {
    o = o || {};
    const arm = (s) => A(s * 58, -278, `<rect x="-18" y="-10" width="36" height="108" rx="18" fill="${P.robe}"/><circle cy="108" r="16" fill="${P.skin}"/>`, s < 0 ? 'armL' : 'armR');
    return `<g class="ch ch-poet"${o.id ? ` id="${o.id}"` : ''}>
  <g class="ch-flip"><g class="ch-bob">
    <rect x="-8" y="-20" width="16" height="520" rx="6" fill="${P.wood2}"/>
    <g class="ch-breath" filter="url(#ps2)">
    <path d="M-38-296C-56-294-64-280-66-262L-86-24C-88-10-78 0-64 0H64C78 0 88-10 86-24L66-262C64-280 56-294 38-296Z" fill="${P.robe}"/>
    <path d="M-86-30C-30-18 30-18 86-30" stroke="${P.ink2}" stroke-width="10" fill="none"/>
    <path d="M-18-292C0-256 18-236 44-222" stroke="${P.ink2}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="-68" y="-196" width="136" height="16" rx="7" fill="${P.ink2}"/>
    ${A(0, -290, `<rect x="-14" y="-16" width="28" height="24" fill="${P.skin}"/>
      <ellipse cx="0" cy="-80" rx="76" ry="76" fill="${P.ink2}"/>
      <ellipse cx="0" cy="-72" rx="70" ry="68" fill="${P.skin}"/>
      <path d="M-50-98Q-34-108-18-100M18-100Q34-108 50-98" stroke="${P.ink2}" stroke-width="6" fill="none" stroke-linecap="round"/>
      ${EYES(28, -72, 'h')}
      <ellipse cx="-44" cy="-44" rx="12" ry="7" fill="${P.blush}" opacity=".8"/><ellipse cx="44" cy="-44" rx="12" ry="7" fill="${P.blush}" opacity=".8"/>
      <path d="M-30-34Q0-14 30-34Q28 30 0 84Q-28 30-30-34Z" fill="${P.ink2}"/>
      <path d="M-24-32Q-12-42 0-34Q12-42 24-32Q12-28 0-26Q-12-28-24-32Z" fill="${P.ink}"/>
      <g class="hat"><path d="M-138-118Q0-262 138-118Q0-94-138-118Z" fill="${P.earth}"/>
        <path d="M-70-140L0-218M70-140L0-218M0-108V-218M-112-124L0-218M112-124L0-218" stroke="${P.wood}" stroke-width="4" opacity=".7"/>
        <circle cx="0" cy="-220" r="8" fill="${P.wood2}"/></g>`, 'head')}
    ${arm(-1)}${arm(1)}
  </g></g></g>
</g>`;
  };

  G.envelope = function (w, h, o) {
    o = o || {};
    w = w || 60; h = h || 42;
    return `<g><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h * 0.12}" fill="#fff"/>
      <path d="M${-w / 2} ${-h / 2 + 2}L0 ${h * 0.12}L${w / 2} ${-h / 2 + 2}" fill="none" stroke="${P.paper2}" stroke-width="${Math.max(2, h * 0.08)}" stroke-linejoin="round"/>
      <path d="M${-w / 2 + 2} ${h / 2 - 2}L${-w * 0.12} ${0}M${w / 2 - 2} ${h / 2 - 2}L${w * 0.12} 0" stroke="${P.paper2}" stroke-width="${Math.max(2, h * 0.06)}"/>
      <g transform="translate(0,${h * 0.1}) scale(${h / 120})"><use href="#heart" fill="${P.red}"/></g></g>`;
  };

  /** yellow bird; center (0,0), facing right. Wing pivot at (-6,-6) */
  G.bird = function (o) {
    o = o || {};
    return `<g class="bird"${o.id ? ` id="${o.id}"` : ''}><g class="bird-bob">
      <path d="M-28-4L-58-20L-50 0L-60 16Z" fill="${P.mum2}"/>
      <ellipse rx="36" ry="30" fill="${P.gold}"/>
      <ellipse cx="6" cy="9" rx="22" ry="16" fill="${P.millet}"/>
      <circle cx="17" cy="-9" r="5.5" fill="${P.ink}"/><circle cx="18.8" cy="-10.8" r="1.8" fill="#fff"/>
      <ellipse cx="13" cy="6" rx="7" ry="4.5" fill="${P.blush}"/>
      <path d="M30-8L52 0L30 7Z" fill="${P.mum2}"/>
      <g class="bird-letter" ${o.letter ? '' : 'opacity="0"'} transform="translate(52,10) rotate(12)">${G.envelope(46, 32)}</g>
      ${A(-8, -8, `<path d="M0 0C-12-46 22-56 22-12Z" fill="${P.mum}"/>`, 'wing')}
    </g></g>`;
  };

  /** chicken; feet (0,0), facing left (flip with scaleX -1) */
  G.chicken = function (o) {
    o = o || {};
    return `<g class="chick"${o.id ? ` id="${o.id}"` : ''}>
      <ellipse cy="2" rx="40" ry="8" fill="#3B2A16" opacity=".12"/>
      <g class="chick-body">
      <path d="M-8-4V-24M10-4V-24" stroke="${P.mum2}" stroke-width="6" stroke-linecap="round"/>
      <path d="M40-58C50-92 72-84 64-54C76-66 84-48 60-36Z" fill="${P.paper2}"/>
      <path d="M-38-52C-38-82-10-88 6-72C30-76 54-62 56-38C58-14 36-18 0-18C-30-18-44-30-38-52Z" fill="#FFF8EC"/>
      <path d="M-2-52C16-62 36-52 32-36C20-28 2-32-2-52Z" fill="${P.paper2}"/>
      ${A(-24, -62, `<circle cx="-8" cy="-14" r="19" fill="#FFF8EC"/><path d="M-20-30Q-16-44-8-34Q-4-46 4-34Q12-40 10-26Z" fill="${P.red}"/>
        <path d="M-25-17L-39-11L-25-6Z" fill="${P.mum2}"/><ellipse cx="-21" cy="-1" rx="4.5" ry="6.5" fill="${P.red}"/><circle cx="-12" cy="-19" r="3.4" fill="${P.ink}"/>`, 'chick-head')}
      </g></g>`;
  };

  G.tree = function (o) {
    o = o || {};
    const dark = o.tone !== 'light';
    const c1 = dark ? P.green : P.green2, c2 = dark ? P.green2 : P.green3, c3 = dark ? P.green3 : '#E2F0D5';
    const face = o.face ? `<g class="tree-face">${EYES(22, -150, 'h').replace('class="eyes"', 'class="eyes tface"')}<path d="M-12-128Q0-116 12-128" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="-40" cy="-132" rx="12" ry="7" fill="${P.blush}" opacity=".8"/><ellipse cx="40" cy="-132" rx="12" ry="7" fill="${P.blush}" opacity=".8"/></g>` : '';
    return `<g class="tree" filter="url(#ps)"><path d="M-15 0L-10-112H10L15 0Z" fill="${P.wood}"/>
      <circle cy="-168" r="80" fill="${c1}"/><circle cx="-50" cy="-130" r="54" fill="${c1}"/><circle cx="50" cy="-128" r="52" fill="${c1}"/>
      <circle cx="-10" cy="-184" r="58" fill="${c2}"/><circle cx="36" cy="-148" r="38" fill="${c2}"/>
      <ellipse cx="-28" cy="-208" rx="22" ry="14" fill="${c3}"/>${face}</g>`;
  };

  G.farmhouse = function (o) {
    o = o || {};
    return `<g class="farmhouse" filter="url(#ps)">
      <rect x="-210" y="-262" width="420" height="262" fill="${P.earth}"/><rect x="-210" y="-262" width="420" height="262" fill="url(#pBrick)"/>
      <path d="M-262-250Q-246-256-236-270L-178-362H178L236-270Q246-256 262-250Z" fill="url(#pTileD)"/>
      <path d="M-262-250Q-284-254-292-276Q-276-262-252-264ZM262-250Q284-254 292-276Q276-262 252-264Z" fill="${P.ink}"/>
      <rect x="-196" y="-374" width="392" height="18" rx="9" fill="${P.ink}"/>
      <path d="M-196-365Q-218-370-224-392Q-206-380-190-378ZM196-365Q218-370 224-392Q206-380 190-378Z" fill="${P.ink}"/>
      <rect x="-262" y="-256" width="524" height="12" rx="6" fill="${P.ink}"/>
      <rect x="-50" y="-160" width="100" height="160" rx="6" fill="${P.wood2}"/><path d="M0-160V0" stroke="${P.wood}" stroke-width="5"/>
      <circle cx="-10" cy="-80" r="5" fill="${P.gold}"/><circle cx="10" cy="-80" r="5" fill="${P.gold}"/>
      <rect x="-82" y="-160" width="22" height="126" rx="3" fill="${P.red}"/><rect x="60" y="-160" width="22" height="126" rx="3" fill="${P.red}"/>
      <rect x="-15" y="-212" width="30" height="30" fill="${P.red}" transform="rotate(45 0 -197)"/>
      ${[-140, 140].map((x) => `<g transform="translate(${x},-150)"><rect x="-44" y="-40" width="88" height="80" rx="6" fill="${P.wood2}"/><rect x="-34" y="-30" width="68" height="60" fill="url(#pLattice)"/></g>`).join('')}
    </g>`;
  };

  G.townhouse = function (o) {
    o = o || {};
    return `<g class="townhouse" filter="url(#ps)">
      <rect x="-170" y="-250" width="340" height="250" fill="${P.paper2}"/><rect x="-170" y="-250" width="340" height="250" fill="url(#pBrickR)"/>
      <path d="M-212-240L-150-330H150L212-240Z" fill="url(#pTileR)"/>
      <rect x="-216" y="-246" width="432" height="12" rx="6" fill="#9C3F2C"/><rect x="-160" y="-340" width="320" height="16" rx="8" fill="#9C3F2C"/>
      <rect x="-40" y="-140" width="80" height="140" rx="5" fill="${P.wood}"/><circle cx="24" cy="-70" r="5" fill="${P.gold}"/>
      ${o.win !== false ? `<g transform="translate(100,-150)"><rect x="-46" y="-44" width="92" height="88" rx="6" fill="${P.wood2}"/><rect x="-36" y="-34" width="72" height="68" fill="url(#pLattice)"/></g>
      <g transform="translate(-100,-150)"><rect x="-46" y="-44" width="92" height="88" rx="6" fill="${P.wood2}"/><rect x="-36" y="-34" width="72" height="68" fill="url(#pLattice)"/></g>` : ''}
    </g>`;
  };

  /** simple roofs for town skylines: w wide, colour */
  G.roofHouse = function (w, h, roof, wall) {
    return `<g filter="url(#ps)"><rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${wall || P.paper2}"/><path d="M${-w / 2 - 22} ${-h + 6}L${-w / 2 + 20} ${-h - w * 0.32}H${w / 2 - 20}L${w / 2 + 22} ${-h + 6}Z" fill="${roof || P.red}"/><rect x="-14" y="${-h * 0.55}" width="28" height="${h * 0.55}" fill="${P.wood}"/></g>`;
  };

  G.bowlMillet = function (s) {
    return `<g transform="scale(${s || 1})"><path d="M-62-8C-60-56 60-56 62-8Z" fill="url(#pMillet)"/><path d="M-70-10H70C66 30 40 46 0 46C-40 46-66 30-70-10Z" fill="#fff"/><path d="M-70-10H70C69 0 67 6 64 12H-64C-67 6-69 0-70-10Z" fill="${P.blue}"/><rect x="-24" y="42" width="48" height="10" rx="4" fill="${P.blue}"/></g>`;
  };
  G.plateChicken = function (s) {
    return `<g transform="scale(${s || 1})"><ellipse cy="10" rx="96" ry="26" fill="#fff"/><ellipse cy="8" rx="80" ry="18" fill="${P.paper2}"/>
      <g transform="translate(-26,-6) rotate(-20)"><ellipse rx="40" ry="26" fill="${P.mum2}"/><ellipse cx="-8" cy="-6" rx="22" ry="12" fill="${P.mum}"/><rect x="34" y="-5" width="28" height="10" rx="5" fill="#FFF8EC"/><circle cx="62" cy="-6" r="7" fill="#FFF8EC"/><circle cx="62" cy="5" r="7" fill="#FFF8EC"/></g>
      <g transform="translate(30,-4) rotate(18)"><ellipse rx="34" ry="22" fill="${P.wood}"/><ellipse cx="-6" cy="-5" rx="18" ry="9" fill="${P.mum2}"/><rect x="-60" y="-5" width="28" height="10" rx="5" fill="#FFF8EC"/><circle cx="-60" cy="-6" r="7" fill="#FFF8EC"/><circle cx="-60" cy="5" r="7" fill="#FFF8EC"/></g>
      <path d="M-50 4Q-40-6-30 4M40 6Q50-4 58 6" stroke="${P.green2}" stroke-width="7" stroke-linecap="round" fill="none"/></g>`;
  };
  G.greensDish = function (s) {
    return `<g transform="scale(${s || 1})"><ellipse cy="8" rx="76" ry="22" fill="#fff"/><ellipse cy="6" rx="62" ry="15" fill="${P.paper2}"/>
      <path d="M-46 4C-40-24-10-26 0-4C6-30 40-28 46 4Z" fill="${P.green}"/><path d="M-30 2C-24-14-6-14 0 2C8-16 26-14 32 2Z" fill="${P.green2}"/></g>`;
  };
  /** small cup: kind 'tea' (blue) or 'wine' (white with red) */
  G.cup = function (kind, s) {
    const tea = kind === 'tea';
    return `<g transform="scale(${s || 1})"><path d="M-20-24H20L15 4Q0 10-15 4Z" fill="${tea ? '#fff' : P.paper}"/><path d="M-20-24H20L19-16H-19Z" fill="${tea ? P.blue : P.red}"/><ellipse cy="-24" rx="20" ry="5" fill="${tea ? P.gold : P.paper2}"/></g>`;
  };
  G.steam = function (cls, h, color) {
    h = h || 120;
    return `<path class="${cls || ''}" d="M0 0C-16 ${-h * 0.2} 16 ${-h * 0.4} 0 ${-h * 0.6}C-16 ${-h * 0.8} 10 ${-h * 0.95} 0 ${-h}" fill="none" stroke="${color || '#fff'}" stroke-width="10" stroke-linecap="round" opacity=".9"/>`;
  };

  G.lightbulb = function () {
    return `<g><g class="rays">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="-5" y="-118" width="10" height="30" rx="5" fill="${P.gold}" transform="rotate(${i * 45})"/>`).join('')}</g>
      <circle r="58" fill="${P.millet}"/><circle cx="-18" cy="-18" r="16" fill="#FFF6D6"/>
      <rect x="-26" y="48" width="52" height="34" rx="8" fill="${P.ink2}"/><path d="M-26 60H26M-26 72H26" stroke="${P.paper2}" stroke-width="4"/></g>`;
  };

  G.calendarPage = function (top, big, sub, color) {
    return `<g><rect x="-150" y="-180" width="300" height="360" rx="22" fill="#fff"/>
      <rect x="-150" y="-180" width="300" height="84" rx="22" fill="${color || P.red}"/><rect x="-150" y="-120" width="300" height="24" fill="${color || P.red}"/>
      <text x="0" y="-122" text-anchor="middle" class="kai" font-size="50" fill="#fff">${top}</text>
      <text x="0" y="66" text-anchor="middle" class="kai" font-size="${big.length > 2 ? 104 : 140}" fill="${P.ink}">${big}</text>
      ${sub ? `<text x="0" y="146" text-anchor="middle" class="kai" font-size="54" fill="${P.red}">${sub}</text>` : ''}</g>`;
  };

  G.label = function (text, o) {
    o = o || {};
    const fs = o.fs || 64, w = o.w || fs * text.length + 56, h = fs + 34;
    return `<g class="label" filter="url(#ps)"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2.4}" fill="${o.bg || P.paper}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="6"` : ''}/>
      <text x="0" y="${fs * 0.36}" text-anchor="middle" class="${o.font || 'kai'}" font-size="${fs}" fill="${o.color || P.ink}">${text}</text></g>`;
  };

  G.sparkles = function (n, seed, rx, ry, colors) {
    const R = G.rng(seed);
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.5;
      const d = 0.6 + R() * 0.4;
      s += A(Math.cos(a) * rx * d, Math.sin(a) * ry * d, `<use href="#star4" fill="${(colors || [P.gold, P.mum, '#fff'])[i % (colors || [0, 0, 0]).length]}" transform="scale(${G.r(0.5 + R() * 0.7)})"/>`, 'spark');
    }
    return s;
  };
  G.zzz = function () {
    return `<text class="kai" font-size="60" fill="${P.paper}" font-weight="700">Z</text>`;
  };
})();
