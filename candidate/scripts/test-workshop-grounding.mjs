import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {removeWorkshopRootTravel,createWorkshopGrounding} from '../js/workshop-grounding.mjs';

const group=new THREE.Group(),model=new THREE.Group(),hips=new THREE.Bone();
group.add(model);model.add(hips);hips.name='mixamorigHips';
const feet=['mixamorigLeftFoot','mixamorigRightFoot'].map(name=>{const b=new THREE.Bone();b.name=name;hips.add(b);return b;});
feet[0].position.set(-.2,0,0);feet[1].position.set(.2,0,0);
group.scale.setScalar(2);group.rotation.y=.7;group.position.set(3,4,5);
const clip=new THREE.AnimationClip('travel',1,[
 new THREE.VectorKeyframeTrack(hips.uuid+'.position',[0,1],[1,2,3,4,5,6]),
 new THREE.VectorKeyframeTrack(feet[0].uuid+'.position',[0,1],[0,0,0,1,2,3])
]);
removeWorkshopRootTravel(clip,model);
assert.deepEqual([...clip.tracks[0].values],[1,2,3,1,5,3]);
assert.deepEqual([...clip.tracks[1].values],[0,0,0,1,2,3]);
const grounding=createWorkshopGrounding(THREE,model,group),point=new THREE.Vector3();
hips.position.y=3;grounding.apply();
assert(Math.abs(feet[0].getWorldPosition(point).y-4)<1e-6);
grounding.reset();assert.equal(model.position.y,0);
hips.position.y=1;grounding.apply();
assert(Math.abs(feet[1].getWorldPosition(point).y-4)<1e-6);
console.log('Workshop root travel and grounding preserve limb motion, world scale and reset without drift.');

// A corpse must follow the ground even after the battlefield group moves.
const corpseGroup=new THREE.Group(),corpseModel=new THREE.Group();corpseGroup.add(corpseModel);
const geom=new THREE.BoxGeometry(1,2,1);geom.translate(0,1,0);
const count=geom.attributes.position.count;
geom.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
geom.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
const skin=new THREE.SkinnedMesh(geom,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();
skin.add(bone);skin.bind(new THREE.Skeleton([bone]));corpseModel.add(skin);
const cg=createWorkshopGrounding(THREE,corpseModel,corpseGroup);
corpseGroup.position.y=5;bone.position.y=2;cg.applyCorpse();skin.computeBoundingBox();
assert(Math.abs(skin.boundingBox.clone().applyMatrix4(skin.matrixWorld).min.y-5)<1e-6);
cg.reset();bone.position.y=3;cg.applyCorpse();skin.computeBoundingBox();
assert(Math.abs(skin.boundingBox.clone().applyMatrix4(skin.matrixWorld).min.y-5)<1e-6);
console.log('PASS corpse body grounding after animation, translation and repeated reset.');
