import {ORIGINAL_GRASS_DEFAULTS,CANOPY_GRASS_DEFAULTS,grassLabSettings} from './grass-presets.mjs?v=foliage-restored1';
import {canopyFeedback} from './terrain-lab-feedback.mjs?v=pan2';
import {DEFAULTS,exportPreset,importPreset} from './terrain-lab-preset.mjs?v=foliage-restored1';
const comparing=new URLSearchParams(location.search).has('grassCanopy');
let settings={...DEFAULTS,...(comparing?{canopyEnabled:true}: {})},bridge,timer,reportRevision=0;
const $=id=>document.getElementById(id),status=$('status');
const comparisonButtons=[];
const comparisonBar=document.createElement('div');comparisonBar.className='actions';
for(const [label,action] of [['Original grass',()=>{Object.assign(settings,grassLabSettings(ORIGINAL_GRASS_DEFAULTS));paint();apply();}],['Canopy grass',()=>{clearTimeout(timer);Object.assign(settings,grassLabSettings(CANOPY_GRASS_DEFAULTS));settings.grass=true;paint();apply();}],['Gameplay view',()=>bridge.view(false)],['Close view',()=>bridge.view(true)]]){const b=document.createElement('button');b.textContent=label;b.disabled=true;b.onclick=action;comparisonButtons.push(b);comparisonBar.append(b);}status.after(comparisonBar);
const groups=[['Stream',[['streamEnabled','Permanent stream'],['streamWidth','Bank width (metres)',1,8,.1],['streamDepth','Channel depth (metres)',.25,1.2,.05],['streamLevel','Water level (metres)',-.6,-.02,.02],['streamSpeed','Flow speed',0,2,.05],['streamRipple','Ripple strength',0,1,.01]]],['Weather',[['snow','Snowfall',0,1,.01],['rain','Rain',0,1,.01],['cloudiness','Cloudiness',0,1,.01],['wind','Wind',0,1,.01],['flakes','Falling flakes'],['snowPaused','Pause snow accumulation']]],['Lighting',[['hour','Time of day',0,23.833333,1/6],['ambient','Ambient light (%)',0,300,5]]],['Trees',[['outlineOpacity','Outline opacity',0,1,.01],['outlineWidth','Outline width (pixels)',0,1.5,.05],['outlineColor','Outline color'],['antialiasing','Tree antialiasing']]],['Grass & ground cover',[['canopyEnabled','Canopy grass — whole map'],['snowPress','Snow presses grass'],['grass','Grass tufts'],['rocks','Rocks'],['sticks','Sticks'],['grassColor','Grass color tint'],['brightness','Grass brightness',.1,2,.05],['dry','Dry grass mix',0,1,.01],['height','Grass height',.1,2,.05],['width','Blade width',.2,4,.1],['spread','Tuft spread',.1,2,.05],['bend','Blade bend',0,3,.1],['tufts','Tufts per patch',1,5,1],['grassWind','Grass wind response',0,3,.1]]],['Diagnostics',[['performance','Performance overlay']]]];
for(const [title,fields] of groups){const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;fieldset.append(legend);
 for(const [key,label,min,max,step] of fields){const row=document.createElement('label'),caption=document.createElement('span'),name=document.createElement('span'),out=document.createElement('output');name.textContent=label;out.id=key+'Value';caption.append(name,out);const input=document.createElement(key==='antialiasing'?'select':'input');input.id=key;
 if(key==='antialiasing')for(const n of [0,2,4,8]){const o=document.createElement('option');o.value=n;o.textContent=n?n+'× MSAA':'Off';input.append(o);}
 else if(typeof DEFAULTS[key]==='boolean')input.type='checkbox';else if(key.endsWith('Color'))input.type='color';else {input.type='range';input.min=min;input.max=max;input.step=step;}
 input.oninput=()=>{settings[key]=input.type==='checkbox'?input.checked:input.type==='color'?input.value:Number(input.value);paint();clearTimeout(timer);timer=setTimeout(apply,120);};row.append(caption,input);fieldset.append(row);
 }$('controls').append(fieldset);
}
const traceTools=document.createElement('div');traceTools.className='actions';const traceButton=document.createElement('button'),finishButton=document.createElement('button'),cancelButton=document.createElement('button');traceButton.textContent='Trace stream';finishButton.textContent='Finish path';cancelButton.textContent='Cancel';finishButton.disabled=cancelButton.disabled=true;
function stopTrace(){traceButton.disabled=false;finishButton.disabled=cancelButton.disabled=true;return bridge.endTrace();}
traceButton.onclick=()=>{clearTimeout(timer);apply();traceButton.disabled=true;cancelButton.disabled=false;bridge.beginTrace(count=>{finishButton.disabled=count<2;status.textContent=`${count} path points. Click downstream, then Finish path.`;});status.textContent='Click at least two points in the scene, upstream to downstream. Finish path applies the channel.';};
finishButton.onclick=()=>{const points=stopTrace();settings={...settings,streamPath:points,streamEnabled:true};paint();apply();};cancelButton.onclick=()=>{stopTrace();status.textContent='Path edit cancelled.';};traceTools.append(traceButton,finishButton,cancelButton);$('controls').children[0].append(traceTools);
const snowTools=document.createElement('div');snowTools.className='actions';for(const [title,action] of [['Clear snow','clear'],['−3 inches','less'],['+3 inches','more'],['Full cover','full']]){const b=document.createElement('button');b.textContent=title;b.onclick=()=>bridge.snow(action);snowTools.append(b);}$('controls').children[1].append(snowTools);
function paint(){for(const key of Object.keys(settings)){const input=$(key),value=settings[key];if(!input)continue;if(input.type==='checkbox')input.checked=value;else input.value=value;$(key+'Value').textContent=typeof value==='number'?(key==='hour'?`${Math.floor(value).toString().padStart(2,'0')}:${(Math.round(value*60)%60).toString().padStart(2,'0')}`:Number(value.toFixed(2))):'';}}
function apply(){if(!bridge)return;const report=++reportRevision;try{bridge.apply(settings);
 if(!settings.canopyEnabled){status.textContent='Original grass active. Export JSON to keep this look.';return;}
 status.textContent='Applying canopy grass…';
 const grass=settings.grass;
 bridge.canopyStatus().then(diagnostics=>{if(report===reportRevision)status.textContent=canopyFeedback(grass,diagnostics);}).catch(e=>{if(report===reportRevision)status.textContent=e.message;});
 }catch(e){status.textContent=e.message;}}

$('export').onclick=()=>{clearTimeout(timer);apply();const url=URL.createObjectURL(new Blob([JSON.stringify(exportPreset(settings),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='terrain-look-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;if(file.size>100000)throw Error('Preset is too large.');const next=importPreset(JSON.parse(await file.text()));clearTimeout(timer);settings=next;paint();apply();}catch(e){status.textContent='Import rejected: '+e.message;}finally{$('file').value='';}};
$('reset').onclick=()=>{clearTimeout(timer);settings={...DEFAULTS};paint();apply();bridge.snow('clear');};
paint();
let started=false;async function start(){try{const w=$('scene').contentWindow;if(started||!w.adventurePartyGameStartup?.ready)return;started=true;await w.adventurePartyGameStartup.ready;const module=await w.eval("import("+JSON.stringify(new URL("./js/terrain-lab-bridge.mjs?v=foliage-restored1",w.location.href).href)+")");bridge=await module.openTerrainLab();for(const id of ['controls','export','import','reset'])$(id).disabled=false;comparisonButtons.forEach(b=>b.disabled=false);apply();}catch(e){status.textContent='Could not start terrain lab: '+e.message;}}
$('scene').addEventListener('load',start,{once:true});


if($('scene').contentDocument?.readyState==='complete')start();

