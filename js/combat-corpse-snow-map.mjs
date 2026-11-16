import * as T from '../assets/vendor/three/three.module.min.js';
import {createSnowCoatCoverage} from './combat-snow-coats.mjs?v=tree-snow-grains1';
export const CORPSE_SNOW_LAYER_METRES=.0127;
export const CORPSE_SNOW_LAYERS=4;
export const CORPSE_SNOW_LAYER_SECONDS=30;
// Reuse terrain's soft, persistent grain brushes and full-material coverage
// gates. Each independent half-inch coat occupies one RGBA channel.
export function createCorpseSnowMap(top,size=64){
 const triangles=[];for(let y=0;y<size;y++){let x=0;while(x<size){if(!Number.isFinite(top[y*size+x])){x++;continue;}const start=x;while(x<size&&Number.isFinite(top[y*size+x]))x++;const a={x:start,y},b={x,y},c={x,y:y+1},d={x:start,y:y+1};triangles.push({a,b,c},{a,c,b:d});}}
 const layers=Array.from({length:4},()=>{const coat=createSnowCoatCoverage();coat.configure([0,0,size,size],size,size,new Map([['body',{triangles}]]));return coat;});
 const data=new Uint8Array(size*size*4),texture=new T.DataTexture(data,size,size);texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
 let previous=-1,seed=87319;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return {texture,get progress(){return layers.reduce((n,c)=>n+Math.min(1,c.progress),0);},
 get coverage(){const values=layers.map(c=>c.coverage.first);return {first:values[0],second:values[1],depth:values[2],fourth:values[3],layers:values};},
 update(amount){
  amount=Math.max(0,Math.min(4,Number(amount)||0));if(amount===previous)return false;
  for(let layer=0;layer<4;layer++){
   const coat=layers[layer],target=Math.max(0,Math.min(1,amount-layer));
   if(target===0){coat.clear();continue;}if(target>=1){coat.fill();continue;}
   if(amount<previous)coat.clear();
   for(let i=0;i<16384&&coat.coverage.texels&&coat.progress<target;i++)coat.deposit({x:random()*size,y:random()*size},random);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let layer=0;layer<4;layer++){const s=layers[layer].sample(x,y);data[(y*size+x)*4+layer]=s.eligible?s.first:0;}
  previous=amount;texture.needsUpdate=true;return true;
 },dispose(){texture.dispose();}};
}
