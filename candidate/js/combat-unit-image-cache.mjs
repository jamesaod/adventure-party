// Retained final-pose images. Own their targets separately from the scratch pool.
// Bound both entry count and estimated color/depth/MSAA storage; never grow per death.
export function createUnitImageCache(createTarget,{maxBytes=64*1024*1024,maxEntries=64,bytesPerPixel=8}={}){
 const entries=new Map();let bytes=0;
 function remove(owner){const e=entries.get(owner);if(!e)return;entries.delete(owner);bytes-=e.bytes;e.target.dispose();}
 return {
  get(owner,key,width,height,samples){
   const cost=width*height*bytesPerPixel*(1+samples);if(cost>maxBytes)return null;
   let e=entries.get(owner);
   if(e&&(e.width!==width||e.height!==height||e.samples!==samples)){remove(owner);e=null;}
   if(e){entries.delete(owner);entries.set(owner,e);if(e.key!==key){e.key=key;e.ready=false;}return e;}
   while(entries.size&&(entries.size>=maxEntries||bytes+cost>maxBytes))remove(entries.keys().next().value);
   e={key,width,height,samples,bytes:cost,target:createTarget(width,height,samples),ready:false};entries.set(owner,e);bytes+=cost;return e;
  },
  clear(){for(const owner of entries.keys())remove(owner);},
  stats(){return {entries:entries.size,bytes,maxBytes};}
 };
}
