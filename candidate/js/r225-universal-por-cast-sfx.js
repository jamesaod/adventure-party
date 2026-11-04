/*
  R225 — UNIVERSAL POOL OF RADIANCE-STYLE CASTING SFX
  ===================================================
  Temporary shared spell-casting cue for all spells.

  Source:
  - reconstructed from Pool of Radiance DOS PC-speaker SFX program #07 found
    in the user's uploaded START.EXE;
  - this file does NOT include SSI's original sampled audio (there is none for
    the PC-beeper path);
  - instead it stores a compact 1-bit reconstruction of the programmed beeper
    waveform at 11.025 kHz and builds a Web Audio AudioBuffer at runtime.

  Existing spell-specific impact/status sounds remain unchanged and can layer
  over this universal casting cue.
*/

const R225_POR07_SAMPLE_RATE=11025;
const R225_POR07_LEAD_SAMPLES=47;
const R225_POR07_SIGNAL_SAMPLES=27901;
const R225_POR07_TAIL_SAMPLES=46;

/*
  np.packbits(..., bitorder="big") representation of the sign of the recreated
  Pool of Radiance PC-speaker SFX #07 waveform. One bit per 11.025 kHz sample:
  1 = positive speaker phase, 0 = negative speaker phase.
*/
const R225_POR07_PACKED_BASE64=
"////////////AAAAAAAAAAAD//////////8AAAAAAAAAAP/////////4AAAAAAAAAf////////wAAAAAAAAf///////8AAAAAAAAH////////+AAAAAAAAAB//////////4AAAAAAAAAAB///////////+AAAAAAAAAAAD///////////AAAAAAAAAAA//////////wAAAAAAAAAP////////+AAAAAAAAB////////4AAAAAAAB////////gAAAAAAAA/////////wAAAAAAAAAP//////////AAAAAAAAAAAP///////////gAAAAAAAAAAD//////////4AAAAAAAAAB/////////+AAAAAAAAAP////////4AAAAAAAAf///////4AAAAAAAP///////4AAAAAAAA/////////gAAAAAAAAA//////////wAAAAAAAAAAP///////////AAAAAAAAAAAf/////////8AAAAAAAAAB/////////8AAAAAAAAA////////+AAAAAAAAP///////4AAAAAAAf//////+AAAAAAAA////////8AAAAAAAAB/////////4AAAAAAAAAA///////////gAAAAAAAAAAP/////////+AAAAAAAAAA/////////8AAAAAAAAA////////+AAAAAAAAP///////4AAAAAAAf//////8AAAAAAA///////+AAAAAAAAP////////gAAAAAAAAD/////////+AAAAAAAAAAD//////////4AAAAAAAAAB/////////+AAAAAAAAAP////////wAAAAAAAA////////wAAAAAAAP//////+AAAAAAAf//////AAAAAAAH///////wAAAAAAAD////////4AAAAAAAAA//////////gAAAAAAAAAB//////////gAAAAAAAAAf////////8AAAAAAAAB////////4AAAAAAAB///////8AAAAAAAP//////8AAAAAAH//////gAAAAAAP//////+AAAAAAAB////////wAAAAAAAAH/////////gAAAAAAAAAH/////////8AAAAAAAAAH////////+AAAAAAAAD////////wAAAAAAAH///////wAAAAAAB//////+AAAAAAD//////wAAAAAD//////8AAAAAAA///////+AAAAAAAAf////////gAAAAAAAAH/////////8AAAAAAAAAH/////////AAAAAAAAA////////8AAAAAAAA////////AAAAAAAH//////8AAAAAAD//////wAAAAAD/////8AAAAAAf//////gAAAAAAH///////gAAAAAAAH////////wAAAAAAAAB/////////8AAAAAAAAAf////////gAAAAAAAB////////AAAAAAAA///////4AAAAAAB//////8AAAAAAP/////8AAAAAD/////4AAAAAD//////gAAAAAAf//////4AAAAAAAP///////+AAAAAAAAD/////////gAAAAAAAAH////////4AAAAAAAA////////gAAAAAAA///////4AAAAAAD//////4AAAAAA//////gAAAAAf////+AAAAAP/////gAAAAAH//////gAAAAAAP//////+AAAAAAAB////////4AAAAAAAAH////////8AAAAAAAAH///////+AAAAAAAB///////4AAAAAAD//////8AAAAAAP/////+AAAAAB/////8AAAAAP////8AAAAB/////4AAAAAD//////AAAAAAB///////gAAAAAAB////////gAAAAAAAA////////+AAAAAAAAP///////4AAAAAAAf//////8AAAAAAB//////4AAAAAA//////wAAAAAP////+AAAAAP////8AAAAH////8AAAAA/////+AAAAAAf/////8AAAAAAD///////gAAAAAAA////////4AAAAAAAAf///////4AAAAAAAP//////+AAAAAAAf//////AAAAAAD//////AAAAAA/////8AAAAAP////8AAAAH////4AAAA/////AAAAAf////8AAAAAD//////AAAAAAD//////+AAAAAAAH///////4AAAAAAAA////////AAAAAAAD///////AAAAAAAf/////+AAAAAAP/////wAAAAAP////+AAAAAP////wAAAAP////AAAAH///+AAAAH////wAAAAD/////wAAAAAP/////8AAAAAAP//////8AAAAAAAP///////4AAAAAAAP//////+AAAAAAA///////AAAAAAH/////+AAAAAB/////8AAAAAf////wAAAAH////gAAAB////gAAAH///4AAAB////wAAAAP////4AAAAA/////+AAAAAAf/////+AAAAAAA///////4AAAAAAAP//////+AAAAAAA//////+AAAAAAP/////8AAAAAH/////wAAAAB/////AAAAA////+AAAAP///+AAAB////AAAD///4AAAD////AAAAD////8AAAAA/////8AAAAAD//////AAAAAAB///////AAAAAAAD//////+AAAAAAB//////4AAAAAB/////+AAAAAD/////gAAAAH////4AAAAP////AAAAH///8AAAD///4AAAP//8AAAf///AAAA////wAAAB////+AAAAA/////4AAAAAP/////8AAAAAAP//////wAAAAAAD//////4AAAAAAf/////wAAAAAP/////gAAAAD/////AAAAA////+AAAAP///8AAAA////AAAB///4AAA///wAAH//8AAAP///AAAA////gAAAB////4AAAAD/////gAAAAA//////AAAAAAD//////8AAAAAAP/////+AAAAAAf/////AAAAAD/////gAAAAP////wAAAA////8AAAB////AAAA///+AAAP///AAAf//wAAP//wAAf//4AAB///4AAAH///8AAAA////8AAAAD/////AAAAAD/////8AAAAAAf/////+AAAAAAP/////wAAAAAf////+AAAAAf////wAAAAP////AAAAH///+AAAB///+AAAH///gAAH//+AAA//+AAB//4AAf/8AAD//8AAB///4AAA////AAAAf///8AAAAP////4AAAAB/////4AAAAAD//////gAAAAAP/////gAAAAB/////wAAAAP////wAAAA////4AAAA////AAAA///8AAAP//+AAAf//gAAf//gAB//4AAf/4AD//AAD//4AAP//4AAB///wAAAf///gAAAP///+AAAAD////+AAAAAP/////gAAAAAP/////gAAAAB/////wAAAAP////wAAAAf///4AAAB////AAAA///8AAAP//8AAAf//gAAf//AAB//4AA//wAD//AA//AA//gAD//gAB//+AAB///gAAD///4AAAP///8AAAAf////AAAAA/////4AAAAAf/////AAAAAH////8AAAAD////4AAAA////wAAAH///4AAAP///AAAH//+AAA///gAA//+AAH//AAH/+AA//gAf/gA/8AH/gA//wAH/8AAP//AAD//+AAA///4AAAf///AAAAf///8AAAAP////wAAAAD/////wAAAAH////8AAAAH////gAAAH///+AAAB///8AAAH///AAAH//8AAB//8AAH//wAB//wAB//AAf/gAP/AB/8AH+AP+Af8AP/gAf/AAf/4AA//wAAP//gAAP//8AAAf///AAAA////wAAAB////8AAAAB/////AAAAA////8AAAAP///8AAAB///8AAAH///gAAD///AAAf//gAA///AAH//AAH/8AB//gAf/AB/8AH/AH/AP+A/gP4D+A/8AP+AH/wAH/4AD//gAB//wAAP//wAAD///gAAB///+AAAA////4AAAAP////wAAAA////8AAAA////gAAAf//+AAAH///AAAP//8AAD//4AAP//AAH//AAf/4AD/8AH/4AP/AH/AD/gH8B/Af4HwfA+D4PwD/AP8A/4AP/gA//AAf/4AB//4AAP//gAAH//+AAAP///gAAAf///4AAAAf///+AAAAf///4AAAH///wAAA///8AAA///wAAP//wAAf/+AAH/+AAf/4AB/8AD/8AH/gD/wA/4D/Af4D+B8D4HwPh44cOPHDgfwPwH4H+AP+AH/AD/+AB/+AAf/8AAf/+AAB//+AAAP//+AAAD///8AAAA////wAAAH///4AAAP///AAAH//+AAA///AAA//8AAH//AAP/+AAf/gAf/gA/8AP/AD/gH+Af4B+B+B+D8Dw8OHhw8OybJsk2TYfD4fB4PAfwD+AfwB/4AP/AB//AAf/wAB//4AAP//wAAH//8AAAP///gAAAP///wAAAf///AAAP//+AAA///gAAf/+AAD//gAD//AAP/wAH/4AP/AB/4Af4A/wD/APwPwPwH4eHh4fDw5mZmZmZmAAAAAAABxzjjnHGPgfA/A+B/gH/AP+AP/wAf/gAf/4AA//wAAf//gAAf//4AAAg=";

let r225Por07Buffer=null;
let r225Por07BufferContext=null;


function r225DecodePor07Buffer(){
  if(
    !audioCtx ||
    !audioReady
  ){
    return null;
  }

  if(
    r225Por07Buffer &&
    r225Por07BufferContext===audioCtx
  ){
    return r225Por07Buffer;
  }

  const packedString=
    atob(R225_POR07_PACKED_BASE64);

  const packed=
    new Uint8Array(
      packedString.length
    );

  for(let i=0;i<packedString.length;i++){
    packed[i]=
      packedString.charCodeAt(i)&255;
  }

  const totalSamples=
    R225_POR07_LEAD_SAMPLES+
    R225_POR07_SIGNAL_SAMPLES+
    R225_POR07_TAIL_SAMPLES;

  const buffer=
    audioCtx.createBuffer(
      1,
      totalSamples,
      R225_POR07_SAMPLE_RATE
    );

  const channel=
    buffer.getChannelData(0);

  /*
    Authentic PC-speaker character: a hard one-bit square-wave phase. Keep the
    source deliberately dry; the shared SFX gain already provides global level
    control and all spell-specific effects continue to layer independently.
  */
  const amplitude=0.92;
  const signalStart=
    R225_POR07_LEAD_SAMPLES;

  for(let i=0;i<R225_POR07_SIGNAL_SAMPLES;i++){
    const byte=
      packed[i>>3];

    const bit=
      (
        byte>>
        (7-(i&7))
      )&1;

    channel[
      signalStart+i
    ]=
      bit
        ? amplitude
        : -amplitude;
  }

  r225Por07Buffer=buffer;
  r225Por07BufferContext=audioCtx;

  return buffer;
}


function playPor07CastingSound(){
  queueSfx(()=>{
    const buffer=
      r225DecodePor07Buffer();

    if(!buffer) return;

    const now=
      audioCtx.currentTime;

    const source=
      audioCtx.createBufferSource();

    const gain=
      audioCtx.createGain();

    source.buffer=buffer;

    /*
      The reconstructed beeper waveform is intentionally much hotter than the
      engine's synthesized effects. Pull it down here while retaining the
      characteristic hard square-wave texture.
    */
    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      0.085,
      now+0.006
    );

    gain.gain.setValueAtTime(
      0.085,
      now+
      Math.max(
        0.01,
        buffer.duration-0.022
      )
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now+buffer.duration
    );

    source.connect(gain);
    gain.connect(sfxGain);

    source.start(now);
    source.stop(
      now+
      buffer.duration+
      0.02
    );
  });
}


/* ============================================================
   SHARED SPELL-COMMIT HOOK
   ============================================================ */

const r225BaseCommitSpellCast=
  commitSpellCast;

commitSpellCast=function(
  caster,
  spell,
  action,
  durationMs=1800
){
  const committed=
    r225BaseCommitSpellCast(
      caster,
      spell,
      action,
      durationMs
    );

  /*
    Only successful spell commits play the universal cast cue. A Deafness
    miscast, exhausted memorized spell, or other failed commit remains silent.
    Hypnotic Pattern still receives this non-verbal casting SFX even though it
    correctly has no spoken incantation.
  */
  if(committed){
    playPor07CastingSound();
  }

  return committed;
};


window.AdventurePartyCastingSound={
  play:playPor07CastingSound,
  source:"Pool of Radiance DOS PC-speaker SFX #07 reconstruction",
  sampleRate:R225_POR07_SAMPLE_RATE
};
