// Staging only. Native exports remain intact; runtime seasons share Green LOD1 wood.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const root=__dirname,repo='C:/Users/james/Documents/Codex/2026-10-26/continue-development-of-adventure-party-using/work/repo',dest=path.join(root,'runtime');
fs.mkdirSync(dest,{recursive:true});
const template=fs.readFileSync(path.join(repo,'tools/tree-production/historical-scripts/integrate-oak.cjs.txt'),'utf8').split('const backup=')[0];
for(const season of ['Green','Fall']){
 let code=template.replace("const dest=path.join(repo,'assets/terrain/white-oak')",'const dest='+JSON.stringify(dest)).replace('ground=.20','ground=0').replaceAll('Oak_FullCrown_LOD5.obj',`SweetBirch_${season}_LOD1.obj`).replaceAll('oak-10726','birch-'+season.toLowerCase()).replace('assert.equal(total,10726)','assert.equal(total,19676)').replaceAll('White oak full crown 10726','Sweet birch '+season).replace("'WhiteOak_'+name","'SweetBirch_'+(foliage?'Leaf_':'')+name").replace("'provenance.json'",`'provenance-${season.toLowerCase()}.json'`).replaceAll('WhiteOak_FullCrown.spm',`SweetBirch_${season}.spm`).replace('Ground 0.20 m above authored trunk origin','Native ground at authored Z=0');
 vm.runInNewContext(code,{require,Buffer,__dirname:root,console});
}
// Native leaf-hidden LOD1 removes 18 twig triangles. Retain the exact leafy wood instead.
const green=JSON.parse(fs.readFileSync(path.join(dest,'birch-green.gltf'))),winter=structuredClone(green),bytes=fs.readFileSync(path.join(dest,green.buffers[0].uri));
assert(green.materials[0].name.includes('Bark'));
const woodBytes=bytes.subarray(0,green.bufferViews[0].byteLength);
winter.meshes[0].primitives=winter.meshes[0].primitives.slice(0,1);winter.materials=winter.materials.slice(0,1);winter.bufferViews=winter.bufferViews.slice(0,1);winter.accessors=winter.accessors.slice(0,3);winter.images=winter.images.slice(0,2);winter.textures=winter.textures.slice(0,2);
winter.nodes[0].name='Sweet birch winter';winter.buffers=[{uri:'birch-winter.bin',byteLength:woodBytes.length}];winter.extras={woodSource:'SweetBirch_Green_LOD1.obj',nativeWinterSource:'SweetBirch_Winter.spm',reason:'Preserve all 7958 wood triangles identically across seasons'};
fs.writeFileSync(path.join(dest,'birch-winter.bin'),woodBytes);fs.writeFileSync(path.join(dest,'birch-winter.gltf'),JSON.stringify(winter));
let balanced=fs.readFileSync(path.join(root,'../sugar-maple/build-balanced-maple.cjs'),'utf8').replace("assets=path.join(repo,'assets/terrain/sugar-maple'),dest=path.join(root,'balanced')",'assets='+JSON.stringify(dest)+',dest=assets').replaceAll('SugarMaple','SweetBirch').replaceAll('Sugar Maple','Sweet Birch').replaceAll('maple-','birch-').replaceAll('13162','7958').replaceAll('12782','4960').replaceAll('25944','12918').replaceAll('43352','19676');
vm.runInNewContext(balanced,{require,Buffer,__dirname:root,console});
let limbs=fs.readFileSync(path.join(repo,'tools/tree-production/historical-scripts/build-fall-assets.cjs.txt'),'utf8').split('// Recover connected')[1];
limbs='const fs=require("fs"),path=require("path"),dest='+JSON.stringify(dest)+';\n// Recover connected'+limbs;
limbs=limbs.replaceAll('WhiteOak_Winter.obj','SweetBirch_Green_LOD1.obj').replaceAll('WhiteOak_Winter.spm','SweetBirch_Green.spm').replaceAll('Bark_Base_Mat','Maple_Bark_1_Mat').replaceAll('Bark_Base_Color.png','Maple_Bark_1_Color.png').replaceAll('Bark_Base_Normal.png','Maple_Bark_1_Normal.png').replaceAll('WhiteOak_debris_Bark','SweetBirch_debris_Bark').replaceAll('oak-detached-limbs','birch-detached-limbs').replaceAll('center[2]-.2','center[2]').replaceAll('Oak_detached','Birch_detached');
vm.runInNewContext(limbs,{require,Buffer,__dirname:root,console});
const matching=fs.readFileSync(path.join(root,'../sugar-maple/build-matching-wood.mjs'),'utf8').replaceAll('SugarMaple','SweetBirch').replaceAll('maple-','birch-');
fs.writeFileSync(path.join(root,'build-matching-wood.mjs'),matching);cp.execFileSync(process.execPath,[path.join(root,'build-matching-wood.mjs')],{stdio:'inherit'});
for(const season of ['Green','Fall'])fs.copyFileSync(path.join(root,`Birch_Leaf_${season}.png`),path.join(dest,`Birch_Leaf_${season}.png`));
const card=JSON.parse(fs.readFileSync(path.join(repo,'assets/terrain/white-oak/oak-fall-particle-leaf.gltf'))),bin=fs.readFileSync(path.join(repo,'assets/terrain/white-oak/oak-fall-particle-leaf.bin')),h=.065,w=h*1086/1448;
[-w,-h,0,w,-h,0,w,h,0,-w,h,0].forEach((v,i)=>bin.writeFloatLE(v,i*4));[0,1,1,1,1,0,0,0].forEach((v,i)=>bin.writeFloatLE(v,96+i*4));
card.buffers[0].uri='birch-particle-leaf.bin';card.images[0].uri='Birch_Leaf_Fall.png';card.nodes[0].name='Sweet birch individual leaf';card.materials[0].name='SweetBirchParticleLeaf';card.materials[0].pbrMetallicRoughness.baseColorFactor=[.5,.5,.5,1];card.accessors[0].min=[-w,-h,0];card.accessors[0].max=[w,h,0];card.extras={source:'Birch_Leaf_Fall.png; same artwork as native cluster',cardHeightMetres:.13,cardWidthMetres:w*2,nominalBladeMetres:.10};
fs.writeFileSync(path.join(dest,'birch-particle-leaf.bin'),bin);fs.writeFileSync(path.join(dest,'birch-particle-leaf.gltf'),JSON.stringify(card));
for(const file of fs.readdirSync(dest).filter(f=>f.endsWith('.gltf'))){const g=JSON.parse(fs.readFileSync(path.join(dest,file)));for(const b of [...g.buffers,...g.images])assert(fs.existsSync(path.join(dest,b.uri)),file+' missing '+b.uri);}
console.log('Packaged Sweet Birch: 12918 leafy / 7958 bare triangles, matching wood, eight limbs, species leaf.');
