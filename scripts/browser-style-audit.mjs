/** Audit actual text runs, including disabled/locked text and content reachable by scrolling. */
export async function auditDialogText(page){
 return page.locator('#game-dialog').evaluate(dialog=>{
  const rgb=s=>{const m=s.match(/^rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(/[\s,\/]+/).map(Number);return[v[0],v[1],v[2],v[3]??1];};
  const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
  const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const backgrounds=new WeakMap(),styles=new WeakMap(),style=e=>{if(!styles.has(e))styles.set(e,getComputedStyle(e));return styles.get(e);};
  function background(e){
   if(!e)return[[255,255,255]];if(backgrounds.has(e))return backgrounds.get(e);
   const s=style(e),under=background(e.parentElement),base=rgb(s.backgroundColor)??[0,0,0,0];
   let colors=under.map(c=>blend(base,c));
   const stops=s.backgroundImage.match(/rgba?\([^)]+\)/g)?.map(rgb).filter(Boolean)??[];
   if(stops.length)colors=colors.flatMap(c=>stops.map(stop=>blend(stop,c)));
   if(Number(s.opacity)<1)colors=colors.flatMap(c=>under.map(b=>blend([...c,Number(s.opacity)],b)));
   colors.sort((a,b)=>luminance(a)-luminance(b));const extremes=[colors[0],colors.at(-1)];backgrounds.set(e,extremes);return extremes;
  }
  const issues=[],runs=[],walker=document.createTreeWalker(dialog,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,text=node.textContent.trim(),parent=node.parentElement;
   // Collapsed native selects paint their selected option using the select's
   // own style/bounds; option nodes themselves have no layout rectangles.
   const e=parent?.tagName==='OPTION'?(parent.selected?parent.closest('select'):null):parent;
   if(!text||!e||e.closest('svg,[aria-hidden="true"],script,style'))continue;
   const equipment=e.closest('.equip-hero');
   if(equipment&&style(equipment).clipPath==='inset(50%)')continue;
   if(!e.getClientRects().length)continue;
   let opacity=1,hidden=false;for(let p=e;p;p=p.parentElement){const s=style(p);opacity*=Number(s.opacity);if(s.visibility==='hidden'||s.display==='none')hidden=true;}
   if(hidden||opacity===0)continue;
   const s=style(e),fg=rgb(s.color),bg=background(e);if(!fg)continue;
   const contrast=Math.min(...bg.map(b=>ratio(blend([fg[0],fg[1],fg[2],fg[3]*opacity],b),b)));
   const run={text:text.slice(0,110),selector:e.tagName.toLowerCase()+(e.className?'.'+String(e.className).replaceAll(' ','.'):''),weight:Number(s.fontWeight),size:parseFloat(s.fontSize),color:s.color,contrast:Number(contrast.toFixed(3)),opacity};
   runs.push(run);if(run.weight<700||contrast<7)issues.push(run);
  }
  return{checked:runs.length,minContrast:Math.min(...runs.map(r=>r.contrast)),issues,runs};
 });
}
