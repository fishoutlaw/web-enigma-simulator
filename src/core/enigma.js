/* Enigma Lab browser engine.
 * Adapted from Py-Enigma 1.0.2 by Brian Neal (c) 2012–2025, MIT.
 * https://github.com/gremmie/enigma — see dist/licenses/Py-Enigma-MIT.txt.
 * Window letters and internal electrical positions are intentionally separate.
 */
export const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const mod = n => ((n % 26) + 26) % 26;
export const clean = text => text.replace(/[^a-zA-Z]/g, '').toUpperCase();
export const defaults = () => ({rotors:['I','II','III'],start:'AAA',rings:'AAA',plugs:[],reflector:'B'});
const DATA = {
  I: ['EKMFLGDQVZNTOWYHXUSPAIBRCJ','Q'],
  II: ['AJDKSIRUXBLHWTMCQGZNPYFVOE','E'],
  III: ['BDFHJLCPRTXVZNYEIWGAKMUSQO','V'],
  IV: ['ESOVPZJAYQUIRHXLNFTGKDCMWB','J'],
  V: ['VZBRGITYUPSDNHLXAWMJQOFECK','Z'],
};
const REFLECTOR = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
const contact = number => ({number,letter:ABC[number]});
export function validate(config) {
  if (!config || !Array.isArray(config.rotors) || config.rotors.length !== 3 || new Set(config.rotors).size !== 3 || config.rotors.some(name => !Object.hasOwn(DATA,name)))
    throw new Error('로터 I~V 중 서로 다른 3개를 선택하세요.');
  for (const key of ['start','rings']) if (typeof config[key] !== 'string' || !/^[A-Z]{3}$/.test(config[key]))
    throw new Error('시작 위치와 링 설정은 각각 A~Z 세 글자여야 합니다.');
  const plugs=config.plugs ?? [], used=new Set();
  if (!Array.isArray(plugs) || plugs.length>10) throw new Error('플러그는 최대 10쌍입니다.');
  for (const pair of plugs) {
    if(typeof pair!=='string' || !/^[A-Z]{2}$/.test(pair) || pair[0]===pair[1] || [...pair].some(c=>used.has(c)))
      throw new Error('플러그의 자기 연결 또는 중복 연결은 할 수 없습니다.');
    for(const c of pair) used.add(c);
  }
  if(config.reflector && config.reflector!=='B') throw new Error('반사판은 B만 지원합니다.');
  return structuredClone({...config,plugs,reflector:'B'});
}

export class Rotor {
  constructor(name,ring,position) {
    this.name=name;this.ring=ring;this.window=ABC.indexOf(position);
    this.forward=[...DATA[name][0]].map(c=>ABC.indexOf(c));
    this.reverse=Array(26);this.forward.forEach((v,i)=>this.reverse[v]=i);
    this.notch=DATA[name][1];
  }
  get offset(){return mod(this.window-this.ring);}
  get position(){return ABC[this.window];}
  atNotch(){return this.position===this.notch;}
  rotate(){this.window=mod(this.window+1);}
  signal(n,back=false){
    const internalInput=mod(n+this.offset);
    const internalOutput=(back?this.reverse:this.forward)[internalInput];
    return {output:mod(internalOutput-this.offset),internalInput,internalOutput};
  }
  snapshot(i){
    return {component:`rotor${i}`,name:this.name,position:this.position,ring:ABC[this.ring],
      offset:this.offset,notch:[this.notch],connections:Array.from({length:26},(_,input)=>{
        const s=this.signal(input);
        return {input,output:s.output,internal_input:s.internalInput,internal_output:s.internalOutput};
      })};
  }
}

export class Plugboard {
  constructor(pairs){
    this.map=Array.from({length:26},(_,i)=>i);
    for(const pair of pairs){const [a,b]=[...pair].map(c=>ABC.indexOf(c));this.map[a]=b;this.map[b]=a;}
  }
  signal(n){return this.map[n];}
}

export class TraceRecorder {
  constructor(){this.steps=[];}
  add(component,name,direction,input,output,internal){
    const step={component,name,direction,input:contact(input),output:contact(output)};
    if(internal)Object.assign(step,{offset:internal.offset,internal_input:contact(internal.input),internal_output:contact(internal.output)});
    this.steps.push(step);
    return output;
  }
}

export class EnigmaMachine {
  constructor(config,position){
    this.config=validate(config);
    position=position??config.start;
    if(typeof position!=='string'||!/^[A-Z]{3}$/.test(position))throw new Error('현재 위치는 A~Z 세 글자여야 합니다.');
    this.rotors=this.config.rotors.map((name,i)=>new Rotor(name,ABC.indexOf(config.rings[i]),position[i]));
    this.plugboard=new Plugboard(this.config.plugs);
    this.reflector=[...REFLECTOR].map(c=>ABC.indexOf(c));
  }
  get position(){return this.rotors.map(r=>r.position).join('');}
  step(){
    // Decide all pawls from the PRE-step window positions, independent of rings.
    const middle=this.rotors[2].atNotch()||this.rotors[1].atNotch();
    const left=this.rotors[1].atNotch();
    this.rotors[2].rotate();
    if(middle)this.rotors[1].rotate();
    if(left)this.rotors[0].rotate();
  }
  snapshot(){return {rotors:this.rotors.map((r,i)=>r.snapshot(i)),reflector:[...this.reflector],plugboard:[...this.plugboard.map]};}
  press(key,experiment='',sequence=1){
    if(typeof key!=='string'||!/^[A-Z]$/.test(key))throw new Error('A~Z 한 글자를 입력하세요.');
    const before=this.position;this.step();
    const after=this.position,t=new TraceRecorder();let n=ABC.indexOf(key);
    n=t.add('input','입력','forward',n,n);
    n=t.add('plugboard','플러그보드','forward',n,this.plugboard.signal(n));
    const visit=(i,back)=>{
      const r=this.rotors[i],s=r.signal(n,back);
      n=t.add(`rotor${i}`,r.name,back?'return':'forward',n,s.output,
        {offset:r.offset,input:s.internalInput,output:s.internalOutput});
    };
    for(const i of [2,1,0])visit(i,false);
    n=t.add('reflector','B','reflect',n,this.reflector[n],{offset:0,input:n,output:this.reflector[n]});
    for(const i of [0,1,2])visit(i,true);
    n=t.add('plugboard','플러그보드','return',n,this.plugboard.signal(n));
    return {id:`${experiment}:${sequence}`,sequence,input:key,output:ABC[n],before,after,
      moved:[0,1,2].filter(i=>before[i]!==after[i]),config:structuredClone(this.config),steps:t.steps,wiring:this.snapshot()};
  }
}

export function process(payload){
  const text=payload.text??'',sequence=payload.sequence??0,experiment=payload.experiment??'';
  if(typeof text!=='string'||text.length>500)throw new Error('한 번에 최대 500자를 입력하세요.');
  if(!Number.isSafeInteger(sequence)||sequence<0||typeof experiment!=='string'||experiment.length>100)throw new Error('실험 번호가 올바르지 않습니다.');
  const machine=new EnigmaMachine(payload.config,payload.position),processed=clean(text);
  const records=[...processed].map((c,i)=>machine.press(c,experiment,sequence+i+1));
  return {experiment,processed,excluded:[...text].length-processed.length,records,
    position:machine.position,wiring:machine.snapshot(),cipher:records.map(r=>r.output).join('')};
}
