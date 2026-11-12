import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import {snowDisplayToLinear,corpseSnowTint} from '../js/combat-corpse-snow.mjs';
const input=new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777);
const output=new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602);
for(const rgb of [[.08,.11,.16],[.3,.35,.42],[.7,.74,.78],[.7,.4,.15],[.88,.92,.96],[.99,.99,.99]]){
 const v=snowDisplayToLinear(rgb,true).multiplyScalar(1.15/.6).applyMatrix3(input);
 for(const k of ['x','y','z']){const x=v[k];v[k]=(x*(x+.0245786)-.000090537)/(x*(.983729*x+.432951)+.238081);}
 const actual=v.applyMatrix3(output).toArray().map(x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055);
 actual.forEach((x,i)=>assert(Math.abs(x-rgb[i])<.00001));
}
// Bright, cool daylight previously produced negative red and blue > 4.
// Emulate the RGBA8 target before tone mapping, not an unlimited HDR buffer.
for(const hdr of [false,true])for(const rgb of [[.7,.9,.99],[.85,.95,.99],[.9,.99,.99],[.99,.99,.99]]){
 const encoded=snowDisplayToLinear(rgb,hdr);
 assert(encoded.toArray().every(c=>Number.isFinite(c)&&c>=0&&(hdr||c<=1)));
 const v=encoded.clone().multiplyScalar(1.15/.6).applyMatrix3(input);
 for(const k of ['x','y','z']){const x=v[k];v[k]=(x*(x+.0245786)-.000090537)/(x*(.983729*x+.432951)+.238081);}
 const actual=v.applyMatrix3(output).toArray().map(x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055);
 assert(actual[0]>.65,'Daylight snow must retain red rather than turn cyan');
 assert(actual[2]-actual[0]<.25,'Daylight snow should have a restrained cool tint');
}
assert(THREE.ShaderLib.standard.fragmentShader.includes('#include <opaque_fragment>'));
console.log('PASS snow terrain color round-trip: night, twilight, day and firelight');

for(const amount of [0,1,2])assert.deepEqual(corpseSnowTint(amount),[.902,.916,.930]);
assert.deepEqual(corpseSnowTint(3),[.88,.92,.96]);
assert(corpseSnowTint(2.5)[2]>.930&&corpseSnowTint(2.5)[2]<.96);
