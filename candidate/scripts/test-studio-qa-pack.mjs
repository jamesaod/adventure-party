import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readHumanoidQaPack, QA_PACK_FORMAT } from '../js/studio-qa-pack.mjs';
const manifest = {
  format: QA_PACK_FORMAT, version: 1,
  models:[
    {id:'new-carl',label:'New Carl',path:'models/new-carl.glb',mobType:'fighter',upAxis:'Y'},
    {id:'new-orc',label:'New Orc',path:'models/new-orc.glb',mobType:'orc',upAxis:'Y'}
  ],
  animations:[{label:'Sword and Shield Idle',path:'animations/sword-and-shield-idle.fbx'}]
};
const glb=Buffer.alloc(20);glb.write('glTF');
const fbx=Buffer.concat([Buffer.from('Kaydara FBX Binary','ascii'),Buffer.alloc(20)]);
function zip(files){
  const local=[],central=[];let position=0;
  for(const [name,value] of files){
    const filename=Buffer.from(name),data=Buffer.from(value);
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);
    header.writeUInt16LE(0,8);header.writeUInt32LE(data.length,18);
    header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
    local.push(header,filename,data);
    const directory=Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50,0);
    directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);
    directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);
    directory.writeUInt16LE(filename.length,28);
    directory.writeUInt32LE(position,42);
    central.push(directory,filename);
    position+=header.length+filename.length+data.length;
  }
  const end=Buffer.alloc(22),directory=Buffer.concat(central);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(position,16);
  return Buffer.concat([...local,directory,end]);
}
const files=[
  ['adventure-party-qa-pack.json',Buffer.from(JSON.stringify(manifest))],
  ['models/new-carl.glb',glb],['models/new-orc.glb',glb],
  ['animations/sword-and-shield-idle.fbx',fbx]
];
const pack=zip(files);
const result=await readHumanoidQaPack(new File([pack],'test-pack.zip'));
assert.equal(result.modelCount,2);
assert.equal(result.animationCount,1);
assert.deepEqual([...result.files.keys()],
  ['models/new-carl.glb','models/new-orc.glb','animations/sword-and-shield-idle.fbx']);
assert.equal(result.files.get('models/new-orc.glb').size,glb.length);
assert.equal(result.files.get('animations/sword-and-shield-idle.fbx').size,fbx.length);
const malformed=zip([...files.slice(0,3),['animations/../bad.fbx',fbx]]);
await assert.rejects(readHumanoidQaPack(new File([malformed],'bad.zip')),/Unsafe\/duplicate path/);
console.log('PASS QA pack ZIP import: two models, FBX animations, safe archive paths and native binary preservation');
