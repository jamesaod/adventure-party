import {validateSettings,rgb} from './terrain-lab-preset.mjs?v=foliage-restored1';
import {setTreeAntialiasing} from './combat-tree-antialiasing.mjs?v=R238C449';
export async function openTerrainLab(){
 if(new URLSearchParams(location.search).get('terrainLab')!=='1')throw Error('Not a terrain lab scene');
 await showCombat('grass');
 if(!combatGpu||!game)throw Error('Combat scene failed to initialize');
 const style=document.createElement('style');style.textContent='html,body{height:100%;overflow:hidden!important}#combatScreen{height:100vh;padding:0!important}.combat-header,.commands,.side,#combatWeather,#turnBanner{display:none!important}.combat-main{display:block!important;height:100vh!important;min-height:0!important}.combat-app{max-width:none!important;height:100vh!important;padding:0!important}.battle-wrap{width:100%!important;height:100vh!important;min-height:0!important;overflow:hidden!important}';document.head.append(style);
 // Hold turns, but retain the normal view input and weather scheduler.
 combatAwaitingStart=true;combatOpeningSpeechDone=false;
 let drag=null,trace=null,markers=[];
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||trace)return;drag={point:canvasEventPoint(e),x:camera.x,y:camera.y};canvas.setPointerCapture(e.pointerId);e.preventDefault();});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=canvasEventPoint(e),delta=battlefieldProjectVector({x:drag.point.x-p.x,y:drag.point.y-p.y},true),dy=delta.y/HEX_ROW;camera.x=drag.x+delta.x/HEX_W-dy/2;camera.y=drag.y+dy;draw();});
 for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{if(e.shiftKey){e.preventDefault();e.stopImmediatePropagation();rotateBattlefield(e.deltaY>0?1:-1);}},{capture:true,passive:false});
 window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;e.stopImmediatePropagation();e.preventDefault();if(e.key==='ArrowLeft')camera.x--;if(e.key==='ArrowRight')camera.x++;if(e.key==='ArrowUp')camera.y--;if(e.key==='ArrowDown')camera.y++;draw();},true);
 canvas.addEventListener('click',e=>{if(!trace)return;e.preventDefault();e.stopImmediatePropagation();const p=battlefieldWorldAtScreen(canvasEventPoint(e)),point={x:p.x/(128/3),y:p.y/(128/3*.568329)};if(trace.points.length>=64||Math.abs(point.x)>63||Math.abs(point.y)>63)return;trace.points.push(point);const mark=document.createElement('div');mark.textContent=String(trace.points.length);mark.style.cssText=`position:fixed;left:${e.clientX-8}px;top:${e.clientY-8}px;background:#70e6f0;color:#081020;border-radius:50%;padding:3px;pointer-events:none;z-index:99999`;document.body.append(mark);markers.push(mark);trace.notify(trace.points.length);},true);
 let previous={};
 fitBattleCanvas();draw();
 return {
 async canopyStatus(){await presentCombatFrame();return combatGpu.diagnostics().groundCover;},
 view(close){battlefieldZoom=close?3:1;draw();},
 beginTrace(notify){trace={points:[],notify};},
 endTrace(){const points=trace?.points||[];trace=null;markers.forEach(m=>m.remove());markers=[];return points;},
 apply(input){const s=validateSettings(input);
  if(s.canopyEnabled&&!Object.hasOwn(combatGpu.diagnostics().groundCover||{},'canopyBlades'))throw Error('The grass renderer is out of date. Reload this lab to load the update.');
  if(['streamEnabled','streamWidth','streamDepth','streamLevel','streamSpeed','streamRipple'].some(k=>previous[k]!==s[k])||JSON.stringify(previous.streamPath)!==JSON.stringify(s.streamPath)){combatGpu.configureStream({enabled:s.streamEnabled,width:s.streamWidth,depth:s.streamDepth,level:s.streamLevel,speed:s.streamSpeed,ripple:s.streamRipple,path:s.streamPath});initializeFirMovementObstacles();syncWeatherAnimation();}
  if(previous.ambient!==s.ambient){combatSceneContext.map.ambientLight=combatSceneContext.map.ambientLight.map(row=>row.map(()=>s.ambient));drawExplorationIlluminationLayer.cache=null;}
  combatGpu.setTerrainTuning({grass:{canopyEnabled:s.canopyEnabled,snowPress:s.snowPress,grass:s.grass,rocks:s.rocks,sticks:s.sticks,height:s.height,width:s.width,spread:s.spread,bend:s.bend,tufts:s.tufts,wind:s.grassWind,brightness:s.brightness,dry:s.dry,tint:rgb(s.grassColor)},outline:{opacity:s.outlineOpacity,width:s.outlineWidth,color:s.outlineColor==='#060e04'?[.025,.055,.015]:rgb(s.outlineColor)}});
  if(previous.antialiasing!==s.antialiasing)setTreeAntialiasing(s.antialiasing);
  window.adventurePartyShowPerformance=s.performance;
  window.adventurePartySnow.paused=s.snowPaused;window.adventurePartySnow.showFlakes=s.flakes;
  if(previous.snow!==s.snow||previous.snowPaused!==s.snowPaused){const slider=document.getElementById('combatSnowCoverage');slider.value=s.snow*100;slider.dispatchEvent(new Event('input'));}
  for(const key of ['rain','cloudiness','wind'])if(previous[key]!==s[key])window.AdventurePartyWeather.setAmount(key,s[key]);
  if(previous.hour!==s.hour)window.adventurePartySolar.setHour(s.hour);
  previous=s;draw();
 },
 snow(action){const state=window.adventurePartySnow;if(action==='full')state.fillRequested=true;else if(action==='clear'){state.fillRequested=false;state.depthAdjustments=[];state.revision++;}else(state.depthAdjustments??=[]).push(action==='more'?3:-3);draw();}
 };
}
