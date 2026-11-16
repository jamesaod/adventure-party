import {traceStream} from './combat-stream-field.mjs?v=R238C455';
export const STREAM_ROCK_LIMIT=96;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// The same static stones define visible geometry, flow deflection and foam.
// Geometry and the flow atlas are regenerated only when the channel changes.
export function buildStreamDetails(field){
 const {size,span,data}=field,flow=new Float32Array(data.length),rocks=[];
 if(!field.settings.enabled)return {flow,rocks};
 const trace=traceStream(field.path),width=field.settings.width;
 const segmentAt=along=>{let lo=0,hi=trace.length-2;while(lo<hi){const mid=(lo+hi+1)>>1;if(trace[mid].distance<=along)lo=mid;else hi=mid-1;}return lo;};
 const tangent=i=>{const a=trace[i],b=trace[i+1],len=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:(b.x-a.x)/len,y:(b.y-a.y)/len};};
 for(let along=2,cluster=0;along<trace.at(-1).distance-2&&rocks.length<STREAM_ROCK_LIMIT;along+=3.5+hash(cluster+77)*3,cluster++){
  const i=segmentAt(along),a=trace[i],dir=tangent(i),side=hash(cluster+19)<.5?-1:1;
  for(let j=0;j<2+Math.floor(hash(cluster+31)*3)&&rocks.length<STREAM_ROCK_LIMIT;j++){
   const seed=cluster*17+j,offset=side*width*(.22+hash(seed+53)*.22)+(j===0&&cluster%4===0?-side*width*.25:0),forward=along-a.distance+(hash(seed+12)-.5)*1.5;
   const x=a.x+dir.x*forward-dir.y*offset,y=a.y+dir.y*forward+dir.x*offset,radius=.18+hash(seed+7)**1.5*.42,sample=field.sample(x,y);
   if(sample.depth<.015||radius*1.25<sample.water+.035)continue;
   if(rocks.some(r=>Math.hypot(r.x-x,r.y-y)<(r.radius+radius)*.8))continue;
   const waterRadius=radius*Math.sqrt(Math.max(.05,1-((sample.water/radius-.6)/.65)**2));
   rocks.push({x,y,radius,waterRadius,depth:sample.depth,water:sample.water,seed:hash(seed+81),direction:dir,id:'stream-rock-'+seed});
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const o=(y*size+x)*4,water=data[o+1];if(water<=.001)continue;
  const dir=tangent(segmentAt(data[o+2])),speed=.35+.65*clamp(water/.28);
  flow[o]=dir.x*speed;flow[o+1]=dir.y*speed;
  // A few shallow riffles, separated by calmer reaches.
  flow[o+2]=.16*Math.pow(Math.max(0,Math.sin(data[o+2]*.63)),8)*(1-clamp(water/.3));
 }
 const index=v=>Math.max(0,Math.min(size-1,Math.floor((v/span+.5)*size)));
 for(const rock of rocks){const radius=rock.waterRadius,reach=Math.max(.6,radius*4);
  for(let y=index(rock.y-reach);y<=index(rock.y+reach);y++)for(let x=index(rock.x-reach);x<=index(rock.x+reach);x++){
   const o=(y*size+x)*4;if(data[o+1]<=.001)continue;
   const dx=((x+.5)/size-.5)*span-rock.x,dy=((y+.5)/size-.5)*span-rock.y,d=Math.hypot(dx,dy),nx=dx/Math.max(.001,d),ny=dy/Math.max(.001,d),strength=Math.min(.9,radius*radius/Math.max(radius*radius,d*d)),dot=rock.direction.x*nx+rock.direction.y*ny;
   flow[o]-=strength*(2*dot*nx-rock.direction.x);flow[o+1]-=strength*(2*dot*ny-rock.direction.y);
   const downstream=dx*rock.direction.x+dy*rock.direction.y,across=Math.abs(dx*rock.direction.y-dy*rock.direction.x);
   const wake=clamp(downstream/.12)*clamp(1-downstream/reach)*clamp(1-across/(radius*.8+.12));
   const collar=clamp(1-Math.abs(d-radius*1.2)/Math.max(.12,radius*.55));
   flow[o+2]=Math.max(flow[o+2],wake*.6,collar*.4);
   flow[o+3]=Math.max(flow[o+3],clamp(1-d/(radius*1.2))*.65);
  }
 }
 for(let o=0;o<flow.length;o+=4){const length=Math.hypot(flow[o],flow[o+1]);if(length>1.6){flow[o]*=1.6/length;flow[o+1]*=1.6/length;}}
 return {flow,rocks};
}
