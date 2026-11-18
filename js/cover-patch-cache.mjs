// Conservative spatial buckets: exact shape tests remain with the caller.
export function createCoverSpatialIndex(items,bounds,step=128){
 const cells=new Map(),order=new Map(items.map((item,i)=>[item,i]));
 for(const item of items){const r=bounds(item);for(let x=Math.floor(r.left/step);x<=Math.floor(r.right/step);x++)for(let y=Math.floor(r.top/step);y<=Math.floor(r.bottom/step);y++){const key=x+','+y;let cell=cells.get(key);if(!cell)cells.set(key,cell=[]);cell.push(item);}}
 return {at(x,y){return cells.get(Math.floor(x/step)+','+Math.floor(y/step))||[];},within(r){const found=new Set();for(let x=Math.floor(r.left/step);x<=Math.floor(r.right/step);x++)for(let y=Math.floor(r.top/step);y<=Math.floor(r.bottom/step);y++)for(const item of cells.get(x+','+y)||[])found.add(item);return [...found].sort((a,b)=>order.get(a)-order.get(b));}};
}
export function createCoverPatchCache(limit=16000){
 const entries=new Map();
 return {get(key,source,signature,build){const old=entries.get(key);if(old&&old.source===source&&old.signature===signature)return {items:old.items,reused:true};const items=build();if(!entries.has(key)&&entries.size>=limit)entries.delete(entries.keys().next().value);entries.set(key,{source,signature,items});return {items,reused:false};},clear(){entries.clear();}};
}
