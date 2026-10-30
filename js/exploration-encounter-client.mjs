import {HANDOFF_KEY,progressKey,readProgress,encounterAt} from './exploration-encounters.mjs?v=R238C212';
export function createEncounterClient(map,context){
  const storage=context?sessionStorage:localStorage;
  const scope=JSON.stringify([context?.id||'published',map.id,map.grid,map.encounters||[]]);
  let progress=readProgress(storage,scope);
  const roster=()=>progress.player?[{name:progress.player.name,role:progress.player.hp>0?'Player character':'Defeated',ac:progress.player.ac,hp:progress.player.hp,maxHp:progress.player.maxHp}]:[{name:'Dungeon Crawler Carl',role:'Combat stats initialized on first encounter',ac:'—',hp:'—',maxHp:'—'}];
  return {
    roster,
    restore(state){
      if(!new URLSearchParams(location.search).has('resumeEncounter'))return null;
      const request=JSON.parse(sessionStorage.getItem(HANDOFF_KEY)||'null');if(request?.scope!==scope)return null;
      const record=progress.encounters[request.event.id];
      Object.assign(state,record?.outcome==='victory'?request.position:request.returnPosition);
      state.openDoors=new Set(request.openDoors||[]);sessionStorage.removeItem(HANDOFF_KEY);
      return record?`${request.event.name}: ${record.outcome}. ${progress.player.name}: ${progress.player.hp}/${progress.player.maxHp} HP.`:null;
    },
    begin(state,previous){
      if(progress.player?.hp<=0)return false;
      const event=encounterAt(map,state,progress);if(!event)return false;
      const old=progress.encounters[event.id];
      const request={map,event,scope,test:!!context,returnSearch:location.search,origin:old?.origin||{x:state.x,z:state.z},position:{x:state.x,z:state.z,facing:state.facing},returnPosition:previous,openDoors:[...state.openDoors],player:progress.player,previous:old};
      sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(request));location.assign('index.html?explorationCombat=1&v=R238C216');return true;
    },
    defeated:()=>progress.player?.hp<=0,
    reset(){progress={encounters:{},player:null};storage.setItem(progressKey(scope),JSON.stringify(progress));},
  };
}
