import {appearanceCacheKey} from './mob-appearance.mjs?v=R238C204';
// The legacy sprite signature also includes inventory-only armor. Actual mesh,
// equipment, fitted transforms, animation state and pose data remain in this key.
export function preparedVisualKey(recipe){
 const copy=structuredClone(recipe);
 if(copy.animation)delete copy.animation.spriteFamilySignature;
 return appearanceCacheKey(copy);
}
