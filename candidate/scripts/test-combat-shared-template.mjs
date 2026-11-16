import assert from 'node:assert/strict';
import {sealWorkshopTemplate} from '../js/immutable-workshop-template.mjs';
import {appearanceRecipeForMob,appearanceCacheKey} from '../js/mob-appearance.mjs';
const template=sealWorkshopTemplate({id:'test',draft:{clips:[{data:{values:[1,2,3]}}]}});
assert.throws(()=>template.draft.clips[0].data.values.push(4),TypeError);
const unit={id:'a',type:'orc',inventory:[]},recipe=appearanceRecipeForMob(unit,{renderSettings:{workshopUnit:template,equipment:{rightHand:'axe'}}});assert.equal(recipe.renderSettings.workshopUnit,template);
const other=appearanceRecipeForMob({...unit,id:'b',name:'Other'},{renderSettings:{workshopUnit:template,equipment:{rightHand:'axe'}}});assert.equal(appearanceCacheKey(recipe),appearanceCacheKey(other));other.renderSettings.equipment.rightHand='sword';assert.notEqual(appearanceCacheKey(recipe),appearanceCacheKey(other));
const replacement=sealWorkshopTemplate({id:'test',draft:{clips:[{data:{values:[1,2,4]}}]}});assert.notEqual(appearanceCacheKey(recipe),appearanceCacheKey({...recipe,renderSettings:{...recipe.renderSettings,workshopUnit:replacement}}));
console.log('PASS immutable shared animation payload, individual identity reuse, equipment and replacement invalidation');
