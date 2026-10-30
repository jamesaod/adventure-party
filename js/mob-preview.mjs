import {createRepositoryMob} from './repository-mobs.mjs?v=R238C204';
import {appearanceRecipeForMob} from './mob-appearance.mjs?v=R238C204';
import {generateCombatSpriteSet} from './combat-mob-renderer.mjs?v=R238C205';
// A deterministic example of a weighted template, never an implicit saved roll.
export async function renderMobPreview(mob,catalog,pose='ready'){
 const api=createRepositoryMob(mob,catalog),unit=api.apply({id:mob.id,type:'orc'},()=>0);
 const context=api.recipe(unit),all=context.poseProfile.poses;
 const sample=pose==='t-pose'?{rest:true}:all[pose];
 if(!sample)throw Error('This pose has no assignment or fallback.');
 context.poseProfile={...context.poseProfile,poses:{ready:sample}};
 const recipe=appearanceRecipeForMob(unit,{...context.model,...context});
 const result=await generateCombatSpriteSet(recipe);
 return {src:result.sourceUrls['ready-se.png'],equipment:unit.inventory.filter(i=>i.equipped).map(i=>i.name).join(', ')||'Unarmed',height:recipe.renderSettings.heightInches,frame:result.manifest.frame};
}
