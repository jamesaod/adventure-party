import {TREE_COLLISION_DATA} from './tree-collision-data.mjs';
import {BROADLEAF_FAMILIES,broadleafForVariant} from './broadleaf-family.mjs?v=sweet-birch1';
const continuousPoses=new Map(),STEP=Math.PI/12;
export function treeCollision(base,season,angle=0){
 const family=broadleafForVariant(base),id=Object.keys(BROADLEAF_FAMILIES).find(id=>BROADLEAF_FAMILIES[id]===family);
 if(!id)throw new RangeError('Unknown tree collision asset '+base);
 const resolvedSeason=season==='spring'?'summer':season,asset=TREE_COLLISION_DATA[id][resolvedSeason];if(!asset)throw new RangeError('Unknown tree season '+season);
 if(!Number.isFinite(angle))throw new RangeError('Invalid tree collision orientation '+angle);
 const pose=((angle/STEP)%24+24)%24,nearest=Math.round(pose);
 if(Math.abs(pose-nearest)*STEP<1e-5)return {canopyRadius:asset.canopyRadius,capsules:asset.poses[nearest%24]};
 const low=Math.floor(pose),high=(low+1)%24,t=pose-low,key=id+':'+resolvedSeason+':'+pose;
 if(continuousPoses.has(key))return continuousPoses.get(key);
 const next=new Map(asset.poses[high].map(c=>[c.piece,c]));
 // Baked capsules can reverse endpoint order between orientations. Match by
 // piece and align endpoints before blending. Expand to contain both adjacent
 // baked capsules rather than shrinking the navigation safety envelope.
 const capsules=asset.poses[low].map(a=>{const b=next.get(a.piece);if(!b)return {...a};next.delete(a.piece);
  const direct=Math.hypot(a.ax-b.ax,a.az-b.az)+Math.hypot(a.bx-b.bx,a.bz-b.bz),reverse=Math.hypot(a.ax-b.bx,a.az-b.bz)+Math.hypot(a.bx-b.ax,a.bz-b.az);
  const q=reverse<direct?{ax:b.bx,az:b.bz,bx:b.ax,bz:b.az}:b;
  const c={piece:a.piece};for(const k of ['ax','az','bx','bz'])c[k]=a[k]+(q[k]-a[k])*t;
  c.radius=Math.max(a.radius+Math.max(Math.hypot(c.ax-a.ax,c.az-a.az),Math.hypot(c.bx-a.bx,c.bz-a.bz)),b.radius+Math.max(Math.hypot(c.ax-q.ax,c.az-q.az),Math.hypot(c.bx-q.bx,c.bz-q.bz)));return c;
 });for(const b of next.values())capsules.push({...b});
 const result={canopyRadius:asset.canopyRadius,capsules};if(continuousPoses.size>=512)continuousPoses.delete(continuousPoses.keys().next().value);continuousPoses.set(key,result);return result;
}
