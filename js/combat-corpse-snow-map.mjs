import * as T from '../assets/vendor/three/three.module.min.js';
import {createSnowCoatCoverage} from './combat-snow-coats.mjs?v=R238C327';
// The same retained grain brushes, coverage gates and material ramp as ground.
export function createCorpseSnowMap(top,size=64){
 const coats=createSnowCoatCoverage(),triangles=[];
 for(let y=0;y<size;y++){let x=0;while(x<size){if(!Number.isFinite(top[y*size+x])){x++;continue;}const start=x;while(x<size&&Number.isFinite(top[y*size+x]))x++;const a={x:start,y},b={x,y},c={x,y:y+1},d={x:start,y:y+1};triangles.push({a,b,c},{a,c,b:d});}}
 coats.configure([0,0,size,size],size,size,new Map([['body',{key:'body',triangles}]]));
 const data=new Uint8Array(size*size*4),texture=new T.DataTexture(data,size,size);texture.minFilter=texture.magFilter=T.NearestFilter;texture.needsUpdate=true;
 let previous=-1,seed=87319;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return {texture,get progress(){return coats.progress;},get coverage(){return coats.coverage;},update(amount){
  amount=Math.max(0,Math.min(6,amount));if(amount===previous)return false;
  if(amount<previous){if(!amount)coats.clear();else coats.melt(['body'],1-amount/Math.max(previous,.00001));}
  if(amount>=3)coats.fill();else for(let i=0;i<16384&&coats.progress<amount-.00001;i++)coats.deposit({x:random()*size,y:random()*size},random);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const s=coats.sample(x,y),i=(y*size+x)*4;data[i]=s.eligible?s.first:0;data[i+1]=s.eligible?s.second:0;data[i+2]=s.eligible?s.depth:0;data[i+3]=s.eligible?Math.round(Math.max(0,amount-3)/3*255):0;}
  texture.needsUpdate=true;previous=amount;return true;
 },dispose(){texture.dispose();}};
}
