// Combat presentation only: static basin shape, bounded 4 Hz soil/water state.
export const BASIN_MAX_METRES=.1524;
export function basinDepth(wear){const t=Math.max(0,Math.min(1,(wear-.35)/.65));return BASIN_MAX_METRES*t*t*(3-2*t);}
export function basinWaterDepth(depth,water){return Math.max(0,Math.min(depth,water-BASIN_MAX_METRES+depth));}
export class CombatWetBasins {
 constructor(){this.reset();}
 reset(){this.wet=0;this.water=0;this.credit=0;this.last=null;this.identity=null;}
 scene(id){if(id!==this.identity){this.reset();this.identity=id;}}
 get active(){return this.wet>0||this.water>0;}
 step(dt,{type='clear',intensity=0}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  // Rates are accelerated presentation seconds, not a hydrological prediction.
  const rain=type==='rain'?Math.max(0,Math.min(1,Number(intensity)||0)):0;
  this.wet=Math.max(0,Math.min(1,this.wet+dt*(rain*.035-(this.water>0?0:.003))));
  const infiltration=.00018+.001*(1-this.wet),evaporation=rain?0:.0008;
  this.water=Math.max(0,Math.min(BASIN_MAX_METRES,this.water+dt*(.0018*rain**3*this.wet**3-infiltration-evaporation)));
 }
 update(now,weather,hidden=false){
  if(hidden){this.last=null;return;}
  const dt=this.last===null?0:Math.max(0,Math.min(.5,(now-this.last)/1000));this.last=now;this.credit+=dt;
  if(this.credit>=.25){const elapsed=this.credit;this.credit=0;this.step(elapsed,weather);}
 }
 snapshot(){return {wetness:this.wet,waterMetres:this.water,active:this.active};}
}
