import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sunPosition,shadowProjection,normalizeSunHour,sunDescription,shadowMask,drawUnitShadow,unitSun,findShadowFootLine,shadowFootLine} from '../js/unit-sun-shadow.mjs';
import {CAMERA_ELEVATION} from '../js/studio-core.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
assert.equal(normalizeSunHour(undefined),12);assert.equal(normalizeSunHour(null),12);
assert.equal(normalizeSunHour('garbage'),12);assert.equal(normalizeSunHour(24),0);assert.equal(normalizeSunHour(-1),23);
for(const hour of [0,5.75,6,18,23.75]){assert.equal(sunPosition(hour).daylight,false);assert.equal(sunPosition(hour).opacity,0);}
close(sunPosition(12).elevation,60);close(sunPosition(12).groundX,0);
assert.ok(sunPosition(9).groundX<0);assert.ok(sunPosition(15).groundX>0);
close(sunPosition(9).groundX,-sunPosition(15).groundX);
assert.ok(Math.hypot(sunPosition(7).groundX,sunPosition(7).groundZ)>Math.hypot(sunPosition(12).groundX,sunPosition(12).groundZ));
for(let hour=0;hour<24;hour+=0.03125){
 const sun=shadowProjection(hour);assert.ok(Object.values(sun).every(v=>typeof v!=='number'||Number.isFinite(v)));
 assert.ok(Math.hypot(sun.groundX,sun.groundZ)<=6+1e-9);
 assert.ok(sun.opacity>=0&&sun.opacity<=0.45);
 // A point one world unit above its foot projects by -sun.x/y and -sun.z/y.
 if(sun.daylight){close(-Math.cos(CAMERA_ELEVATION)*sun.shearX,sun.groundX);close(-Math.cos(CAMERA_ELEVATION)*sun.shearY,sun.groundZ*Math.sin(CAMERA_ELEVATION));}
}
assert.match(sunDescription(9),/^09:00/);assert.match(sunDescription(23.75),/23:45.*below horizon/);

const canvases=[];
globalThis.document={createElement(tag){assert.equal(tag,'canvas');const operations=[];
 const ctx={getImageData:()=>({data:canvas.rgba||new Uint8ClampedArray(canvas.width*canvas.height*4)}),drawImage(...args){operations.push(['image',...args]);},fillRect(...args){operations.push(['fill',...args]);}};
 const canvas={width:0,height:0,operations,getContext(){return ctx;},ctx};canvases.push(canvas);return canvas;}};
const source=Object.freeze({naturalWidth:160,naturalHeight:200});
const mask=shadowMask(source);assert.equal(mask.width,160);assert.equal(mask.height,200);
assert.equal(mask.ctx.globalCompositeOperation,'source-in');assert.equal(mask.operations[0][1],source);
assert.equal(shadowMask(source),mask,'Static sprite masks are reused');
const atlas=Object.freeze({width:240,height:200});
const tile={sx:80,sy:100,sw:80,sh:100,revision:1};
assert.equal(shadowMask(atlas,tile),shadowMask(atlas,tile));
assert.notEqual(shadowMask(atlas,tile),shadowMask(atlas,{...tile,revision:2}),'New poses invalidate alpha masks');
let transforms=[],draws=[];
const ctx={globalAlpha:1,save(){},restore(){this.globalAlpha=1;},transform(...v){transforms.push(v);},drawImage(...v){draws.push(v);}};
for(const flip of [false,true])drawUnitShadow(ctx,source,{x:20,y:30,width:80,height:100,anchorX:0.4,anchorY:0.65,flip,hour:9});
assert.equal(draws.length,2);assert.deepEqual(transforms[0].slice(2),transforms[1].slice(2),'Flipping the unit cannot rotate the sun');
assert.equal(transforms[0][0],1);assert.equal(transforms[1][0],-1);
assert.deepEqual(draws[0].slice(1),[-32,-65,80,100],'Uses the exact sprite anchor and dimensions');
drawUnitShadow(ctx,source,{x:20,y:30,width:80,height:100,hour:0});assert.equal(draws.length,2,'No solar shadow at night');

// Wide stance: the back foot is well above the front foot in the source frame.
// The shared transform must leave BOTH contact pixels at their sprite locations.
const w=40,h=50,rgba=new Uint8ClampedArray(w*h*4);
function rect(x0,y0,x1,y1){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)rgba[(y*w+x)*4+3]=255;}
rect(13,5,27,27);rect(6,25,12,36);rect(27,25,33,44);
const feet=findShadowFootLine(rgba,w,h);
assert.equal(feet.contacts.length,2);close(feet.contacts[0].y,35.5);close(feet.contacts[1].y,43.5);
const stance=Object.freeze({width:w,height:h});shadowMask(stance).rgba=rgba;
assert.deepEqual(shadowFootLine(shadowMask(stance)),feet);
for(const hour of [7,9,12,15,17])for(const flip of [false,true])for(const scale of [0.5,1,2.4]){
 transforms=[];draws=[];
 drawUnitShadow(ctx,stance,{x:80,y:120,width:w*scale,height:h*scale,anchorX:0.43,anchorY:0.62,hour,flip});
 const [a,b,c,d,e,f]=transforms[0];
 for(const contact of feet.contacts){
  const u=(contact.x-w*0.43)*scale,v=(contact.y-h*0.62)*scale;
  close(a*u+c*v+e,80+(flip?-u:u));close(b*u+d*v+f,120+v);
 }
}
close(sunPosition(12).opacity,0.45);

const inputs=[{},{}],outputs=[{},{}],callbacks=[];
for(const input of inputs)input.addEventListener=(_name,callback)=>{callbacks.push(callback);};
unitSun.bind(inputs[0],outputs[0]);unitSun.bind(inputs[1],outputs[1]);
inputs[0].value='15.25';callbacks[0]();assert.equal(inputs[1].value,'15.25');assert.match(outputs[1].textContent,/15:15/);

// Exercise the production sprite ground pass: exact facing, pose, scale and
// anchor, without drawing the body twice or revealing invisible units.
const engine=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const a=engine.indexOf('function drawSpriteFacing('),b=engine.indexOf('function clearCombatMessage(',a);
const calls=[];
const sandbox={ctx:{save(){},restore(){},translate(){},scale(){},drawImage(){calls.push('body');}},
 adventurePartySun:{drawingGround:true,draw(_ctx,image,options){calls.push({image,options});}},
 unitPoseDefinition:()=>null,enlargeVisualScale:()=>2,getUnitEffect:()=>null,
 activeEnlargeTransitionFx:()=>null,activeCastingGlowFx:()=>null,console};
vm.runInNewContext(engine.slice(a,b),sandbox);
const image={complete:true,naturalWidth:160,naturalHeight:200};
sandbox.drawSpriteFacing(image,{x:50,y:60},80,100,'left','right',{}, {x:0.4,y:0.65});
assert.equal(calls.length,1);assert.equal(calls[0].image,image);assert.equal(calls[0].options.width,160);assert.equal(calls[0].options.height,200);
assert.equal(calls[0].options.flip,true);assert.equal(calls[0].options.anchorY,0.65);
sandbox.getUnitEffect=()=>({});sandbox.drawSpriteFacing(image,{x:0,y:0},80,100,'left');assert.equal(calls.length,1,'Invisible units have no revealing ground silhouette');
sandbox.getUnitEffect=()=>null;sandbox.adventurePartySun.drawingGround=false;sandbox.drawSpriteFacing(image,{x:0,y:0},80,100,'left');assert.equal(calls.at(-1),'body');
assert.ok(engine.indexOf('if(actor.unit)actor.fn()')<engine.lastIndexOf('  actors.sort('),'Shadows are beneath depth-sorted actors');
const studio=readFileSync(new URL('../js/3d-studio.mjs',import.meta.url),'utf8');
const capture=readFileSync(new URL('../js/studio-capture.mjs',import.meta.url),'utf8');
assert.ok(studio.includes('if(sunShadowMesh)sunShadowMesh.visible=false;'),'3D ground shadow is excluded from the capture atlas');
assert.ok(studio.includes('sunHour:unitSun.hour'));
assert.ok(capture.includes("target.searchParams.set('sunHour',String(unitSun.hour))"));
const handler=studio.slice(studio.indexOf("unitSun.bind($('studioSunHour')"),studio.indexOf('  for (const [name, key, divisor]'));
assert.ok(handler.includes('saveWorkspace()'));assert.ok(!handler.includes('invalidateCaptures'));
console.log('PASS sun arc, horizon/night bounds, fixed world direction, alpha-mask reuse, shared controls, terrain-only pass, invisibility and shadow-free capture data');

const keyStart=engine.indexOf('function handleCombatKey('),keyEnd=engine.indexOf('function handleCombatConditionsKey(',keyStart);
const keySandbox={};vm.runInNewContext(engine.slice(keyStart,keyEnd),keySandbox);
for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End',' ','q','e','+']){
 keySandbox.handleCombatKey({key,target:{id:'combatSunHour'},preventDefault(){throw new Error('Native slider input was consumed');}});
}
