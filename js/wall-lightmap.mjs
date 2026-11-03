// Independent, padded lighting UV islands. Artwork UV repeats are untouched.
// Each tactical fragment owns an island, preserving the approved hex lighting.
export function createWallLightmap(fragments,createCanvas=()=>document.createElement('canvas')){
 const tile=8,pad=2,columns=Math.max(1,Math.ceil(Math.sqrt(fragments.length))),rows=Math.max(1,Math.ceil(fragments.length/columns));
 const width=columns*tile,height=rows*tile,layers=[createCanvas(),createCanvas()],islands=new Map();
 for(const canvas of layers){canvas.width=width;canvas.height=height;}
 const contexts=layers.map(c=>c.getContext('2d'));
 fragments.forEach((fragment,i)=>{
  const x=i%columns*tile,y=Math.floor(i/columns)*tile;
  islands.set(fragment,{x,y,tile,pad,width,height});
  for(let layer=0;layer<2;layer++){
   const rgb=layer?fragment.exposure.boost:fragment.exposure.multiply;
   contexts[layer].fillStyle=`rgb(${rgb.map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')})`;
   contexts[layer].fillRect(x,y,tile,tile); // Extend edge texels into the gutter.
  }
 });
 return {space:'uv',layers,islands};
}
export function wallLightingUv(atlas,fragment,point){
 const island=atlas.islands.get(fragment),p=fragment.points,a=p[0],b=p[1],dx=b.x-a.x,dy=b.y-a.y;
 const low=Math.min(...p.map(v=>v.elevation||0)),high=Math.max(...p.map(v=>v.elevation||0));
 const clamp=n=>Math.max(0,Math.min(1,n));
 const u=fragment.cap?(point.x-Math.min(...p.map(v=>v.x)))/Math.max(.00001,Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x))):((point.x-a.x)*dx+(point.y-a.y)*dy)/Math.max(.00001,dx*dx+dy*dy);
 const v=fragment.cap?(point.y-Math.min(...p.map(v=>v.y)))/Math.max(.00001,Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y))):((point.elevation||0)-low)/Math.max(.00001,high-low);
 return [(island.x+island.pad+clamp(u)*(island.tile-2*island.pad))/island.width,1-(island.y+island.pad+clamp(v)*(island.tile-2*island.pad))/island.height];
}
