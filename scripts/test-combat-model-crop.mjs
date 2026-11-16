import assert from 'node:assert/strict';
import {modelPixelCrop} from '../js/combat-model-crop.mjs';
for(const ratio of [.75,1,1.25,1.5,2])for(let step=0;step<100;step++){
 const view={width:1080,height:600,zoom:.83,anchor:{x:540,y:300}};
 const {crop,targetWidth,targetHeight}=modelPixelCrop({x:step*.17-20,y:step*.23,width:170.2,height:245.7},view,1080*ratio,600*ratio);
 for(const v of [crop.x*ratio,crop.y*ratio,crop.width*ratio,crop.height*ratio])assert(Math.abs(v-Math.round(v))<1e-8);
 assert(Math.abs(crop.width*ratio-targetWidth)<1e-8);assert(Math.abs(crop.height*ratio-targetHeight)<1e-8);
}
console.log('PASS scrolling model crops align one-to-one with framebuffer pixels at fractional scales');
