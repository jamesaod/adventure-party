// Full source extents own the ruler. Trims only change active spans and playback.
export const TIMELINE_COLORS=['#51b8d8','#aa8be9','#77c89b','#dfb763','#df8cac'];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function timelineLayout(model){
 let extent=0,play=0;
 const segments=model.segments.map((s,i)=>{
  const duration=s.duration/s.speed,active=(s.end-s.start)/s.speed;
  const segment={...s,offset:extent,playStart:play,playEnd:play+active,color:TIMELINE_COLORS[i%TIMELINE_COLORS.length]};
  extent+=duration;play+=active-(s.blendOut||0);return segment;
 });
 return {segments,extent,duration:segments.at(-1)?.playEnd||0};
}
export function sourceToTimeline(model,id,time){const s=timelineLayout(model).segments.find(s=>s.id===id);return s?s.offset+time/s.speed:0;}
export function sourceToPlayback(model,id,time){const s=timelineLayout(model).segments.find(s=>s.id===id);return s?s.playStart+(clamp(time,s.start,s.end)-s.start)/s.speed:0;}
export function playbackToTimeline(model,time){
 const {segments}=timelineLayout(model);
 const s=segments.findLast(s=>time>=s.playStart)||segments[0];
 return s?s.offset+clamp(s.start+(time-s.playStart)*s.speed,s.start,s.end)/s.speed:0;
}
export function timelineToPlayback(model,value){
 const {segments}=timelineLayout(model);
 const s=segments.find(s=>value<s.offset+s.duration/s.speed)||segments.at(-1);
 return s?sourceToPlayback(model,s.id,(value-s.offset)*s.speed):0;
}
export function timelineHandles(model){
 const trims=model.segments.flatMap(s=>model.frozen?[]:[
  {id:s.id+':start',segmentId:s.id,kind:'start',label:s.label+' start',value:s.start,min:0,max:s.end-.01},
  {id:s.id+':end',segmentId:s.id,kind:'end',label:s.label+' finish',value:s.end,min:s.start+.01,max:s.duration}
 ]);
 return [...trims,...(model.events||[]).map(e=>{
  const s=model.segments.find(s=>s.id===e.segmentId);
  const before=model.events.find(other=>other.id===e.before&&other.segmentId===e.segmentId),after=model.events.find(other=>other.id===e.after&&other.segmentId===e.segmentId);
  return {...e,kind:'event',min:Math.max(s.start+(after?.001:0),after?after.value+.001:s.start),max:Math.min(s.end-(e.beforeBlend?(s.blendOut||0)*s.speed+.001:before?.001:0),before?before.value-.001:s.end)};
 })];
}
export function editTimeline(model,id,value){
 const next=structuredClone(model),handle=timelineHandles(next).find(h=>h.id===id);
 if(!handle||!Number.isFinite(value))return next;
 const s=next.segments.find(s=>s.id===handle.segmentId);
 value=clamp(value,handle.min,handle.max);
 if(handle.kind==='event')next.events.find(e=>e.id===id).value=value;else s[handle.kind]=value;
 // A short trim cannot retain a transition longer than either retained clip.
 next.segments.forEach((s,i)=>{if(i+1<next.segments.length){const n=next.segments[i+1];s.blendOut=clamp(s.blendOut||0,0,Math.max(0,Math.min((s.end-s.start)/s.speed,(n.end-n.start)/n.speed)-.01));}});
 for(const event of next.events||[]){const h=timelineHandles(next).find(h=>h.id===event.id);event.value=clamp(h.value,h.min,h.max);}
 return next;
}

export function createAnimationTimeline({host,onSeek,onChange,onPause,isLocked=()=>false}){
 const doc=host.ownerDocument;
 const make=(tag,className,text)=>{const e=doc.createElement(tag);e.className=className;if(text)e.textContent=text;return e;};
 host.classList.add('animation-timeline');
 const title=make('div','timeline-title','Animation timeline'),legend=make('div','timeline-legend');
 const rail=make('div','timeline-rail'),ruler=make('div','timeline-ruler'),readout=make('div','timeline-readout');
 rail.tabIndex=0;rail.setAttribute('role','slider');rail.setAttribute('aria-label','Animation playhead');rail.setAttribute('aria-valuemin','0');
 const help=make('small','timeline-help','Drag the white playhead to scrub. Drag IN / OUT to trim; grey is skipped. ▲ String attaches · ▼ Arrow release. Arrow keys fine-tune a focused marker.');
 host.replaceChildren(title,legend,rail,ruler,readout,help);
 let model={segments:[],events:[]},drag=null,playback=0,playhead=null;
 const handles=new Map();
 function atPointer(e){const box=rail.getBoundingClientRect();return clamp((e.clientX-box.left)/Math.max(1,box.width),0,1)*timelineLayout(model).extent;}
 function render(){
  const focused=doc.activeElement?.dataset?.marker,layout=timelineLayout(model),width=layout.extent||1;
  rail.replaceChildren();legend.replaceChildren();ruler.replaceChildren();handles.clear();
  title.textContent=layout.segments.length?'Animation timeline':'Select an animation to edit its timeline';
  rail.setAttribute('aria-valuemax',String(layout.duration));
  for(const s of layout.segments){
   const item=make('span','timeline-key',s.label);item.style.setProperty('--clip-color',s.color);legend.append(item);
   const band=make('div','timeline-segment');band.style.left=s.offset/width*100+'%';band.style.width=s.duration/s.speed/width*100+'%';band.style.setProperty('--clip-color',s.color);
   const active=make('div','timeline-active');active.style.left=s.start/s.duration*100+'%';active.style.width=(s.end-s.start)/s.duration*100+'%';
   band.append(active,make('span','timeline-clip-name',s.label));rail.append(band);
  }
  for(const h of timelineHandles(model)){
   const button=make('button','timeline-handle '+h.kind+(h.id==='release'?' release':''));button.type='button';button.dataset.marker=h.id;
   button.setAttribute('role','slider');button.setAttribute('aria-label',h.label);button.setAttribute('aria-valuemin',String(h.min));button.setAttribute('aria-valuemax',String(h.max));button.setAttribute('aria-valuenow',String(h.value));button.setAttribute('aria-valuetext',h.value.toFixed(3)+' source seconds');
   button.title=h.label+' · '+h.value.toFixed(3)+' s';
   button.style.left=sourceToTimeline(model,h.segmentId,h.value)/width*100+'%';
   button.append(make('span','timeline-symbol',h.kind==='event'?(h.id==='release'?'▼':'▲'):h.kind==='start'?'IN':'OUT'));
   button.onkeydown=e=>{
    if(isLocked())return;
    const delta=(e.shiftKey?.1:.01)*(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1);
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();onPause();
    onChange(editTimeline(model,h.id,e.key==='Home'?h.min:e.key==='End'?h.max:h.value+delta),{id:h.id,commit:true});
   };
   handles.set(h.id,button);rail.append(button);
  }
  playhead=make('div','timeline-playhead');rail.append(playhead);
  for(let i=0;i<=4;i++){const tick=make('span','', (layout.extent*i/4).toFixed(2)+' s');ruler.append(tick);}
  if(focused)handles.get(focused)?.focus({preventScroll:true});
  setPlayhead(playback);
 }
 function setModel(next){model=structuredClone(next);render();}
 function setPlayhead(time){
  playback=time;const layout=timelineLayout(model);
  if(playhead)playhead.style.left=playbackToTimeline(model,time)/(layout.extent||1)*100+'%';
  rail.setAttribute('aria-valuenow',String(time));
  readout.textContent='Playback '+Math.max(0,time).toFixed(2)+' / '+layout.duration.toFixed(2)+' s · Full source ruler '+layout.extent.toFixed(2)+' s';
 }
 function move(e,commit=false){
  if(!drag)return;
  if(!drag.id){onSeek(timelineToPlayback(model,atPointer(e)));return;}
  const h=timelineHandles(model).find(h=>h.id===drag.id),s=timelineLayout(model).segments.find(s=>s.id===h?.segmentId);
  if(s)onChange(editTimeline(model,drag.id,(atPointer(e)-s.offset)*s.speed),{id:drag.id,commit});
 }
 rail.onpointerdown=e=>{
  if(e.button!==0||isLocked()||!model.segments.length)return;
  e.preventDefault();onPause();
  drag={id:e.target.closest('[data-marker]')?.dataset.marker,initial:structuredClone(model)};
  rail.setPointerCapture(e.pointerId);move(e);
 };
 rail.onpointermove=e=>{if(drag)move(e);};
 rail.onpointerup=e=>{if(!drag)return;const active=drag;move(e,true);drag=null;if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);if(active.id)handles.get(active.id)?.focus({preventScroll:true});};
 rail.onpointercancel=()=>{if(drag?.id)onChange(drag.initial,{id:drag.id,commit:true,cancel:true});drag=null;};
 rail.onkeydown=e=>{if(e.target!==rail||isLocked())return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();onPause();onSeek(clamp(e.key==='Home'?0:e.key==='End'?timelineLayout(model).duration:playback+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.1:.01),0,timelineLayout(model).duration));}};
 render();return {setModel,setPlayhead,getModel:()=>structuredClone(model)};
}
