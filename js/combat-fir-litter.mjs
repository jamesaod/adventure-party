// Static seeded needle litter, baked once for a battlefield's fir placement.
export function createFirLitter(trees,bounds,radius){
 const image=document.createElement('canvas');image.width=image.height=1024;
 const ctx=image.getContext('2d'),[left,top,width,height]=bounds,sx=1024/width,sy=1024/height;
 let seed=129731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const tree of trees){
  const cx=(tree.x-left)*sx,cy=(tree.y-top)*sy,rx=radius*sx,ry=radius*sy;
  ctx.save();ctx.translate(cx,cy);ctx.scale(rx,ry);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);gradient.addColorStop(0,'rgba(91,61,34,.65)');gradient.addColorStop(.5,'rgba(112,74,39,.36)');gradient.addColorStop(1,'rgba(112,74,39,0)');ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(0,0,1,.95,0,0,Math.PI*2);ctx.fill();ctx.restore();
  const phase=random()*6.28;
  for(let i=0;i<950;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random()),edge=.84+.1*Math.sin(angle*5+phase)+.06*Math.cos(angle*9-phase);
   if(r>edge||random()>1-r*.65)continue;
   const x=cx+Math.cos(angle)*r*rx,y=cy+Math.sin(angle)*r*ry,dir=random()*6.28,length=(1.2+random()*2.8)*Math.max(.45,rx/30);
   ctx.strokeStyle=['#8c623b','#ac7c49','#705037','#b19362','#786f52'][Math.floor(random()*5)];ctx.globalAlpha=.4+random()*.35;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(dir)*length,y+Math.sin(dir)*length);ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 return {image,bounds};
}
