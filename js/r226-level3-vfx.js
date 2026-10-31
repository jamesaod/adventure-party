function r226DrawWindWalls(){
  const now=performance.now()/1000;
  for(const wall of r226ActiveWindWalls()){
    for(const cell of wall.cells || []){
      if(!inside(cell.x,cell.y)) continue;
      const c=hexCenter(cell.x,cell.y);
      const pulse=0.5+0.5*Math.sin(now*5+cell.x*0.8+cell.y*0.6);
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      for(let band=0;band<3;band++){
        const y=c.y-8-band*7;
        ctx.strokeStyle=`rgba(220,244,255,${0.18+0.10*pulse})`;
        ctx.lineWidth=1.2;
        ctx.beginPath();
        ctx.moveTo(c.x-HEX_W*0.35,y+Math.sin(now*4+band)*2);
        ctx.bezierCurveTo(c.x-8,y-5,c.x+8,y+5,c.x+HEX_W*0.35,y-2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function r226DrawUnitStatusGlyph(unit,label,fill,stroke="rgba(12,10,18,0.90)"){
  if(!unit?.alive || unit.fled || !shouldRenderUnitUnderPartyVisibility(unit)) return;
  const c=hexCenter(unit.x,unit.y);
  const t=performance.now()/1000;
  const bob=Math.sin(t*3+unit.x+unit.y)*2;
  ctx.save();
  ctx.font='700 11px "EB Garamond", Georgia, serif';
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineWidth=2.5;
  ctx.strokeStyle=stroke;
  ctx.fillStyle=fill;
  ctx.strokeText(label,c.x,c.y-43+bob);
  ctx.fillText(label,c.x,c.y-43+bob);
  ctx.restore();
}

function r226DrawProtectionAura(source){
  if(!source?.alive || !shouldRenderUnitUnderPartyVisibility(source)) return;
  const c=hexCenter(source.x,source.y);
  const t=performance.now()/1000;
  const pulse=0.5+0.5*Math.sin(t*2.2);
  ctx.save();
  ctx.strokeStyle=`rgba(255,236,155,${0.42+0.18*pulse})`;
  ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.ellipse(c.x,c.y+2,HEX_W*0.92,HEX_W*0.36,0,0,Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function r226DrawMeteorOrbit(unit,effect){
  if(!unit?.alive || !shouldRenderUnitUnderPartyVisibility(unit)) return;
  const remaining=Math.max(0,Number(effect?.data?.remaining)||0);
  if(!remaining) return;
  const c=hexCenter(unit.x,unit.y);
  const t=performance.now()/1000;
  const count=Math.min(5,remaining);
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  for(let i=0;i<count;i++){
    const a=t*2.2+i*Math.PI*2/count;
    const x=c.x+Math.cos(a)*14;
    const y=c.y-29+Math.sin(a)*5;
    ctx.fillStyle="rgba(255,145,45,0.95)";
    ctx.beginPath(); ctx.arc(x,y,2.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(255,236,156,0.95)";
    ctx.fillRect(Math.round(x),Math.round(y),1,1);
  }
  ctx.restore();
}

function r226DrawLineFx(fx,kind){
  if(!fx?.points?.length) return;
  const elapsed=performance.now()-fx.started;
  const t=r226Clamp(elapsed/Math.max(1,fx.duration),0,1);
  const fade=Math.sin(Math.PI*t);
  const pts=fx.points.map(p=>hexCenter(p.x,p.y));
  ctx.save();
  ctx.lineCap="round";
  ctx.lineJoin="round";

  if(kind==="lightning"){
    ctx.globalCompositeOperation="lighter";
    for(let layer=0;layer<3;layer++){
      ctx.strokeStyle=layer===0
        ? `rgba(120,190,255,${0.35*fade})`
        : layer===1
          ? `rgba(210,235,255,${0.72*fade})`
          : `rgba(255,255,255,${0.95*fade})`;
      ctx.lineWidth=layer===0?7:layer===1?3.2:1.4;
      ctx.beginPath();
      pts.forEach((p,i)=>{
        const jitter=i===0?0:Math.sin(i*19.7+t*31)*(layer===2?2.5:1.2);
        if(i===0) ctx.moveTo(p.x,p.y-12);
        else ctx.lineTo(p.x+jitter,p.y-12-jitter*0.4);
      });
      ctx.stroke();
    }
  }else{
    ctx.strokeStyle=`rgba(205,235,245,${0.46*fade})`;
    ctx.lineWidth=8;
    ctx.beginPath();
    pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y-8):ctx.moveTo(p.x,p.y-8));
    ctx.stroke();
    ctx.strokeStyle=`rgba(245,252,255,${0.78*fade})`;
    ctx.lineWidth=1.4;
    for(let band=-1;band<=1;band++){
      ctx.beginPath();
      pts.forEach((p,i)=>{
        const sway=Math.sin(t*18+i*0.9+band)*5;
        const y=p.y-9+band*6+sway*0.25;
        if(i===0) ctx.moveTo(p.x,y); else ctx.lineTo(p.x,y);
      });
      ctx.stroke();
    }
  }
  ctx.restore();
}

function r226DrawPersistentLevel3Fx(){
  if(!game) return;
  for(const unit of allUnits()){
    if(getUnitEffect(unit,"haste")) r226DrawUnitStatusGlyph(unit,"»","rgba(170,255,220,0.95)");
    if(getUnitEffect(unit,"slow")) r226DrawUnitStatusGlyph(unit,"⌛","rgba(190,150,255,0.95)");
    if(getUnitEffect(unit,"held-person") || getUnitEffect(unit,"held-undead")) r226DrawUnitStatusGlyph(unit,"║","rgba(255,220,125,0.95)");
    if(getUnitEffect(unit,"infravision")) r226DrawUnitStatusGlyph(unit,"◉","rgba(255,95,75,0.95)");
    if(getUnitEffect(unit,"protection-from-normal-missiles")) r226DrawUnitStatusGlyph(unit,"⌒","rgba(195,225,255,0.95)");
    if(getUnitEffect(unit,"blink")) r226DrawUnitStatusGlyph(unit,"◇","rgba(195,165,255,0.95)");
    const meteors=getUnitEffect(unit,"minute-meteors");
    if(meteors) r226DrawMeteorOrbit(unit,meteors);
    if(getUnitEffect(unit,"protection-from-evil-radius")) r226DrawProtectionAura(unit);
  }
  r226DrawLineFx(r226LightningFx,"lightning");
  r226DrawLineFx(r226GustFx,"gust");
}

const r226BaseDrawSpellAreaEffects=drawSpellAreaEffects;
drawSpellAreaEffects=function(){
  r226BaseDrawSpellAreaEffects();
  r226DrawWindWalls();
};

const r226BaseDrawPersistentCharmStatusFx=drawPersistentCharmStatusFx;
drawPersistentCharmStatusFx=function(){
  r226BaseDrawPersistentCharmStatusFx();
  r226DrawPersistentLevel3Fx();
};

const r226BaseHasPersistentStatusFx=hasPersistentStatusFx;
hasPersistentStatusFx=function(){
  return !!(
    r226BaseHasPersistentStatusFx() ||
    r226ActiveWindWalls().length ||
    allUnits().some(unit=>
      [
        "blink","haste","slow","held-person","held-undead","infravision",
        "protection-from-evil-radius","protection-from-normal-missiles","minute-meteors"
      ].some(id=>!!getUnitEffect(unit,id))
    )
  );
};


/* ============================================================
   PUBLIC DIAGNOSTICS
   ============================================================ */

window.AdventurePartyLevel3Spells={
  release:"R226",
  spellIds:Object.keys(R226_LEVEL3_SPELLS),
  windWalls:()=>r226ActiveWindWalls().map(wall=>({
    id:wall.id,
    expiresRound:wall.expiresRound,
    cells:(wall.cells||[]).map(cell=>({x:cell.x,y:cell.y}))
  })),
  cleanupInvisibilityRadius:r226CleanupRadiusInvisibility,
  recomputeMobility:r226RecomputeAllMobility
};
