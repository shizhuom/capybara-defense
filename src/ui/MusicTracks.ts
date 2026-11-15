export type MusicMode='menu'|'battle'|'boss';
export type Note={frequency:number;delay:number;duration:number;volume:number;type?:OscillatorType;slide?:number;cutoff?:number;cutoffSlide?:number;attack?:number;noise?:boolean};
export const tempos:Record<MusicMode,number>={menu:116,battle:124,boss:138};
const hz=(midi:number)=>440*2**((midi-69)/12);
const note=(midi:number,duration:number,volume:number,type:OscillatorType='triangle',cutoff=2800,attack=.008,delay=0):Note=>({frequency:hz(midi),delay,duration,volume,type,cutoff,attack});

// Sixteen composed bars, eight melody notes per bar. A scheduler step is one quarter
// note; its second eighth note lives in Note.delay, preserving the full 128-note phrase.
const pastoral=[
  [74,71,67,69,71,74,79,76],[74,72,71,69,67,71,74,71],
  [76,74,72,71,69,72,76,79],[78,76,74,72,71,69,66,69],
  [71,74,79,78,76,74,71,67],[69,71,72,76,74,72,69,66],
  [67,71,74,79,81,79,76,74],[72,71,69,66,67,69,71,74],
  [79,78,76,74,76,79,83,81],[79,76,74,71,72,74,76,79],
  [81,79,76,72,74,76,79,76],[78,74,71,69,66,69,74,78],
  [79,74,71,67,69,71,74,79],[76,72,69,66,69,72,76,74],
  [71,74,79,76,74,71,69,66],[67,71,74,79,78,74,71,67],
];
const tactical=[
  [62,69,65,67,69,72,71,69],[62,65,69,74,72,69,67,65],
  [60,67,64,65,67,71,69,67],[57,64,60,62,64,67,65,64],
  [62,65,69,65,67,69,72,74],[65,69,72,76,74,72,69,67],
  [67,71,74,72,71,69,67,64],[69,67,65,64,62,64,65,69],
  [74,72,69,67,65,69,72,74],[76,74,72,69,67,69,72,76],
  [72,71,67,64,65,67,71,74],[69,65,64,60,62,64,67,69],
  [74,69,65,62,65,69,72,71],[65,67,69,72,74,76,74,72],
  [71,74,77,76,74,71,69,67],[69,65,64,62,60,64,65,62],
];
const showdown=[
  [60,67,72,71,70,67,63,62],[61,68,73,72,71,68,64,63],
  [62,69,74,73,72,69,65,64],[59,66,71,70,69,66,62,61],
  [60,63,67,72,75,74,73,72],[65,68,72,77,76,75,72,68],
  [66,69,73,78,77,76,73,69],[67,70,74,79,78,77,74,70],
  [72,79,84,83,82,79,75,74],[73,80,85,84,83,80,76,75],
  [74,81,86,85,84,81,77,76],[71,78,83,82,81,78,74,73],
  [72,75,79,84,83,82,79,75],[77,76,75,72,68,69,70,71],
  [78,77,76,73,69,70,71,72],[79,78,77,74,70,67,63,60],
];
const menuRoots=[43,40,48,38,43,45,40,38,43,40,48,38,43,45,38,43];
const battleRoots=[38,38,36,33,38,41,43,33,38,41,36,33,38,41,43,38];
const bossRoots=[36,37,38,35,36,41,42,43,36,37,38,35,36,41,42,43];

/** One quarter-note of independent orchestral, tactical or chromatic boss music. */
export function musicStep(mode:MusicMode,step:number):Note[] {
  const wrapped=((Math.floor(step)%64)+64)%64,bar=Math.floor(wrapped/4),beat=wrapped%4;
  const quarter=60/tempos[mode],eighth=quarter/2;
  if(mode==='menu'){
    const root=menuRoots[bar],melody=pastoral[bar];
    const out=[note(melody[beat*2],eighth*.9,.31),note(melody[beat*2+1],eighth*.82,.27,'triangle',2800,.008,eighth)];
    // Warm walking cello, offbeat pizzicato, and bright glockenspiel. No noise drums.
    out.push(note(root+(beat%2?7:0),quarter*.68,.28,'triangle',1200));
    out.push(note(root+19, .09,.2,'triangle',2200,.004,eighth));
    if(beat%2===0)out.push(note(melody[beat*2]+12,.22,.12,'sine',6500,.003));
    if(beat===0)out.push(note(root+12,quarter*3.5,.09,'triangle',1100,.06));
    return out;
  }
  const boss=mode==='boss',root=(boss?bossRoots:battleRoots)[bar],melody=(boss?showdown:tactical)[bar];
  const out=[note(melody[beat*2],eighth*.74,boss?.28:.31,'sawtooth',boss?2850:1950),note(melody[beat*2+1],eighth*.7,.25,'sawtooth',boss?2850:1950,.006,eighth)];
  out.push(note(root, eighth*.78,.3,'triangle',800),note(root+(beat%2?7:12),eighth*.7,.24,'triangle',1000,.006,eighth));
  if(beat%2===0||boss)out.push({frequency:boss?148:135,slide:48,delay:0,duration:.19,volume:boss?.38:.34,type:'sine',cutoff:550,attack:.003});
  if(beat%2===1)out.push({frequency:1900,delay:0,duration:.085,volume:.15,noise:true,cutoff:1800,attack:.003});
  if(boss)out.push({frequency:155,slide:52,delay:eighth,duration:.13,volume:.25,type:'triangle',cutoff:800,attack:.003});
  if(beat===0&&(boss||bar>=8))out.push(...[12,boss?15:19,24].map(interval=>note(root+interval,quarter*1.5,.11,'sawtooth',boss?2300:1700,.025)));
  return out;
}
