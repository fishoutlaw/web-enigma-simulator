import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {EnigmaMachine,process,defaults,clean,validate,mod} from '../src/core/enigma.js';
import {physicalWires,physicalPath,externalRow,rotationRange,PITCH} from '../src/ui/geometry.js';
import {Experiment} from '../src/experiment/state.js';
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/py-enigma-1.0.2.json.gz',import.meta.url))));

test('52 frozen Py-Enigma cases: exact ciphertext, stepping, every trace and every wiring contact',()=>{
  for(const {payload,expected} of fixture.cases)assert.deepEqual(process(payload),expected,payload.experiment);
});
test('48 randomized settings decrypt to original plaintext',()=>{
  for(const {payload,expected} of fixture.cases.slice(0,48)){
    assert.equal(process({...payload,text:expected.cipher}).cipher,payload.text);
  }
});
test('known vector, double stepping and wrap-around',()=>{
  assert.equal(process({config:defaults(),text:'AAAAA'}).cipher,'BDZGO');
  const records=process({config:{...defaults(),start:'ADU'},text:'AAA'}).records;
  assert.deepEqual(records.map(r=>r.after),['ADV','AEW','BFX']);
  assert.deepEqual(records.map(r=>r.moved),[[2],[1,2],[0,1,2]]);
  assert.equal(process({config:{...defaults(),start:'AAZ'},text:'A'}).position,'AAA');
});
test('non-ASCII exclusion and lowercase conversion do not introduce rotations',()=>{
  assert.equal(clean('a ß 한글123!z'),'AZ');
  const empty=process({config:defaults(),text:'한글 123ß!🙂'});
  assert.equal(empty.position,'AAA');assert.equal(empty.records.length,0);
});
test('configuration validation rejects duplicate rotors, invalid rings and illegal plugs',()=>{
  for(const patch of [{rotors:['I','I','III']},{rotors:['I','II']},{rings:'A0A'},
    {start:'AA'},{plugs:['AA']},{plugs:['AB','AC']},{plugs:['ab']},
    {plugs:['AB','CD','EF','GH','IJ','KL','MN','OP','QR','ST','UV']},{reflector:'C'}]){
    assert.throws(()=>validate({...defaults(),...patch}));
  }
  const m=new EnigmaMachine({...defaults(),rings:'BZA'});
  assert.equal(m.rotors[1].ring,25);assert.equal(m.rotors[0].offset,25);
});
test('physical wire geometry remains identical across all 26 rotor positions',()=>{
  for(const name of ['I','II','III']){
    const cfg={...defaults(),rotors:[name,...['I','II','III'].filter(n=>n!==name)]};
    const baseline=physicalWires(new EnigmaMachine(cfg).snapshot().rotors[0]);
    for(const position of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){
      const view=new EnigmaMachine(cfg,position+'AA').snapshot().rotors[0];
      assert.deepEqual(physicalWires(view),baseline);
      assert.deepEqual(physicalWires(view).map(w=>physicalPath(w,0)),baseline.map(w=>physicalPath(w,0)));
    }
  }
});
test('translated and wrapped wire endpoints coincide with the real input/output sockets',()=>{
  for(const {expected} of fixture.cases){for(const record of expected.records){
    for(const s of record.steps.filter(s=>s.component.startsWith('rotor'))){
      const rotor=record.wiring.rotors[Number(s.component.at(-1))];
      assert.equal(externalRow(s.internal_input.number,rotor.offset),s.input.number);
      assert.equal(externalRow(s.internal_output.number,rotor.offset),s.output.number);
      const back=s.direction==='return';
      const wire=physicalWires(rotor)[back?s.internal_output.number:s.internal_input.number];
      assert.equal(mod(wire.end),wire.contact);
      assert.equal(externalRow(wire.pin,rotor.offset),back?s.output.number:s.input.number);
      assert.equal(externalRow(wire.end,rotor.offset),back?s.input.number:s.output.number);
    }
  }}
});
test('animation moves the parent exactly one pitch, including 25-to-0 seam',()=>{
  for(let offset=0;offset<26;offset++){
    const [a,b]=rotationRange(offset,true);assert.equal(b-a,-PITCH);
    assert.equal(mod(-b/PITCH),mod(offset+1));
    const still=rotationRange(offset,false);assert.equal(still[0],still[1]);
  }
});
test('queue preserves rapid input order, epoch cancellation, and tab isolation',()=>{
  const a=new Experiment(defaults()),b=new Experiment(defaults());
  a.enqueue('a B한글c');while(a.queue.length)a.next();
  assert.equal(a.records.map(r=>r.input).join(''),'ABC');
  assert.equal(a.records.map(r=>r.output).join(''),process({config:defaults(),text:'ABC'}).cipher);
  assert.equal(b.position,'AAA');assert.equal(b.records.length,0);
  const before=JSON.stringify(a.machine.snapshot());
  for(let i=0;i<10;i++)structuredClone(a.records[0]);
  assert.equal(JSON.stringify(a.machine.snapshot()),before);
  a.enqueue('DEF');const old=a.id;a.reset(defaults());a.enqueue('Z');
  assert.equal(a.next(old),null);assert.equal(a.queue.length,1);assert.equal(a.position,'AAA');
  assert.equal(a.next().record.input,'Z');assert.equal(a.records.length,1);
});
test('fast batch and single-letter queue share exactly the same calculation',()=>{
  const s=new Experiment({...defaults(),start:'ADU'});s.enqueue('ABCDEF',true);
  while(s.queue.length)s.next();
  assert.equal(s.records.map(r=>r.output).join(''),process({config:s.config,text:'ABCDEF'}).cipher);
  assert.deepEqual(s.records.map(r=>r.sequence),[1,2,3,4,5,6]);
  assert.equal(s.next(),null);
});

test('I–V: all 60 orders at 3 starts match stock Py-Enigma and decrypt',()=>{
  const cases=JSON.parse(readFileSync(new URL('./fixtures/five-rotors.json',import.meta.url)));
  for(const c of cases){
    const result=process({config:c.config,text:c.text});
    assert.equal(result.cipher,c.cipher);
    assert.equal(result.position,c.position);
    assert.equal(process({config:c.config,text:c.cipher}).cipher,c.text);
    for(const r of result.records){
      assert.equal(r.steps.at(-1).output.letter,r.output);
      for(let i=1;i<r.steps.length;i++)assert.equal(r.steps[i].input.number,r.steps[i-1].output.number);
    }
  }
  for(const rotors of [['I','IV','IV'],['I','II','VI'],['I','II','toString']])assert.throws(()=>validate({...defaults(),rotors}));
  const r=process({config:{...defaults(),rotors:['I','IV','V'],start:'AIY'},text:'AAA'}).records;
  assert.deepEqual(r.map(x=>x.after),['AIZ','AJA','BKB']);
  assert.deepEqual(r.map(x=>x.moved),[[2],[1,2],[0,1,2]]);
});
