'use strict';
const fs=require('node:fs');
const path=require('node:path');
const original=fs.readFileSync(path.resolve(__dirname,'../../../analysis/recovered-game/js/bundle.js'),'utf8');
function norm(t) {
 return t.replace(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g,(m,a,b)=>{
  try{return JSON.stringify(JSON.parse('"'+(a??b).replace(/(?<!\\)"/g,'\\"')+'"'));}catch{return m;}
 }).replace(/("(?:\\.|[^"\\])*")\.split\(""\)\.reverse\(\)\.join\(""\)/g,(m,a)=>JSON.stringify(JSON.parse(a).split('').reverse().join('')))
 .replace(/0x([a-f0-9]+)\^0x([a-f0-9]+)/g,(m,a,b)=>String(parseInt(a,16)^parseInt(b,16)));
}
const simple=norm(original);
const operators=new Map();
for(const m of simple.matchAll(/"([\w$]+)":function\((_0x[a-f0-9]+),(_0x[a-f0-9]+)\)\{return ([^;{}]+);\}/g)) {
 const a=m[2],b=m[3],expr=m[4];
 for(const op of ['^','+','-','*','/','%','<','<=','>','>=','==','===','!==','!=']) if(expr===a+op+b) operators.set(m[1],op);
}
function arithmetic(op,a,b) {switch(op){case'^':return a^b;case'+':return a+b;case'-':return a-b;case'*':return a*b;case'/':return a/b;case'%':return a%b;default:return undefined;}}
const code=simple.replace(/_0x4bc2b2\["([\w$]+)"\]\((0x[a-f0-9]+|-?\d+(?:\.\d+)?),(0x[a-f0-9]+|-?\d+(?:\.\d+)?)\)/g,(m,k,a,b)=>{const v=arithmetic(operators.get(k),Number(a),Number(b));return v===undefined?m:String(v);});
module.exports={original,code,norm,operators};
if(require.main===module) {
 const query=process.argv[2];
 const radius=Number(process.argv[3]||700);
 let i=-1,count=0;
 while((i=code.indexOf(query,i+1))>=0&&count++<30) console.log(JSON.stringify({offset:i,text:code.slice(Math.max(0,i-radius),i+query.length+radius)}));
}
