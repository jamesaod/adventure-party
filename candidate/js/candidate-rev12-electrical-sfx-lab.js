/*
  Candidate Rev 12 — Electrical SFX Laboratory
  Development-only Web Audio synthesizer inside the Spell Effects Previewer.

  Goals:
  - audition three electrical voices without altering production spell behavior;
  - expose the useful synthesis layers live;
  - reuse Adventure Party's shared AudioContext / SFX gain path;
  - keep electrical crackle intentionally non-identical on every trigger.
*/
(()=>{
  "use strict";

  const PRESETS={
    zap:{
      label:"Zap",
      master:0.78,
      snap:0.58,
      crackle:0.46,
      sizzle:0.22,
      tone:0.38,
      body:0.03,
      crackles:5,
      arcStart:2400,
      arcEnd:240,
      tailMs:130
    },
    bolt:{
      label:"Lightning Bolt",
      master:0.88,
      snap:0.78,
      crackle:0.66,
      sizzle:0.38,
      tone:0.34,
      body:0.20,
      crackles:8,
      arcStart:2100,
      arcEnd:165,
      tailMs:320
    },
    heavy:{
      label:"Heavy Lightning",
      master:0.94,
      snap:0.92,
      crackle:0.78,
      sizzle:0.46,
      tone:0.31,
      body:0.44,
      crackles:11,
      arcStart:1850,
      arcEnd:120,
      tailMs:760
    }
  };

  const IDS={
    preset:"electricalLabPreset",
    play:"electricalLabPlay",
    repeat:"electricalLabRepeat",
    interval:"electricalLabInterval",
    status:"electricalLabStatus",
    master:"electricalLabMaster",
    snap:"electricalLabSnap",
    crackle:"electricalLabCrackle",
    sizzle:"electricalLabSizzle",
    tone:"electricalLabTone",
    body:"electricalLabBody",
    crackles:"electricalLabCrackles",
    arcStart:"electricalLabArcStart",
    arcEnd:"electricalLabArcEnd",
    tailMs:"electricalLabTailMs"
  };

  let labBus=null;
  let labLimiter=null;
  let repeatTimer=null;

  function el(id){
    return document.getElementById(id);
  }

  function clamp(value,min,max){
    return Math.min(max,Math.max(min,Number(value)||0));
  }

  function getNumber(id,fallback){
    const node=el(id);
    if(!node) return fallback;
    const value=Number(node.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function getParams(){
    return {
      master:clamp(getNumber(IDS.master,0.85),0.05,1.25),
      snap:clamp(getNumber(IDS.snap,0.7),0,1),
      crackle:clamp(getNumber(IDS.crackle,0.6),0,1),
      sizzle:clamp(getNumber(IDS.sizzle,0.35),0,1),
      tone:clamp(getNumber(IDS.tone,0.35),0,1),
      body:clamp(getNumber(IDS.body,0.2),0,1),
      crackles:Math.round(clamp(getNumber(IDS.crackles,7),1,14)),
      arcStart:clamp(getNumber(IDS.arcStart,2200),300,6000),
      arcEnd:clamp(getNumber(IDS.arcEnd,180),45,1800),
      tailMs:clamp(getNumber(IDS.tailMs,300),60,1400)
    };
  }

  function updateValueReadouts(){
    document.querySelectorAll("[data-electrical-output]").forEach(output=>{
      const sourceId=output.getAttribute("data-electrical-output");
      const source=el(sourceId);
      if(!source) return;
      let value=source.value;
      const unit=output.getAttribute("data-unit")||"";
      if(["electricalLabMaster","electricalLabSnap","electricalLabCrackle","electricalLabSizzle","electricalLabTone","electricalLabBody"].includes(sourceId)){
        value=Number(value).toFixed(2);
      }
      output.textContent=value+unit;
    });
  }

  function setStatus(text,state="ready"){
    const node=el(IDS.status);
    if(!node) return;
    node.textContent=text;
    node.dataset.state=state;
  }

  function ensureLabBus(){
    if(!audioCtx || !sfxGain) return null;
    if(labBus && labLimiter) return labBus;

    labBus=audioCtx.createGain();
    labBus.gain.value=1;

    labLimiter=audioCtx.createDynamicsCompressor();
    labLimiter.threshold.value=-8;
    labLimiter.knee.value=4;
    labLimiter.ratio.value=14;
    labLimiter.attack.value=0.0015;
    labLimiter.release.value=0.09;

    labBus.connect(labLimiter);
    labLimiter.connect(sfxGain);
    return labBus;
  }

  function makeDriveCurve(amount=10){
    const size=256;
    const curve=new Float32Array(size);
    const k=Math.max(1,amount);
    for(let i=0;i<size;i++){
      const x=i*2/(size-1)-1;
      curve[i]=((1+k)*x)/(1+k*Math.abs(x));
    }
    return curve;
  }

  function scheduleNoiseBurst({
    at,
    duration,
    gain,
    type="bandpass",
    frequency=3500,
    q=2,
    highpass=0,
    playbackRate=1
  }){
    const out=ensureLabBus();
    if(!out || !noiseBuffer || gain<=0) return;

    const source=audioCtx.createBufferSource();
    source.buffer=noiseBuffer;
    source.playbackRate.value=playbackRate;

    const filter=audioCtx.createBiquadFilter();
    filter.type=type;
    filter.frequency.setValueAtTime(Math.max(20,frequency),at);
    filter.Q.setValueAtTime(Math.max(0.0001,q),at);

    const gainNode=audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.0001,at);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002,gain),at+0.0025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001,at+Math.max(0.006,duration));

    source.connect(filter);

    if(highpass>0){
      const hp=audioCtx.createBiquadFilter();
      hp.type="highpass";
      hp.frequency.setValueAtTime(highpass,at);
      hp.Q.value=0.7;
      filter.connect(hp);
      hp.connect(gainNode);
    }else{
      filter.connect(gainNode);
    }

    gainNode.connect(out);
    source.start(at);
    source.stop(at+duration+0.035);
  }

  function scheduleArcTone(at,p){
    if(p.tone<=0) return;
    const out=ensureLabBus();
    if(!out) return;

    const duration=Math.max(0.07,p.tailMs/1000*0.48);
    const osc=audioCtx.createOscillator();
    const drive=audioCtx.createWaveShaper();
    const band=audioCtx.createBiquadFilter();
    const gain=audioCtx.createGain();

    osc.type="sawtooth";
    osc.frequency.setValueAtTime(Math.max(p.arcEnd+1,p.arcStart),at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(45,p.arcEnd),at+duration);

    drive.curve=makeDriveCurve(7+10*p.tone);
    drive.oversample="2x";

    band.type="bandpass";
    band.frequency.setValueAtTime(Math.min(6500,Math.max(450,p.arcStart*0.78)),at);
    band.frequency.exponentialRampToValueAtTime(Math.max(180,p.arcEnd*1.6),at+duration);
    band.Q.value=0.8;

    gain.gain.setValueAtTime(0.0001,at);
    gain.gain.exponentialRampToValueAtTime(0.16*p.tone,at+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);

    osc.connect(drive);
    drive.connect(band);
    band.connect(gain);
    gain.connect(out);

    osc.start(at);
    osc.stop(at+duration+0.02);
  }

  function scheduleBody(at,p){
    if(p.body<=0) return;
    const out=ensureLabBus();
    if(!out) return;

    const duration=Math.max(0.12,p.tailMs/1000*0.72);
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    const low=audioCtx.createBiquadFilter();

    osc.type="sine";
    const startHz=110-28*p.body;
    osc.frequency.setValueAtTime(startHz,at);
    osc.frequency.exponentialRampToValueAtTime(38,at+duration);

    low.type="lowpass";
    low.frequency.setValueAtTime(420,at);
    low.frequency.exponentialRampToValueAtTime(120,at+duration);
    low.Q.value=0.55;

    gain.gain.setValueAtTime(0.0001,at);
    gain.gain.exponentialRampToValueAtTime(0.30*p.body,at+0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);

    osc.connect(low);
    low.connect(gain);
    gain.connect(out);

    osc.start(at);
    osc.stop(at+duration+0.03);

    if(p.body>0.18){
      scheduleNoiseBurst({
        at:at+0.014,
        duration:Math.max(0.14,p.tailMs/1000*0.86),
        gain:0.12*p.body,
        type:"lowpass",
        frequency:520,
        q:0.55,
        playbackRate:0.72
      });
    }
  }

  function synthesizeElectrical(){
    if(!audioEnabled){
      setStatus("Global audio is OFF.","off");
      return;
    }

    const p=getParams();

    queueSfx(()=>{
      const out=ensureLabBus();
      if(!out){
        setStatus("Audio context unavailable.","off");
        return;
      }

      labBus.gain.setValueAtTime(p.master,audioCtx.currentTime);
      const t=audioCtx.currentTime+0.012;

      // Layer 1: immediate broadband discharge.
      if(p.snap>0){
        scheduleNoiseBurst({
          at:t,
          duration:0.024+0.020*p.snap,
          gain:0.36*p.snap,
          type:"bandpass",
          frequency:3600+900*p.snap,
          q:0.9,
          highpass:1100
        });
        scheduleNoiseBurst({
          at:t+0.0015,
          duration:0.010+0.008*p.snap,
          gain:0.19*p.snap,
          type:"highpass",
          frequency:5200,
          q:0.7,
          highpass:0,
          playbackRate:1.35
        });
      }

      // Layer 2: irregular micro-arcs. Randomness is intentional.
      for(let i=0;i<p.crackles;i++){
        const spread=Math.max(0.045,p.tailMs/1000*0.42);
        const offset=(i===0 ? 0.005 : 0.008+Math.random()*spread);
        const duration=0.014+Math.random()*0.034;
        const center=1800+Math.random()*3800;
        scheduleNoiseBurst({
          at:t+offset,
          duration,
          gain:(i===0 ? 0.19 : 0.07+Math.random()*0.11)*p.crackle,
          type:"bandpass",
          frequency:center,
          q:3+Math.random()*4.5,
          highpass:3000+Math.random()*2600,
          playbackRate:1.05+Math.random()*1.25
        });
      }

      // Layer 3: hot-air sizzle.
      if(p.sizzle>0){
        scheduleNoiseBurst({
          at:t+0.008,
          duration:Math.max(0.055,p.tailMs/1000*0.58),
          gain:0.105*p.sizzle,
          type:"highpass",
          frequency:3800+900*p.sizzle,
          q:0.7,
          playbackRate:1.12
        });
      }

      // Layer 4: short distorted pitch sweep for magical/electrical identity.
      scheduleArcTone(t,p);

      // Layer 5: restrained low-frequency body for larger discharges.
      scheduleBody(t,p);

      setStatus(
        `Played ${PRESETS[el(IDS.preset)?.value]?.label||"custom electrical voice"} — ${p.crackles} randomized arcs.`,
        "playing"
      );
    });
  }

  function stopRepeat(){
    if(repeatTimer){
      clearInterval(repeatTimer);
      repeatTimer=null;
    }
    const repeat=el(IDS.repeat);
    if(repeat) repeat.checked=false;
    setStatus("Electrical SFX repeat stopped.","ready");
  }

  function syncRepeat(){
    const repeat=el(IDS.repeat);
    if(!repeat?.checked){
      if(repeatTimer){
        clearInterval(repeatTimer);
        repeatTimer=null;
      }
      return;
    }

    if(repeatTimer) clearInterval(repeatTimer);
    const ms=clamp(getNumber(IDS.interval,1000),250,4000);
    synthesizeElectrical();
    repeatTimer=setInterval(()=>{
      if(currentScreen!=="spell-preview"){
        stopRepeat();
        return;
      }
      synthesizeElectrical();
    },ms);
  }

  function applyPreset(key){
    const preset=PRESETS[key]||PRESETS.bolt;
    for(const name of ["master","snap","crackle","sizzle","tone","body","crackles","arcStart","arcEnd","tailMs"]){
      const node=el(IDS[name]);
      if(node) node.value=preset[name];
    }
    updateValueReadouts();
    setStatus(`${preset.label} preset loaded. Production spell audio is unchanged.`,"ready");
  }

  function wire(){
    const preset=el(IDS.preset);
    if(!preset) return;

    preset.addEventListener("change",()=>{
      if(preset.value==="custom"){
        setStatus("Custom values retained. Adjust sliders or press Play SFX.","ready");
        return;
      }
      applyPreset(preset.value);
    });

    el(IDS.play)?.addEventListener("click",async()=>{
      await unlockAudio();
      synthesizeElectrical();
    });

    el(IDS.repeat)?.addEventListener("change",async()=>{
      if(el(IDS.repeat)?.checked){
        await unlockAudio();
      }
      syncRepeat();
    });

    el(IDS.interval)?.addEventListener("change",()=>{
      if(el(IDS.repeat)?.checked) syncRepeat();
    });

    document.querySelectorAll("[data-electrical-control]").forEach(node=>{
      node.addEventListener("input",()=>{
        updateValueReadouts();
        const presetNode=el(IDS.preset);
        if(presetNode) presetNode.value="custom";
      });
    });

    window.addEventListener("keydown",event=>{
      if(event.key==="Escape" && repeatTimer){
        stopRepeat();
      }
    });

    applyPreset("bolt");
  }

  window.AdventurePartyElectricalSfxLab={
    presets:PRESETS,
    play:synthesizeElectrical,
    applyPreset,
    getParameters:getParams,
    stopRepeat
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",wire,{once:true});
  }else{
    wire();
  }
})();
