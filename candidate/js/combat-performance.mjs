// CPU timings are submission costs, not GPU elapsed time. The diagnostic chart
// enables sampling; counters remain available when timing is disabled.
export function createCombatPerformance({enabled=false,now=()=>performance.now()}={}){
 let frame=0,counts={},times={},history=[],started=0,previous=null;
 return {get frame(){return frame;},enabled,
  begin(){const t=now();frame++;counts={};times={};if(previous!==null)times.frameInterval=t-previous;previous=t;started=t;},
  count(name,amount=1){counts[name]=(counts[name]||0)+amount;},
  measure(name,fn){if(!this.enabled)return fn();const start=now();try{return fn();}finally{times[name]=(times[name]||0)+now()-start;}},
  end(){if(this.enabled){times.frameSubmission=now()-started;history.push({...times});if(history.length>120)history.shift();}},
  snapshot(){const average={};for(const row of history)for(const [key,value] of Object.entries(row))average[key]=(average[key]||0)+value/history.length;return {frame,counters:{...counts},cpuMs:{...times},averageCpuMs:average,samples:history.length};}
 };
}
export const combatPerformance=createCombatPerformance({enabled:true});
globalThis.adventurePartyCombatPerformance=combatPerformance;

// Diagnostic overlay uses rolling CPU averages; renderer calls enqueue GPU work.
export function drawCombatPerformanceChart(ctx,width){
 const report=combatPerformance.snapshot(),t=report.averageCpuMs;
 const rows=[['Frame submission','frameSubmission','#ffffff'],['Corpse bake','corpseBake','#dd8877'],['Trees','treeSubmission','#71ce75'],['Models','unitSubmission','#70b6ff'],['Terrain total','terrain','#d6b477'],['Buffer prep','surfaceBuffers','#ddcf88'],['Shadows setup','shadowSetup','#bb91ef'],['Shadows draw','shadowDraw','#9872cb'],['Pose sampling','workshopPoseSampling','#50d8cb'],['Snow','snow','#c3e8ff'],['Canvas copy','backdropCopy','#ee9277']];
 const max=Math.max(1,...rows.map(r=>t[r[1]]||0)),w=292,h=rows.length*20+55,x=Math.max(8,width-w-12),y=12;
 ctx.save();ctx.globalAlpha=1;ctx.fillStyle='rgba(8,12,20,.88)';ctx.fillRect(x,y,w,h);ctx.font='12px monospace';ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText('CPU FRAME COST — rolling average',x+10,y+8);
 rows.forEach(([label,key,color],i)=>{const ms=t[key]||0,yy=y+31+i*20;ctx.fillStyle=color;ctx.fillText(label,x+10,yy);ctx.fillStyle='#25303a';ctx.fillRect(x+128,yy+2,98,10);ctx.fillStyle=color;ctx.fillRect(x+128,yy+2,98*ms/max,10);ctx.fillStyle='#eee';ctx.fillText(ms.toFixed(2)+' ms',x+232,yy);});
 ctx.fillStyle='#aab6c4';ctx.font='10px monospace';ctx.fillText('CPU only · nested costs overlap · GPU chart below',x+8,y+h-17);ctx.restore();
 const gpu=globalThis.adventurePartyGpuPerformance?.snapshot();
 if(!gpu)return;
 const names=['Floor','Walls / curbs','Ground shadows','Fir contact','Other surfaces','Trees','Models','Shadows','Outlines','Composite','Snow'],yy=y+h+8,gh=names.length*18+105;
 ctx.save();ctx.fillStyle='rgba(8,12,20,.88)';ctx.fillRect(x,yy,w,gh);ctx.font='12px monospace';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillText('GPU PASS COST — sampled average',x+10,yy+8);
 if(!gpu.supported||!gpu.samples){ctx.fillText(gpu.supported?'Waiting for GPU samples…':'GPU timing unavailable on this device',x+10,yy+32);}
 else {const max=Math.max(.1,...Object.values(gpu.times));names.forEach((name,i)=>{const ms=gpu.times[name]||0,y0=yy+30+i*18;ctx.fillStyle=rows[i%rows.length][2];ctx.fillText(name,x+10,y0);ctx.fillRect(x+128,y0+2,98*ms/max,9);ctx.fillStyle='#eee';ctx.fillText(ms.toFixed(2)+' ms',x+232,y0);});}
 ctx.font='10px monospace';ctx.fillStyle='#aab6c4';
 const counts=report.counters;['Floor','Walls / curbs','Fir contact'].forEach((name,i)=>ctx.fillText(name+': '+(counts['triangles:'+name]||0)+' tris / '+(counts['draws:'+name]||0)+' draws',x+8,yy+gh-66+i*15));
 ctx.fillText('Async · every 15th frame · draw passes only',x+8,yy+gh-15);ctx.restore();
}
globalThis.drawCombatPerformanceChart=drawCombatPerformanceChart;
