import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/last-wash.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { lastWashByClient, daysSince, sinceLabel, washGaps } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
let count = 0
const test = (name, fn) => { fn(); count++; console.log('PASS', name) }
const now = new Date(2026, 10, 10, 15, 0, 0) // 10/11/2026 local
const at = (d, h = 10) => new Date(2026, 10, d, h).toISOString()

test('labels: hoje, ontem, dias, semanas, meses, anos', () => {
  assert.equal(sinceLabel(0), 'hoje'); assert.equal(sinceLabel(1), 'ontem'); assert.equal(sinceLabel(3), 'há 3 dias')
  assert.equal(sinceLabel(7), 'há 1 semana'); assert.equal(sinceLabel(21), 'há 3 semanas')
  assert.equal(sinceLabel(30), 'há 1 mês'); assert.equal(sinceLabel(95), 'há 3 meses'); assert.equal(sinceLabel(400), 'há 1 ano')
})
test('days use calendar days, not 24h blocks', () => {
  assert.equal(daysSince(at(7, 23), now), 3); assert.equal(daysSince(at(10, 1), now), 0); assert.equal(daysSince(at(9, 23), now), 1)
})
test('future dates never go negative', () => assert.equal(daysSince(at(20), now), 0))
test('only completed orders count and the latest wins', () => {
  const m = lastWashByClient([
    { client_id: 'a', vehicle_id: 'v1', status: 'completed', completed_at: at(1) },
    { client_id: 'a', vehicle_id: 'v2', status: 'completed', completed_at: at(7) },
    { client_id: 'a', vehicle_id: 'v3', status: 'cancelled', completed_at: at(9) },
    { client_id: 'b', vehicle_id: 'v4', status: 'in_progress', completed_at: null },
  ])
  assert.equal(m.get('a').vehicleId, 'v2'); assert.equal(m.has('b'), false)
})
test('ranking: longest gap first, never-washed use signup date, archived hidden', () => {
  const clients = [
    { id: 'a', created_at: at(1), archived_at: null }, { id: 'b', created_at: at(2), archived_at: null },
    { id: 'c', created_at: at(3), archived_at: null }, { id: 'z', created_at: at(1), archived_at: at(5) },
  ]
  const orders = [
    { client_id: 'a', vehicle_id: 'v', status: 'completed', completed_at: at(8) },
    { client_id: 'b', vehicle_id: 'v', status: 'completed', completed_at: at(2) },
  ]
  const gaps = washGaps(clients, orders, now)
  assert.deepEqual(gaps.map(g => g.client.id), ['b', 'c', 'a'])
  assert.deepEqual(gaps.map(g => g.days), [8, 7, 2])
  assert.equal(gaps[1].last, null)
})
console.log(count + ' last-wash checks passed')
