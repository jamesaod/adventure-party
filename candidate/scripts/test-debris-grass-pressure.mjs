import assert from 'node:assert/strict';
import {createDebrisGrassPressure} from '../js/debris-grass-pressure.mjs';
const field=createDebrisGrassPressure(),wood=[{a:{x:0,y:0},b:{x:100,y:0},radius:10}];field.update(wood,1);
const {debrisPressure,debrisBounds}=field.uniforms;
function sample(x,y){const b=debrisBounds.value,ix=Math.floor((x-b.x)/b.z*256),iy=Math.floor((y-b.y)/b.w*256);return debrisPressure.value.image.data[iy*256+ix];}
assert.equal(sample(50,0),255);assert(sample(50,16)>0&&sample(50,16)<255);assert(sample(50,21)<sample(50,16));
const version=debrisPressure.value.version;field.update(wood,.5);assert.equal(debrisPressure.value.version,version,'Strength animation does not upload the field');assert.equal(field.diagnostics().bakes,1);
const branches=[{a:{x:0,y:-30},b:{x:100,y:-30},radius:5},{a:{x:0,y:30},b:{x:100,y:30},radius:5}];field.update(branches,1);
for(let x=5;x<=95;x+=5)for(let y=-30;y<=30;y+=5)assert.equal(sample(x,y),255,'No grass gaps between limbs');
assert(sample(50,42)>0&&sample(50,42)<255,'Outer edge still feathers');
field.update(branches.map((c,i)=>({...c,fallGroup:String(i)})),1);assert.equal(sample(50,0),0,'Separate fallen trees do not flatten the gap between their hulls');field.update(null,0);assert.equal(field.uniforms.debrisStrength.value,0);assert(field.uniforms.debrisPressure.value.image.data.every(v=>v===0));field.dispose();console.log('PASS wood pressure core, feathering, cached uploads and reset');
