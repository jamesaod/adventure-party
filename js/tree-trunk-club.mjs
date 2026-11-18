import {INDIVIDUAL_TREE_CLUB_ASSETS} from './individual-tree-clubs.mjs';
// Universal SpeedTree White Oak club, source metres with a 75% test scale.
export const TREE_CLUB_ASSET='assets/models/weapons/tree-as-club/tree-as-club.glb';
export const TREE_CLUB_SCALE=.75;
export const TREE_CLUB_LENGTH_METRES=9.068420827388763;
export function harvestedTreeClubScale(lengthMetres,sizePercent=75){
 if(!Number.isFinite(lengthMetres)||lengthMetres<=0)throw Error('Invalid harvested trunk length');
 return lengthMetres/(TREE_CLUB_LENGTH_METRES/TREE_CLUB_SCALE)*(sizePercent/75);
}
export const TREE_TRUNK_CLUB={id:'tree-trunk-club',name:'Tree as Club',category:'weapon',slot:'weapon',rules:{catalogWeaponId:'club',baseName:'Club',handsRequired:2,poseProfileId:'two-handed-swing',damageType:'bludgeoning',damageSM:'1d6',damageL:'1d3',attackTypes:['B'],encumbrance:0},physical:{calibratedLengthInches:476.0325893642396,status:'White Oak central trunk at 75% source dimensions; giant carrying capacity remains provisional.'},appearance:{appearanceId:'tree-trunk-club',studioId:'tree-trunk-club',visualClass:'club',representation:'source-gltf-v1',asset:TREE_CLUB_ASSET,attachment:'right-hand',secondaryAttachment:'left-hand',handsRequired:2,poseProfileId:'two-handed-swing',primaryAxis:[0,1,0],grip:[0,0,0],secondaryGrip:[0,.5,0],nativeScale:1,defaultSizePercent:75,position:[.015,.05,.005],rotationDegrees:[-90,0,0],presetRevision:100}};
export const INDIVIDUAL_TREE_CLUBS=INDIVIDUAL_TREE_CLUB_ASSETS.map(record=>({
 ...TREE_TRUNK_CLUB,id:record.id,name:record.name,tree:record,
 physical:{calibratedLengthInches:record.lengthMetres/.0254,status:'Individual SpeedTree trunk at standing-tree combat scale.'},
 appearance:{...TREE_TRUNK_CLUB.appearance,appearanceId:record.id,studioId:record.id,asset:record.asset,
 runtimeAsset:{sha256:record.sha256},defaultSizePercent:100,secondaryGrip:record.secondaryGrip,inchesPerLocalUnit:1/.0254}
}));
export function treeClubForIndividual(tree){
 const entry=INDIVIDUAL_TREE_CLUBS.find(c=>c.id===tree?.clubId);
 if(!entry)throw Error('This individual tree has no authored club asset');
 return entry;
}
export function treeClubById(id){return INDIVIDUAL_TREE_CLUBS.find(c=>c.id===id)||TREE_TRUNK_CLUB;}
export function treeTrunkClubItem(id=TREE_TRUNK_CLUB.id){const club=treeClubById(id);return {...club.rules,name:club.name,type:'Weapon',catalogItemId:club.id,slot:'weapon',equipped:true,equippable:false,treeLog:true,weaponPoseProfileId:'two-handed-swing',startingLocation:'main-hand',qty:1};}
export function fitTreeTrunkClub(T,copy,length){
 copy.position.set(0,0,0);copy.quaternion.identity();copy.updateMatrixWorld(true);
 const parts=[];copy.traverse(o=>{if(o.isMesh)parts.push(o);});
 const root=new T.Group();root.name='Tree trunk club geometry';
 for(const part of parts){part.geometry.applyMatrix4(part.matrixWorld);part.position.set(0,0,0);part.quaternion.identity();part.scale.setScalar(1);root.add(part);}
 root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());
 // Source standing trunks run along Y. The grip uses their actual centerline,
 // not the center of a bounding box enlarged by a bend or knot elsewhere.
 const gripY=box.min.y+size.y*.15,band=Math.max(size.y*.04,1e-6);let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;
 for(const part of parts){const p=part.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-gripY)<=band){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));count++;}}
 const x=count?(minX+maxX)/2:(box.min.x+box.max.x)/2,z=count?(minZ+maxZ)/2:(box.min.z+box.max.z)/2;
 const scale=length/Math.max(size.y,1e-6),matrix=new T.Matrix4().makeScale(scale,scale,scale).multiply(new T.Matrix4().makeTranslation(-x,-gripY,-z));
 for(const part of parts){part.geometry.applyMatrix4(matrix);part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();}
 return root;
}

export function treeClubUsesOffHand(entity,slot){return !!(entity?.alive&&entity.carriedTreeLog&&!entity.treeInteraction&&slot==='two-handed-swing');}
