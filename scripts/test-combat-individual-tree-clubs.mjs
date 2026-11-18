import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/three.module.min.js';
import {INDIVIDUAL_TREE_CLUBS,treeClubForIndividual,treeTrunkClubItem} from '../js/tree-trunk-club.mjs';
import {studioWeapon} from '../js/studio-equipment.mjs';
import {saveFit,savedFit} from '../js/mob-workshop-fit-store.mjs';
assert.equal(INDIVIDUAL_TREE_CLUBS.length,6);
assert.equal(new Set(INDIVIDUAL_TREE_CLUBS.map(c=>c.tree.sha256)).size,6);
const draft={model:{id:'hill-giant'},equipment:{main:'none'}};
for(const c of INDIVIDUAL_TREE_CLUBS){
 assert.equal(treeClubForIndividual({clubId:c.id}),c);
 assert.equal(treeTrunkClubItem(c.id).catalogItemId,c.id);
 const sourceLength=c.tree.cutTopSourceMetres-c.tree.cutBottomSourceMetres;
 assert(Math.abs(c.tree.lengthMetres-sourceLength*43.38933076913966*.18*(240/210)/(64/3.048))<1e-8,'standing tree versus calibrated MOB scale');
 const w=studioWeapon(c.id);assert(w);assert.equal(w.inchesPerLocalUnit,1/.0254);assert.equal(w.defaultSizePercent,100);assert.equal(w.nativeScale,1);
 const b=readFileSync(new URL('../'+c.appearance.asset,import.meta.url));
 assert.equal(createHash('sha256').update(b).digest('hex'),c.tree.sha256);
 const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),bounds=new T.Box3();
 function visit(i,parent){const n=j.nodes[i],m=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3(...(n.translation||[0,0,0])),new T.Quaternion(...(n.rotation||[0,0,0,1])),new T.Vector3(...(n.scale||[1,1,1])));m.premultiply(parent);if(n.mesh!=null)for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];bounds.union(new T.Box3(new T.Vector3(...a.min),new T.Vector3(...a.max)).applyMatrix4(m));}for(const child of n.children||[])visit(child,m);}
 for(const i of j.scenes[j.scene||0].nodes)visit(i,new T.Matrix4());
 assert(Math.abs(bounds.min.y-c.tree.fracturedBoundsMetres[0])<1e-5&&Math.abs(bounds.max.y-c.tree.fracturedBoundsMetres[1])<1e-5,c.id+' fractured bounds');
 assert(Math.abs(bounds.min.y+c.tree.lengthMetres*.1)<1e-5,'handle end unchanged');
 assert.equal(c.tree.breakStyle,'stump-matching-torn');
 for(const m of j.materials.filter(m=>/end grain/i.test(m.name)))assert(m.pbrMetallicRoughness.baseColorFactor[0]<.4&&m.pbrMetallicRoughness.baseColorFactor[2]<.15,'brown wood caps');
 assert(bounds.min.y<0&&bounds.max.y>0,c.id+' handle origin');assert(c.tree.triangles<2000);
 assert(j.images.every(i=>i.bufferView!=null),'textures embedded');
 draft.equipment.main=c.id;saveFit(draft,'main',{sizePercent:100+c.tree.tileIndex});
}
for(const c of INDIVIDUAL_TREE_CLUBS)assert.equal(savedFit(draft,'main',c.id).sizePercent,100+c.tree.tileIndex);
assert.throws(()=>treeClubForIndividual({species:'sugar-maple'}),'No species fallback for an unregistered individual');
console.log('PASS six distinct SpeedTree clubs, embedded assets, physical Workshop dimensions, exact pickup identities and independent saved fits');
