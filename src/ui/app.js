import {Experiment} from '../experiment/state.js';
import {ABC,defaults,clean,EnigmaMachine} from '../core/enigma.js';
import {diagramMarkup} from './diagram.js';
import {rotationRange} from './geometry.js';
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
  $('#configFields').innerHTML=config.rotors.map((r,i)=>`<div><b>${['왼쪽','가운데','오른쪽'][i]}</b><label>로터<select id="order${i}" aria-label="${['왼쪽','가운데','오른쪽'][i]} 로터">${['I','II','III','IV','V'].map(x=>`<option ${x===r?'selected':''}>${x}</option>`).join('')}</select></label>${['start'].map(k=>`<label>${k==='start'?'시작 위치':'링 설정'}<select id="${k}${i}" aria-label="${['왼쪽','가운데','오른쪽'][i]} ${k==='start'?'시작 위치':'링 설정'}">${[...ABC].map(x=>`<option ${x===config[k][i]?'selected':''}>${x}</option>`).join('')}</select></label>`).join('')}</div>`).join('');
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
