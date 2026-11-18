// Native SpeedTree Beech exports through the established maple/oak converter.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const root=__dirname,templates=path.join(root,'../sugar-maple'),dest=path.join(root,'runtime');
let code=fs.readFileSync(path.join(templates,'package-maple.cjs'),'utf8')
 .replace("[['Green',43352],['Fall',43352],['Winter',13162]]","[['Green',37684],['Fall',37684],['Winter',12188]]")
 .replaceAll('SugarMaple_Leaf_','Beech_Leaf_').replaceAll('SugarMaple','AmericanBeech')
 .replaceAll('maple-','beech-').replaceAll('Sugar maple','American beech').replaceAll('<.00002','<.0001');
vm.runInNewContext(code,{require,Buffer,__dirname:root,console});
let balanced=fs.readFileSync(path.join(templates,'build-balanced-maple.cjs'),'utf8')
 .replace("assets=path.join(repo,'assets/terrain/sugar-maple'),dest=path.join(root,'balanced')",'assets='+JSON.stringify(dest)+',dest=assets')
 .replaceAll('SugarMaple','AmericanBeech').replaceAll('Sugar Maple','American Beech').replaceAll('maple-','beech-')
 .replaceAll('13162','12188').replaceAll('12782','10794').replaceAll('25944','22982').replaceAll('43352','37684');
vm.runInNewContext(balanced,{require,Buffer,__dirname:root,console});
let matching=fs.readFileSync(path.join(templates,'build-matching-wood.mjs'),'utf8').replaceAll('SugarMaple','AmericanBeech').replaceAll('maple-','beech-');
fs.writeFileSync(path.join(root,'build-matching-wood.mjs'),matching);
cp.execFileSync(process.execPath,[path.join(root,'build-matching-wood.mjs')],{stdio:'inherit'});
// Preserve the portrait leaf proportions: 13 cm card height, ~10 cm blade.
const cardPath=path.join(dest,'beech-particle-leaf.gltf'),g=JSON.parse(fs.readFileSync(cardPath)),b=fs.readFileSync(path.join(dest,g.buffers[0].uri));
const h=.065,w=h*911/1726;
[-w,-h,0,w,-h,0,w,h,0,-w,h,0].forEach((v,i)=>b.writeFloatLE(v,i*4));
g.accessors[0].min=[-w,-h,0];g.accessors[0].max=[w,h,0];g.extras.cardWidthMetres=2*w;g.extras.cardHeightMetres=.13;
fs.writeFileSync(path.join(dest,g.buffers[0].uri),b);fs.writeFileSync(cardPath,JSON.stringify(g));
