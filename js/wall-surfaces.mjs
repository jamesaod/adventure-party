import {quarterAt,quarterContains,quarterSides,quarterPoints,quarterFloor} from './quarter-walls.mjs?v=R238C266';
import {groundKind} from './exploration-ground.mjs?v=R238C263';
import {isOutdoor,ambientLightAt} from './exploration-environment.mjs?v=R238C262';
const materials=['stone','wood'];
export function wallFaceMaterial(record,side='end'){
 const base=materials.includes(record?.edgeMaterial)?record.edgeMaterial:materials.includes(record?.material)?record.material:'stone';
 return record?.faceMaterials?.[side]||base;
}
export {validateWallFaces} from './quarter-walls.mjs?v=R238C266';
export const wallFaceLabels=record=>record.corner?{a:'Inside face',b:'Outside face'}:record.axis==='h'?{a:'South face',b:'North face'}:{a:'West face',b:'East face'};
export function quarterOutsidePolygons(q){const center=quarterFloor(q)[0],corner={x:2*q.x-center.x,z:2*q.z-center.z},points=quarterPoints(q);return points.slice(1).map((b,i)=>[corner,points[i],b]);}
export function outsideSurface(map,q){
 const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]},cells=quarterSides(q).map(s=>({x:q.x+dirs[s][0],z:q.z+dirs[s][1]})).filter(p=>map.grid[p.z]?.[p.x]==='.');
 const cell=cells.find(p=>isOutdoor(map,p.x,p.z))||cells.find(p=>!quarterAt(map,p.x,p.z))||cells[0]||{x:q.x,z:q.z};
 return {cell,ground:q.outsideGround&&q.outsideGround!=='auto'?q.outsideGround:groundKind(map,cell.x,cell.z),environment:isOutdoor(map,cell.x,cell.z)?'outdoor':'indoor',ambient:ambientLightAt(map,cell.x,cell.z),outside:true};
}
export function surfaceAt(map,point){const cell={x:Math.floor(point.x+.5),z:Math.floor(point.z+.5)},q=quarterAt(map,cell.x,cell.z);return q&&!quarterContains(q,point)?outsideSurface(map,q):{cell,ground:groundKind(map,cell.x,cell.z),environment:isOutdoor(map,cell.x,cell.z)?'outdoor':'indoor',ambient:ambientLightAt(map,cell.x,cell.z),outside:false};}
