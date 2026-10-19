/*
  R218 — STINKING CLOUD OPACITY + TITLE MIDI DISABLE
  ===================================================
  Presentation-only tuning:
  - Stinking Cloud's rendered body is half as opaque as R217.
  - Wall of Fog and Fog Cloud retain their existing 50% global volume alpha.
  - The green Stinking Cloud outline remains at its existing strength so the
    affected tactical footprint stays readable.
  - The title MIDI-derived sequencer is disabled for now. The shared Web Audio
    context, SFX, weather audio, and the global SND toggle remain available.
*/

/* Disable the title MIDI-derived music path without disturbing shared SFX. */
const r218StopLegacyTitleMusic=stopTitleMusic;

titleEvents.length=0;

stopTitleMusic=function(){
  /*
    Preserve the old cleanup once, so any already-scheduled oscillators/timers
    are stopped safely if this file is hot-reloaded during development.
  */
  r218StopLegacyTitleMusic();
  musicPlaying=false;
  updateAudioIndicators();
};

startTitleMusic=function(){
  /*
    Intentionally disabled in R218. Keep the callable compatibility surface so
    screen routing and audio-unlock code do not need a parallel special case.
  */
  musicPlaying=false;
  updateAudioIndicators();
};

drawFogVolumeCell=function(cell,effect=null){
  if(
    !cell ||
    !inside(cell.x,cell.y) ||
    !isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  ){
    return;
  }

  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W;
  const top=hexScreenVertices(cell.x,cell.y);
  const time=performance.now();
  const seedBase=(Math.abs(cell.x*73856093 ^ cell.y*19349663)>>>0);
  const isStinkingCloud=effect?.spellKind==="stinking-cloud";

  ctx.save();

  /*
    R218: halve Stinking Cloud body opacity relative to its R217 value:
      normal fog global alpha:   0.50
      Stinking Cloud global alpha: 0.25

    Individual gradient/puff alpha relationships are unchanged, preserving the
    established green palette and animation while making the whole cloud more
    transparent.
  */
  ctx.globalAlpha=isStinkingCloud ? 0.25 : 0.5;

  polygonPath(top);
  ctx.fillStyle=isStinkingCloud
    ? "rgba(72,112,42,0.88)"
    : "rgba(207,216,218,0.84)";
  ctx.fill();

  const drift=Math.sin((time*0.0017)+(cell.x*0.61)+(cell.y*0.43))*3.0;
  const grad=ctx.createLinearGradient(c.x,c.y-height-4,c.x,c.y+7);

  if(isStinkingCloud){
    grad.addColorStop(0,"rgba(174,199,74,0.68)");
    grad.addColorStop(0.42,"rgba(102,151,54,0.84)");
    grad.addColorStop(0.72,"rgba(63,116,43,0.88)");
    grad.addColorStop(1,"rgba(37,82,42,0.92)");
  }else{
    grad.addColorStop(0,"rgba(236,241,242,0.60)");
    grad.addColorStop(0.45,"rgba(214,223,225,0.82)");
    grad.addColorStop(1,"rgba(188,199,201,0.88)");
  }

  ctx.fillStyle=grad;
  ctx.fillRect(
    c.x-HEX_W*0.48+drift*0.18,
    c.y-height-2,
    HEX_W*0.96,
    height+10
  );

  const stinkingPuffColors=[
    [188,205,77],
    [126,170,58],
    [82,139,48],
    [48,101,45]
  ];

  for(let i=0;i<8;i++){
    const a=((seedBase + i*2654435761)>>>0);
    const fx=((a & 1023)/1023)-0.5;
    const fy=(((a>>>10)&1023)/1023);
    const rx=16+((a>>>20)&7);
    const ry=9+((a>>>23)&7);
    const phase=(a & 255)*0.023;
    const sway=Math.sin(time*0.0021+phase)*4.0;
    const lift=Math.cos(time*0.0018+phase*1.7)*2.3;
    const px=c.x+fx*HEX_W*0.70+sway;
    const py=c.y-8-fy*(height-12)+lift;
    const alphaPulse=0.73+0.17*Math.sin(time*0.0024+phase*2.1);

    ctx.beginPath();
    ctx.ellipse(px,py,rx,ry,0,0,Math.PI*2);

    if(isStinkingCloud){
      const puff=stinkingPuffColors[
        (seedBase+i)%stinkingPuffColors.length
      ];
      ctx.fillStyle=
        `rgba(${puff[0]},${puff[1]},${puff[2]},${0.80*alphaPulse})`;
    }else{
      ctx.fillStyle=i%2
        ? `rgba(225,232,233,${0.74*alphaPulse})`
        : `rgba(197,207,209,${0.78*alphaPulse})`;
    }

    ctx.fill();
  }

  const capBob=
    Math.sin(time*0.0022 + seedBase*0.000002)*3;

  ctx.beginPath();
  ctx.ellipse(
    c.x+drift*0.14,
    c.y-height+5+capBob*0.28,
    HEX_W*0.42,
    12,
    0,
    0,
    Math.PI*2
  );

  ctx.fillStyle=isStinkingCloud
    ? "rgba(202,216,94,0.72)"
    : "rgba(242,246,247,0.68)";
  ctx.fill();

  ctx.strokeStyle=isStinkingCloud
    ? "rgba(156,190,73,0.58)"
    : "rgba(236,242,243,0.52)";
  ctx.lineWidth=1.2;

  ctx.beginPath();
  ctx.moveTo(
    c.x-HEX_W*0.42+drift*0.12,
    c.y-height+8
  );
  ctx.lineTo(
    c.x-HEX_W*0.42+drift*0.12,
    c.y-2
  );
  ctx.moveTo(
    c.x+HEX_W*0.42+drift*0.12,
    c.y-height+8
  );
  ctx.lineTo(
    c.x+HEX_W*0.42+drift*0.12,
    c.y-2
  );
  ctx.stroke();

  ctx.restore();
};
