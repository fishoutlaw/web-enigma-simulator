import {ABC,mod} from '../core/enigma.js';
import {PITCH,PERIOD,TOP,y,LEFT as L,RIGHT as R,physicalWires,physicalPath} from './geometry.js';
const text=(x,yy,value,cls='contact-label')=>`<text x="${x}" y="${yy}" text-anchor="middle" class="${cls}">${value}</text>`;
const poly=(points,color,active=false,back=false)=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${active?3.4:1.8}" opacity="${active?1:.28}" marker-end="url(#${back?'back':'forward'})" class="${active?'active-path':''}"/>`;
const badge=(x,yy,label,color)=>`<circle cx="${x}" cy="${yy}" r="4" fill="${color}"/><rect x="${x-10}" y="${yy-27}" width="20" height="18" rx="4" fill="${color}"/><text x="${x}" y="${yy-14}" text-anchor="middle" style="fill:#fff;font-size:12px;font-weight:600">${label}</text>`;

export function diagramMarkup(w,record,step,{rotating=false,offsets=null,position=null}={}){
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
