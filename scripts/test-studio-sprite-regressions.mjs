import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preserveThinSpriteDetails} from '../js/studio-thin-detail.mjs';
// Studio storage is scoped to the current page URL.
globalThis.location = {href:'https://example.test/candidate/3d-studio.html'};
const {studioDraftImageNames} = await import('../js/sprite-set-store.mjs');

const faces=['E','NE','NW','W','SW','SE'];
const poses=['ready','attack','prone'];
const manifest={
  sheet:{file:'sheet.png'},
  poses:Object.fromEntries(poses.map(pose=>[pose,{frames:
    Object.fromEntries(faces.map(face=>[face,`${pose}-${face}.png`]))}])),
  battlefield:{poses:Object.fromEntries(poses.map(pose=>[pose,{frames:
    Object.fromEntries(faces.map(face=>[face,`battle-${pose}-${face}.png`]))}]))}
};
const files=studioDraftImageNames(manifest,true);
assert.equal(files.length,37,'All 18 studio images, 18 battlefield images and sprite sheet must be saved');
assert.equal(new Set(files).size,37);
assert.ok(files.includes('battle-ready-E.png'),'Native battle sprite is saved, not only editor frame');
assert.equal(studioDraftImageNames({...manifest,battlefield:undefined},false).length,18,
  'Old drafts without native runtime PNGs remain supported');
assert.throws(()=>studioDraftImageNames({...manifest,
  battlefield:{poses:manifest.poses}},false),/duplicate/i);

// Each six-facing atlas tile has one thin, opaque diagonal segment of the
// sword. The downsampler produces fractional alpha that VGA quantization would
// discard. Coverage rescue must keep every facing independently.
const sw=12,sh=12,tw=4,th=4;
const src=new Uint8ClampedArray(sw*3*sh*2*4);
const dst=new Uint8ClampedArray(tw*3*th*2*4);
for(let f=0;f<6;f++){
  const fx=f%3,fy=Math.floor(f/3);
  for(let cell=0;cell<4;cell++){
    const x=fx*sw+cell*3+1,y=fy*sh+cell*3+1;
    const p=(y*sw*3+x)*4;
    src[p]=200; src[p+1]=190; src[p+2]=170; src[p+3]=255;
    const d=((fy*th+cell)*tw*3+fx*tw+cell)*4;
    dst[d+3]=60; // Antialiased subpixel blade that would be erased.
  }
}
const output=preserveThinSpriteDetails(src,sw,sh,dst,tw,th);
assert.equal(output,dst,'Coverage rescue updates only the destination');
for(let f=0;f<6;f++)for(let cell=0;cell<4;cell++){
  const p=((Math.floor(f/3)*th+cell)*tw*3+(f%3)*tw+cell)*4;
  assert.ok(dst[p+3]>=192,'Thin weapon segment survives alpha clipping');
  assert.equal(dst[p],200);
}
assert.equal(src.filter((value,index)=>index%4===3 && value===255).length,24,
  'Source framebuffer remains untouched');
const haze=new Uint8ClampedArray(src.length);
const dim=new Uint8ClampedArray(dst.length);
haze[3]=100;
preserveThinSpriteDetails(haze,sw,sh,dim,tw,th);
assert.equal(dim[3],0,'Sub-threshold antialias haze does not become a new pixel');

const capture=readFileSync('js/studio-capture.mjs','utf8');
const studio=readFileSync('js/3d-studio.mjs','utf8');
const studioPage=readFileSync('3d-studio.html','utf8');
const gamePage=readFileSync('index.html','utf8');
assert.ok(studioPage.includes('Candidate Rev 199') &&
  studioPage.includes('js/3d-studio.mjs?v=R238C199') &&
  studio.includes('./studio-capture.mjs?v=R238C199'),
  'Candidate Studio must load current capture code rather than stale cached modules');
assert.ok(gamePage.includes('Candidate Rev 199') &&
  gamePage.includes('"candidateRevision":199') &&
  gamePage.includes('js/sprite-set-runtime.mjs?v=R238C196'),
  'Candidate game label, metadata and sprite loader must agree on Rev 199');

assert.ok(capture.includes('function invalidateCaptures(')&&
  capture.includes('capture.stale = true')&&
  capture.includes('button.disabled = busy;'),
  'Changed visuals remain visible but outdated captures cannot go to combat');
assert.ok(capture.includes("if (busy) return;"),
  '3D Studio combat test accepts incomplete pose captures');
assert.ok(!capture.includes("if (busy || freshCount() !== 18) return;"),
  'Old 18-frame guard cannot block the five-pose combat handoff');
assert.ok(studio.includes("state.playing = restoreSettings ? !!restoreSettings.playing : false"),
  'Newly loaded animations start paused; a restored workspace keeps its own playback state');
assert.ok(studio.includes('poseCapture?.invalidateCaptures(\'Lighting changed\')') &&
  !studio.includes("poseCapture?.invalidateCaptures('Weapon or grip changed',{allProfiles:false})"),
  'Lighting invalidates captures; equipment edits preserve independent pose snapshots');
assert.ok(studio.includes('preserveThinSpriteDetails(supersampleImage.data'),
  'Native battlefield rendering includes coverage-safe downsampling');
console.log('PASS Rev 118: 36 captured/runtime PNGs, thin swords in all six directions, stale capture protection, paused default');

assert.ok(capture.includes('capturesByProfile')&&capture.includes('partialPoses:true'));

assert.ok(studioPage.includes('id="studioActionPose"') &&
  studioPage.includes('id="studioCaptureSelectedPoseButton"'),
  'Studio must expose selectable action poses and a dedicated record button');
assert.ok(capture.includes("if(includeQaSheet)jobs.push") &&
  capture.includes("packageFiles(exported,{includeQaSheet:false})"),
  'Combat and profile export must not package the QA-only sprite sheet');
assert.ok(capture.includes("capture(pose)") &&
  capture.includes("settings.selectedActionPose"),
  'Selected action pose must be captured and persist in workspace metadata');
