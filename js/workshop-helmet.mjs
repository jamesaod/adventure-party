import * as THREE from '../assets/vendor/three/three.module.min.js';
export const HELMET_FILE='../assets/characters/custom/tripo-helmet.glb';
export function helmetSettings(value={}){
 const d={enabled:false,scale:1,x:0,y:0,z:0,yaw:0,...value,hideHead:false};
 for(const k of ['enabled','hideHead'])if(typeof d[k]!=='boolean')throw Error('Invalid helmet setting.');
 for(const [k,min,max]of [['scale',.5,2],['x',-.25,.25],['y',-.25,.25],['z',-.25,.25],['yaw',-180,180]])if(!Number.isFinite(d[k])||d[k]<min||d[k]>max)throw Error('Invalid helmet fit: '+k);
 return d;
}
export function attachHelmet(assembly,source,settings){
 const d=helmetSettings(settings);if(!d.enabled)return;
 const bone=[...assembly.bones.values()].find(b=>b.name.toLowerCase()==='head');if(!bone)throw Error('This character has no head bone.');
 assembly.root.updateMatrixWorld(true);const box=new THREE.Box3(),v=new THREE.Vector3();let found=false;
 assembly.root.traverse(m=>{if(!m.isSkinnedMesh||!['head','Head'].includes(m.userData.slot))return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v);box.expandByPoint(v.applyMatrix4(m.matrixWorld));}found=true;});
 if(!found)throw Error('Select a head before fitting the helmet.');
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const wrapper=new THREE.Group();wrapper.name='Tripo_Horned_Helmet';wrapper.userData={attachment:'head',source:'User supplied Tripo helmet'};
 const model=source.clone(true);model.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of [].concat(o.material)){m.userData.customHelmet=true;m.metalness=.15;m.roughness=.7;m.transparent=false;m.opacity=1;m.alphaTest=0;m.depthWrite=true;m.side=THREE.DoubleSide;assembly.materials.push(m);}o.frustumCulled=false;}});wrapper.add(model);bone.add(wrapper);
 const fit={wrapper,inverseHead:bone.matrixWorld.clone().invert(),baseScale:size.x/.43*(assembly.bones.has('Head')?.8:1),center: center.clone(),top:box.max.y};
 assembly.helmet=fit;updateHelmet(assembly,d);
 // The enclosed helmet replaces hair, hoods and face/head accessories. The
 // choices are retained in the design and return when the helmet is removed.
 assembly.root.traverse(m=>{const slot=m.userData?.slot;if(['hair','beard','hood','Hair','FacialHair','AttachmentHead','AttachmentFace'].includes(slot))m.visible=false;});
}
export function updateHelmet(assembly,settings){
 const f=assembly?.helmet;if(!f)return;const d=helmetSettings(settings),s=f.baseScale*d.scale;
 const world=new THREE.Matrix4().compose(new THREE.Vector3(f.center.x+d.x,f.top-.60*s+d.y,f.center.z+.055+d.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(d.yaw)),new THREE.Vector3(s,s,s));
 f.wrapper.matrix.copy(f.inverseHead).multiply(world);f.wrapper.matrix.decompose(f.wrapper.position,f.wrapper.quaternion,f.wrapper.scale);f.wrapper.updateMatrixWorld(true);
}
export function helmetControls({getDesign,rebuild,guarded,getAssembly}){
 const panel=document.getElementById('helmet-controls');
 panel.innerHTML='<h2>Tripo helmet</h2><label><select id="helmet-choice"><option value="">No custom helmet</option><option value="tripo">Horned Tripo helmet</option></select></label><label>Size<input id="helmet-scale" type="range" min="0.5" max="2" step="0.01"></label><label>Left / right<input id="helmet-x" type="range" min="-0.25" max="0.25" step="0.005"></label><label>Up / down<input id="helmet-y" type="range" min="-0.25" max="0.25" step="0.005"></label><label>Back / forward<input id="helmet-z" type="range" min="-0.25" max="0.25" step="0.005"></label><label>Turn<input id="helmet-yaw" type="range" min="-180" max="180" step="1"></label><button id="helmet-reset" type="button">Reset helmet fit</button><p class="hint">Attached to the head bone. Hair, hoods and original head accessories are hidden while worn. Adjust fit while previewing movement.</p>';
 const $=id=>document.getElementById(id);
 const change=changes=>guarded(()=>{const d=getDesign();return rebuild({...d,helmet:{...helmetSettings(d.helmet),...changes}});});
 $('helmet-choice').onchange=()=>change({enabled:$('helmet-choice').value==='tripo'});
 $('helmet-reset').onclick=()=>change({scale:1,x:0,y:0,z:0,yaw:0});
 for(const k of ['scale','x','y','z','yaw'])$('helmet-'+k).oninput=()=>{const d=getDesign();d.helmet={...helmetSettings(d.helmet),[k]:Number($('helmet-'+k).value)};updateHelmet(getAssembly(),d.helmet);};
 return ()=>{const d=helmetSettings(getDesign()?.helmet);$('helmet-choice').value=d.enabled?'tripo':'';for(const k of ['scale','x','y','z','yaw'])$('helmet-'+k).value=d[k];};
}




