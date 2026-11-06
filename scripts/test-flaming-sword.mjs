import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../assets/vendor/three/three.module.min.js';import {extractCombatFunction} from './combat-test-source.mjs';
const context=vm.createContext({THREE});vm.runInContext(extractCombatFunction(fs.readFileSync('js/combat-mob-renderer.mjs','utf8'),'captureFlamingBlade'),context);
const weapon=new THREE.Group();weapon.add(new THREE.Mesh(new THREE.BoxGeometry(.1,2,.1),new THREE.MeshBasicMaterial()));const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const initial=context.captureFlamingBlade({model:weapon},camera);weapon.position.x=1;const moved=context.captureFlamingBlade({model:weapon},camera);
assert(initial[1].y<initial[0].y,'Blade extends along the real weapon long axis');for(let i=0;i<2;i++)assert(Math.abs(moved[i].x-initial[i].x-1/6)<1e-6,'Anchors follow mounted weapon world transform');
weapon.rotation.z=Math.PI/2;const rotated=context.captureFlamingBlade({model:weapon},camera);assert(Math.abs(rotated[0].y-rotated[1].y)<1e-6,'Flame anchors rotate with weapon pose');assert.equal(context.captureFlamingBlade(null,camera),null);
console.log('PASS flame anchors follow actual mounted weapon translation and pose rotation');

weapon.position.set(0,0,0);weapon.rotation.z=0;const scene=new THREE.Group();scene.add(weapon);const body=new THREE.Mesh(new THREE.BoxGeometry(1,3,.5),new THREE.MeshBasicMaterial());body.position.z=1;scene.add(body);scene.updateMatrixWorld(true);
assert(context.captureFlamingBlade({model:weapon},camera,scene).every(p=>p.blocked),'Body in front hides blade flames');
body.position.z=-1;scene.updateMatrixWorld(true);assert(context.captureFlamingBlade({model:weapon},camera,scene).every(p=>!p.blocked),'Blade in front retains flames');
console.log('PASS actual body depth hides rear sword flames and retains front sword flames');

const {studioWeapon}=await import('../js/studio-equipment.mjs');const sword=studioWeapon('medieval-sword');assert(sword.flameSpan.base[0]<.2&&sword.flameSpan.tip[0]<sword.flameSpan.base[0],'Flames start beyond the crossguard and extend toward -X tip');
weapon.position.set(0,0,0);weapon.rotation.set(0,0,0);const bladeOnly=context.captureFlamingBlade({model:weapon,weapon:sword},camera);
assert(Math.abs(bladeOnly[0].x-(.5+.17/6))<1e-6);assert(Math.abs(bladeOnly.at(-1).x-(.5-.48/6))<1e-6);console.log('PASS production sword flame span excludes crossguard and grip');
