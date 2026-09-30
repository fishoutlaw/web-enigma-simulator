import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createContext, runInContext} from 'node:vm';

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
const engine = read('enigma.js');
const site = read('app.js');
const context = createContext({structuredClone});
runInContext(engine, context);
const api = context.EnigmaEngine;
const plain = value => JSON.parse(JSON.stringify(value));

test('standalone distribution engine runs without DOM and matches all frozen traces', () => {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/py-enigma-1.0.2.json.gz', import.meta.url))));
  for (const {payload, expected} of fixture.cases) {
    assert.deepEqual(plain(api.process(payload)), expected);
  }
  assert.equal(Object.isFrozen(api), true);
});

test('HTML loads both classic scripts in order and site bundle consumes the shared engine', () => {
  const scripts = [...read('index.html').matchAll(/<script defer src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ['enigma.js', 'app.js']);
  assert.doesNotMatch(site, /class (Rotor|EnigmaMachine|TraceRecorder)\b/);
  assert.doesNotMatch(engine, /\b(document|window)\./);
  assert.throws(() => runInContext(site, createContext({})), /enigma.js를 app.js보다 먼저/);
});
