function r227BuildMeteorAttackResults(caster,targetIds,effect){
  const level=Math.max(
    1,
    Number(effect?.data?.casterLevel)||
    Number(caster?.level)||
    TEST_SPELL_CASTER_LEVEL
  );
  const thaco=Math.max(1,21-Math.ceil(level/3));
  const previousWeaponInHand=caster.weaponInHand;
  caster.weaponInHand="ranged";

  const results=[];

  for(let index=0;index<targetIds.length;index++){
    const target=getUnitById(targetIds[index]);
    if(!target?.alive || target.fled){
      results.push({index,target:null,hit:false,invalid:true});
      continue;
    }

    const raw=d(20);
    const ac=effectiveArmorClassForAttack(
      caster,
      target,
      "small-device-missile"
    );
    const targetNumber=thaco-ac;
    const modifier=2+attackEffectModifier(caster,target);
    const resolution=resolveMissileAttackD20(
      raw,
      targetNumber,
      modifier
    );

    results.push({
      index,
      target,
      raw,
      ac,
      targetNumber,
      modifier,
      hit:resolution.hit,
      resolution
    });
  }

  caster.weaponInHand=previousWeaponInHand;
  return results;
}

function r227MeteorFlightGeometry(caster,results){
  const startCenter=hexCenter(caster.x,caster.y);
  const total=Math.max(1,results.length);

  return results.map((result,index)=>{
    const angle=(Math.PI*2*index/total)-Math.PI/2;
    const start={
      x:startCenter.x+Math.cos(angle)*11,
      y:startCenter.y-25+Math.sin(angle)*5
    };

    const target=result.target;
    const targetCenter=target
      ? hexCenter(target.x,target.y)
      : startCenter;
    const spread=(index-(total-1)/2)*2.2;
    const missOffset=result.hit
      ? 0
      : ((index%2===0 ? 1 : -1)*(12+(index%3)*3));

    return {
      index,
      targetId:target?.id || null,
      hit:!!result.hit,
      start,
      end:{
        x:targetCenter.x+spread+missOffset,
        y:targetCenter.y-16+(result.hit ? 0 : 7)
      }
    };
  });
}

function r227DrawMeteorVolleyFx(){
  const fx=r227MeteorVolleyFx;
  if(!fx?.meteors?.length) return;

  const elapsed=performance.now()-fx.started;
  const t=Math.max(0,Math.min(1,elapsed/Math.max(1,fx.duration)));
  const eased=1-Math.pow(1-t,2.2);

  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.lineCap="round";

  for(const meteor of fx.meteors){
    const x=meteor.start.x+(meteor.end.x-meteor.start.x)*eased;
    const y=meteor.start.y+(meteor.end.y-meteor.start.y)*eased-
      Math.sin(Math.PI*t)*18;
    const trailT=Math.max(0,eased-0.075);
    const tx=meteor.start.x+(meteor.end.x-meteor.start.x)*trailT;
    const ty=meteor.start.y+(meteor.end.y-meteor.start.y)*trailT-
      Math.sin(Math.PI*Math.max(0,t-0.06))*17;

    ctx.strokeStyle="rgba(255,103,18,0.68)";
    ctx.lineWidth=4.5;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(x,y);
    ctx.stroke();

    ctx.strokeStyle="rgba(255,225,105,0.88)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(x,y);
    ctx.stroke();

    ctx.fillStyle="rgba(255,247,205,0.98)";
    ctx.beginPath();
    ctx.arc(x,y,2.5,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

async function r227AnimateMeteorVolley(caster,results){
  r227MeteorVolleyFx={
    casterId:caster.id,
    started:performance.now(),
    duration:330,
    meteors:r227MeteorFlightGeometry(caster,results)
  };

  playAttackSound();

  while(true){
    const elapsed=performance.now()-r227MeteorVolleyFx.started;
    draw();
    if(elapsed>=r227MeteorVolleyFx.duration) break;
    await sleep(16);
  }

  r227MeteorVolleyFx=null;
  draw();
}

