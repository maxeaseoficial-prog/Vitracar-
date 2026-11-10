import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source=fs.readFileSync('src/lib/appointment-location.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const m=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
let count=0
function test(name,run){run();count++;console.log('PASS',name)}
test('old store markers remain internal without rewriting records',()=>{for(const a of [null,undefined,'','  ','Na unidade','NA LOJA','no nosso estabelecimento'])assert.equal(m.appointmentLocation(a),'store')})
test('actual address stays external',()=>assert.equal(m.appointmentLocation('Rua das Flores, 123, Centro, Cuiabá - MT'),'customer'))
test('store selection does not retain a previous customer address',()=>assert.equal(m.savedAppointmentAddress('store','Rua antiga, 50'),'Na loja'))
test('external address is trimmed and preserved',()=>assert.equal(m.savedAppointmentAddress('customer','  Rua das Flores, 123  '),'Rua das Flores, 123'))
test('empty short and store-marker external addresses are rejected',()=>{for(const a of ['','  ','abc','Na unidade','Na loja'])assert.throws(()=>m.savedAppointmentAddress('customer',a),/endereço/)})
test('too-long addresses rejected',()=>assert.throws(()=>m.savedAppointmentAddress('customer','x'.repeat(501)),/500/))
test('store never produces a Maps link',()=>assert.equal(m.customerDirections('Na unidade'),null))
test('Maps receives exactly the encoded destination with accents and symbols',()=>{const address='Rua São João, 123 & esquina #2, Cuiabá + MT';const u=new URL(m.customerDirections(address));assert.equal(u.origin,'https://www.google.com');assert.equal(u.pathname,'/maps/dir/');assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('destination'),address);assert.equal(u.searchParams.get('travelmode'),'driving')})
test('untrusted address is text, never a URL or executable protocol',()=>assert.equal(new URL(m.customerDirections('javascript:alert(1)')).origin,'https://www.google.com'))
test('WhatsApp normalizes national and international BR phones once',()=>{for(const n of ['(65) 99999-9999','+55 (65) 99999-9999','5565999999999'])assert.equal(m.customerWhatsApp(n),'https://wa.me/5565999999999')})
test('missing or malformed phone has no actionable link',()=>{for(const n of [null,'','123','0'.repeat(11),'99999999999999999'])assert.equal(m.customerWhatsApp(n),null)})
console.log(`${count} location/link tests passed; no external calls.`)
