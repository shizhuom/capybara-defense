export type MusicMode='menu'|'battle'|'boss';
export type Note={frequency:number;delay:number;duration:number;volume:number;type?:OscillatorType;slide?:number;cutoff?:number;attack?:number;noise?:boolean};
export const tempos:Record<MusicMode,number>={menu:84,battle:108,boss:124};
const hz=(midi:number)=>440*2**((midi-69)/12);
const note=(midi:number,duration:number,volume:number,type:OscillatorType='sine',cutoff=2200,attack=.012):Note=>({frequency:hz(midi),delay:0,duration,volume,type,cutoff,attack});

/** One eighth-note of each arrangement, with independent lead, bass/pad and percussion. */
export function musicStep(mode:MusicMode,step:number):Note[] {
  const eighth=30/tempos[mode],bar=Math.floor(step/8)%4,index=step%8;
  if(mode==='menu'){
    // Cmaj9 – Am9 – Fmaj9 – G6/9. The sevenths/ninths also live in the slow pad.
    const chords=[[48,52,55,59,62],[45,48,52,55,59],[41,45,48,52,55],[43,47,50,52,57]];
    const chord=chords[bar],out=[note(chord[[0,2,1,3,2,4,3,1][index]]+24,eighth*1.7,.23)];
    if(index===0)out.push(...chord.map(midi=>note(midi,eighth*8.6,.055,'triangle',850,.23)));
    return out;
  }
  const roots=[48,45,41,43],root=roots[bar];
  const melody=mode==='battle'?[12,16,19,21,19,16,14,16]:[12,19,16,19,22,21,19,16];
  const out=[note(root+melody[index],eighth*(mode==='boss'?.75:1.15),mode==='boss'?.21:.24,'sine',mode==='boss'?2300:1900)];
  if(index%2===0)out.push(note(root-12+(index===6?7:0),eighth*.8,.26,'triangle',700,.008));
  // One shared short white-noise buffer is filtered differently for each pulse.
  out.push({frequency:1700,delay:0,duration:mode==='boss'?.07:.045,volume:index%2?.045:.075,noise:true,cutoff:mode==='boss'?2400:1500,attack:.005});
  if(mode==='boss'&&index%4===0)out.push({frequency:115,slide:43,delay:0,duration:.17,volume:.28,type:'sine',cutoff:450,attack:.006});
  return out;
}
