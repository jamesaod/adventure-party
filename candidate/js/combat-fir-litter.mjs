// Stable per-tree litter outline, round in physical ground coordinates.
export function litterProfile(tree){
 let seed=(Math.imul(Math.round(tree.x*1024),73856093)^Math.imul(Math.round(tree.y*1024),19349663)^129731)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return {phase:[random(),random(),random()].map(v=>v*Math.PI*2),amplitude:[.07+random()*.05,.035+random()*.035,.015+random()*.02],random};
}
export function litterEdge(angle,profile){return 1+profile.amplitude.reduce((sum,a,i)=>sum+a*Math.sin(angle*[3,5,8][i]+profile.phase[i]),0);}
export function createFirLitter(trees,bounds,radius,squash=1){
 const image=document.createElement('canvas');image.width=image.height=1024;
 const ctx=image.getContext('2d'),[left,top,width,height]=bounds,sx=1024/width,sy=1024/height;
 const pixels=ctx.createImageData(1024,1024),data=pixels.data,patches=[];
 for(const tree of trees){
  const reach=tree.radius>0?tree.radius:radius*(tree.sizeScale??1);if(!(reach>0))continue;
  const cx=(tree.x-left)*sx,cy=(tree.y-top)*sy,rx=reach*sx,ry=reach*squash*sy,profile=litterProfile(tree);
  patches.push({cx,cy,rx,ry,profile});
  const x0=Math.max(0,Math.floor(cx-rx*1.23)),x1=Math.min(1023,Math.ceil(cx+rx*1.23));
  const y0=Math.max(0,Math.floor(cy-ry*1.23)),y1=Math.min(1023,Math.ceil(cy+ry*1.23));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const dx=(x+.5-cx)/rx,dy=(y+.5-cy)/ry,r=Math.hypot(dx,dy)/litterEdge(Math.atan2(dy,dx),profile);if(r>=1)continue;
   const alpha=.65*(1-r*r*(3-2*r)),i=(y*1024+x)*4,old=data[i+3]/255,combined=alpha+old*(1-alpha);
   const color=[91+21*r,61+13*r,34+5*r];
   for(let c=0;c<3;c++)data[i+c]=(color[c]*alpha+data[i+c]*old*(1-alpha))/combined;
   data[i+3]=combined*255;
  }
 }
 ctx.putImageData(pixels,0,0);
 for(const {cx,cy,rx,ry,profile} of patches){const random=profile.random;
  for(let i=0;i<950;i++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random())*1.23,edge=litterEdge(angle,profile);
   if(r>edge||random()>1-r/edge*.65)continue;
   const x=cx+Math.cos(angle)*r*rx,y=cy+Math.sin(angle)*r*ry,dir=random()*Math.PI*2,length=(1.2+random()*2.8)*Math.max(.45,rx/30);
   ctx.strokeStyle=['#8c623b','#ac7c49','#705037','#b19362','#786f52'][Math.floor(random()*5)];ctx.globalAlpha=(.4+random()*.35)*Math.min(1,(1-r/edge)*8);ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(dir)*length,y+Math.sin(dir)*length*ry/rx);ctx.stroke();
  }
 }
 ctx.globalAlpha=1;return {image,bounds};
}
