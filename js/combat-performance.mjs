// CPU timings are submission costs, not GPU elapsed time. Opt-in keeps normal
// play free of timing samples; inexpensive counters remain available each frame.
export function createCombatPerformance({enabled=false,now=()=>performance.now()}={}){
 let frame=0,counts={},times={},history=[];
 return {get frame(){return frame;},enabled,
  begin(){frame++;counts={};times={};},
  count(name,amount=1){counts[name]=(counts[name]||0)+amount;},
  measure(name,fn){if(!this.enabled)return fn();const start=now();try{return fn();}finally{times[name]=(times[name]||0)+now()-start;}},
  end(){if(this.enabled){history.push({...times});if(history.length>120)history.shift();}},
  snapshot(){const average={};for(const row of history)for(const [key,value] of Object.entries(row))average[key]=(average[key]||0)+value/history.length;return {frame,counters:{...counts},cpuMs:{...times},averageCpuMs:average,samples:history.length};}
 };
}
export const combatPerformance=createCombatPerformance({enabled:typeof location!=='undefined'&&new URLSearchParams(location.search).has('combatProfile')});
globalThis.adventurePartyCombatPerformance=combatPerformance;
