// CPU timings are submission costs, not GPU elapsed time. The diagnostic chart
// enables sampling; counters remain available when timing is disabled.
export function createCombatPerformance({enabled=false,now=()=>performance.now()}={}){
 let frame=0,counts={},times={},history=[],started=0,previous=null,depth=0,covered=0;
 return {get frame(){return frame;},get elapsedMs(){return now()-started;},enabled,
  begin(){const t=now();frame++;counts={};times={};covered=0;depth=0;if(previous!==null)times.frameInterval=t-previous;previous=t;started=t;},
  count(name,amount=1){counts[name]=(counts[name]||0)+amount;},
  start(name){if(!this.enabled)return ()=>{};const start=now();depth++;let ended=false;return ()=>{if(ended)return;ended=true;const elapsed=now()-start;times[name]=(times[name]||0)+elapsed;if(--depth===0)covered+=elapsed;};},
  measure(name,fn){if(!this.enabled)return fn();const start=now();depth++;try{return fn();}finally{const elapsed=now()-start;times[name]=(times[name]||0)+elapsed;if(--depth===0)covered+=elapsed;}},
  end(){if(this.enabled){times.frameSubmission=now()-started;times.unattributed=Math.max(0,times.frameSubmission-covered);history.push({...times});if(history.length>120)history.shift();}},
  snapshot(){const average={};for(const row of history)for(const [key,value] of Object.entries(row))average[key]=(average[key]||0)+value/history.length;const intervals=history.map(r=>r.frameInterval).filter(Number.isFinite).sort((a,b)=>a-b),percentile=p=>intervals.length?intervals[Math.min(intervals.length-1,Math.floor((intervals.length-1)*p))]:0;const worst=history.reduce((best,r)=>!best||r.frameSubmission>best.frameSubmission?r:best,null);return {frame,counters:{...counts},cpuMs:{...times},averageCpuMs:average,samples:history.length,framePacing:{median:percentile(.5),p95:percentile(.95),max:percentile(1)},slowestFrame:worst?{...worst}:null};}
 };
}
export const combatPerformance=createCombatPerformance({enabled:true});
globalThis.adventurePartyCombatPerformance=combatPerformance;

// Diagnostic overlay uses rolling CPU averages; renderer calls enqueue GPU work.
let chartSample=null,chartSampleAt=-Infinity;
export function drawCombatPerformanceChart(ctx,width){
 const now=performance.now();if(!chartSample||now-chartSampleAt>=200){chartSample={cpu:combatPerformance.snapshot(),gpu:globalThis.adventurePartyGpuPerformance?.snapshot()};chartSampleAt=now;}
 const report=chartSample.cpu,t=report.averageCpuMs;
 const rows=[['Frame submission','frameSubmission','#ffffff'],['Corpse bake','corpseBake','#dd8877'],['Trees total','treePipeline','#71ce75'],['Tree passes','treeTotal','#71ce75'],['Leaf passes','particleTotal','#b6ce75'],['Wood masks','woodMasks','#b49a75'],['Composite','composite','#87cddd'],['Surface draws','surfaceDraw','#aaccbb'],['Unit outlines','hiddenOutlines','#66aaff'],['Unattributed','unattributed','#ff9977'],['Models total','modelTotal','#70b6ff'],['Ground cover','groundCover','#8ab269'],['Terrain total','terrain','#d6b477'],['Terrain ahead','terrainAhead','#b7c68c'],['Buffer prep','surfaceBuffers','#ddcf88'],['Shadows setup','shadowSetup','#bb91ef'],['Shadows draw','shadowDraw','#9872cb'],['Pose sampling','workshopPoseSampling','#50d8cb'],['Snow','snow','#c3e8ff'],['Canvas copy','backdropCopy','#ee9277'],['Volumetric fog','volumetricFog','#afc8d8']];
 const extra=[['Cover: validate','coverValidation'],['Cover: layout','coverLayout'],['Cover: placement','coverPlacement'],['Cover: sorting','coverSorting'],['Cover: packing','coverPacking'],['Cover: uniforms','coverUniforms'],['Cover: drawing','coverDraw'],['Cover: inputs','coverInputs'],['Cover: queued','coverFlush'],['Cover: submit','coverSubmit'],['Cover: debris','coverDebris'],['Frame setup','frameSetup'],['Lighting setup','lightingSetup'],['Scene queue','sceneQueue'],['Unit shadows','unitShadows'],['Actor ordering','actorOrdering'],['Actor dispatch','actorDispatch'],['Water effects','waterEffects'],['Foreground FX','foregroundFx'],['LOS overlays','visibilityOverlays'],['Weather','weatherVfx'],['HUD / labels','hudLabels'],['Diagnostics','diagnostics'],['GPU setup','gpuSetup']];
 for(const [label,key]of extra)rows.push([label,key,key.startsWith('cover')?'#a3c779':'#c0a7d9']);
 const detail=globalThis.adventurePartyPerformanceDetail||'all';if(detail==='cover')for(let i=rows.length-1;i>=0;i--)if(!rows[i][1].startsWith('cover')&&!['groundCover','frameSubmission','unattributed','modelTotal'].includes(rows[i][1]))rows.splice(i,1);
 rows.sort((a,b)=>(t[b[1]]||0)-(t[a[1]]||0));rows.length=Math.min(rows.length,18);
 const max=Math.max(1,...rows.map(r=>t[r[1]]||0)),w=292,h=rows.length*17+55,x=Math.max(8,width-w-12),y=12;
 ctx.save();ctx.globalAlpha=1;ctx.fillStyle='rgba(8,12,20,.88)';ctx.fillRect(x,y,w,h);ctx.font='12px monospace';ctx.textBaseline='top';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText('CPU FRAME COST — rolling average',x+10,y+8);
 rows.forEach(([label,key,color],i)=>{const ms=t[key]||0,yy=y+31+i*17;ctx.fillStyle=color;ctx.fillText(label,x+10,yy);ctx.fillStyle='#25303a';ctx.fillRect(x+128,yy+2,98,10);ctx.fillStyle=color;ctx.fillRect(x+128,yy+2,98*ms/max,10);ctx.fillStyle='#eee';ctx.fillText(ms.toFixed(2)+' ms',x+232,yy);});
 ctx.fillStyle='#aab6c4';ctx.font='10px monospace';ctx.fillText('CPU nested costs overlap; full data in profile',x+8,y+h-17);
 const pace=report.framePacing;if(pace)ctx.fillText('Frames ms: '+pace.median.toFixed(1)+' / '+pace.p95.toFixed(1)+' / '+pace.max.toFixed(1)+' (50/95/max)',x+8,y+h+2);ctx.restore();
 const gpu=chartSample.gpu;
 if(!gpu)return;
 if(gpu.times){const cover=Object.entries(gpu.times).filter(([k])=>k.startsWith('Cover: '));if(cover.length)gpu.times['Ground cover']=cover.reduce((n,[,v])=>n+v,0);}
 const names=[...new Set(['Floor','Walls / curbs','Ground shadows','Fir contact','Ground cover','Other surfaces','Trees','Wood outline mask','Models','Shadows','Outlines','Composite','Snow','Volumetric fog',...Object.keys(gpu.times||{})])].sort((a,b)=>(gpu.times?.[b]||0)-(gpu.times?.[a]||0)).slice(0,18),yy=12,gx=Math.max(8,x-w-8),gh=names.length*18+105;
 ctx.save();ctx.translate(gx-x,0);
 ctx.save();ctx.fillStyle='rgba(8,12,20,.88)';ctx.fillRect(x,yy,w,gh);ctx.font='12px monospace';ctx.textBaseline='top';ctx.fillStyle='#fff';ctx.fillText('GPU PASS COST — sampled average',x+10,yy+8);
 if(!gpu.supported||!gpu.samples){ctx.fillText(gpu.supported?'Waiting for GPU samples…':'GPU timing unavailable on this device',x+10,yy+32);}
 else {const max=Math.max(.1,...Object.values(gpu.times));names.forEach((name,i)=>{const ms=gpu.times[name]||0,y0=yy+30+i*18;ctx.fillStyle=rows[i%rows.length][2];ctx.fillText(name,x+10,y0);ctx.fillRect(x+128,y0+2,98*ms/max,9);ctx.fillStyle='#eee';ctx.fillText(ms.toFixed(2)+' ms',x+232,y0);});}
 ctx.font='10px monospace';ctx.fillStyle='#aab6c4';
 const counts=report.counters;['Floor','Walls / curbs','Fir contact'].forEach((name,i)=>ctx.fillText(name+': '+(counts['triangles:'+name]||0)+' tris / '+(counts['draws:'+name]||0)+' draws',x+8,yy+gh-66+i*15));
 ctx.fillText('Async · every 15th frame · draw passes only',x+8,yy+gh-15);ctx.restore();ctx.restore();
}
globalThis.drawCombatPerformanceChart=drawCombatPerformanceChart;
