// One owner of battlefield presentation. Producers request work; they never
// render independently. Simulation clocks and spell initiative are separate.
export function createCombatFrameScheduler({render,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,now=()=>performance.now(),visible=()=>!document.hidden,enabled=()=>true,onError=error=>console.error(error),fps=30,presentationActive=()=>false}={}){
 // Zero selects browser-refresh pacing without a software FPS cap.
 const interval=fps>0?1000/fps:0,ticks=new Map(),waiters=[];
 let frame=null,dirty=false,last=-Infinity,serial=0,disposed=false,rendering=false;
 let requests=0,renders=0,coalesced=0,totalMs=0,maxMs=0,first=null;
 const recent=[],presented=[];
 function ensure(){if(!disposed&&frame===null&&visible()&&(dirty||ticks.size||waiters.length||(enabled()&&presentationActive())))frame=requestFrame(tick);}
 function request(){if(disposed||!enabled())return false;requests++;if(dirty)coalesced++;dirty=true;ensure();return true;}
 function tick(timestamp){
  frame=null;if(disposed||!visible())return;
  // Preserve the 30 Hz phase across non-divisible display refresh rates. After
  // a real stall, reset the phase instead of rendering a backlog of frames.
  const elapsed=timestamp-last;
  const updateDue=elapsed>=interval-.5;
  const smooth=enabled()&&presentationActive();
  if(!updateDue&&!smooth){ensure();return;}
  if(updateDue){
  last=!Number.isFinite(last)||elapsed>interval*2?timestamp:last+interval;
  const callbacks=[...ticks.values()];ticks.clear();
  for(const callback of callbacks)try{callback(timestamp);}catch(error){onError(error);}
  }
  // Presentation-only frames never advance animation callbacks or frame waiters.
  const completed=updateDue?waiters.splice(0):[];let didRender=false,failure=null;
  if((dirty||smooth)&&enabled()){
   if(updateDue)dirty=false;rendering=true;const start=now();
   try{render(timestamp);didRender=true;renders++;if(first===null)first=start;if(presented.length&&start-presented.at(-1)>Math.max(interval*4,250))presented.length=0;presented.push(start);if(presented.length>60)presented.shift();}
   catch(error){failure=error;onError(error);}
   finally{rendering=false;const duration=Math.max(0,now()-start);totalMs+=duration;maxMs=Math.max(maxMs,duration);recent.push(duration);if(recent.length>60)recent.shift();}
  }else if(updateDue)dirty=false;
  for(const {resolve,reject} of completed)failure?reject(failure):resolve(didRender);
  ensure();
 }
 return {
  request,
  nextFrame(){return new Promise((resolve,reject)=>{if(!request()){resolve(false);return;}waiters.push({resolve,reject});});},
  requestTick(callback){if(disposed)return null;const id=++serial;ticks.set(id,callback);ensure();return id;},
  cancelTick(id){ticks.delete(id);},
  wake(){ensure();},
  get rendering(){return rendering;},
  diagnostics(){return {targetFps:fps,recentFps:presented.length>1?(presented.length-1)*1000/Math.max(1,presented.at(-1)-presented[0]):0,requests,renders,coalesced,elapsedMs:first===null?0:now()-first,meanRenderMs:renders?totalMs/renders:0,recentRenderMs:recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:0,maxRenderMs:maxMs};},
  dispose(){disposed=true;if(frame!==null)cancelFrame(frame);frame=null;ticks.clear();for(const w of waiters.splice(0))w.resolve(false);dirty=false;}
 };
}
