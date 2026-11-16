import fs from 'node:fs';import assert from 'node:assert/strict';
import {createRepositoryMob} from '../js/repository-mobs.mjs';
import {encounterReadiness,createMobLibrary} from '../js/mob-library.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const catalog=read('data/studio-models.json');const manifest=read('data/mob-library.json');
const seeds=manifest.mobs.map(e=>{const m=read(e.file);m.mob.encounterEnabled ??= true;return m;});const library=createMobLibrary({mobs:()=>[],deletedMobIds:()=>[]},seeds,catalog);
for(const [id,modelId] of [['orc-male-uniformed','male-orc'],['orc-male-uniformed-blue','male-orc-blue']]){
 const template=seeds.find(s=>s.id===id);assert.ok(library.available().some(m=>m.id===id),JSON.stringify(encounterReadiness(template,catalog)));
 const api=createRepositoryMob(template,catalog);for(const faction of ['player','enemy']){const unit=api.apply({faction},()=>0);assert.equal(api.recipe(unit).model.modelId,modelId);assert.equal(unit.faction,faction);}
}
console.log('PASS red and blue orcs selectable and retain their models for both factions');

