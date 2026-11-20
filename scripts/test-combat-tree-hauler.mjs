import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {extractCombatFunction} from './combat-test-source.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('js/combat-tree-hauler.js');
const orc=()=>({id:Math.random()+'',repositoryMobId:'orc-warrior',controller:'mob',alive:true,heightInches:192,hp:48,maxHp:48,inventory:[{slot:'weapon',equipped:true},{slot:'shield',equipped:true}]});
const first=orc(),second=orc(),context={game:{session:{source:'combat-test'},condition:'grass',enemies:[first,second]},syncFighterEquipment(){},HEX_DIRS:[{x:1,y:0},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:-1}]};vm.createContext(context);vm.runInContext(source,context);context.configureTreeHauler(first);assert.equal(first.heightInches,192);assert.equal(first.hp,48);assert.equal(first.maxHp,48);assert.equal(second.hp,48);assert(first.inventory.every(i=>!i.equipped));
for(let i=0;i<6;i++){const d=context.HEX_DIRS[i];assert.equal(context.treeHaulerPushDirection({x:2,y:3},{x:2+d.x,y:3+d.y}),i);}
let ended=0;Object.assign(context,{game:{active:first.id,enemies:[first],testTrees:[],over:false},searchRotatingFootprintPath:()=>({path:[],value:null}),setUnitActionBanner(){},endTurn(){ended++;},console,log(){}});assert.equal(await context.treeHaulerTurn(first),true);assert.equal(ended,1,'An unavailable tree consumes the AI turn, never falls through to combat');first.treeHauler.stage='armed';assert.equal(await context.treeHaulerTurn(first),false);assert.equal(ended,1,'Armed units return to normal combat AI');
const state={obstacleCapsules:[{piece:'continuous-oak-trunk',a:{x:0,y:0},b:{x:100,y:0},radius:5}]};Object.assign(context,{HEX_W:20,oakWorldPoint:p=>p});const goal=context.treeHaulerPickupGoal(first,state);assert(goal({x:50,y:20}));assert(!goal({x:0,y:20}),'Pickup requires the center of the trunk, not its distant end');
const navigation=extractCombatFunction(read('js/combat-environment-state.js'),'prepareOakFallNavigation');let queries=[];
const nav={game:{},HEX_DIRS:context.HEX_DIRS,allUnits:()=>[],activeCombatTerrainTileSet:()=>({treeDrawHeight:210,treeRotationFrames:12}),oakWorldPoint:p=>p,terrainHash:()=>0,occupiedHexes:u=>[u],combatTreeCollision:(_base,_season,angle)=>{queries.push(angle);return {canopyRadius:1,capsules:[{piece:'continuous-oak-trunk',ax:0,az:0,bx:0,bz:3,radius:.1}]};},oakBlockedCells:()=>new Set(),oakCapsuleHitsCell:()=>true};vm.createContext(nav);vm.runInContext(extractCombatFunction(read('js/adventure-party.js'),'treeYawDegrees')+'\n'+navigation,nav);assert(nav.prepareOakFallNavigation({x:0,y:0,tileIndex:5},{direction:0}));assert.equal(queries.length,2);queries=[];nav.allUnits=()=>[{alive:true}];assert.equal(nav.prepareOakFallNavigation({x:0,y:0,tileIndex:5},{direction:0}),null);assert.equal(queries.length,2,'A blocked forced direction never falls back toward another side');
const melee=extractCombatFunction(read('js/combat-melee-actions.js'),'attack');const attackContext={window:{AdventurePartyCombatResults:{physical(){throw Error('Must not attack while seeking a tree');}}}};vm.createContext(attackContext);vm.runInContext(melee,attackContext);assert.equal((await attackContext.attack({treeHauler:{stage:'pickup'}},{})).blockedByObjective,true);
console.log('PASS tree AI preserves authored height and HP, exclusive objective, six away directions, center-log reach, blocked fall rejection and no premature attacks');

// Single-material wood has no geometry groups; turning it into an array hides it.
const T=await import('../assets/vendor/three/three.module.min.js');
const cloneTreeLogObject=vm.runInNewContext('('+extractCombatFunction(read('js/tree-hauler-presentation.mjs').replace(/^export /gm,''),'cloneTreeLogObject')+')');
const wood=new T.Group(),piece=new T.Mesh(new T.BoxGeometry(1,4,1),new T.MeshStandardMaterial());piece.geometry.clearGroups();wood.add(piece);wood.visible=false;
const held=cloneTreeLogObject(wood);assert(held.visible);assert(!Array.isArray(held.children[0].material));assert.notEqual(held.children[0].geometry,piece.geometry);assert.notEqual(held.children[0].material,piece.material);
console.log('PASS carried trunk keeps renderable materials and independent geometry');

// Exercise the real turn entry point; calling the objective helper alone missed
// an earlier integration bug in which it was wired into a ranged-attack helper.
const turn=extractCombatFunction(read('js/adventure-party.js'),'mobTurn');
const actor={id:'treebreaker',controller:'mob',alive:true,treeHauler:{stage:'seek'}};
const events=[];const entry={game:{active:actor.id,over:false},treeHaulerTurn:async u=>{assert.equal(u,actor);events.push('tree');return true;},selectCombatAiWeapon:()=>{throw Error('Combat selection bypassed tree priority');}};
vm.createContext(entry);vm.runInContext(turn,entry);await entry.mobTurn(actor);assert.deepEqual(events,['tree']);
actor.alive=false;await entry.mobTurn(actor);assert.equal(events.length,1,'Dead actors cannot start the tree objective');
console.log('PASS main mob turn dispatches tree objective before combat targeting');

const {treeTrunkClubItem,fitTreeTrunkClub}=await import('../js/tree-trunk-club.mjs');
const club=treeTrunkClubItem();assert.equal(club.catalogItemId,'tree-trunk-club');assert.equal(club.catalogWeaponId,'club');assert.equal(club.handsRequired,2);assert.equal(club.weaponPoseProfileId,'two-handed-swing');
const trunkSource=new T.Group();trunkSource.scale.setScalar(.01);trunkSource.rotation.x=Math.PI/2;
const trunkPart=new T.Mesh(new T.CylinderGeometry(10,10,100,8,20),new T.MeshStandardMaterial());trunkPart.position.set(30,50,20);trunkSource.add(trunkPart);
const fitted=fitTreeTrunkClub(T,trunkSource,4),bounds=new T.Box3().setFromObject(fitted);
assert(Math.abs(bounds.max.y-bounds.min.y-4)<1e-5);assert(Math.abs(bounds.min.y+.6)<1e-5);
assert(Math.abs((bounds.min.x+bounds.max.x)/2)<1e-5);assert(Math.abs((bounds.min.z+bounds.max.z)/2)<1e-5);
console.log('PASS harvested club retains physical length, palm-centered grip and two-handed combat rules');

const debrisContext={oakDebrisSettled:s=>s.settled};vm.createContext(debrisContext);
vm.runInContext(extractCombatFunction(read('js/combat-environment-state.js'),'treeDebrisCapsulesForMover'),debrisContext);
const debris={settled:true,obstacleCapsules:[{piece:'Maple_detached_limb_1'},{piece:'continuous-oak-trunk'},{piece:'matching-oak-stump'}],reservationCapsules:[{piece:'fall-sweep'}]};
assert.equal(debrisContext.treeDebrisCapsulesForMover(debris,{}).length,1);
assert.deepEqual(Array.from(debrisContext.treeDebrisCapsulesForMover(debris,{treeHauler:{}}),p=>p.piece),['continuous-oak-trunk']);
debris.logTaken=true;assert.equal(debrisContext.treeDebrisCapsulesForMover(debris,{}).length,0);debris.logTaken=false;debris.settled=false;assert.equal(debrisContext.treeDebrisCapsulesForMover(debris,{treeHauler:{}})[0].piece,'fall-sweep');
console.log('PASS All units step over settled branches; only uncollected trunks block; falling-tree safety remains');

const {harvestedTreeClubScale,TREE_CLUB_LENGTH_METRES,TREE_CLUB_SCALE}=await import('../js/tree-trunk-club.mjs');
const sourceLength=TREE_CLUB_LENGTH_METRES/TREE_CLUB_SCALE;
for(const length of [1,2.5,6,12])assert(Math.abs(harvestedTreeClubScale(length)*sourceLength-length)<1e-9);
assert.equal(harvestedTreeClubScale(4,150),harvestedTreeClubScale(4)*2);
assert.throws(()=>harvestedTreeClubScale(0));
console.log('PASS harvested trunk size tracks source tree and respects Workshop size adjustment');

const {treeClubUsesOffHand}=await import('../js/tree-trunk-club.mjs');
const carrier={alive:true,carriedTreeLog:{}};
for(const slot of ['idle','move','death','tree-action'])assert.equal(treeClubUsesOffHand(carrier,slot),false);
assert.equal(treeClubUsesOffHand(carrier,'two-handed-swing'),true);
assert.equal(treeClubUsesOffHand({...carrier,alive:false},'two-handed-swing'),false);
assert.equal(treeClubUsesOffHand({...carrier,treeInteraction:{}},'two-handed-swing'),false);
console.log('PASS one-handed idle/movement carry, two-handed attack, and released off-hand on death/pickup');
