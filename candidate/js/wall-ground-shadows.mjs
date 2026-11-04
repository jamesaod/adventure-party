// Cached planar wall shadows in authored metres. No DOM, raster atlas,
// shadow renderer, unit geometry or simulation state is owned here.
export const WALL_SUN_SHARE=.55,MAX_WALL_SHADOW_HEIGHTS=6;
const cache=new WeakMap();let revision=0;
const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function convexShadowHull(points){
 const sorted=[...new Map(points.map(p=>[p.x.toFixed(8)+','+p.z.toFixed(8),p])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);
 if(sorted.length<3)return [];
 const half=items=>{const result=[];for(const p of items){while(result.length>=2&&cross(result.at(-2),result.at(-1),p)<=1e-10)result.pop();result.push(p);}return result;};
 const lower=half(sorted),upper=half([...sorted].reverse());return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
export function projectWallGroundPolygon(solid,terrain,style,sun,minimumHeight=0){
 if(sun.direction.y<=0)return [];
 const {x,y,z}=sun.direction,den=Math.max(y,Math.hypot(x,z)/MAX_WALL_SHADOW_HEIGHTS),cell=style.cellMetres;
 const points=[];
 const heightOf=p=>(p.elevation||0)/style.tacticalWallPixels*style.wallMetres;
 const project=(p,height)=>points.push({x:p.x/terrain.cellW*cell-x/den*height,z:p.y/terrain.cellH*cell-z/den*height});
 for(const face of solid.faces)for(let i=0;i<face.points.length;i++){
  const p=face.points[i],q=face.points[(i+1)%face.points.length],h=heightOf(p),next=heightOf(q);
  if(h>=minimumHeight)project(p,h);
  if((h<minimumHeight)!==(next<minimumHeight)){
   const t=(minimumHeight-h)/(next-h);
   project({x:p.x+t*(q.x-p.x),y:p.y+t*(q.y-p.y)},minimumHeight);
  }
 }
 return convexShadowHull(points);
}
function contains(p,polygon){for(let i=0;i<polygon.length;i++)if(cross(polygon[i],polygon[(i+1)%polygon.length],p)<-1e-8)return false;return true;}
export function cachedWallGroundShadows(terrain,style,sun,{geometryKey='',solids}={}){
 let entry=cache.get(terrain);
 if(!entry||entry.geometryKey!==geometryKey){entry={geometryKey,solids:null,geometryBuilds:(entry?.geometryBuilds||0),projectionBuilds:(entry?.projectionBuilds||0)};cache.set(terrain,entry);}
 const key=[sun.hour,sun.direction.x,sun.direction.y,sun.direction.z].join(':');if(entry.key===key)return entry.field;
 const polygons=[],buckets=new Map(),size=style.cellMetres,above=sun.direction.y>1e-5;
 if(above){
  if(!entry.solids){entry.solids=solids();entry.geometryBuilds++;}
  for(const solid of entry.solids){const polygon=projectWallGroundPolygon(solid,terrain,style,sun);if(polygon.length<3)continue;const bounds={left:Math.min(...polygon.map(p=>p.x)),right:Math.max(...polygon.map(p=>p.x)),top:Math.min(...polygon.map(p=>p.z)),bottom:Math.max(...polygon.map(p=>p.z))},index=polygons.push({polygon,bounds,solid,heightSlices:new Map()})-1;
   for(let z=Math.floor(bounds.top/size);z<=Math.floor(bounds.bottom/size);z++)for(let x=Math.floor(bounds.left/size);x<=Math.floor(bounds.right/size);x++){const k=x+','+z;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(index);}
  }
 }
 entry.projectionBuilds++;const opacity=above?Math.min(1,sun.direction.y/Math.sin(Math.PI/18)):0;
 const field={revision:++revision,polygons,stats:{hour:sun.hour,polygons:polygons.length,geometryBuilds:entry.geometryBuilds,projectionBuilds:entry.projectionBuilds},occlusion(point,height=0){
  if(!opacity)return 0;
  height=Math.round(height*1000)/1000;
  const {x,y,z}=sun.direction,den=Math.max(y,Math.hypot(x,z)/MAX_WALL_SHADOW_HEIGHTS);
  if(height>0)point={x:point.x-x/den*height,z:point.z-z/den*height};
  for(const index of buckets.get(Math.floor(point.x/size)+','+Math.floor(point.z/size))||[]){const {polygon,bounds,solid,heightSlices}=polygons[index];if(point.x<bounds.left||point.x>bounds.right||point.z<bounds.top||point.z>bounds.bottom)continue;if(!contains(point,polygon))continue;
   if(!height)return opacity;
   if(!heightSlices.has(height))heightSlices.set(height,projectWallGroundPolygon(solid,terrain,style,sun,height));
   const slice=heightSlices.get(height);
   if(slice.length>=3&&contains(point,slice))return opacity;}
  return 0; // Logical union: overlaps never stack darkness.
 }};
 entry.key=key;entry.field=field;return field;
}
export function wallSunRetention(occlusion,sun){return 1-WALL_SUN_SHARE*sun.daylight*Math.max(0,Math.min(1,occlusion));}
