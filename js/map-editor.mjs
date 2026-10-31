import {FACINGS} from './exploration-core.mjs?v=R238C211';
import {DRAFT_KEY,TEST_KEY,copy,newId,seedPack,blankMap,packIssues,parsePack,paintCell,linkMaps,resizeMap,rectangleSelection,setEncounterArea,removeEncounterSquares,deleteSelectedEncounters} from './exploration-authoring.mjs?v=R238C228';
import {encounterCells,encounterContains} from './exploration-encounters.mjs?v=R238C228';
import {loadMobLibrary} from './mob-library.mjs?v=R238C204';
const $=id=>document.getElementById(id);
let pack,mapId,selected={x:2,z:13},tool='select',dirty=false,history=[],painting=false,stroke=new Set();
let selectionKeys=new Set(),activeEncounterId=null,selectionMapId=null,selectionDrag=null,formKey=null;
const areaColors=['#638bdb','#cf789a','#5d9f70','#b98839','#9274be','#44a3a3'];
const colorFor=e=>e.color||areaColors[[...e.id].reduce((n,c)=>n+c.charCodeAt(0),0)%areaColors.length];
const selectedCells=()=>[...selectionKeys].map(k=>{const [x,z]=k.split(',').map(Number);return {x,z};});
function selectArea(event){activeEncounterId=event.id;selectionKeys=new Set(encounterCells(event).map(p=>`${p.x},${p.z}`));const first=encounterCells(event)[0];if(first)selected={...first};formKey=null;grid();inspector();}
function setTool(id){tool=id;for(const b of $('tools').children)b.setAttribute('aria-pressed',String(b.dataset.tool===id));}
function newArea(){$('selectionMode').value='replace';activeEncounterId=null;selectionKeys.clear();formKey=null;setTool('encounter-area');grid();inspector();tell('Drag to select an encounter area. Shift adds; Alt subtracts.');}
const map=()=>pack.maps.find(m=>m.id===mapId);
function tell(text){$('editorStatus').textContent=text;}
function checkpoint(){history.push(copy(pack));if(history.length>30)history.shift();}
function changed(){dirty=true;render();tell('Unsaved changes. Save maps to keep this adventure in this browser.');}
function option(select,value,text){const node=document.createElement('option');node.value=value;node.textContent=text;select.append(node);}
function selectOptions(select,items,value){select.replaceChildren();for(const [id,name] of items)option(select,id,name);if(items.some(i=>i[0]===value))select.value=value;}
function destinations(preferred){
  const target=pack.maps.find(m=>m.id===$('targetMap').value);
  selectOptions($('targetEntrance'),(target?.entrances||[]).map(e=>[e.id,`${e.name} (${e.x+1}, ${e.z+1})`]),preferred);
}
function inspector(){
  const m=map(),{x,z}=selected,entrance=m.entrances.find(e=>e.x===x&&e.z===z),exit=m.exits.find(e=>e.x===x&&e.z===z);
  $('selection').textContent=`Selected square ${x+1}, ${z+1} · ${m.grid[z][x]==='#'?'Wall':m.grid[z][x]==='D'?'Door':'Floor'}`;
  $('entranceName').value=entrance?.name||'';$('facing').value=String(entrance?.facing??m.start.facing);
  selectOptions($('targetMap'),pack.maps.map(m=>[m.id,m.name]),exit?.targetMapId||$('targetMap').value);destinations(exit?.targetEntranceId);
  const event=(m.encounters||[]).find(e=>e.id===activeEncounterId);
  const touched=(m.encounters||[]).filter(e=>encounterCells(e).some(p=>selectionKeys.has(`${p.x},${p.z}`)));
  $('areaSelection').textContent=`${selectionKeys.size} selected square(s) · ${touched.length} encounter area(s) touched${event?' · Editing '+event.name:''}`;
  const nextFormKey=event?.id||'new';if(formKey!==nextFormKey){
    $('encounterName').value=event?.name||'';$('encounterCount').value=event?.count||2;$('encounterColor').value=event?colorFor(event):areaColors[(m.encounters||[]).length%areaColors.length];
    $('spawnX').value=(event?.spawnX??x)+1;$('spawnZ').value=(event?.spawnZ??z)+1;if(event)$('encounterMob').value=event.mobId;formKey=nextFormKey;
  }
  $('removeEncounter').disabled=!touched.length;$('removeEncounterSquares').disabled=!touched.length;
  $('setEncounter').disabled=!selectionKeys.size;
  $('returnLink').checked=false;
  const target=pack.maps.find(m=>m.id===exit?.targetMapId),arrival=target?.entrances.find(e=>e.id===exit?.targetEntranceId);
  $('connectionInfo').textContent=exit?`Exit → ${target?.name||'Missing map'} / ${arrival?.name||'Missing entrance'}`:'No exit on this square. Exits trigger when stepped onto.';
  $('removeEntrance').disabled=!entrance;$('removeExit').disabled=!exit;
}
function grid(){
  const m=map(),fragment=document.createDocumentFragment(),areas=new Map();
  (m.encounters||[]).forEach((e,i)=>{for(const p of encounterCells(e))if('.D'.includes(m.grid[p.z]?.[p.x]??'#'))areas.set(`${p.x},${p.z}`,{event:e,index:i+1});});$('editorGrid').style.gridTemplateColumns=`repeat(${m.width},minmax(24px,1fr))`;$('editorGrid').style.width=`max(100%, ${m.width*24}px)`;$('editorGrid').setAttribute('aria-label',`${m.width} by ${m.height} editable map`);
  for(let z=0;z<m.height;z++)for(let x=0;x<m.width;x++){
    const b=document.createElement('button'),cell=m.grid[z][x],door=m.doors.find(d=>d.x===x&&d.z===z);
    b.type='button';b.dataset.x=x;b.dataset.z=z;b.className=cell==='#'?'wall':cell==='D'?'door':'floor';
    const labels=[];if(m.start.x===x&&m.start.z===z)labels.push('S');if(m.torches.some(t=>t.x===x&&t.z===z))labels.push('T');if(m.entrances.some(e=>e.x===x&&e.z===z))labels.push('E');if(m.exits.some(e=>e.x===x&&e.z===z))labels.push('X');
    const area=areas.get(`${x},${z}`);
    if(area){
      labels.push('C'+area.index);b.classList.add('encounter-cell');b.style.setProperty('--area-color',colorFor(area.event));b.title=`${area.event.name} (C${area.index})`;
      for(const [dx,dz,side] of [[0,-1,'top'],[1,0,'right'],[0,1,'bottom'],[-1,0,'left']])if(areas.get(`${x+dx},${z+dz}`)?.event.id!==area.event.id)b.style.setProperty(`border-${side}`,`2px solid ${colorFor(area.event)}`);
      if(area.event.id===activeEncounterId)b.classList.add('active-area');
    }
    b.setAttribute('aria-pressed',String(selectionKeys.has(`${x},${z}`)));
    b.textContent=labels.join('')||(door?(door.axis==='x'?'│':'─'):'');
    b.setAttribute('aria-label',`Column ${x+1}, row ${z+1}: ${cell==='#'?'wall':cell==='D'?'door':'floor'}${labels.length?', '+labels.join(', '):''}${area?', encounter '+area.event.name:''}`);
    if(selectionKeys.has(`${x},${z}`))b.classList.add('selected');fragment.append(b);
  }
  $('editorGrid').replaceChildren(fragment);
  $('encounterAreas').replaceChildren();for(const [i,event] of (m.encounters||[]).entries()){
    const button=document.createElement('button');button.type='button';button.textContent=`C${i+1} · ${event.name} · ${encounterCells(event).filter(p=>'.D'.includes(m.grid[p.z]?.[p.x]??'#')).length} squares`;button.style.setProperty('--area-color',colorFor(event));button.className='area-legend';button.setAttribute('aria-pressed',String(event.id===activeEncounterId));button.addEventListener('click',()=>{setTool('select');selectArea(event);});$('encounterAreas').append(button);
  }
}
function render(){
  if(!pack.maps.some(m=>m.id===mapId))mapId=pack.maps[0].id;
  if(selectionMapId!==mapId){selectionMapId=mapId;selectionKeys=new Set([`${selected.x},${selected.z}`]);activeEncounterId=null;formKey=null;}
  if(activeEncounterId&&!(map().encounters||[]).some(e=>e.id===activeEncounterId)){activeEncounterId=null;formKey=null;}
  selectionKeys=new Set([...selectionKeys].filter(k=>{const [x,z]=k.split(',').map(Number);return x<map().width&&z<map().height;}));
  selected.x=Math.min(selected.x,map().width-1);selected.z=Math.min(selected.z,map().height-1);$('mapWidth').value=map().width;$('mapHeight').value=map().height;$('mapDimensions').textContent=`${map().width} × ${map().height} · North ↑`;$('spawnX').max=map().width-1;$('spawnZ').max=map().height-1;
  $('packName').value=pack.name;$('mapName').value=map().name;
  selectOptions($('mapSelect'),pack.maps.map(m=>[m.id,m.name]),mapId);
  const current=$('testEntrance').value;selectOptions($('testEntrance'),[['','Map start'],...map().entrances.map(e=>[e.id,e.name])],current);
  grid();inspector();$('undo').disabled=!history.length;$('deleteMap').disabled=pack.maps.length<2;
  const issues=packIssues(pack);$('issues').replaceChildren();for(const text of issues.length?issues:['Ready to test and export.']){const li=document.createElement('li');li.textContent=text;$('issues').append(li);}
  $('testMap').disabled=issues.length>0;$('exportPack').disabled=issues.length>0;
}
function action(id,fn){$(id).addEventListener('click',()=>{try{fn();}catch(e){tell(e.message);}});}
function mutate(fn){const before=copy(pack);try{fn();history.push(before);if(history.length>30)history.shift();changed();}catch(e){pack=before;throw e;}}
function save(){const issues=packIssues(pack);if(issues.length)throw Error('Fix validation issues before saving:\n'+issues.join('\n'));localStorage.setItem(DRAFT_KEY,JSON.stringify(pack));dirty=false;tell('Saved all maps in this browser. Export an Adventure Pack for a portable backup.');}
function applySquare(button){
  const x=Number(button.dataset.x),z=Number(button.dataset.z);selected={x,z};selectionKeys=new Set([`${x},${z}`]);activeEncounterId=null;
  if(tool!=='select'){
    const key=`${x},${z}`;if(stroke.has(key))return;stroke.add(key);
    try{paintCell(map(),x,z,tool);dirty=true;tell('Unsaved changes.');}catch(e){tell(e.message);}
  }
  grid();inspector();const issues=packIssues(pack);$('testMap').disabled=!!issues.length;$('exportPack').disabled=!!issues.length;
  $('issues').replaceChildren();for(const text of issues.length?issues:['Ready to test and export.']){const li=document.createElement('li');li.textContent=text;$('issues').append(li);}$('undo').disabled=!history.length;
}
async function start(){
  const response=await fetch('data/exploration/old-tollhouse.json?v=R238C210');if(!response.ok)throw Error('Could not load the starter map.');const starter=await response.json();
  let saved;try{saved=localStorage.getItem(DRAFT_KEY);}catch{tell('Browser storage unavailable. Use Export Adventure Pack to keep your work.');}
  let loadNotice='';if(saved){try{pack=parsePack(saved);}catch(e){pack=seedPack(starter);loadNotice='Saved maps could not be read. A starter copy is shown; the stored data is unchanged until you explicitly save. '+e.message;}}else pack=seedPack(starter);
  mapId=pack.maps.find(m=>m.id===new URLSearchParams(location.search).get('map'))?.id||pack.maps[0].id;selected={x:map().start.x,z:map().start.z};
  for(const [id,label] of [['select','Select'],['encounter-area','Encounter area'],['floor','Floor'],['wall','Wall'],['door-z','Door — E/W bar'],['door-x','Door — N/S bar'],['torch','Toggle torch'],['start','Start position']]){
    const b=document.createElement('button');b.textContent=label;b.dataset.tool=id;b.setAttribute('aria-pressed',String(id===tool));b.addEventListener('click',()=>{setTool(id);});$('tools').append(b);
  }
  const point=b=>({x:Number(b.dataset.x),z:Number(b.dataset.z)});
  function updateSelection(p){
    const drag=selectionDrag;if(!drag)return;drag.last=p;drag.moved||=p.x!==drag.start.x||p.z!==drag.start.z;
    selected=p;selectionKeys=new Set(rectangleSelection(drag.start,p,drag.base,drag.mode));grid();inspector();
  }
  $('editorGrid').addEventListener('pointerdown',e=>{
    const b=e.target.closest('button[data-x]');if(!b||e.button!==0)return;e.preventDefault();painting=true;stroke.clear();
    $('editorGrid').setPointerCapture(e.pointerId);
    if(tool==='select'||tool==='encounter-area'){
      const mode=e.altKey?'subtract':e.shiftKey?'add':$('selectionMode').value;
      if(mode==='replace'&&!activeEncounterId&&!$('encounterName').value.trim()){$('spawnX').value=Number(b.dataset.x)+1;$('spawnZ').value=Number(b.dataset.z)+1;}
      selectionDrag={start:point(b),last:point(b),base:[...selectionKeys],mode,moved:false};updateSelection(point(b));
    }else{checkpoint();applySquare(b);}
  });
  $('editorGrid').addEventListener('pointermove',e=>{
    if(!painting||!(e.buttons&1))return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('#editorGrid button[data-x]');if(!b)return;
    const p=point(b);if(selectionDrag){if(p.x!==selectionDrag.last.x||p.z!==selectionDrag.last.z)updateSelection(p);}else applySquare(b);
  });
  function finishSelection(){
    if(selectionDrag&&!selectionDrag.moved&&selectionDrag.mode==='replace'&&tool==='select'){
      const event=(map().encounters||[]).find(e=>encounterContains(e,selected.x,selected.z));if(event)selectArea(event);else{activeEncounterId=null;formKey=null;inspector();}
    }
    painting=false;selectionDrag=null;stroke.clear();
  }
  document.addEventListener('pointerup',finishSelection);$('editorGrid').addEventListener('pointercancel',finishSelection);
  $('editorGrid').addEventListener('click',e=>{
    if(e.detail!==0)return;const b=e.target.closest('button[data-x]');if(!b)return;const p=point(b);
    if(tool==='select'||tool==='encounter-area'){
      const mode=e.altKey?'subtract':e.shiftKey?'add':$('selectionMode').value;
      const event=tool==='select'&&mode==='replace'?(map().encounters||[]).find(e=>encounterContains(e,p.x,p.z)):null;
      if(event)selectArea(event);else{selected=p;selectionKeys=new Set(rectangleSelection(p,p,[...selectionKeys],mode));if(mode==='replace')activeEncounterId=null;grid();inspector();}
    }else{stroke.clear();checkpoint();applySquare(b);}
    $('editorGrid').querySelector(`[data-x="${selected.x}"][data-z="${selected.z}"]`)?.focus();
  });
  action('newEncounterArea',newArea);
  action('clearSelection',()=>{selectionKeys.clear();activeEncounterId=null;formKey=null;grid();inspector();});
  $('mapSelect').addEventListener('change',()=>{mapId=$('mapSelect').value;selected={x:map().start.x,z:map().start.z};render();});
  $('targetMap').addEventListener('change',()=>destinations());
  for(const id of ['packName','mapName']){
    $(id).addEventListener('focus',checkpoint);
    $(id).addEventListener('input',()=>{if(id==='packName')pack.name=$(id).value.trim()||'My adventure';else map().name=$(id).value.trim()||'Untitled map';dirty=true;selectOptions($('mapSelect'),pack.maps.map(m=>[m.id,m.name]),mapId);selectOptions($('targetMap'),pack.maps.map(m=>[m.id,m.name]),$('targetMap').value);$('undo').disabled=false;tell('Unsaved changes.');});
  }
  action('newMap',()=>mutate(()=>{if(pack.maps.length>=100)throw Error('This pack already has 100 maps.');const m=blankMap(newId('map'),`New map ${pack.maps.length+1}`);m.party=copy(starter.party);pack.maps.push(m);mapId=m.id;selected={x:m.start.x,z:m.start.z};}));
  action('duplicateMap',()=>mutate(()=>{if(pack.maps.length>=100)throw Error('This pack already has 100 maps.');const m=copy(map());m.id=newId('map');m.name=`${m.name} copy`.slice(0,100);m.exits=[];pack.maps.push(m);mapId=m.id;}));
  action('deleteMap',()=>{if(pack.maps.length<2)return;const incoming=pack.maps.filter(m=>m.id!==mapId).flatMap(m=>m.exits.filter(e=>e.targetMapId===mapId));if(incoming.length)throw Error(`Remove ${incoming.length} incoming exit connection(s) before deleting this map.`);if(confirm(`Delete ${map().name}? Undo can restore it until you leave this page.`))mutate(()=>{pack.maps=pack.maps.filter(m=>m.id!==mapId);mapId=pack.maps[0].id;});});
  action('undo',()=>{if(history.length){pack=history.pop();formKey=null;changed();}});
  action('setStart',()=>mutate(()=>{paintCell(map(),selected.x,selected.z,'start');map().start.facing=Number($('facing').value);}));
  action('setEntrance',()=>mutate(()=>{const m=map(),name=$('entranceName').value.trim();if(!name)throw Error('Enter an entrance name.');if(m.grid[selected.z][selected.x]!=='.')throw Error('Entrances must be on floor.');const e=m.entrances.find(e=>e.x===selected.x&&e.z===selected.z);if(e){e.name=name;e.facing=Number($('facing').value);}else m.entrances.push({id:newId('entrance'),name,...selected,facing:Number($('facing').value)});}));
  action('removeEntrance',()=>mutate(()=>{const e=map().entrances.find(e=>e.x===selected.x&&e.z===selected.z);if(!e)return;if(pack.maps.some(m=>m.exits.some(x=>x.targetMapId===mapId&&x.targetEntranceId===e.id)))throw Error('Remove incoming connections to this entrance first.');map().entrances=map().entrances.filter(a=>a!==e);}));
  action('setExit',()=>mutate(()=>linkMaps(pack,mapId,{...selected,facing:Number($('facing').value)},$('targetMap').value,$('targetEntrance').value,$('returnLink').checked)));
  action('removeExit',()=>mutate(()=>{map().exits=map().exits.filter(e=>e.x!==selected.x||e.z!==selected.z);}));
  action('resizeMap',()=>mutate(()=>resizeMap(map(),Number($('mapWidth').value),Number($('mapHeight').value))));
  action('savePack',save);
  action('exportPack',()=>{const issues=packIssues(pack);if(issues.length)throw Error(issues.join('\n'));const blob=new Blob([JSON.stringify(pack,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='adventure-pack.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);tell('Adventure Pack exported. Save maps separately to keep browser changes.');});
  $('importPack').addEventListener('change',async()=>{try{const file=$('importPack').files[0];if(!file)return;if(file.size>2_000_000)throw Error('Adventure Pack is too large (2 MB maximum).');const imported=parsePack(await file.text());if(!confirm('Replace the current adventure with this pack? Undo can restore it until you leave this page.'))return;checkpoint();pack=imported;mapId=pack.maps[0].id;selectionMapId=null;formKey=null;changed();}catch(e){tell(e.message);}finally{$('importPack').value='';}});
  action('testMap',()=>{save();sessionStorage.setItem(TEST_KEY,JSON.stringify({id:newId('test'),pack:copy(pack)}));location.assign(`exploration.html?test=1&map=${encodeURIComponent(mapId)}&entrance=${encodeURIComponent($('testEntrance').value)}`);});
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  const {library}=await loadMobLibrary();selectOptions($('encounterMob'),library.available().map(m=>[m.id,m.name]),'orc-male-uniformed');
  action('setEncounter',()=>mutate(()=>{
    const name=$('encounterName').value.trim();if(!name)throw Error('Name the encounter.');
    const old=(map().encounters||[]).find(e=>e.id===activeEncounterId);
    const event=setEncounterArea(map(),{...old,id:old?.id||newId('encounter'),name,color:$('encounterColor').value,mobId:$('encounterMob').value,count:Number($('encounterCount').value),spawnX:Number($('spawnX').value)-1,spawnZ:Number($('spawnZ').value)-1,enabled:old?.enabled??true},selectedCells());
    activeEncounterId=event.id;selectionKeys=new Set(event.cells.map(p=>`${p.x},${p.z}`));
  }));
  action('removeEncounterSquares',()=>mutate(()=>removeEncounterSquares(map(),selectionKeys)));
  action('removeEncounter',()=>mutate(()=>deleteSelectedEncounters(map(),selectionKeys)));
  render();tell(loadNotice||(saved?'Loaded saved maps from this browser.':'Starter tollhouse loaded. Paint it or create a new map, then Save maps.'));
}
start().catch(e=>{tell(e.message);document.querySelectorAll('button').forEach(b=>b.disabled=true);});
