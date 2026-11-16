import * as THREE from '../assets/vendor/three/three.module.min.js';

export function bowSequenceTiming(recipe){
 const join=(recipe.notch.end-recipe.notch.start)/recipe.notch.speed-recipe.blend;
 return {draw:(recipe.draw-recipe.notch.start)/recipe.notch.speed,release:join+(recipe.release-recipe.shoot.start)/recipe.shoot.speed};
}
export function bowSequenceSourceTiming(recipe,timing){
 const join=(recipe.notch.end-recipe.notch.start)/recipe.notch.speed-recipe.blend;
 return {draw:recipe.notch.start+timing.draw*recipe.notch.speed,release:recipe.shoot.start+(timing.release-join)*recipe.shoot.speed};
}

// Authoring-time composition: combat receives an ordinary, preloaded clip.
export function buildBowSequence(notch, shoot, recipe) {
 const parts=[recipe.notch,recipe.shoot];
 for(const [i,p] of parts.entries())if(!p||![p.start,p.end,p.speed].every(Number.isFinite)||p.start<0||p.end<=p.start||p.end>[notch,shoot][i].duration+1e-5||p.speed<.1||p.speed>4)throw Error('Choose valid trims and speeds for both bow clips.');
 const durations=parts.map(p=>(p.end-p.start)/p.speed),blend=recipe.blend;
 if(!Number.isFinite(blend)||blend<0||blend>=Math.min(...durations))throw Error('Blend must be shorter than either clip.');
 const join=durations[0]-blend,total=join+durations[1];
 const {draw,release}=bowSequenceTiming(recipe);
 if(!Number.isFinite(draw)||!Number.isFinite(release)||draw<0||draw>join||recipe.release<parts[1].start||recipe.release>parts[1].end||release<=draw)throw Error('Draw must be within Notch before the blend; release must be within Shoot.');
 const maps=[notch,shoot].map(c=>new Map(c.tracks.map(t=>[t.name,t])));
 if(maps[0].size!==maps[1].size||[...maps[0].keys()].some(k=>!maps[1].has(k)))throw Error('Bow clips must target the same model and bone tracks.');
 const times=[...new Set([0,join,durations[0],release,total,...Array.from({length:Math.ceil(total*60)},(_,i)=>Math.min(total,i/60))])].sort((a,b)=>a-b);
 const tracks=[];
 for(const [name,a] of maps[0]){
  const b=maps[1].get(name),size=a.getValueSize();if(a.ValueTypeName!==b.ValueTypeName||size!==b.getValueSize())throw Error('Incompatible bow track '+name);
  const ia=a.createInterpolant(),ib=b.createInterpolant(),values=[];
  for(const t of times){const av=Array.from(ia.evaluate(parts[0].start+Math.min(t,durations[0])*parts[0].speed)),bv=Array.from(ib.evaluate(parts[1].start+Math.max(0,t-join)*parts[1].speed));const w=t<join?0:blend===0?1:Math.min(1,(t-join)/blend);
   if(a.ValueTypeName==='quaternion'){const q=new THREE.Quaternion().fromArray(av).slerp(new THREE.Quaternion().fromArray(bv),w);values.push(q.x,q.y,q.z,q.w);}else for(let i=0;i<size;i++)values.push(av[i]*(1-w)+bv[i]*w);
  }
  tracks.push(new a.constructor(name,times,values));
 }
 return {clip:new THREE.AnimationClip('Bow — Notch + Shoot',total,tracks),bowTiming:{draw,release}};
}
