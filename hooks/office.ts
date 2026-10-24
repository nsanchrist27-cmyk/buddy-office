// The pixel-art office: a top-down map of rooms, and the critters who sit, walk and rest in it.
// Pure drawing: no `$`, only strings of SVG.
import type { Mood } from '../types'

export type Pt = [number, number]
export type Pose = 'sit' | 'stand' | 'lie'

export type Sprite = {
  name: string
  look: number
  mood: Mood
  at: Pt
  pose: Pose
  status: string
  statusColor: string
  // Walking: the waypoints that end at `at`, and the ms since they set off.
  route?: Pt[]
  elapsed?: number
  seat?: number
  bubble?: string
  isChat?: boolean
  pct?: number
  hat?: string
  hasCrown?: boolean
  stage?: number
  isFocused?: boolean
}

export const W = 160
export const H = 364
const SPEED = 0.08 // map units per ms

// Body and belly of each critter; look 0 is buddy's fox.
export const LOOKS = [
  { body: '#ff9f1c', belly: '#ffd166', ears: ['..B......B..', '..BB....BB..', '..BBB..BBB..'] },
  { body: '#ff70a6', belly: '#ffd6e8', ears: ['...BB..BB...', '...BL..LB...', '...BL..LB...'] },
  { body: '#38b000', belly: '#ccff33', ears: ['............', '..BBB..BBB..', '..BEB..BEB..'], eyesOnTop: true },
  { body: '#a0522d', belly: '#f4a261', ears: ['............', '..BB....BB..', '..BL....LB..'] },
  { body: '#3a86ff', belly: '#bde0fe', ears: ['.....R......', '.....A......', '.....A......'] },
  { body: '#9d4edd', belly: '#e0aaff', ears: ['............', '............', '.....BB.....'] },
  { body: '#ef233c', belly: '#ffccd5', ears: ['...Y.YY.Y...', '...YYYYYY...', '............'] },
  { body: '#00b4d8', belly: '#caf0f8', ears: ['............', 'B..........B', '.BB......BB.'] },
]

// One tall map for a tall pane, top to bottom: terrace and kitchen, a bridge, the lounge,
// a bridge, the open space, the front door. Desks: buddy's is 0, two desks a row either side of the aisle.
const AISLE = 80
export const DOOR: Pt = [AISLE, 364]
export const NAP: Pt = [26, 50]
export const COFFEE: Pt = [116, 58]
const ROWS = [222, 256, 290, 324]
export const SEATS: Pt[] = ROWS.flatMap(y => [30, 60, 100, 130].map((x): Pt => [x, y]))
export const RESTS: { at: Pt; pose: Pose }[] = [
  { at: [52, 128], pose: 'sit' }, { at: [80, 128], pose: 'sit' }, { at: [108, 128], pose: 'sit' },
  { at: [50, 50], pose: 'sit' },
  { at: [100, 76], pose: 'stand' }, { at: [134, 76], pose: 'stand' },
  { at: [24, 170], pose: 'stand' }, { at: [136, 170], pose: 'stand' }, { at: [136, 146], pose: 'stand' },
]
// Where someone stands when every desk is taken.
export const spare = (i: number): Pt => [20 + (i % 6) * 24, 150]

// Floors from the bottom up: 0 outside, 1 open space, 2 lounge, 3 terrace and kitchen.
const level = ([, y]: Pt) => (y > 340 ? 0 : y > 186 ? 1 : y > 94 ? 2 : 3)
// The way up from each floor to the next: through its door, over the bridge.
const STAIRS: Pt[][] = [
  [[AISLE, 352], [AISLE, 334]],
  [[AISLE, 200], [AISLE, 186], [AISLE, 172]],
  [[AISLE, 108], [AISLE, 94], [AISLE, 80]],
]
// In the open space, a desk is reached up the aisle, then along the lane behind its row of chairs.
const lane = (p: Pt): Pt[] => (level(p) === 1 && p[1] < 334 ? [[p[0], p[1] - 16], [AISLE, p[1] - 16]] : [])

// The way from one spot to another, walked through doors, over bridges and up the aisle.
export const route = (from: Pt, to: Pt): Pt[] => {
  const a = level(from)
  const b = level(to)
  const stairs: Pt[] = []
  if (a < b) for (let i = a; i < b; i++) stairs.push(...STAIRS[i]!)
  else for (let i = a - 1; i >= b; i--) stairs.push(...STAIRS[i]!.slice().reverse())
  if (a === b && a !== 1) return [from, to]
  return [from, ...lane(from), ...stairs, ...lane(to).reverse(), to]
}

const dist = (p: Pt[]) => p.slice(1).reduce((d, q, i) => d + Math.hypot(q[0] - p[i]![0], q[1] - p[i]![1]), 0)
export const walkMs = (p: Pt[]) => dist(p) / SPEED

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`

// A pixel grid ({ "col,row": color }) as one path per color, neighbours merged into runs, so a sprite stays small.
const paths = (px: Map<string, string>, ox: number, oy: number) => {
  const byColor = new Map<string, string[]>()
  const cells = [...px].map(([k, c]) => [...k.split(',').map(Number), c] as [number, number, string])
  cells.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  for (let i = 0; i < cells.length; ) {
    const [x, y, c] = cells[i]!
    let n = 1
    while (cells[i + n] && cells[i + n]![1] === y && cells[i + n]![0] === x + n && cells[i + n]![2] === c) n++
    byColor.set(c, [...(byColor.get(c) ?? []), `M${x + ox} ${y + oy}h${n}v1h-${n}z`])
    i += n
  }
  return [...byColor].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('')
}

const INK = '#2b2118'

// One critter, feet at (0, 0), facing the viewer.
const critter = (s: Sprite) => {
  const look = LOOKS[s.look % LOOKS.length]!
  const pal: Record<string, string> = {
    B: look.body, L: look.belly, E: INK, C: '#ff8fab', R: '#ef233c', A: '#adb5bd', Y: '#ffd166', N: '#8d6e63', K: INK, G: '#ffbe0b',
  }
  const shut = s.mood === 'sleep' || s.mood === 'ko'
  const body = [
    '...BBBBBB...',
    s.isFocused ? '..RRRRRRRR..' : '..BBBBBBBB..',
    look.eyesOnTop || shut ? '..BBBBBBBB..' : s.hat === 'glasses' ? '.KEKBBBBKEK.' : '..BEBBBBEB..',
    '..CBBBBBBC..',
    s.mood === 'joy' ? '...BBEEBB...' : s.mood === 'oops' || s.mood === 'ko' ? '...BEBBEB...' : '...BBBBBB...',
    '..BLLLLLLB..',
    '.BBLLLLLLBB.',
    '.BBLLLLLLBB.',
    '..BLLLLLLB..',
    '...LL..LL...',
  ]
  const top = s.hat === 'cap' ? ['............', '...NNNNNN...', '..NNNNNNNNN.'] : s.hat === 'helmet' ? ['.....GG.....', '...GGGGGG...', '..GGGGGGGG..'] : look.ears
  const crown = s.hasCrown ? ['...Y.YY.Y...', '...YYYYYY...'] : []
  const rows = [...crown, ...top, ...body]
  const px = new Map<string, string>()
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) px.set(`${x},${y}`, pal[ch]!) }))
  // A one-pixel outline, golden for the veterans.
  const edge = new Map<string, string>()
  for (const k of px.keys()) {
    const [x, y] = k.split(',').map(Number) as [number, number]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = `${x + dx},${y + dy}`
      if (!px.has(n)) edge.set(n, s.stage === 3 ? '#ffd700' : INK)
    }
  }
  const scale = [0.85, 1, 1.15, 1.15][s.stage ?? 1]
  const art = paths(edge, -6, -rows.length) + paths(px, -6, -rows.length)
  const motion = s.route ? 'walk' : { joy: 'jump', oops: 'shake', type: 'tap', run: 'tap' }[s.mood as string] ?? 'bob'
  const lie = s.pose === 'lie' ? ' transform="rotate(90 0 -6)"' : ''
  return `<g transform="scale(${scale})"><g class="${motion}"><g${lie}>${art}</g></g></g>`
}

// What floats around a critter: z's, stars, sweat.
const extras = (s: Sprite) => {
  if (s.mood === 'sleep') return '<text class="z" x="5" y="-14">z</text><text class="z z2" x="9" y="-19">z</text>'
  if (s.mood === 'joy') return ['#ffbe0b', '#ff006e', '#3a86ff', '#06d6a0'].map((c, i) => r([-10, 9, -8, 10][i]!, [-14, -12, -4, -2][i]!, 2, 2, c, ` class="tw" style="animation-delay:${i * 0.2}s"`)).join('')
  if (s.mood === 'ko') return `<g class="orbit">${r(-6, -2, 2, 2, '#ffbe0b')}${r(5, -4, 2, 2, '#ffbe0b')}${r(0, 2, 2, 2, '#ffbe0b')}</g>`
  if (s.mood === 'oops') return r(7, -14, 2, 3, '#4cc9f0', ' class="drop"')
  return ''
}

// Bubble, status pill and name tag stacked over the head, as in a virtual office.
const pill = (y: number, text: string, bg: string, fg: string, size: number) => {
  const w = Math.round(text.length * size * 0.62 + 6)
  return `<rect x="${-w / 2}" y="${y}" width="${w}" height="${size + 3}" rx="${(size + 3) / 2}" fill="${bg}"/><text x="0" y="${y + size + 0.6}" text-anchor="middle" style="font:bold ${size}px monospace" fill="${fg}">${esc(text)}</text>`
}
const labels = (s: Sprite) => {
  const name = s.pct === undefined ? s.name : `${s.name} ${s.pct}%`
  const bubble = s.bubble
    ? (() => {
        const t = s.bubble.length > 13 ? `${s.bubble.slice(0, 12)}…` : s.bubble
        const w = Math.round(t.length * 2.5 + 6)
        const bg = s.isChat ? '#ff70a6' : '#fff'
        return `<rect x="${-w / 2}" y="-38" width="${w}" height="7.5" rx="2.5" fill="${bg}" stroke="${s.isChat ? '#ff70a6' : '#ced4da'}" stroke-width=".5"/><path d="M-1.5 -30.7 l1.5 2.2 l1.5 -2.2 Z" fill="${bg}"/><text x="0" y="-32.6" text-anchor="middle" style="font:${s.isChat ? 'bold ' : ''}4.1px sans-serif" fill="${s.isChat ? '#fff' : INK}">${esc(t)}</text>`
      })()
    : ''
  return `${bubble}${pill(-27.5, s.status, s.statusColor, '#fff', 3.2)}${pill(-22, name, '#1d3557', '#fff', 3.5)}`
}

// Moves a group along its route, resuming where it stands on this redraw.
const walker = (s: Sprite, i: number, layer: string, inner: string) => {
  const [x, y] = s.at
  const still = `transform:translate(${x}px,${y}px)`
  if (!s.route || s.elapsed === undefined) return `<g style="${still}">${inner}</g>`
  const total = dist(s.route)
  let run = 0
  const frames = s.route.map((p, k) => {
    if (k > 0) run += Math.hypot(p[0] - s.route![k - 1]![0], p[1] - s.route![k - 1]![1])
    return `${((run / total) * 100).toFixed(1)}%{transform:translate(${p[0]}px,${p[1]}px)}`
  }).join('')
  return `<style>@keyframes ${layer}${i}{${frames}}</style><g style="${still};animation:${layer}${i} ${Math.round(walkMs(s.route))}ms linear ${-Math.round(s.elapsed)}ms both">${inner}</g>`
}

const SCREEN: Record<Mood, string> = {
  type: '#4cc9f0', read: '#f8f9fa', run: '#38b000', search: '#ffd166', joy: '#06d6a0', oops: '#f77f00', ko: '#3a86ff', sleep: '#343a40',
}

const tree = (x: number, y: number) =>
  `${r(x - 1, y + 8, 3, 4, '#7f5539')}${r(x - 6, y + 2, 13, 7, '#2d6a4f')}${r(x - 5, y - 2, 11, 5, '#40916c')}${r(x - 3, y - 5, 7, 4, '#52b788')}${r(x - 1, y - 7, 3, 3, '#74c69d')}`

const plant = (x: number, y: number) =>
  `${r(x - 3, y, 6, 5, '#bc4749')}${r(x - 4, y - 6, 3, 6, '#40916c')}${r(x + 1, y - 7, 3, 7, '#52b788')}${r(x - 1, y - 9, 2, 9, '#2d6a4f')}`

// Floors, walls and furniture: everything that never moves.
const WALL = '#343a40'
// A room's four walls, with door gaps ([from, to] in x) in the top and bottom walls.
const walls = (x: number, y: number, w: number, h: number, top: number[][] = [], bottom: number[][] = []) => {
  const side = (yy: number, gaps: number[][]) => {
    const cuts = [x, ...gaps.flat(), x + w]
    return cuts.flatMap((c, i) => (i % 2 ? [] : [r(c, yy, cuts[i + 1]! - c, 2, WALL)])).join('')
  }
  return `${side(y, top)}${side(y + h - 2, bottom)}${r(x, y, 2, h, WALL)}${r(x + w - 2, y, 2, h, WALL)}`
}
const water = (y: number) =>
  `${r(0, y, W, 16, '#48cae4')}${[...Array(8).keys()].map(i => r(8 + i * 19 + (i % 2) * 6, y + 4 + (i % 3) * 3, 6, 1, '#ade8f4', ' class="wave"')).join('')}`
// A plank bridge over the water, between two doors.
const bridge = (y: number) =>
  `${r(AISLE - 9, y - 2, 18, 20, '#b08968')}${[...Array(6).keys()].map(i => r(AISLE - 9, y - 1 + i * 3.3, 18, 0.7, '#7f5539')).join('')}${r(AISLE - 10, y - 2, 2, 20, '#7f5539')}${r(AISLE + 8, y - 2, 2, 20, '#7f5539')}`

const map = (hour: number) => {
  const grass = hour >= 6 && hour < 20 ? '#95d5b2' : '#74a98d'
  // Each floor is one rect filled with a repeating pattern.
  const floorOf = (id: string, x: number, y: number, w: number, h: number) => r(x, y, w, h, `url(#${id})`)
  const checks = floorOf('check', 12, 198, 136, 138)
  const desks = ROWS.map(y => r(14, y + 2, 62, 11, '#f8f9fa', ' stroke="#ced4da" stroke-width=".8"') + r(84, y + 2, 62, 11, '#f8f9fa', ' stroke="#ced4da" stroke-width=".8"')).join('')
  return {
    floor: `
<defs>
  <pattern id="wood" width="8" height="6" patternUnits="userSpaceOnUse">${r(0, 0, 8, 0.6, '#c9a26b')}</pattern>
  <pattern id="terra" width="8" height="8" patternUnits="userSpaceOnUse">${r(0, 0, 8, 0.6, '#c08552')}${r(0, 0, 0.6, 8, '#c08552')}</pattern>
  <pattern id="tile" width="8" height="8" patternUnits="userSpaceOnUse">${r(0, 0, 8, 0.6, '#dee2e6')}${r(0, 0, 0.6, 8, '#dee2e6')}</pattern>
  <pattern id="check" width="12.4" height="12.2" patternUnits="userSpaceOnUse">${r(6.2, 0, 6.2, 6.1, '#cdd6e0')}${r(0, 6.1, 6.2, 6.1, '#cdd6e0')}</pattern>
</defs>
${r(0, 0, W, H, grass)}
${[...Array(8).keys()].map(i => tree(10 + i * 20, 4)).join('')}
${water(86)}${water(178)}
${r(10, 16, 70, 68, '#d4a373')}${floorOf('terra', 10, 16, 70, 68)}
${r(80, 16, 70, 68, '#f1f3f5')}${floorOf('tile', 80, 16, 70, 68)}
${walls(8, 14, 144, 72, [], [[72, 88]])}${r(79, 14, 2, 42, WALL)}
${[0, 1, 2, 3].map(i => r(12 + i * 8, 18, 6, 6, ['#ffafcc', '#cdb4db', '#a2d2ff', '#ffc8dd'][i]!) + r(13 + i * 8, 24, 4, 3, '#bc4749')).join('')}
${r(48, 17, 28, 2, '#b08968')}
<ellipse cx="26" cy="47" rx="9" ry="7" fill="#ffd166"/><ellipse cx="50" cy="47" rx="9" ry="7" fill="#ffd166"/>
${[[24, 74], [58, 74]].map(([x, y]) => `${r(x! - 7, y! - 5, 14, 10, '#f8f9fa')}${r(x! - 11, y! - 3, 3, 6, '#95d5b2')}${r(x! + 8, y! - 3, 3, 6, '#95d5b2')}${r(x! - 2, y! - 2, 4, 4, '#ff9f1c')}`).join('')}
${r(82, 16, 50, 13, '#8d6e63')}${r(85, 18, 10, 8, '#adb5bd')}${r(112, 17, 7, 9, '#212529')}${r(114, 19, 3, 2, '#ef233c')}${r(124, 19, 6, 6, '#6c757d')}${r(136, 16, 14, 22, '#e9ecef', ' stroke="#adb5bd" stroke-width=".6"')}
${plant(144, 78)}
${bridge(86)}
${r(10, 104, 140, 72, '#deb887')}${floorOf('wood', 10, 104, 140, 72)}
${walls(8, 102, 144, 76, [[72, 88]], [[72, 88]])}
${r(32, 110, 96, 7, '#52796f')}${r(30, 110, 4, 22, '#52796f')}${r(126, 110, 4, 22, '#52796f')}${r(34, 117, 92, 12, '#84a98c')}
<ellipse cx="80" cy="158" rx="30" ry="10" fill="#4d7ea8"/>${r(70, 153, 20, 10, '#f8f9fa')}${r(78, 156, 4, 4, '#ff70a6')}
${r(144, 120, 5, 40, '#6d4c41')}${plant(16, 114)}${plant(144, 170)}${plant(16, 170)}
${bridge(178)}
${r(10, 196, 140, 142, '#e8d5c4')}${r(12, 198, 136, 138, '#f8f9fa')}${checks}
${r(76, 198, 8, 138, '#e8d5c4')}
${walls(8, 194, 144, 146, [[72, 88]], [[72, 88]])}
${r(AISLE - 6, 340, 12, 24, '#adb5bd')}${[...Array(4).keys()].map(i => r(AISLE - 5, 342 + i * 6, 10, 4, '#ced4da')).join('')}
${tree(20, 352)}${tree(46, 356)}${tree(114, 356)}${tree(140, 352)}
${SEATS.map(([x, y]) => r(x - 6, y - 12, 12, 9, '#e9ecef', ' rx="3"')).join('')}`,
    front: desks,
  }
}

const STYLE = `<style>
  .bob{animation:bob 1s steps(2) infinite}
  @keyframes bob{50%{transform:translateY(-1px)}}
  .tap{animation:bob .3s steps(2) infinite}
  .walk{animation:bob .25s steps(2) infinite}
  .jump{animation:jp .45s ease-in-out infinite alternate}
  @keyframes jp{to{transform:translateY(-5px)}}
  .shake{animation:sh .12s steps(2) infinite}
  @keyframes sh{50%{transform:translateX(1px)}}
  .z{font:bold 6px monospace;fill:#8338ec;animation:z 2s infinite;opacity:0}
  .z2{animation-delay:1s}
  @keyframes z{0%{opacity:0;transform:translateY(3px)}50%{opacity:1}100%{opacity:0;transform:translateY(-5px)}}
  .tw{animation:tw .8s steps(2) infinite}
  @keyframes tw{50%{opacity:.1}}
  .orbit{animation:or 1.2s steps(8) infinite}
  @keyframes or{to{transform:rotate(360deg)}}
  .drop{animation:dr .8s infinite}
  @keyframes dr{to{transform:translateY(4px);opacity:0}}
  .wave{animation:wv 1.6s steps(2) infinite}
  @keyframes wv{50%{transform:translateX(3px)}}
  .scr{animation:gl .5s steps(2) infinite}
  @keyframes gl{50%{opacity:.55}}
</style>`

// The office, whole or cropped to `view` ([x, y, w, h]).
export const office = (sprites: Sprite[], hour: number, view: [number, number, number, number] = [0, 0, W, H]) => {
  const { floor, front } = map(hour)
  const night = hour >= 21 || hour < 6
  const seated = new Map(sprites.filter(s => s.seat !== undefined && !s.route).map(s => [s.seat!, s]))
  const laptops = SEATS.map(([x, y], i) => {
    const s = seated.get(i)
    const glow = s ? SCREEN[s.mood] : '#343a40'
    return `${r(x - 5, y + 3, 10, 7, '#adb5bd', ' rx="1"')}${r(x - 4, y + 4, 8, 4, glow, s && s.mood !== 'sleep' ? ' class="scr"' : '')}`
  }).join('')
  // Seated people go behind the desks; everyone else is drawn in front, back to front.
  const order = sprites.map((s, i) => ({ s, i })).sort((a, b) => a.s.at[1] - b.s.at[1])
  const behind = order.filter(({ s }) => s.pose !== 'stand' && !s.route && s.seat !== undefined)
  const ahead = order.filter(({ s }) => !(s.pose !== 'stand' && !s.route && s.seat !== undefined))
  const body = ({ s, i }: { s: Sprite; i: number }) => walker(s, i, 'b', `${critter(s)}${extras(s)}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.join(' ')}" width="${view[2] * 2}" height="${view[3] * 2}" shape-rendering="crispEdges">
${STYLE}
${floor}
${behind.map(body).join('')}
${front}
${laptops}
${ahead.map(body).join('')}
${night ? r(0, 0, W, H, '#0b132b', ' opacity=".3"') : ''}
<g shape-rendering="auto">${order.map(({ s, i }) => walker(s, i, 'l', labels(s))).join('')}</g>
</svg>`
}
