export function solidPrism(a,b,depth,height,bottom=0,squash=1,material='wall',joins={}){
 const dx=b.x-a.x,dz=(b.y-a.y)/squash,length=Math.hypot(dx,dz)||1,nx=-dz/length,nz=dx/length;
 const p=[{x:a.x+nx*depth/2,y:a.y+nz*depth/2*squash},{x:b.x+nx*depth/2,y:b.y+nz*depth/2*squash},{x:b.x-nx*depth/2,y:b.y-nz*depth/2*squash},{x:a.x-nx*depth/2,y:a.y-nz*depth/2*squash}];
 if(joins.start){p[0]={x:a.x+joins.start.x,y:a.y+joins.start.z*squash};p[3]={x:a.x-joins.start.x,y:a.y-joins.start.z*squash};}if(joins.end){p[1]={x:b.x+joins.end.x,y:b.y+joins.end.z*squash};p[2]={x:b.x-joins.end.x,y:b.y-joins.end.z*squash};}
 const at=(p,h)=>({...p,elevation:h});
 const faces=p.map((q,i)=>{const t=p[(i+1)%4];return {material,side:i===0?'a':i===2?'b':'end',cap:false,points:[at(q,bottom),at(t,bottom),at(t,height),at(q,height)],normal:{x:i===0?nx:i===2?-nx:i===1?dx/length:-dx/length,y:0,z:i===0?nz:i===2?-nz:i===1?dz/length:-dz/length}};});
 faces.push({material,side:'top',cap:true,points:p.map(q=>at(q,height)),normal:{x:0,y:1,z:0},...(material==='door'?{woodBasis:{a,b,depth,height,squash}}:{})});
 if(joins.hideStart)faces.splice(faces.findIndex(f=>f.side==='end'&&f.points[0].x===p[3].x&&f.points[0].y===p[3].y),1);if(joins.hideEnd){const i=faces.findIndex(f=>f.side==='end');if(i>=0)faces.splice(i,1);}
 return {a,b,depth,height,bottom,faces};
}
export function combatDoorSolids(door,terrain,style){
 const squash=terrain.cellH/terrain.cellW,width=door.edgeId?(door.axis==='x'?terrain.cellH:terrain.cellW)*door.width:terrain.cellW/style.tacticalHexesPerCell*.75*(door.axis==='x'?squash:1);
 const sign=door.hinge==='end'?-1:1,closed=door.axis==='x'?{x:0,y:width}:{x:width,y:0};
 const hinge={x:door.center.x-sign*closed.x/2,y:door.center.y-sign*closed.y/2};
 let vx=sign*closed.x,vy=sign*closed.y;
 if(door.open){const angle=-sign*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),x=vx;vx=x*c-vy/squash*s;vy=x*s*squash+vy*c;}
 const end={x:hinge.x+vx,y:hinge.y+vy},depth=style.tacticalWallThickness,height=style.door.height/style.wallMetres*style.tacticalWallPixels;
 const left={x:door.center.x-closed.x/2,y:door.center.y-closed.y/2},right={x:door.center.x+closed.x/2,y:door.center.y+closed.y/2};
 const leaf=solidPrism(hinge,end,depth,height,0,squash,'door');
 return {hinge,end,leaf,lintel:solidPrism(left,right,style.tacticalWallThickness,style.tacticalWallPixels,height,squash,'wall')};
}

// Continue the leaf's wood across its top instead of painting a flat cap color.
export function doorCapUv(face,p){
 const {a,b,depth,height,squash}=face.woodBasis,dx=b.x-a.x,dz=(b.y-a.y)/squash,length=Math.hypot(dx,dz);
 const x=p.x-a.x,z=(p.y-a.y)/squash;
 const along=(x*dx+z*dz)/(length*length),across=(-x*dz+z*dx)/length+depth/2;
 return [along,1-across/Math.max(height,depth)];
}
