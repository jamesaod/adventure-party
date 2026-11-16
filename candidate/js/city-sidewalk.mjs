import {groundKind} from './exploration-ground.mjs';
export const SIDEWALK_HEIGHT=.15;
export const isCityPaving=kind=>kind==='road2'||kind==='road'||kind==='sidewalk';
export function sidewalkSides(map,x,z){return [[0,-1,'n'],[1,0,'e'],[0,1,'s'],[-1,0,'w']].filter(([dx,dz])=>groundKind(map,x+dx,z+dz)!=='sidewalk'||!'.D'.includes(map.grid[z+dz]?.[x+dx]||'#')).map(v=>v[2]);}
export function sidewalkAlongWall(map,x,z){
 const h=(map.edges||[]).some(e=>e.axis==='h'&&e.x===x&&(e.z===z||e.z===z+1)&&e.kind!=='none');
 const v=(map.edges||[]).some(e=>e.axis==='v'&&e.z===z&&(e.x===x||e.x===x+1)&&e.kind!=='none');
 if(h!==v)return h?'h':'v';
 return map.grid[z]?.[x-1]==='#'||map.grid[z]?.[x+1]==='#'?'v':'h';
}
// Slabs stay on an authored lattice; exposed edges receive a continuous curb course.
export function sidewalkStones(map,x,z){
 const sides=sidewalkSides(map,x,z),vertical=sidewalkAlongWall(map,x,z)==='v',rim=.075;
 const loX=sides.includes('w')?rim:0,hiX=sides.includes('e')?1-rim:1,loZ=sides.includes('n')?rim:0,hiZ=sides.includes('s')?1-rim:1,out=[];
 const add=(a,b,w,h,id)=>out.push({col:x*1000+id,row:z*1000,x:a+.002/2,z:b+.002/2,w:w-.004/2,h:h-.004/2,chip:.0045,reliefScale:1/2,tone:((x*17+z*31+id*13)%97+97)%97/97,crack:id%7===0});
 const nx=vertical?8:6,nz=vertical?6:8;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)add(loX+i*(hiX-loX)/nx,loZ+j*(hiZ-loZ)/nz,(hiX-loX)/nx,(hiZ-loZ)/nz,j*nx+i);
 for(const side of sides)for(let row=0;row<2;row++)for(let i=0;i<8;i++){
  const id=200+['n','e','s','w'].indexOf(side)*16+row*8+i;
  if(side==='n'||side==='s')add(i/8,(side==='n'?0:1-rim)+row*rim/2,1/8,rim/2,id);
  else add((side==='w'?0:1-rim)+row*rim/2,loZ+i*(hiZ-loZ)/8,rim/2,(hiZ-loZ)/8,id);
 }
 return out;
}
