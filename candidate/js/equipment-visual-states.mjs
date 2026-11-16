// Times are source-clip seconds, so trimming and playback speed stay coherent.
export function validateBowTiming(a){
 if(a.bowTiming==null)return;
 const {draw,release,pickup}=a.bowTiming;
 if(pickup!=null&&(!Number.isFinite(pickup)||pickup<a.start||pickup>=draw))throw Error("Arrow pickup must be between Start and Draw.");
 if(!Number.isFinite(draw)||!Number.isFinite(release)||draw<a.start||release<=draw||release>a.end)throw Error('Bow markers must satisfy Start ≤ Draw < Release ≤ End.');
}
export function bowDrawnAt(a,time){return !!a?.bowTiming&&time>=a.bowTiming.draw&&time<a.bowTiming.release;}

const warmed=new WeakMap();
export function warmBowMaterials(renderer,scene,camera,root){
 let roots=warmed.get(renderer);if(!roots){roots=new WeakSet();warmed.set(renderer,roots);}
 if(roots.has(root))return;
 const variants=[];root.traverse(o=>{if(o.name==='BowRest'||o.name==='BowDrawn')variants.push([o,o.visible]);});
 if(!variants.length){roots.add(root);return;}
 try{
  for(const [o] of variants){o.visible=true;o.traverse(n=>{for(const m of [].concat(n.material||[]))for(const v of Object.values(m))if(v?.isTexture)renderer.initTexture(v);});}
  renderer.compile(scene,camera);
  roots.add(root);
 }finally{for(const [o,visible] of variants)o.visible=visible;}
}


// Older saved bow clips retain their authored trim/draw/release. The pickup falls
// in the over-shoulder reach of the existing Notch lead-in, not a new action delay.
export function bowPickupTime(a){
 if(!a?.bowTiming||a.bowTiming.draw<=a.start)return null;
 return a.bowTiming.pickup??a.start+(a.bowTiming.draw-a.start)*.35;
}
export function bowArrowStateAt(a,time,remaining){
 const pickup=bowPickupTime(a),timing=a?.bowTiming;
 if(!timing)return {phase:'idle',remaining};
 if(time>=timing.release)return {phase:'released',remaining};
 if(time>=timing.draw)return {phase:'nocked',remaining};
 if(pickup!=null&&time>=pickup)return {phase:'carry',progress:(time-pickup)/(timing.draw-pickup),remaining};
 return {phase:'quiver',remaining};
}
