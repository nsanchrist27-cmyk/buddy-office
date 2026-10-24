import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, Mood } from '../types'

import { COFFEE, DOOR, LOOKS, NAP, RESTS, SEATS, W, H, office, route, spare, walkMs } from './office'
import type { Pt, Sprite } from './office'
import { buddySvg } from './buddy'

const mood = atom({ plugin: 'buddy', key: 'mood' } as const, 'sleep')
const doing = atom({ plugin: 'buddy', key: 'doing' } as const, '')
const startedAt = atom({ plugin: 'buddy', key: 'startedAt' } as const, 0)
const agents = atom({ plugin: 'buddy', key: 'agents' } as const, {})
const records = atom({ plugin: 'buddy', key: 'records' } as const, {})

const NAMES = ['Pixel', 'Biscotte', 'Gribouille', 'Noisette', 'Zigzag', 'Pompon', 'Comète', 'Moustache', 'Paprika', 'Tournesol', 'Ricochet', 'Clafoutis']

// What agents say to each other when several work at once.
const CHAT = ["t'as trouvé ?", 'presque !', "je m'en occupe", 'pause café ?', 'regarde ça !', 'on y est presque', 'trop facile', 'à l’aide !']

const FOCUS_MS = 90_000

const PANE = 'buddy-office'
const TITLE = 'Le bureau'

// shortcut: agents report no progress, so the gauge grows with tool calls (capped at 95%) and fills on finish.
const level = (a: Agent) => (a.isDone ? 1 : Math.min(0.95, 1 - Math.exp(-a.calls / 6)))

// Evolution by tasks ever finished under that name: baby, regular, big, golden.
const stage = (done: number) => (done < 3 ? 0 : done < 10 ? 1 : done < 25 ? 2 : 3)

const MOODS: Record<string, Mood> = {
  Write: 'type', Edit: 'type', MultiEdit: 'type', NotebookEdit: 'type',
  Read: 'read',
  Bash: 'run',
  Grep: 'search', Glob: 'search', WebSearch: 'search', WebFetch: 'search',
}

// A Bash command whose pipeline runs a search tool is a search, not a run.
const SEARCH = /(^|[|;&(]\s*)(grep|egrep|fgrep|rg|ag|ack|find|fd|locate)\b/

const LABEL: Record<Mood, string> = {
  sleep: '😴 zzz…', type: '⌨️  tape…', read: '📖 lit…', run: '🏃 court…', search: '🔍 cherche…', joy: '🎉 fini !', oops: '😬 oups…', ko: '😵 K.O.',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// What the bubble says: the file, pattern, query or command the call is about.
const about = (e: Record<string, unknown>) => {
  for (const k of ['file_path', 'notebook_path', 'pattern', 'query', 'url', 'command', 'description', 'path']) {
    const v = e[k]
    if (typeof v === 'string' && v) return clip(k.endsWith('path') ? (v.split('/').pop() ?? v) : v.trim())
  }
  return String(e.tool ?? '')
}

const hat = (kind: string) =>
  /explore/i.test(kind) ? 'cap' : /plan/i.test(kind) ? 'glasses' : kind ? 'helmet' : ''

// shortcut: a hot reload forgets this handle, so a focus loop playing then runs until the session ends.
let focusStop: AbortController | undefined

const play = ($: EngineInterface, asset: string) => {
  // Not awaited: a sound must not hold the turn; a host with no player just stays silent.
  $.audio.play({ asset }).catch(() => {})
}

// Plays the focus loop while anything has worked longer than FOCUS_MS, stops it once all is idle.
const syncFocus = async ($: EngineInterface) => {
  const now = await $.clock.now()
  const busy = [await read($, startedAt), ...Object.values(await read($, agents)).filter(a => !a.isDone).map(a => a.startedAt)].filter(t => t > 0)
  if (!focusStop && busy.some(t => now - t > FOCUS_MS)) {
    focusStop = new AbortController()
    $.audio.play({ asset: 'sounds/focus.wav' }, { shouldLoop: true, gain: 0.3, signal: focusStop.signal }).catch(() => {})
  }
  if (focusStop && busy.length === 0) {
    focusStop.abort()
    focusStop = undefined
  }
}

const isNight = (hour: number) => hour >= 22 || hour < 6

const STATUS: Record<Mood, [string, string]> = {
  sleep: ['RESTING', '#8d99ae'], type: ['TYPING', '#3a86ff'], read: ['READING', '#06a77d'], run: ['RUNNING', '#2b9348'],
  search: ['SEARCHING', '#8338ec'], joy: ['DONE', '#38b000'], oops: ['OOPS', '#f77f00'], ko: ['K.O.', '#d00000'],
}
const THINKING: [string, string] = ['THINKING', '#7b2cbf']
const FOCUS: [string, string] = ['FOCUS', '#ef233c']

// A walk still under way: its route and how far along it is.
const walking = (from: Pt, to: Pt, since: number, now: number) => {
  const path = route(from, to)
  return since > 0 && now - since < walkMs(path) ? { route: path, elapsed: now - since } : {}
}

// Everyone in the office: buddy naps on the terrace or works at desk 0, agents come in, work, then rest.
const scene = async ($: EngineInterface) => {
  const now = await $.clock.now()
  const m = await read($, mood)
  const what = await read($, doing)
  const since = await read($, startedAt)
  const tally = await read($, records)
  const entries = Object.entries(await read($, agents))
  const crew = entries.map(([, a]) => a)
  const working = crew.filter(a => !a.isDone)
  const best = crew.reduce((top, a) => ((tally[a.name] ?? 0) > (tally[top?.name ?? ''] ?? 0) ? a : top), undefined as Agent | undefined)
  const podium = Object.entries(tally).sort((x, y) => y[1] - x[1]).slice(0, 3)

  const isBusy = since > 0
  const bossFocus = isBusy && now - since > FOCUS_MS
  const [bossStatus, bossColor] = bossFocus ? FOCUS : isBusy && m === 'sleep' ? THINKING : STATUS[m]
  const boss: Sprite = {
    name: 'buddy', look: 0, mood: isBusy && m === 'sleep' ? 'read' : m,
    ...(isBusy || m === 'ko'
      ? { at: SEATS[0]!, pose: m === 'ko' ? 'lie' : 'sit', seat: 0 }
      : m === 'joy' ? { at: COFFEE, pose: 'stand' } : { at: NAP, pose: 'sit' }),
    status: bossStatus, statusColor: bossColor,
    bubble: m === 'sleep' ? undefined : what || undefined,
    isFocused: bossFocus,
  }

  const sprites: Sprite[] = crew.map((a, i) => {
    // Several at work: now and then they talk to each other instead of thinking out loud.
    const isChat = working.length >= 2 && !a.isDone && a.calls % 4 === 3
    const focused = !a.isDone && now - a.startedAt > FOCUS_MS
    const [status, statusColor] = focused ? FOCUS : !a.isDone && a.calls === 0 ? THINKING : STATUS[a.mood]
    const desk: Pt = a.seat >= 0 ? SEATS[a.seat]! : spare(i)
    const rest = RESTS[a.rest]
    const place = !a.isDone
      ? { at: desk, pose: 'sit' as const, seat: a.seat >= 0 ? a.seat : undefined, ...walking(DOOR, desk, a.startedAt, now) }
      : a.mood === 'ko' || !rest
        ? { at: desk, pose: a.mood === 'ko' ? 'lie' as const : 'stand' as const, seat: a.seat >= 0 ? a.seat : undefined }
        : { at: rest.at, pose: rest.pose, ...walking(desk, rest.at, a.finishedAt, now) }
    return {
      name: a.name, look: a.look, mood: a.mood, ...place,
      status, statusColor,
      bubble: isChat ? CHAT[(a.calls + a.look) % CHAT.length] : a.doing || undefined,
      isChat,
      pct: Math.round(level(a) * 100),
      hat: hat(a.kind),
      hasCrown: best === a && (tally[a.name] ?? 0) > 0,
      stage: stage(tally[a.name] ?? 0),
      isFocused: focused,
    }
  })
  return {
    boss, sprites, entries, what, m,
    hour: new Date(now).getHours(),
    board: podium.length > 0 ? `🏆 ${podium.map(([n, c]) => `${n} ${c}`).join(' · ')}` : '',
  }
}
const altOf = (all: Sprite[]) => all.map(s => `${s.name} : ${s.status}${s.pct === undefined ? '' : ` ${s.pct}%`}`).join(', ')
const bar = (pct: number) => '▓'.repeat(Math.round(pct / 10)).padEnd(10, '░')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('records').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, records, () => saved as Record<string, number>)
    await $.command.register({ name: 'bureau', description: 'Ouvre le bureau de buddy et des agents dans le panneau latéral' }).catch(() => {})
    void $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
    return next(e)
  })

  on('command.run', { command: 'bureau' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return { text: opened.isPlaced ? 'Le bureau est ouvert dans le panneau latéral.' : `Le bureau attend sa place : ${opened.reason}` }
  })

  on('turn.start', async ($, e, next) => {
    const id = e.agentId
    const now = await $.clock.now()
    if (id === undefined) {
      await update($, startedAt, () => now)
      return next(e)
    }
    void $.ui.open({ id: PANE, title: TITLE }).catch(() => {})
    const kind = await $.agent.list().then(l => l.find(a => a.id === id)?.type ?? '', () => '')
    await update($, agents, (all): Record<string, Agent> => {
      if (all[id]) return { ...all, [id]: { ...all[id], mood: 'search', isDone: false } }
      const crew = Object.values(all)
      // A look and a name nobody on screen has yet, buddy's fox last; past the lists, they repeat.
      const look = [...LOOKS.keys()].slice(1).concat(0).find(i => !crew.some(a => a.look === i)) ?? crew.length
      const name = NAMES.find(n => !crew.some(a => a.name === n)) ?? `Agent ${crew.length + 1}`
      const seat = [...SEATS.keys()].slice(1).find(i => !crew.some(a => a.seat === i)) ?? -1
      return { ...all, [id]: { name, look, mood: 'search', calls: 0, isDone: false, doing: '', kind, startedAt: now, seat, rest: -1, finishedAt: 0 } }
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const m = e.tool === 'Bash' && SEARCH.test(e.command) ? 'search' : MOODS[e.tool]
    const what = about(e as unknown as Record<string, unknown>)
    const id = e.agentId
    if (id === undefined) {
      if (m) await update($, mood, () => m)
      await update($, doing, () => what)
    } else {
      await update($, agents, all =>
        all[id] ? { ...all, [id]: { ...all[id], mood: m ?? all[id].mood, calls: all[id].calls + 1, doing: what } } : all,
      )
    }
    await syncFocus($)

    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) {
      // A failed call: a worried face for two seconds, then back to what it was doing.
      const back: Mood = m ?? 'run'
      if (id === undefined) {
        await update($, mood, () => 'oops')
        $.clock.after(2000, () => update($, mood, cur => (cur === 'oops' ? back : cur)))
      } else {
        await update($, agents, all => (all[id] ? { ...all, [id]: { ...all[id], mood: 'oops' as Mood } } : all))
        $.clock.after(2000, () => update($, agents, all => (all[id]?.mood === 'oops' ? { ...all, [id]: { ...all[id], mood: back } } : all)))
      }
    }
    return ran
  }).catch(($, e, next) => next(e)) // a broken animation must never block a tool

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    const isKo = e.reason !== 'answer'
    const endedAt = await $.clock.now()
    const hour = new Date(endedAt).getHours()

    if (id === undefined) {
      await update($, mood, () => (isKo ? 'ko' : 'joy'))
      await update($, startedAt, () => 0)
      await update($, doing, () => '')
      await syncFocus($)
      if (isKo) play($, 'sounds/oops.wav')
      // Back to sleep after the celebration (sooner at night), unless a new turn changed the mood.
      $.clock.after(isNight(hour) ? 2000 : 5000, () => update($, mood, cur => (cur === 'joy' || cur === 'ko' ? 'sleep' : cur)))
      return next(e)
    }

    const before = await read($, agents)
    const me = before[id]
    if (!me) return next(e)
    const all = await update($, agents, (cur): Record<string, Agent> => {
      const one = cur[id]
      if (!one) return cur
      // The first free spot in the lounge, kitchen or terrace.
      const rest = isKo ? -1 : [...RESTS.keys()].find(i => !Object.values(cur).some(a => a.rest === i)) ?? -1
      return { ...cur, [id]: { ...one, mood: isKo ? 'ko' : 'joy', isDone: true, doing: '', rest, finishedAt: endedAt } }
    })
    const crew = Object.values(all)

    if (!isKo) {
      const tally = await update($, records, r => ({ ...r, [me.name]: (r[me.name] ?? 0) + 1 }))
      await $.store.set('records', tally).catch(() => {})
    }

    // The last of a crew of two or more: everyone dances to the finale instead of a lone jingle.
    if (crew.length >= 2 && crew.every(a => a.isDone)) {
      await update($, agents, cur => Object.fromEntries(Object.entries(cur).map(([k, a]) => [k, a.mood === 'ko' ? a : { ...a, mood: 'joy' as Mood }])))
      play($, 'sounds/finale.wav')
    } else {
      play($, isKo ? 'sounds/oops.wav' : `sounds/critter${me.look % 8}.wav`)
    }
    await syncFocus($)

    // Leave the stage a few seconds after cheering, unless it started working again.
    $.clock.after(8000, () => update($, agents, cur => {
      if (!cur[id]?.isDone) return cur
      const { [id]: _, ...rest } = cur
      return rest
    }))
    return next(e)
  })


  // Above the prompt: buddy as he first was; the agents work in the side pane.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const m = await read($, mood)
    const what = await read($, doing)
    // Draw below the other plugins' bands (ponytail's dashboard...) instead of replacing them.
    const rest = await next(e)
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    // The table answers `in` for any name on the terminal, so ask the surface, not the table.
    // Drawn as an image, not an interactive frame: a redraw swaps the picture instead of reloading a frame.
    // shortcut: the terminal has no Svg element, so it gets an emoji line instead of the drawing.
    const me = e.surface !== 'terminal' && 'Svg' in els
      ? <els.Svg source={buddySvg(m)} alt={LABEL[m]} width={110} height={92} />
      : <Text>{LABEL[m]}{what && m !== 'sleep' ? ` · ${what}` : ''}</Text>
    return (
      <Box flexDirection="column">
        {rest}
        {me}
      </Box>
    )
  })

  // The side pane: the whole office, two desks per row.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { boss, sprites, entries, hour, board } = await scene($)
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const views = entries.map(([id, a]) => (
      <Button key={`view-${id}`} label={`👀 ${a.name}`} onPress={() => $.ui.view({ agentId: id })} />
    ))
    const all = [boss, ...sprites]
    // The pane's width comes in cells of its code font, about 7.5 px each: the map fills it, never below 300 px.
    const width = Math.max(300, Math.round(e.props.bodyColumns * 7.5))
    return (
      <Box flexDirection="column" gap={1}>
        {e.surface !== 'terminal' && 'Svg' in els
          ? <els.Svg source={office(all, hour)} alt={`Le bureau — ${altOf(all)}`} width={width} height={Math.round((width * H) / W)} />
          : <Box flexDirection="column">
              {all.map(s => (
                <Text key={`row-${s.name}`}>{s.name.padEnd(11)} {s.pct === undefined ? 'le chef    ' : `${bar(s.pct)} ${String(s.pct).padStart(3)}%`}  {LABEL[s.mood]}{s.bubble ? ` · ${s.bubble}` : ''}</Text>
              ))}
            </Box>}
        {views.length > 0 ? <Box flexDirection="row" flexWrap="wrap" gap={1}>{views}</Box> : null}
        {board ? <Text dimColor>{board}</Text> : <Text dimColor>Personne n’a encore fini de tâche.</Text>}
      </Box>
    )
  })
}
