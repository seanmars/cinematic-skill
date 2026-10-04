import { expect, test } from 'claude-code/testing'
import { fakeEngine, startSession } from './fake-engine'

test('沒有 workspace 標記: registers nothing and never wakes Claude', async ($, on) => {
  const engine = fakeEngine(on)
  engine.assign('demo', 'session-a')
  engine.openGate('demo', '001-intake')
  engine.reply('demo', '001-intake')

  await startSession($)
  await engine.clock.advance(6000)

  expect(engine.tools).toEqual([])
  expect(engine.commands).toEqual([])
  expect(engine.status).toEqual([])
  expect(engine.submitted).toEqual([])
})
