import assert from 'node:assert/strict';
import {streamBankProfile,createStreamField,streamBankWear} from '../js/combat-stream-field.mjs';
const left=streamBankProfile(7,.9,3.2,.08),right=streamBankProfile(7,-.9,3.2,.08);
assert(left.depthFactor<right.depthFactor,'Inside bend creates a shallower shelf');
assert.notEqual(left.radius,right.radius,'Opposing banks vary independently');
assert.notEqual(streamBankProfile(2,.5,3.2).radius,streamBankProfile(8,.5,3.2).radius,'Width varies along the path');
for(let a=0;a<80;a+=.25)for(const side of [-1,1]){const p=streamBankProfile(a,side*10,3.2,.1);assert.equal(p.depthFactor,0);assert(p.radius>1&&p.radius<2.1);}
const field=createStreamField({size:128,span:32}),path=[{x:-4,y:-12},{x:4,y:0},{x:-4,y:12}];field.configure(path);const first=field.data.slice();field.configure(path);assert.deepEqual(field.data,first,'Bank detail is deterministic, without temporal noise');
for(let i=0;i<field.data.length;i+=4){assert(Number.isFinite(field.data[i]));assert(field.data[i]>=0);assert(field.data[i+1]>=0);assert(field.data[i+1]<=field.data[i]);}
console.log('PASS independent shore widths, inside-bend shelves, bounded dry edges and deterministic channel data');

assert.equal(streamBankWear(0),0);assert.equal(streamBankWear(.14),1);assert.equal(streamBankWear(.01,.02),1,'Standing water clears grass');const feather=[0,.02,.04,.06,.08,.1,.12,.14].map(d=>streamBankWear(d));assert(feather.slice(1).every((v,i)=>v>feather[i]),'Bank dirt and grass coverage blend gradually');

