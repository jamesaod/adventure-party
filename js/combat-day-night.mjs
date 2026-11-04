import {solarState,solarTimeLabel,hourFromPointer,wrapHour} from './solar-clock.mjs?v=R238C274';
const host=document.getElementById('combatDayNight');
let wallShadows=new URLSearchParams(location.search).get('wallSunShadows')!=='off';
let dayTestFrame=null,dayTestRunning=false,dayTestMinute=720;
let committed=12,pending=12,committedState=solarState(12),timer=null,dragging=false;
const commit=()=>{clearTimeout(timer);timer=null;if(committed===pending)return;committed=pending;committedState=solarState(committed);window.dispatchEvent(new CustomEvent('adventure-party:solar-change',{detail:committedState}));};
window.adventurePartySolar={state:()=>committedState,wallShadows:()=>wallShadows,setHour(hour){stopDayTest();pending=Math.round(wrapHour(hour)*6)/6%24;paint();commit();}};
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
 if(!host)return;const sun=solarState(pending),angle=(pending-12)*Math.PI/12-Math.PI/2,x=100+69*Math.cos(angle),y=100+69*Math.sin(angle);
 host.querySelector('.solar-hand').setAttribute('x2',x);host.querySelector('.solar-hand').setAttribute('y2',y);
 host.querySelector('.solar-marker').setAttribute('transform',`translate(${x} ${y})`);
 const wheel=host.querySelector('svg');wheel.setAttribute('aria-valuenow',Math.round(pending*60));wheel.setAttribute('aria-valuetext',solarTimeLabel(pending)+' local solar time, '+sun.phase);wheel.dataset.hour=String(pending);
 host.querySelector('.solar-time').textContent=solarTimeLabel(pending)+' SOLAR';
 const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(sun.azimuth/45)%8];
 host.querySelector('.solar-position').textContent=sun.altitude>=-.001?`SUN ${Math.round(sun.altitude)}° ${direction}`:sun.phase==='twilight'?'TWILIGHT':'NIGHT';
}
if(host){
 const ticks=Array.from({length:24},(_,hour)=>{const a=(hour-12)*Math.PI/12-Math.PI/2;return `<line x1="${100+83*Math.cos(a)}" y1="${100+83*Math.sin(a)}" x2="${100+(hour%6?87:91)*Math.cos(a)}" y2="${100+(hour%6?87:91)*Math.sin(a)}"/>`;}).join('');
 host.innerHTML=`<svg viewBox="0 0 200 200" role="slider" tabindex="0" aria-label="Time of day, spring equinox at 38 degrees north" aria-valuemin="0" aria-valuemax="1439">
 <defs><radialGradient id="solarBrass"><stop stop-color="#f1d78a"/><stop offset=".65" stop-color="#a87936"/><stop offset="1" stop-color="#503516"/></radialGradient><clipPath id="solarSkyClip"><circle cx="100" cy="100" r="75"/></clipPath></defs>
 <circle cx="100" cy="100" r="98" fill="url(#solarBrass)" stroke="#e2c575"/><circle cx="100" cy="100" r="91" fill="#211d1b" stroke="#b99450"/>
 <g clip-path="url(#solarSkyClip)"><path d="M20 20H180V100H20Z" fill="#244863"/><path d="M20 100H180V180H20Z" fill="#11152b"/><path d="M20 95H180V109H20Z" fill="#a66b3d" opacity=".65"/><circle cx="100" cy="100" r="53" fill="none" stroke="#b99a58" opacity=".45"/><ellipse cx="100" cy="100" rx="67" ry="32" transform="rotate(-23 100 100)" fill="none" stroke="#c5a966" opacity=".55"/>
 <path d="M95 133a13 13 0 1 0 14 20a13 13 0 0 1 -14 -20" fill="#b9bbcb" opacity=".7"/></g>
 <circle cx="100" cy="100" r="75" fill="none" stroke="#d7b66b"/><g stroke="#dbc17b">${ticks}</g>
 <g class="solar-numerals" fill="#eed38b" text-anchor="middle"><text x="100" y="21">XII</text><text x="18" y="105">VI</text><text x="181" y="105">XVIII</text><text x="100" y="188">XXIV</text></g>
 <line class="solar-hand" x1="100" y1="100" stroke="#e1bc62" stroke-width="2"/><circle cx="100" cy="100" r="5" fill="#d8ad51" stroke="#f8e3a3"/>
 <g class="solar-marker" fill="#ffe49a" stroke="#bd8731"><path d="M0-12L3-7L9-9L7-3L12 0L7 3L9 9L3 7L0 12L-3 7L-9 9L-7 3L-12 0L-7-3L-9-9L-3-7Z"/><circle r="6"/></g></svg>
 <div class="solar-time"></div><div class="solar-position"></div><small>EQUINOX · 38° N</small><label class="wall-shadow-toggle"><input id="wallSunShadows" type="checkbox"> WALL SHADOWS</label><button id="solarDayTest" type="button" aria-pressed="false" title="Animate one solar minute per combat frame (30 FPS target)">DAY TEST: OFF</button>`;
 const testButton=host.querySelector('#solarDayTest');testButton.addEventListener('click',event=>{event.stopPropagation();toggleDayTest();});for(const name of ['keydown','keyup'])testButton.addEventListener(name,event=>event.stopPropagation());
 const shadowToggle=host.querySelector('#wallSunShadows');shadowToggle.checked=wallShadows;
 shadowToggle.addEventListener('change',()=>{wallShadows=shadowToggle.checked;window.dispatchEvent(new CustomEvent('adventure-party:solar-change',{detail:committedState}));});
 shadowToggle.addEventListener('keydown',e=>e.stopPropagation());shadowToggle.addEventListener('keyup',e=>e.stopPropagation());
 const wheel=host.querySelector('svg'),queue=()=>{clearTimeout(timer);timer=setTimeout(commit,250);};
 function point(event){const b=wheel.getBoundingClientRect(),x=(event.clientX-b.left)/b.width-.5,y=(event.clientY-b.top)/b.height-.5;if(Math.hypot(x,y)<.12)return;pending=Math.round(hourFromPointer(x,y)*6)/6%24;paint();queue();}
 wheel.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();stopDayTest();dragging=true;wheel.setPointerCapture(e.pointerId);point(e);});
 wheel.addEventListener('pointermove',e=>{if(dragging)point(e);});
 for(const name of ['pointerup','pointercancel'])wheel.addEventListener(name,e=>{if(!dragging)return;dragging=false;if(wheel.hasPointerCapture(e.pointerId))wheel.releasePointerCapture(e.pointerId);commit();});
 wheel.addEventListener('keydown',e=>{const steps={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:6,PageDown:-6};if(!(e.key in steps)&&!['Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();stopDayTest();pending=e.key==='Home'?0:e.key==='End'?23+5/6:wrapHour(pending+steps[e.key]*(e.shiftKey?1:1/6));pending=Math.round(pending*6)/6%24;paint();queue();});
 wheel.addEventListener('keyup',e=>{if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)){e.stopPropagation();commit();}});
 addEventListener('pagehide',()=>{clearTimeout(timer);stopDayTest();});addEventListener('visibilitychange',()=>{if(document.hidden)stopDayTest();});paint();
}

