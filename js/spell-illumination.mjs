// Display radiance is additive, independent of ambient visibility percentages.
// Range, falloff and architectural occlusion are supplied by the production resolver.
export function spellSurfaceRadiance(point,sources,contribution){
 const rgb=[0,0,0];
 for(const source of sources){
  if(source.sourceKind==='torch')continue;
  const amount=Math.max(0,contribution(source,point))*.18;if(!amount)continue;
  const color=source.color||[255,244,188];for(let i=0;i<3;i++)rgb[i]+=Math.max(0,Math.min(255,color[i]))/255*amount;
 }
 return rgb;
}

// Render-only emitters: a fireball flash must not alter Darkness spell rules.
export function spellEffectLightSources(state,now,lookup){
 const result=[...(state.volleyLights||[])],fire=[255,128,35],magic=[125,170,255];
 const add=(id,p,radius,intensity,color=fire)=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&intensity>0)result.push({id,sourceKind:'spell-fx',x:p.x,y:p.y,radiusHexes:radius,intensity,color});};
 const envelope=fx=>{const t=(now-fx.started)/fx.duration;return t>=0&&t<1?Math.sin(Math.PI*t):0;};
 const flash=state.spellSurfaceFlashFx;if(flash)for(const [i,p] of (flash.cells||[]).entries())add('spell-flash'+i,p,3,1.4*envelope(flash),flash.color);
 const explosion=state.fireballExplosionFx;if(explosion)add('fireball-explosion',explosion,Math.max(3,explosion.radiusHexes+2),2.4*envelope(explosion));
 const projectile=state.projectileFx,colors={'fireball':fire,'flame-arrow':fire,'acid-arrow':[130,255,75],'magic-missile':magic};
 if(projectile?.lightPath&&colors[projectile.kind]){const {from,to}=projectile.lightPath,t=Math.max(0,Math.min(1,projectile.t));add('spell-projectile',{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},projectile.kind==='fireball'?4:2,projectile.kind==='fireball'?1.4:.7,colors[projectile.kind]);}
 for(const [name,list,color,amount] of [['casting',state.castingGlowFx,magic,.55],['fire-damage',state.fireDamageFx,fire,1],['magic',state.magicEffectFx,magic,.7]])for(const [i,fx] of (list||[]).entries()){const unit=lookup(fx.unitId);add(name+i,unit,2,amount*envelope(fx),color);}
 const spray=state.colorSprayFx;if(spray)for(const [i,p] of (spray.cells||[]).entries())add('color-spray'+i,p,1.5,.35*envelope(spray),[[255,80,80],[80,255,130],[100,150,255]][i%3]);
 const breath=state.dragonBreathFx;if(breath)for(const [i,p] of (breath.cells||[]).entries())add('fire-breath'+i,p,2,.6*envelope(breath));
 for(const effect of state.areaEffects||[])if(effect.type==='flaming-sphere')for(const [i,p] of (effect.cells||[]).entries())add(effect.id+':'+i,p,3,1.1);
 const bolt=state.lightningFx;if(bolt){const points=bolt.points||[],samples=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let j=0;j<n;j++)samples.push({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});}samples.push(...points.slice(-1));for(let i=0;i<samples.length;i+=Math.max(1,Math.ceil(samples.length/24)))add('lightning'+i,samples[i],2.5,.85*envelope(bolt),[175,215,255]);}
 const grasp=state.shockingGraspFx;if(grasp){add('shocking-grasp-caster',lookup(grasp.casterId),2,1.2*envelope(grasp),[175,215,255]);add('shocking-grasp-target',lookup(grasp.targetId),2,1.2*envelope(grasp),[175,215,255]);}
 for(const effect of state.hypnoticPatterns||[])for(const [i,p] of (effect.cells||[]).entries())add('hypnotic'+effect.id+i,p,1.5,.22,[205,170,255]);
 return result;
}
