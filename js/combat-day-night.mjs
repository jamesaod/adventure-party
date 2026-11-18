import {solarState,weatherSolarState,solarTimeLabel,wrapHour} from './solar-clock.mjs?v=R238C380';
import {SEASONS,getSeason,setSeason} from './combat-seasons.mjs';
import {installGrassSelector} from './combat-grass-selector.mjs';
window.adventurePartySnow={intensity:0,showFlakes:true,paused:false,revision:0};
let snowFrame=null;
function tickSnow(){snowFrame=null;if(document.hidden||!host?.getClientRects().length)return;window.dispatchEvent(new Event("adventure-party:snow-change"));if(!window.adventurePartySnow.paused&&(window.adventurePartySnow.intensity||window.adventurePartySnow.activeCount))snowFrame=window.requestCombatAnimationTick(tickSnow);}
function wakeSnow(){if(snowFrame===null&&!window.adventurePartySnow.paused)snowFrame=window.requestCombatAnimationTick(tickSnow);}
const host=document.getElementById('combatDayNight');
let wallShadows=new URLSearchParams(location.search).get('wallSunShadows')!=='off';
let dayTestFrame=null,dayTestRunning=false,dayTestMinute=720;
let committed=11,pending=11,committedState=solarState(11),timer=null;
const commit=()=>{clearTimeout(timer);timer=null;if(committed===pending)return;committed=pending;committedState=solarState(committed);window.dispatchEvent(new CustomEvent('adventure-party:solar-change',{detail:committedState}));};
let visualKey='',visualState=null;
function currentVisualSolar(){const weather=window.getWeatherSnapshot?.()||{};const snow=window.adventurePartySnow?.intensity||0;const effective=weather.amounts?weather:snow>0?{type:'snow',intensity:snow}:weather;const key=[committed,effective.type,effective.intensity,JSON.stringify(effective.amounts)].join(':');if(key!==visualKey){visualKey=key;visualState=weatherSolarState(committedState,effective);}return visualState;}
window.adventurePartySolar={state:currentVisualSolar,wallShadows:()=>wallShadows,setHour(hour){stopDayTest();pending=Math.round(wrapHour(hour)*6)/6%24;paint();commit();}};
function stopDayTest(){
 dayTestRunning=false;if(dayTestFrame!==null)window.cancelCombatAnimationTick(dayTestFrame);dayTestFrame=null;
 const button=host?.querySelector('#solarDayTest');if(button){button.setAttribute('aria-pressed','false');button.textContent='DAY TEST: OFF';}
}
function tickDayTest(){
 dayTestFrame=null;if(!dayTestRunning)return;
 if(document.hidden||!host?.getClientRects().length){stopDayTest();return;}
 dayTestMinute=(dayTestMinute+1)%1440;pending=dayTestMinute/60;
 paint();commit();dayTestFrame=window.requestCombatAnimationTick(tickDayTest);
}
function toggleDayTest(){
 if(dayTestRunning){stopDayTest();return;}
 clearTimeout(timer);timer=null;dayTestRunning=true;dayTestMinute=Math.round(pending*60)%1440;
 const button=host.querySelector('#solarDayTest');button.setAttribute('aria-pressed','true');button.textContent='DAY TEST: ON';
 dayTestFrame=window.requestCombatAnimationTick(tickDayTest);
}
function paint(){
 if(!host)return;const slider=host.querySelector('#combatTimeOfDay');slider.value=Math.round(pending*60);slider.setAttribute('aria-valuetext',solarTimeLabel(pending)+' solar time');host.querySelector('#combatTimeLabel').textContent=solarTimeLabel(pending);
}
if(host){
 host.innerHTML=`<div class="environment-time"><label for="combatTimeOfDay">TIME <output id="combatTimeLabel">11:00</output></label><button id="solarDayTest" type="button" aria-pressed="false">DAY TEST: OFF</button></div><input id="combatTimeOfDay" aria-label="Time of day" type="range" min="0" max="1439" step="1" value="660">
 <label>SNOW <output id="snowAmount">0%</output><input id="combatSnowCoverage" aria-label="Snowfall intensity" type="range" min="0" max="100" value="0"></label><label><input id="snowFlakes" type="checkbox" checked> FALLING FLAKES</label><button id="snowPause" type="button">PAUSE SNOW</button><button id="snowClear" type="button">CLEAR SNOW</button><div class="snow-depth-controls"><button id="snowLess" type="button" aria-label="Subtract three inches of snow">−3 INCHES</button><button id="snowMore" type="button" aria-label="Add three inches of snow">+3 INCHES</button></div><label class="wall-shadow-toggle"><input id="wallSunShadows" type="checkbox"> WALL SHADOWS</label><button id="performanceToggle" type="button">STATS: NONE</button>`;
 const seasonRow=document.createElement('label');seasonRow.className='environment-season';seasonRow.innerHTML='<span>SEASON</span><select id="combatSeason" aria-label="Season">'+SEASONS.map(s=>'<option value="'+s+'">'+s[0].toUpperCase()+s.slice(1)+'</option>').join('')+'</select>';host.prepend(seasonRow);
 const seasonSelect=seasonRow.querySelector('select');seasonSelect.value=getSeason();seasonSelect.addEventListener('change',()=>setSeason(seasonSelect.value));addEventListener('adventure-party:season-change',()=>{seasonSelect.value=getSeason();});
 const detail=document.createElement('label');detail.innerHTML='CPU DETAIL <select id="combatPerformanceDetail"><option value="all">Largest costs</option><option value="cover">Ground cover breakdown</option></select>';host.append(detail);
 detail.querySelector('select').addEventListener('change',event=>{window.adventurePartyPerformanceDetail=event.target.value;window.draw?.();});
 for(const name of ['keydown','keyup','pointerdown'])detail.addEventListener(name,event=>event.stopPropagation());
 window.adventurePartyShowPerformance=false;window.adventurePartyPerformanceMode='none';
 const performanceToggle=host.querySelector('#performanceToggle');
 performanceToggle.addEventListener('click',()=>{const modes=['full','fps','none'],mode=modes[(modes.indexOf(window.adventurePartyPerformanceMode)+1)%3];window.adventurePartyPerformanceMode=mode;window.adventurePartyShowPerformance=mode!=='none';performanceToggle.textContent='STATS: '+(mode==='fps'?'FPS ONLY':mode.toUpperCase());window.draw?.();});
 const flakesToggle=host.querySelector('#snowFlakes');flakesToggle.addEventListener('change',()=>{window.adventurePartySnow.showFlakes=flakesToggle.checked;wakeSnow();});for(const name of ['keydown','keyup'])flakesToggle.addEventListener(name,e=>e.stopPropagation());
 const snow=host.querySelector('#combatSnowCoverage');
 snow.addEventListener('input',()=>{window.adventurePartySnow.intensity=Number(snow.value)/100;window.AdventurePartyWeather?.setAmount('snow',Number(snow.value)/100);wakeSnow();document.getElementById('snowAmount').textContent=snow.value+'%';window.dispatchEvent(new Event('adventure-party:snow-change'));});
 for(const name of ['keydown','keyup','pointerdown'])snow.addEventListener(name,e=>e.stopPropagation());
 for(const id of ['snowPause','snowClear','snowLess','snowMore']){const button=host.querySelector('#'+id);for(const name of ['keydown','keyup'])button.addEventListener(name,e=>e.stopPropagation());button.addEventListener('click',()=>{const state=window.adventurePartySnow;if(id==='snowClear'){state.fillRequested=false;state.depthAdjustments=[];state.revision++;}else if(id==='snowLess'||id==='snowMore')(state.depthAdjustments??=[]).push(id==='snowMore'?3:-3);else{state.paused=!state.paused;button.textContent=state.paused?'RESUME SNOW':'PAUSE SNOW';}window.dispatchEvent(new Event('adventure-party:snow-change'));wakeSnow();});}
 addEventListener('visibilitychange',()=>{if(!document.hidden&&window.adventurePartySnow.intensity)wakeSnow();});
 const testButton=host.querySelector('#solarDayTest');testButton.addEventListener('click',event=>{event.stopPropagation();toggleDayTest();});for(const name of ['keydown','keyup'])testButton.addEventListener(name,event=>event.stopPropagation());
 const shadowToggle=host.querySelector('#wallSunShadows');shadowToggle.checked=wallShadows;
 shadowToggle.addEventListener('change',()=>{wallShadows=shadowToggle.checked;window.dispatchEvent(new CustomEvent('adventure-party:solar-change',{detail:committedState}));});
 shadowToggle.addEventListener('keydown',e=>e.stopPropagation());shadowToggle.addEventListener('keyup',e=>e.stopPropagation());
 const slider=host.querySelector('#combatTimeOfDay');
 slider.addEventListener('input',()=>{stopDayTest();pending=Number(slider.value)/60;paint();clearTimeout(timer);timer=setTimeout(commit,250);});
 slider.addEventListener('change',commit);
 const weatherPanel=document.getElementById('combatWeather');
 if(weatherPanel){const label=snow.closest('label');label.firstChild.textContent='SNOW '; weatherPanel.querySelector('.weather-amounts').prepend(label);const tools=document.createElement('div');tools.id='combatSnowTools';tools.append(flakesToggle.closest('label'),host.querySelector('#snowPause'),host.querySelector('#snowClear'),host.querySelector('#snowLess').parentElement,host.querySelector('.wall-shadow-toggle')); weatherPanel.append(tools);}
 document.getElementById('environmentDiagnostics').append(performanceToggle);
 const godButton=document.createElement('button');godButton.id='godTreeTool';godButton.type='button';godButton.textContent='GOD TOOL';godButton.setAttribute('aria-pressed','false');godButton.title='Select, then click a tree base hex to fell it.';godButton.addEventListener('click',()=>window.toggleGodTreeTool?.());
 const resetTrees=document.createElement('button');resetTrees.type='button';resetTrees.id='godTreeReset';resetTrees.textContent='RESET TREES';resetTrees.addEventListener('click',()=>window.resetGodTrees?.());
 const breakButton=document.createElement('button');breakButton.id='godTreeBreakType';breakButton.type='button';globalThis.adventurePartyTreeBreakType='torn';breakButton.textContent='BREAK: TORN';breakButton.title='Choose the break for the next tree you fell.';breakButton.addEventListener('click',()=>{globalThis.adventurePartyTreeBreakType=globalThis.adventurePartyTreeBreakType==='torn'?'cut':'torn';breakButton.textContent='BREAK: '+globalThis.adventurePartyTreeBreakType.toUpperCase();});
 const status=document.createElement('div');status.id='godTreeStatus';status.setAttribute('aria-live','polite');status.style.cssText='font-size:11px;max-width:230px';document.getElementById('environmentGodTools').append(godButton,breakButton,resetTrees,status);
 const panel=document.getElementById('combatEnvironmentPanel');for(const name of ['keydown','keyup','pointerdown','wheel'])panel.addEventListener(name,e=>e.stopPropagation());
 addEventListener('pagehide',()=>{clearTimeout(timer);stopDayTest();});addEventListener('visibilitychange',()=>{if(document.hidden)stopDayTest();});paint();
}

