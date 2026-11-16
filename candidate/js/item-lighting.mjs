// Shared item emission contract. Item overrides and catalog profiles use the same units.
export const ITEM_LIGHT_PROFILES=Object.freeze({
 'flaming-sword-5':Object.freeze({radiusHexes:3,intensity:3.3,color:Object.freeze([255,153,45]),heightMetres:1.1,flicker:true,swayMetres:.035,daylightContrast:24})
});
export function itemLightProfile(item){
 const profile=item.lightSource??ITEM_LIGHT_PROFILES[item.catalogItemId||item.appearanceId];
 if(!profile||item.lightEnabled===false||item.lit===false||(!item.equipped&&item.lit!==true)||Number(item.qty??1)<=0)return null;
 if(!(profile.radiusHexes>0)||!(profile.intensity>0)||!Array.isArray(profile.color)||profile.color.length!==3||!profile.color.every(v=>Number.isFinite(v)&&v>=0&&v<=255))return null;
 return profile;
}
export function itemLightSources(unit,{now=0,daylight=0,indoor=false}={}){
 const motion=unit.walkPresentation,t=Math.max(0,Math.min(1,Number(motion?.t)||0));
 // Rule coordinates stay on the occupied hex. Only rendering follows the
 // exact interpolation used by the holder's walking presentation.
 const visualPosition=motion?{x:motion.from.x+(motion.to.x-motion.from.x)*t,y:motion.from.y+(motion.to.y-motion.from.y)*t}:null;
 return (unit.inventory||[]).flatMap((item,index)=>{
  const p=itemLightProfile(item);if(!p)return [];
  let seed=0;for(const letter of String(unit.id)+':'+index)seed=(seed*31+letter.charCodeAt(0))>>>0;
  const phase=seed%997,time=now*.001,flicker=p.flicker?(.82+.10*Math.sin(time*12+phase)+.05*Math.sin(time*27+phase*1.3)+.03*Math.sin(time*49+phase*.7)):1;
  const sway=Math.max(0,Math.min(.2,Number(p.swayMetres)||0));
  return [{id:'item-light:'+unit.id+':'+(item.instanceId||index),sourceKind:'unit',sourceName:item.name||'Item light',unitId:unit.id,x:unit.x,y:unit.y,visualPosition,radiusHexes:p.radiusHexes,intensity:p.intensity*flicker,color:[...p.color],heightMetres:Math.max(.05,Number(p.heightMetres)||1.1),
   visualScale:indoor?1:1/(1+Math.max(0,Number(p.daylightContrast??24))*Math.max(0,Math.min(1,daylight))**2),
   visualOffsetMetres:{x:sway*Math.sin(time*6.7+phase),z:sway*Math.sin(time*8.9+phase),y:sway*.57*Math.sin(time*11.3+phase)}}];
 });
}
globalThis.AdventurePartyItemLighting={profiles:ITEM_LIGHT_PROFILES,profile:itemLightProfile,sources:itemLightSources};
