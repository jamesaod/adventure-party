import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spriteOutlinePixels, BATTLEFIELD_PIXELS_PER_INCH } from '../js/sprite-outline.mjs';
import { quantizeRgba } from '../js/studio-core.mjs';

const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: got ${actual}, expected ${expected}`);

close(BATTLEFIELD_PIXELS_PER_INCH, 64 / 120, '10-foot battlefield hex scale');

const studioStyle={outlineInches:1.875,outline:12,brightness:1,contrast:1};
close(spriteOutlinePixels(studioStyle,320,80,320),4,'Studio source pixels');
close(spriteOutlinePixels(studioStyle,80,80,320),1,'Combat must use one native pixel, not twelve');
close(spriteOutlinePixels({...studioStyle,outlineInches:0},80,80,320),0,'Zero inches disables native outline');
close(spriteOutlinePixels({outlineInches:3.75,outline:100},80,80,320),2,'Two native pixels selected');
close(spriteOutlinePixels({outline:12},80,80,320),3,'Legacy source-pixel outlines are scaled to native');
close(spriteOutlinePixels({outline:0},80,80,320),0,'Legacy outline off remains off');
close(spriteOutlinePixels({},80,80,320),0,'No outline selected');
assert.throws(()=>spriteOutlinePixels(studioStyle,0,80,320),RangeError);

// Render one isolated character pixel. At default settings it has a single
// battlefield-pixel black edge, not the large 12px solid halo from the bug.
const width=41,height=41,cx=20,cy=20;
const source=new Uint8Array(width*height*4),out=new Uint8ClampedArray(source.length);
const offset=(cy*width+cx)*4;
source[offset]=220;source[offset+1]=170;source[offset+2]=80;source[offset+3]=255;
quantizeRgba(source,width,height,out,{
  flipY:false,transparent:true,
  outline:spriteOutlinePixels(studioStyle,80,80,320)
});
let outlineCount=0;
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const alpha=out[(y*width+x)*4+3];
  if(!alpha || (x===cx&&y===cy))continue;
  outlineCount++;
  assert.ok(Math.abs(x-cx)+Math.abs(y-cy)===1,
    `Black pixel at ${x},${y} exceeds the one-pixel outline`);
}
assert.equal(outlineCount,4,'One-pixel outline has four cardinal neighbors');

const renderer=fs.readFileSync(new URL('../js/combat-mob-renderer.mjs',import.meta.url),'utf8');
assert.ok(renderer.includes('outline:spriteOutlinePixels(style,frame.width,nativeWidth,frame.width)'),
  'Full-resolution source images keep correctly scaled outline');
assert.ok(renderer.includes('outline:spriteOutlinePixels(style,nativeWidth,nativeWidth,frame.width)'),
  'Native combat sprites get a separate, native-width outline');
assert.ok(renderer.includes('preserveThinSpriteDetails(sourceTopDown'),
  'Outline fix must retain thin weapon downsampling');
console.log('PASS Rev 120: native combat outline width, legacy settings, no huge black halo');
