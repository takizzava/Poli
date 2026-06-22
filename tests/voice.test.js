import test from 'node:test'
import assert from 'node:assert/strict'
import dayjs from 'dayjs'
import { parse } from '../src/utils/parser.js'
import { compileWakeRegex, finalizeCapturedText, hasHotword, normalizeTranscript, stripHotword } from '../src/speech/useSpeech.js'

test('parse extracts task and due date from tomorrow command', () => {
  const base = new Date('2026-06-22T08:00:00.000Z')
  const result = parse('Поли, напомни завтра в 10 оплатить счет', base)

  assert.ok(result)
  assert.equal(result.task, 'оплатить счет')
  assert.equal(dayjs(result.due).hour(), 10)
  assert.equal(dayjs(result.due).minute(), 0)
})

test('parse understands relative minute command and strips filler words', () => {
  const base = new Date('2026-06-22T08:00:00.000Z')
  const result = parse('создай задачу через 15 минут позвонить клиенту пожалуйста', base)

  assert.ok(result)
  assert.equal(result.task, 'позвонить клиенту')
  assert.equal(dayjs(result.due).diff(dayjs(base), 'minute'), 15)
})

test('parse understands spoken time with separated hour and minute', () => {
  const base = new Date('2026-06-22T08:00:00.000Z')
  const result = parse('напомни сегодня в 18 30 отправить отчет', base)

  assert.ok(result)
  assert.equal(result.task, 'отправить отчет')
  assert.equal(dayjs(result.due).hour(), 18)
  assert.equal(dayjs(result.due).minute(), 30)
})

test('wake word helpers detect and strip custom hotwords', () => {
  const re = compileWakeRegex(['поли ассистент', 'помощник'])

  assert.equal(hasHotword('эй, поли ассистент создай задачу', re), true)
  assert.equal(stripHotword('эй, поли ассистент создай задачу', re), 'эй,  создай задачу'.trim())
  assert.equal(hasHotword('просто текст без команды', re), false)
})

test('finalizeCapturedText merges transcript parts and drops finish keyword', () => {
  assert.equal(normalizeTranscript('  купить   молоко... '), 'купить молоко')
  assert.equal(finalizeCapturedText('купить молоко', 'завтра готово'), 'купить молоко завтра')
})
