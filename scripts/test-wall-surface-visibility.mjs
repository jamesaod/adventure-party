import {joinedWallPrism} from '../js/wall-joins.mjs';
import assert from 'node:assert/strict';
import {wallSurfaceProbe,wallSurfaceNeighbours,wallFaceFacesCamera} from '../js/wall-surface-visibility.mjs';
import {triangulateSurfaces} from '../js/combat-webgl.mjs';
const wall={id:'wall',a:{x:-64,y:0},b:{x:64,y:0},thickness:3};
const eye={x:0,y:100},face={x:0,y:1.5*72/128};
assert(face.y+.025*72/3<1.5,'Old compressed-face probe remains inside collision shell');
const p=wallSurfaceProbe(face,eye,wall);assert(p.y>1.5&&p.y<1.7);assert.equal(p.x,0);
const door={...wall,id:'door',thickness:6};assert(wallSurfaceProbe({x:0,y:1.5},eye,door).y>3,'Closed door exits its own footprint');
const joined={id:'join',a:wall.b,b:{x:100,y:60},thickness:3},other={id:'other',a:{x:-20,y:20},b:{x:20,y:20},thickness:3},walls=[wall,joined,other];
assert.deepEqual(wallSurfaceNeighbours(wall,walls),[joined]);assert.equal(wallSurfaceNeighbours(wall,walls),wallSurfaceNeighbours(wall,walls),'Neighbour lookup reuses index');
assert(wallSurfaceProbe(face,eye,wall,wallSurfaceNeighbours(wall,walls)).y<20,'Disconnected foreground occluder is never skipped');
const diagonal={id:'diagonal',a:{x:0,y:0},b:{x:60,y:60},thickness:3},q=wallSurfaceProbe({x:30,y:30},{x:0,y:80},diagonal);assert((q.y-q.x)/Math.SQRT2>1.5);
const surface={points:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],uv:[[0,0],[1,0],[1,1],[0,1]],sunLoss:[.2,.15,.1]};
const data=triangulateSurfaces([surface]);for(let i=0;i<data.sunLoss.length;i+=3)assert.deepEqual(data.sunLoss.slice(i,i+3),surface.sunLoss,'Whole hex triangles share a constant Sun loss');
assert(triangulateSurfaces([{...surface,sunLoss:undefined}]).sunLoss.every(v=>v===0),'Unshadowed/blackout batches retain zero correction');
console.log('PASS compressed, diagonal and door surface probes, joined-neighbour caching, unrelated occluders and constant hex shadow attributes');

// NW Hall corner: a miter tip reverses max-endpoint face depth at -60 degrees.
const cornerWall={id:'corner-h',a:{x:0,y:0},b:{x:128,y:0}},sideWall={id:'corner-v',a:{x:0,y:0},b:{x:0,y:72}},nextWall={id:'next',a:{x:128,y:0},b:{x:256,y:0}},squash=72/128;
const cornerSolid=joinedWallPrism(cornerWall,[cornerWall,sideWall,nextWall],cornerWall.a,cornerWall.b,3,35,0,squash);
for(let rotation=0;rotation<6;rotation++){
 const angle=rotation*Math.PI/3,c=Math.cos(angle),s=Math.sin(angle),project=p=>({x:p.x*c-p.y/squash*s,y:p.x*s*squash+p.y*c});
 const vertical=cornerSolid.faces.filter(f=>!f.cap&&f.side!=='end'),ordered=[...vertical].sort((a,b)=>Math.max(...a.points.map(p=>project(p).y))-Math.max(...b.points.map(p=>project(p).y)));
 if(rotation===5)assert(!wallFaceFacesCamera(ordered.at(-1),project,squash),'Original endpoint sort exposes the rear face');
 const visible=cornerSolid.faces.filter(face=>wallFaceFacesCamera(face,project,squash));
 assert(visible.some(face=>face.cap),'Caps remain present');
 for(const face of visible.filter(f=>!f.cap))assert(project({x:face.normal.x,y:face.normal.z*squash}).y>=-1e-8,'No rear face can overwrite the visible face');
 const facing=vertical.map(face=>wallFaceFacesCamera(face,project,squash));if(Math.abs(Math.cos(angle))>1e-6)assert.notEqual(facing[0],facing[1],'Opposing wall faces are complementary');
}
console.log('PASS mitered-corner rear-face regression and complementary visible faces at all six camera rotations');
