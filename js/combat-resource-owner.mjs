// Explicit lifetime for a subsystem's exclusive GPU resources. Shared references dispose once.
export function createResourceOwner(){
 const resources=new Set();let disposed=false;
 function own(value){if(!value||resources.has(value))return value;if(disposed)throw Error('Resource owner disposed');if(typeof value.dispose==='function')resources.add(value);return value;}
 function material(m){if(!m)return;own(m);for(const v of Object.values(m))if(v?.isTexture)own(v);for(const u of Object.values(m.uniforms||{}))if(u?.value?.isTexture)own(u.value);}
 function track(root){root?.traverse(o=>{own(o.geometry);for(const m of [o.material].flat())material(m);material(o.customDepthMaterial);material(o.customDistanceMaterial);});return root;}
 return {own,track,get disposed(){return disposed;},get count(){return resources.size;},dispose(){if(disposed)return;disposed=true;for(const r of resources)r.dispose();resources.clear();}};
}
