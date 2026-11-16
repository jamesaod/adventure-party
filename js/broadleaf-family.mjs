// Shared family registry. Each family has its own models, particles, litter and fall state.
export const BROADLEAF_FAMILIES=Object.freeze({
 'white-oak':{species:'white-oak',base:5,models:['oak-raised-green','oak-raised-fall','oak-raised-winter-fine','oak-stump','oak-fallen','oak-detached-limbs'],directory:'white-oak',particle:'oak-fall-particle-leaf',greenLeaf:'Oak_English_Cluster_Leaf_Summer_Color.png',fallLeaf:'oak-litter-fall.png',outline:[.29,.065,.018]},
 'sugar-maple':{species:'sugar-maple',base:11,models:['maple-green-balanced','maple-fall-balanced','maple-winter','maple-stump','maple-fallen','maple-detached-limbs'],directory:'sugar-maple',particle:'maple-particle-leaf',greenLeaf:'SugarMaple_Leaf_Green.png',fallLeaf:'SugarMaple_Leaf_Fall.png',outline:[.32,.025,.008]},
 'sugar-maple-tall':{species:'sugar-maple',base:17,models:['maple-green-balanced','maple-fall-balanced','maple-winter','maple-stump','maple-fallen','maple-detached-limbs'],directory:'sugar-maple/variants/tall',particle:'maple-particle-leaf',greenLeaf:'SugarMaple_Leaf_Green.png',fallLeaf:'SugarMaple_Leaf_Fall.png',outline:[.32,.025,.008]},
 'sugar-maple-broad':{species:'sugar-maple',base:23,models:['maple-green-balanced','maple-fall-balanced','maple-winter','maple-stump','maple-fallen','maple-detached-limbs'],directory:'sugar-maple/variants/broad',particle:'maple-particle-leaf',greenLeaf:'SugarMaple_Leaf_Green.png',fallLeaf:'SugarMaple_Leaf_Fall.png',outline:[.32,.025,.008]}
 ,'american-beech':{species:'american-beech',base:29,models:['beech-green-balanced','beech-fall-balanced','beech-winter','beech-stump','beech-fallen','beech-detached-limbs'],directory:'american-beech',particle:'beech-particle-leaf',greenLeaf:'Beech_Leaf_Green.png',fallLeaf:'Beech_Leaf_Fall.png',outline:[.28,.12,.025]}
 ,'sweet-birch':{species:'sweet-birch',base:35,models:['birch-green-balanced','birch-fall-balanced','birch-winter','birch-stump','birch-fallen','birch-detached-limbs'],directory:'sweet-birch',particle:'birch-particle-leaf',greenLeaf:'Birch_Leaf_Green.png',fallLeaf:'Birch_Leaf_Fall.png',outline:[.28,.16,.025]}
});
export const ACTIVE_BROADLEAF=BROADLEAF_FAMILIES['sugar-maple'];
export const broadleafAsset=(file,family=ACTIVE_BROADLEAF)=>new URL('../assets/terrain/'+family.directory+'/'+file,import.meta.url).href;
export const broadleafForVariant=variant=>Object.values(BROADLEAF_FAMILIES).find(f=>variant>=f.base&&variant<f.base+6);
export const isBroadleaf=tree=>!!BROADLEAF_FAMILIES[tree?.species];

export function broadleafNamedAssets(family,models){return Object.fromEntries(['green','fall','winter','stump','fallen','limbs'].map((name,i)=>[name,models[family.base+i]]));}
export function requestedTreeFamilies(ids=Object.keys(BROADLEAF_FAMILIES)){return [...new Set(ids)].map(id=>{if(!BROADLEAF_FAMILIES[id])throw new RangeError('Unknown tree family '+id);return BROADLEAF_FAMILIES[id];});}
