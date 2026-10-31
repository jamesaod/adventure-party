import {TEST_KEY,parsePack,destination} from './exploration-authoring.mjs?v=R238C234';
export function testContext(search,storage){
  const query=new URLSearchParams(search);if(query.get('test')!=='1')return null;
  const snapshot=JSON.parse(storage.getItem(TEST_KEY)||'null');
  if(!snapshot?.id||!snapshot.pack)throw Error('No test adventure is loaded. Open the Map Editor and choose Test Map.');
  const pack=parsePack(JSON.stringify(snapshot.pack)),map=pack.maps.find(m=>m.id===query.get('map'));
  if(!map)throw Error('The requested test map is missing. Return to the Map Editor.');
  const entranceId=query.get('entrance'),entrance=entranceId?map.entrances.find(e=>e.id===entranceId):map.start;
  if(!entrance)throw Error('The requested entrance is missing. Return to the Map Editor.');
  return {id:snapshot.id,pack,map,spawn:{x:entrance.x,z:entrance.z,facing:entrance.facing}};
}
export const testStateKey=(context,kind)=>`adventure-party:test:${context.id}:${context.map.id}:${kind}`;
export function exitUrl(context,x,z){
  const target=destination(context.pack,context.map.id,x,z);
  return target?`exploration.html?test=1&map=${encodeURIComponent(target.map.id)}&entrance=${encodeURIComponent(target.entrance.id)}`:null;
}
