import {createCombatRenderer} from './combat-webgl.mjs?v=cover-profile1';
const $=id=>document.getElementById(id),canvas=$('view'),raster=document.createElement('canvas');
globalThis.getWeatherSnapshot=()=>({type:'clear',intensity:0});
const scene={streamPath:[{x:-20,y:0},{x:0,y:0},{x:20,y:0}],streamSettings:{enabled:true,width:6.2,depth:.85,level:-.16,speed:.5,ripple:.37}};
let renderer,frame=0,lastRepeat=0,strikeAt=null,ready=false,view;
const extent=800,faces=[{grass:true,snowEligible:1,grassUnit:128/3,grassSquash:.568329,visibility:1,points:[{x:-extent,y:-extent},{x:extent,y:-extent},{x:extent,y:extent},{x:-extent,y:extent}],uv:[[0,0],[12,0],[12,12],[0,12]]}];
const grass=new Image();grass.src='assets/textures/exploration/grass-short-v1.png';
function resize(){const box=$('viewport').getBoundingClientRect(),density=Math.min(devicePixelRatio,2);canvas.width=Math.round(box.width*density);canvas.height=Math.round(box.height*density);raster.width=canvas.width;raster.height=canvas.height;view={width:box.width,height:box.height,matrix:[1,0,0,1,box.width/2,box.height/2],anchor:{x:box.width/2,y:box.height/2},zoom:Number($('zoom').value)/100};}
function hit(point){if(!ready)return;const p=point||{x:0,y:$('location').value==='dry'?180:0};const wet=renderer.waterClubImpact(p.x,p.y);$('status').textContent=wet?'Impact! Large spray and three expanding rings.':'Dry ground: correctly produced no splash.';return wet;}
$('splash').onclick=()=>{strikeAt=null;hit();};
$('strike').onclick=()=>{strikeAt=performance.now()+2400;};
$('clear').onclick=()=>{strikeAt=null;$('repeat').checked=false;renderer?.snowScene({...scene},[-extent,-extent,extent*2,extent*2]);$('status').textContent='Effects cleared.';};
$('zoom').oninput=()=>{$('zoomValue').textContent=$('zoom').value+'%';resize();};
$('repeat').onchange=()=>{lastRepeat=performance.now();if($('repeat').checked)hit();};
canvas.onclick=e=>{if(!view)return;const r=canvas.getBoundingClientRect();hit({x:(e.clientX-r.left-view.width/2)/view.zoom,y:(e.clientY-r.top-view.height/2)/view.zoom});};
new ResizeObserver(resize).observe($('viewport'));
function render(now){frame=requestAnimationFrame(render);if(document.hidden)return;
 renderer.begin(view);renderer.surface(faces,grass,{grassMaterial:true,category:'Floor'});
 if(strikeAt!==null){if(now>=strikeAt){strikeAt=null;hit();}else $('status').textContent='Club impact in '+((strikeAt-now)/1000).toFixed(1)+' seconds…';}
 if($('repeat').checked&&now-lastRepeat>=4000){lastRepeat=now;hit();}
 renderer.drawPuddles([]);renderer.end();const state=renderer.puddleEffectsState();$('stats').textContent=state.particles+' droplets · '+state.rings+' rings';
 if(!ready){ready=true;$('splash').disabled=$('strike').disabled=false;$('status').textContent='Ready. Trigger a splash or click the water.';}
}
try{await grass.decode();renderer=createCombatRenderer(canvas,raster);renderer.snowScene(scene,[-extent,-extent,extent*2,extent*2]);resize();frame=requestAnimationFrame(render);}catch(e){$('error').textContent=e.message;console.error(e);}
addEventListener('pagehide',()=>{cancelAnimationFrame(frame);renderer?.dispose();});
