export const EXPLORATION_SKIES=Object.freeze([
 {id:'default',name:'Classic sky',file:null},
 {id:'clear-noon',name:'Clear Noon',file:'qwantani_noon_puresky.jpg'},
 {id:'sunny-clouds',name:'Sunny Clouds',file:'kloofendal_48d_partly_cloudy_puresky.jpg'},
 {id:'clear-morning',name:'Clear Morning',file:'autumn_field_puresky.jpg'}
]);
export function skyDefinition(id){return EXPLORATION_SKIES.find(s=>s.id===id)||EXPLORATION_SKIES[0];}
export function validateSkybox(map){if(map.skybox!==undefined&&!EXPLORATION_SKIES.some(s=>s.id===map.skybox))throw Error('Unknown exploration skybox.');}
export async function loadExplorationSky(THREE,id){const sky=skyDefinition(id);if(!sky.file)return null;const texture=await new THREE.TextureLoader().loadAsync(new URL('../assets/textures/skies/'+sky.file,import.meta.url).href);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;return texture;}
