import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as api from '../js/exploration-encounters.mjs';
import {validateMap} from '../js/exploration-core.mjs';
const map=JSON.parse(readFileSync(new URL('../data/exploration/old-tollhouse.json',import.meta.url)));
const source=readFileSync(new URL('../js/exploration-combat-hooks.js',import.meta.url),'utf8').replace(/await import\('\.\/exploration-encounters.mjs[^']*'\)/g,'encounterApi').replace(/await import\('\.\/exploration-core.mjs[^']*'\)/g,'coreApi').replace('void startExplorationCombat();','globalThis.started=startExplorationCombat();');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function scenario({missing=false,interrupted=false}={}){
 const gate=deferred(),combat=deferred(),nodes=new Map();
 const node=tag=>({tag,textContent:'',style:{},hidden:false,children:[],setAttribute(){},append(...children){this.children.push(...children);},after(){},addEventListener(){},contains(){return false;},remove(){this.removed=true;}});
 const body=node('body');
 const request={map,event:map.encounters[0],scope:'test',test:true,returnSearch:'?test=1&map=old-tollhouse-test',openDoors:[]};
 const storage={getItem:key=>key===api.HANDOFF_KEY&&!missing?JSON.stringify(request):null};
 const context={URL,URLSearchParams,Image:class{decode(){return Promise.resolve();}},console:{error(){}},location:{search:'?explorationCombat=1',href:'http://test/index.html?explorationCombat=1'},document:{body,createElement:node,getElementById:id=>nodes.get(id)},sessionStorage:storage,localStorage:storage,window:{adventurePartyGameStartup:{ready:gate.promise},adventurePartyRepositoryMobs:{canTest:()=>true},addEventListener(){},removeEventListener(){}},encounterApi:api,coreApi:{validateMap},combatMobRoster:[],ui:{restartButton:{}},showCombat:()=>combat.promise};
 nodes.set('returnButton',node('button'));vm.createContext(context);vm.runInContext(source,context);
 const panel=body.children[0];assert.equal(panel.children[0].textContent,'Preparing encounter');assert.equal(panel.removed,undefined,'Loading must cover the launcher before ready');
 gate.resolve();await new Promise(r=>setImmediate(r));
 if(missing){await context.started;assert.equal(panel.children[0].textContent,'Encounter could not start');assert.match(panel.children[1].textContent,/handoff/);assert.equal(panel.children[3].hidden,false);return;}
 assert.equal(panel.removed,undefined,'Loading must cover the launcher while combat assets are pending');
 combat.resolve(interrupted?false:true);await context.started;
 if(interrupted){assert.equal(panel.removed,undefined);assert.equal(panel.children[0].textContent,'Encounter could not start');assert.match(panel.children[2].href,/test=1/);assert.match(panel.children[2].href,/map=old-tollhouse-test/);}else assert.equal(panel.removed,true);
}
await scenario();await scenario({missing:true});await scenario({interrupted:true});
console.log('PASS deferred encounter startup, missing handoff and interrupted startup stay out of menu with contextual recovery');
