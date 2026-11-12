import {syncEdgeDoors} from './exploration-edges.mjs?v=R238C274';
// Ordinary editor-format maps: the production converter owns all geometry.
export function createCombatTestMap(condition='wall'){
 const size=24,room=condition==='wall',inside=(x,z)=>room&&x>=9&&x<=15&&z>=9&&z<=15;
 const map={version:2,doorWidthVersion:5,id:'combat-test-'+condition,name:room?'Combat Test — Sconce Hall':'Combat Test — Grassy Field',width:size,height:size,
  grid:Array.from({length:size},()=>'.'.repeat(size)),environment:Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>inside(x,z)?'i':'o').join('')),
  ground:Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>inside(x,z)?'s':'g').join('')),
  ambientLight:Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>inside(x,z)?0:250)),
  edges:[],doors:[],torches:[],encounters:[],start:{x:12,z:12,facing:0}};
 const edge=(axis,x,z,kind='wall',extra={})=>map.edges.push({axis,x,z,id:`${axis}:${x},${z}`,kind,material:'stone',...extra});
 if(room){
  for(let x=9;x<=15;x++){edge('h',x,9,'window',{width:.5});edge('h',x,16,x===12?'door':'wall',{width:.375});}
  for(let z=9;z<=15;z++){edge('v',9,z,z===12?'door':'wall',{width:.375,initialOpen:z===12});edge('v',16,z);}
  map.torches=[{x:9,z:10},{x:15,z:14},{x:15,z:10}];
 }
 return syncEdgeDoors(map);
}
