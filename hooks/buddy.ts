// buddy as he first was: the vector fox above the prompt, miming what Claude does.
import type { Mood } from '../types'

// Props drawn in front of the character, per mood; the character itself is shared.
const PROPS: Record<Mood, string> = {
  sleep: `
    <text class="z z1" x="78" y="30">Z</text><text class="z z2" x="90" y="22">z</text><text class="z z3" x="100" y="16">z</text>`,
  type: `
    <rect x="18" y="66" width="64" height="12" rx="3" fill="#3a86ff"/>
    <g class="keys">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${22 + i * 10}" y="69" width="7" height="5" rx="1" fill="#fff"/>`).join('')}</g>
    <circle class="hand hl" cx="36" cy="64" r="5" fill="#ff9f1c"/><circle class="hand hr" cx="64" cy="64" r="5" fill="#ff9f1c"/>`,
  read: `
    <path d="M50 58 L26 54 L26 76 L50 80 Z" fill="#06d6a0"/><path d="M50 58 L74 54 L74 76 L50 80 Z" fill="#118ab2"/>
    <path class="page" d="M50 58 L72 55 L72 75 L50 79 Z" fill="#fff" opacity=".9"/>`,
  run: `
    <g class="speed"><rect x="0" y="40" width="14" height="3" rx="1.5" fill="#8ecae6"/><rect x="4" y="52" width="10" height="3" rx="1.5" fill="#8ecae6"/></g>
    <rect class="leg l1" x="40" y="74" width="7" height="14" rx="3" fill="#ff006e"/><rect class="leg l2" x="53" y="74" width="7" height="14" rx="3" fill="#ff006e"/>`,
  search: `
    <g class="glass"><circle cx="78" cy="44" r="11" fill="#bde0fe" fill-opacity=".6" stroke="#ffbe0b" stroke-width="4"/>
    <rect x="86" y="52" width="5" height="16" rx="2" fill="#8338ec" transform="rotate(-40 88 54)"/></g>`,
  joy: [[14, 18, '#ffbe0b'], [86, 14, '#ff006e'], [8, 52, '#3a86ff'], [94, 48, '#06d6a0'], [50, 4, '#8338ec']]
    .map(([x, y, c], i) => `<path class="star" style="animation-delay:${i * 0.15}s;transform-origin:${x}px ${y}px" fill="${c}"
      d="M${x} ${Number(y) - 7} L${Number(x) + 2} ${Number(y) - 2} L${Number(x) + 7} ${y} L${Number(x) + 2} ${Number(y) + 2} L${x} ${Number(y) + 7} L${Number(x) - 2} ${Number(y) + 2} L${Number(x) - 7} ${y} L${Number(x) - 2} ${Number(y) - 2} Z"/>`)
    .join(''),
  // Added later: a failed call, a crashed turn.
  oops: '<path class="drop" d="M74 38 q4 6 0 9 q-4 -3 0 -9 Z" fill="#4cc9f0"/>',
  ko: `<g class="orbit">${['#ffbe0b', '#ff006e', '#3a86ff'].map((c, i) => `<text x="${50 + 22 * Math.cos(i * 2.1)}" y="${28 + 8 * Math.sin(i * 2.1)}" style="font:12px sans-serif" fill="${c}" text-anchor="middle">★</text>`).join('')}</g>`,
}

export const buddySvg = (m: Mood) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 92" width="110" height="92">
<style>
  .z{font:bold 12px sans-serif;fill:#8338ec;animation:z 2.4s infinite;opacity:0}
  .z2{animation-delay:.8s}.z3{animation-delay:1.6s}
  @keyframes z{0%{opacity:0;transform:translateY(6px)}50%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
  .breathe{animation:br 3s ease-in-out infinite;transform-origin:50px 80px}
  @keyframes br{50%{transform:scale(1.04,.96)}}
  .hl{animation:tap .25s infinite alternate}.hr{animation:tap .25s .12s infinite alternate}
  @keyframes tap{to{transform:translateY(4px)}}
  .keys rect{animation:key .5s infinite}.keys rect:nth-child(odd){animation-delay:.25s}
  @keyframes key{50%{fill:#ffbe0b}}
  .page{animation:flip 2s infinite;transform-origin:50px 68px}
  @keyframes flip{0%,60%{transform:scaleX(1)}80%{transform:scaleX(-1)}100%{transform:scaleX(-1);opacity:0}}
  .eyes-read{animation:look 2s ease-in-out infinite}
  @keyframes look{0%,100%{transform:translateX(-2px)}50%{transform:translateX(2px)}}
  .bounce{animation:bo .3s infinite alternate}
  @keyframes bo{to{transform:translateY(-4px)}}
  .l1{animation:leg .3s infinite alternate;transform-origin:43px 74px}.l2{animation:leg .3s infinite alternate-reverse;transform-origin:56px 74px}
  @keyframes leg{from{transform:rotate(30deg)}to{transform:rotate(-30deg)}}
  .speed{animation:sp .3s infinite}
  @keyframes sp{50%{transform:translateX(-4px);opacity:.4}}
  .glass{animation:sw 2.4s ease-in-out infinite;transform-origin:50px 50px}
  @keyframes sw{0%,100%{transform:translate(0,0)}25%{transform:translate(-10px,8px)}50%{transform:translate(-30px,0)}75%{transform:translate(-10px,-6px)}}
  .jump{animation:ju .6s cubic-bezier(.3,0,.5,1) infinite alternate}
  @keyframes ju{from{transform:translateY(6px)}to{transform:translateY(-10px)}}
  .star{animation:st 1.2s infinite}
  @keyframes st{0%{transform:scale(0) rotate(0)}50%{transform:scale(1.2) rotate(90deg)}100%{transform:scale(0) rotate(180deg)}}
  .shake{animation:sh .12s infinite alternate}
  @keyframes sh{from{transform:translateX(-2px)}to{transform:translateX(2px)}}
  .tilt{transform:rotate(14deg);transform-origin:50px 80px}
  .orbit{animation:or 1.5s linear infinite;transform-origin:50px 28px}
  @keyframes or{to{transform:rotate(360deg)}}
  .drop{animation:dr 1s infinite}
  @keyframes dr{to{transform:translateY(8px);opacity:0}}
</style>
<g class="${{ run: 'bounce', joy: 'jump', oops: 'shake', ko: 'tilt' }[m as string] ?? 'breathe'}">
  <ellipse cx="50" cy="56" rx="26" ry="24" fill="#ff9f1c"/>
  <ellipse cx="50" cy="64" rx="15" ry="12" fill="#ffd166"/>
  <path d="M30 38 L36 24 L44 34 Z M70 38 L64 24 L56 34 Z" fill="#ff9f1c"/>
  ${m === 'sleep'
    ? '<path d="M38 50 q4 4 8 0 M54 50 q4 4 8 0" stroke="#3d2c1e" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : m === 'ko'
      ? '<path d="M38 45 l8 8 M46 45 l-8 8 M54 45 l8 8 M62 45 l-8 8" stroke="#3d2c1e" stroke-width="2.5" stroke-linecap="round"/>'
      : `<g class="${m === 'read' ? 'eyes-read' : ''}"><circle cx="42" cy="49" r="4.5" fill="#3d2c1e"/><circle cx="58" cy="49" r="4.5" fill="#3d2c1e"/>
       <circle cx="43.5" cy="47.5" r="1.5" fill="#fff"/><circle cx="59.5" cy="47.5" r="1.5" fill="#fff"/></g>`}
  <circle cx="35" cy="57" r="3.5" fill="#ff006e" opacity=".5"/><circle cx="65" cy="57" r="3.5" fill="#ff006e" opacity=".5"/>
  ${m === 'joy'
    ? '<path d="M44 58 q6 8 12 0 Z" fill="#3d2c1e"/>'
    : m === 'sleep' ? '<circle cx="50" cy="60" r="2" fill="#3d2c1e"/>'
      : m === 'oops' || m === 'ko' ? '<path d="M44 61 q2 -3 4 0 q2 3 4 0 q2 -3 4 0" stroke="#3d2c1e" stroke-width="2" fill="none" stroke-linecap="round"/>'
        : '<path d="M46 59 q4 3 8 0" stroke="#3d2c1e" stroke-width="2" fill="none" stroke-linecap="round"/>'}
  ${PROPS[m]}
</g>
</svg>`
