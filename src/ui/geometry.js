import {mod} from '../core/enigma.js';
export const PITCH=20;
export const PERIOD=26*PITCH;
export const TOP=85;
export const y=n=>TOP+n*PITCH;
export const LEFT=[155,340,525];
export const RIGHT=[285,470,655];
// A physical wire's geometry is immutable. Offset is applied to its PARENT,
// never by reconnecting or interpolating either endpoint independently.
export function physicalWires(rotor){
  const result=Array(26);
  for(const c of rotor.connections){
    const p=c.internal_input,q=c.internal_output;
    let distance=mod(q-p);if(distance>13)distance-=26;
    result[p]={pin:p,contact:q,end:p+distance};
  }
  return result;
}
export function physicalPath(wire,i,back=false){
  return back?`M${LEFT[i]},${y(wire.end)} L${RIGHT[i]},${y(wire.pin)}`:
    `M${RIGHT[i]},${y(wire.pin)} L${LEFT[i]},${y(wire.end)}`;
}
export const externalRow=(internal,offset)=>mod(internal-offset);
export const rotationRange=(beforeOffset,moved)=>[-beforeOffset*PITCH,-(beforeOffset+(moved?1:0))*PITCH];
