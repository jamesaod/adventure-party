/* One bounded plan per large death. Pure axial-hex planner shared by combat and lab. */
(function(root){
 const dirs=[{x:1,y:0},{x:1,y:-1},{x:0,y:-1},{x:-1,y:0},{x:-1,y:1},{x:0,y:1}],key=p=>p.x+','+p.y;
 function footprint(origin,direction,length=3){const d=dirs[direction];return Array.from({length:Math.max(2,Math.min(5,length))},(_,i)=>({x:origin.x+d.x*i,y:origin.y+d.y*i}));}
 function plan({origin,units,blocked=()=>false,stepBlocked=()=>false,preferred=0,length=3,footprintOffsets=null,directions=[0,1,2,3,4,5],maxPushes=12,maxDepth=6}){
  let budget=1800,best=null;
  for(const direction of directions){
   const cells=footprintOffsets?footprintOffsets.map(p=>{let x=p.x,y=p.y;for(let i=0;i<direction;i++){const next=x+y;y=-x;x=next;}return {x:origin.x+x,y:origin.y+y};}):footprint(origin,direction,length),body=new Set(cells.map(key));
   if(cells.some(blocked)||(footprintOffsets?cells.some(c=>dirs.some(d=>body.has(key({x:c.x+d.x,y:c.y+d.y}))&&stepBlocked(c,{x:c.x+d.x,y:c.y+d.y}))):cells.slice(1).some((c,i)=>stepBlocked(cells[i],c))))continue;
   const positions=new Map(units.map(u=>[u.id,{x:u.x,y:u.y}]));
   const at=(state,p,except)=>units.find(u=>u.id!==except&&(u.offsets||[{x:0,y:0}]).some(o=>{const q=state.get(u.id);return q.x+o.x===p.x&&q.y+o.y===p.y;}));
   function push(unit,state,moves,visiting,depth,heading){
    if(--budget<0||depth>maxDepth||moves.size>=maxPushes||visiting.has(unit.id)||moves.has(unit.id))return null;
    const from=state.get(unit.id),seen=new Set(visiting).add(unit.id);
    const options=dirs.map((d,i)=>({x:from.x+d.x,y:from.y+d.y,direction:i})).sort((a,b)=>{
     const score=p=> (at(state,p,unit.id)?10:0)+(p.direction===heading?0:2);
     return score(a)-score(b);
    });
    for(const to of options){
     const offsets=unit.offsets||[{x:0,y:0}],targets=offsets.map(o=>({x:to.x+o.x,y:to.y+o.y}));
     if(targets.some(c=>body.has(key(c))||blocked(c))||targets.some((c,i)=>stepBlocked({x:from.x+offsets[i].x,y:from.y+offsets[i].y},c)))continue;
     let next=new Map(state),nextMoves=new Map(moves),ok=true;
     // Moving into an ancestor's starting cell creates a cycle, never a chain.
     const occupants=[...new Set(targets.map(c=>at(next,c,unit.id)).filter(Boolean))];
     for(const occupant of occupants){const result=push(occupant,next,nextMoves,seen,depth+1,to.direction);if(!result){ok=false;break;}next=result.positions;nextMoves=result.moves;}
     if(!ok||targets.some(c=>at(next,c,unit.id)))continue;
     next.set(unit.id,to);nextMoves.set(unit.id,{id:unit.id,from:{...from},to:{x:to.x,y:to.y},depth,direction:to.direction});
     return {positions:next,moves:nextMoves};
    }
    return null;
   }
   let state={positions,moves:new Map()},valid=true;
   for(const cell of cells){const u=at(state.positions,cell);if(!u)continue;const next=push(u,state.positions,state.moves,new Set(),0,direction);if(!next){valid=false;break;}state=next;}
   if(!valid)continue;
   const moves=[...state.moves.values()],turn=Math.min((direction-preferred+6)%6,(preferred-direction+6)%6),score=moves.length*100+Math.max(0,...moves.map(m=>m.depth))*30+turn;
   if(!best||score<best.score)best={cells,direction,moves,score};
  }
  return best;
 }
 root.AdventureCorpseLanding={plan,footprint,dirs};
})(globalThis);
