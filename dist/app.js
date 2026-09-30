/* Enigma Lab — 화면, 입력 대기열, 기록 및 SVG 재생. 연산은 enigma.js에 위임합니다. */
(() => {
"use strict";
const module0 = globalThis.EnigmaEngine;
if (!module0) throw new Error('enigma.js를 app.js보다 먼저 불러와야 합니다.');
const module1 = (() => {
const {EnigmaMachine,clean,validate} = module0;
let generation=0;
class Experiment {
  constructor(config){this.reset(config);}
  reset(config){
    this.config=validate(config);this.machine=new EnigmaMachine(this.config);
    this.id=`lab-${Date.now()}-${++generation}`;
    this.records=[];this.queue=[];
  }
  get position(){return this.machine.position;}
  enqueue(text,fast=false){for(const c of clean(text))this.queue.push({letter:c,fast});}
  next(epoch=this.id){
    if(epoch!==this.id||!this.queue.length)return null;
    const job=this.queue[0];
    const record=this.machine.press(job.letter,this.id,this.records.length+1);
    this.records.push(record);this.queue.shift();
    return {record,fast:job.fast};
  }
}

return {Experiment};
})();
const module2 = (() => {
const {mod} = module0;
const PITCH=20;
const PERIOD=26*PITCH;
const TOP=85;
const y=n=>TOP+n*PITCH;
const LEFT=[155,340,525];
const RIGHT=[285,470,655];
// A physical wire's geometry is immutable. Offset is applied to its PARENT,
// never by reconnecting or interpolating either endpoint independently.
function physicalWires(rotor){
  const result=Array(26);
  for(const c of rotor.connections){
    const p=c.internal_input,q=c.internal_output;
    let distance=mod(q-p);if(distance>13)distance-=26;
    result[p]={pin:p,contact:q,end:p+distance};
  }
  return result;
}
function physicalPath(wire,i,back=false){
  return back?`M${LEFT[i]},${y(wire.end)} L${RIGHT[i]},${y(wire.pin)}`:
    `M${RIGHT[i]},${y(wire.pin)} L${LEFT[i]},${y(wire.end)}`;
}
const externalRow=(internal,offset)=>mod(internal-offset);
const rotationRange=(beforeOffset,moved)=>[-beforeOffset*PITCH,-(beforeOffset+(moved?1:0))*PITCH];

return {PITCH, PERIOD, TOP, y, LEFT, RIGHT, physicalWires, physicalPath, externalRow, rotationRange};
})();
const module3 = (() => {
const {ABC,mod} = module0;
const {PITCH,PERIOD,TOP,y,LEFT:L,RIGHT:R,physicalWires,physicalPath} = module2;
const text=(x,yy,value,cls='contact-label')=>`<text x="${x}" y="${yy}" text-anchor="middle" class="${cls}">${value}</text>`;
const poly=(points,color,active=false,back=false)=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${active?3.4:1.8}" opacity="${active?1:.28}" marker-end="url(#${back?'back':'forward'})" class="${active?'active-path':''}"/>`;
const badge=(x,yy,label,color)=>`<circle cx="${x}" cy="${yy}" r="4" fill="${color}"/><rect x="${x-10}" y="${yy-27}" width="20" height="18" rx="4" fill="${color}"/><text x="${x}" y="${yy-14}" text-anchor="middle" style="fill:#fff;font-size:12px;font-weight:600">${label}</text>`;

function diagramMarkup(w,record,step,{rotating=false,offsets=null,position=null}={}){
  const reflectX=65,plugLeft=720,plugRight=760,key=816;
  const steps=record&&!rotating?record.steps:[];
  let s='<svg viewBox="0 0 850 660" role="img" aria-label="숫자 접점 1부터 26과 고정 내부 배선이 함께 회전하는 로터"><title>브라우저 엔진의 실제 접점과 신호 경로</title><defs>';
  for(const [id,color] of [['forward','#b97219'],['back','#258b8b']])s+=`<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${color}"/></marker>`;
  for(let i=0;i<3;i++){
    const wires=physicalWires(w.rotors[i]);
    s+=`<clipPath id="clip-${i}"><rect x="${L[i]-15}" y="${TOP-PITCH/2}" width="${R[i]-L[i]+30}" height="${PERIOD}"/></clipPath><g id="physical-${i}">`;
    for(const wire of wires)s+=`<path class="physical-wire" data-pin="${wire.pin+1}" data-contact="${wire.contact+1}" d="${physicalPath(wire,i)}" fill="none" stroke="#b8c5b4" stroke-width="1" opacity=".6"/>`;
    // Numbers on both faces refer to physical, zero-based library contacts + 1.
    for(let n=0;n<26;n++)for(const x of [L[i],R[i]])s+=`<rect x="${x-12}" y="${y(n)-8}" width="24" height="16" rx="4" fill="#e9ede2"/><text class="internal-number" x="${x}" y="${y(n)+4}" text-anchor="middle">${n+1}</text>`;
    s+='</g>';
  }
  s+='</defs>'+text(reflectX,24,'반사판 B')+text(740,24,'플러그')+text(key,24,'입출력');
  for(let i=0;i<3;i++){
    const r=w.rotors[i],offset=offsets?offsets[i]:r.offset;
    s+=`<rect x="${L[i]-20}" y="52" width="${R[i]-L[i]+40}" height="${PERIOD+44}" rx="9" fill="var(--soft)" stroke="var(--line)"/>`;
    s+=text((L[i]+R[i])/2,24,`로터 ${r.name}`)+text((L[i]+R[i])/2,43,`창 ${position?position[i]:r.position}`);
    // Stationary sockets surround the moving belt. Alphabet badges appear only
    // at signal entry/exit, leaving physical rotor contacts purely numerical.
    for(let n=0;n<26;n++)for(const x of [L[i]-17,R[i]+17])s+=`<circle cx="${x}" cy="${y(n)}" r="1.8" fill="#82917e"/>`;
    s+=`<g clip-path="url(#clip-${i})"><g class="rotor-core" data-rotor="${i}" data-offset="${offset}" style="transform:translateY(${-offset*PITCH}px)">`;
    for(const copy of [-1,0,1,2]){
      s+=`<g class="belt-copy" transform="translate(0 ${copy*PERIOD})"><use href="#physical-${i}"/>`;
      const highlighted=steps.map((t,k)=>({t,k})).filter(({t,k})=>t.component===`rotor${i}`&&k<=step);
      for(const {t,k} of highlighted.sort((a,b)=>(a.k===step?1:0)-(b.k===step?1:0))){
        const back=t.direction==='return',color=back?'#258b8b':'#b97219';
        const pin=back?t.internal_output.number:t.internal_input.number;
        const wire=physicalWires(r)[pin];
        s+=`<path class="${k===step?'active-path active-internal':''}" data-trace-step="${k}" data-internal-input="${t.internal_input.number+1}" data-internal-output="${t.internal_output.number+1}" d="${physicalPath(wire,i,back)}" fill="none" stroke="${color}" stroke-width="${k===step?3.3:2}" opacity="${k===step?1:.35}" marker-end="url(#${back?'back':'forward'})"/>`;
        if(k===step)for(const [x,n] of [[R[i],wire.pin],[L[i],wire.end]])s+=`<rect x="${x-12}" y="${y(n)-8}" width="24" height="16" rx="4" fill="${color}"/><text x="${x}" y="${y(n)+4}" text-anchor="middle" style="fill:white;font-size:12px">${mod(n)+1}</text>`;
      }
      s+='</g>';
    }
    s+='</g></g>';
    s+=`<path d="M${L[i]-12},${TOP-10} H${R[i]+12} M${L[i]-12},${TOP+PERIOD-10} H${R[i]+12}" stroke="#82917e" stroke-dasharray="3 4" fill="none"/>`;
    s+=text((L[i]+R[i])/2,625,'↻ 위·아래가 이어짐','seam-label');
  }
  for(let n=0;n<26;n++){
    if(n<w.reflector[n])s+=`<path d="M${reflectX},${y(n)} C${10+n},${y(n)} ${10+n},${y(w.reflector[n])} ${reflectX},${y(w.reflector[n])}" stroke="#c4cdbd" stroke-width=".8" fill="none"/>`;
    s+=text(reflectX+14,y(n)+4,n+1,'reflector-number');
    s+=text(plugLeft-9,y(n)+4,ABC[n],'plug-letter')+text(plugRight+9,y(n)+4,ABC[n],'plug-letter');
    s+=`<circle cx="${reflectX}" cy="${y(n)}" r="2" fill="#82917e"/>`;
    s+=`<path d="M${plugRight},${y(n)} L${plugLeft},${y(w.plugboard[n])}" stroke="#c4cdbd" stroke-width=".9" fill="none"/>`;
  }
  const rendered=steps.map((t,k)=>({t,k})).filter(({k})=>k<=step).sort((a,b)=>(a.k===step?1:0)-(b.k===step?1:0));
  for(const {t,k} of rendered){
    const a=t.input.number,b=t.output.number,back=k>=6,color=back?'#258b8b':'#b97219',active=k===step;
    let p,entry,exit;
    if(k===0){p=[[key,y(a)],[key-15,y(a)]];entry=p[0];exit=p[1];}
    else if(k===1){p=[[key-15,y(a)],[plugRight,y(a)],[plugLeft,y(b)]];entry=[plugRight,y(a)];exit=p.at(-1);}
    else if(k>=2&&k<=4){const i=4-k;p=[[i===2?plugLeft:L[i+1]-17,y(a)],[R[i]+17,y(a)],[R[i],y(a)]];entry=[R[i]+17,y(a)];exit=[L[i]-17,y(b)];s+=poly([[L[i],y(b)],exit],color,active,back);}
    else if(k===5){p=[[L[0]-17,y(a)],[reflectX,y(a)],[reflectX-40,y(a)],[reflectX-40,y(b)],[reflectX,y(b)]];entry=[reflectX,y(a)];exit=p.at(-1);}
    else if(k<=8){const i=k-6;p=[[i===0?reflectX:R[i-1]+17,y(a)],[L[i]-17,y(a)],[L[i],y(a)]];entry=[L[i]-17,y(a)];exit=[R[i]+17,y(b)];s+=poly([[R[i],y(b)],exit],color,active,back);}
    else {p=[[R[2]+17,y(a)],[plugLeft,y(a)],[plugRight,y(b)],[key,y(b)]];entry=[plugLeft,y(a)];exit=p.at(-1);}
    s+=poly(p,color,active,back);
    if(active)s+=badge(...entry,(k===5||k===6)?t.input.number+1:t.input.letter,color)+badge(...exit,k===5?t.output.number+1:t.output.letter,color);
  }
  s+=text(425,650,rotating?'로터 전체 이동 중 · 회전이 끝나면 전기신호가 진입합니다':'로터·반사판: 1–26 · 플러그·입출력: A–Z','seam-label');
  return s+'</svg>';
}

return {diagramMarkup};
})();
const module4 = (() => {
const {Experiment} = module1;
const {ABC,ROTOR_NAMES,defaults,clean,EnigmaMachine} = module0;
const {diagramMarkup} = module3;
const {rotationRange} = module2;
const $ = s => document.querySelector(s);
const sim = new Experiment(defaults());
let selected=null, step=0, wiring=null, timer=null, playing=false,rotating=false;
let jobsTimer=null,animations=[],motionGeneration=0,scheduledGeneration=0;
let viewingHistory=false, mode='learn', plugPending=null, failed=false, comparison=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const labels=['입력','플러그 진입','오른쪽 →','가운데 →','왼쪽 →','반사판','왼쪽 ←','가운데 ←','오른쪽 ←','플러그 출력'];
const names=['입력 키','플러그보드 · 진입','오른쪽 로터 · 정방향','가운데 로터 · 정방향','왼쪽 로터 · 정방향','반사판 B','왼쪽 로터 · 역방향','가운데 로터 · 역방향','오른쪽 로터 · 역방향','플러그보드 · 복귀 / 출력'];
const status = text => $('#status').textContent=text;
function error(message='') { $('#error').hidden=!message; $('#error').textContent=message; }
function stop() {clearTimeout(timer);timer=null;playing=false;$('#play').textContent='재생 / 재개';$('.diagram').classList.add('paused');}
function cancelMotion(){motionGeneration++;for(const a of animations)a.cancel();animations=[];rotating=false;}
function cancelJobs(){scheduledGeneration++;clearTimeout(jobsTimer);jobsTimer=null;}
function schedule(){
  if(jobsTimer!==null)return;
  const epoch=sim.id,ticket=scheduledGeneration;
  jobsTimer=setTimeout(()=>{jobsTimer=null;if(epoch===sim.id&&ticket===scheduledGeneration)pump();},0);
}
function fields(config) {
  $('#configFields').innerHTML=config.rotors.map((r,i)=>`<div><b>${['왼쪽','가운데','오른쪽'][i]}</b><label>로터<select id="order${i}" aria-label="${['왼쪽','가운데','오른쪽'][i]} 로터">${ROTOR_NAMES.map(x=>`<option ${x===r?'selected':''}>${x}</option>`).join('')}</select></label>${['start'].map(k=>`<label>${k==='start'?'시작 위치':'링 설정'}<select id="${k}${i}" aria-label="${['왼쪽','가운데','오른쪽'][i]} ${k==='start'?'시작 위치':'링 설정'}">${[...ABC].map(x=>`<option ${x===config[k][i]?'selected':''}>${x}</option>`).join('')}</select></label>`).join('')}</div>`).join('');
  const previous=[...config.rotors];
  for(let i=0;i<3;i++) $(`#order${i}`).onchange=e=>{
    // Selecting an installed rotor swaps it with the previous selection.
    const other=[0,1,2].find(j=>j!==i && $(`#order${j}`).value===e.target.value);
    if(other!==undefined)$(`#order${other}`).value=previous[i];
    for(let j=0;j<3;j++)previous[j]=$(`#order${j}`).value;
  };
}
function readFields(){return {rotors:[0,1,2].map(i=>$(`#order${i}`).value),start:[0,1,2].map(i=>$(`#start${i}`).value).join(''),rings:'AAA',plugs:[...sim.config.plugs],reflector:'B'};}
function reset(config, compare=null) {
  // Validate first: rejected settings never destroy the current experiment.
  try {new EnigmaMachine(config);}catch(e){error(e.message);return;}
  stop();cancelMotion();cancelJobs();sim.reset(config);selected=null;step=0;
  wiring=sim.machine.snapshot();
  viewingHistory=false;plugPending=null;failed=false;comparison=compare;error();
  $('#retry').hidden=true;fields(config);renderAll();status('브라우저 실행 · 입력 대기 · 현재 '+sim.position);
}
function queue(text,fast=false,fromDemo=false){
  const filtered=clean(text);if(!filtered)return;
  if(comparison&&!fromDemo){comparison=null;$('#comparison').hidden=true;}
  sim.enqueue(filtered,fast);error();schedule();
}
function pump(){
  if(playing || rotating || selected && step<9 || viewingHistory || failed)return;
  if(!sim.queue.length){status(`브라우저 실행 · 입력 대기 · 현재 ${sim.position}`);return;}
  status(`브라우저 계산 · 대기 ${sim.queue.length}자`);
  try {
    const job=sim.next();selected=job.record;
    if(job.fast){
      // At most 12 letters per task: input/reset can run between batches.
      for(let i=1;i<12 && sim.queue[0]?.fast;i++)selected=sim.next().record;
      wiring=selected.wiring;step=9;renderAll();schedule();
    }else{
      wiring=selected.wiring;step=0;rotateRecord(mode==='fast');
    }
  }catch(e){
    failed=true;error(`${e.message} 작성한 입력은 보존했습니다.`);
    $('#retry').hidden=false;status('오류 · 다시 시도 가능');
  }
}
async function rotateRecord(immediate=false){
  const epoch=sim.id,record=selected,token=++motionGeneration;
  rotating=true;renderAll();renderRotors(record.before,[]);
  const before=new EnigmaMachine(record.config,record.before).snapshot();
  draw({rotating:true,offsets:before.rotors.map(r=>r.offset),position:record.before});
  status(`로터 회전 · ${record.before} → ${record.after} · 대기 ${sim.queue.length}자`);
  animations=[];
  if(!reduced.matches){
    for(const i of record.moved){
      const [from,to]=rotationRange(before.rotors[i].offset,true);
      const core=$(`[data-rotor="${i}"]`);
      animations.push(core.animate([{transform:`translateY(${from}px)`},{transform:`translateY(${to}px)`}],
        {duration:immediate?240:650,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'}));
      const belt=$(`[data-drum="${i}"] .window-belt`);
      animations.push(belt.animate([{transform:'translateY(0px)'},{transform:'translateY(-34px)'}],
        {duration:immediate?240:650,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'}));
    }
    await Promise.all(animations.map(a=>a.finished.catch(()=>{})));
  }
  if(epoch!==sim.id||token!==motionGeneration)return;
  for(const a of animations)a.cancel();animations=[];rotating=false;
  step=immediate?9:0;renderAll();if(immediate)schedule();else play();
}
function play(){
  if(!selected||rotating)return;
  stop();playing=true;$('#play').textContent='일시정지';$('.diagram').classList.remove('paused');
  status(`신호 재생 · ${selected.sequence}번 문자 · 대기 ${sim.queue.length}건`);
  const epoch=sim.id;
  timer=setTimeout(()=>{
    if(epoch!==sim.id)return;
    step=Math.min(9,step+1);renderSignal();
    if(step===9){stop();if(!viewingHistory)schedule();}else play();
  },Number($('#speed').value));
}
function chooseStep(n){if(rotating)return;stop();step=Math.max(0,Math.min(9,n));renderSignal();if(step===9&&!viewingHistory)schedule();}
function renderRotors(position, moved=[]){
  const config=selected?.config || sim.config;
  $('#rotors').innerHTML=config.rotors.map((r,i)=>`<div class="rotor"><div class="rotor-label">${['LEFT','MID','RIGHT'][i]} · ${r}</div><div class="drum ${moved.includes(i)?'moved':''}" data-drum="${i}"><div class="window-mask"><div class="window-belt">${[-1,0,1,2].map(d=>`<strong>${ABC[(ABC.indexOf(position[i])+d+26)%26]}</strong>`).join('')}</div></div></div><div class="ring">${moved.includes(i)?'↻ 회전':'대기'}</div></div>`).join('');
  $('.plate span:last-child').textContent=config.rotors.join(' · ');
  $('#positionLabel').textContent=`현재 계산 ${sim.position}${selected?` · 표시 ${position} (${selected.sequence}번)`:''}`;
}
function renderPlugs(){
  // The physical plugboard always shows the current experiment, even during history review.
  const pairs=sim.config.plugs;
  document.querySelectorAll('[data-plug]').forEach(b=>{b.classList.toggle('connected',pairs.some(p=>p.includes(b.dataset.plug)));b.classList.toggle('pending',b.dataset.plug===plugPending);b.setAttribute('aria-pressed',String(pairs.some(p=>p.includes(b.dataset.plug))));});
  const point=c=>{const i=ABC.indexOf(c);return [15+(i%13)*30,22+Math.floor(i/13)*52];};
  $('#plugWires').innerHTML=pairs.map((p,i)=>{const [x,y]=point(p[0]),[a,b]=point(p[1]);return `<path d="M${x},${y} C${x},${Math.max(y,b)+25} ${a},${Math.max(y,b)+25} ${a},${b}" fill="none" stroke="${i%2?'#95a594':'#c3ab72'}" stroke-width="3"><title>${p[0]} ↔ ${p[1]}</title></path>`;}).join('');
  $('#plugList').innerHTML=pairs.length?pairs.map(p=>`<button data-remove="${p}" aria-label="${p} 연결 해제">${p[0]} ↔ ${p[1]} ×</button>`).join(''):'플러그 연결 없음';
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removePlug(b.dataset.remove));
}
function removePlug(pair){reset({...sim.config,plugs:sim.config.plugs.filter(p=>p!==pair)});}
function plug(c){
  const pair=sim.config.plugs.find(p=>p.includes(c));
  if(pair){removePlug(pair);return;}
  if(plugPending===c){plugPending=null;renderPlugs();return;}
  if(!plugPending){plugPending=c;renderPlugs();return;}
  if(sim.config.plugs.length>=10){error('플러그는 최대 10쌍입니다. 연결된 문자를 눌러 먼저 해제하세요.');plugPending=null;renderPlugs();return;}
  reset({...sim.config,plugs:[...sim.config.plugs,plugPending+c]});
}
function renderAll(){
  renderRotors(selected?.after || sim.position,selected?.moved || []);renderPlugs();
  $('#plain').textContent=sim.records.map(r=>r.input).join('')||'—';
  $('#cipher').textContent=sim.records.map(r=>r.output).join('')||'—';
  $('#history').innerHTML=sim.records.map(r=>`<button ${rotating?'disabled':''} data-record="${r.sequence-1}" class="${selected?.id===r.id?'selected':''}" aria-label="${r.sequence}번 ${r.input}에서 ${r.output} 기록">${r.sequence} · ${r.input}→${r.output}</button>`).join('');
  document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{
    if(rotating)return;
    stop();cancelJobs();viewingHistory=true;selected=sim.records[Number(b.dataset.record)];step=9;renderAll();status('과거 기록 조회 · 현재 계산 상태 보존');
  });
  $('#historical').textContent=selected?`${viewingHistory?'과거 기록 조회 · ':''}시작 ${selected.config.start} / 순서 ${selected.config.rotors.join('–')} / 반사판 B / 플러그 ${selected.config.plugs.join(' ')||'없음'} / 회전 ${selected.before} → ${selected.after} / 현재 계산 위치 ${sim.position}`:'';
  $('#comparison').hidden=!comparison;
  if(comparison){const restored=sim.records.map(r=>r.output).join('');$('#comparison').textContent=`원본 입력: ${comparison.original} ｜ 복원 결과: ${restored||'처리 중'} ｜ ${restored.length<comparison.original.length?'복호화 진행 중':restored===comparison.original?'✓ 일치':'불일치'}`;}
  renderSignal();
}
function renderSignal(){
  const s=selected?.steps[step];
  $('.trace').innerHTML=selected?selected.steps.map((s,i)=>`<button ${rotating?'disabled':''} data-step="${i}" class="${step===i?'selected':''}" aria-pressed="${step===i}"><span>${labels[i]}</span><strong>${s.input.letter}→${s.output.letter}</strong></button>`).join(''):'';
  document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>chooseStep(Number(b.dataset.step)));
  $('.step-number').textContent=rotating?'로터 회전 중':selected?`${step+1} / 10`:'대기';
  $('.now-name').textContent=s?`${names[step]}${s.component.startsWith('rotor')?' '+s.name:''}`:'키를 눌러 시작하세요';
  $('.letters').textContent=s?`${s.input.letter} → ${s.output.letter}`:'—';
  $('#recordLabel').textContent=selected?`기록 ${selected.sequence} · ${selected.before} → ${selected.after} · 회전 ${selected.moved.map(i=>['왼쪽','가운데','오른쪽'][i]).join(', ')}`:'입력 전 로터가 먼저 회전합니다';
  $('#explanation').textContent=rotating?`${selected.before} → ${selected.after} · 숫자 접점과 내부 배선 전체가 한 칸 이동합니다.`:s?`외부 ${s.input.letter} → ${s.output.letter}${s.internal_input?` · 내부 ${s.internal_input.number+1} → ${s.internal_output.number+1}`:''}${step===0?' · 기계식 회전 완료, 신호 진입 준비':''}`:'내부 접점은 1~26, 신호 입출력은 A~Z입니다. 키를 누르면 로터 전체가 먼저 회전합니다.';
  document.querySelectorAll('[data-key]').forEach(b=>{const input=selected?.input===b.dataset.key,output=selected?.output===b.dataset.key&&step===9;b.classList.toggle('input',input);b.classList.toggle('output',output);b.setAttribute('aria-label',`${b.dataset.key} 입력${input?' · 선택한 입력':''}${output?' · 출력 램프 켜짐':''}`);});
  $('#keyState').textContent=selected?`입력: ${selected.input} (이중 테두리) · 출력 램프: ${step===9?selected.output+' 점등':'신호 진행 중'}`:'입력: — · 출력 램프: —';
  for(const id of ['prev','next','play','replay'])$('#'+id).disabled=!selected||rotating;
  for(const id of ['detail','zoom','live'])$('#'+id).disabled=rotating;
  draw();
}
function draw(options){
  if(rotating&&!options)return;
  const w=selected?.wiring || wiring;if(!w)return;
  const scroller=$('.diagram'),left=scroller.scrollLeft,top=scroller.scrollTop;
  scroller.innerHTML=diagramMarkup(w,selected,step,options||{});
  $('.diagram svg').style.width=(Math.min(680,scroller.clientWidth-20,Math.max(260,window.innerHeight-350)*850/660)*Number($('#zoom').value))+'px';
  scroller.scrollLeft=left;scroller.scrollTop=top;
  scroller.classList.toggle('paused',!playing);
  $('#detailPanel').hidden=!$('#detail').checked;
  const s=selected?.steps[step];
  if(s?.internal_input){
    $('#detailPanel').textContent=`외부 ${s.input.letter} → 내부 ${s.internal_input.number+1} → 내부 ${s.internal_output.number+1} → 외부 ${s.output.letter} · 내부 번호는 배선에 고정되어 로터와 함께 이동합니다.`;
  }else $('#detailPanel').textContent='외함의 작은 점은 고정 접점입니다. 내부 숫자와 배선은 한 몸으로 순환합니다. 위·아래 경계에서 끊겨 보이는 선은 반대편의 같은 선으로 이어집니다.';
}
for(const row of ['QWERTZUIO','ASDFGHJK','PYXCVBNML']){const div=document.createElement('div');div.className='keyrow';for(const c of row){const b=document.createElement('button');b.className='key';b.dataset.key=c;b.textContent=c;b.setAttribute('aria-label',c+' 입력');b.onclick=()=>queue(c);div.append(b);}$('.keyboard').append(div);}
for(const c of ABC){const b=document.createElement('button');b.className='socket';b.dataset.plug=c;b.innerHTML=c+'<i></i>';b.setAttribute('aria-label',c+' 플러그 연결 또는 해제');b.onclick=()=>plug(c);$('.sockets').append(b);}
document.addEventListener('keydown',e=>{if(e.isComposing||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();queue(e.key.toUpperCase());}});
$('#prev').onclick=()=>chooseStep(step-1);$('#next').onclick=()=>chooseStep(step+1);
$('#play').onclick=()=>{if(playing)stop();else{if(step===9)step=0;renderSignal();play();}};
$('#replay').onclick=()=>{stop();step=0;renderSignal();play();};
$('#speed').onchange=()=>{if(playing)play();};$('#detail').onchange=()=>draw();$('#zoom').onchange=()=>draw();
$('#apply').onclick=()=>reset(readFields());$('#new').onclick=()=>reset(readFields());
$('#restore').onclick=()=>reset(sim.config);$('#defaults').onclick=()=>reset(defaults());
$('#live').onclick=()=>{stop();cancelMotion();cancelJobs();viewingHistory=false;selected=sim.records.at(-1)||null;step=9;renderAll();pump();};
$('#retry').onclick=()=>{failed=false;$('#retry').hidden=true;error();pump();};
$('#text').oninput=()=>{const raw=$('#text').value,filtered=clean(raw);$('#filtered').textContent=filtered||'(없음)';$('#excluded').textContent=`· 제외 ${[...raw].length-filtered.length}자`;};
$('#typeText').onclick=()=>queue($('#text').value);$('#batch').onclick=()=>queue($('#text').value,true);
$('#decrypt').onclick=()=>{
  if(!sim.records.length){error('먼저 암호화할 문자를 입력하세요.');return;}
  const original=sim.records.map(r=>r.input).join(''),cipher=sim.records.map(r=>r.output).join(''),config=structuredClone(sim.config);
  reset(config,{original});queue(cipher,true,true);
};
function setMode(next){mode=next;for(const [id,m] of [['learn','learn'],['fastMode','fast']]){$('#'+id).classList.toggle('active',mode===m);$('#'+id).setAttribute('aria-pressed',String(mode===m));}if(mode==='fast'&&selected&&!viewingHistory&&!rotating)chooseStep(9);status(mode==='fast'?'암호화 모드 · 로터 회전 후 출력, 기록에서 신호 재생 가능':'학습 모드 · 문자마다 신호 재생');}
$('#learn').onclick=()=>setMode('learn');$('#fastMode').onclick=()=>setMode('fast');
new ResizeObserver(()=>draw()).observe($('.diagram'));
window.addEventListener('resize',()=>draw());
reset(defaults());

return {};
})();
})();
