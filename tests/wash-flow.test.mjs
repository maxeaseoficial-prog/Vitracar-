import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const js=ts.transpileModule(fs.readFileSync('src/lib/wash-flow.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
const z='America/Cuiaba'
test('business day is not the UTC day',()=>assert.equal(m.dayInZone('2026-11-10T02:00:00Z',z),'2026-11-09'))
test('business local time roundtrip independent of browser timezone',()=>assert.equal(m.toInstant('2026-11-09T14:30',z),'2026-11-09T18:30:00.000Z'))
test('invalid wall times rejected',()=>assert.throws(()=>m.toInstant('2026-02-30T14:30',z)))
test('DST nonexistent time rejected',()=>assert.throws(()=>m.toInstant('2026-03-08T02:30','America/New_York')))
test('Monday week across month boundary',()=>assert.equal(m.weekStart('2026-11-01'),'2026-10-26'))
test('month contains 42 days without duplicate or invalid dates',()=>{const d=m.monthDays('2026-11-09');assert.equal(d.length,42);assert.equal(d[0],'2026-10-26');assert.equal(new Set(d).size,42)})
test('month shift avoids day 31 overflow',()=>assert.equal(m.monthShift('2026-01-31',1),'2026-02-01'))
const empty={clients:[],vehicles:[],services:[],appointments:[],appointment_items:[],service_orders:[],payments:[]}
const ap={id:'a',client_id:'c',vehicle_id:'v',status:'completed',starts_at:'2026-11-09T12:00:00Z'}
const order={id:'o',appointment_id:'a',status:'completed',total_cents:10000}
test('legacy completed and paid order derives Paid stage',()=>assert.equal(m.buildJobs({...empty,appointments:[ap],service_orders:[order],payments:[{order_id:'o',amount_cents:10000}]})[0].stage,'paid'))
test('operational reversal preserves paid badge and financial values',()=>{const j=m.buildJobs({...empty,appointments:[{...ap,workflow_stage:'washing'}],service_orders:[order],payments:[{order_id:'o',amount_cents:10000}]})[0];assert.equal(j.stage,'washing');assert.equal(j.settled,true);assert.equal(j.balance,0)})
test('unsettled Paid state is never shown as paid',()=>assert.equal(m.buildJobs({...empty,appointments:[{...ap,workflow_stage:'paid'}],service_orders:[order]})[0].stage,'delivered'))
const job=(id,h,duration)=>({appointment:{id,starts_at:`2026-11-09T${h}:00:00-04:00`},duration})
test('overlapping hours get separate lanes',()=>{const r=m.timelineJobs([job('a','09',90),job('b','10',60),job('c','12',30)],'2026-11-09',z);assert.equal(r[0].lanes,2);assert.equal(r[1].lane,1);assert.equal(r[2].lanes,1)})
test('overnight job clipped correctly into next day',()=>{const r=m.timelineJobs([job('a','23',120)],'2026-11-10',z);assert.equal(r.length,1);assert.equal(r[0].start,0);assert.equal(r[0].end,60)})
console.log(`${count} date and workflow helper tests passed.`)
