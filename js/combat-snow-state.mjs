// Area-weighted sampling avoids favoring small floor fragments or fan triangles.
export function snowTriangles(faces){
 const triangles=[];let area=0;
 for(const face of faces)for(let i=1;i<face.points.length-1;i++){
  const a=face.points[0],b=face.points[i],c=face.points[i+1];
  const size=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
  if(size>1e-8){area+=size;triangles.push({a,b,c,end:area});}
 }
 return {triangles,area};
}
export function sampleSnowGround(region,random=Math.random){
 if(!region?.area)return null;
 const pick=random()*region.area;let lo=0,hi=region.triangles.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(pick<region.triangles[mid].end)hi=mid;else lo=mid+1;}
 const {a,b,c}=region.triangles[lo];let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}
 return {x:a.x+u*(b.x-a.x)+v*(c.x-a.x),y:a.y+u*(b.y-a.y)+v*(c.y-a.y)};
}
export function createHexSnow(){
 const hexes=new Map();let regions=[],total=0;
 return {hexes,
 update(faces){const grouped=new Map();for(const f of faces){if(!f.snowEligible||!f.snowHex)continue;const key=f.snowHex;let group=grouped.get(key);if(!group)grouped.set(key,group=[]);group.push(f);}
 regions=[];total=0;for(const [key,group] of grouped){const region=snowTriangles(group);if(!region.area)continue;const old=hexes.get(key);const cell={...region,amount:old?.amount||0,key};hexes.set(key,cell);total+=region.area;regions.push({cell,end:total});}},
 spawn(random=Math.random){if(!total)return null;const pick=random()*total;const {cell}=regions.find(r=>pick<r.end)||regions.at(-1);return {...sampleSnowGround(cell,random),hex:cell.key};},
 land(key,random=Math.random){const cell=hexes.get(key);if(!cell)return [];cell.amount=Math.min(1,cell.amount+1/cell.area);return Array.from({length:4},()=>sampleSnowGround(cell,random));},
 accumulate(seconds,rate){const delta=Math.max(0,seconds)*Math.max(0,rate);for(const cell of hexes.values())cell.amount=Math.min(1,cell.amount+delta);},
 melt(key,fraction=1){const cell=hexes.get(key);if(!cell)return null;cell.amount*=1-Math.max(0,Math.min(1,fraction));return cell;},
 clear(){hexes.clear();regions=[];total=0;}
 };
}
