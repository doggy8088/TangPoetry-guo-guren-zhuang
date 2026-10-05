/* 過故人莊 — paper-cut vocab icons (viewBox 0 0 200 200), keyed by narration.json vocab[].icon */
(function () {
  'use strict';
  const G = window.G;
  const P = G.P;
  const T = G.T;

  const miniKid = (x, y, cloth, hair) => T(x, y, 1, `
    <path d="M-22-6L-28 46H28L22-6Z" fill="${cloth}"/>
    <circle cy="-26" r="27" fill="${P.ink}"/><circle cy="-22" r="24" fill="${P.skin}"/>
    ${hair}
    <circle cx="-8" cy="-22" r="3.4" fill="${P.ink}"/><circle cx="8" cy="-22" r="3.4" fill="${P.ink}"/>
    <path d="M-6-12Q0-7 6-12" stroke="${P.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="-15" cy="-13" rx="5" ry="3" fill="${P.blush}"/><ellipse cx="15" cy="-13" rx="5" ry="3" fill="${P.blush}"/>`);
  const yuHair = `<path d="M-25-28C-24-48 24-48 25-28C14-38-14-38-25-28Z" fill="${P.ink}"/><circle cx="-24" cy="-44" r="10" fill="${P.ink}"/><circle cx="24" cy="-44" r="10" fill="${P.ink}"/>`;
  const tingHair = `<path d="M-25-26C-26-50 24-50 25-28C14-40-10-36-25-26Z" fill="${P.ink}"/><path d="M2-46C0-58 12-62 14-54C8-56 6-52 6-46Z" fill="${P.ink}"/>`;
  const house = (x, y, s, roof, wall) => T(x, y, s, `<rect x="-40" y="-50" width="80" height="50" fill="${wall || P.earth}"/>
    <path d="M-52-46L-30-80H30L52-46Z" fill="${roof || P.ink2}"/><rect x="-12" y="-30" width="24" height="30" rx="3" fill="${P.wood2}"/>
    <rect x="-34" y="-40" width="14" height="14" fill="${P.wood2}"/><rect x="20" y="-40" width="14" height="14" fill="${P.wood2}"/>`);
  const tree = (x, y, s) => T(x, y, s, `<rect x="-5" y="-30" width="10" height="30" fill="${P.wood}"/><circle cy="-46" r="26" fill="${P.green}"/><circle cx="-6" cy="-52" r="16" fill="${P.green2}"/>`);
  const mum = (x, y, s, id) => T(x, y, s, `<use href="#${id || 'mumA'}"/>`);

  const I = {
    'footsteps-door': `
      <rect x="112" y="34" width="66" height="122" rx="8" fill="${P.wood2}"/><path d="M145 34V156" stroke="${P.wood}" stroke-width="4"/>
      <rect x="100" y="34" width="10" height="100" rx="2" fill="${P.red}"/><rect x="180" y="34" width="10" height="100" rx="2" fill="${P.red}"/>
      <circle cx="138" cy="98" r="4" fill="${P.gold}"/><circle cx="152" cy="98" r="4" fill="${P.gold}"/>
      <rect x="96" y="156" width="98" height="10" rx="4" fill="${P.ink2}"/>
      ${[[24, 170, -20], [52, 150, -10], [74, 168, -6], [96, 146, 0]].map(([x, y, r]) => `<g transform="translate(${x},${y}) rotate(${r})"><ellipse rx="9" ry="14" fill="${P.ink2}"/><circle cx="-4" cy="-18" r="3" fill="${P.ink2}"/><circle cx="3" cy="-19" r="3" fill="${P.ink2}"/></g>`).join('')}`,
    'two-friends': `${miniKid(66, 112, P.red, yuHair)}${miniKid(134, 112, P.blue, tingHair)}
      <path d="M84 120Q100 132 116 120" stroke="${P.skin}" stroke-width="12" stroke-linecap="round" fill="none"/>
      ${T(100, 40, 0.6, `<use href="#heart" fill="${P.red}"/>`)}
      <rect x="20" y="158" width="160" height="12" rx="6" fill="${P.green2}"/>`,
    'farmhouse': `<rect x="10" y="132" width="180" height="56" rx="10" fill="${P.green2}"/>
      ${[0, 1, 2, 3].map((i) => `<path d="M${18 + i * 44} 186L${30 + i * 44} 136" stroke="${P.gold}" stroke-width="12" stroke-linecap="round"/>`).join('')}
      ${house(100, 134, 1.25)}<circle cx="168" cy="36" r="16" fill="${P.millet}"/>`,
    'checkmark-dish': `<g transform="translate(92,128)">${G.plateChicken(0.8)}</g>
      <g transform="translate(150,96)">${G.bowlMillet(0.5)}</g>
      <circle cx="150" cy="48" r="34" fill="${P.green3}"/><path d="M132 48L146 62L170 34" stroke="${P.green}" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    'chicken-millet': `<g transform="translate(70,150) scale(1.05)">${G.chicken()}</g><g transform="translate(146,138) scale(.66)">${G.bowlMillet()}</g>`,
    'letter': `<g transform="translate(100,104) rotate(-8)">${G.envelope(150, 104)}</g>
      <path d="M18 64H44M12 84H38M22 104H40" stroke="${P.hill}" stroke-width="7" stroke-linecap="round"/>`,
    'arrow-house': `${house(146, 150, 1.05)}
      <path d="M22 150C30 80 80 60 112 96" fill="none" stroke="${P.red}" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 22"/>
      <path d="M100 76L126 108L88 112Z" fill="${P.red}"/><circle cx="22" cy="156" r="10" fill="${P.blue}"/>`,
    'field-house': `<circle cx="160" cy="40" r="20" fill="${P.millet}"/>
      <path d="M0 120Q100 100 200 120V200H0Z" fill="${P.green2}"/>
      ${[0, 1, 2, 3, 4].map((i) => `<path d="M${-10 + i * 48} 196L${30 + i * 42} 124" stroke="${P.gold}" stroke-width="13" stroke-linecap="round"/>`).join('')}
      ${house(92, 118, 1.05)}`,
    'tree-hug': `<ellipse cx="100" cy="120" rx="84" ry="54" fill="${P.green3}"/>${house(100, 128, 0.62)}
      ${[[30, 118], [58, 82], [100, 70], [142, 82], [170, 118], [140, 168], [100, 178], [60, 168]].map(([x, y]) => tree(x, y + 14, 0.62)).join('')}
      ${T(100, 30, 0.45, `<use href="#heart" fill="${P.red}"/>`)}`,
    'wall': `<rect x="0" y="150" width="200" height="50" fill="${P.green2}"/>
      <path d="M14 152V92H40V78H62V92H90V78H112V92H140V78H162V92H186V152Z" fill="${P.earth}"/>
      <path d="M14 112H186M14 132H186M50 92V112M100 92V112M150 92V112M74 112V132M126 112V132" stroke="${P.wood}" stroke-width="3" opacity=".6"/>
      ${T(170, 160, 0.7, '<use href="#grass"/>')}${T(30, 160, 0.6, '<use href="#grass"/>')}`,
    'slanted-hill': `<path d="M0 190L200 52V200H0Z" fill="${P.hill}"/><path d="M0 200L130 112L200 140V200Z" fill="${P.hill2}"/>
      <path d="M8 168L190 46" stroke="${P.red}" stroke-width="7" stroke-dasharray="14 12" stroke-linecap="round"/>
      <path d="M176 38L198 40L188 60Z" fill="${P.red}"/>`,
    'window': `<rect x="26" y="22" width="148" height="160" rx="12" fill="${P.wood2}"/><rect x="40" y="36" width="120" height="132" fill="${P.sky1}"/>
      <path d="M40 130Q100 110 160 130V168H40Z" fill="${P.gold}"/><circle cx="130" cy="66" r="14" fill="${P.millet}"/>
      <rect x="10" y="36" width="34" height="132" fill="url(#pLattice)"/><rect x="156" y="36" width="34" height="132" fill="url(#pLattice)"/>
      <rect x="8" y="34" width="38" height="136" fill="none" stroke="${P.wood2}" stroke-width="5"/><rect x="154" y="34" width="38" height="136" fill="none" stroke="${P.wood2}" stroke-width="5"/>`,
    'eyes-look': `<rect x="120" y="40" width="70" height="80" rx="8" fill="${P.wood2}"/><rect x="130" y="50" width="50" height="60" fill="${P.sky1}"/><path d="M130 94Q155 86 180 94V110H130Z" fill="${P.green2}"/>
      <ellipse cx="44" cy="120" rx="30" ry="36" fill="#fff"/><ellipse cx="96" cy="120" rx="30" ry="36" fill="#fff"/>
      <circle cx="58" cy="112" r="15" fill="${P.ink}"/><circle cx="110" cy="112" r="15" fill="${P.ink}"/><circle cx="63" cy="106" r="5" fill="#fff"/><circle cx="115" cy="106" r="5" fill="#fff"/>
      <path d="M126 150L150 132" stroke="${P.red}" stroke-width="7" stroke-linecap="round" stroke-dasharray="4 10"/>`,
    'grain-yard': `<path d="M8 96Q100 72 192 96V184Q100 196 8 184Z" fill="url(#pGrainBig)"/>
      <g transform="translate(150,40) rotate(30)"><rect x="-5" y="0" width="10" height="110" rx="4" fill="${P.wood}"/><rect x="-26" y="104" width="52" height="10" rx="4" fill="${P.wood2}"/>${[-22, -11, 0, 11, 22].map((x) => `<rect x="${x - 2}" y="112" width="4" height="14" fill="${P.wood2}"/>`).join('')}</g>
      <circle cx="40" cy="44" r="18" fill="${P.millet}"/>`,
    'vegetable-garden': `<path d="M6 80H194V190H6Z" fill="${P.wood}" rx="10"/>
      ${[0, 1, 2].map((r) => `<rect x="6" y="${92 + r * 34}" width="188" height="10" fill="${P.wood2}" opacity=".35"/>`).join('')}
      ${[[40, 110], [100, 110], [160, 110], [70, 150], [130, 150]].map(([x, y]) => T(x, y, 0.62, '<use href="#cabbage"/>')).join('')}
      ${[[30, 184], [100, 186], [170, 184]].map(([x, y]) => T(x, y, 0.6, '<use href="#radish"/>')).join('')}`,
    'hand-cup': `<g transform="translate(100,96) scale(2.3)">${G.cup('wine')}</g>
      <path d="M44 150C40 120 60 104 84 108L150 108C160 108 164 120 154 124L120 128C140 130 140 146 124 146H70Z" fill="${P.skin}"/>
      <path d="M84 120H140M80 134H128" stroke="#E8BFA0" stroke-width="4" stroke-linecap="round"/>
      <rect x="20" y="138" width="40" height="40" rx="10" fill="${P.green}"/>
      ${G.steam('', 40, P.ink2).replace('<path', '<path transform="translate(92,30) scale(.6)"')}${G.steam('', 40, P.ink2).replace('<path', '<path transform="translate(112,26) scale(.6)"')}`,
    'speech-bubbles': `<path d="M14 30H110Q124 30 124 44V92Q124 106 110 106H52L30 128L36 106H28Q14 106 14 92V44Q14 30 28 30Z" fill="${P.red}"/>
      <path d="M88 92H172Q186 92 186 106V150Q186 164 172 164H164L170 186L146 164H102Q88 164 88 150V106Q88 92 102 92Z" fill="${P.blue}"/>
      <circle cx="44" cy="68" r="7" fill="#fff"/><circle cx="68" cy="68" r="7" fill="#fff"/><circle cx="92" cy="68" r="7" fill="#fff"/>
      <circle cx="116" cy="128" r="7" fill="#fff"/><circle cx="138" cy="128" r="7" fill="#fff"/><circle cx="160" cy="128" r="7" fill="#fff"/>`,
    'mulberry-hemp': `<g transform="translate(62,104)"><path d="M0 64C-50 30-54-20-30-50C-10-36 0-50 0-64C0-50 10-36 30-50C54-20 50 30 0 64Z" fill="${P.green}"/><path d="M0 64V-50M0 10L-28-18M0 30L26 4" stroke="${P.green2}" stroke-width="5" fill="none"/>
        ${[[-20, 46], [-8, 52], [-14, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${P.dusk3}"/>`).join('')}</g>
      <g transform="translate(146,186)"><rect x="-4" y="-170" width="8" height="170" fill="${P.green}"/>
        ${[[-120, 0.9], [-80, 1], [-40, 1.05]].map(([y, s]) => `<g transform="translate(0,${y}) scale(${s})">${[-60, -30, 0, 30, 60].map((r) => `<path d="M0 0C-6-14-4-30 0-40C4-30 6-14 0 0Z" fill="${P.green2}" transform="rotate(${r})"/>`).join('')}</g>`).join('')}</g>`,
    'hourglass': `<rect x="44" y="18" width="112" height="18" rx="8" fill="${P.wood2}"/><rect x="44" y="164" width="112" height="18" rx="8" fill="${P.wood2}"/>
      <rect x="54" y="34" width="8" height="132" fill="${P.wood}"/><rect x="138" y="34" width="8" height="132" fill="${P.wood}"/>
      <path d="M68 36H132C132 76 108 88 104 100C108 112 132 124 132 164H68C68 124 92 112 96 100C92 88 68 76 68 36Z" fill="#fff" opacity=".85"/>
      <path d="M78 60H122C116 76 104 84 100 92C96 84 84 76 78 60Z" fill="${P.millet}"/><path d="M74 164C76 140 96 132 100 132C104 132 124 140 126 164Z" fill="${P.millet}"/>
      <path d="M100 96V132" stroke="${P.millet}" stroke-width="4" stroke-dasharray="4 5"/>`,
    'calendar-99': `<rect x="30" y="28" width="140" height="150" rx="14" fill="#fff"/><rect x="30" y="28" width="140" height="44" rx="14" fill="${P.red}"/><rect x="30" y="56" width="140" height="16" fill="${P.red}"/>
      <circle cx="64" cy="28" r="7" fill="${P.ink2}"/><circle cx="136" cy="28" r="7" fill="${P.ink2}"/>
      <text x="100" y="62" text-anchor="middle" class="kai" font-size="30" fill="#fff">九月</text>
      <text x="100" y="142" text-anchor="middle" class="kai" font-size="58" fill="${P.ink}">初九</text>
      ${mum(166, 166, 0.55)}`,
    'return-arrow': `${house(100, 130, 0.9, P.ink2)}
      <path d="M40 120A64 64 0 1 1 100 164" fill="none" stroke="${P.blue}" stroke-width="13" stroke-linecap="round"/>
      <path d="M18 108L44 140L62 104Z" fill="${P.blue}"/>`,
    'smell-flower': `${mum(140, 112, 1.05)}<path d="M140 160V196" stroke="${P.green}" stroke-width="8"/>
      <g transform="translate(46,108)"><circle r="40" fill="${P.ink}"/><circle cx="4" cy="4" r="36" fill="${P.skin}"/><path d="M-36-6C-36-40 30-46 40-6C28-24-10-26-36-6Z" fill="${P.ink}"/>
      <path d="M8 6Q18 0 28 6" stroke="${P.ink}" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="20" rx="7" ry="4" fill="${P.blush}"/><circle cx="34" cy="10" r="5" fill="#E8BFA0"/></g>
      <path d="M90 92Q96 86 90 80Q84 74 90 68M102 120Q108 114 102 108Q96 102 102 96" stroke="${P.mum2}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    'chrysanthemum': `<path d="M100 120V196" stroke="${P.green}" stroke-width="10"/>${T(100, 172, 1, '<use href="#leafPair"/>')}${mum(100, 90, 1.5)}`
  };

  // extra hint pictures (frames / blanks)
  I['millet-bowl'] = `<g transform="translate(100,112) scale(1.15)">${G.bowlMillet()}</g>`;
  I['chicken'] = `<g transform="translate(108,160) scale(1.7)">${G.chicken()}</g>`;
  I['pinky'] = `<path d="M-10 136C20 96 60 90 92 100L100 104L60 130Z" fill="${P.red}"/><path d="M210 136C180 96 140 90 108 100L100 104L140 130Z" fill="${P.blue}"/>
      <circle cx="80" cy="106" r="22" fill="${P.skin}"/><circle cx="120" cy="106" r="22" fill="${P.skin}"/>
      <path d="M92 92C92 70 112 66 112 84" stroke="${P.skin}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M108 92C108 72 88 70 88 86" stroke="#F1C9AA" stroke-width="12" fill="none" stroke-linecap="round"/>
      ${T(100, 46, 0.6, `<use href="#star4" fill="${P.gold}"/>`)}${T(150, 60, 0.4, `<use href="#star4" fill="${P.mum}"/>`)}${T(52, 62, 0.35, `<use href="#star4" fill="${P.mum}"/>`)}`;
  I['mountain-giant'] = `<path d="M0 190L200 60V200H0Z" fill="${P.hill}"/><path d="M60 150Q74 140 88 150M112 132Q126 122 140 132" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M92 164Q108 176 122 160" stroke="${P.ink}" stroke-width="5" fill="none" stroke-linecap="round"/><text x="150" y="70" class="kai" font-size="36" fill="${P.hill2}">Zz</text>`;

  G.ICONS = I;
  G.iconInner = (name) => I[name] || `<circle cx="100" cy="100" r="60" fill="${P.paper2}"/>`;
  G.icon = (name, cls) => `<svg viewBox="0 0 200 200" class="${cls || 'icon'}" aria-hidden="true">${G.iconInner(name)}</svg>`;
  /** icon placed inside a scene svg, centred at (x,y) with size px */
  G.iconAt = (name, x, y, size, cls) => G.A(x, y, `<g transform="scale(${G.r(size / 200)}) translate(-100,-100)">${G.iconInner(name)}</g>`, cls || 'a');
})();
