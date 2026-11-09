import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/password-policy.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { passwordChecks, validateRegistration, validEmail } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
let count = 0
function test(name, fn) { fn(); count++; console.log('PASS', name) }
const valid = { email: 'test@example.com', password: 'abcde12!', confirmPassword: 'abcde12!' }
test('accepts letters, numbers and symbols', () => assert.equal(validateRegistration(valid).ok, true))
for (const password of ['12345678', 'abcdefgh', 'Abcd1234', '1234567!', 'Abcd12 ', 'a1!']) {
  test('rejects an incomplete password policy', () => assert.equal(validateRegistration({ ...valid, password, confirmPassword: password }).ok, false))
}
test('does not count whitespace as a symbol', () => assert.equal(passwordChecks('abc12345 ').find(x => x.id === 'symbol').valid, false))
test('rejects different passwords', () => assert.equal(validateRegistration({ ...valid, confirmPassword: 'different1!' }).code, 'password_mismatch'))
test('does not trim or normalize the password', () => assert.equal(validateRegistration({ ...valid, password: ' Abc123! ' }).ok, false))
test('normalizes only email', () => assert.equal(validateRegistration({ ...valid, email: ' TEST@EXAMPLE.COM ' }).value.email, 'test@example.com'))
test('rejects malformed email', () => assert.equal(validEmail('test@'), false))
test('rejects excessive password length', () => assert.equal(validateRegistration({ ...valid, password: 'a'.repeat(129) + '1!' }).ok, false))
for (const payload of [null, [], 'bad', {}, { email: 42, password: true }]) {
  test('rejects malformed input', () => assert.equal(validateRegistration(payload).ok, false))
}
console.log(`${count} auth policy checks passed`)
