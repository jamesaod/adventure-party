// Preserve the original tuft method and its authored look for future biomes.
export const ORIGINAL_GRASS_DEFAULTS=Object.freeze({canopyEnabled:false,snowPress:true,height:.4,width:2.3,spread:1.2,bend:.9,tufts:2,wind:1.8,brightness:.85,dry:.82,tint:Object.freeze([1,1,1])});
export const CANOPY_GRASS_DEFAULTS=Object.freeze({canopyEnabled:true,snowPress:true,height:.55,width:1.4,spread:1.2,bend:2,tufts:2,wind:3,brightness:1.05,dry:.82,tint:Object.freeze([235/255,254/255,1])});
export function grassLabSettings(preset){const {tint,wind,...settings}=preset;return {...settings,grassWind:wind,grassColor:'#'+tint.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')};}
