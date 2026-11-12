import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newDraft,assignClip} from '../js/mob-workshop-core.mjs';
import {createWorkshopUnit} from '../js/workshop-unit-package.mjs';
const b=readFileSync('assets/models/orcs/male-orc/male-orc.glb'),sha=createHash('sha256').update(b).digest('hex'),id='workshop-runtime-fixture';
const d=newDraft(); d.name='Workshop runtime fixture';d.model={id:'fixture',file:'orc.glb'};d.checks={ground:true,equipment:true};
d.inventoryItems=[{id:'long-sword',quantity:1,location:'main-hand'},{id:'shield-orc',quantity:1,location:'off-hand'}];
d.clips=[{id:'clip',name:'Binding fixture',duration:2,data:{duration:2,tracks:[{name:'mixamorigHips.quaternion',type:'quaternion',times:[0,1,2],values:[0,0,0,1,0,.1,0,.994987,0,0,0,1]}]}}];
for(const slot of ['idle','move','one-handed-swing','death'])assignClip(d,slot,{clipId:'clip',start:0,end:2,speed:1,loop:false});
const file=`assets/workshop-units/${id}/${sha}.glb`;mkdirSync(`assets/workshop-units/${id}`,{recursive:true});copyFileSync('assets/models/orcs/male-orc/male-orc.glb',file);
writeFileSync('work/workshop-runtime-fixture.json',JSON.stringify(createWorkshopUnit({draft:d,files:{'model.bin':b}},{id,modelFile:file,sha256:sha})));


