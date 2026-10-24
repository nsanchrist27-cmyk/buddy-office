import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'buddy',
  component: 'Pane',
  requestId: 'buddy-office',
  surface: 'terminal',
  props: {
    title: 'Le bureau',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

type Body = Parameters<typeof test>[1]
type On = Parameters<Body>[1]
type Dollar = Parameters<Body>[0]

// Stands for the engine beneath the plugin; `failing` names commands that error.
const engine = (on: On, failing: string[] = []) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', (_, e) => ({ result: {}, isError: 'command' in e && failing.includes(String(e.command)) }) as never)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const end = (turnId: string, agentId: string, reason = 'answer') =>
  ({ answer: 'ok', durationMs: 1, isAborted: reason === 'aborted', turnId, agentId, reason }) as never

const line = async ($: Dollar, name: RegExp) => {
  const ui = await $.ui.mount(BAND)
  const text = (await ui.find({ type: 'Text', text: name }))?.text
  await ui.unmount()
  return text
}

test('each agent gets its own name, and its gauge fills when it ends', async ($, on) => {
  const clock = engine(on)
  await $.turn.start({ text: 'a', turnId: 't1', agentId: 'a1' })
  await $.turn.start({ text: 'b', turnId: 't2', agentId: 'a2' })
  await $.tool.call({ tool: 'Read', file_path: '/src/poem.txt', agentId: 'a1' })

  expect(await line($, /Pixel/)).toMatch(/lit… · poem\.txt/)
  expect(await line($, /Biscotte/)).toMatch(/cherche/)

  await $.turn.complete(end('t1', 'a1'))
  expect(await line($, /Pixel/)).toMatch(/100%/)
  expect(await line($, /🏆/)).toMatch(/Pixel 1/)

  // The finished agent leaves the stage; the other one stays.
  await clock.advance(9000)
  expect(await line($, /^Pixel/)).toBeUndefined()
  expect(await line($, /Biscotte/)).toBeDefined()
})

test('a search run through Bash shows the magnifier, any other command runs', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'a', turnId: 't1', agentId: 'a1' })
  await $.turn.start({ text: 'b', turnId: 't2', agentId: 'a2' })
  await $.tool.call({ tool: 'Bash', command: 'cd src && grep -rn foo .', agentId: 'a1' })
  await $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'a2' })

  expect(await line($, /Pixel/)).toMatch(/cherche/)
  expect(await line($, /Biscotte/)).toMatch(/court/)
})

test('a failed call worries the critter for two seconds; a crashed agent is K.O.', async ($, on) => {
  const clock = engine(on, ['false'])
  await $.turn.start({ text: 'a', turnId: 't1', agentId: 'a1' })
  await $.turn.start({ text: 'b', turnId: 't2', agentId: 'a2' })
  await $.tool.call({ tool: 'Bash', command: 'false', agentId: 'a1' })

  expect(await line($, /Pixel/)).toMatch(/oups/)
  await clock.advance(2100)
  expect(await line($, /Pixel/)).toMatch(/court/)

  await $.turn.complete(end('t2', 'a2', 'aborted'))
  expect(await line($, /Biscotte/)).toMatch(/K\.O\./)
  // No record for a crash.
  expect(await line($, /🏆/)).toBeUndefined()
})

test('when the last of the crew finishes, everyone dances', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'a', turnId: 't1', agentId: 'a1' })
  await $.turn.start({ text: 'b', turnId: 't2', agentId: 'a2' })
  await $.turn.complete(end('t1', 'a1'))
  await $.turn.complete(end('t2', 'a2'))

  expect(await line($, /Pixel/)).toMatch(/fini/)
  expect(await line($, /Biscotte/)).toMatch(/fini/)
  expect(await line($, /🏆/)).toMatch(/Pixel 1 · Biscotte 1/)
})

test('above the prompt only buddy stays; the agents are in the side pane', async ($, on) => {
  engine(on)
  await $.turn.start({ text: 'a', turnId: 't1', agentId: 'a1' })
  const ui = await $.ui.mount({
    plugin: 'buddy',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: true, maxRows: 20, scroll: { offset: 0, bodyRows: 20 } },
  } as never)
  expect(await ui.find({ type: 'Text', text: /zzz/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Pixel/ })).toBeUndefined()
  await ui.unmount()
  expect(await line($, /^Pixel/)).toMatch(/cherche/)
})
