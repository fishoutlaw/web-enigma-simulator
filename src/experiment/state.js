import {EnigmaMachine,clean,validate} from '../core/enigma.js';
let generation=0;
export class Experiment {
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
