// Polygon coordinates live in the unprojected ground plane, independent of hex edges.
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function validateShape(shape,textures){
 if(!shape||shape.boundary!=='hard'||!textures.has(shape.texture)||!Array.isArray(shape.points)||shape.points.length<3||shape.points.length>4096)throw Error('Hard shapes need a texture and 3–4096 corners.');
 const p=shape.points;if(p.some(v=>!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||Math.abs(v.x)>20000||Math.abs(v.y)>20000))throw Error('Invalid shape coordinates.');
 for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a.x-b.x,a.y-b.y)<.01)throw Error('Shape corners must be distinct.');for(let j=i+1;j<p.length;j++){if(j===i+1||(i===0&&j===p.length-1))continue;const c=p[j],d=p[(j+1)%p.length];if(Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-8&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-8&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)throw Error('Shape edges cannot cross or touch.');}}
 const area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0);if(Math.abs(area)<1)throw Error('Shape needs a nonzero area.');
 return {boundary:'hard',texture:shape.texture,points:p.map(({x,y})=>({x,y}))};
}
export function insideShape(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
// Clip a triangle to a convex hex, preserving true straight polygon boundaries.
export function clipToHex(subject,hex){let result=subject;for(let i=0;i<hex.length;i++){const a=hex[i],b=hex[(i+1)%hex.length],input=result;result=[];for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q);if(dp>=-1e-8)result.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}}return result;}
