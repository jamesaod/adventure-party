"use strict";

// R169 final auto-merge trigger under required validation.

// R169 required-check auto-merge gate test.

// R169 auto-merge workflow test: no gameplay behavior changed.

// R168 workflow test: incremental repository update confirmed.


async function verifyLocalGoldBoxFont(){
  const status=document.getElementById("fontStatus");

  try{
    if(!document.fonts){
      throw new Error("Font Loading API unavailable.");
    }

    /*
      Force the browser to request the local project asset. With the
      supplied localhost launcher this path is same-origin.
    */
    await document.fonts.load('18px "AdventureGoldBox"');
    await document.fonts.ready;

    const loaded=document.fonts.check(
      '18px "AdventureGoldBox"',
      "ADVENTURE PARTY GOLD BOX 0123456789"
    );

    if(!loaded){
      throw new Error("Gold Box font not available.");
    }

    if(status){
      status.textContent="FONT: GOLD BOX — LOCAL ASSET LOADED";
      status.classList.remove("font-missing");
      status.classList.add("font-ok");
    }

    document.documentElement.dataset.uiFont="gold-box-local";

    if(game && typeof draw==="function"){
      draw();
    }
  }catch(error){
    if(status){
      status.textContent="FONT: MISSING — RUN Run_Adventure_Party.bat";
      status.classList.remove("font-ok");
      status.classList.add("font-missing");
    }

    document.documentElement.dataset.uiFont="fallback";
  }
}



/* ============================================================
   SINGLE-PAGE SCREEN ROUTER
   ============================================================ */

let currentScreen="launcher";
let launcherSelection=0;

const launcherScreen=document.getElementById("launcherScreen");
const combatScreen=document.getElementById("combatScreen");
const combatConditionsScreen=document.getElementById("combatConditionsScreen");
const xpLootScreen=document.getElementById("xpLootScreen");
const pixelScreen=document.getElementById("pixelScreen");
const spellbookScreen=document.getElementById("spellbookScreen");
const classbookScreen=document.getElementById("classbookScreen");
const launcherButtons=[...document.querySelectorAll(".launcher-menu button")];

function renderBuildMetadata(){
  const source=document.getElementById("buildMetadata");
  const label=document.getElementById("buildLabel");
  if(!source || !label) return;

  try{
    const build=JSON.parse(source.textContent || "{}");
    const builtAt=new Date(build.builtAt);

    if(
      typeof build.architecture!=="string" ||
      typeof build.release!=="string" ||
      !Number.isFinite(builtAt.getTime())
    ){
      throw new Error("Invalid build metadata.");
    }

    const dateText=new Intl.DateTimeFormat(undefined,{
      year:"numeric",
      month:"short",
      day:"numeric"
    }).format(builtAt);

    const timeText=new Intl.DateTimeFormat(undefined,{
      hour:"numeric",
      minute:"2-digit"
    }).format(builtAt);

    label.innerHTML=
      build.architecture+"<br>"+
      "Build "+build.release+"<br>"+
      dateText+" • "+timeText;
  }catch(error){
    label.textContent="BUILD METADATA ERROR";
    console.error(error);
  }
}

renderBuildMetadata();

function updateLauncherSelection(){
  launcherButtons.forEach((button,index)=>{
    button.classList.toggle("selected",index===launcherSelection);
  });
}

function showLauncher(){
  currentScreen="launcher";
  stopWeatherAudio();
  classReportOpen=false;
  characterSheetOpen=false;
  spellCastOverlayOpen=false;
  document.getElementById("spellCastOverlay")?.classList.remove("show");
  quickCommandUnitIds.clear();
  quickCommandActive=false;
  quickCommandUnitId=null;
  quickCommandGeneration++;
  quickCommandRunning=false;

  const classOverlay=document.getElementById("classOverlay");
  if(classOverlay) classOverlay.classList.remove("show");

  const sheetOverlay=document.getElementById("sheetOverlay");
  if(sheetOverlay) sheetOverlay.classList.remove("show");

  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }

  combatOpeningSpeechDone=false;
  combatAwaitingStart=false;
  if(combatMessageClearTimer){
    clearTimeout(combatMessageClearTimer);
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(combatMessageFlashTimer);
    combatMessageFlashTimer=null;
  }

  combatMessageSequence++;
  combatMessageText="";
  combatMessageTone="normal";
  combatMessageHoldUntil=0;

  combatScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  launcherScreen.classList.add("active");

  updateAudioIndicators();

  if(audioEnabled && audioReady){
    startTitleMusic();
  }
}

let selectedCombatCondition="grass";
let selectedMobEncounter="kobolds";

function updateCombatMobSelection(){
  const label=document.getElementById("combatMobSetLabel");
  const button=document.getElementById("largeMobTestButton");
  const large=selectedMobEncounter==="large-test";

  if(label){
    label.textContent=large ? "Juvenile Red Dragon" : "Kobold Encounter";
  }

  if(button){
    button.textContent=large ? "Use Kobold Encounter" : "Use Juvenile Red Dragon";
    button.classList.toggle("selected",large);
    button.setAttribute("aria-pressed",large ? "true" : "false");
  }
}

function updateCombatConditionSelection(){
  document.querySelectorAll("[data-combat-condition]").forEach(button=>{
    const selected=button.dataset.combatCondition===selectedCombatCondition;
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-pressed",selected ? "true" : "false");
  });
}

function showCombatConditions(){
  currentScreen="combat-conditions";
  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatScreen.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  combatConditionsScreen.classList.add("active");
  updateCombatConditionSelection();
  updateCombatMobSelection();
  updateAudioIndicators();
}

function showCombat(condition=selectedCombatCondition){
  selectedCombatCondition=condition || "grass";
  currentScreen="combat";

  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  combatScreen.classList.add("active");

  updateAudioIndicators();

  try{
    newGame(selectedCombatCondition);
    fitBattleCanvas();
    requestAnimationFrame(draw);
    syncWeatherAudio();
  }catch(error){
    console.error("Combat initialization failed:",error);

    const banner=document.getElementById("turnBanner");
    const logBox=document.getElementById("combatLog");

    if(banner){
      banner.textContent="COMBAT INITIALIZATION ERROR";
    }

    if(logBox){
      logBox.innerHTML="";
      const line=document.createElement("div");
      line.className="log-line bad";
      line.textContent="Initialization error: "+(error?.message || String(error));
      logBox.appendChild(line);
    }
  }
}

function showSpellBook(){
  currentScreen="spellbook";

  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  combatScreen.classList.remove("active");
  pixelScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  spellbookScreen.classList.add("active");

  renderSpellBook();
  updateAudioIndicators();
}

function showClassBook(){
  currentScreen="classbook";

  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  combatScreen.classList.remove("active");
  pixelScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.add("active");

  renderClassBook();
  updateAudioIndicators();
}

async function showPixelEditor(){
  currentScreen="pixel";

  stopTitleMusic();
  launcherScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  xpLootScreen?.classList.remove("active");
  combatScreen.classList.remove("active");
  spellbookScreen.classList.remove("active");
  classbookScreen.classList.remove("active");
  pixelScreen.classList.add("active");

  updateAudioIndicators();

  await initializePixelEditor();
}

async function activateLauncherSelection(){
  const button=launcherButtons[launcherSelection];
  const target=button.dataset.screen;

  await unlockAudio();

  if(target==="combat"){
    showCombatConditions();
    return;
  }

  if(target==="spellbook"){
    showSpellBook();
    return;
  }

  if(target==="classbook"){
    showClassBook();
    return;
  }

  if(target==="pixel"){
    await showPixelEditor();
    return;
  }

  alert(button.textContent+" is not connected yet.");
}

launcherButtons.forEach((button,index)=>{
  button.addEventListener("mouseenter",()=>{
    launcherSelection=index;
    updateLauncherSelection();
  });

  button.addEventListener("click",async()=>{
    launcherSelection=index;
    updateLauncherSelection();
    await activateLauncherSelection();
  });
});

updateLauncherSelection();



document.querySelectorAll("[data-combat-condition]").forEach(button=>{
  button.addEventListener("click",()=>{
    selectedCombatCondition=button.dataset.combatCondition || "grass";
    updateCombatConditionSelection();
  });
});

document.getElementById("largeMobTestButton")?.addEventListener("click",()=>{
  selectedMobEncounter=
    selectedMobEncounter==="large-test"
      ? "kobolds"
      : "large-test";
  updateCombatMobSelection();
});

document.getElementById("beginBattleButton")?.addEventListener("click",()=>{
  showCombat(selectedCombatCondition);
});

document.getElementById("combatConditionsReturnButton")?.addEventListener("click",showLauncher);
document.getElementById("xpLootAgainButton")?.addEventListener("click",showCombatConditions);
document.getElementById("xpLootLauncherButton")?.addEventListener("click",showLauncher);

/* ============================================================
   SHARED AUDIO ENGINE
   One AudioContext lives for the entire application.
   ============================================================ */

const titleEvents=[{"t":0.0,"n":74,"v":127,"c":0,"p":46},{"t":0.352941,"n":74,"v":127,"c":0,"p":46},{"t":0.529411,"n":77,"v":127,"c":0,"p":46},{"t":0.617647,"n":76,"v":127,"c":0,"p":46},{"t":0.705882,"n":77,"v":127,"c":0,"p":46},{"t":0.794117,"n":76,"v":127,"c":0,"p":46},{"t":0.882352,"n":76,"v":127,"c":0,"p":46},{"t":1.058823,"n":77,"v":127,"c":0,"p":46},{"t":1.058823,"n":62,"v":127,"c":0,"p":46},{"t":1.411764,"n":77,"v":127,"c":0,"p":46},{"t":1.411764,"n":62,"v":127,"c":0,"p":46},{"t":1.588234,"n":76,"v":127,"c":0,"p":46},{"t":1.588234,"n":64,"v":127,"c":0,"p":46},{"t":1.941175,"n":76,"v":127,"c":0,"p":46},{"t":1.941175,"n":64,"v":127,"c":0,"p":46},{"t":2.117646,"n":74,"v":127,"c":0,"p":46},{"t":2.117646,"n":65,"v":127,"c":0,"p":46},{"t":2.470587,"n":73,"v":127,"c":0,"p":46},{"t":2.470587,"n":64,"v":127,"c":0,"p":46},{"t":2.647057,"n":74,"v":127,"c":0,"p":46},{"t":2.647057,"n":65,"v":127,"c":0,"p":46},{"t":2.999998,"n":76,"v":127,"c":0,"p":46},{"t":2.999998,"n":67,"v":127,"c":0,"p":46},{"t":3.176469,"n":74,"v":127,"c":0,"p":46},{"t":3.176469,"n":57,"v":127,"c":0,"p":46},{"t":3.264704,"n":73,"v":127,"c":0,"p":46},{"t":3.352939,"n":74,"v":127,"c":0,"p":46},{"t":3.441175,"n":73,"v":127,"c":0,"p":46},{"t":3.70588,"n":69,"v":127,"c":0,"p":46},{"t":4.058821,"n":67,"v":127,"c":0,"p":46},{"t":4.235292,"n":65,"v":127,"c":0,"p":46},{"t":4.411763,"n":69,"v":127,"c":0,"p":46},{"t":4.588233,"n":74,"v":127,"c":0,"p":46},{"t":4.764704,"n":64,"v":127,"c":0,"p":46},{"t":5.117645,"n":72,"v":127,"c":0,"p":46},{"t":5.294115,"n":62,"v":127,"c":0,"p":46},{"t":5.470586,"n":65,"v":127,"c":0,"p":46},{"t":5.647056,"n":70,"v":127,"c":0,"p":46},{"t":5.823527,"n":60,"v":127,"c":0,"p":46},{"t":6.176468,"n":69,"v":127,"c":0,"p":46},{"t":6.352938,"n":58,"v":127,"c":0,"p":46},{"t":6.529409,"n":62,"v":127,"c":0,"p":46},{"t":6.705879,"n":69,"v":127,"c":0,"p":46},{"t":6.88235,"n":69,"v":127,"c":0,"p":46},{"t":6.970585,"n":67,"v":127,"c":0,"p":46},{"t":7.05882,"n":69,"v":127,"c":0,"p":46},{"t":7.147055,"n":67,"v":127,"c":0,"p":46},{"t":7.235291,"n":67,"v":127,"c":0,"p":46},{"t":7.411761,"n":69,"v":127,"c":0,"p":46},{"t":7.764702,"n":57,"v":127,"c":0,"p":46},{"t":7.941173,"n":69,"v":127,"c":0,"p":46},{"t":8.470584,"n":74,"v":127,"c":0,"p":46},{"t":8.823525,"n":74,"v":127,"c":0,"p":46},{"t":8.999996,"n":77,"v":127,"c":0,"p":46},{"t":9.088231,"n":76,"v":127,"c":0,"p":46},{"t":9.176466,"n":77,"v":127,"c":0,"p":46},{"t":9.264701,"n":76,"v":127,"c":0,"p":46},{"t":9.352937,"n":76,"v":127,"c":0,"p":46},{"t":9.529407,"n":77,"v":127,"c":0,"p":46},{"t":9.529407,"n":62,"v":127,"c":0,"p":46},{"t":9.882348,"n":77,"v":127,"c":0,"p":46},{"t":9.882348,"n":62,"v":127,"c":0,"p":46},{"t":10.058819,"n":76,"v":127,"c":0,"p":46},{"t":10.058819,"n":64,"v":127,"c":0,"p":46},{"t":10.41176,"n":76,"v":127,"c":0,"p":46},{"t":10.41176,"n":64,"v":127,"c":0,"p":46},{"t":10.58823,"n":74,"v":127,"c":0,"p":46},{"t":10.58823,"n":65,"v":127,"c":0,"p":46},{"t":10.941171,"n":73,"v":127,"c":0,"p":46},{"t":10.941171,"n":64,"v":127,"c":0,"p":46},{"t":11.117642,"n":74,"v":127,"c":0,"p":46},{"t":11.117642,"n":65,"v":127,"c":0,"p":46},{"t":11.470583,"n":76,"v":127,"c":0,"p":46},{"t":11.470583,"n":67,"v":127,"c":0,"p":46},{"t":11.647053,"n":74,"v":127,"c":0,"p":46},{"t":11.647053,"n":57,"v":127,"c":0,"p":46},{"t":11.735288,"n":73,"v":127,"c":0,"p":46},{"t":11.823524,"n":74,"v":127,"c":0,"p":46},{"t":11.911759,"n":73,"v":127,"c":0,"p":46},{"t":12.176465,"n":69,"v":127,"c":0,"p":46},{"t":12.529406,"n":67,"v":127,"c":0,"p":46},{"t":12.705876,"n":65,"v":127,"c":0,"p":46},{"t":12.882347,"n":69,"v":127,"c":0,"p":46},{"t":13.058817,"n":74,"v":127,"c":0,"p":46},{"t":13.235288,"n":64,"v":127,"c":0,"p":46},{"t":13.588229,"n":72,"v":127,"c":0,"p":46},{"t":13.764699,"n":62,"v":127,"c":0,"p":46},{"t":13.94117,"n":65,"v":127,"c":0,"p":46},{"t":14.11764,"n":70,"v":127,"c":0,"p":46},{"t":14.294111,"n":60,"v":127,"c":0,"p":46},{"t":14.647052,"n":69,"v":127,"c":0,"p":46},{"t":14.823522,"n":58,"v":127,"c":0,"p":46},{"t":14.999993,"n":62,"v":127,"c":0,"p":46},{"t":15.176463,"n":69,"v":127,"c":0,"p":46},{"t":15.352934,"n":69,"v":127,"c":0,"p":46},{"t":15.441169,"n":67,"v":127,"c":0,"p":46},{"t":15.529404,"n":69,"v":127,"c":0,"p":46},{"t":15.617639,"n":67,"v":127,"c":0,"p":46},{"t":15.705875,"n":67,"v":127,"c":0,"p":46},{"t":15.882345,"n":69,"v":127,"c":0,"p":46},{"t":16.235286,"n":57,"v":127,"c":0,"p":46},{"t":16.411757,"n":69,"v":127,"c":0,"p":46},{"t":16.941168,"n":69,"v":127,"c":0,"p":46},{"t":17.294109,"n":69,"v":127,"c":0,"p":46},{"t":17.47058,"n":72,"v":127,"c":0,"p":46},{"t":17.558815,"n":71,"v":127,"c":0,"p":46},{"t":17.64705,"n":72,"v":127,"c":0,"p":46},{"t":17.735285,"n":71,"v":127,"c":0,"p":46},{"t":17.823521,"n":71,"v":127,"c":0,"p":46},{"t":17.999991,"n":72,"v":127,"c":0,"p":46},{"t":17.999991,"n":57,"v":127,"c":0,"p":46},{"t":18.352932,"n":72,"v":127,"c":0,"p":46},{"t":18.352932,"n":57,"v":127,"c":0,"p":46},{"t":18.529403,"n":71,"v":127,"c":0,"p":46},{"t":18.529403,"n":59,"v":127,"c":0,"p":46},{"t":18.882344,"n":71,"v":127,"c":0,"p":46},{"t":18.882344,"n":59,"v":127,"c":0,"p":46},{"t":19.058814,"n":69,"v":127,"c":0,"p":46},{"t":19.058814,"n":60,"v":127,"c":0,"p":46},{"t":19.411755,"n":68,"v":127,"c":0,"p":46},{"t":19.411755,"n":59,"v":127,"c":0,"p":46},{"t":19.588226,"n":69,"v":127,"c":0,"p":46},{"t":19.588226,"n":60,"v":127,"c":0,"p":46},{"t":19.941167,"n":71,"v":127,"c":0,"p":46},{"t":19.941167,"n":62,"v":127,"c":0,"p":46},{"t":20.117637,"n":69,"v":127,"c":0,"p":46},{"t":20.205872,"n":68,"v":127,"c":0,"p":46},{"t":20.294108,"n":69,"v":127,"c":0,"p":46},{"t":20.382343,"n":68,"v":127,"c":0,"p":46},{"t":20.470578,"n":64,"v":127,"c":0,"p":46},{"t":20.647049,"n":52,"v":127,"c":0,"p":46},{"t":20.99999,"n":62,"v":127,"c":0,"p":46},{"t":21.17646,"n":60,"v":127,"c":0,"p":46},{"t":21.352931,"n":76,"v":127,"c":0,"p":46},{"t":21.529401,"n":69,"v":127,"c":0,"p":46},{"t":21.705872,"n":59,"v":127,"c":0,"p":46},{"t":21.882342,"n":74,"v":127,"c":0,"p":46},{"t":22.058813,"n":67,"v":127,"c":0,"p":46},{"t":22.235283,"n":57,"v":127,"c":0,"p":46},{"t":22.411754,"n":72,"v":127,"c":0,"p":46},{"t":22.588224,"n":65,"v":127,"c":0,"p":46},{"t":22.764695,"n":55,"v":127,"c":0,"p":46},{"t":22.941165,"n":59,"v":127,"c":0,"p":46},{"t":23.117636,"n":64,"v":127,"c":0,"p":46},{"t":23.294106,"n":69,"v":127,"c":0,"p":46},{"t":23.294106,"n":53,"v":127,"c":0,"p":46},{"t":23.470577,"n":62,"v":127,"c":0,"p":46},{"t":23.647047,"n":71,"v":127,"c":0,"p":46},{"t":23.823518,"n":52,"v":127,"c":0,"p":46},{"t":23.999988,"n":69,"v":127,"c":0,"p":46},{"t":24.176459,"n":68,"v":127,"c":0,"p":46},{"t":24.352929,"n":69,"v":127,"c":0,"p":46},{"t":24.882341,"n":57,"v":127,"c":0,"p":46},{"t":25.411752,"n":72,"v":127,"c":0,"p":46},{"t":25.411752,"n":69,"v":127,"c":0,"p":46},{"t":25.411752,"n":53,"v":127,"c":0,"p":46},{"t":25.764693,"n":72,"v":127,"c":0,"p":46},{"t":25.764693,"n":69,"v":127,"c":0,"p":46},{"t":25.941164,"n":72,"v":127,"c":0,"p":46},{"t":25.941164,"n":67,"v":127,"c":0,"p":46},{"t":25.941164,"n":52,"v":127,"c":0,"p":46},{"t":26.294105,"n":72,"v":127,"c":0,"p":46},{"t":26.294105,"n":67,"v":127,"c":0,"p":46},{"t":26.470575,"n":72,"v":127,"c":0,"p":46},{"t":26.470575,"n":69,"v":127,"c":0,"p":46},{"t":26.470575,"n":53,"v":127,"c":0,"p":46},{"t":26.823516,"n":72,"v":127,"c":0,"p":46},{"t":26.823516,"n":69,"v":127,"c":0,"p":46},{"t":26.999987,"n":72,"v":127,"c":0,"p":46},{"t":26.999987,"n":67,"v":127,"c":0,"p":46},{"t":26.999987,"n":60,"v":127,"c":0,"p":46},{"t":27.529398,"n":53,"v":127,"c":0,"p":46},{"t":27.705869,"n":69,"v":127,"c":0,"p":46},{"t":27.882339,"n":72,"v":127,"c":0,"p":46},{"t":28.05881,"n":52,"v":127,"c":0,"p":46},{"t":28.23528,"n":67,"v":127,"c":0,"p":46},{"t":28.411751,"n":72,"v":127,"c":0,"p":46},{"t":28.588221,"n":53,"v":127,"c":0,"p":46},{"t":28.764692,"n":69,"v":127,"c":0,"p":46},{"t":28.941162,"n":72,"v":127,"c":0,"p":46},{"t":29.117633,"n":72,"v":127,"c":0,"p":46},{"t":29.117633,"n":67,"v":127,"c":0,"p":46},{"t":29.117633,"n":48,"v":127,"c":0,"p":46},{"t":29.647044,"n":50,"v":127,"c":0,"p":46},{"t":29.823515,"n":77,"v":127,"c":0,"p":46},{"t":29.999985,"n":70,"v":127,"c":0,"p":46},{"t":30.176456,"n":52,"v":127,"c":0,"p":46},{"t":30.352926,"n":79,"v":127,"c":0,"p":46},{"t":30.529397,"n":72,"v":127,"c":0,"p":46},{"t":30.705867,"n":53,"v":127,"c":0,"p":46},{"t":30.882338,"n":81,"v":127,"c":0,"p":46},{"t":31.058808,"n":72,"v":127,"c":0,"p":46},{"t":31.235279,"n":55,"v":127,"c":0,"p":46},{"t":31.411749,"n":82,"v":127,"c":0,"p":46},{"t":31.58822,"n":76,"v":127,"c":0,"p":46},{"t":31.76469,"n":84,"v":127,"c":0,"p":46},{"t":31.76469,"n":57,"v":127,"c":0,"p":46},{"t":31.941161,"n":77,"v":127,"c":0,"p":46},{"t":32.117631,"n":79,"v":127,"c":0,"p":46},{"t":32.294102,"n":48,"v":127,"c":0,"p":46},{"t":32.470572,"n":67,"v":127,"c":0,"p":46},{"t":32.647043,"n":76,"v":127,"c":0,"p":46},{"t":32.823513,"n":77,"v":127,"c":0,"p":46},{"t":33.176454,"n":53,"v":127,"c":0,"p":46},{"t":33.352925,"n":77,"v":127,"c":0,"p":46},{"t":33.352925,"n":69,"v":127,"c":0,"p":46},{"t":33.882336,"n":72,"v":127,"c":0,"p":46},{"t":33.882336,"n":69,"v":127,"c":0,"p":46},{"t":33.882336,"n":53,"v":127,"c":0,"p":46},{"t":34.235277,"n":72,"v":127,"c":0,"p":46},{"t":34.235277,"n":69,"v":127,"c":0,"p":46},{"t":34.411748,"n":72,"v":127,"c":0,"p":46},{"t":34.411748,"n":67,"v":127,"c":0,"p":46},{"t":34.411748,"n":52,"v":127,"c":0,"p":46},{"t":34.764689,"n":72,"v":127,"c":0,"p":46},{"t":34.764689,"n":67,"v":127,"c":0,"p":46},{"t":34.941159,"n":74,"v":127,"c":0,"p":46},{"t":34.941159,"n":69,"v":127,"c":0,"p":46},{"t":34.941159,"n":50,"v":127,"c":0,"p":46},{"t":35.2941,"n":74,"v":127,"c":0,"p":46},{"t":35.2941,"n":69,"v":127,"c":0,"p":46},{"t":35.470571,"n":76,"v":127,"c":0,"p":46},{"t":35.470571,"n":69,"v":127,"c":0,"p":46},{"t":35.470571,"n":61,"v":127,"c":0,"p":46},{"t":35.823512,"n":76,"v":127,"c":0,"p":46},{"t":35.823512,"n":69,"v":127,"c":0,"p":46},{"t":35.999982,"n":77,"v":127,"c":0,"p":46},{"t":35.999982,"n":69,"v":127,"c":0,"p":46},{"t":35.999982,"n":62,"v":127,"c":0,"p":46},{"t":36.352923,"n":76,"v":127,"c":0,"p":46},{"t":36.352923,"n":60,"v":127,"c":0,"p":46},{"t":36.529393,"n":74,"v":127,"c":0,"p":46},{"t":36.529393,"n":58,"v":127,"c":0,"p":46},{"t":36.705864,"n":57,"v":127,"c":0,"p":46},{"t":36.882334,"n":76,"v":127,"c":0,"p":46},{"t":36.882334,"n":55,"v":127,"c":0,"p":46},{"t":37.058805,"n":74,"v":127,"c":0,"p":46},{"t":37.058805,"n":57,"v":127,"c":0,"p":46},{"t":37.14704,"n":73,"v":127,"c":0,"p":46},{"t":37.235275,"n":74,"v":127,"c":0,"p":46},{"t":37.323511,"n":73,"v":127,"c":0,"p":46},{"t":37.588216,"n":69,"v":127,"c":0,"p":46},{"t":38.117628,"n":66,"v":127,"c":0,"p":46},{"t":38.294098,"n":74,"v":127,"c":0,"p":46},{"t":38.470569,"n":84,"v":127,"c":0,"p":46},{"t":38.647039,"n":82,"v":127,"c":0,"p":46},{"t":38.647039,"n":74,"v":127,"c":0,"p":46},{"t":38.647039,"n":67,"v":127,"c":0,"p":46},{"t":38.99998,"n":82,"v":127,"c":0,"p":46},{"t":39.176451,"n":64,"v":127,"c":0,"p":46},{"t":39.352921,"n":72,"v":127,"c":0,"p":46},{"t":39.529392,"n":82,"v":127,"c":0,"p":46},{"t":39.705862,"n":81,"v":127,"c":0,"p":46},{"t":39.705862,"n":74,"v":127,"c":0,"p":46},{"t":39.705862,"n":65,"v":127,"c":0,"p":46},{"t":40.235274,"n":58,"v":127,"c":0,"p":46},{"t":40.411744,"n":74,"v":127,"c":0,"p":46},{"t":40.588215,"n":81,"v":127,"c":0,"p":46},{"t":40.764685,"n":79,"v":127,"c":0,"p":46},{"t":40.764685,"n":74,"v":127,"c":0,"p":46},{"t":40.764685,"n":52,"v":127,"c":0,"p":46},{"t":41.117626,"n":79,"v":127,"c":0,"p":46},{"t":41.294097,"n":57,"v":127,"c":0,"p":46},{"t":41.470567,"n":73,"v":127,"c":0,"p":46},{"t":41.647038,"n":79,"v":127,"c":0,"p":46},{"t":41.823508,"n":77,"v":127,"c":0,"p":46},{"t":41.823508,"n":74,"v":127,"c":0,"p":46},{"t":41.823508,"n":62,"v":127,"c":0,"p":46},{"t":42.176449,"n":77,"v":127,"c":0,"p":46},{"t":42.35292,"n":76,"v":127,"c":0,"p":46},{"t":42.35292,"n":70,"v":127,"c":0,"p":46},{"t":42.35292,"n":55,"v":127,"c":0,"p":46},{"t":42.52939,"n":77,"v":127,"c":0,"p":46},{"t":42.705861,"n":74,"v":127,"c":0,"p":46},{"t":42.882331,"n":57,"v":127,"c":0,"p":46},{"t":43.058802,"n":74,"v":127,"c":0,"p":46},{"t":43.235272,"n":73,"v":127,"c":0,"p":46},{"t":43.411743,"n":74,"v":127,"c":0,"p":46},{"t":43.411743,"n":62,"v":127,"c":0,"p":46},{"t":43.941154,"n":50,"v":127,"c":0,"p":46},{"t":44.470566,"n":69,"v":127,"c":0,"p":46},{"t":44.823507,"n":69,"v":127,"c":0,"p":46},{"t":44.999977,"n":72,"v":127,"c":0,"p":46},{"t":45.088213,"n":71,"v":127,"c":0,"p":46},{"t":45.176448,"n":72,"v":127,"c":0,"p":46},{"t":45.264683,"n":71,"v":127,"c":0,"p":46},{"t":45.352918,"n":71,"v":127,"c":0,"p":46},{"t":45.529389,"n":72,"v":127,"c":0,"p":46},{"t":45.529389,"n":57,"v":127,"c":0,"p":46},{"t":45.88233,"n":72,"v":127,"c":0,"p":46},{"t":45.88233,"n":57,"v":127,"c":0,"p":46},{"t":46.0588,"n":71,"v":127,"c":0,"p":46},{"t":46.0588,"n":59,"v":127,"c":0,"p":46},{"t":46.411741,"n":71,"v":127,"c":0,"p":46},{"t":46.411741,"n":59,"v":127,"c":0,"p":46},{"t":46.588212,"n":69,"v":127,"c":0,"p":46},{"t":46.588212,"n":60,"v":127,"c":0,"p":46},{"t":46.941153,"n":68,"v":127,"c":0,"p":46},{"t":46.941153,"n":59,"v":127,"c":0,"p":46},{"t":47.117623,"n":69,"v":127,"c":0,"p":46},{"t":47.117623,"n":60,"v":127,"c":0,"p":46},{"t":47.470564,"n":71,"v":127,"c":0,"p":46},{"t":47.470564,"n":62,"v":127,"c":0,"p":46},{"t":47.647035,"n":69,"v":127,"c":0,"p":46},{"t":47.73527,"n":68,"v":127,"c":0,"p":46},{"t":47.823505,"n":69,"v":127,"c":0,"p":46},{"t":47.911741,"n":68,"v":127,"c":0,"p":46},{"t":47.999976,"n":64,"v":127,"c":0,"p":46},{"t":48.176446,"n":52,"v":127,"c":0,"p":46},{"t":48.529387,"n":62,"v":127,"c":0,"p":46},{"t":48.705858,"n":60,"v":127,"c":0,"p":46},{"t":48.882328,"n":76,"v":127,"c":0,"p":46},{"t":49.058799,"n":69,"v":127,"c":0,"p":46},{"t":49.235269,"n":59,"v":127,"c":0,"p":46},{"t":49.41174,"n":74,"v":127,"c":0,"p":46},{"t":49.58821,"n":67,"v":127,"c":0,"p":46},{"t":49.764681,"n":57,"v":127,"c":0,"p":46},{"t":49.941151,"n":72,"v":127,"c":0,"p":46},{"t":50.117622,"n":65,"v":127,"c":0,"p":46},{"t":50.294092,"n":55,"v":127,"c":0,"p":46},{"t":50.470563,"n":59,"v":127,"c":0,"p":46},{"t":50.647033,"n":64,"v":127,"c":0,"p":46},{"t":50.823504,"n":69,"v":127,"c":0,"p":46},{"t":50.823504,"n":53,"v":127,"c":0,"p":46},{"t":50.999974,"n":62,"v":127,"c":0,"p":46},{"t":51.176445,"n":71,"v":127,"c":0,"p":46},{"t":51.352915,"n":52,"v":127,"c":0,"p":46},{"t":51.529386,"n":69,"v":127,"c":0,"p":46},{"t":51.705856,"n":68,"v":127,"c":0,"p":46},{"t":51.882327,"n":69,"v":127,"c":0,"p":46},{"t":52.411738,"n":57,"v":127,"c":0,"p":46},{"t":52.94115,"n":72,"v":127,"c":0,"p":46},{"t":52.94115,"n":69,"v":127,"c":0,"p":46},{"t":52.94115,"n":53,"v":127,"c":0,"p":46},{"t":53.294091,"n":72,"v":127,"c":0,"p":46},{"t":53.294091,"n":69,"v":127,"c":0,"p":46},{"t":53.470561,"n":72,"v":127,"c":0,"p":46},{"t":53.470561,"n":67,"v":127,"c":0,"p":46},{"t":53.470561,"n":52,"v":127,"c":0,"p":46},{"t":53.823502,"n":72,"v":127,"c":0,"p":46},{"t":53.823502,"n":67,"v":127,"c":0,"p":46},{"t":53.999973,"n":72,"v":127,"c":0,"p":46},{"t":53.999973,"n":69,"v":127,"c":0,"p":46},{"t":53.999973,"n":53,"v":127,"c":0,"p":46},{"t":54.352914,"n":72,"v":127,"c":0,"p":46},{"t":54.352914,"n":69,"v":127,"c":0,"p":46},{"t":54.529384,"n":72,"v":127,"c":0,"p":46},{"t":54.529384,"n":67,"v":127,"c":0,"p":46},{"t":54.529384,"n":60,"v":127,"c":0,"p":46},{"t":55.058796,"n":53,"v":127,"c":0,"p":46},{"t":55.235266,"n":69,"v":127,"c":0,"p":46},{"t":55.411737,"n":72,"v":127,"c":0,"p":46},{"t":55.588207,"n":52,"v":127,"c":0,"p":46},{"t":55.764678,"n":67,"v":127,"c":0,"p":46},{"t":55.941148,"n":72,"v":127,"c":0,"p":46},{"t":56.117619,"n":53,"v":127,"c":0,"p":46},{"t":56.294089,"n":69,"v":127,"c":0,"p":46},{"t":56.47056,"n":72,"v":127,"c":0,"p":46},{"t":56.64703,"n":72,"v":127,"c":0,"p":46},{"t":56.64703,"n":67,"v":127,"c":0,"p":46},{"t":56.64703,"n":48,"v":127,"c":0,"p":46},{"t":57.176442,"n":50,"v":127,"c":0,"p":46},{"t":57.352912,"n":77,"v":127,"c":0,"p":46},{"t":57.529383,"n":70,"v":127,"c":0,"p":46},{"t":57.705853,"n":52,"v":127,"c":0,"p":46},{"t":57.882324,"n":79,"v":127,"c":0,"p":46},{"t":58.058794,"n":72,"v":127,"c":0,"p":46},{"t":58.235265,"n":53,"v":127,"c":0,"p":46},{"t":58.411735,"n":81,"v":127,"c":0,"p":46},{"t":58.588206,"n":72,"v":127,"c":0,"p":46},{"t":58.764676,"n":55,"v":127,"c":0,"p":46},{"t":58.941147,"n":82,"v":127,"c":0,"p":46},{"t":59.117617,"n":76,"v":127,"c":0,"p":46},{"t":59.294088,"n":84,"v":127,"c":0,"p":46},{"t":59.294088,"n":57,"v":127,"c":0,"p":46},{"t":59.470558,"n":77,"v":127,"c":0,"p":46},{"t":59.647029,"n":79,"v":127,"c":0,"p":46},{"t":59.823499,"n":48,"v":127,"c":0,"p":46},{"t":59.99997,"n":67,"v":127,"c":0,"p":46},{"t":60.17644,"n":76,"v":127,"c":0,"p":46},{"t":60.352911,"n":77,"v":127,"c":0,"p":46},{"t":60.705852,"n":53,"v":127,"c":0,"p":46},{"t":60.882322,"n":77,"v":127,"c":0,"p":46},{"t":60.882322,"n":69,"v":127,"c":0,"p":46},{"t":61.411734,"n":72,"v":127,"c":0,"p":46},{"t":61.411734,"n":69,"v":127,"c":0,"p":46},{"t":61.411734,"n":53,"v":127,"c":0,"p":46},{"t":61.764675,"n":72,"v":127,"c":0,"p":46},{"t":61.764675,"n":69,"v":127,"c":0,"p":46},{"t":61.941145,"n":72,"v":127,"c":0,"p":46},{"t":61.941145,"n":67,"v":127,"c":0,"p":46},{"t":61.941145,"n":52,"v":127,"c":0,"p":46},{"t":62.294086,"n":72,"v":127,"c":0,"p":46},{"t":62.294086,"n":67,"v":127,"c":0,"p":46},{"t":62.470557,"n":74,"v":127,"c":0,"p":46},{"t":62.470557,"n":69,"v":127,"c":0,"p":46},{"t":62.470557,"n":50,"v":127,"c":0,"p":46},{"t":62.823498,"n":74,"v":127,"c":0,"p":46},{"t":62.823498,"n":69,"v":127,"c":0,"p":46},{"t":62.999968,"n":76,"v":127,"c":0,"p":46},{"t":62.999968,"n":69,"v":127,"c":0,"p":46},{"t":62.999968,"n":61,"v":127,"c":0,"p":46},{"t":63.352909,"n":76,"v":127,"c":0,"p":46},{"t":63.352909,"n":69,"v":127,"c":0,"p":46},{"t":63.52938,"n":77,"v":127,"c":0,"p":46},{"t":63.52938,"n":69,"v":127,"c":0,"p":46},{"t":63.52938,"n":62,"v":127,"c":0,"p":46},{"t":63.882321,"n":76,"v":127,"c":0,"p":46},{"t":63.882321,"n":60,"v":127,"c":0,"p":46},{"t":64.058791,"n":74,"v":127,"c":0,"p":46},{"t":64.058791,"n":58,"v":127,"c":0,"p":46},{"t":64.235262,"n":57,"v":127,"c":0,"p":46},{"t":64.411732,"n":76,"v":127,"c":0,"p":46},{"t":64.411732,"n":55,"v":127,"c":0,"p":46},{"t":64.588203,"n":74,"v":127,"c":0,"p":46},{"t":64.588203,"n":57,"v":127,"c":0,"p":46},{"t":64.676438,"n":73,"v":127,"c":0,"p":46},{"t":64.764673,"n":74,"v":127,"c":0,"p":46},{"t":64.852909,"n":73,"v":127,"c":0,"p":46},{"t":65.117614,"n":69,"v":127,"c":0,"p":46},{"t":65.647026,"n":66,"v":127,"c":0,"p":46},{"t":65.823496,"n":74,"v":127,"c":0,"p":46},{"t":65.999967,"n":84,"v":127,"c":0,"p":46},{"t":66.176437,"n":82,"v":127,"c":0,"p":46},{"t":66.176437,"n":74,"v":127,"c":0,"p":46},{"t":66.176437,"n":67,"v":127,"c":0,"p":46},{"t":66.529378,"n":82,"v":127,"c":0,"p":46},{"t":66.705849,"n":64,"v":127,"c":0,"p":46},{"t":66.882319,"n":72,"v":127,"c":0,"p":46},{"t":67.05879,"n":82,"v":127,"c":0,"p":46},{"t":67.23526,"n":81,"v":127,"c":0,"p":46},{"t":67.23526,"n":74,"v":127,"c":0,"p":46},{"t":67.23526,"n":65,"v":127,"c":0,"p":46},{"t":67.764672,"n":58,"v":127,"c":0,"p":46},{"t":67.941142,"n":74,"v":127,"c":0,"p":46},{"t":68.117613,"n":81,"v":127,"c":0,"p":46},{"t":68.294083,"n":79,"v":127,"c":0,"p":46},{"t":68.294083,"n":74,"v":127,"c":0,"p":46},{"t":68.294083,"n":52,"v":127,"c":0,"p":46},{"t":68.647024,"n":79,"v":127,"c":0,"p":46},{"t":68.823495,"n":57,"v":127,"c":0,"p":46},{"t":68.999965,"n":73,"v":127,"c":0,"p":46},{"t":69.176436,"n":79,"v":127,"c":0,"p":46},{"t":69.352906,"n":77,"v":127,"c":0,"p":46},{"t":69.352906,"n":74,"v":127,"c":0,"p":46},{"t":69.352906,"n":62,"v":127,"c":0,"p":46},{"t":69.705847,"n":77,"v":127,"c":0,"p":46},{"t":69.882318,"n":76,"v":127,"c":0,"p":46},{"t":69.882318,"n":70,"v":127,"c":0,"p":46},{"t":69.882318,"n":55,"v":127,"c":0,"p":46},{"t":70.058788,"n":77,"v":127,"c":0,"p":46},{"t":70.235259,"n":74,"v":127,"c":0,"p":46},{"t":70.411729,"n":57,"v":127,"c":0,"p":46},{"t":70.5882,"n":74,"v":127,"c":0,"p":46},{"t":70.76467,"n":73,"v":127,"c":0,"p":46},{"t":70.941141,"n":74,"v":127,"c":0,"p":46},{"t":70.941141,"n":62,"v":127,"c":0,"p":46},{"t":71.470552,"n":50,"v":127,"c":0,"p":46},{"t":71.999964,"n":66,"v":127,"c":0,"p":46},{"t":72.176434,"n":74,"v":127,"c":0,"p":46},{"t":72.352905,"n":84,"v":127,"c":0,"p":46},{"t":72.529375,"n":82,"v":127,"c":0,"p":46},{"t":72.529375,"n":74,"v":127,"c":0,"p":46},{"t":72.529375,"n":67,"v":127,"c":0,"p":46},{"t":72.882316,"n":82,"v":127,"c":0,"p":46},{"t":73.058787,"n":64,"v":127,"c":0,"p":46},{"t":73.235257,"n":72,"v":127,"c":0,"p":46},{"t":73.411728,"n":82,"v":127,"c":0,"p":46},{"t":73.588198,"n":81,"v":127,"c":0,"p":46},{"t":73.588198,"n":74,"v":127,"c":0,"p":46},{"t":73.588198,"n":65,"v":127,"c":0,"p":46},{"t":74.11761,"n":58,"v":127,"c":0,"p":46},{"t":74.29408,"n":74,"v":127,"c":0,"p":46},{"t":74.470551,"n":81,"v":127,"c":0,"p":46},{"t":74.647021,"n":79,"v":127,"c":0,"p":46},{"t":74.647021,"n":74,"v":127,"c":0,"p":46},{"t":74.647021,"n":52,"v":127,"c":0,"p":46},{"t":74.999962,"n":79,"v":127,"c":0,"p":46},{"t":75.176433,"n":57,"v":127,"c":0,"p":46},{"t":75.352903,"n":73,"v":127,"c":0,"p":46},{"t":75.529374,"n":79,"v":127,"c":0,"p":46},{"t":75.705844,"n":77,"v":127,"c":0,"p":46},{"t":75.705844,"n":74,"v":127,"c":0,"p":46},{"t":75.705844,"n":62,"v":127,"c":0,"p":46},{"t":76.058785,"n":77,"v":127,"c":0,"p":46},{"t":76.235256,"n":76,"v":127,"c":0,"p":46},{"t":76.235256,"n":70,"v":127,"c":0,"p":46},{"t":76.235256,"n":55,"v":127,"c":0,"p":46},{"t":76.411726,"n":77,"v":127,"c":0,"p":46},{"t":76.588197,"n":74,"v":127,"c":0,"p":46},{"t":76.764667,"n":57,"v":127,"c":0,"p":46},{"t":76.941138,"n":74,"v":127,"c":0,"p":46},{"t":77.117608,"n":73,"v":127,"c":0,"p":46},{"t":77.294079,"n":74,"v":127,"c":0,"p":46},{"t":77.294079,"n":62,"v":127,"c":0,"p":46},{"t":77.82349,"n":50,"v":127,"c":0,"p":46}];
const titleDuration=79.411725;

let audioEnabled=true;
let audioCtx=null;
let musicGain=null;
let sfxGain=null;
let weatherGain=null;
let noiseBuffer=null;
let audioReady=false;

let activeWeatherAudio=null;
let activeWeatherAudioSignature="";

let musicPlaying=false;
let titleSources=[];
let titleLoopTimer=null;

const queuedSfx=[];

const soundToggle=document.getElementById("soundToggle");
const launcherAudioStatus=document.getElementById("launcherAudioStatus");
const sfxStatus=document.getElementById("sfxStatus");

function updateAudioIndicators(){
  soundToggle.textContent=audioEnabled ? "SND:ON" : "SND:OFF";
  soundToggle.classList.toggle("off",!audioEnabled);
  soundToggle.setAttribute("aria-pressed",String(audioEnabled));

  if(!audioEnabled){
    launcherAudioStatus.textContent="AUDIO OFF";
    sfxStatus.innerHTML="<strong>SFX</strong> OFF";
    sfxStatus.className="command off";
    return;
  }

  if(audioReady){
    launcherAudioStatus.textContent=musicPlaying ? "TITLE MUSIC PLAYING" : "AUDIO READY";
    sfxStatus.innerHTML="<strong>SFX</strong> READY";
    sfxStatus.className="command ready";
  }else{
    launcherAudioStatus.textContent="AUDIO ON — AWAITS FIRST INPUT";
    sfxStatus.innerHTML="<strong>SFX</strong> LOCKED";
    sfxStatus.className="command locked";
  }
}

function ensureAudioContext(){
  if(audioCtx) return audioCtx;

  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtor) return null;

  audioCtx=new AudioCtor();

  musicGain=audioCtx.createGain();
  musicGain.gain.value=0.13;
  musicGain.connect(audioCtx.destination);

  sfxGain=audioCtx.createGain();
  sfxGain.gain.value=0.65;
  sfxGain.connect(audioCtx.destination);

  weatherGain=audioCtx.createGain();
  weatherGain.gain.value=0.52;
  weatherGain.connect(audioCtx.destination);

  const length=Math.floor(audioCtx.sampleRate*1.0);
  noiseBuffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate);
  const data=noiseBuffer.getChannelData(0);

  for(let i=0;i<length;i++){
    data[i]=Math.random()*2-1;
  }

  audioCtx.addEventListener?.("statechange",()=>{
    audioReady=audioCtx.state==="running";
    updateAudioIndicators();

    if(audioReady){
      flushQueuedSfx();

      if(currentScreen==="launcher" && audioEnabled){
        startTitleMusic();
      }

      syncWeatherAudio();
    }
  });

  return audioCtx;
}

async function unlockAudio(){
  if(!audioEnabled) return false;

  const ctx=ensureAudioContext();
  if(!ctx) return false;

  if(ctx.state!=="running"){
    try{
      await ctx.resume();
    }catch(error){
      console.error("Audio resume failed:",error);
    }
  }

  audioReady=ctx.state==="running";

  if(audioReady){
    flushQueuedSfx();

    if(currentScreen==="launcher" && audioEnabled){
      startTitleMusic();
    }

    syncWeatherAudio();
  }

  updateAudioIndicators();
  return audioReady;
}

function noteHz(note){
  return 440*Math.pow(2,(note-69)/12);
}

function scheduleTitleNote(event,startAt){
  if(!audioEnabled || !audioReady || !audioCtx) return;

  const when=startAt+event.t;
  const velocity=Math.max(0.02,event.v/127);
  const f=noteHz(event.n);

  const osc=audioCtx.createOscillator();
  const overtone=audioCtx.createOscillator();
  const gain=audioCtx.createGain();
  const overtoneGain=audioCtx.createGain();
  const filter=audioCtx.createBiquadFilter();

  osc.type="triangle";
  osc.frequency.setValueAtTime(f,when);

  overtone.type="sine";
  overtone.frequency.setValueAtTime(f*2,when);

  filter.type="lowpass";
  filter.frequency.setValueAtTime(Math.min(9000,1400+f*7),when);
  filter.Q.value=0.55;

  gain.gain.setValueAtTime(0.0001,when);
  gain.gain.exponentialRampToValueAtTime(0.15*velocity,when+0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001,when+1.45);

  overtoneGain.gain.setValueAtTime(0.0001,when);
  overtoneGain.gain.exponentialRampToValueAtTime(0.035*velocity,when+0.005);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0001,when+0.55);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);

  overtone.connect(overtoneGain);
  overtoneGain.connect(musicGain);

  osc.start(when);
  overtone.start(when);
  osc.stop(when+1.5);
  overtone.stop(when+0.6);

  titleSources.push(osc,overtone);
}

function startTitleMusic(){
  if(
    !audioEnabled ||
    !audioReady ||
    !audioCtx ||
    currentScreen!=="launcher" ||
    musicPlaying
  ) return;

  const startAt=audioCtx.currentTime+0.08;

  for(const event of titleEvents){
    scheduleTitleNote(event,startAt);
  }

  musicPlaying=true;
  updateAudioIndicators();

  titleLoopTimer=setTimeout(()=>{
    musicPlaying=false;
    titleSources=[];
    titleLoopTimer=null;

    if(audioEnabled && currentScreen==="launcher"){
      startTitleMusic();
    }
  },Math.ceil((titleDuration+0.25)*1000));
}

function stopTitleMusic(){
  if(titleLoopTimer){
    clearTimeout(titleLoopTimer);
    titleLoopTimer=null;
  }

  for(const source of titleSources){
    try{ source.stop(); }catch{}
  }

  titleSources=[];
  musicPlaying=false;
  updateAudioIndicators();
}

function queueSfx(fn){
  if(!audioEnabled) return;

  if(audioReady && audioCtx && audioCtx.state==="running"){
    fn();
    return;
  }

  if(queuedSfx.length<8){
    queuedSfx.push(fn);
  }

  unlockAudio();
}

function flushQueuedSfx(){
  if(!audioEnabled || !audioReady) return;

  while(queuedSfx.length){
    const fn=queuedSfx.shift();
    try{ fn(); }catch(error){ console.error(error); }
  }
}

function noiseVoice(duration,volume,type="lowpass",frequency=700,q=0.7,delay=0){
  if(!audioCtx || !audioReady) return;

  const now=audioCtx.currentTime+delay;
  const source=audioCtx.createBufferSource();
  const filter=audioCtx.createBiquadFilter();
  const gain=audioCtx.createGain();

  source.buffer=noiseBuffer;
  filter.type=type;
  filter.frequency.setValueAtTime(frequency,now);
  filter.Q.setValueAtTime(q,now);

  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002,volume),now+0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);

  source.start(now);
  source.stop(now+duration+0.03);

  return {source,filter,gain};
}

function playMoveSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="triangle";
    osc.frequency.setValueAtTime(125+Math.random()*15,now);
    osc.frequency.exponentialRampToValueAtTime(62,now+0.09);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.24,now+0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.10);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now+0.11);

    noiseVoice(0.07,0.08,"lowpass",620,0.4,0);
  });
}

/*
  R88 Kobold panic yap.
  A tiny double-yelp accompanies the Kobold's one-time "run away!" bark.
  It uses the shared Web Audio SFX bus, so it respects the global audio toggle
  and never creates a separate audio subsystem.
*/
function playKoboldPanicYap(){
  queueSfx(()=>{
    const base=audioCtx.currentTime;
    const pitchJitter=0.92+Math.random()*0.16;

    const yelp=(delay,startHz,peakHz,endHz,volume)=>{
      const start=base+delay;
      const osc=audioCtx.createOscillator();
      const gain=audioCtx.createGain();
      const filter=audioCtx.createBiquadFilter();

      osc.type="triangle";
      osc.frequency.setValueAtTime(startHz*pitchJitter,start);
      osc.frequency.exponentialRampToValueAtTime(peakHz*pitchJitter,start+0.035);
      osc.frequency.exponentialRampToValueAtTime(endHz*pitchJitter,start+0.15);

      filter.type="bandpass";
      filter.frequency.setValueAtTime(1850,start);
      filter.Q.setValueAtTime(1.6,start);

      gain.gain.setValueAtTime(0.0001,start);
      gain.gain.exponentialRampToValueAtTime(volume,start+0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001,start+0.17);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      osc.start(start);
      osc.stop(start+0.18);

      /* A breathy edge keeps the chirp from sounding like a pure UI beep. */
      noiseVoice(
        0.11,
        volume*0.30,
        "bandpass",
        2450,
        1.8,
        delay+0.01
      );
    };

    /* Short comic "yip-yap" pair. */
    yelp(0.00,760,1220,690,0.13);
    yelp(0.19,900,1470,760,0.11);
  });
}

function playAttackSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="square";
    osc.frequency.setValueAtTime(600,now);
    osc.frequency.exponentialRampToValueAtTime(125,now+0.14);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.17,now+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.15);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now+0.16);

    noiseVoice(0.12,0.12,"highpass",850,0.8,0);
  });
}

/*
  R97 miss result cue: a deliberately airy weapon/projectile "whiff".
  Misses do NOT play the successful-hit/attack transient. Hits retain the
  existing hit/impact sounds. The whiff is noise-based
  (rather than a pitched UI tone) so it reads as something passing through air.
*/
function playMissSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime+0.025;

    /* Main fast air sweep. */
    const source=audioCtx.createBufferSource();
    const band=audioCtx.createBiquadFilter();
    const high=audioCtx.createBiquadFilter();
    const gain=audioCtx.createGain();

    source.buffer=noiseBuffer;

    band.type="bandpass";
    band.frequency.setValueAtTime(720,now);
    band.frequency.exponentialRampToValueAtTime(4200,now+0.085);
    band.frequency.exponentialRampToValueAtTime(1350,now+0.22);
    band.Q.setValueAtTime(0.75,now);

    high.type="highpass";
    high.frequency.setValueAtTime(360,now);
    high.frequency.exponentialRampToValueAtTime(1250,now+0.18);
    high.Q.setValueAtTime(0.35,now);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.20,now+0.018);
    gain.gain.exponentialRampToValueAtTime(0.11,now+0.085);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.24);

    source.connect(band);
    band.connect(high);
    high.connect(gain);
    gain.connect(sfxGain);
    source.start(now);
    source.stop(now+0.26);

    /* Soft trailing rush makes the cue read as a passing swing/shot. */
    noiseVoice(0.16,0.075,"highpass",1850,0.45,0.045);
  });
}



/*
  Natural d20 presentation cues.
  These sounds are purely audiovisual feedback and do not change
  hit, damage, or fumble mechanics.
*/
function playCriticalMissSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;

    /* Comic descending "whoops" glide. */
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="triangle";
    osc.frequency.setValueAtTime(560,now);
    osc.frequency.exponentialRampToValueAtTime(155,now+0.30);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.20,now+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.32);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now+0.34);

    /* Tiny low comic bonk at the end. */
    const bonk=audioCtx.createOscillator();
    const bonkGain=audioCtx.createGain();

    bonk.type="sine";
    bonk.frequency.setValueAtTime(135,now+0.25);
    bonk.frequency.exponentialRampToValueAtTime(82,now+0.38);

    bonkGain.gain.setValueAtTime(0.0001,now+0.24);
    bonkGain.gain.exponentialRampToValueAtTime(0.16,now+0.26);
    bonkGain.gain.exponentialRampToValueAtTime(0.0001,now+0.40);

    bonk.connect(bonkGain);
    bonkGain.connect(sfxGain);
    bonk.start(now+0.24);
    bonk.stop(now+0.42);
  });
}

function playCriticalHitSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const notes=[523.25,659.25,783.99,1046.50];

    /* Bright rising arpeggio / success flourish. */
    notes.forEach((frequency,index)=>{
      const start=now+index*0.055;
      const osc=audioCtx.createOscillator();
      const gain=audioCtx.createGain();

      osc.type=index<3 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(frequency,start);

      gain.gain.setValueAtTime(0.0001,start);
      gain.gain.exponentialRampToValueAtTime(
        index===3 ? 0.18 : 0.13,
        start+0.008
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start+0.24
      );

      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(start);
      osc.stop(start+0.26);
    });

    noiseVoice(
      0.22,
      0.055,
      "highpass",
      3600,
      0.7,
      0.12
    );
  });
}

function playNaturalAttackRollSound(rawRoll){
  if(rawRoll===1){
    playCriticalMissSound();
  }else if(rawRoll===20){
    playCriticalHitSound();
  }
}


function playSlingWindupSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;

    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    /* Rising/falling whistle-like sling whirl. */
    osc.type="sine";
    osc.frequency.setValueAtTime(240,now);
    osc.frequency.exponentialRampToValueAtTime(820,now+0.22);
    osc.frequency.exponentialRampToValueAtTime(420,now+0.42);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.07,now+0.03);
    gain.gain.exponentialRampToValueAtTime(0.05,now+0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.45);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(now);
    osc.stop(now+0.47);

    /* Light cord/air texture. */
    noiseVoice(0.40,0.025,"bandpass",1400,1.3,0.02);
  });
}

function playSlingReleaseSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;

    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="triangle";
    osc.frequency.setValueAtTime(900,now);
    osc.frequency.exponentialRampToValueAtTime(310,now+0.08);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.08,now+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.10);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(now);
    osc.stop(now+0.11);
  });
}

function playRockImpactSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;

    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="triangle";
    osc.frequency.setValueAtTime(165,now);
    osc.frequency.exponentialRampToValueAtTime(90,now+0.07);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.10,now+0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.09);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(now);
    osc.stop(now+0.10);

    noiseVoice(0.08,0.05,"lowpass",700,0.5,0);
  });
}

function playFireballExplosionSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;

    const boom=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    boom.type="sine";
    boom.frequency.setValueAtTime(165,now);
    boom.frequency.exponentialRampToValueAtTime(48,now+0.42);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.25,now+0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.48);

    boom.connect(gain);
    gain.connect(sfxGain);
    boom.start(now);
    boom.stop(now+0.5);

    noiseVoice(
      0.42,
      0.11,
      "lowpass",
      1450,
      1.1,
      0
    );
  });
}

/*
  R187 juvenile Red Dragon breath SFX.
  Synthesized in-engine: low chest-growl plus turbulent filtered flame noise.
*/
function playDragonBreathSound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const duration=1.05;

    const growl=audioCtx.createOscillator();
    const growlGain=audioCtx.createGain();

    growl.type="sawtooth";
    growl.frequency.setValueAtTime(92,now);
    growl.frequency.exponentialRampToValueAtTime(43,now+0.72);

    growlGain.gain.setValueAtTime(0.0001,now);
    growlGain.gain.exponentialRampToValueAtTime(0.075,now+0.035);
    growlGain.gain.exponentialRampToValueAtTime(0.045,now+0.38);
    growlGain.gain.exponentialRampToValueAtTime(0.0001,now+0.88);

    growl.connect(growlGain);
    growlGain.connect(sfxGain);
    growl.start(now);
    growl.stop(now+0.92);

    noiseVoice(duration,0.18,"bandpass",1150,0.8,0);
    noiseVoice(0.82,0.10,"highpass",2450,0.55,0.03);
    noiseVoice(0.58,0.075,"lowpass",520,1.05,0.18);
  });
}

/*
  R93 reusable magical status-effect sound.
  Sleep uses a bright, soft two-tone shimmer now; future magical status
  effects can reuse this hook with their own kind-specific timbre.
*/
/*
  R193 Enlarge transition SFX.
  Growth uses a one-second rising resonant sweep; expiration plays the same
  idea in reverse so the audio motion matches the sprite-scale animation.
*/
function playEnlargeTransitionSound(direction="grow"){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const growing=direction!=="shrink";
    const duration=1.0;

    const low=audioCtx.createOscillator();
    const high=audioCtx.createOscillator();
    const lowGain=audioCtx.createGain();
    const highGain=audioCtx.createGain();

    low.type="sine";
    high.type="triangle";

    if(growing){
      low.frequency.setValueAtTime(92,now);
      low.frequency.exponentialRampToValueAtTime(180,now+0.52);
      low.frequency.exponentialRampToValueAtTime(290,now+duration);

      high.frequency.setValueAtTime(180,now);
      high.frequency.exponentialRampToValueAtTime(420,now+0.58);
      high.frequency.exponentialRampToValueAtTime(690,now+duration);
    }else{
      low.frequency.setValueAtTime(290,now);
      low.frequency.exponentialRampToValueAtTime(180,now+0.48);
      low.frequency.exponentialRampToValueAtTime(92,now+duration);

      high.frequency.setValueAtTime(690,now);
      high.frequency.exponentialRampToValueAtTime(420,now+0.42);
      high.frequency.exponentialRampToValueAtTime(180,now+duration);
    }

    lowGain.gain.setValueAtTime(0.0001,now);
    lowGain.gain.exponentialRampToValueAtTime(0.085,now+0.08);
    lowGain.gain.exponentialRampToValueAtTime(0.060,now+0.68);
    lowGain.gain.exponentialRampToValueAtTime(0.0001,now+duration);

    highGain.gain.setValueAtTime(0.0001,now);
    highGain.gain.exponentialRampToValueAtTime(0.045,now+0.12);
    highGain.gain.exponentialRampToValueAtTime(0.032,now+0.72);
    highGain.gain.exponentialRampToValueAtTime(0.0001,now+duration);

    low.connect(lowGain);
    high.connect(highGain);
    lowGain.connect(sfxGain);
    highGain.connect(sfxGain);

    low.start(now);
    high.start(now);
    low.stop(now+duration+0.02);
    high.stop(now+duration+0.02);

    noiseVoice(
      0.92,
      0.020,
      "bandpass",
      growing ? 720 : 520,
      0.8,
      0.04
    );
  });
}


function playMagicEffectSound(kind="generic",index=0){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const variation=(index%7)*17;
    const base=kind==="sleep" ? 760 : 690;

    const oscA=audioCtx.createOscillator();
    const oscB=audioCtx.createOscillator();
    const gainA=audioCtx.createGain();
    const gainB=audioCtx.createGain();

    oscA.type="sine";
    oscB.type="triangle";

    oscA.frequency.setValueAtTime(base+variation,now);
    oscA.frequency.exponentialRampToValueAtTime(base*1.55+variation,now+0.23);

    oscB.frequency.setValueAtTime(base*1.5+variation,now+0.035);
    oscB.frequency.exponentialRampToValueAtTime(base*0.92+variation,now+0.31);

    gainA.gain.setValueAtTime(0.0001,now);
    gainA.gain.exponentialRampToValueAtTime(0.085,now+0.018);
    gainA.gain.exponentialRampToValueAtTime(0.0001,now+0.36);

    gainB.gain.setValueAtTime(0.0001,now+0.025);
    gainB.gain.exponentialRampToValueAtTime(0.055,now+0.055);
    gainB.gain.exponentialRampToValueAtTime(0.0001,now+0.39);

    oscA.connect(gainA);
    oscB.connect(gainB);
    gainA.connect(sfxGain);
    gainB.connect(sfxGain);

    oscA.start(now);
    oscA.stop(now+0.38);
    oscB.start(now+0.025);
    oscB.stop(now+0.41);

    noiseVoice(0.25,0.018,"highpass",3100,0.75,0.02);
  });
}


/*
  R100 Color Spray SFX: one short prismatic sweep for the whole fan.
  Three staggered tones plus a light air texture create a magical "spectrum"
  cue without tying the sound to any individual victim.
*/
function playColorSpraySound(){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const voices=[
      {type:"sine",     start:520, peak:920, end:690, gain:0.050, delay:0.000},
      {type:"triangle", start:690, peak:1280,end:860, gain:0.042, delay:0.035},
      {type:"sine",     start:880, peak:1580,end:1040,gain:0.034, delay:0.070}
    ];

    for(const voice of voices){
      const osc=audioCtx.createOscillator();
      const gain=audioCtx.createGain();
      const t0=now+voice.delay;

      osc.type=voice.type;
      osc.frequency.setValueAtTime(voice.start,t0);
      osc.frequency.exponentialRampToValueAtTime(voice.peak,t0+0.15);
      osc.frequency.exponentialRampToValueAtTime(voice.end,t0+0.34);

      gain.gain.setValueAtTime(0.0001,t0);
      gain.gain.exponentialRampToValueAtTime(voice.gain,t0+0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001,t0+0.38);

      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(t0);
      osc.stop(t0+0.40);
    }

    noiseVoice(0.34,0.020,"bandpass",2600,1.0,0.015);
  });
}

function playMagicMissileHitSound(index=0){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const pitch=720+(index%5)*90;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type="sine";
    osc.frequency.setValueAtTime(pitch,now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(260,pitch*0.48),now+0.10);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.16,now+0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.13);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now+0.14);

    noiseVoice(0.08,0.035,"highpass",2400,0.55,0);
  });
}

function playDeathSound(entity){
  queueSfx(()=>{
    const now=audioCtx.currentTime+0.02;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    const startFreq=entity && entity.id==="kobold" ? 285 : 175;
    const endFreq=entity && entity.id==="kobold" ? 56 : 42;

    osc.type="sawtooth";
    osc.frequency.setValueAtTime(startFreq,now);
    osc.frequency.exponentialRampToValueAtTime(endFreq,now+0.58);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.18,now+0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.61);

    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now+0.64);

    const noise=noiseVoice(0.50,0.08,"lowpass",520,0.9,0.04);
    if(noise){
      noise.filter.frequency.exponentialRampToValueAtTime(
        90,
        audioCtx.currentTime+0.50
      );
    }
  });
}

function playAgonySound(entity){
  queueSfx(()=>{
    const now=audioCtx.currentTime;
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    const wobble=audioCtx.createOscillator();
    const wobbleGain=audioCtx.createGain();

    const base=entity?.id==="kobold" ? 420 : 300;

    osc.type="sawtooth";
    osc.frequency.setValueAtTime(base,now);
    osc.frequency.exponentialRampToValueAtTime(base*0.55,now+0.18);
    osc.frequency.exponentialRampToValueAtTime(base*0.72,now+0.34);
    osc.frequency.exponentialRampToValueAtTime(base*0.30,now+0.78);

    wobble.type="sine";
    wobble.frequency.value=18;
    wobbleGain.gain.value=16;

    wobble.connect(wobbleGain);
    wobbleGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.16,now+0.025);
    gain.gain.exponentialRampToValueAtTime(0.10,now+0.22);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.82);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(now);
    wobble.start(now);
    osc.stop(now+0.84);
    wobble.stop(now+0.84);

    noiseVoice(0.55,0.045,"bandpass",700,0.8,0.05);
  });
}


function startDeathActionPause(){
  deathActionPauseUntil=Math.max(
    deathActionPauseUntil,
    performance.now()+DEATH_ACTION_PAUSE_MS
  );
}

function deathPauseRemaining(){
  return Math.max(
    0,
    Math.ceil(deathActionPauseUntil-performance.now())
  );
}

function isDeathPauseActive(){
  return deathPauseRemaining()>0;
}

function combatMessageHoldRemaining(){
  return Math.max(
    0,
    Math.ceil(combatMessageHoldUntil-performance.now())
  );
}

function isCombatMessageHoldActive(){
  return combatMessageHoldRemaining()>0;
}

function combatActionPauseRemaining(){
  return Math.max(
    deathPauseRemaining(),
    combatMessageHoldRemaining()
  );
}

function isCombatActionPauseActive(){
  return spellCastInProgress || combatActionPauseRemaining()>0;
}

async function waitForDeathActionPause(){
  const remaining=deathPauseRemaining();
  if(remaining>0){
    await sleep(remaining);
  }
}

async function waitForCombatActionPause(){
  const remaining=combatActionPauseRemaining();
  if(remaining>0){
    await sleep(remaining);
  }
}

function triggerDeathFx(entity){
  if(!entity) return;

  startDeathActionPause();

  if(deathFxTimer){
    clearTimeout(deathFxTimer);
    deathFxTimer=null;
  }

  deathFx={
    unitId:entity.id,
    footprintId:entity.footprintId || "single",
    facingHex:facingDirectionIndex(entity),
    x:entity.x,
    y:entity.y,
    started:performance.now()
  };

  draw();

  deathFxTimer=setTimeout(()=>{
    deathFx=null;
    deathFxTimer=null;
    draw();
  },1000);
}


async function playSfxTestSequence(){
  if(!audioEnabled) return;

  const ready=await unlockAudio();
  if(!ready) return;

  playMoveSound();
  setTimeout(playAttackSound,300);
  setTimeout(playMissSound,650);
  setTimeout(()=>playDeathSound({id:"kobold"}),1000);
}

soundToggle.addEventListener("click",async(event)=>{
  event.stopPropagation();

  audioEnabled=!audioEnabled;

  if(!audioEnabled){
    stopTitleMusic();
    stopWeatherAudio();

    if(musicGain) musicGain.gain.value=0;
    if(sfxGain) sfxGain.gain.value=0;
    if(weatherGain) weatherGain.gain.value=0;
  }else{
    ensureAudioContext();

    if(musicGain) musicGain.gain.value=0.13;
    if(sfxGain) sfxGain.gain.value=0.65;
    if(weatherGain) weatherGain.gain.value=0.52;

    await unlockAudio();

    if(currentScreen==="launcher"){
      startTitleMusic();
    }

    syncWeatherAudio();
  }

  updateAudioIndicators();
});

/* Capture-phase unlock means arrow-key movement or clicking the
   Combat button unlocks audio BEFORE the game action fires. */
window.addEventListener("pointerdown",()=>{
  if(audioEnabled) unlockAudio();
},{capture:true});

window.addEventListener("keydown",()=>{
  if(audioEnabled) unlockAudio();
},{capture:true});

/* ============================================================
   COMBAT ENGINE
   ============================================================ */

/* ============================================================
   ADVENTURE PARTY — COMBAT TEST R6
   Rules-oriented prototype inspired by SSI tactical combat.
   No copyrighted rules prose or original game assets are used.
   ============================================================ */

const canvas=document.getElementById("battlefield");
const ctx=canvas.getContext("2d");

/* ============================================================
   R170 — BATTLEFIELD WEATHER MANAGER
   Visual prototype only: weather does not modify combat rules yet.
   The shared state is intentionally structured so sound, visibility,
   missile modifiers, terrain effects, and spell interactions can be
   attached later without rewriting the VFX layer.
   ============================================================ */

const WEATHER_TYPES=[
  {id:"clear",label:"CLEAR"},
  {id:"rain",label:"RAIN"},
  {id:"snow",label:"SNOW"},
  {id:"wind",label:"WIND"}
];

const WEATHER_SEVERITIES=[
  {id:"light",label:"LIGHT",intensity:0.55,windStrength:0.45},
  {id:"moderate",label:"MODERATE",intensity:0.82,windStrength:0.72},
  {id:"heavy",label:"HEAVY",intensity:1.0,windStrength:1.0}
];

const weatherState={
  typeIndex:0,
  severityIndex:0,
  windDirection:1,
  mechanicsEnabled:false
};

const weatherTypeButton=document.getElementById("weatherTypeButton");
const weatherSeverityButton=document.getElementById("weatherSeverityButton");

let weatherAnimationFrame=null;
let weatherLastFrame=0;

/*
  R173 procedural weather ambience.
  This intentionally uses the existing Web Audio noise buffer instead of
  external audio files so weather remains parameter-driven, license-safe,
  and fully compatible with the automated repository workflow.
*/
function stopWeatherAudio(){
  const active=activeWeatherAudio;
  activeWeatherAudio=null;
  activeWeatherAudioSignature="";

  if(!active || !audioCtx) return;

  for(const timer of active.timers || []){
    clearTimeout(timer);
  }

  const now=audioCtx.currentTime;
  try{
    active.bus.gain.cancelScheduledValues(now);
    active.bus.gain.setValueAtTime(Math.max(0.0001,active.bus.gain.value),now);
    active.bus.gain.exponentialRampToValueAtTime(0.0001,now+0.16);
  }catch{}

  setTimeout(()=>{
    for(const node of active.sources || []){
      try{ node.stop(); }catch{}
      try{ node.disconnect(); }catch{}
    }
    for(const node of active.nodes || []){
      try{ node.disconnect(); }catch{}
    }
  },190);
}

function createLoopingNoiseSource(){
  if(!audioCtx || !noiseBuffer) return null;
  const source=audioCtx.createBufferSource();
  source.buffer=noiseBuffer;
  source.loop=true;
  return source;
}

function scheduleLightRainSpatter(active){
  if(!active || !audioCtx || !noiseBuffer) return;

  const scheduleNext=()=>{
    if(activeWeatherAudio!==active || currentWeatherType().id!=="rain") return;

    const delay=70+Math.random()*230;
    const timer=setTimeout(()=>{
      if(activeWeatherAudio!==active || currentWeatherType().id!=="rain") return;

      const now=audioCtx.currentTime;
      const drop=audioCtx.createBufferSource();
      const high=audioCtx.createBiquadFilter();
      const band=audioCtx.createBiquadFilter();
      const gain=audioCtx.createGain();

      drop.buffer=noiseBuffer;
      high.type="highpass";
      high.frequency.value=1800+Math.random()*1600;
      band.type="bandpass";
      band.frequency.value=3300+Math.random()*2400;
      band.Q.value=0.7+Math.random()*0.9;

      const peak=0.040+Math.random()*0.090;
      gain.gain.setValueAtTime(0.0001,now);
      gain.gain.exponentialRampToValueAtTime(peak,now+0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+0.035+Math.random()*0.035);

      drop.connect(high);
      high.connect(band);
      band.connect(gain);
      gain.connect(active.spatterBus || active.bus);

      drop.start(now,Math.random()*0.8,0.10);
      drop.stop(now+0.11);
      drop.onended=()=>{
        try{ drop.disconnect(); }catch{}
        try{ high.disconnect(); }catch{}
        try{ band.disconnect(); }catch{}
        try{ gain.disconnect(); }catch{}
      };

      scheduleNext();
    },delay);

    active.timers.push(timer);
  };

  scheduleNext();
}

function startRainAmbience(severity){
  if(!audioCtx || !weatherGain) return null;

  const bus=audioCtx.createGain();
  const intensity=severity.intensity;
  bus.gain.value=0.0001;
  bus.connect(weatherGain);

  const body=createLoopingNoiseSource();
  const bodyHigh=audioCtx.createBiquadFilter();
  const bodyLow=audioCtx.createBiquadFilter();
  const bodyGain=audioCtx.createGain();

  bodyHigh.type="highpass";
  bodyHigh.frequency.value=520;
  bodyLow.type="lowpass";
  bodyLow.frequency.value=6200;
  bodyGain.gain.value=0.17+0.18*intensity;

  body.connect(bodyHigh);
  bodyHigh.connect(bodyLow);
  bodyLow.connect(bodyGain);
  bodyGain.connect(bus);

  const hiss=createLoopingNoiseSource();
  const hissHigh=audioCtx.createBiquadFilter();
  const hissGain=audioCtx.createGain();

  hissHigh.type="highpass";
  hissHigh.frequency.value=2600;
  hissGain.gain.value=0.035+0.06*intensity;

  hiss.connect(hissHigh);
  hissHigh.connect(hissGain);
  hissGain.connect(bus);

  const spatterBus=audioCtx.createGain();
  spatterBus.gain.value=0.72;
  spatterBus.connect(weatherGain);

  const now=audioCtx.currentTime;

  /*
    R178: continuous rain bed reduced another 50%.
    Spatter is routed independently so individual plops stay clearly audible.
  */
  bus.gain.exponentialRampToValueAtTime(0.0375+0.03*intensity,now+0.35);
  body.start(now);
  hiss.start(now);

  const active={
    bus,
    spatterBus,
    sources:[body,hiss],
    nodes:[bodyHigh,bodyLow,bodyGain,hissHigh,hissGain,bus,spatterBus],
    timers:[]
  };

  /* Light rain keeps the irregular patter/spatter layer, now on its own louder bus. */
  if(severity.id==="light"){
    scheduleLightRainSpatter(active);
  }

  return active;
}

function startSnowAmbience(severity){
  if(!audioCtx || !weatherGain) return null;

  const bus=audioCtx.createGain();
  const intensity=severity.intensity;
  bus.gain.value=0.0001;
  bus.connect(weatherGain);

  const air=createLoopingNoiseSource();
  const high=audioCtx.createBiquadFilter();
  const low=audioCtx.createBiquadFilter();
  const airGain=audioCtx.createGain();

  high.type="highpass";
  high.frequency.value=1150;
  low.type="lowpass";
  low.frequency.value=3900;
  airGain.gain.value=0.045+0.055*intensity;

  air.connect(high);
  high.connect(low);
  low.connect(airGain);
  airGain.connect(bus);

  const now=audioCtx.currentTime;
  bus.gain.exponentialRampToValueAtTime(0.10+0.12*intensity,now+0.55);
  air.start(now);

  return {bus,sources:[air],nodes:[high,low,airGain,bus]};
}

function scheduleRandomWindGust(active,severity){
  if(!active || !audioCtx) return;

  const scheduleNext=()=>{
    if(activeWeatherAudio!==active || currentWeatherType().id!=="wind") return;

    const delay=1200+Math.random()*3200;
    const timer=setTimeout(()=>{
      if(activeWeatherAudio!==active || currentWeatherType().id!=="wind") return;

      const now=audioCtx.currentTime;
      const rise=0.55+Math.random()*1.15;
      const fall=0.8+Math.random()*1.8;
      const peak=0.88+Math.random()*(0.38+0.25*severity.intensity);
      const settle=0.62+Math.random()*0.18;

      active.gustGain.gain.cancelScheduledValues(now);
      active.gustGain.gain.setValueAtTime(Math.max(0.05,active.gustGain.gain.value),now);
      active.gustGain.gain.linearRampToValueAtTime(peak,now+rise);
      active.gustGain.gain.linearRampToValueAtTime(settle,now+rise+fall);

      scheduleNext();
    },delay);

    active.timers.push(timer);
  };

  scheduleNext();
}

function startWindAmbience(severity){
  if(!audioCtx || !weatherGain) return null;

  const bus=audioCtx.createGain();
  const intensity=severity.intensity;
  bus.gain.value=0.0001;
  bus.connect(weatherGain);

  const wind=createLoopingNoiseSource();
  const band=audioCtx.createBiquadFilter();
  const low=audioCtx.createBiquadFilter();
  const windGain=audioCtx.createGain();
  const sineGain=audioCtx.createGain();
  const gustGain=audioCtx.createGain();

  band.type="bandpass";
  band.frequency.value=560+220*intensity;
  band.Q.value=0.55;
  low.type="lowpass";
  low.frequency.value=2200+900*intensity;
  windGain.gain.value=0.18+0.14*intensity;

  sineGain.gain.value=0.72;
  gustGain.gain.value=0.72;

  wind.connect(band);
  band.connect(low);
  low.connect(windGain);
  windGain.connect(sineGain);
  sineGain.connect(gustGain);
  gustGain.connect(bus);

  /*
    Broad sine-wave breathing establishes the natural rise/fall pattern.
    Random gust envelopes below then vary amplitude and timing so the wind
    never repeats as a perfectly mechanical oscillator.
  */
  const lfo=audioCtx.createOscillator();
  const lfoDepth=audioCtx.createGain();
  lfo.type="sine";
  lfo.frequency.value=0.055+0.035*intensity;
  lfoDepth.gain.value=0.24+0.08*intensity;
  lfo.connect(lfoDepth);
  lfoDepth.connect(sineGain.gain);

  const now=audioCtx.currentTime;

  /* R175: wind master level reduced to 50% of the R173 mix. */
  bus.gain.exponentialRampToValueAtTime(0.125+0.11*intensity,now+0.45);
  wind.start(now);
  lfo.start(now);

  const active={
    bus,
    gustGain,
    sources:[wind,lfo],
    nodes:[band,low,windGain,sineGain,gustGain,lfoDepth,bus],
    timers:[]
  };

  scheduleRandomWindGust(active,severity);
  return active;
}

function syncWeatherAudio(){
  if(
    !audioEnabled ||
    !audioReady ||
    !audioCtx ||
    currentScreen!=="combat"
  ){
    stopWeatherAudio();
    return;
  }

  const type=currentWeatherType();
  const severity=currentWeatherSeverity();

  if(type.id==="clear"){
    stopWeatherAudio();
    return;
  }

  const signature=type.id+":"+severity.id;
  if(activeWeatherAudio && activeWeatherAudioSignature===signature) return;

  stopWeatherAudio();

  if(type.id==="rain"){
    activeWeatherAudio=startRainAmbience(severity);
  }else if(type.id==="snow"){
    activeWeatherAudio=startSnowAmbience(severity);
  }else if(type.id==="wind"){
    activeWeatherAudio=startWindAmbience(severity);
  }

  if(activeWeatherAudio){
    activeWeatherAudioSignature=signature;
  }
}

function currentWeatherType(){
  return WEATHER_TYPES[weatherState.typeIndex] || WEATHER_TYPES[0];
}

function currentWeatherSeverity(){
  return WEATHER_SEVERITIES[weatherState.severityIndex] || WEATHER_SEVERITIES[0];
}

function getWeatherSnapshot(){
  const type=currentWeatherType();
  const severity=currentWeatherSeverity();
  return {
    type:type.id,
    severity:severity.id,
    intensity:severity.intensity,
    windDirection:weatherState.windDirection,
    windStrength:severity.windStrength,
    mechanicsEnabled:weatherState.mechanicsEnabled
  };
}

function weatherHash(seed){
  const value=Math.sin(seed*12.9898+78.233)*43758.5453123;
  return value-Math.floor(value);
}

function weatherWrap(value,range){
  return ((value%range)+range)%range;
}

function updateWeatherTestControls(){
  const type=currentWeatherType();
  const severity=currentWeatherSeverity();
  if(weatherTypeButton){
    weatherTypeButton.textContent="WX: "+type.label;
    weatherTypeButton.classList.toggle("active",type.id!=="clear");
    weatherTypeButton.setAttribute("aria-label","Weather type: "+type.label+". Activate to cycle.");
  }
  if(weatherSeverityButton){
    weatherSeverityButton.textContent="SEV: "+severity.label;
    weatherSeverityButton.classList.toggle("active",type.id!=="clear");
    weatherSeverityButton.setAttribute("aria-label","Weather severity: "+severity.label+". Activate to cycle.");
  }
}

function weatherAnimationTick(now){
  if(currentWeatherType().id==="clear"){
    weatherAnimationFrame=null;
    weatherLastFrame=0;
    return;
  }
  if(!weatherLastFrame || now-weatherLastFrame>=32){
    weatherLastFrame=now;
    if(game && document.getElementById("combatScreen")?.classList.contains("active")){
      draw();
    }
  }
  weatherAnimationFrame=requestAnimationFrame(weatherAnimationTick);
}

function syncWeatherAnimation(){
  if(currentWeatherType().id==="clear"){
    if(weatherAnimationFrame!==null){
      cancelAnimationFrame(weatherAnimationFrame);
      weatherAnimationFrame=null;
    }
    weatherLastFrame=0;
    if(game) draw();
    return;
  }
  if(weatherAnimationFrame===null){
    weatherAnimationFrame=requestAnimationFrame(weatherAnimationTick);
  }
  if(game) draw();
}

function cycleWeatherType(){
  weatherState.typeIndex=(weatherState.typeIndex+1)%WEATHER_TYPES.length;
  updateWeatherTestControls();
  syncWeatherAnimation();
  syncWeatherAudio();
}

function cycleWeatherSeverity(){
  weatherState.severityIndex=(weatherState.severityIndex+1)%WEATHER_SEVERITIES.length;
  updateWeatherTestControls();
  syncWeatherAnimation();
  syncWeatherAudio();
}

weatherTypeButton?.addEventListener("click",cycleWeatherType);
weatherSeverityButton?.addEventListener("click",cycleWeatherSeverity);
updateWeatherTestControls();

function drawRainWeather(now,severity){
  const width=canvas.width;
  const height=canvas.height;
  const counts=[216,396,660];
  const count=counts[weatherState.severityIndex] || counts[0];
  const wind=severity.windStrength*weatherState.windDirection;
  ctx.fillStyle="rgba(28,38,54,"+(0.035+severity.intensity*0.045)+")";
  ctx.fillRect(0,0,width,height);
  ctx.lineCap="butt";
  for(let i=0;i<count;i++){
    const r0=weatherHash(i+11.3);
    const r1=weatherHash(i+91.7);
    const r2=weatherHash(i+213.1);
    const depth=0.55+r2*0.75;
    const fallSpeed=(0.20+r1*0.11)*depth*(0.85+severity.intensity*0.35);
    const driftSpeed=0.020*wind*depth;
    const x=weatherWrap(r0*width+now*driftSpeed,width+120)-60;
    const y=weatherWrap(r1*height+now*fallSpeed,height+70)-35;
    const length=(7+r2*11)*depth*(0.85+severity.intensity*0.35);
    const motionMagnitude=Math.hypot(driftSpeed,fallSpeed) || 1;
    const lineDx=length*(driftSpeed/motionMagnitude);
    const lineDy=length*(fallSpeed/motionMagnitude);
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+lineDx,y+lineDy);
    ctx.strokeStyle="rgba(184,210,229,"+(0.16+0.28*depth*severity.intensity)+")";
    ctx.lineWidth=depth>1.05 ? 1.4 : 1;
    ctx.stroke();
    if(i%17===0 && y>height*0.70 && y<height-8){
      const splash=2+depth*1.5;
      ctx.beginPath();
      ctx.moveTo(x-splash,y+length*0.18);
      ctx.lineTo(x,y);
      ctx.lineTo(x+splash,y+length*0.18);
      ctx.strokeStyle="rgba(204,224,238,"+(0.12+0.20*severity.intensity)+")";
      ctx.lineWidth=1;
      ctx.stroke();
    }
  }
}

function drawSnowWeather(now,severity){
  const width=canvas.width;
  const height=canvas.height;
  const counts=[162,288,468];
  const count=counts[weatherState.severityIndex] || counts[0];
  const wind=severity.windStrength*weatherState.windDirection;
  ctx.fillStyle="rgba(202,214,225,"+(0.018+severity.intensity*0.025)+")";
  ctx.fillRect(0,0,width,height);
  for(let i=0;i<count;i++){
    const r0=weatherHash(i+33.8);
    const r1=weatherHash(i+144.2);
    const r2=weatherHash(i+301.6);
    const depth=0.55+r2*0.95;
    const fallSpeed=(0.020+r1*0.028)*depth*(0.75+severity.intensity*0.35);
    const phase=r2*Math.PI*2;
    const sway=Math.sin(now*0.00115+phase+i*0.11)*(5+8*r1);
    const windDrift=now*0.0065*wind*depth;
    const x=weatherWrap(r0*width+sway+windDrift,width+80)-40;
    const y=weatherWrap(r1*height+now*fallSpeed,height+50)-25;
    const size=Math.max(1,Math.round(1+depth*1.2));
    ctx.globalAlpha=0.32+0.42*severity.intensity*Math.min(1,depth);
    ctx.fillStyle=r2>0.72 ? "#f1f3ef" : "#dbe3e8";
    ctx.fillRect(Math.round(x),Math.round(y),size,size);
    if(depth>1.15 && i%4===0){
      ctx.fillRect(Math.round(x-size),Math.round(y+1),1,1);
    }
  }
  ctx.globalAlpha=1;
}

function drawWindWeather(now,severity){
  const width=canvas.width;
  const height=canvas.height;
  /* R177: wind VFX density increased 3x from the R175 field for stronger readability. */
  const counts=[432,756,1224];
  const count=counts[weatherState.severityIndex] || counts[0];
  const direction=weatherState.windDirection;
  const speed=(0.055+severity.windStrength*0.075)*direction;
  ctx.fillStyle="rgba(129,112,83,"+(0.010+severity.intensity*0.018)+")";
  ctx.fillRect(0,0,width,height);
  for(let i=0;i<count;i++){
    const r0=weatherHash(i+65.1);
    const r1=weatherHash(i+178.4);
    const r2=weatherHash(i+412.9);
    const depth=0.55+r2*0.9;
    const gust=0.35+0.65*(0.5+0.5*Math.sin(now*0.0018+i*0.71));
    const x=weatherWrap(r0*width+now*speed*depth,width+180)-90;
    const y=r1*height+Math.sin(now*0.0011+i)*8*depth;
    const length=(16+44*r2)*depth*(0.82+severity.intensity*0.52)*gust;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+length*direction,y-(2+r2*4));
    ctx.strokeStyle="rgba(210,196,162,"+(0.09+0.24*severity.intensity*gust)+")";
    ctx.lineWidth=depth>1.1 ? 1.2 : 1;
    ctx.stroke();
    if(i%3===0){
      const moteX=x+length*0.55*direction;
      const moteY=y-2-r2*3;
      ctx.fillStyle="rgba(190,163,113,"+(0.19+0.28*severity.intensity*gust)+")";
      ctx.fillRect(Math.round(moteX),Math.round(moteY),depth>1.15?2:1,1);
    }
  }
}

function drawWeatherVfx(now=performance.now()){
  const type=currentWeatherType();
  if(type.id==="clear") return;
  const severity=currentWeatherSeverity();
  ctx.save();
  if(type.id==="rain"){
    drawRainWeather(now,severity);
  }else if(type.id==="snow"){
    drawSnowWeather(now,severity);
  }else if(type.id==="wind"){
    drawWindWeather(now,severity);
  }
  ctx.restore();
}

window.AdventurePartyWeather={
  getState:getWeatherSnapshot,
  cycleType:cycleWeatherType,
  cycleSeverity:cycleWeatherSeverity
};

const battleWrap=canvas.closest(".battle-wrap");
const CANVAS_ASPECT=canvas.width/canvas.height;

function fitBattleCanvas(){
  if(!battleWrap) return;

  const rect=battleWrap.getBoundingClientRect();
  const padding=10;

  const availW=Math.max(1,rect.width-padding);
  const availH=Math.max(1,rect.height-padding);

  let cssW=availW;
  let cssH=cssW/CANVAS_ASPECT;

  if(cssH>availH){
    cssH=availH;
    cssW=cssH*CANVAS_ASPECT;
  }

  canvas.style.width=`${Math.floor(cssW)}px`;
  canvas.style.height=`${Math.floor(cssH)}px`;
}

let lastBattleWrapWidth=0;
let lastBattleWrapHeight=0;

const battleResizeObserver=new ResizeObserver(entries=>{
  const entry=entries[0];
  const box=entry?.contentRect;
  if(!box) return;

  if(
    Math.abs(box.width-lastBattleWrapWidth)<0.5 &&
    Math.abs(box.height-lastBattleWrapHeight)<0.5
  ){
    return;
  }

  lastBattleWrapWidth=box.width;
  lastBattleWrapHeight=box.height;

  fitBattleCanvas();

  if(typeof draw==="function"){
    draw();
  }
});

if(battleWrap){
  battleResizeObserver.observe(battleWrap);
}

window.addEventListener("resize",()=>{
  fitBattleCanvas();

  if(typeof draw==="function"){
    draw();
  }
});

if(document.fonts?.ready){
  document.fonts.ready.then(()=>{
    verifyLocalGoldBoxFont();

    if(game && typeof draw==="function"){
      draw();
    }
  });
}

/* User-provided pixel art sprites */
const FIGHTER_SPRITE_SRC='assets/sprites/fighter.png?v=R207';
const FIGHTER_FALLBACK_SPRITE_SRC='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAK9UlEQVR4nM2acWgb1x3HP+fYlFmeTUg1u1ZcO/JiUjK0taOIdXTW3HpbkQutMWQrhNXY69rhBuyFOLCVYLqxNqxJoV7ZSI0HgY3SIEaxqEdWVW4WBzPWJobSza5V2c4JJUoW3FouwY3f/ji9l7vzyZJtSe0XhE6nd+9+v+/7vt/vvd+dRmkh8mijFd2KL+BmAqB330727HRxTl9id2U5e3a6ADinL/GgpwaAX124XFIbS0GA6N23E4DLK58DKOfP6Uvqt4QkRSJDSNHsLM/dZPu4vPI5uyvLedBTw8c30sDtUf/4RtpCBqQVUeMLn0KRB6msmJ0D4kd3f1X9OKcvqRF+qfsx9VuSsbuy3ELWb7+zG/KLG1tGsQmwYHdluSMJD3pq1HlJwjl9qejyhxISIGUN8PGNNNX3+wGDhMd+8H2LIl7qfqwk8ocSxQAzdleW03+gg7VUjJOvjwHw3GA3ZW4vpzKkDB1+DkqUoUqmACntPTtdVDW5KXN7efmfl4k82sDzL46ylopR4Wlm6PBzRB5tKJVZpSPgN3/9C6de/Z3KAgCuXZUA9B/oUOdOffi/UpkEFJ8ALTOXuXnxLJ/8a0rFgrVUjMvhPzDR+hTV9/tZjqe4efEsVy6OM9H6FL37dhY1+kuUNAZUNbn509DP1O+1VAyAMrdXBcVVfY4KT3PJbCoFAdr4wqfi58dOMb7wKb37dtJ/oIOqJjdgOH/HN35MZdVX1JS4cnG8BGYZKFUMUFOh/0AHJ18fYzmeAuBmwyMW50uNQqeabPNW3kfMjw6wHE9x8vUx+g90KOmDMSXu+FY7v/7JE7z2nxslSYOFnAIi4A/gchmrvHTaiPbxRJz4YlwAzI8OAFB9v59+MEgANR2AkjoPhVOA8NR50JO65WSLt0Udp1fS6Emd+dEBytxe1lIxpQQzSuk8FIYA5fzi2DAADR19mAmRREgSABbHhhUJ+4dOF9KekkMAYnFsWH3mRwcEBjHimWeeEbJNwB8QAX9ABNuCwnwdYD5XUhREAYAafYm1VIzG7hOWaTATmymVTXmjEGkwp8H17nrAmAqSkIA/QCgUIuAPABBsCxbAlM2jEAQIOfrmFZzM8wDRqagi4YXfv0CwLYjL5eLs2bMAhEKhApixNWyXACGDWYWnmVV9Dri9xJVo8bYQnYoC0NnZqVJke3u7OheOhEm+/xaUOA4UbCV48+JZ1lIxS2T31HnU/wF/gHp3vYUMqYCtyv/W6mvbJms7BCjpl7m9lLm9LMdT9rRmgVwkgbFQkgrYDKTTt1ZfEzsqercdMLdCgCVdyXkvZW8feXPkl9KXkAqQWNXnck6DHRW9mhBC7Kjo1b4IBQhPnUdF84aOPlb1uayyNyORSnBo8JBlGmxFAaFQSGiapn1hCnBVGjKWUT0f5wEe+uFDHD181HJOKqCnr0f1JQOpE0KhkOjs7NTAUMJmbXfCZjZDwu5gsC1IY/eJdQ31pG4hY+89e3n772+r35K89vZ2PnzvQ0aGRyzXJ99/i7p7HxF82arC5tF3uVyEI2EC/gCJVMIy1+0bo3A4rI7ltfXUMzJidXw5nqIKWHW+vbB9F4ScrFMgeeSISB45om4qRzSb807y99R5kDEj4A8QbAuqFAjQ02NIPxwJE2wLWrKHLRiKgD/AyPAIoVBIps2C7B0cFZDo6hJrMbWYEZ46D65K16acBywqkAoJ+AMqG4yMjHBo8BCu4dvpcTmeotrtZVWfY3FsmIaOPuVkOp22TJdCTBVHBczOzFi+9aSeU/ZmyBhg/jQ1NNHibSGRSqhPT08PRw8fZTY+q67dP3TaspKUa414Iq5ISKfTzI8ObBgw84WjAlqnp7UJk7w8dR4lXZvzGllkaC+OOKGzs1Mdm8jUGrtPCFk9Mu8pJAnxxTg8fV/O/vNBLukIczFjb+Neu/Ngig96Utc8dR6hJ3XORyYtHdXuqjXaHHyce96MWP77ZGkJ/eDjtE5PW/r94NhB1cYcHz44dpCqJrfMQNsKhjkJgHWjbr5WxYf0ijGv9aTOhM9H+ct/pHZXLZXPD3LXG284dn5lcJDaF19Uv9PXV6i602W2y0KCGRlCip4mVXUn4A8IQGYGFZ1bvC2ixdsiPHUe4anzCECcj0yKjy7NiavxayLR1SWSR44IO5avpYXMNGYkurrs0V1k+RQEORUgt7uN3SdIdHUBUOb1Unf8uJYhwDL65yOT1O6qpbqmZtP1/rnpGM0+r5MSioZcS2GtoaOPMreXD44dVFlhLRZDrhGcnK98ftDR+SuDg1wZHCR9fWXdjSbfuUCzzwsYD02FEFCC2kA+ewGtoaOP/UOnaZ2etpMAWJ2XWD4+pI7T11eYfOeCmu9JPWm5weQ7F2ge/5vl3JXBQdl/UUnYksQmfD6xt8XIDpnpwITPxz1vRrLKPn19hUvTlxz72/OqsZ/IFiw1TduyrcWCmPD5RCgUsgQ/+XEKeImuLnE1fk2cj0yqdv+efE8Fy6vxa2L5WlpdQxECnhO28mhMeOo8PHH1Oq/Y/pApKzNiCCFIX1/hk6d/yuzMDOWxGb7b9oBaOn/7gfvUeqG6poaV5c8AqLrTpXI9QGP3iYJugMzYbIdq0fPKq6/w7C+eBayrPrmCA2jsPsHytTQry58xa3Newp45vtZ0p32hg3zmGI6Et2LzhthMZyrl2Rc+0ilXpUstlszp86NLc3z9m80bbpomfD5ap6eVimSBRW7CgKKQkO8UEPYHnXbIWoGs8DZ09KmNzEbOg7HXyCyD1ZJ3o/aFRK40KLDtB+C2s/bKD9wufAbbguohaT7OmNvZ2ydSiZzXbxXZCJDLX1q8LUqCgEX+5nMSiVTCQkI+u0IJ2XYz12wXTlNABNuCyol6d73hlIPsJezKAEMJLpcrbynrSR2n3Z+8fnZ+1vG67cKuACHnsHyIEZ2KavXuelyVLouDYKQ9PamrEZNEJFIJc8BScOpDT+rrAlpVk5v50QFL/6b7FDQLmAkQgCaNDkfCRKeiZHaBCjOxGS1jOGCQYDZUkhCOhNeNvormt2OIlllEKci3SMvcXqqa3GZVaBRhHWCeArJzLRwJqzpbdCqqagKz87M4GQzrihQW52Uqi05FtYA/IBKpBK5K17q+zFhLxQwStu3ixsiWBu1Ma9GpqOU9IOlwmdvYwVVn3vuB9c5LSDVJJcjYYg960nmgIFWfjZBPGlQ3t89BaaSENFY6JBdGsqAanYqq7+hUlJnYjGbuc//QaZbjqXX9FhO5FkLrlCAPzK+2gbHwsbeXtUM5jbBNL6wbHQ0QVU1udvw5yq0nA459Fhr5Pht0rL1XvLsAODqvOURszfZtP1a49WRA9V1s5EuA2VBVqFz93t3Z2ttHeaNRdPyv7vjxrP8VElt6QcIc/LLINOcof1mw6fcDzNvdYrzWHj/5D8DybPBLVxDZVpQ2PXAFjNpimdfLWixG/ZkzNPU/bKTTdxdYHBumwtMsn/+pGiQgq9Kbvrf9uk3VA+ZHB6gILxhBKjP6dfc+AqDJOmGZ1+tooLmOmA31Z84w4fPR1P8wABXhBdVfpk+zM44kZJ4rWK4z22MnIV8CLO8C9vzSOB55qU8RIBtKR+vPnHHs215Qlfjv+Dit09NM+Hw5jWmdnibR1WUhWzqeDaZnGRbkQ4CQRjX1P2y8xNDkZjmeYtdnd205WpuJkKV2QBVGckE+pLETnU1p2QYkLwJy/L/tKD/h8+Ud6MzOSacSXV1iIyKyOQ/wfw3x7wUt7yBFAAAAAElFTkSuQmCC';
const KOBOLD_SPRITE_SRC='assets/sprites/kobold-bodyguard-stand.png';

/* R84 reusable combat-unit pose framework.
   Unit types register their standing/default frame and optional action frame here.
   A unit without an action frame simply remains on its standing frame, which lets
   future Fighter and creature art plug into the same combat path without bespoke code.
   Battlefield/contact shadows remain separately rendered by the unit draw functions. */
const KOBOLD_ATTACK_SPRITE_SRC='assets/sprites/kobold-bodyguard-attack.png';
const ORC_STAND_SPRITE_SRC='assets/sprites/orc-stand.png';
const ORC_ATTACK_SPRITE_SRC='assets/sprites/orc-attack.png';

/* R190: dedicated juvenile red dragon standing + attack poses. */
const JUVENILE_RED_DRAGON_STAND_SPRITE_SRC='assets/sprites/juvenile-red-dragon.png?v=R207';
const JUVENILE_RED_DRAGON_ATTACK_SPRITE_SRC='assets/sprites/juvenile-red-dragon-attack.png?v=R207';

/* R198 user-supplied old-wood architectural material + opening art. */
const OLD_WOOD_WALL_TEXTURE_SRC='assets/terrain/wall-old-wood.png?v=R207';
const OLD_WOOD_WINDOW_SRC='assets/terrain/wall-window-old-wood.png?v=R207';

/*
  R204 third-party floor texture.
  "Handpainted Stone Floor Texture" by PamNawi, CC BY 4.0.
  Full attribution lives in ATTRIBUTIONS.md.
*/
const STONE_FLOOR_TEXTURE_SRC=
  'https://opengameart.org/sites/default/files/StoneFloorTexture.png';

/* R108: user-supplied dagger Kobold sprites. The prior Kobold art is retained below for Body Guards. */
const KOBOLD_NORMAL_SPRITE_SRC='assets/sprites/kobold-stand.png';
const KOBOLD_NORMAL_ATTACK_SPRITE_SRC='assets/sprites/kobold-attack.png';

const KOBOLD_PRONE_SPRITE_SRC='assets/sprites/kobold-prone.png';

const KOBOLD_SLINGER_STAND_SPRITE_SRC='assets/sprites/kobold-slinger-stand.png';
const KOBOLD_SLINGER_ATTACK_SPRITE_SRC='assets/sprites/kobold-slinger-attack.png';

const DEATH_MARKER_SPRITE_SRC='assets/sprites/death-marker.png';

const UNIT_DEFAULT_ACTION_POSE_MS=1000;

const fighterSprite=new Image();
fighterSprite._fallbackUsed=false;
fighterSprite.addEventListener("error",()=>{
  if(fighterSprite._fallbackUsed){
    console.error("Carl sprite and embedded fallback both failed to decode.");
    return;
  }

  console.error("Carl repository sprite failed to decode; using embedded verified fallback.");
  fighterSprite._fallbackUsed=true;
  fighterSprite.src=FIGHTER_FALLBACK_SPRITE_SRC;
});
fighterSprite.src=FIGHTER_SPRITE_SRC;

/* R108: ordinary Kobolds use the new dagger-only sprite pair. */
const koboldSprite=new Image();
koboldSprite.src=KOBOLD_NORMAL_SPRITE_SRC;

const koboldAttackSprite=new Image();
koboldAttackSprite.src=KOBOLD_NORMAL_ATTACK_SPRITE_SRC;

const koboldProneSprite=new Image();
koboldProneSprite.src=KOBOLD_PRONE_SPRITE_SRC;

/* The former Kobold sprite pair is now the Kobold Body Guard art. */
const koboldBodyguardSprite=new Image();
koboldBodyguardSprite.src=KOBOLD_SPRITE_SRC;

const koboldBodyguardAttackSprite=new Image();
koboldBodyguardAttackSprite.src=KOBOLD_ATTACK_SPRITE_SRC;

/* R113: dedicated Kobold Slinger art, user-supplied standing and firing poses. */
const koboldSlingerStandSprite=new Image();
koboldSlingerStandSprite.src=KOBOLD_SLINGER_STAND_SPRITE_SRC;

const koboldSlingerAttackSprite=new Image();
koboldSlingerAttackSprite.src=KOBOLD_SLINGER_ATTACK_SPRITE_SRC;

const orcStandSprite=new Image();
orcStandSprite.src=ORC_STAND_SPRITE_SRC;

const orcAttackSprite=new Image();
orcAttackSprite.src=ORC_ATTACK_SPRITE_SRC;

const juvenileRedDragonStandSprite=new Image();
juvenileRedDragonStandSprite.src=JUVENILE_RED_DRAGON_STAND_SPRITE_SRC;

const juvenileRedDragonAttackSprite=new Image();
juvenileRedDragonAttackSprite.src=JUVENILE_RED_DRAGON_ATTACK_SPRITE_SRC;

const oldWoodWallTexture=new Image();
const oldWoodWindowImage=new Image();
const stoneFloorTexture=new Image();

for(const image of [
  oldWoodWallTexture,
  oldWoodWindowImage,
  stoneFloorTexture
]){
  image.addEventListener("load",()=>{
    if(game && currentScreen==="combat") draw();
  });
}

stoneFloorTexture.referrerPolicy="no-referrer";

stoneFloorTexture.addEventListener("error",()=>{
  console.warn(
    "PamNawi stone-floor texture failed to load; using the indoor-floor fallback color."
  );
});

oldWoodWallTexture.src=OLD_WOOD_WALL_TEXTURE_SRC;
oldWoodWindowImage.src=OLD_WOOD_WINDOW_SRC;
stoneFloorTexture.src=STONE_FLOOR_TEXTURE_SRC;

/* R157: user-provided death marker sprite replaces the old skull-and-crossbones overlay. */
const deathMarkerSprite=new Image();
deathMarkerSprite.src=DEATH_MARKER_SPRITE_SRC;

/*
  R156: harden alpha edges on Kobold-family pixel sprites once at load time.
  The original image remains the sizing reference; rendering uses a cleaned
  offscreen canvas with semi-transparent fringe pixels snapped to transparent
  or fully opaque. This removes halo/pixel-fringe artifacts without blurring.
*/
function prepareCrispPixelSprite(image){
  if(!image || image._crispPrepared) return;
  image._crispPrepared=true;

  const build=()=>{
    if(!image.naturalWidth || !image.naturalHeight) return;

    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;

    const c=canvas.getContext("2d",{willReadFrequently:true});
    c.imageSmoothingEnabled=false;
    c.clearRect(0,0,canvas.width,canvas.height);
    c.drawImage(image,0,0);

    const pixels=c.getImageData(0,0,canvas.width,canvas.height);
    const d=pixels.data;

    for(let i=0;i<d.length;i+=4){
      const a=d[i+3];
      if(a===0) continue;

      d[i+3]=a<128 ? 0 : 255;

      if(d[i+3]===0){
        d[i]=0;
        d[i+1]=0;
        d[i+2]=0;
      }
    }

    c.putImageData(pixels,0,0);
    image._crispRenderSource=canvas;
  };

  if(image.complete && image.naturalWidth){
    build();
  }else{
    image.addEventListener("load",build,{once:true});
  }
}

[
  koboldSprite,
  koboldAttackSprite,
  koboldProneSprite,
  koboldBodyguardSprite,
  koboldBodyguardAttackSprite,
  koboldSlingerStandSprite,
  koboldSlingerAttackSprite,
  juvenileRedDragonStandSprite,
  juvenileRedDragonAttackSprite,
  deathMarkerSprite
].forEach(prepareCrispPixelSprite);

const UNIT_POSE_DEFINITIONS={
  fighter:{
    defaultPose:"stand",
    actionPose:"attack",
    actionDurationMs:UNIT_DEFAULT_ACTION_POSE_MS,
    nativeFacing:"right",
    sprites:{
      stand:fighterSprite
      /* Fighter attack art can be added later without changing combat logic. */
    }
  },
  kobold:{
    defaultPose:"stand",
    actionPose:"attack",
    actionDurationMs:UNIT_DEFAULT_ACTION_POSE_MS,
    nativeFacing:"right",
    sprites:{
      stand:koboldSprite,
      attack:koboldAttackSprite,
      prone:koboldProneSprite
    }
  },
  "kobold-bodyguard":{
    defaultPose:"stand",
    actionPose:"attack",
    actionDurationMs:UNIT_DEFAULT_ACTION_POSE_MS,
    nativeFacing:"right",
    sprites:{
      stand:koboldBodyguardSprite,
      attack:koboldBodyguardAttackSprite,
      prone:koboldProneSprite
    }
  },
  "kobold-slinger":{
    defaultPose:"stand",
    actionPose:"attack",
    actionDurationMs:UNIT_DEFAULT_ACTION_POSE_MS,
    nativeFacing:"right",
    sprites:{
      stand:koboldSlingerStandSprite,
      attack:koboldSlingerAttackSprite,
      prone:koboldProneSprite
    }
  },
  orc:{
    defaultPose:"stand",
    actionPose:"attack",
    actionDurationMs:UNIT_DEFAULT_ACTION_POSE_MS,
    nativeFacing:"right",
    sprites:{
      stand:orcStandSprite,
      attack:orcAttackSprite
    }
  },
  "juvenile-red-dragon":{
    defaultPose:"stand",
    actionPose:"attack",
    /*
      R190: keep the attack pose up for the complete 1.05 s breath animation.
      Repeated melee attacks refresh this timer, so the full claw/claw/bite
      sequence also remains in the action pose.
    */
    actionDurationMs:1100,
    nativeFacing:"left",
    sprites:{
      stand:juvenileRedDragonStandSprite,
      attack:juvenileRedDragonAttackSprite
    }
  }
};

function unitPoseDefinition(unit){
  return unit ? (UNIT_POSE_DEFINITIONS[unit.type] || null) : null;
}


function shouldUseKoboldPronePose(unit){
  if(!unit) return false;
  if(
    unit.type!=="kobold" &&
    unit.type!=="kobold-bodyguard" &&
    unit.type!=="kobold-slinger"
  ) return false;
  if(!unit.alive || unit.fled) return false;

  /*
    R156: all Kobold-family units use the shared prone sprite while asleep,
    unconscious, or under the canonical prone condition (including Grease).
    Dead units remain unchanged.
  */
  return !!(
    getUnitEffect(unit,"sleep") ||
    getUnitEffect(unit,"unconscious") ||
    getUnitEffect(unit,"prone")
  );
}

function activeUnitPoseName(unit,now=performance.now()){
  const definition=unitPoseDefinition(unit);
  if(!definition) return null;

  if(shouldUseKoboldPronePose(unit) && definition.sprites?.prone){
    return "prone";
  }

  if(
    unit.poseName &&
    Number.isFinite(unit.poseUntil) &&
    now<unit.poseUntil &&
    definition.sprites?.[unit.poseName]
  ){
    return unit.poseName;
  }

  return definition.defaultPose || "stand";
}

function unitPoseSprite(unit,fallbackSprite=null){
  const definition=unitPoseDefinition(unit);
  if(!definition) return fallbackSprite;

  const poseName=activeUnitPoseName(unit);
  return definition.sprites?.[poseName] ||
    definition.sprites?.[definition.defaultPose || "stand"] ||
    fallbackSprite;
}

function unitPoseNativeFacing(unit,fallback="right"){
  return unitPoseDefinition(unit)?.nativeFacing || fallback;
}

function setTemporaryUnitPose(unit,poseName,durationMs=null){
  const definition=unitPoseDefinition(unit);
  if(!unit || !definition || !definition.sprites?.[poseName]) return false;

  const requestedDuration=Number.isFinite(durationMs)
    ? durationMs
    : definition.actionDurationMs;

  const duration=Math.max(
    0,
    Number.isFinite(requestedDuration)
      ? requestedDuration
      : UNIT_DEFAULT_ACTION_POSE_MS
  );

  unit.poseName=poseName;
  unit.poseUntil=performance.now()+duration;

  if(game) draw();

  setTimeout(()=>{
    if(!game || !unit) return;

    /* An older pose timer must never cancel a newer action pose. */
    if((unit.poseUntil || 0)<=performance.now()){
      unit.poseName=definition.defaultPose || "stand";
      unit.poseUntil=0;
      draw();
    }
  },duration+20);

  return true;
}

function triggerUnitAttackPose(unit){
  const definition=unitPoseDefinition(unit);
  if(!definition?.actionPose) return false;

  return setTemporaryUnitPose(
    unit,
    definition.actionPose,
    definition.actionDurationMs
  );
}


const GRASS_OUTDOORS_TREE_SHEET_SRC='assets/terrain/grass-outdoors-trees.png';

const GRASS_OUTDOORS_TILE_SHEET_SRC='assets/terrain/grass-outdoors-tiles.png';


/* ============================================================
   TERRAIN TILESET REGISTRY

   Combat terrain is selected by named tileset rather than being
   hard-wired into the renderer. New outdoor/indoor biomes can be
   registered without changing drawHexFill().
   ============================================================ */

const TERRAIN_TILESETS=new Map();
const TERRAIN_TILESET_IMAGES=new Map();
const TERRAIN_TREE_IMAGES=new Map();

function registerTerrainTileSet(definition){
  if(!definition?.id){
    throw new Error("Terrain tileset requires an id.");
  }

  const tileSet={
    ...definition,
    groups:(definition.groups || []).map(group=>({
      ...group,
      indices:[...(group.indices || [])]
    }))
  };

  const image=new Image();

  image.onload=()=>{
    if(game){
      draw();
    }
  };

  image.src=tileSet.sheetSrc;

  let treeImage=null;

  if(tileSet.treeSheetSrc){
    treeImage=new Image();

    treeImage.onload=()=>{
      if(game){
        draw();
      }
    };

    treeImage.src=tileSet.treeSheetSrc;
  }

  TERRAIN_TILESETS.set(tileSet.id,tileSet);
  TERRAIN_TILESET_IMAGES.set(tileSet.id,image);
  TERRAIN_TREE_IMAGES.set(tileSet.id,treeImage);

  return tileSet;
}

const GRASS_OUTDOORS_TILESET=registerTerrainTileSet({
  id:"grass-outdoors",
  label:"Grass Outdoors",
  environment:"outdoors",
  terrain:"grass",

  treeSheetSrc:GRASS_OUTDOORS_TREE_SHEET_SRC,
  treeColumns:8,
  treeRows:4,
  treeSourceTileWidth:192,
  treeSourceTileHeight:216,
  treeBaseAnchorX:96,
  treeBaseAnchorY:204,
  treeDrawHeight:86,
  treeBaseSortOffset:3,
  treeOccupiedSortOffset:-0.25,
  treeCoverageRatio:1/20,
  treeClusterChance:0.5,
  treeClusterMin:2,
  treeClusterMax:3,

  sheetSrc:GRASS_OUTDOORS_TILE_SHEET_SRC,
  columns:8,
  rows:4,
  sourceTileWidth:168,
  sourceTileHeight:176,

  background:"#4d613e",
  gridStroke:"rgba(46,84,43,0.72)",

  /*
    Source sheet organization:
      0–15  = scatter-rich accents (rocks, flowers, dirt, clover)
      16–31 = quieter grass tiles

    Relative group weights 1:9 produce an overall deterministic
    distribution of about 10% accent / 90% common grass.
  */
  groups:[
    {
      id:"scatter",
      weight:1,
      indices:Array.from({length:16},(_,index)=>index)
    },
    {
      id:"common",
      weight:9,
      indices:Array.from({length:16},(_,index)=>index+16)
    }
  ]
});

const DEFAULT_COMBAT_TERRAIN_TILESET_ID="grass-outdoors";
let activeCombatTerrainTileSetId=DEFAULT_COMBAT_TERRAIN_TILESET_ID;

function activeCombatTerrainTileSet(){
  return (
    TERRAIN_TILESETS.get(activeCombatTerrainTileSetId) ||
    TERRAIN_TILESETS.get(DEFAULT_COMBAT_TERRAIN_TILESET_ID)
  );
}

function setCombatTerrainTileSet(tileSetId){
  if(!TERRAIN_TILESETS.has(tileSetId)){
    return false;
  }

  activeCombatTerrainTileSetId=tileSetId;

  if(game){
    draw();
  }

  return true;
}

function chooseTerrainTileIndex(tileSet,x,y){
  const groups=(tileSet?.groups || []).filter(group=>
    group.weight>0 &&
    group.indices?.length
  );

  if(!groups.length){
    return 0;
  }

  const totalWeight=groups.reduce(
    (sum,group)=>sum+group.weight,
    0
  );

  let weightedRoll=
    terrainHash(
      x+4171,
      y-2089
    ) % totalWeight;

  let selectedGroup=groups[groups.length-1];

  for(const group of groups){
    if(weightedRoll<group.weight){
      selectedGroup=group;
      break;
    }

    weightedRoll-=group.weight;
  }

  const variantHash=terrainHash(
    x-7919,
    y+3253
  );

  return selectedGroup.indices[
    variantHash % selectedGroup.indices.length
  ];
}

function terrainTreeSeedChance(tileSet){
  const targetCoverage=Math.max(
    0,
    Math.min(1,tileSet?.treeCoverageRatio || 0)
  );

  if(targetCoverage<=0){
    return 0;
  }

  const clusterChance=Math.max(
    0,
    Math.min(1,tileSet?.treeClusterChance || 0)
  );

  const clusterMin=Math.max(2,tileSet?.treeClusterMin || 2);
  const clusterMax=Math.max(clusterMin,tileSet?.treeClusterMax || clusterMin);
  const averageClusterSize=(clusterMin+clusterMax)/2;
  const expectedTreesPerSeed=
    (1-clusterChance)*1 +
    clusterChance*averageClusterSize;

  return Math.max(
    0,
    Math.min(1,targetCoverage/expectedTreesPerSeed)
  );
}

function treeVariantCount(tileSet){
  return Math.max(
    1,
    (tileSet?.treeColumns || 1) *
    (tileSet?.treeRows || 1)
  );
}

function terrainTreeSeedDefinition(tileSet,x,y){
  if(
    !tileSet?.treeSheetSrc ||
    !tileSet?.treeCoverageRatio
  ){
    return null;
  }

  const seedChance=terrainTreeSeedChance(tileSet);
  if(seedChance<=0){
    return null;
  }

  if(terrainRand(x,y,2600)>=seedChance){
    return null;
  }

  const clustered=
    terrainRand(x,y,2601)<(tileSet.treeClusterChance || 0);

  const clusterSize=clustered
    ? (
        (tileSet.treeClusterMin || 2) +
        Math.floor(
          terrainRand(x,y,2602)*
          ((tileSet.treeClusterMax || 3)-(tileSet.treeClusterMin || 2)+1)
        )
      )
    : 1;

  return {
    x,
    y,
    clusterSize,
    variantBase:
      terrainHash(x+1103,y-977) % treeVariantCount(tileSet),
    priority:
      terrainRand(x,y,2603)
  };
}

function terrainTreeClusterPositions(tileSet,seed){
  const positions=[{x:seed.x,y:seed.y}];

  if(seed.clusterSize<=1){
    return positions;
  }

  const neighborOrder=HEX_DIRS
    .map((dir,index)=>({
      x:seed.x+dir.x,
      y:seed.y+dir.y,
      rank:terrainRand(seed.x,seed.y,2620+index*17)
    }))
    .sort((a,b)=>a.rank-b.rank);

  for(const option of neighborOrder){
    if(!inside(option.x,option.y)){
      continue;
    }

    positions.push({
      x:option.x,
      y:option.y
    });

    if(positions.length>=seed.clusterSize){
      break;
    }
  }

  return positions;
}

function visibleTreeDecorations(tiles){
  const tileSet=activeCombatTerrainTileSet();

  const image=TERRAIN_TREE_IMAGES.get(tileSet.id);

  if(
    !tiles?.length ||
    !tileSet?.treeSheetSrc ||
    !image
  ){
    return [];
  }

  const visibleKeys=new Set();
  let minX=Infinity;
  let maxX=-Infinity;
  let minY=Infinity;
  let maxY=-Infinity;

  for(const tile of tiles){
    visibleKeys.add(key(tile.x,tile.y));
    minX=Math.min(minX,tile.x);
    maxX=Math.max(maxX,tile.x);
    minY=Math.min(minY,tile.y);
    maxY=Math.max(maxY,tile.y);
  }

  const decorationsByKey=new Map();

  for(let x=minX-1;x<=maxX+1;x++){
    for(let y=minY-1;y<=maxY+1;y++){
      if(!inside(x,y)){
        continue;
      }

      const seed=terrainTreeSeedDefinition(tileSet,x,y);
      if(!seed){
        continue;
      }

      const cluster=terrainTreeClusterPositions(tileSet,seed);

      cluster.forEach((position,index)=>{
        const positionKey=key(position.x,position.y);

        /* R123: indoor architectural space never receives outdoor trees. */
        if(isIndoorWorldPoint(worldPointForHex(position.x,position.y))){
          return;
        }

        if(!visibleKeys.has(positionKey)){
          return;
        }

        const decoration={
          x:position.x,
          y:position.y,
          tileIndex:
            (seed.variantBase+index*7) % treeVariantCount(tileSet),
          rank:seed.priority + index/100,
          occupied:!!livingUnitAt(position.x,position.y)
        };

        const existing=decorationsByKey.get(positionKey);

        if(!existing || decoration.rank<existing.rank){
          decorationsByKey.set(positionKey,decoration);
        }
      });
    }
  }

  return [...decorationsByKey.values()];
}

function countTreeHexesOnCurrentMap(){
  const tileSet=activeCombatTerrainTileSet();
  const allTiles=[];

  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++){
    for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++){
      allTiles.push({x,y});
    }
  }

  return visibleTreeDecorations(allTiles).length;
}

function drawTreeDecoration(decoration){
  const tileSet=activeCombatTerrainTileSet();
  const image=TERRAIN_TREE_IMAGES.get(tileSet.id);

  if(
    !decoration ||
    !image?.complete ||
    image.naturalWidth<=0
  ){
    return;
  }

  const c=hexCenter(decoration.x,decoration.y);
  const drawH=tileSet.treeDrawHeight || 86;
  const drawW=Math.max(
    1,
    Math.round(
      drawH*
      ((tileSet.treeSourceTileWidth || 192)/(tileSet.treeSourceTileHeight || 216))
    )
  );

  const sourceColumn=
    decoration.tileIndex % (tileSet.treeColumns || 1);
  const sourceRow=
    Math.floor(decoration.tileIndex/(tileSet.treeColumns || 1));

  const sourceTileWidth=tileSet.treeSourceTileWidth || 192;
  const sourceTileHeight=tileSet.treeSourceTileHeight || 216;
  const sx=sourceColumn*sourceTileWidth;
  const sy=sourceRow*sourceTileHeight;

  /*
    R76: all 32 source sprites are normalized so their actual trunk/root
    base shares this source-space anchor. Map that point to the exact
    center of the hex instead of assuming the image cell's bottom-center.
  */
  const sourceBaseX=tileSet.treeBaseAnchorX ?? (sourceTileWidth/2);
  const sourceBaseY=tileSet.treeBaseAnchorY ?? sourceTileHeight;
  const scaleX=drawW/sourceTileWidth;
  const scaleY=drawH/sourceTileHeight;
  const drawX=c.x-sourceBaseX*scaleX;
  const drawY=c.y-sourceBaseY*scaleY;

  ctx.save();
  ctx.translate(c.x,c.y+1);
  ctx.scale(1.06,0.34);
  ctx.fillStyle="rgba(0,0,0,0.28)";
  ctx.beginPath();
  /* R76: double the previous radius from 13 to 26. */
  ctx.arc(0,0,26,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(
    image,
    sx,
    sy,
    sourceTileWidth,
    sourceTileHeight,
    Math.round(drawX),
    Math.round(drawY),
    drawW,
    drawH
  );
  ctx.restore();
}

/* ============================================================
   PIXEL EDITOR
   Edits current in-game assets using explicit source/workspace/render dimensions, VGA 256 colors, anchors, and save/submit handoff.
   ============================================================ */

const PIXEL_EDITOR_GRID_SIZE=64;

/*
  R162 canonical sprite asset specification.
  These fields intentionally separate four things that used to be conflated:
    sourceWidth/sourceHeight   - immutable original PNG dimensions
    workspaceWidth/Height      - Pixel Studio editing canvas
    renderWidth/renderHeight   - intended in-game display size
    anchorX/anchorY             - workspace pixel placed on the battlefield origin
*/
const pixelEditorAssets=[
  {
    id:"fighter",
    label:"Dungeon Crawler Carl",
    defaultCategory:"units",
    gameImage:fighterSprite,
    originalSrc:FIGHTER_SPRITE_SRC,
    spec:{
      sourceWidth:64,sourceHeight:64,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:32,renderHeight:35,
      anchorX:32,anchorY:64,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-stand",
    label:"Kobold Stand",
    defaultCategory:"units",
    gameImage:koboldSprite,
    originalSrc:KOBOLD_NORMAL_SPRITE_SRC,
    spec:{
      sourceWidth:64,sourceHeight:64,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:27,renderHeight:28,
      anchorX:32,anchorY:64,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-attack",
    label:"Kobold Attack",
    defaultCategory:"units",
    gameImage:koboldAttackSprite,
    originalSrc:KOBOLD_NORMAL_ATTACK_SPRITE_SRC,
    spec:{
      sourceWidth:64,sourceHeight:64,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:33,renderHeight:28,
      anchorX:32,anchorY:60,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-prone",
    label:"Kobold Prone",
    defaultCategory:"units",
    gameImage:koboldProneSprite,
    originalSrc:KOBOLD_PRONE_SPRITE_SRC,
    spec:{
      sourceWidth:64,sourceHeight:32,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:35,renderHeight:18,
      anchorX:32,anchorY:48,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-bodyguard-stand",
    label:"Body Guard Stand",
    defaultCategory:"units",
    gameImage:koboldBodyguardSprite,
    originalSrc:KOBOLD_SPRITE_SRC,
    spec:{
      sourceWidth:120,sourceHeight:110,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:30,renderHeight:28,
      anchorX:32,anchorY:61,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-bodyguard-attack",
    label:"Body Guard Attack",
    defaultCategory:"units",
    gameImage:koboldBodyguardAttackSprite,
    originalSrc:KOBOLD_ATTACK_SPRITE_SRC,
    spec:{
      sourceWidth:117,sourceHeight:127,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:29,renderHeight:32,
      anchorX:32,anchorY:64,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-slinger-stand",
    label:"Slinger Stand",
    defaultCategory:"units",
    gameImage:koboldSlingerStandSprite,
    originalSrc:KOBOLD_SLINGER_STAND_SPRITE_SRC,
    spec:{
      sourceWidth:113,sourceHeight:134,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:28,renderHeight:34,
      anchorX:32,anchorY:64,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"kobold-slinger-attack",
    label:"Slinger Attack",
    defaultCategory:"units",
    gameImage:koboldSlingerAttackSprite,
    originalSrc:KOBOLD_SLINGER_ATTACK_SPRITE_SRC,
    spec:{
      sourceWidth:169,sourceHeight:111,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:42,renderHeight:28,
      anchorX:32,anchorY:53,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"orc-stand",
    label:"Orc Stand",
    defaultCategory:"units",
    gameImage:orcStandSprite,
    originalSrc:ORC_STAND_SPRITE_SRC,
    spec:{
      sourceWidth:101,sourceHeight:107,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:34,renderHeight:36,
      anchorX:32,anchorY:64,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"orc-attack",
    label:"Orc Attack",
    defaultCategory:"units",
    gameImage:orcAttackSprite,
    originalSrc:ORC_ATTACK_SPRITE_SRC,
    spec:{
      sourceWidth:125,sourceHeight:116,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:39,renderHeight:36,
      anchorX:32,anchorY:62,
      scaleMode:"fit",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:null,runtimeAnchor:null
  },
  {
    id:"death-marker",
    label:"Death Marker",
    defaultCategory:"combat-fx",
    gameImage:deathMarkerSprite,
    originalSrc:DEATH_MARKER_SPRITE_SRC,
    spec:{
      sourceWidth:32,sourceHeight:32,
      workspaceWidth:64,workspaceHeight:64,
      renderWidth:40,renderHeight:40,
      anchorX:32,anchorY:48,
      scaleMode:"actual",lockAspect:true,nativeFacing:"right"
    },
    editCanvas:null,editCtx:null,dirty:false,sourceScale:1,runtimeAnchor:null
  }
];

function getPixelEditorAsset(id){
  return pixelEditorAssets.find(item=>item.id===id) || null;
}

function getSpriteAssetSpec(id){
  return getPixelEditorAsset(id)?.spec || null;
}

function spriteRenderDimensions(id,image,fallbackWidth=null,fallbackHeight=null){
  const spec=getSpriteAssetSpec(id);
  if(spec?.renderWidth>0 && spec?.renderHeight>0){
    return {width:spec.renderWidth,height:spec.renderHeight};
  }

  const width=fallbackWidth || image?.naturalWidth || image?.width || 1;
  const height=fallbackHeight || image?.naturalHeight || image?.height || 1;
  return {width,height};
}


const VGA_BASE_COLORS=[
  "#000000","#0000AA","#00AA00","#00AAAA","#AA0000","#AA00AA","#AA5500","#AAAAAA",
  "#555555","#5555FF","#55FF55","#55FFFF","#FF5555","#FF55FF","#FFFF55","#FFFFFF"
];
const VGA_CUBE_LEVELS=[0x00,0x33,0x66,0x99,0xCC,0xFF];

function rgbToHex(r,g,b){
  return `#${[r,g,b].map(value=>value.toString(16).padStart(2,"0")).join("").toUpperCase()}`;
}

function buildVga256Palette(){
  const palette=[...VGA_BASE_COLORS];

  for(const r of VGA_CUBE_LEVELS){
    for(const g of VGA_CUBE_LEVELS){
      for(const b of VGA_CUBE_LEVELS){
        palette.push(rgbToHex(r,g,b));
      }
    }
  }

  for(let i=0;i<24;i++){
    const value=8+i*10;
    palette.push(rgbToHex(value,value,value));
  }

  return palette.slice(0,256);
}

const VGA_256_PALETTE=buildVga256Palette();

let pixelEditorAsset=null;
let pixelEditorTool="pencil";
let pixelEditorZoom=8;
let pixelEditorPainting=false;
let pixelSelectedColor="#FFCC33";

const pixelCanvas=document.getElementById("pixelCanvas");
const pixelCtx=pixelCanvas.getContext("2d",{willReadFrequently:true});
const pixelPreview=document.getElementById("pixelPreview");
const pixelPreviewCtx=pixelPreview.getContext("2d");
const pixelAssetList=document.getElementById("pixelAssetList");
const pixelAssetTitle=document.getElementById("pixelAssetTitle");
const pixelAssetSize=document.getElementById("pixelAssetSize");
const pixelStatus=document.getElementById("pixelStatus");
const pixelPalette=document.getElementById("pixelPalette");
const pixelSelectedColorSwatch=document.getElementById("pixelSelectedColorSwatch");
const pixelSelectedColorLabel=document.getElementById("pixelSelectedColorLabel");
const pixelZoom=document.getElementById("pixelZoom");
const pixelSourceScale=document.getElementById("pixelSourceScale");
const pixelSourceScaleValue=document.getElementById("pixelSourceScaleValue");
const pixelFitScaleButton=document.getElementById("pixelFitScaleButton");
const pixelOriginalScaleButton=document.getElementById("pixelOriginalScaleButton");
const pixelGridToggle=document.getElementById("pixelGridToggle");
const pixelPencilButton=document.getElementById("pixelPencilButton");
const pixelEraserButton=document.getElementById("pixelEraserButton");
const pixelSubmitName=document.getElementById("pixelSubmitName");
const pixelSubmitCategory=document.getElementById("pixelSubmitCategory");
const pixelSubmitType=document.getElementById("pixelSubmitType");
const pixelSubmitNotes=document.getElementById("pixelSubmitNotes");
const pixelSubmitEndpoint=document.getElementById("pixelSubmitEndpoint");
const pixelSubmitKey=document.getElementById("pixelSubmitKey");
const pixelSubmitButton=document.getElementById("pixelSubmitButton");
const pixelDownloadSubmissionButton=document.getElementById("pixelDownloadSubmissionButton");
const pixelSubmitResult=document.getElementById("pixelSubmitResult");
const pixelSaveButton=document.getElementById("pixelSaveButton");
const pixelSourceWidth=document.getElementById("pixelSourceWidth");
const pixelSourceHeight=document.getElementById("pixelSourceHeight");
const pixelWorkspaceWidth=document.getElementById("pixelWorkspaceWidth");
const pixelWorkspaceHeight=document.getElementById("pixelWorkspaceHeight");
const pixelRenderWidth=document.getElementById("pixelRenderWidth");
const pixelRenderHeight=document.getElementById("pixelRenderHeight");
const pixelAnchorX=document.getElementById("pixelAnchorX");
const pixelAnchorY=document.getElementById("pixelAnchorY");
const pixelScaleMode=document.getElementById("pixelScaleMode");
const pixelLockAspect=document.getElementById("pixelLockAspect");
const pixelResizeWorkspaceButton=document.getElementById("pixelResizeWorkspaceButton");
const koboldScaleTestButton=document.getElementById("koboldScaleTestButton");
const koboldScaleTestOverlay=document.getElementById("koboldScaleTestOverlay");
const koboldScaleTestClose=document.getElementById("koboldScaleTestClose");
const koboldScaleTestCanvas=document.getElementById("koboldScaleTestCanvas");
const koboldScaleTestCtx=koboldScaleTestCanvas?.getContext("2d");


function drawScaleTestHex(ctx,cx,cy,w=122,h=92){
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx-w/2,cy);
  ctx.lineTo(cx-w/4,cy-h/2);
  ctx.lineTo(cx+w/4,cy-h/2);
  ctx.lineTo(cx+w/2,cy);
  ctx.lineTo(cx+w/4,cy+h/2);
  ctx.lineTo(cx-w/4,cy+h/2);
  ctx.closePath();
  ctx.fillStyle="#40543a";
  ctx.fill();
  ctx.strokeStyle="#17281f";
  ctx.lineWidth=3;
  ctx.stroke();

  /* restrained terrain pixels for scale context */
  ctx.fillStyle="#526a45";
  for(const [ox,oy] of [[-34,-9],[31,-21],[-16,27],[38,18],[7,-31]]){
    ctx.fillRect(Math.round(cx+ox),Math.round(cy+oy),3,5);
    ctx.fillRect(Math.round(cx+ox+3),Math.round(cy+oy+2),2,3);
  }
  ctx.restore();
}

function drawScaleTestLabel(ctx,textValue,x,y,color="#f0d978"){
  ctx.save();
  ctx.font='12px "AdventureGoldBox", "Gold Box", "Lucida Console", monospace';
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineWidth=3;
  ctx.strokeStyle="#050507";
  ctx.fillStyle=color;
  ctx.strokeText(textValue,x,y);
  ctx.fillText(textValue,x,y);
  ctx.restore();
}

function drawScaleTestSprite(ctx,image,cx,bottomY,drawW,drawH,{shadowWidth=null,shadowHeight=7,nativeFacing="right",facing="right"}={}){
  if(!image?.complete || !image.naturalWidth) return;

  const sw=Math.max(6,shadowWidth ?? drawW);
  ctx.save();
  ctx.globalAlpha=0.48;
  ctx.fillStyle="#090a08";
  ctx.beginPath();
  ctx.ellipse(cx,bottomY-1,sw/2,shadowHeight/2,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(cx,bottomY);
  if(facing!==nativeFacing) ctx.scale(-1,1);
  ctx.drawImage(image,-Math.round(drawW/2),-drawH,drawW,drawH);
  ctx.restore();
}

function renderKoboldScaleTest(){
  const ctx=koboldScaleTestCtx;
  if(!ctx) return;

  const W=koboldScaleTestCanvas.width;
  const H=koboldScaleTestCanvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#14131b";
  ctx.fillRect(0,0,W,H);
  ctx.imageSmoothingEnabled=false;

  ctx.save();
  ctx.font='18px "AdventureGoldBox", "Gold Box", "Lucida Console", monospace';
  ctx.textAlign="left";
  ctx.textBaseline="middle";
  ctx.fillStyle="#f0d978";
  ctx.fillText("LIVE KOBOLD REFERENCES",24,28);
  ctx.fillStyle="#7ee7ff";
  ctx.fillText("PRONE CANDIDATES — choose 1–5",448,28);
  ctx.restore();

  const panels=[];

  function livePanel(label,image,referenceHeight,targetHeight=28){
    const scale=targetHeight/referenceHeight;
    return {
      label,
      image,
      drawW:Math.max(1,Math.round(image.naturalWidth*scale)),
      drawH:Math.max(1,Math.round(image.naturalHeight*scale)),
      prone:false
    };
  }

  panels.push(livePanel("Kobold",koboldSprite,koboldSprite.naturalHeight||116));
  panels.push(livePanel("Body Guard",koboldBodyguardSprite,koboldBodyguardSprite.naturalHeight||93));
  panels.push(livePanel("Slinger",koboldSlingerStandSprite,128));

  const proneOptions=[14,15,16,17,18];
  for(let i=0;i<proneOptions.length;i++){
    const targetHeight=proneOptions[i];
    const scale=targetHeight/(koboldProneSprite.naturalHeight||111);
    panels.push({
      label:`Option ${i+1}`,
      sublabel:`${targetHeight}px`,
      image:koboldProneSprite,
      drawW:Math.max(1,Math.round(koboldProneSprite.naturalWidth*scale)),
      drawH:Math.max(1,Math.round(koboldProneSprite.naturalHeight*scale)),
      prone:true
    });
  }

  const panelW=140;
  const startX=74;
  const cellY=190;
  const baselineY=218;

  for(let i=0;i<panels.length;i++){
    const p=panels[i];
    const cx=startX+i*panelW;

    if(i===3){
      ctx.save();
      ctx.strokeStyle="#545167";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(cx-panelW/2+1,52);
      ctx.lineTo(cx-panelW/2+1,340);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle=i<3 ? "#1d1b29" : "#231f18";
    ctx.strokeStyle=i<3 ? "#5a5868" : "#817447";
    ctx.lineWidth=2;
    ctx.fillRect(cx-64,52,128,278);
    ctx.strokeRect(cx-64,52,128,278);
    ctx.restore();

    drawScaleTestLabel(ctx,p.label,cx,74,i<3 ? "#7ee7ff" : "#fff19a");
    if(p.sublabel) drawScaleTestLabel(ctx,p.sublabel,cx,94,"#b8b4c5");

    drawScaleTestHex(ctx,cx,cellY,116,86);

    if(p.prone){
      /* Requested comparison shadow: touching the sprite and as wide as it is. */
      drawScaleTestSprite(ctx,p.image,cx,baselineY,p.drawW,p.drawH,{
        shadowWidth:p.drawW,
        shadowHeight:6
      });
    }else{
      drawScaleTestSprite(ctx,p.image,cx,baselineY,p.drawW,p.drawH,{
        shadowWidth:Math.max(22,p.drawW*0.72),
        shadowHeight:6,
        nativeFacing:"right",
        facing:"right"
      });
    }

    if(p.prone){
      drawScaleTestLabel(ctx,`${p.drawW}×${p.drawH}`,cx,304,"#c6c3d0");
    }else{
      drawScaleTestLabel(ctx,"LIVE SCALE",cx,304,"#9aa0aa");
    }
  }

  ctx.save();
  ctx.fillStyle="#7ee7ff";
  ctx.font='13px "AdventureGoldBox", "Gold Box", "Lucida Console", monospace';
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(
    "Prone shadows shown at full rendered sprite width and touching the sprite bottom. Current combat prone remains 20px.",
    W/2,
    370
  );
  ctx.fillStyle="#b8b4c5";
  ctx.fillText("Tell me which Option number looks best and I will apply that exact engine scale to combat.",W/2,400);
  ctx.restore();
}

function openKoboldScaleTest(){
  if(!koboldScaleTestOverlay) return;
  koboldScaleTestOverlay.classList.add("show");
  koboldScaleTestOverlay.setAttribute("aria-hidden","false");

  const images=[koboldSprite,koboldBodyguardSprite,koboldSlingerStandSprite,koboldProneSprite];
  if(images.every(img=>img.complete && img.naturalWidth)){
    renderKoboldScaleTest();
  }else{
    Promise.all(images.map(img=>
      img.complete && img.naturalWidth
        ? Promise.resolve()
        : new Promise(resolve=>{
            img.addEventListener("load",resolve,{once:true});
            img.addEventListener("error",resolve,{once:true});
          })
    )).then(renderKoboldScaleTest);
  }
}

function closeKoboldScaleTest(){
  if(!koboldScaleTestOverlay) return;
  koboldScaleTestOverlay.classList.remove("show");
  koboldScaleTestOverlay.setAttribute("aria-hidden","true");
}

koboldScaleTestButton?.addEventListener("click",openKoboldScaleTest);
koboldScaleTestClose?.addEventListener("click",closeKoboldScaleTest);
koboldScaleTestOverlay?.addEventListener("click",event=>{
  if(event.target===koboldScaleTestOverlay) closeKoboldScaleTest();
});

function loadImageSource(src){
  return new Promise((resolve,reject)=>{
    const image=new Image();

    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("Unable to load sprite image."));
    image.src=src;
  });
}

function fitScaleForImageToWorkspace(image,width,height){
  const sourceWidth=image?.naturalWidth || image?.width || 1;
  const sourceHeight=image?.naturalHeight || image?.height || 1;
  return Math.min(width/sourceWidth,height/sourceHeight,1);
}

function getAssetSourceScale(asset,image){
  const spec=asset?.spec || {};
  if(spec.scaleMode==="actual") return 1;
  if(spec.scaleMode==="fit"){
    return fitScaleForImageToWorkspace(
      image,
      spec.workspaceWidth || PIXEL_EDITOR_GRID_SIZE,
      spec.workspaceHeight || PIXEL_EDITOR_GRID_SIZE
    );
  }

  const numeric=Number(asset?.sourceScale);
  if(Number.isFinite(numeric) && numeric>0){
    return numeric;
  }
  return 1;
}

function renderSourceImageToAssetCanvas(asset,image,scale=null,{resetAnchor=true}={}){
  if(!asset?.editCtx || !asset?.editCanvas || !image) return;

  const sourceWidth=image.naturalWidth || image.width || 0;
  const sourceHeight=image.naturalHeight || image.height || 0;
  const resolvedScale=Math.max(0.05,Number(scale ?? getAssetSourceScale(asset,image)) || 1);
  const drawW=Math.max(1,Math.round(sourceWidth*resolvedScale));
  const drawH=Math.max(1,Math.round(sourceHeight*resolvedScale));
  const dx=Math.floor((asset.editCanvas.width-drawW)/2);
  const dy=Math.floor((asset.editCanvas.height-drawH)/2);

  asset.sourceScale=resolvedScale;
  asset.editCtx.clearRect(0,0,asset.editCanvas.width,asset.editCanvas.height);
  asset.editCtx.drawImage(image,dx,dy,drawW,drawH);

  if(resetAnchor && asset.spec){
    asset.spec.anchorX=Math.round((dx+drawW/2)*2)/2;
    asset.spec.anchorY=Math.round((dy+drawH)*2)/2;
  }
}

async function ensurePixelAssetCanvas(asset){
  if(asset.editCanvas && asset.editCtx) return asset;

  const sourceImage=
    asset.gameImage.complete && asset.gameImage.naturalWidth
      ? asset.gameImage
      : await loadImageSource(asset.originalSrc);

  if(asset.spec){
    asset.spec.sourceWidth=sourceImage.naturalWidth || asset.spec.sourceWidth;
    asset.spec.sourceHeight=sourceImage.naturalHeight || asset.spec.sourceHeight;
  }

  const editCanvas=document.createElement("canvas");
  editCanvas.width=asset.spec?.workspaceWidth || PIXEL_EDITOR_GRID_SIZE;
  editCanvas.height=asset.spec?.workspaceHeight || PIXEL_EDITOR_GRID_SIZE;

  const editCtx=editCanvas.getContext("2d",{willReadFrequently:true});
  editCtx.imageSmoothingEnabled=false;

  asset.editCanvas=editCanvas;
  asset.editCtx=editCtx;
  renderSourceImageToAssetCanvas(asset,sourceImage,getAssetSourceScale(asset,sourceImage),{resetAnchor:true});

  return asset;
}

function setPixelSelectedColor(color){
  pixelSelectedColor=String(color || "#000000").toUpperCase();
  if(pixelSelectedColorSwatch){
    pixelSelectedColorSwatch.style.background=pixelSelectedColor;
  }
  if(pixelSelectedColorLabel){
    pixelSelectedColorLabel.textContent=`Selected: ${pixelSelectedColor}`;
  }

  if(pixelPalette){
    const buttons=pixelPalette.querySelectorAll(".pixel-palette-button");
    buttons.forEach(button=>{
      button.classList.toggle(
        "active",
        button.dataset.color===pixelSelectedColor
      );
    });
  }
}

function renderPixelPalette(){
  if(!pixelPalette) return;
  pixelPalette.innerHTML="";

  for(const color of VGA_256_PALETTE){
    const button=document.createElement("button");
    button.type="button";
    button.className="pixel-palette-button";
    button.dataset.color=color;
    button.title=color;
    button.setAttribute("aria-label",`Select color ${color}`);
    button.style.background=color;
    button.addEventListener("click",()=>{
      setPixelSelectedColor(color);
    });
    pixelPalette.appendChild(button);
  }

  setPixelSelectedColor(pixelSelectedColor);
}

function updatePixelSourceScaleUi(){
  const asset=pixelEditorAsset;
  const percent=Math.round((Number(asset?.sourceScale || 1) || 1)*100);

  if(pixelSourceScale){
    pixelSourceScale.value=String(Math.max(10,Math.min(300,percent)));
    pixelSourceScale.disabled=asset?.spec?.scaleMode!=="custom";
  }
  if(pixelSourceScaleValue){
    pixelSourceScaleValue.textContent=`${percent}%`;
  }
}

function updatePixelPropertiesUi(){
  const asset=pixelEditorAsset;
  const spec=asset?.spec;
  if(!spec) return;

  if(pixelSourceWidth) pixelSourceWidth.value=spec.sourceWidth ?? "";
  if(pixelSourceHeight) pixelSourceHeight.value=spec.sourceHeight ?? "";
  if(pixelWorkspaceWidth) pixelWorkspaceWidth.value=spec.workspaceWidth ?? PIXEL_EDITOR_GRID_SIZE;
  if(pixelWorkspaceHeight) pixelWorkspaceHeight.value=spec.workspaceHeight ?? PIXEL_EDITOR_GRID_SIZE;
  if(pixelRenderWidth) pixelRenderWidth.value=spec.renderWidth ?? "";
  if(pixelRenderHeight) pixelRenderHeight.value=spec.renderHeight ?? "";
  if(pixelAnchorX) pixelAnchorX.value=spec.anchorX ?? 0;
  if(pixelAnchorY) pixelAnchorY.value=spec.anchorY ?? 0;
  if(pixelScaleMode) pixelScaleMode.value=spec.scaleMode || "fit";
  if(pixelLockAspect) pixelLockAspect.checked=spec.lockAspect!==false;
}

function clampNumber(value,min,max,fallback){
  const numeric=Number(value);
  if(!Number.isFinite(numeric)) return fallback;
  return Math.max(min,Math.min(max,numeric));
}

function readPixelPropertiesFromUi({renderChanged=null}={}){
  const asset=pixelEditorAsset;
  const spec=asset?.spec;
  if(!spec) return;

  spec.workspaceWidth=Math.round(clampNumber(pixelWorkspaceWidth?.value,16,512,spec.workspaceWidth || 64));
  spec.workspaceHeight=Math.round(clampNumber(pixelWorkspaceHeight?.value,16,512,spec.workspaceHeight || 64));
  spec.anchorX=clampNumber(pixelAnchorX?.value,0,spec.workspaceWidth,spec.anchorX || 0);
  spec.anchorY=clampNumber(pixelAnchorY?.value,0,spec.workspaceHeight,spec.anchorY || 0);
  spec.scaleMode=pixelScaleMode?.value || spec.scaleMode || "fit";
  spec.lockAspect=pixelLockAspect?.checked!==false;

  let renderWidth=Math.round(clampNumber(pixelRenderWidth?.value,1,512,spec.renderWidth || 1));
  let renderHeight=Math.round(clampNumber(pixelRenderHeight?.value,1,512,spec.renderHeight || 1));

  if(spec.lockAspect && renderChanged){
    const sourceAspect=(spec.sourceWidth || 1)/(spec.sourceHeight || 1);
    if(renderChanged==="width"){
      renderHeight=Math.max(1,Math.round(renderWidth/sourceAspect));
    }else if(renderChanged==="height"){
      renderWidth=Math.max(1,Math.round(renderHeight*sourceAspect));
    }
  }

  spec.renderWidth=renderWidth;
  spec.renderHeight=renderHeight;

  updatePixelPropertiesUi();
  updatePixelSourceScaleUi();

  if(currentScreen==="combat") draw();
}

async function rescalePixelEditorAsset(scaleValue){
  const asset=pixelEditorAsset;
  if(!asset) return;

  const sourceImage=await loadImageSource(asset.originalSrc);
  const numeric=Math.max(0.1,(Number(scaleValue) || 100)/100);
  asset.sourceScale=numeric;
  if(asset.spec) asset.spec.scaleMode="custom";
  renderSourceImageToAssetCanvas(asset,sourceImage,numeric,{resetAnchor:true});
  asset.dirty=true;
  pixelStatus.textContent=`${asset.label}: source rescaled to ${Math.round(numeric*100)}% inside the workspace.`;
  renderPixelEditor();
}

async function fitPixelEditorAssetToGrid(){
  const asset=pixelEditorAsset;
  if(!asset) return;

  const sourceImage=await loadImageSource(asset.originalSrc);
  if(asset.spec) asset.spec.scaleMode="fit";
  const fitScale=fitScaleForImageToWorkspace(
    sourceImage,
    asset.spec?.workspaceWidth || PIXEL_EDITOR_GRID_SIZE,
    asset.spec?.workspaceHeight || PIXEL_EDITOR_GRID_SIZE
  );
  asset.sourceScale=fitScale;
  renderSourceImageToAssetCanvas(asset,sourceImage,fitScale,{resetAnchor:true});
  asset.dirty=true;
  pixelStatus.textContent=`${asset.label}: auto-fit to ${asset.editCanvas.width} × ${asset.editCanvas.height} at ${Math.round(fitScale*100)}%.`;
  renderPixelEditor();
}

async function setPixelEditorAssetOriginalScale(){
  const asset=pixelEditorAsset;
  if(!asset) return;

  const sourceImage=await loadImageSource(asset.originalSrc);
  if(asset.spec) asset.spec.scaleMode="actual";
  asset.sourceScale=1;
  renderSourceImageToAssetCanvas(asset,sourceImage,1,{resetAnchor:true});
  asset.dirty=true;
  pixelStatus.textContent=`${asset.label}: source restored to 100% inside the workspace.`;
  renderPixelEditor();
}

async function applyPixelScaleMode(){
  const asset=pixelEditorAsset;
  if(!asset?.spec) return;
  asset.spec.scaleMode=pixelScaleMode?.value || "fit";

  if(asset.spec.scaleMode==="fit"){
    await fitPixelEditorAssetToGrid();
  }else if(asset.spec.scaleMode==="actual"){
    await setPixelEditorAssetOriginalScale();
  }else{
    updatePixelSourceScaleUi();
    updatePixelPropertiesUi();
  }
}

function resizeCanvasPreservingPixels(sourceCanvas,newWidth,newHeight,anchorX,anchorY){
  const result=document.createElement("canvas");
  result.width=newWidth;
  result.height=newHeight;
  const resultCtx=result.getContext("2d",{willReadFrequently:true});
  resultCtx.imageSmoothingEnabled=false;

  const dx=Math.floor((newWidth-sourceCanvas.width)/2);
  const dy=Math.floor((newHeight-sourceCanvas.height)/2);
  resultCtx.drawImage(sourceCanvas,dx,dy);

  return {
    canvas:result,
    ctx:resultCtx,
    anchorX:clampNumber(anchorX+dx,0,newWidth,newWidth/2),
    anchorY:clampNumber(anchorY+dy,0,newHeight,newHeight)
  };
}

function resizePixelEditorWorkspace(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas || !asset.spec) return;

  const newWidth=Math.round(clampNumber(pixelWorkspaceWidth?.value,16,512,asset.spec.workspaceWidth));
  const newHeight=Math.round(clampNumber(pixelWorkspaceHeight?.value,16,512,asset.spec.workspaceHeight));

  if(newWidth===asset.editCanvas.width && newHeight===asset.editCanvas.height){
    readPixelPropertiesFromUi();
    pixelStatus.textContent=`${asset.label}: workspace is already ${newWidth} × ${newHeight}.`;
    return;
  }

  const resized=resizeCanvasPreservingPixels(
    asset.editCanvas,
    newWidth,
    newHeight,
    asset.spec.anchorX || 0,
    asset.spec.anchorY || 0
  );

  asset.editCanvas=resized.canvas;
  asset.editCtx=resized.ctx;
  asset.spec.workspaceWidth=newWidth;
  asset.spec.workspaceHeight=newHeight;
  asset.spec.anchorX=resized.anchorX;
  asset.spec.anchorY=resized.anchorY;
  asset.dirty=true;

  pixelStatus.textContent=`${asset.label}: workspace resized to ${newWidth} × ${newHeight}; existing pixels were preserved.`;
  renderPixelEditor();
}

function renderPixelAssetList(){
  pixelAssetList.innerHTML="";

  for(const asset of pixelEditorAssets){
    const button=document.createElement("button");
    button.type="button";
    button.className="pixel-asset-button";
    button.textContent=
      asset.label+
      (asset.dirty ? " *" : "");

    button.classList.toggle(
      "active",
      pixelEditorAsset?.id===asset.id
    );

    button.addEventListener("click",()=>{
      selectPixelAsset(asset.id);
    });

    pixelAssetList.appendChild(button);
  }
}

function drawPixelChecker(ctx,width,height,cell=8){
  ctx.clearRect(0,0,width,height);

  for(let y=0;y<height;y+=cell){
    for(let x=0;x<width;x+=cell){
      const even=((x/cell)+(y/cell))%2===0;
      ctx.fillStyle=even ? "#313139" : "#1f1f26";
      ctx.fillRect(x,y,cell,cell);
    }
  }
}

function renderPixelEditor(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas) return;

  const source=asset.editCanvas;
  const zoom=pixelEditorZoom;

  pixelCanvas.width=source.width*zoom;
  pixelCanvas.height=source.height*zoom;

  pixelCtx.imageSmoothingEnabled=false;
  drawPixelChecker(
    pixelCtx,
    pixelCanvas.width,
    pixelCanvas.height,
    Math.max(4,zoom)
  );

  pixelCtx.drawImage(
    source,
    0,0,
    source.width,source.height,
    0,0,
    pixelCanvas.width,pixelCanvas.height
  );

  if(pixelGridToggle.checked && zoom>=5){
    pixelCtx.save();
    pixelCtx.strokeStyle="rgba(210,214,226,0.18)";
    pixelCtx.lineWidth=1;

    for(let x=0;x<=source.width;x++){
      const px=x*zoom+0.5;
      pixelCtx.beginPath();
      pixelCtx.moveTo(px,0);
      pixelCtx.lineTo(px,pixelCanvas.height);
      pixelCtx.stroke();
    }

    for(let y=0;y<=source.height;y++){
      const py=y*zoom+0.5;
      pixelCtx.beginPath();
      pixelCtx.moveTo(0,py);
      pixelCtx.lineTo(pixelCanvas.width,py);
      pixelCtx.stroke();
    }

    pixelCtx.restore();
  }

  pixelAssetTitle.textContent=
    asset.label+
    (asset.dirty ? " — EDITED" : "");

  pixelAssetSize.textContent=
    `${source.width} × ${source.height} px workspace`;

  updatePixelSourceScaleUi();
  updatePixelPropertiesUi();
  renderPixelPreview();
  renderPixelAssetList();
}

function renderPixelPreview(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas) return;

  drawPixelChecker(
    pixelPreviewCtx,
    pixelPreview.width,
    pixelPreview.height,
    12
  );

  const source=asset.editCanvas;
  const maxW=pixelPreview.width-24;
  const maxH=pixelPreview.height-24;

  const scale=Math.max(
    1,
    Math.floor(
      Math.min(
        maxW/source.width,
        maxH/source.height
      )
    )
  );

  const drawW=source.width*scale;
  const drawH=source.height*scale;
  const dx=Math.floor((pixelPreview.width-drawW)/2);
  const dy=Math.floor((pixelPreview.height-drawH)/2);

  pixelPreviewCtx.imageSmoothingEnabled=false;
  pixelPreviewCtx.drawImage(
    source,
    0,0,
    source.width,source.height,
    dx,dy,
    drawW,drawH
  );
}

async function selectPixelAsset(id){
  const asset=pixelEditorAssets.find(item=>item.id===id);
  if(!asset) return;

  await ensurePixelAssetCanvas(asset);

  pixelEditorAsset=asset;
  pixelStatus.textContent=
    `${asset.label}: ${asset.spec.sourceWidth} × ${asset.spec.sourceHeight} source; ${asset.spec.workspaceWidth} × ${asset.spec.workspaceHeight} workspace; ${asset.spec.renderWidth} × ${asset.spec.renderHeight} in game.`;

  if(pixelSubmitName && !pixelSubmitName.dataset.userEdited){
    pixelSubmitName.value=asset.label;
  }
  if(pixelSubmitCategory && asset.defaultCategory){
    pixelSubmitCategory.value=asset.defaultCategory;
  }

  renderPixelEditor();
}

async function initializePixelEditor(){
  renderPixelPalette();
  renderPixelAssetList();

  const preferred=
    pixelEditorAsset?.id ||
    "fighter";

  await selectPixelAsset(preferred);
}

function pixelCanvasPoint(event){
  const rect=pixelCanvas.getBoundingClientRect();

  return {
    x:(event.clientX-rect.left)*(pixelCanvas.width/rect.width),
    y:(event.clientY-rect.top)*(pixelCanvas.height/rect.height)
  };
}

function editPixelAtEvent(event){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas) return;

  const point=pixelCanvasPoint(event);
  const x=Math.floor(point.x/pixelEditorZoom);
  const y=Math.floor(point.y/pixelEditorZoom);

  if(
    x<0 ||
    y<0 ||
    x>=asset.editCanvas.width ||
    y>=asset.editCanvas.height
  ){
    return;
  }

  if(pixelEditorTool==="eraser"){
    asset.editCtx.clearRect(x,y,1,1);
  }else{
    asset.editCtx.fillStyle=pixelSelectedColor;
    asset.editCtx.fillRect(x,y,1,1);
  }

  asset.dirty=true;

  pixelStatus.textContent=
    `${asset.label}: edited pixel ${x}, ${y}.`;

  renderPixelEditor();
}

function setPixelEditorTool(tool){
  pixelEditorTool=tool;

  pixelPencilButton.classList.toggle(
    "active",
    tool==="pencil"
  );

  pixelEraserButton.classList.toggle(
    "active",
    tool==="eraser"
  );
}

async function resetPixelEditorAsset(){
  const asset=pixelEditorAsset;
  if(!asset) return;

  const original=await loadImageSource(asset.originalSrc);
  const spec=asset.spec || {};

  asset.editCanvas.width=spec.workspaceWidth || PIXEL_EDITOR_GRID_SIZE;
  asset.editCanvas.height=spec.workspaceHeight || PIXEL_EDITOR_GRID_SIZE;
  asset.editCtx=asset.editCanvas.getContext(
    "2d",
    {willReadFrequently:true}
  );

  asset.editCtx.imageSmoothingEnabled=false;
  renderSourceImageToAssetCanvas(asset,original,getAssetSourceScale(asset,original),{resetAnchor:true});

  asset.dirty=true;

  pixelStatus.textContent=
    `${asset.label}: reloaded from source using ${spec.scaleMode || "fit"} scale mode.`;

  renderPixelEditor();
}

function opaqueBoundsForCanvas(canvas){
  const c=canvas.getContext("2d",{willReadFrequently:true});
  const image=c.getImageData(0,0,canvas.width,canvas.height);
  const data=image.data;
  let minX=canvas.width;
  let minY=canvas.height;
  let maxX=-1;
  let maxY=-1;

  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<canvas.width;x++){
      const alpha=data[(y*canvas.width+x)*4+3];
      if(alpha===0) continue;
      if(x<minX) minX=x;
      if(y<minY) minY=y;
      if(x>maxX) maxX=x;
      if(y>maxY) maxY=y;
    }
  }

  if(maxX<minX || maxY<minY){
    return {x:0,y:0,width:canvas.width,height:canvas.height};
  }

  return {
    x:minX,
    y:minY,
    width:maxX-minX+1,
    height:maxY-minY+1
  };
}

function trimmedRuntimeCanvasForAsset(asset){
  const bounds=opaqueBoundsForCanvas(asset.editCanvas);
  const trimmed=document.createElement("canvas");
  trimmed.width=bounds.width;
  trimmed.height=bounds.height;
  const c=trimmed.getContext("2d",{willReadFrequently:true});
  c.imageSmoothingEnabled=false;
  c.drawImage(
    asset.editCanvas,
    bounds.x,bounds.y,bounds.width,bounds.height,
    0,0,bounds.width,bounds.height
  );

  const spec=asset.spec || {};
  const anchorX=clampNumber((spec.anchorX ?? asset.editCanvas.width/2)-bounds.x,0,bounds.width,bounds.width/2);
  const anchorY=clampNumber((spec.anchorY ?? asset.editCanvas.height)-bounds.y,0,bounds.height,bounds.height);

  return {
    canvas:trimmed,
    anchor:{
      x:bounds.width ? anchorX/bounds.width : 0.5,
      y:bounds.height ? anchorY/bounds.height : 1
    }
  };
}

function applyPixelEditorAsset(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas) return;

  readPixelPropertiesFromUi();
  const runtime=trimmedRuntimeCanvasForAsset(asset);
  const dataUrl=runtime.canvas.toDataURL("image/png");
  asset.runtimeAnchor=runtime.anchor;

  asset.gameImage._crispPrepared=false;
  asset.gameImage._crispRenderSource=null;
  asset.gameImage.onload=()=>{
    if(typeof prepareCrispPixelSprite==="function"){
      prepareCrispPixelSprite(asset.gameImage);
    }
    if(game){
      draw();
    }
  };

  asset.gameImage.src=dataUrl;
  asset.dirty=false;

  pixelStatus.textContent=
    `${asset.label}: applied at ${asset.spec.renderWidth} × ${asset.spec.renderHeight} game pixels.`;

  renderPixelEditor();
}

function savePixelEditorAsset(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas) return;

  readPixelPropertiesFromUi();
  const preferredName=(pixelSubmitName?.value || asset.label || asset.id).trim();
  const fileName=`${sanitizeSubmissionSlug(preferredName)}.png`;
  downloadDataUrl(fileName,asset.editCanvas.toDataURL("image/png"));
  pixelStatus.textContent=`${asset.label}: saved as ${fileName}.`;
}

const PIXEL_SUBMIT_ENDPOINT_STORAGE_KEY="adventureParty.pixelSubmitEndpoint";
const PIXEL_SUBMIT_KEY_STORAGE_KEY="adventureParty.pixelSubmitKey";

function setPixelSubmitResult(message,state=""){
  if(!pixelSubmitResult) return;
  pixelSubmitResult.textContent=message;
  pixelSubmitResult.className="pixel-submit-result"+(state ? ` ${state}` : "");
}

function sanitizeSubmissionSlug(value){
  return String(value || "sprite")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,64) || "sprite";
}

function timestampForSubmission(date=new Date()){
  const pad=value=>String(value).padStart(2,"0");
  return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function dateFolderForSubmission(date=new Date()){
  const pad=value=>String(value).padStart(2,"0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function canvasToBase64Png(canvas){
  const dataUrl=canvas.toDataURL("image/png");
  return dataUrl.slice(dataUrl.indexOf(",")+1);
}

function buildPixelSubmission(){
  const asset=pixelEditorAsset;
  if(!asset?.editCanvas){
    throw new Error("Choose a sprite before submitting.");
  }

  readPixelPropertiesFromUi();

  const now=new Date();
  const name=(pixelSubmitName?.value || asset.label || asset.id).trim();
  if(!name){
    throw new Error("Asset Name is required.");
  }

  const slug=sanitizeSubmissionSlug(name);
  const submissionId=`${timestampForSubmission(now)}-${slug}`;
  const folder=`pixel-inbox/${dateFolderForSubmission(now)}/${submissionId}`;

  const manifest={
    schemaVersion:1,
    submissionId,
    name,
    category:pixelSubmitCategory?.value || "units",
    submissionType:pixelSubmitType?.value || "new",
    sourceAssetId:asset.id,
    sourceAssetLabel:asset.label,
    width:asset.editCanvas.width,
    height:asset.editCanvas.height,
    spriteSpec:{
      sourceWidth:asset.spec?.sourceWidth ?? null,
      sourceHeight:asset.spec?.sourceHeight ?? null,
      workspaceWidth:asset.spec?.workspaceWidth ?? asset.editCanvas.width,
      workspaceHeight:asset.spec?.workspaceHeight ?? asset.editCanvas.height,
      renderWidth:asset.spec?.renderWidth ?? null,
      renderHeight:asset.spec?.renderHeight ?? null,
      anchorX:asset.spec?.anchorX ?? null,
      anchorY:asset.spec?.anchorY ?? null,
      scaleMode:asset.spec?.scaleMode || "fit",
      lockAspect:asset.spec?.lockAspect!==false,
      nativeFacing:asset.spec?.nativeFacing || "right"
    },
    format:"png",
    submittedAt:now.toISOString(),
    source:"Adventure Party Pixel Studio",
    notes:(pixelSubmitNotes?.value || "").trim(),
    files:{
      sprite:`${folder}/sprite.png`,
      manifest:`${folder}/manifest.json`
    }
  };

  return {
    submissionId,
    folder,
    spritePngBase64:canvasToBase64Png(asset.editCanvas),
    manifest,
    latest:{
      schemaVersion:1,
      submissionId,
      path:folder,
      submittedAt:manifest.submittedAt,
      name:manifest.name,
      category:manifest.category,
      submissionType:manifest.submissionType
    }
  };
}

function downloadTextFile(name,textValue,mimeType="application/json"){
  const blob=new Blob([textValue],{type:mimeType});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function downloadDataUrl(name,dataUrl){
  const a=document.createElement("a");
  a.href=dataUrl;
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadPixelSubmissionPackage(){
  try{
    const submission=buildPixelSubmission();
    downloadDataUrl(`${submission.submissionId}.png`,pixelEditorAsset.editCanvas.toDataURL("image/png"));
    setTimeout(()=>{
      downloadTextFile(
        `${submission.submissionId}.manifest.json`,
        JSON.stringify(submission.manifest,null,2)
      );
    },120);
    setPixelSubmitResult(`Downloaded PNG + manifest for ${submission.submissionId}.`,"success");
  }catch(error){
    setPixelSubmitResult(error?.message || "Unable to package submission.","error");
  }
}

async function submitPixelAssetToRepository(){
  let submission;
  try{
    submission=buildPixelSubmission();
  }catch(error){
    setPixelSubmitResult(error?.message || "Unable to build submission.","error");
    return;
  }

  const endpoint=(pixelSubmitEndpoint?.value || "").trim();
  if(!endpoint){
    setPixelSubmitResult("No upload endpoint configured. Use Download Submission Package, or paste your secure endpoint URL.","error");
    return;
  }

  localStorage.setItem(PIXEL_SUBMIT_ENDPOINT_STORAGE_KEY,endpoint);
  setPixelSubmitResult(`Uploading ${submission.submissionId}…`,"pending");
  pixelSubmitButton.disabled=true;

  try{
    const uploadKey=(pixelSubmitKey?.value || "").trim();
    if(uploadKey){
      localStorage.setItem(PIXEL_SUBMIT_KEY_STORAGE_KEY,uploadKey);
    }

    const headers={"Content-Type":"application/json"};
    if(uploadKey){
      headers["X-Upload-Key"]=uploadKey;
    }

    const response=await fetch(endpoint,{
      method:"POST",
      headers,
      body:JSON.stringify(submission)
    });

    let result={};
    try{
      result=await response.json();
    }catch(_error){
      result={};
    }

    if(!response.ok){
      throw new Error(result.error || `Upload failed (${response.status}).`);
    }

    const path=result.path || submission.folder;
    setPixelSubmitResult(`Submitted successfully: ${path}`,"success");
    pixelStatus.textContent=`${submission.manifest.name}: sent to repository as ${submission.submissionId}.`;
  }catch(error){
    setPixelSubmitResult(
      `${error?.message || "Upload failed."} Your sprite remains open in Pixel Studio.`,
      "error"
    );
  }finally{
    pixelSubmitButton.disabled=false;
  }
}

function initializePixelRepositorySubmission(){
  if(pixelSubmitEndpoint){
    pixelSubmitEndpoint.value=localStorage.getItem(PIXEL_SUBMIT_ENDPOINT_STORAGE_KEY) || "";
    pixelSubmitEndpoint.addEventListener("change",()=>{
      localStorage.setItem(PIXEL_SUBMIT_ENDPOINT_STORAGE_KEY,pixelSubmitEndpoint.value.trim());
    });
  }
  if(pixelSubmitKey){
    pixelSubmitKey.value=localStorage.getItem(PIXEL_SUBMIT_KEY_STORAGE_KEY) || "";
    pixelSubmitKey.addEventListener("change",()=>{
      localStorage.setItem(PIXEL_SUBMIT_KEY_STORAGE_KEY,pixelSubmitKey.value.trim());
    });
  }
  pixelSubmitName?.addEventListener("input",()=>{
    pixelSubmitName.dataset.userEdited="true";
  });
  pixelSubmitButton?.addEventListener("click",submitPixelAssetToRepository);
  pixelDownloadSubmissionButton?.addEventListener("click",downloadPixelSubmissionPackage);
}

initializePixelRepositorySubmission();

pixelPencilButton.addEventListener("click",()=>{
  setPixelEditorTool("pencil");
});

pixelEraserButton.addEventListener("click",()=>{
  setPixelEditorTool("eraser");
});

pixelZoom.addEventListener("change",()=>{
  pixelEditorZoom=Number(pixelZoom.value) || 8;
  renderPixelEditor();
});

pixelSourceScale?.addEventListener("input",()=>{
  if(pixelSourceScaleValue){
    pixelSourceScaleValue.textContent=`${pixelSourceScale.value}%`;
  }
});

pixelSourceScale?.addEventListener("change",()=>{
  rescalePixelEditorAsset(pixelSourceScale.value);
});

pixelFitScaleButton?.addEventListener("click",fitPixelEditorAssetToGrid);
pixelOriginalScaleButton?.addEventListener("click",setPixelEditorAssetOriginalScale);

pixelScaleMode?.addEventListener("change",applyPixelScaleMode);
pixelLockAspect?.addEventListener("change",()=>readPixelPropertiesFromUi());
pixelRenderWidth?.addEventListener("change",()=>readPixelPropertiesFromUi({renderChanged:"width"}));
pixelRenderHeight?.addEventListener("change",()=>readPixelPropertiesFromUi({renderChanged:"height"}));
pixelAnchorX?.addEventListener("change",()=>readPixelPropertiesFromUi());
pixelAnchorY?.addEventListener("change",()=>readPixelPropertiesFromUi());
pixelResizeWorkspaceButton?.addEventListener("click",resizePixelEditorWorkspace);

pixelGridToggle.addEventListener("change",()=>{
  renderPixelEditor();
});

pixelCanvas.addEventListener("pointerdown",(event)=>{
  event.preventDefault();
  pixelEditorPainting=true;
  pixelCanvas.setPointerCapture(event.pointerId);
  editPixelAtEvent(event);
});

pixelCanvas.addEventListener("pointermove",(event)=>{
  if(!pixelEditorPainting) return;
  editPixelAtEvent(event);
});

pixelCanvas.addEventListener("pointerup",(event)=>{
  pixelEditorPainting=false;
  if(pixelCanvas.hasPointerCapture(event.pointerId)){
    pixelCanvas.releasePointerCapture(event.pointerId);
  }
});

pixelCanvas.addEventListener("pointercancel",()=>{
  pixelEditorPainting=false;
});

document.getElementById("pixelApplyButton")
  .addEventListener("click",applyPixelEditorAsset);

pixelSaveButton?.addEventListener("click",savePixelEditorAsset);

document.getElementById("pixelResetButton")
  .addEventListener("click",resetPixelEditorAsset);

document.getElementById("pixelReturnButton")
  .addEventListener("click",showLauncher);



/* R72 temporary finite tactical battlefield.
   ------------------------------------------
   Current combat test: 40 × 20 axial-parallelogram map centered
   around Carl's existing origin. */
const HEX_W=64;
const HEX_H=42;
const HEX_ROW=31.5;
const VIEW_RADIUS=20;

const MAP_WIDTH_HEXES=40;
const MAP_HEIGHT_HEXES=20;
const MAP_MIN_X=-20;
const MAP_MAX_X=MAP_MIN_X+MAP_WIDTH_HEXES-1;
const MAP_MIN_Y=-10;
const MAP_MAX_Y=MAP_MIN_Y+MAP_HEIGHT_HEXES-1;

const HEX_DIRS=[
  {x: 1,y: 0,name:"E"},
  {x: 1,y:-1,name:"NE"},
  {x: 0,y:-1,name:"NW"},
  {x:-1,y: 0,name:"W"},
  {x:-1,y: 1,name:"SW"},
  {x: 0,y: 1,name:"SE"}
];

/*
  R186 — MULTI-HEX UNIT FOOTPRINTS
  --------------------------------
  A creature remains one combat entity (one initiative slot, HP pool, AI state,
  status list, and XP award) while occupying one or more tactical hexes.

  Offsets are axial coordinates relative to the entity's pivot hex. The helper
  layer supports rotation for future elongated creatures; the first live test
  footprint is the symmetric 7-hex cluster (center + all six neighbors).
*/
const UNIT_FOOTPRINTS=Object.freeze({
  single:Object.freeze({
    id:"single",
    rotates:false,
    offsets:Object.freeze([{x:0,y:0}])
  }),
  hex7:Object.freeze({
    id:"hex7",
    rotates:false,
    offsets:Object.freeze([
      {x:0,y:0},
      {x:1,y:0},
      {x:1,y:-1},
      {x:0,y:-1},
      {x:-1,y:0},
      {x:-1,y:1},
      {x:0,y:1}
    ])
  })
});

function unitFootprintDefinition(unit){
  return UNIT_FOOTPRINTS[unit?.footprintId] || UNIT_FOOTPRINTS.single;
}

function rotateAxialOffset(offset,steps=0){
  let x=Number(offset?.x)||0;
  let z=Number(offset?.y)||0;
  let y=-x-z;
  const count=((Math.round(steps)%6)+6)%6;

  for(let i=0;i<count;i++){
    const nextX=-z;
    const nextY=-x;
    const nextZ=-y;
    x=nextX;
    y=nextY;
    z=nextZ;
  }

  return {x,y:z};
}

function footprintOffsetsForFacing(unit,facingHex=facingDirectionIndex(unit)){
  const footprint=unitFootprintDefinition(unit);
  if(!footprint.rotates){
    return footprint.offsets.map(offset=>({...offset}));
  }

  return footprint.offsets.map(offset=>
    rotateAxialOffset(offset,facingHex)
  );
}

function occupiedHexesAt(
  unit,
  x=unit?.x,
  y=unit?.y,
  facingHex=facingDirectionIndex(unit)
){
  if(!Number.isFinite(x) || !Number.isFinite(y)) return [];

  return footprintOffsetsForFacing(unit,facingHex).map(offset=>({
    x:x+offset.x,
    y:y+offset.y
  }));
}

function occupiedHexes(unit){
  return occupiedHexesAt(unit);
}

function unitOccupiesHex(unit,x,y){
  return !!unit && occupiedHexes(unit).some(cell=>
    cell.x===x && cell.y===y
  );
}

function unitFootprintCellCount(unit){
  return unitFootprintDefinition(unit).offsets.length;
}

function unitDistance(a,b){
  if(!a || !b) return Infinity;
  const aCells=occupiedHexesAt(a,a.x,a.y);
  const bCells=occupiedHexesAt(b,b.x,b.y);
  let best=Infinity;

  for(const ac of aCells){
    for(const bc of bCells){
      best=Math.min(best,hexDistance(ac,bc));
    }
  }

  return best;
}

function unitDistanceAt(unit,x,y,target){
  if(!unit || !target) return Infinity;
  const sourceCells=occupiedHexesAt(unit,x,y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);
  let best=Infinity;

  for(const source of sourceCells){
    for(const destination of targetCells){
      best=Math.min(best,hexDistance(source,destination));
    }
  }

  return best;
}

function unitDepthSortPoint(unit){
  const centers=occupiedHexes(unit).map(cell=>hexCenter(cell.x,cell.y));
  if(!centers.length) return hexCenter(unit?.x||0,unit?.y||0);

  return {
    x:centers.reduce((sum,point)=>sum+point.x,0)/centers.length,
    y:Math.max(...centers.map(point=>point.y))
  };
}

function unitFootprintScreenCenter(unit){
  const centers=occupiedHexes(unit).map(cell=>hexCenter(cell.x,cell.y));
  if(!centers.length) return hexCenter(unit?.x||0,unit?.y||0);

  return {
    x:centers.reduce((sum,point)=>sum+point.x,0)/centers.length,
    y:centers.reduce((sum,point)=>sum+point.y,0)/centers.length
  };
}

function canUnitStandAt(unit,x,y,facingHex=facingDirectionIndex(unit)){
  if(!unit) return false;

  for(const cell of occupiedHexesAt(unit,x,y,facingHex)){
    if(!inside(cell.x,cell.y) || isWall(cell.x,cell.y)){
      return false;
    }

    if(occupiedByAnyUnit(cell.x,cell.y,unit.id)){
      return false;
    }
  }

  return true;
}

function unitTransitionBlocked(
  unit,
  from,
  to,
  facingHex=facingDirectionIndex(unit)
){
  if(!unit || !from || !to) return true;
  if(!canUnitStandAt(unit,to.x,to.y,facingHex)) return true;

  const sourceCells=occupiedHexesAt(unit,from.x,from.y,facingHex);
  const targetCells=occupiedHexesAt(unit,to.x,to.y,facingHex);

  for(let i=0;i<Math.min(sourceCells.length,targetCells.length);i++){
    if(architecturalWallBlocksStep(sourceCells[i],targetCells[i])){
      return true;
    }
  }

  return false;
}

const ATTACK_SECTOR_LABELS=[
  "FRONT",
  "FRONT-LEFT",
  "REAR-LEFT",
  "REAR",
  "REAR-RIGHT",
  "FRONT-RIGHT"
];

function facingDirectionIndex(entity){
  if(Number.isInteger(entity?.facingHex)){
    return ((entity.facingHex%6)+6)%6;
  }

  return entity?.facing==="left" ? 3 : 0;
}

function hexDirectionIndexToward(from,to){
  if(!from || !to) return 0;

  const dx=to.x-from.x;
  const dy=to.y-from.y;

  const exact=HEX_DIRS.findIndex(dir=>
    dir.x===dx &&
    dir.y===dy
  );

  if(exact>=0){
    return exact;
  }

  let bestIndex=0;
  let bestDistance=Infinity;

  HEX_DIRS.forEach((dir,index)=>{
    const candidate={
      x:from.x+dir.x,
      y:from.y+dir.y
    };

    const distance=hexDistance(candidate,to);

    if(distance<bestDistance){
      bestDistance=distance;
      bestIndex=index;
    }
  });

  return bestIndex;
}

function attackPositionData(attacker,defender){
  if(!attacker || !defender){
    return {
      label:"FRONT",
      relativeIndex:0,
      directRear:false,
      rearFlank:false,
      shieldDenied:false,
      dexterityBonusDenied:false,
      rearAttackBonus:0,
      frontProtected:true
    };
  }

  const facing=facingDirectionIndex(defender);
  const attackDirection=
    hexDirectionIndexToward(defender,attacker);

  const relativeIndex=
    (attackDirection-facing+6)%6;

  const directRear=relativeIndex===3;
  const rearFlank=
    relativeIndex===2 ||
    relativeIndex===4;

  return {
    label:ATTACK_SECTOR_LABELS[relativeIndex],
    relativeIndex,
    facing,
    attackDirection,
    directRear,
    rearFlank,
    shieldDenied:directRear || rearFlank,
    dexterityBonusDenied:directRear,
    rearAttackBonus:directRear ? 2 : 0,
    frontProtected:
      relativeIndex===0 ||
      relativeIndex===1 ||
      relativeIndex===5
  };
}

function tacticalFacingLabel(entity){
  return HEX_DIRS[facingDirectionIndex(entity)]?.name || "E";
}

function faceEntityToward(entity,target){
  if(!entity || !target) return;

  updateFacingForStep(
    entity,
    target.x-entity.x,
    target.y-entity.y
  );
}


/* Hex-occupancy walls retained for compatibility with existing terrain code. */
const walls=new Set();

/* ============================================================
   R122 — Architectural Wall Prototype
   ------------------------------------------------------------
   Architectural walls are continuous line segments in a camera-independent
   projected world plane. They are NOT constrained to hex edges. Movement
   remains a six-neighbor axial graph; a hex-to-hex edge becomes impassable
   when the straight center-to-center transition crosses a wall segment.
   ============================================================ */
let architecturalWalls=[];

/*
  R123: architectural spaces define environment independently of the tactical
  hex grid. The wall-test room is an INDOOR polygon laid over the outdoor
  grass field, so its floor may cut through partial hex textures.
*/
let architecturalSpaces=[];

/*
  R129 LOS prototype: remember the most recently active player-controlled
  party member so visibility remains stable while enemy/NPC turns animate.
*/
let lastPlayerVisibilityObserverId=null;

/*
  R122: architectural walls can bisect a hex even when no center-to-center
  movement edge crosses them. Such "half-wall" hexes are not usable tactical
  spaces. Any solid wall that cuts through the interior core of a hex marks
  the entire hex non-passable.
*/
const architecturalBlockedHexes=new Set();
const ARCHITECTURAL_HEX_CORE_SCALE=0.90;

/*
  R135: Wall Test room expanded two tactical hexes in every direction while
  preserving the R124 center-anchored geometry. North/south-running wall
  endpoints still land on hex centers and the vertical wall axes still split
  the neighboring hex geometry symmetrically.

  The former east-side door/lintel is removed completely. The east wall is now
  continuous, and the west wall contains a plain open entrance between two
  center-anchored endpoints. There is no door object, threshold, or lintel.
*/
const WALL_TEST_ROOM_HEX_ANCHORS={
  northWest:{x:-1,y:-5},
  northEast:{x:6,y:-5},
  southWest:{x:-6,y:5},
  southEast:{x:1,y:5},
  entranceNorth:{x:-3,y:-1},
  entranceSouth:{x:-4,y:1}
};

function wallTestRoomGeometryFromHexCenters(){
  const h=WALL_TEST_ROOM_HEX_ANCHORS;
  const nw=worldPointForHex(h.northWest.x,h.northWest.y);
  const ne=worldPointForHex(h.northEast.x,h.northEast.y);
  const sw=worldPointForHex(h.southWest.x,h.southWest.y);
  const se=worldPointForHex(h.southEast.x,h.southEast.y);
  const en=worldPointForHex(h.entranceNorth.x,h.entranceNorth.y);
  const es=worldPointForHex(h.entranceSouth.x,h.entranceSouth.y);

  return {
    left:nw.x,
    right:ne.x,
    top:nw.y,
    bottom:sw.y,
    entranceTop:en.y,
    entranceBottom:es.y,
    cornerWorld:{nw,ne,sw,se},
    entranceWorld:{north:en,south:es}
  };
}

const WALL_TEST_ROOM=wallTestRoomGeometryFromHexCenters();

function wallTestIndoorPolygon(){
  const r=WALL_TEST_ROOM;
  return [
    {x:r.left,y:r.top},
    {x:r.right,y:r.top},
    {x:r.right,y:r.bottom},
    {x:r.left,y:r.bottom}
  ];
}

function configureArchitecturalSpaces(mode){
  architecturalSpaces=[];
  if(mode!=="wall") return;

  architecturalSpaces=[{
    id:"wall-test-room",
    environment:"indoor",
    floorColor:"#66686d",
    polygon:wallTestIndoorPolygon()
  }];
}

function architecturalSpaceAtWorldPoint(point){
  if(!point) return null;

  for(let i=architecturalSpaces.length-1;i>=0;i--){
    const space=architecturalSpaces[i];
    if(space?.polygon?.length>=3 && pointInConvexPolygon(point,space.polygon)){
      return space;
    }
  }

  return null;
}

function environmentAtWorldPoint(point){
  return architecturalSpaceAtWorldPoint(point)?.environment || "outdoor";
}

function isIndoorWorldPoint(point){
  return environmentAtWorldPoint(point)==="indoor";
}

function worldPointForHex(x,y){
  return {
    x:x*HEX_W+y*(HEX_W/2),
    y:y*HEX_ROW
  };
}

function screenPointForWorld(point,elevation=0){
  const cameraWorld=worldPointForHex(camera.x,camera.y);
  return {
    x:(canvas.width*0.47)+(point.x-cameraWorld.x),
    y:(canvas.height*0.57)+(point.y-cameraWorld.y)-elevation
  };
}

function configureArchitecturalWalls(mode){
  architecturalWalls=[];
  architecturalBlockedHexes.clear();
  configureArchitecturalSpaces(mode);
  if(mode!=="wall") return;

  const r=WALL_TEST_ROOM;
  const common={
    height:35,
    thickness:9,
    material:"old-wood",
    blocksMovement:true,
    blocksLOS:true,
    blocksVolume:true
  };

  architecturalWalls=[
    {
      ...common,
      id:"north",
      a:{x:r.left,y:r.top},
      b:{x:r.right,y:r.top},
      openings:[
        {
          id:"north-window",
          type:"window",
          facing:"north",
          centerHex:{x:3,y:-5},
          glassWidthWorld:36,
          visualWidthScale:1.50
        }
      ]
    },
    {
      ...common,
      id:"south",
      a:{x:r.left,y:r.bottom},
      b:{x:r.right,y:r.bottom},
      openings:[
        {
          id:"south-doorway",
          type:"doorway",
          facing:"south",
          centerHex:{x:-3,y:5},
          widthWorld:HEX_W
        },
        {
          id:"south-window",
          type:"window",
          facing:"south",
          centerHex:{x:-2,y:5},
          glassWidthWorld:36,
          visualWidthScale:1.50
        }
      ]
    },
    {
      ...common,
      id:"west",
      a:{x:r.left,y:r.top},
      b:{x:r.left,y:r.bottom},
      openings:[
        {
          id:"west-doorway",
          type:"doorway",
          facing:"west",
          centerT:0.50,
          widthWorld:Math.max(
            1,
            Math.abs(r.entranceBottom-r.entranceTop)
          )
        }
      ]
    },
    {
      ...common,
      id:"east",
      a:{x:r.right,y:r.top},
      b:{x:r.right,y:r.bottom},
      openings:[
        {
          id:"east-window",
          type:"window",
          facing:"east",
          centerHex:{x:4,y:-1},
          glassWidthWorld:36,
          visualWidthScale:1.50
        }
      ]
    }
  ];

  rebuildArchitecturalBlockedHexes();
}

function cross2(a,b,c){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function pointOnSegment(a,b,p,eps=0.0001){
  return (
    Math.abs(cross2(a,b,p))<=eps &&
    p.x>=Math.min(a.x,b.x)-eps && p.x<=Math.max(a.x,b.x)+eps &&
    p.y>=Math.min(a.y,b.y)-eps && p.y<=Math.max(a.y,b.y)+eps
  );
}

function segmentsIntersect(a,b,c,d){
  const c1=cross2(a,b,c);
  const c2=cross2(a,b,d);
  const c3=cross2(c,d,a);
  const c4=cross2(c,d,b);
  const eps=0.0001;

  if(
    ((c1>eps && c2<-eps)||(c1<-eps && c2>eps)) &&
    ((c3>eps && c4<-eps)||(c3<-eps && c4>eps))
  ) return true;

  return (
    pointOnSegment(a,b,c,eps) || pointOnSegment(a,b,d,eps) ||
    pointOnSegment(c,d,a,eps) || pointOnSegment(c,d,b,eps)
  );
}

function pointInConvexPolygon(point,vertices,eps=0.0001){
  let sign=0;

  for(let i=0;i<vertices.length;i++){
    const a=vertices[i];
    const b=vertices[(i+1)%vertices.length];
    const value=cross2(a,b,point);

    if(Math.abs(value)<=eps) continue;
    const current=value>0 ? 1 : -1;
    if(sign===0) sign=current;
    else if(current!==sign) return false;
  }

  return true;
}

function architecturalHexCoreVertices(x,y){
  const c=worldPointForHex(x,y);
  const s=ARCHITECTURAL_HEX_CORE_SCALE;

  return [
    {x:c.x,               y:c.y-(HEX_H/2)*s},
    {x:c.x+(HEX_W/2)*s,   y:c.y-(HEX_H/4)*s},
    {x:c.x+(HEX_W/2)*s,   y:c.y+(HEX_H/4)*s},
    {x:c.x,               y:c.y+(HEX_H/2)*s},
    {x:c.x-(HEX_W/2)*s,   y:c.y+(HEX_H/4)*s},
    {x:c.x-(HEX_W/2)*s,   y:c.y-(HEX_H/4)*s}
  ];
}

function architecturalWallLength(wall){
  if(!wall?.a || !wall?.b) return 0;
  return Math.hypot(
    wall.b.x-wall.a.x,
    wall.b.y-wall.a.y
  );
}

function architecturalWallPointAt(wall,t){
  const q=Math.max(0,Math.min(1,Number(t)||0));
  return {
    x:wall.a.x+(wall.b.x-wall.a.x)*q,
    y:wall.a.y+(wall.b.y-wall.a.y)*q
  };
}

function wallOpeningCenterT(wall,opening){
  if(!wall || !opening) return 0.5;

  if(
    opening.centerHex &&
    Number.isFinite(opening.centerHex.x) &&
    Number.isFinite(opening.centerHex.y)
  ){
    const point=worldPointForHex(
      opening.centerHex.x,
      opening.centerHex.y
    );
    const dx=wall.b.x-wall.a.x;
    const dy=wall.b.y-wall.a.y;
    const len2=(dx*dx)+(dy*dy);

    if(len2>0.000001){
      return Math.max(
        0,
        Math.min(
          1,
          (
            ((point.x-wall.a.x)*dx)+
            ((point.y-wall.a.y)*dy)
          )/len2
        )
      );
    }
  }

  return Math.max(
    0,
    Math.min(1,Number(opening.centerT)||0.5)
  );
}

function wallOpeningPassesMode(opening,mode){
  if(!opening) return false;

  if(opening.type==="doorway"){
    return true;
  }

  if(opening.type==="window"){
    /*
      R201: glass transmits sight and light, but does not transmit projectiles.
      Movement and physical volumetric propagation remain blocked as before.
    */
    return mode==="los" || mode==="light";
  }

  return false;
}

function wallBlockingSubsegments(wall,mode="movement"){
  if(!wall) return [];

  const sightLike=
    mode==="los" ||
    mode==="light" ||
    mode==="projectile";

  const blocks=
    sightLike
      ? wall.blocksLOS
      : mode==="volume"
        ? wall.blocksVolume!==false
        : wall.blocksMovement;

  if(!blocks) return [];

  const length=architecturalWallLength(wall);
  if(length<=0.0001) return [];

  const passIntervals=(wall.openings || [])
    .filter(opening=>wallOpeningPassesMode(opening,mode))
    .map(opening=>{
      const passWidth=
        opening.type==="window"
          ? Math.max(
              1,
              Number(opening.glassWidthWorld) ||
              Number(opening.widthWorld) ||
              1
            )
          : Math.max(1,Number(opening.widthWorld)||1);

      const half=passWidth/(2*length);
      const center=wallOpeningCenterT(wall,opening);

      return {
        start:Math.max(0,center-half),
        end:Math.min(1,center+half)
      };
    })
    .sort((a,b)=>a.start-b.start);

  if(!passIntervals.length) return [wall];

  const merged=[];
  for(const interval of passIntervals){
    const last=merged[merged.length-1];
    if(last && interval.start<=last.end){
      last.end=Math.max(last.end,interval.end);
    }else{
      merged.push({...interval});
    }
  }

  const segments=[];
  let cursor=0;

  for(const interval of merged){
    if(interval.start>cursor+0.0001){
      segments.push({
        ...wall,
        id:`${wall.id}:block:${mode}:${segments.length}`,
        parentWallId:wall.id,
        openings:[],
        a:architecturalWallPointAt(wall,cursor),
        b:architecturalWallPointAt(wall,interval.start)
      });
    }
    cursor=Math.max(cursor,interval.end);
  }

  if(cursor<1-0.0001){
    segments.push({
      ...wall,
      id:`${wall.id}:block:${mode}:${segments.length}`,
      parentWallId:wall.id,
      openings:[],
      a:architecturalWallPointAt(wall,cursor),
      b:architecturalWallPointAt(wall,1)
    });
  }

  return segments;
}


function wallSegmentCutsHexInterior(wall,x,y){
  if(!wall?.blocksMovement) return false;

  const vertices=architecturalHexCoreVertices(x,y);

  if(
    pointInConvexPolygon(wall.a,vertices) ||
    pointInConvexPolygon(wall.b,vertices)
  ){
    return true;
  }

  for(let i=0;i<vertices.length;i++){
    if(
      segmentsIntersect(
        wall.a,
        wall.b,
        vertices[i],
        vertices[(i+1)%vertices.length]
      )
    ){
      return true;
    }
  }

  return false;
}

function rebuildArchitecturalBlockedHexes(){
  architecturalBlockedHexes.clear();
  if(!architecturalWalls.length) return;

  for(let x=MAP_MIN_X;x<=MAP_MAX_X;x++){
    for(let y=MAP_MIN_Y;y<=MAP_MAX_Y;y++){
      if(
        architecturalWalls.some(wall=>
          wallBlockingSubsegments(wall,"movement")
            .some(segment=>wallSegmentCutsHexInterior(segment,x,y))
        )
      ){
        architecturalBlockedHexes.add(key(x,y));
      }
    }
  }
}

function isArchitecturalBlockedHex(x,y){
  return architecturalBlockedHexes.has(key(x,y));
}

function architecturalWallBlocksWorldLine(a,b,mode="movement"){
  if(!architecturalWalls.length) return false;

  return architecturalWalls.some(wall=>
    wallBlockingSubsegments(wall,mode)
      .some(segment=>segmentsIntersect(a,b,segment.a,segment.b))
  );
}

function architecturalWallBlocksStep(from,to){
  if(!from || !to || !architecturalWalls.length) return false;

  /* R122: a wall-bisected destination hex is never a legal standing space. */
  if(isArchitecturalBlockedHex(to.x,to.y)) return true;

  return architecturalWallBlocksWorldLine(
    worldPointForHex(from.x,from.y),
    worldPointForHex(to.x,to.y),
    "movement"
  );
}

function architecturalWallBlocksLOS(source,target){
  if(!source || !target || !architecturalWalls.length) return false;
  return architecturalWallBlocksWorldLine(
    worldPointForHex(source.x,source.y),
    worldPointForHex(target.x,target.y),
    "los"
  );
}


function architecturalWallWorldVertices(wall){
  const thickness=Math.max(3,Number(wall?.thickness)||9);
  const half=thickness/2;
  const ax=Number(wall?.a?.x)||0;
  const ay=Number(wall?.a?.y)||0;
  const bx=Number(wall?.b?.x)||0;
  const by=Number(wall?.b?.y)||0;

  if(Math.abs(ax-bx)<0.0001){
    const minY=Math.min(ay,by);
    const maxY=Math.max(ay,by);
    return [
      {x:ax-half,y:minY},
      {x:ax+half,y:minY},
      {x:ax+half,y:maxY},
      {x:ax-half,y:maxY}
    ];
  }

  if(Math.abs(ay-by)<0.0001){
    const minX=Math.min(ax,bx);
    const maxX=Math.max(ax,bx);
    return [
      {x:minX,y:ay-half},
      {x:maxX,y:ay-half},
      {x:maxX,y:ay+half},
      {x:minX,y:ay+half}
    ];
  }

  const dx=bx-ax;
  const dy=by-ay;
  const len=Math.hypot(dx,dy)||1;
  const nx=(-dy/len)*half;
  const ny=(dx/len)*half;

  return [
    {x:ax+nx,y:ay+ny},
    {x:bx+nx,y:by+ny},
    {x:bx-nx,y:by-ny},
    {x:ax-nx,y:ay-ny}
  ];
}

function wallPolygonSegments(vertices){
  const segments=[];
  for(let i=0;i<vertices.length;i++){
    segments.push({
      a:vertices[i],
      b:vertices[(i+1)%vertices.length]
    });
  }
  return segments;
}

function canMeleeReach(a,b){
  if(!a || !b) return false;

  const aCells=occupiedHexesAt(a,a.x,a.y);
  const bCells=occupiedHexesAt(b,b.x,b.y);

  return aCells.some(ac=>
    bCells.some(bc=>
      hexDistance(ac,bc)===1 &&
      !architecturalWallBlocksStep(ac,bc)
    )
  );
}

function canMeleeAttackTarget(attacker,target){
  if(!attacker || !target) return false;
  const reach=Math.max(1,Number(attacker.meleeRange)||1);

  if(reach===1){
    return canMeleeReach(attacker,target);
  }

  return unitDistance(attacker,target)<=reach;
}

function approachDistanceAt(unit,x,y,target){
  if(!unit || !target) return Infinity;
  const proxy={...unit,x,y};

  if(canMeleeAttackTarget(proxy,target)){
    return 0;
  }

  return unitDistance(proxy,target);
}

function stoneFloorPatternForCurrentView(){
  if(
    !stoneFloorTexture.complete ||
    !stoneFloorTexture.naturalWidth ||
    !stoneFloorTexture.naturalHeight
  ){
    return null;
  }

  const pattern=ctx.createPattern(stoneFloorTexture,"repeat");
  if(!pattern) return null;

  /*
    R205:
      - halve the R204 texture size: 35% -> 17.5%
      - project the square source into the same axial/isometric plane used by
        worldPointForHex(): q=(HEX_W,0), r=(HEX_W/2,HEX_ROW)
      - anchor the pattern to world origin so camera motion cannot make it swim.

    For a 512 px source this produces an approximately 89.6 px by 44.1 px
    isometric repeat instead of the former ~179 px square repeat.
  */
  if(
    typeof pattern.setTransform==="function" &&
    typeof DOMMatrix!=="undefined"
  ){
    const origin=screenPointForWorld({x:0,y:0});
    const scale=0.175;
    const isoY=HEX_ROW/HEX_W;

    pattern.setTransform(
      new DOMMatrix([
        scale,
        0,
        scale*0.5,
        scale*isoY,
        Math.round(origin.x),
        Math.round(origin.y)
      ])
    );
  }

  return pattern;
}

function drawArchitecturalFloorRegions(){
  if(!architecturalSpaces.length) return;

  for(const space of architecturalSpaces){
    if(space.environment!=="indoor" || !space.polygon?.length) continue;

    const points=space.polygon.map(point=>screenPointForWorld(point));
    if(points.length<3) continue;

    ctx.save();

    if(!tracePolygonOnContext(ctx,points)){
      ctx.restore();
      continue;
    }

    /*
      R204: indoor floors use PamNawi's CC BY 4.0 handpainted stone texture.
      The texture is continuous across tactical hexes; hex geometry is an
      overlay and does not define the material seams.
    */
    const floorPattern=stoneFloorPatternForCurrentView();
    ctx.fillStyle=
      floorPattern ||
      space.floorColor ||
      "#66686d";
    ctx.fill();

    /*
      A light neutral veil keeps the source artwork readable under tactical
      highlights and differentiates the indoor material from outdoor grass.
    */
    ctx.clip();
    ctx.globalAlpha=0.10;
    ctx.fillStyle="#9a9ca2";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.restore();
  }
}

function doorwayThresholdWorldPolygon(wall,opening){
  if(!wall || !opening || opening.type!=="doorway") return [];

  const center=architecturalWallPointAt(
    wall,
    wallOpeningCenterT(wall,opening)
  );
  const dx=wall.b.x-wall.a.x;
  const dy=wall.b.y-wall.a.y;
  const len=Math.hypot(dx,dy)||1;
  const tx=dx/len;
  const ty=dy/len;
  const nx=-ty;
  const ny=tx;

  const openingWidth=Math.max(
    1,
    Number(opening.widthWorld)||HEX_W
  );
  const halfWidth=openingWidth/2;

  /*
    R206: threshold depth is exactly the wall thickness, centered on the wall
    axis. Horizontal and vertical doorways use the same tangent/normal geometry.
  */
  const halfDepth=Math.max(3,Number(wall.thickness)||9)/2;

  return [
    {
      x:center.x-(tx*halfWidth)-(nx*halfDepth),
      y:center.y-(ty*halfWidth)-(ny*halfDepth)
    },
    {
      x:center.x+(tx*halfWidth)-(nx*halfDepth),
      y:center.y+(ty*halfWidth)-(ny*halfDepth)
    },
    {
      x:center.x+(tx*halfWidth)+(nx*halfDepth),
      y:center.y+(ty*halfWidth)+(ny*halfDepth)
    },
    {
      x:center.x-(tx*halfWidth)+(nx*halfDepth),
      y:center.y-(ty*halfWidth)+(ny*halfDepth)
    }
  ];
}

function drawDoorwayThresholds(){
  if(game?.condition!=="wall") return;

  ctx.save();
  ctx.lineJoin="miter";

  for(const wall of architecturalWalls){
    for(const opening of wall.openings || []){
      if(opening.type!=="doorway") continue;

      const worldPolygon=
        doorwayThresholdWorldPolygon(wall,opening);
      if(worldPolygon.length<3) continue;

      const screenPolygon=worldPolygon.map(point=>
        screenPointForWorld(point)
      );

      if(!tracePolygonOnContext(ctx,screenPolygon)) continue;

      /*
        Fill only: an outside stroke would make the threshold wider than the
        wall slab it is meant to match.
      */
      ctx.fillStyle="#414348";
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawWallTestFloorPlan(){
  /*
    R205: doorway gaps get a dark-grey threshold across the complete wall
    depth. This is presentation-only: movement/LOS/projectile opening mechanics
    remain defined by the authored doorway gap itself.
  */
  drawDoorwayThresholds();
}

const ARCHITECTURAL_WALL_SHADOW={
  /* Fixed test sun: light arrives from upper-left, casting down/right. */
  xPerHeight:0.58,
  yPerHeight:0.34,
  fill:"rgba(8,10,14,0.34)",
  farEdge:"rgba(8,10,14,0.20)"
};

function drawArchitecturalWallShadows(){
  if(!architecturalWalls.length) return;

  ctx.save();
  ctx.lineJoin="miter";
  ctx.lineCap="square";

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(blocker.a);
      const b=screenPointForWorld(blocker.b);
      const height=Math.max(1,Number(wall.height)||35);
      const sx=height*ARCHITECTURAL_WALL_SHADOW.xPerHeight;
      const sy=height*ARCHITECTURAL_WALL_SHADOW.yPerHeight;

      ctx.fillStyle=ARCHITECTURAL_WALL_SHADOW.fill;
      ctx.beginPath();
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(b.x,b.y);
      ctx.lineTo(b.x+sx,b.y+sy);
      ctx.lineTo(a.x+sx,a.y+sy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle=ARCHITECTURAL_WALL_SHADOW.farEdge;
      ctx.lineWidth=Math.max(2,(wall.thickness||9)*0.65);
      ctx.beginPath();
      ctx.moveTo(a.x+sx,a.y+sy);
      ctx.lineTo(b.x+sx,b.y+sy);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function closestPointOnWorldSegment(point,a,b){
  const dx=b.x-a.x;
  const dy=b.y-a.y;
  const len2=dx*dx+dy*dy;

  if(len2<=0.000001){
    return {x:a.x,y:a.y,t:0};
  }

  const t=Math.max(
    0,
    Math.min(
      1,
      ((point.x-a.x)*dx+(point.y-a.y)*dy)/len2
    )
  );

  return {
    x:a.x+dx*t,
    y:a.y+dy*t,
    t
  };
}

/*
  R196 wall-face illumination.

  The wall is treated as a two-sided vertical surface. A light source only
  contributes when it lies close enough to the wall, has a meaningful component
  toward the wall normal (rather than running nearly parallel to it), and no
  other architectural wall blocks the source-to-face path.

  Rendering still uses the robust thick-stroke wall slab so north/south wall
  segments cannot collapse in projection. This helper supplies a per-source
  intensity used by the wall-face glow pass.
*/
function architecturalVisibleWallFaceSide(wall){
  if(!wall) return 0;

  const dx=wall.b.x-wall.a.x;
  const dy=wall.b.y-wall.a.y;
  const len=Math.hypot(dx,dy)||1;

  /*
    The current projection shows the broad vertical face of horizontal walls.
    That visible face is the +screen-Y / +world-Y side. East/west walls are
    effectively edge-on, so they do not receive broad face illumination.
  */
  if(Math.abs(dx)<Math.abs(dy)){
    return 0;
  }

  const normalY=dx/len;
  return normalY>=0 ? 1 : -1;
}

function architecturalWallLightContributions(wall){
  if(!wall || !game) return [];

  const dx=wall.b.x-wall.a.x;
  const dy=wall.b.y-wall.a.y;
  const len=Math.hypot(dx,dy)||1;
  const normalX=-dy/len;
  const normalY=dx/len;
  const contributions=[];

  for(const source of illuminationSources()){
    const sourceWorld=worldPointForHex(source.x,source.y);
    const nearest=closestPointOnWorldSegment(
      sourceWorld,
      wall.a,
      wall.b
    );

    const vx=sourceWorld.x-nearest.x;
    const vy=sourceWorld.y-nearest.y;
    const distance=Math.hypot(vx,vy);
    const radiusWorld=
      (Math.max(1,Number(source.radiusHexes)||1)+0.45)*HEX_W;

    if(distance>radiusWorld) continue;

    const invDistance=distance>0.0001 ? 1/distance : 0;
    const towardX=distance>0.0001 ? vx*invDistance : normalX;
    const towardY=distance>0.0001 ? vy*invDistance : normalY;

    /*
      R200: retain the angular falloff, but also keep the SIGN of the wall
      normal. The sign identifies the physical half of the wall slab facing
      the light source. Rendering uses that value so one source can never
      brighten the opposite face of the same wall.
    */
    const signedFaceAlignment=
      normalX*towardX+
      normalY*towardY;
    const faceAlignment=Math.abs(signedFaceAlignment);

    if(faceAlignment<0.15) continue;

    if(
      worldLineBlockedByOtherArchitecturalWalls(
        sourceWorld,
        nearest,
        wall.id
      )
    ){
      continue;
    }

    const normalized=Math.max(
      0,
      Math.min(1,distance/radiusWorld)
    );
    const falloff=1-(normalized*normalized);
    const intensity=Math.max(
      0,
      Number(source.intensity)||0
    )*falloff*Math.pow(faceAlignment,0.72);

    if(intensity<=0.01) continue;

    contributions.push({
      source,
      intensity,
      faceAlignment,
      faceSide:signedFaceAlignment>=0 ? 1 : -1,
      wallNormal:{x:normalX,y:normalY},
      nearest
    });
  }

  return contributions;
}


/*
  R200 old-wood wall material and window-plane preparation.

  The supplied window art treats pure white as glass. The complete rectangular
  wall aperture is carved separately at render time, then the processed frame
  and translucent glass are placed on the wall's center plane.
*/
let oldWoodWallPatternTileCache=null;
const wallOpeningAssetCache=new Map();

function oldWoodWallPatternTile(height=35){
  if(
    !oldWoodWallTexture.complete ||
    !oldWoodWallTexture.naturalWidth ||
    !oldWoodWallTexture.naturalHeight
  ){
    return null;
  }

  const targetHeight=Math.max(8,Math.round(height));
  const targetWidth=Math.max(
    8,
    Math.round(
      targetHeight*
      oldWoodWallTexture.naturalWidth/
      oldWoodWallTexture.naturalHeight
    )
  );

  if(
    oldWoodWallPatternTileCache?.width===targetWidth &&
    oldWoodWallPatternTileCache?.height===targetHeight
  ){
    return oldWoodWallPatternTileCache;
  }

  const tile=document.createElement("canvas");
  tile.width=targetWidth;
  tile.height=targetHeight;
  const tctx=tile.getContext("2d");
  tctx.imageSmoothingEnabled=false;
  tctx.drawImage(
    oldWoodWallTexture,
    0,0,
    targetWidth,targetHeight
  );

  oldWoodWallPatternTileCache=tile;
  return tile;
}

function oldWoodWallPatternForWall(targetCtx,wall,height=35,thickness=9){
  /*
    R200: the visible slab is taller than the nominal wall height because the
    wall has physical thickness. Scale the full supplied wood sprite to that
    complete visible height, then align source row zero with the top edge of
    the wall instead of letting the repeating pattern start at canvas Y=0.
  */
  const visualHeight=Math.max(
    8,
    Math.round(
      Math.max(1,Number(height)||35)+
      Math.max(1,Number(thickness)||9)
    )
  );
  const tile=oldWoodWallPatternTile(visualHeight);
  if(!tile) return null;

  const pattern=targetCtx.createPattern(tile,"repeat");
  if(!pattern) return null;

  if(
    typeof pattern.setTransform==="function" &&
    typeof DOMMatrix!=="undefined"
  ){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    const topY=
      Math.min(a.y,b.y)-
      Math.max(1,Number(height)||35)-
      (Math.max(1,Number(thickness)||9)/2);
    const startX=
      Math.min(a.x,b.x)-
      (Math.max(1,Number(thickness)||9)/2);

    pattern.setTransform(
      new DOMMatrix().translate(
        Math.round(startX),
        Math.round(topY)
      )
    );
  }

  return pattern;
}

function processedWallOpeningAsset(type){
  const image=
    type==="window"
      ? oldWoodWindowImage
      : null;

  if(
    !image?.complete ||
    !image.naturalWidth ||
    !image.naturalHeight
  ){
    return null;
  }

  const cacheKey=`${type}:${image.naturalWidth}x${image.naturalHeight}`;
  if(wallOpeningAssetCache.has(cacheKey)){
    return wallOpeningAssetCache.get(cacheKey);
  }

  const source=document.createElement("canvas");
  source.width=image.naturalWidth;
  source.height=image.naturalHeight;
  const sctx=source.getContext("2d",{willReadFrequently:true});
  sctx.imageSmoothingEnabled=false;
  sctx.drawImage(image,0,0);

  const imageData=sctx.getImageData(0,0,source.width,source.height);
  const displayData=new ImageData(
    new Uint8ClampedArray(imageData.data),
    source.width,
    source.height
  );

  for(let i=0;i<imageData.data.length;i+=4){
    const r=imageData.data[i];
    const g=imageData.data[i+1];
    const b=imageData.data[i+2];
    const a=imageData.data[i+3];
    const white=a>0 && r>=250 && g>=250 && b>=250;

    if(white){
      /* White source pixels become translucent pale glass. */
      displayData.data[i]=238;
      displayData.data[i+1]=248;
      displayData.data[i+2]=252;
      displayData.data[i+3]=64;
    }else{
      /* Preserve the authored frame AND any source transparency. */
      displayData.data[i+3]=a;
    }
  }

  const display=document.createElement("canvas");
  display.width=source.width;
  display.height=source.height;
  display.getContext("2d").putImageData(displayData,0,0);

  const result={
    display,
    width:source.width,
    height:source.height
  };

  wallOpeningAssetCache.set(cacheKey,result);
  return result;
}

function wallOpeningScreenMetrics(wall,opening){
  if(!wall || !opening || opening.type!=="window") return null;

  const wallDx=Math.abs(wall.b.x-wall.a.x);
  const wallDy=Math.abs(wall.b.y-wall.a.y);
  if(wallDx<=wallDy*0.05) return null;

  const height=Math.max(1,Math.round(wall.height || 35));
  const base=screenPointForWorld(
    architecturalWallPointAt(
      wall,
      wallOpeningCenterT(wall,opening)
    )
  );

  const asset=processedWallOpeningAsset("window");
  const sourceRatio=asset
    ? asset.width/asset.height
    : 73/85;
  const renderHeight=Math.max(12,Math.round(height*0.64));
  const widthScale=Math.max(0.1,Number(opening.visualWidthScale)||1);
  const renderWidth=Math.max(
    10,
    Math.round(renderHeight*sourceRatio*widthScale)
  );

  /*
    R203: center the complete window plane vertically on the wall face.
    The wall face runs from base.y-height to base.y, so its visual midpoint is
    exactly one half-height above the base.
  */
  const centerY=base.y-(height/2);

  return {
    x:Math.round(base.x-renderWidth/2),
    y:Math.round(centerY-renderHeight/2),
    width:renderWidth,
    height:renderHeight,
    base,
    center:{x:base.x,y:centerY}
  };
}


function cutWallOpeningFromLayer(layerCtx,wall,opening){
  const metrics=wallOpeningScreenMetrics(wall,opening);
  if(!metrics) return false;

  /*
    R200: cut one genuine rectangular aperture through the rendered wall.
    The old implementation removed only the white pane pixels, which left wall
    texture behind the frame and made the window look pasted onto the surface.
  */
  layerCtx.save();
  layerCtx.globalCompositeOperation="destination-out";
  layerCtx.fillStyle="rgba(0,0,0,1)";
  layerCtx.fillRect(
    metrics.x,
    metrics.y,
    metrics.width,
    metrics.height
  );
  layerCtx.restore();
  return true;
}

function drawWallOpeningOnLayer(layerCtx,wall,opening){
  const asset=processedWallOpeningAsset(opening?.type);
  const metrics=wallOpeningScreenMetrics(wall,opening);
  if(!asset || !metrics) return false;

  layerCtx.save();
  layerCtx.imageSmoothingEnabled=false;
  layerCtx.globalCompositeOperation="source-over";
  layerCtx.drawImage(
    asset.display,
    metrics.x,
    metrics.y,
    metrics.width,
    metrics.height
  );
  layerCtx.restore();
  return true;
}

function architecturalCornerSeamPoints(wall){
  if(!wall) return [];

  const dx=wall.b.x-wall.a.x;
  const dy=wall.b.y-wall.a.y;

  /*
    Draw the seam from the horizontal wall face only so each 90-degree joint
    receives exactly one vertical line rather than two overlapping seams.
  */
  if(Math.abs(dx)<Math.abs(dy)) return [];

  const endpointMatches=(point,otherPoint)=>
    Math.hypot(
      point.x-otherPoint.x,
      point.y-otherPoint.y
    )<0.5;

  return [wall.a,wall.b].filter(point=>
    architecturalWalls.some(other=>{
      if(!other || other===wall) return false;

      const odx=other.b.x-other.a.x;
      const ody=other.b.y-other.a.y;

      /* Require a clearly non-parallel/near-perpendicular connected wall. */
      const cross=Math.abs((dx*ody)-(dy*odx));
      const lenA=Math.hypot(dx,dy)||1;
      const lenB=Math.hypot(odx,ody)||1;
      if(cross/(lenA*lenB)<0.60) return false;

      return (
        endpointMatches(point,other.a) ||
        endpointMatches(point,other.b)
      );
    })
  );
}


/*
  R197 structure-level wall outline.

  Every wall segment is first rasterized into one shared opaque mask. We dilate
  that UNION silhouette by two pixels and subtract the original mask, leaving
  only the exterior perimeter. Joined segments therefore have no internal black
  seams: the whole connected wall structure reads as one stylized shape.
*/
function drawArchitecturalWallShapeOutline(wallsToOutline=architecturalWalls){
  const walls=(wallsToOutline || []).filter(Boolean);
  if(!walls.length) return;

  const mask=document.createElement("canvas");
  mask.width=ctx.canvas.width;
  mask.height=ctx.canvas.height;
  const mctx=mask.getContext("2d");
  mctx.imageSmoothingEnabled=false;
  mctx.lineCap="square";
  mctx.lineJoin="miter";
  mctx.strokeStyle="rgba(255,255,255,1)";

  for(const wall of walls){
    const height=Math.max(1,Math.round(wall.height || 35));
    const thickness=Math.max(3,Number(wall.thickness)||9);

    mctx.lineWidth=thickness;

    for(const solid of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(solid.a);
      const b=screenPointForWorld(solid.b);

      for(let z=0;z<=height;z++){
        mctx.beginPath();
        mctx.moveTo(a.x,a.y-z);
        mctx.lineTo(b.x,b.y-z);
        mctx.stroke();
      }
    }
  }

  const outline=document.createElement("canvas");
  outline.width=mask.width;
  outline.height=mask.height;
  const octx=outline.getContext("2d");
  octx.imageSmoothingEnabled=false;

  /* Two-pixel dilation of the complete union silhouette. */
  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      octx.drawImage(mask,dx,dy);
    }
  }

  /* Keep only pixels OUTSIDE the original wall structure. */
  octx.globalCompositeOperation="destination-out";
  octx.drawImage(mask,0,0);
  octx.globalCompositeOperation="source-over";

  octx.globalCompositeOperation="source-in";
  octx.fillStyle="#050507";
  octx.fillRect(0,0,outline.width,outline.height);
  octx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1;
  ctx.drawImage(outline,0,0);
  ctx.restore();
}

function drawArchitecturalWallTopOutline(wallsToOutline=architecturalWalls){
  const walls=(wallsToOutline || []).filter(Boolean);
  if(!walls.length) return;

  /*
    R206: rasterize only the upward-facing cap strokes into one shared mask.
    The resulting 2 px outline follows the union of connected top surfaces
    rather than outlining every authored wall segment independently.
  */
  const mask=document.createElement("canvas");
  mask.width=ctx.canvas.width;
  mask.height=ctx.canvas.height;

  const mctx=mask.getContext("2d");
  mctx.imageSmoothingEnabled=false;
  mctx.lineCap="square";
  mctx.lineJoin="miter";
  mctx.strokeStyle="rgba(255,255,255,1)";

  for(const wall of walls){
    const height=Math.max(1,Math.round(wall.height || 35));
    const thickness=Math.max(3,Number(wall.thickness)||9);
    mctx.lineWidth=thickness;

    for(const solid of wallBlockingSubsegments(wall,"movement")){
      const a=screenPointForWorld(solid.a,height);
      const b=screenPointForWorld(solid.b,height);

      mctx.beginPath();
      mctx.moveTo(a.x,a.y);
      mctx.lineTo(b.x,b.y);
      mctx.stroke();
    }
  }

  const outline=document.createElement("canvas");
  outline.width=mask.width;
  outline.height=mask.height;
  const octx=outline.getContext("2d");
  octx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      octx.drawImage(mask,dx,dy);
    }
  }

  octx.globalCompositeOperation="destination-out";
  octx.drawImage(mask,0,0);
  octx.globalCompositeOperation="source-over";

  octx.globalCompositeOperation="source-in";
  octx.fillStyle="#050507";
  octx.fillRect(0,0,outline.width,outline.height);
  octx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1;
  ctx.drawImage(outline,0,0);
  ctx.restore();
}


function drawArchitecturalWallSegment(wall){
  const height=Math.max(1,Math.round(wall.height || 35));
  const thickness=Math.max(3,wall.thickness || 9);
  const capColor=wall.material==="old-wood" ? "#716b61" : "#888b92";
  const solidSegments=wallBlockingSubsegments(wall,"movement");

  const layer=document.createElement("canvas");
  layer.width=ctx.canvas.width;
  layer.height=ctx.canvas.height;
  const lctx=layer.getContext("2d");
  lctx.imageSmoothingEnabled=false;
  lctx.lineCap="square";
  lctx.lineJoin="miter";

  let wallPaint="#555860";

  if(wall.material==="old-wood"){
    const woodPattern=oldWoodWallPatternForWall(
      lctx,
      wall,
      height,
      thickness
    );
    if(woodPattern){
      wallPaint=woodPattern;
    }
  }

  /*
    Doorways remain genuine gaps between wall subsegments. Windows are carved
    later as apertures so their glass/lattice plane can live at wall mid-depth.
  */
  lctx.strokeStyle=wallPaint;
  lctx.lineWidth=thickness;

  for(const solid of solidSegments){
    const a=screenPointForWorld(solid.a);
    const b=screenPointForWorld(solid.b);

    for(let z=0;z<height;z++){
      lctx.beginPath();
      lctx.moveTo(a.x,a.y-z);
      lctx.lineTo(b.x,b.y-z);
      lctx.stroke();
    }
  }

  /*
    R200 source-facing wall light:
    each contribution paints only the half-thickness face on the same side of
    the wall centerline as its source. The opposite face remains unchanged.
  */
  const lightContributions=architecturalWallLightContributions(wall);
  const visibleFaceSide=architecturalVisibleWallFaceSide(wall);

  for(const contribution of lightContributions){
    /*
      R204: a hidden/back face may be lit physically, but it must not brighten
      the visible front face. This rejects sources on the opposite side of the
      wall before any glow is painted into the wall layer.
    */
    if(
      visibleFaceSide===0 ||
      contribution.faceSide!==visibleFaceSide
    ){
      continue;
    }
    const source=contribution.source;
    const sourceScreen=hexCenter(source.x,source.y);
    const sourceLift=source.sourceKind==="unit" ? 20 : 5;
    const radiusPx=
      (Math.max(1,Number(source.radiusHexes)||1)+0.55)*HEX_W;
    const color=source.color || [255,244,188];
    /*
      R207: soften visible wall-face illumination by a further 50%.
      Terrain/floor illumination is intentionally unchanged.
    */
    const strength=
      Math.max(0,Math.min(1.35,contribution.intensity))*0.25;

    const gradient=lctx.createRadialGradient(
      sourceScreen.x,
      sourceScreen.y-sourceLift,
      2,
      sourceScreen.x,
      sourceScreen.y-sourceLift,
      radiusPx
    );

    gradient.addColorStop(
      0,
      `rgba(${color[0]},${color[1]},${color[2]},${0.42*strength})`
    );
    gradient.addColorStop(
      0.52,
      `rgba(${color[0]},${color[1]},${color[2]},${0.24*strength})`
    );
    gradient.addColorStop(
      1,
      `rgba(${color[0]},${color[1]},${color[2]},0)`
    );

    const normal=contribution.wallNormal || {x:0,y:0};
    const side=contribution.faceSide || 1;
    const faceWidth=Math.max(1,thickness*0.50);
    const faceOffset=thickness*0.25;
    const offsetX=normal.x*side*faceOffset;
    const offsetY=normal.y*side*faceOffset;

    lctx.save();
    lctx.globalCompositeOperation="lighter";
    lctx.strokeStyle=gradient;
    lctx.lineWidth=faceWidth;

    for(const solid of solidSegments){
      const a=screenPointForWorld({
        x:solid.a.x+offsetX,
        y:solid.a.y+offsetY
      });
      const b=screenPointForWorld({
        x:solid.b.x+offsetX,
        y:solid.b.y+offsetY
      });

      for(let z=2;z<height-1;z++){
        lctx.beginPath();
        lctx.moveTo(a.x,a.y-z);
        lctx.lineTo(b.x,b.y-z);
        lctx.stroke();
      }
    }

    lctx.restore();
  }

  /*
    R202: repeating material belongs only on vertical wall faces.
    The wall top is a separate flat cap surface and must not inherit the wood
    boards/pattern from the vertical sprite.
  */
  lctx.strokeStyle=capColor;
  lctx.lineWidth=thickness;

  for(const solid of solidSegments){
    const a=screenPointForWorld(solid.a);
    const b=screenPointForWorld(solid.b);
    lctx.beginPath();
    lctx.moveTo(a.x,a.y-height);
    lctx.lineTo(b.x,b.y-height);
    lctx.stroke();
  }

  /*
    Only projectable north/south windows receive a visible aperture + window
    plane. East/west window planes are edge-on in this camera and therefore
    intentionally produce no face-on texture or cutout artifact.
  */
  for(const opening of wall.openings || []){
    if(opening.type!=="window") continue;
    cutWallOpeningFromLayer(lctx,wall,opening);
  }

  for(const opening of wall.openings || []){
    if(opening.type!=="window") continue;
    drawWallOpeningOnLayer(lctx,wall,opening);
  }

  /*
    R202 internal/joined corner readability:
    a dark vertical seam marks connected 90-degree wall joints. This restores
    the depth cue the union-outline pass intentionally removed from connected
    masonry while keeping ordinary straight wall segments seamless.
  */
  lctx.save();
  lctx.strokeStyle="#050507";
  lctx.lineWidth=2;
  lctx.lineCap="butt";

  for(const corner of architecturalCornerSeamPoints(wall)){
    const point=screenPointForWorld(corner);
    lctx.beginPath();
    lctx.moveTo(point.x,point.y-height);
    lctx.lineTo(point.x,point.y);
    lctx.stroke();
  }

  lctx.restore();

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(layer,0,0);
  ctx.restore();
}

/* Threshold camera.
   -----------------
   The map stays stationary while units move. When the moving unit
   gets within ~4 hexes of a viewport edge, the camera recenters on
   that unit and then remains fixed again. */
const camera={
  x:0,
  y:0
};

const CAMERA_EDGE_HEXES=4;

const ui={
  roundLabel:document.getElementById("roundLabel"),
  initiativeLabel:document.getElementById("initiativeLabel"),
  turnBanner:document.getElementById("turnBanner"),
  playerHp:document.getElementById("playerHp"),
  playerAc:document.getElementById("playerAc"),
  playerThaco:document.getElementById("playerThaco"),
  playerMove:document.getElementById("playerMove"),
  koboldHp:document.getElementById("koboldHp"),
  str:document.getElementById("str"),
  dex:document.getElementById("dex"),
  con:document.getElementById("con"),
  int:document.getElementById("int"),
  wis:document.getElementById("wis"),
  cha:document.getElementById("cha"),
  lastRoll:document.getElementById("lastRoll"),
  combatLog:document.getElementById("combatLog"),
  resultOverlay:document.getElementById("resultOverlay"),
  resultTitle:document.getElementById("resultTitle"),
  resultText:document.getElementById("resultText"),
  restartButton:document.getElementById("restartButton"),
  unitInfoName:document.getElementById("unitInfoName"),
  unitInfoMode:document.getElementById("unitInfoMode"),
  unitInfoRows:document.getElementById("unitInfoRows"),
  unitInfoEffects:document.getElementById("unitInfoEffects"),
  unitInfoAbilities:document.getElementById("unitInfoAbilities")
};

let game=null;
let aiTimer=null;
let hoverHex=null;

let aimMode=false;
const aimCursor={x:0,y:0};
let aimReturnBanner="";

/* Shared targeting/inspection layer for spells, missiles, and contextual attacks. */
let pendingAimAction=null;
let spellCastInProgress=false;

let sweepInProgress=false;
let mobGuardReactionInProgress=false;

/* R161 Quick Command: persistent per-character computer control. */
const quickCommandUnitIds=new Set();
let quickCommandActive=false;
let quickCommandUnitId=null;
let quickCommandGeneration=0;
let quickCommandRunning=false;

function isQuickCommandUnit(unitOrId){
  const id=typeof unitOrId==="string" ? unitOrId : unitOrId?.id;
  return !!id && quickCommandUnitIds.has(id);
}

function syncQuickCommandState(activeId=game?.active || null){
  quickCommandActive=quickCommandUnitIds.size>0;
  quickCommandUnitId=(activeId && quickCommandUnitIds.has(activeId)) ? activeId : null;
}

/* Most recent randomized MOB deployment, useful for testing/logging. */
let lastMobDeployment=null;
let lastOrcDeployment=null;

/* One-second death marker overlay (R157 uses the user-provided skull sprite). */
let deathFx=null;
let deathFxTimer=null;

/* R72 short-lived text barks attached to moving units. */
let unitBarkClearTimer=null;

/* R137: transient generic marker for successfully heard off-LOS hostile movement. */
let activityDetectedFx=null;
let activityDetectedClearTimer=null;

/* Pre-combat presentation state.
   Carl is silent; combat begins when the player presses Space. */
let combatOpeningSpeechDone=false;
let combatAwaitingStart=false;

/* Lower-edge combat notification bar. */
let combatMessageText="";
let combatMessageHoldUntil=0;
let combatMessageClearTimer=null;
let combatMessageFlashTimer=null;
let combatMessageSequence=0;
let combatMessageTone="normal";

const COMBAT_MESSAGE_MIN_HOLD_MS=1000;
const COMBAT_MESSAGE_DISPLAY_MS=1500;
/* R86: 33 1/3% faster sequential AoE target presentation (1500 ms / 4/3 = 1125 ms). */
const AREA_EFFECT_UNIT_RESOLUTION_MS=Math.round(COMBAT_MESSAGE_DISPLAY_MS*0.75);
const CRITICAL_MESSAGE_HOLD_MS=1500;
const CRITICAL_FLASH_INTERVAL_MS=120;

/* Brief combat beat after every death before the next action continues. */
const DEATH_ACTION_PAUSE_MS=333;
let deathActionPauseUntil=0;

/* Short-lived missile projectile overlay. */
let projectileFx=null;

/* Generic one-at-a-time spell damage indicator retained for non-Fireball AoE spells. */
let areaDamageFx=null;

/* R93 spell presentation overlays. */
/* R94: Sleep 7-hex cluster + depth-sorted volumetric Wall of Fog. */
/* R104: persistent Unconscious and Confusion status VFX added; R103 spell VFX retained. */
let fireballExplosionFx=null;
/* R187: animated tactical cone for juvenile Red Dragon fire breath. */
let dragonBreathFx=null;
/* R100: short-lived fan-shaped prismatic Color Spray overlay. */
let colorSprayFx=null;
let magicEffectFx=[];

/*
  R142 transient unit VFX:
  - castingGlowFx follows a spellcaster's sprite outline while the incantation is visible.
  - fireDamageFx adds a short flame reaction whenever fire damage actually lands.
  A shared requestAnimationFrame loop keeps both effects animated without changing combat timing.
*/
let castingGlowFx=[];
let fireDamageFx=[];
/* R193: one-second grow/shrink sprite-scale animation for Enlarge. */
let enlargeTransitionFx=[];
let transientUnitFxFrame=null;

/* R95: requestAnimationFrame id used only while persistent animated status FX are active. */
let persistentStatusFxFrame=null;

/* Fighter progression persists between combat restarts for this session. */
let persistentFighter=null;
let classReportOpen=false;
let characterSheetOpen=false;

function d(sides){
  return 1+Math.floor(Math.random()*sides);
}

function roll3d6(){
  return d(6)+d(6)+d(6);
}

function clamp(n,min,max){
  return Math.max(min,Math.min(max,n));
}

/* UNIVERSAL PHYSICAL ATTACK RULE
   Applies to every physical attack that uses a d20 attack roll:
   melee weapons, natural attacks, thrown weapons, and missile/projectile attacks.

   IMPORTANT ORDER OF OPERATIONS:
   1. Roll the RAW d20.
   2. RAW natural 1  = automatic miss.
   3. RAW natural 20 = automatic hit.
   4. ONLY on raw rolls 2-19 are attack modifiers applied.

   Equipment bonuses, ability modifiers, proficiency, range penalties,
   magic bonuses, situational modifiers, etc. can NEVER turn a natural 1
   into a hit or turn a natural 20 into a miss.

   Future physical attack types must route through this resolver. */
function resolvePhysicalAttackD20(rawRoll,targetNumber,attackModifier=0){
  if(rawRoll===1){
    return {
      hit:false,
      automatic:"AUTO MISS",
      rawRoll:1,
      attackModifier:0,
      modifiedRoll:1,
      targetNumber
    };
  }

  if(rawRoll===20){
    return {
      hit:true,
      automatic:"AUTO HIT",
      rawRoll:20,
      attackModifier:0,
      modifiedRoll:20,
      targetNumber
    };
  }

  const modifiedRoll=
    rawRoll+
    attackModifier;

  return {
    hit:modifiedRoll>=targetNumber,
    automatic:null,
    rawRoll,
    attackModifier,
    modifiedRoll,
    targetNumber
  };
}

/* Semantic wrappers for future combat code.
   Both deliberately route to the same universal physical resolver. */
function resolveMeleeAttackD20(rawRoll,targetNumber,attackModifier=0){
  return resolvePhysicalAttackD20(
    rawRoll,
    targetNumber,
    attackModifier
  );
}

function resolveMissileAttackD20(rawRoll,targetNumber,attackModifier=0){
  return resolvePhysicalAttackD20(
    rawRoll,
    targetNumber,
    attackModifier
  );
}


function key(x,y){
  return `${x},${y}`;
}

function inside(x,y){
  return (
    x>=MAP_MIN_X &&
    x<=MAP_MAX_X &&
    y>=MAP_MIN_Y &&
    y<=MAP_MAX_Y
  );
}

function isMapEdgeHex(x,y){
  return !!(
    inside(x,y) &&
    (
      x===MAP_MIN_X ||
      x===MAP_MAX_X ||
      y===MAP_MIN_Y ||
      y===MAP_MAX_Y
    )
  );
}

function isWall(x,y){
  return (
    !inside(x,y) ||
    walls.has(key(x,y)) ||
    isArchitecturalBlockedHex(x,y)
  );
}

function hexDistance(a,b){
  const ax=a.x;
  const az=a.y;
  const ay=-ax-az;
  const bx=b.x;
  const bz=b.y;
  const by=-bx-bz;

  return Math.max(
    Math.abs(ax-bx),
    Math.abs(ay-by),
    Math.abs(az-bz)
  );
}

function isAdjacent(a,b){
  return hexDistance(a,b)===1;
}

function updateFacingForStep(entity,dx,dy){
  if(!entity) return;

  const target={
    x:(entity.x||0)+dx,
    y:(entity.y||0)+dy
  };

  entity.facingHex=
    hexDirectionIndexToward(entity,target);

  /*
    The tactical engine tracks all six hex facings. Current placeholder
    sprites still have only left/right artwork, so retain this projection
    solely for sprite flipping.
  */
  const horizontal=dx+(dy*0.5);

  if(horizontal>0){
    entity.facing="right";
  }else if(horizontal<0){
    entity.facing="left";
  }
}

function centerCameraOn(entity){
  if(!entity) return;
  camera.x=entity.x;
  camera.y=entity.y;
  hoverHex=null;
}

function maybeRecenterCamera(entity){
  if(!entity) return false;

  const centers=occupiedHexesAt(entity,entity.x,entity.y).map(cell=>
    hexCenter(cell.x,cell.y)
  );

  const marginX=HEX_W*CAMERA_EDGE_HEXES;
  const marginY=HEX_ROW*CAMERA_EDGE_HEXES;

  const nearEdge=centers.some(c=>
    c.x<=marginX ||
    c.x>=canvas.width-marginX ||
    c.y<=marginY ||
    c.y>=canvas.height-marginY
  );

  if(nearEdge){
    centerCameraOn(entity);
    return true;
  }

  return false;
}

function isHexOnBattlefieldScreen(x,y,padding=0){
  const c=hexCenter(x,y);

  return (
    c.x+HEX_W/2 >= -padding &&
    c.x-HEX_W/2 <= canvas.width+padding &&
    c.y+HEX_H/2 >= -padding &&
    c.y-HEX_H/2 <= canvas.height+padding
  );
}

function isEntityOnBattlefieldScreen(entity,padding=0){
  return !!(
    entity &&
    occupiedHexes(entity).some(cell=>
      isHexOnBattlefieldScreen(
        cell.x,
        cell.y,
        padding
      )
    )
  );
}

async function focusRangedAttacker(attacker,settleMs=180){
  if(!attacker) return;

  centerCameraOn(attacker);
  draw();

  if(settleMs>0){
    await sleep(settleMs);
  }
}

async function focusDamagedTargetIfOffscreen(target,settleMs=120){
  if(
    !target ||
    isEntityOnBattlefieldScreen(target)
  ){
    return false;
  }

  centerCameraOn(target);
  draw();

  if(settleMs>0){
    await sleep(settleMs);
  }

  return true;
}

async function focusRangedMissTarget(target,settleMs=150){
  if(!target) return;

  /*
    A ranged miss still belongs visually to its target. Unlike successful
    damage focus, misses always center the target so the player can see
    where the failed shot landed.
  */
  centerCameraOn(target);
  draw();

  if(settleMs>0){
    await sleep(settleMs);
  }
}

function hexCenter(x,y,elevation=0){
  const dx=x-camera.x;
  const dy=y-camera.y;

  return {
    x:(canvas.width*0.47) + dx*HEX_W + dy*(HEX_W/2),
    y:(canvas.height*0.57) + dy*HEX_ROW - elevation
  };
}

function hexScreenVertices(x,y,elevation=0){
  const c=hexCenter(x,y,elevation);

  return [
    {x:c.x,         y:c.y-HEX_H/2},
    {x:c.x+HEX_W/2, y:c.y-HEX_H/4},
    {x:c.x+HEX_W/2, y:c.y+HEX_H/4},
    {x:c.x,         y:c.y+HEX_H/2},
    {x:c.x-HEX_W/2, y:c.y+HEX_H/4},
    {x:c.x-HEX_W/2, y:c.y-HEX_H/4}
  ];
}

function roundAxial(q,r){
  let x=q;
  let z=r;
  let y=-x-z;

  let rx=Math.round(x);
  let ry=Math.round(y);
  let rz=Math.round(z);

  const xDiff=Math.abs(rx-x);
  const yDiff=Math.abs(ry-y);
  const zDiff=Math.abs(rz-z);

  if(xDiff>yDiff && xDiff>zDiff){
    rx=-ry-rz;
  }else if(yDiff>zDiff){
    ry=-rx-rz;
  }else{
    rz=-rx-ry;
  }

  return {x:rx,y:rz};
}

function hexAtCanvasPoint(px,py){
  const relR=(py-(canvas.height*0.57))/HEX_ROW;
  const relQ=(px-(canvas.width*0.47)-relR*(HEX_W/2))/HEX_W;

  return roundAxial(
    relQ+camera.x,
    relR+camera.y
  );
}

const RULESET={
  name:"AD&D 2nd Edition",
  edition:"2nd Edition",
  coreBooks:["Player's Handbook","Dungeon Master's Guide"],
  combatModel:"THAC0 + descending Armor Class",
  initiativeMode:"Individual d10 variant for Adventure Party combat test",
  optionalRules:["Warrior Sweep: attacks equal level vs creatures with less than 1 HD"],

  physicalAttackNaturalRollRule:{
    natural1:"automatic miss",
    natural20:"automatic hit"
  },

  physicalAttackCategories:[
    "melee weapon",
    "natural attack",
    "thrown weapon",
    "missile / projectile weapon"
  ],

  positionalCombat:{
    facingSectors:6,
    directRearAttackBonus:2,
    directRearDeniesBeneficialDexterityAc:true,
    rearAndRearFlanksDenyShield:true,
    thiefBackstabUsesDirectRear:true
  },

  missileExamples:[
    "rock",
    "thrown dagger",
    "javelin",
    "arrow",
    "crossbow bolt",
    "sling stone / sling bullet",
    "dart"
  ],

  mobAI:{
    name:"Core MOB Logic",
    missileDefaultBeyondHexes:4,
    closeWithinHexes:4,
    fillClosestReachable:true,
    guardWhenUnableToAttack:true
  }
};

/* ============================================================
   R136 — AD&D 2E ALIGNMENT SYSTEM
   ------------------------------------------------------------
   Two independent axes are stored explicitly:
     ethos    = Law / Neutrality / Chaos
     morality = Good / Neutrality / Evil
   The nine combinations are canonical game records. Alignment is a
   role-playing guide; class restrictions are evaluated separately.
   ============================================================ */

const ALIGNMENT_SYSTEM={
  axes:{
    ethos:["lawful","neutral","chaotic"],
    morality:["good","neutral","evil"]
  },
  alignments:{
    "lawful-good":{
      id:"lawful-good",abbr:"LG",name:"Lawful Good",ethos:"lawful",morality:"good",
      summary:"Order, duty, and dependable institutions are used to protect people and promote the common good."
    },
    "lawful-neutral":{
      id:"lawful-neutral",abbr:"LN",name:"Lawful Neutral",ethos:"lawful",morality:"neutral",
      summary:"Order, structure, duty, and reliable rules are valued above questions of benevolence or cruelty."
    },
    "lawful-evil":{
      id:"lawful-evil",abbr:"LE",name:"Lawful Evil",ethos:"lawful",morality:"evil",
      summary:"Hierarchy, law, and organization are used for personal or factional advantage, often at others' expense."
    },
    "neutral-good":{
      id:"neutral-good",abbr:"NG",name:"Neutral Good",ethos:"neutral",morality:"good",
      summary:"Doing good takes priority; law or individual freedom is supported according to which better serves that goal."
    },
    "true-neutral":{
      id:"true-neutral",abbr:"N",name:"True Neutral",ethos:"neutral",morality:"neutral",
      summary:"Neither law nor chaos, good nor evil is allowed to dominate; balance and circumstance guide decisions."
    },
    "neutral-evil":{
      id:"neutral-evil",abbr:"NE",name:"Neutral Evil",ethos:"neutral",morality:"evil",
      summary:"Self-interest and advancement come first, with rules, alliances, or betrayal used pragmatically."
    },
    "chaotic-good":{
      id:"chaotic-good",abbr:"CG",name:"Chaotic Good",ethos:"chaotic",morality:"good",
      summary:"Individual freedom and conscience are prized while kindness, protection, and benevolent action remain central."
    },
    "chaotic-neutral":{
      id:"chaotic-neutral",abbr:"CN",name:"Chaotic Neutral",ethos:"chaotic",morality:"neutral",
      summary:"Personal freedom, spontaneity, and independence outweigh imposed order; moral concerns are secondary."
    },
    "chaotic-evil":{
      id:"chaotic-evil",abbr:"CE",name:"Chaotic Evil",ethos:"chaotic",morality:"evil",
      summary:"Personal desire and power dominate; imposed law is rejected and others may be exploited without restraint."
    }
  }
};

const ALIGNMENT_ALIASES={
  "lg":"lawful-good","lawful good":"lawful-good","lawful-good":"lawful-good",
  "ln":"lawful-neutral","lawful neutral":"lawful-neutral","lawful-neutral":"lawful-neutral","lawful":"lawful-neutral",
  "le":"lawful-evil","lawful evil":"lawful-evil","lawful-evil":"lawful-evil",
  "ng":"neutral-good","neutral good":"neutral-good","neutral-good":"neutral-good","good":"neutral-good",
  "n":"true-neutral","tn":"true-neutral","true neutral":"true-neutral","true-neutral":"true-neutral","neutral":"true-neutral",
  "ne":"neutral-evil","neutral evil":"neutral-evil","neutral-evil":"neutral-evil","evil":"neutral-evil",
  "cg":"chaotic-good","chaotic good":"chaotic-good","chaotic-good":"chaotic-good",
  "cn":"chaotic-neutral","chaotic neutral":"chaotic-neutral","chaotic-neutral":"chaotic-neutral","chaotic":"chaotic-neutral",
  "ce":"chaotic-evil","chaotic evil":"chaotic-evil","chaotic-evil":"chaotic-evil"
};

function normalizeAlignmentId(value){
  const key=String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g,"-")
    .replace(/\s+/g," ");
  return ALIGNMENT_ALIASES[key] || null;
}

function alignmentData(value){
  const id=normalizeAlignmentId(value);
  return id ? ALIGNMENT_SYSTEM.alignments[id] : null;
}

function alignmentDisplayName(value){
  return alignmentData(value)?.name || String(value || "Unspecified");
}

function isValidAlignment(value){
  return !!alignmentData(value);
}

function classAllowsAlignment(classId,alignment,{deityAlignments=null}={}){
  const id=normalizeAlignmentId(alignment);
  if(!id) return false;

  switch(String(classId || "").toLowerCase()){
    case "thief":
      return id!=="lawful-good";
    case "cleric":{
      if(Array.isArray(deityAlignments) && deityAlignments.length){
        const allowed=new Set(deityAlignments.map(normalizeAlignmentId).filter(Boolean));
        return allowed.has(id);
      }
      /* Without a defined campaign deity, the PHB rule is represented as a
         deferred restriction: any alignment may exist, but it must eventually
         be acceptable to the selected deity/mythos. */
      return true;
    }
    case "fighter":
    case "mage":
    default:
      return true;
  }
}

window.AdventurePartyAlignmentSystem={
  rules:ALIGNMENT_SYSTEM,
  normalizeAlignmentId,
  alignmentData,
  alignmentDisplayName,
  isValidAlignment,
  classAllowsAlignment
};

const FIGHTER_CLASS={
  name:"Fighter",
  group:"Warrior",
  minimumStrength:9,
  primeRequisite:"Strength",
  primeRequisiteXpBonusThreshold:16,

  hitDie:10,
  hitDiceThroughLevel:9,
  hpPerLevelAfterHitDice:3,

  armor:"Any armor",
  shields:"Any shield",
  weapons:"Any weapon",

  initialWeaponProficiencies:4,
  weaponProficiencyRate:3,
  weaponNonproficiencyPenalty:-2,

  initialNonweaponProficiencies:3,
  nonweaponProficiencyRate:3,

  canWeaponSpecialize:true,

  canSweep:true,
  sweepTargetRule:"less than 1 Hit Die (1-1 or lower)",
  sweepAttackRule:"attacks equal warrior level",
  sweepRequiredAttackType:"S",
  sweepWeaponRule:"requires an equipped weapon capable of a Slashing (S) attack",

  followerLevel:9,
  followerRequirement:"Establish a stronghold",

  baseMovement:12
};

/* ============================================================
   R91 — LARGER RIGHT-SIDE UNIT PANEL TEXT
   R90 — LEVEL 20 PARTY MAGE TEST
   AD&D 2nd Edition generalist Mage foundation.
   ------------------------------------------------------------
   This subsystem is deliberately independent from the active
   Fighter combat-test character. Character Generation / party
   selection can instantiate these records later without rewriting
   class progression or spell-book logic.
   ============================================================ */

const MAGE_CLASS={
  id:"mage",
  name:"Mage",
  group:"Wizard",
  minimumIntelligence:9,
  primeRequisite:"Intelligence",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:["Human","Elf","Half-elf"],
  alignments:"Any",

  hitDie:4,
  hitDiceThroughLevel:10,
  hpPerLevelAfterHitDice:1,

  armor:"None",
  shields:"None",
  weapons:["Dagger","Staff","Dart","Knife","Sling"],

  initialWeaponProficiencies:1,
  weaponProficiencyRate:6,
  weaponNonproficiencyPenalty:-5,
  initialNonweaponProficiencies:4,
  nonweaponProficiencyRate:3,

  studyMinutesPerSpellLevel:10,
  scrollPotionCreationLevel:9,
  specialization:null,
  canResearchSpells:true,
  strongholdSpecialFollowers:false,
  advancedMagicItemCreation:"Requires appropriate spells / campaign research rules",

  magicalItemUse:[
    "Potions","Rings","Wands","Rods","Scrolls","Staves",
    "Most miscellaneous magical items",
    "Magical versions of class-allowed weapons"
  ]
};

const MAGE_XP_LEVELS=[
  0,2500,5000,10000,20000,40000,60000,90000,135000,250000,
  375000,750000,1125000,1500000,1875000,2250000,2625000,
  3000000,3375000,3750000
];

const MAGE_SPELL_SLOT_ROWS=[
  [1,0,0,0,0,0,0,0,0],
  [2,0,0,0,0,0,0,0,0],
  [2,1,0,0,0,0,0,0,0],
  [3,2,0,0,0,0,0,0,0],
  [4,2,1,0,0,0,0,0,0],
  [4,2,2,0,0,0,0,0,0],
  [4,3,2,1,0,0,0,0,0],
  [4,3,3,2,0,0,0,0,0],
  [4,3,3,2,1,0,0,0,0],
  [4,4,3,2,2,0,0,0,0],
  [4,4,4,3,3,0,0,0,0],
  [4,4,4,4,4,1,0,0,0],
  [5,5,5,4,4,2,0,0,0],
  [5,5,5,4,4,2,1,0,0],
  [5,5,5,5,5,2,1,0,0],
  [5,5,5,5,5,3,2,1,0],
  [5,5,5,5,5,3,3,2,0],
  [5,5,5,5,5,3,3,2,1],
  [5,5,5,5,5,3,3,3,1],
  [5,5,5,5,5,4,3,3,2]
];

function mageWeaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return MAGE_CLASS.initialWeaponProficiencies+
    Math.floor((lvl-1)/MAGE_CLASS.weaponProficiencyRate);
}

function mageNonweaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return MAGE_CLASS.initialNonweaponProficiencies+
    Math.floor((lvl-1)/MAGE_CLASS.nonweaponProficiencyRate);
}

function mageThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return 20-Math.floor((lvl-1)/3);
}

const MAGE_LEVELS=Array.from({length:20},(_,index)=>{
  const level=index+1;
  const fixed=level>10 ? level-10 : 0;

  return {
    level,
    xp:MAGE_XP_LEVELS[index],
    thaco:mageThaco(level),
    hd:level<=10 ? `${level}d4` : `10d4+${fixed}`,
    wp:mageWeaponProficiencySlots(level),
    nwp:mageNonweaponProficiencySlots(level),
    spellSlots:[...MAGE_SPELL_SLOT_ROWS[index]]
  };
});

const MAGE_SAVING_THROW_BANDS=[
  {min:1,max:5,death:14,wand:11,poly:13,breath:15,spell:12},
  {min:6,max:10,death:13,wand:9,poly:11,breath:13,spell:10},
  {min:11,max:15,death:11,wand:7,poly:9,breath:11,spell:8},
  {min:16,max:20,death:10,wand:5,poly:7,breath:9,spell:6},
  {min:21,max:Infinity,death:8,wand:3,poly:5,breath:7,spell:4}
];

function mageSavingThrows(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  const row=MAGE_SAVING_THROW_BANDS.find(row=>lvl>=row.min && lvl<=row.max) ||
    MAGE_SAVING_THROW_BANDS[MAGE_SAVING_THROW_BANDS.length-1];

  return {
    death:row.death,
    wand:row.wand,
    poly:row.poly,
    breath:row.breath,
    spell:row.spell
  };
}

const MAGE_INTELLIGENCE_TABLE={
  1:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  2:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  3:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  4:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  5:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  6:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  7:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  8:{maxSpellLevel:0,chanceToLearn:0,maxSpellsPerLevel:0,spellImmunity:null},
  9:{maxSpellLevel:4,chanceToLearn:35,maxSpellsPerLevel:6,spellImmunity:null},
  10:{maxSpellLevel:5,chanceToLearn:40,maxSpellsPerLevel:7,spellImmunity:null},
  11:{maxSpellLevel:5,chanceToLearn:45,maxSpellsPerLevel:7,spellImmunity:null},
  12:{maxSpellLevel:6,chanceToLearn:50,maxSpellsPerLevel:7,spellImmunity:null},
  13:{maxSpellLevel:6,chanceToLearn:55,maxSpellsPerLevel:9,spellImmunity:null},
  14:{maxSpellLevel:7,chanceToLearn:60,maxSpellsPerLevel:9,spellImmunity:null},
  15:{maxSpellLevel:7,chanceToLearn:65,maxSpellsPerLevel:11,spellImmunity:null},
  16:{maxSpellLevel:8,chanceToLearn:70,maxSpellsPerLevel:11,spellImmunity:null},
  17:{maxSpellLevel:8,chanceToLearn:75,maxSpellsPerLevel:14,spellImmunity:null},
  18:{maxSpellLevel:9,chanceToLearn:85,maxSpellsPerLevel:18,spellImmunity:null},
  19:{maxSpellLevel:9,chanceToLearn:95,maxSpellsPerLevel:Infinity,spellImmunity:"1st-level illusions"},
  20:{maxSpellLevel:9,chanceToLearn:96,maxSpellsPerLevel:Infinity,spellImmunity:"2nd-level illusions"},
  21:{maxSpellLevel:9,chanceToLearn:97,maxSpellsPerLevel:Infinity,spellImmunity:"3rd-level illusions"},
  22:{maxSpellLevel:9,chanceToLearn:98,maxSpellsPerLevel:Infinity,spellImmunity:"4th-level illusions"},
  23:{maxSpellLevel:9,chanceToLearn:99,maxSpellsPerLevel:Infinity,spellImmunity:"5th-level illusions"},
  24:{maxSpellLevel:9,chanceToLearn:100,maxSpellsPerLevel:Infinity,spellImmunity:"6th-level illusions"},
  25:{maxSpellLevel:9,chanceToLearn:100,maxSpellsPerLevel:Infinity,spellImmunity:"7th-level illusions"}
};

function mageIntelligenceData(score){
  const numeric=Number(score);
  const value=clamp(
    Number.isFinite(numeric) ? Math.floor(numeric) : MAGE_CLASS.minimumIntelligence,
    1,
    25
  );
  return MAGE_INTELLIGENCE_TABLE[value];
}

const WIZARD_SPECIALIST_SCHOOLS={
  abjurer:{name:"Abjurer",school:"Abjuration",races:["Human"],minimumAbility:{ability:"Wisdom",score:15},oppositionSchools:["Alteration","Illusion"]},
  conjurer:{name:"Conjurer",school:"Conjuration/Summoning",races:["Human","Half-elf"],minimumAbility:{ability:"Constitution",score:15},oppositionSchools:["Greater Divination","Invocation/Evocation"]},
  diviner:{name:"Diviner",school:"Greater Divination",races:["Human","Half-elf","Elf"],minimumAbility:{ability:"Wisdom",score:16},oppositionSchools:["Conjuration/Summoning"]},
  enchanter:{name:"Enchanter",school:"Enchantment/Charm",races:["Human","Half-elf","Elf"],minimumAbility:{ability:"Charisma",score:16},oppositionSchools:["Invocation/Evocation","Necromancy"]},
  illusionist:{name:"Illusionist",school:"Illusion",races:["Human","Gnome"],minimumAbility:{ability:"Dexterity",score:16},oppositionSchools:["Necromancy","Invocation/Evocation","Abjuration"]},
  invoker:{name:"Invoker",school:"Invocation/Evocation",races:["Human"],minimumAbility:{ability:"Constitution",score:16},oppositionSchools:["Enchantment/Charm","Conjuration/Summoning"]},
  necromancer:{name:"Necromancer",school:"Necromancy",races:["Human"],minimumAbility:{ability:"Wisdom",score:16},oppositionSchools:["Illusion","Enchantment/Charm"]},
  transmuter:{name:"Transmuter",school:"Alteration",races:["Human","Half-elf"],minimumAbility:{ability:"Dexterity",score:15},oppositionSchools:["Abjuration","Necromancy"]}
};

function normalizeWizardSchool(school){
  const key=String(school || "").trim().toLowerCase();
  const aliases={
    "abjuration":"Abjuration",
    "alteration":"Alteration",
    "conjuration":"Conjuration/Summoning",
    "conjuration/summoning":"Conjuration/Summoning",
    "divination":"Greater Divination",
    "greater divination":"Greater Divination",
    "lesser divination":"Lesser Divination",
    "enchantment":"Enchantment/Charm",
    "enchantment/charm":"Enchantment/Charm",
    "illusion":"Illusion",
    "illusion/phantasm":"Illusion",
    "evocation":"Invocation/Evocation",
    "invocation/evocation":"Invocation/Evocation",
    "necromancy":"Necromancy"
  };

  return aliases[key] || school || "Unknown";
}

function wizardSchoolForSpell(spell){
  if(!spell) return "Unknown";
  const raw=String(spell.school || "").trim().toLowerCase();

  /* Lesser Divination is the minor school containing divinations of
     4th spell level or lower and remains available to all Wizards. */
  if(raw==="divination"){
    return Number(spell.level)<=4
      ? "Lesser Divination"
      : "Greater Divination";
  }

  return normalizeWizardSchool(spell.school);
}

function isMageCharacter(character){
  return !!character && (
    character.classId===MAGE_CLASS.id ||
    character.className===MAGE_CLASS.name
  );
}

function canonicalMageRace(race){
  const value=String(race || "Human").trim().toLowerCase();
  return MAGE_CLASS.racesAllowed.find(allowed=>
    allowed.toLowerCase()===value
  ) || null;
}

function mageClassEligibility({race="Human",stats=null}={}){
  const canonicalRace=canonicalMageRace(race);
  if(!canonicalRace){
    return {
      ok:false,
      reason:`Mage race must be one of: ${MAGE_CLASS.racesAllowed.join(", ")}.`
    };
  }

  if(stats && Number(stats.int)<MAGE_CLASS.minimumIntelligence){
    return {
      ok:false,
      reason:`Mage requires Intelligence ${MAGE_CLASS.minimumIntelligence} or higher.`
    };
  }

  return {ok:true,race:canonicalRace,reason:"Eligible for the Mage class."};
}

function mageLevelData(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,MAGE_LEVELS.length);
  return MAGE_LEVELS[lvl-1];
}

function mageNextLevelXp(level){
  const lvl=Math.floor(Number(level)||1);
  return lvl>=20 ? null : MAGE_LEVELS[lvl].xp;
}

function mageClassMaximumSpellLevel(level){
  const slots=mageLevelData(level).spellSlots;
  let max=0;
  slots.forEach((count,index)=>{ if(count>0) max=index+1; });
  return max;
}

function mageMaximumSpellLevel(character){
  const classMax=mageClassMaximumSpellLevel(character?.level || 1);
  const intMax=mageIntelligenceData(character?.stats?.int).maxSpellLevel;
  return Math.min(classMax,intMax);
}

function mageBaseSpellSlots(character){
  const row=mageLevelData(character?.level || 1);
  const maxLevel=mageMaximumSpellLevel(character);

  return row.spellSlots.map((count,index)=>
    index+1<=maxLevel ? count : 0
  );
}

function mageEnsureSpellState(mage){
  if(!mage) return null;

  if(!Array.isArray(mage.knownSpellIds)) mage.knownSpellIds=[];
  if(!Array.isArray(mage.memorizedSpellIds)) mage.memorizedSpellIds=[];
  if(!mage.failedSpellLearning || typeof mage.failedSpellLearning!=="object"){
    mage.failedSpellLearning={};
  }

  return mage;
}

function mageKnownSpellCountAtLevel(mage,spellLevel){
  mageEnsureSpellState(mage);
  return mage.knownSpellIds.reduce((count,id)=>{
    const spell=getSpellEntry(id);
    return count+(spell?.level===spellLevel ? 1 : 0);
  },0);
}

function mageMemorizedCountAtLevel(mage,spellLevel){
  mageEnsureSpellState(mage);
  return mage.memorizedSpellIds.reduce((count,id)=>{
    const spell=getSpellEntry(id);
    return count+(spell?.level===spellLevel ? 1 : 0);
  },0);
}

function mageMemorizedCount(mage,spellId){
  mageEnsureSpellState(mage);
  return mage.memorizedSpellIds.filter(id=>id===spellId).length;
}

function mageCanCastMemorizedSpell(mage,spellId){
  return isMageCharacter(mage) && mageMemorizedCount(mage,spellId)>0;
}

function mageSchoolAllowed(mage,spell){
  if(!mage?.specialization) return true;

  const specialist=WIZARD_SPECIALIST_SCHOOLS[mage.specialization];
  if(!specialist) return true;

  const school=wizardSchoolForSpell(spell);
  if(school==="Lesser Divination") return true;

  return !specialist.oppositionSchools.includes(school);
}

function mageLearningChance(mage,spell){
  let chance=mageIntelligenceData(mage?.stats?.int).chanceToLearn;

  if(mage?.specialization){
    const specialist=WIZARD_SPECIALIST_SCHOOLS[mage.specialization];
    if(specialist){
      const school=wizardSchoolForSpell(spell);
      if(school===specialist.school){
        chance+=15;
      }else if(school!=="Lesser Divination"){
        chance-=15;
      }
    }
  }

  return clamp(chance,0,100);
}

function mageCanLearnSpell(mage,spellId){
  mageEnsureSpellState(mage);
  const spell=getSpellEntry(spellId);

  if(!isMageCharacter(mage)) return {ok:false,reason:"Character is not a Mage."};
  if(!spell || spell.spellGroup!=="Wizard") return {ok:false,reason:"Not a Wizard spell."};
  if(mage.knownSpellIds.includes(spellId)) return {ok:false,reason:"Spell is already known."};
  if(!mageSchoolAllowed(mage,spell)) return {ok:false,reason:"Spell belongs to an opposition school."};

  const maxSpellLevel=mageMaximumSpellLevel(mage);
  if(spell.level>maxSpellLevel){
    return {ok:false,reason:`Mage can currently learn/cast only through spell level ${maxSpellLevel}.`};
  }

  const failedAt=Number(mage.failedSpellLearning[spellId]);
  if(Number.isFinite(failedAt) && (mage.level||1)<=failedAt){
    return {ok:false,reason:`Previous learning attempt failed at character level ${failedAt}; retry after gaining a level.`};
  }

  const limit=mageIntelligenceData(mage.stats?.int).maxSpellsPerLevel;
  if(Number.isFinite(limit) && mageKnownSpellCountAtLevel(mage,spell.level)>=limit){
    return {ok:false,reason:`Intelligence limit reached for ${spell.level}${spell.level===1?"st":spell.level===2?"nd":spell.level===3?"rd":"th"}-level spells.`};
  }

  return {ok:true,reason:"Eligible to attempt learning."};
}

function mageAttemptLearnSpell(mage,spellId,forcedRoll=null){
  const eligibility=mageCanLearnSpell(mage,spellId);
  if(!eligibility.ok){
    return {...eligibility,learned:false,roll:null,chance:null};
  }

  const spell=getSpellEntry(spellId);
  const chance=mageLearningChance(mage,spell);
  const roll=Number.isFinite(Number(forcedRoll))
    ? clamp(Math.floor(Number(forcedRoll)),1,100)
    : d(100);
  const learned=roll<=chance;

  if(learned){
    mage.knownSpellIds.push(spellId);
    delete mage.failedSpellLearning[spellId];
  }else{
    mage.failedSpellLearning[spellId]=mage.level||1;
  }

  return {
    ok:true,
    learned,
    roll,
    chance,
    spellId,
    reason:learned ? "Spell learned and entered into the spell book." : "Learning failed; retry is locked until the next character level."
  };
}

function mageCanReceiveStartingSpell(mage,spellId){
  mageEnsureSpellState(mage);
  const spell=getSpellEntry(spellId);

  if(!isMageCharacter(mage)) return {ok:false,reason:"Character is not a Mage."};
  if(!spell || spell.spellGroup!=="Wizard") return {ok:false,reason:"Not a Wizard spell."};
  if(mage.knownSpellIds.includes(spellId)) return {ok:true,reason:"Spell is already known."};
  if(!mageSchoolAllowed(mage,spell)) return {ok:false,reason:"Spell belongs to an opposition school."};

  const maxSpellLevel=mageMaximumSpellLevel(mage);
  if(spell.level>maxSpellLevel){
    return {ok:false,reason:`Starting spell is above current maximum spell level ${maxSpellLevel}.`};
  }

  const limit=mageIntelligenceData(mage.stats?.int).maxSpellsPerLevel;
  if(Number.isFinite(limit) && mageKnownSpellCountAtLevel(mage,spell.level)>=limit){
    return {ok:false,reason:`Intelligence limit reached for spell level ${spell.level}.`};
  }

  return {ok:true,reason:"Eligible as a DM/campaign-assigned spell-book entry."};
}

function mageAddKnownSpell(mage,spellId,{ignoreLearningRoll=false,ignoreLimits=false}={}){
  mageEnsureSpellState(mage);
  const spell=getSpellEntry(spellId);
  if(!spell || spell.spellGroup!=="Wizard") return false;
  if(mage.knownSpellIds.includes(spellId)) return true;

  const eligibility=ignoreLearningRoll
    ? mageCanReceiveStartingSpell(mage,spellId)
    : mageCanLearnSpell(mage,spellId);

  if(!ignoreLimits && !eligibility.ok) return false;
  if(ignoreLimits && !mageSchoolAllowed(mage,spell)) return false;

  mage.knownSpellIds.push(spellId);
  delete mage.failedSpellLearning[spellId];
  return true;
}

function mageAvailableSpellSlots(mage){
  const base=mageBaseSpellSlots(mage);
  return base.map((count,index)=>
    Math.max(0,count-mageMemorizedCountAtLevel(mage,index+1))
  );
}

function mageStudyMinutesForSpellIds(spellIds){
  return (spellIds || []).reduce((minutes,id)=>{
    const spell=getSpellEntry(id);
    return minutes+(spell ? spell.level*MAGE_CLASS.studyMinutesPerSpellLevel : 0);
  },0);
}

function mageStudySpells(mage,spellIds,{rested=false,hasSpellbook=true}={}){
  mageEnsureSpellState(mage);
  const requested=Array.isArray(spellIds) ? [...spellIds] : [];

  if(!isMageCharacter(mage)) return {ok:false,reason:"Character is not a Mage."};
  if(!rested) return {ok:false,reason:"A rested mind is required before spell study."};
  if(!hasSpellbook) return {ok:false,reason:"Spell book access is required for memorization."};
  if(!requested.length) return {ok:true,memorized:[],studyMinutes:0};

  const available=mageAvailableSpellSlots(mage);
  const additionsByLevel=Array(9).fill(0);

  for(const spellId of requested){
    const spell=getSpellEntry(spellId);
    if(!spell || !mage.knownSpellIds.includes(spellId)){
      return {ok:false,reason:`${spell?.name || spellId} is not recorded in the Mage's spell book.`};
    }

    if(!mageSchoolAllowed(mage,spell)){
      return {ok:false,reason:`${spell.name} is in an opposition school.`};
    }

    if(spell.level>mageMaximumSpellLevel(mage)){
      return {ok:false,reason:`${spell.name} is above the Mage's current maximum spell level.`};
    }

    additionsByLevel[spell.level-1]++;
    if(additionsByLevel[spell.level-1]>available[spell.level-1]){
      return {ok:false,reason:`Not enough open ${spell.level}-level memorization slots.`};
    }
  }

  mage.memorizedSpellIds.push(...requested);

  return {
    ok:true,
    memorized:requested,
    studyMinutes:mageStudyMinutesForSpellIds(requested),
    remainingSlots:mageAvailableSpellSlots(mage)
  };
}

function mageConsumeMemorizedSpell(mage,spellId){
  mageEnsureSpellState(mage);
  const index=mage.memorizedSpellIds.indexOf(spellId);
  if(index<0) return false;
  mage.memorizedSpellIds.splice(index,1);
  return true;
}

function nonWarriorConHpAdjustment(score){
  return Math.min(2,conHpAdjustment(score));
}

function applyMageClassRules(mage){
  if(!mage) return mage;
  mageEnsureSpellState(mage);

  const row=mageLevelData(mage.level);
  mage.classId=MAGE_CLASS.id;
  mage.className=MAGE_CLASS.name;
  mage.classGroup=MAGE_CLASS.group;
  mage.ruleset=RULESET.name;
  mage.primeRequisite=MAGE_CLASS.primeRequisite;
  mage.primeRequisiteXpBonus=(mage.stats?.int||0)>=MAGE_CLASS.primeRequisiteXpBonusThreshold;
  mage.thaco=row.thaco;
  mage.saves=mageSavingThrows(mage.level);
  mage.weaponProficiencySlots=row.wp;
  mage.nonweaponProficiencySlots=row.nwp;
  mage.weaponNonproficiencyPenalty=MAGE_CLASS.weaponNonproficiencyPenalty;
  mage.allowedArmor=MAGE_CLASS.armor;
  mage.allowedShields=MAGE_CLASS.shields;
  mage.allowedWeapons=[...MAGE_CLASS.weapons];
  mage.maxSpellLevel=mageMaximumSpellLevel(mage);
  mage.spellSlots=mageBaseSpellSlots(mage);
  mage.spellImmunity=mageIntelligenceData(mage.stats?.int).spellImmunity;
  mage.xpBonusPercent=mage.primeRequisiteXpBonus ? 10 : 0;
  mage.canPenMagicalScrolls=(mage.level||1)>=MAGE_CLASS.scrollPotionCreationLevel;
  mage.canBrewPotions=(mage.level||1)>=MAGE_CLASS.scrollPotionCreationLevel;
  mage.canResearchSpells=!!MAGE_CLASS.canResearchSpells;
  mage.specialFollowersFromStronghold=!!MAGE_CLASS.strongholdSpecialFollowers;
  return mage;
}

function makeMageCharacter({
  name="Mage",
  race="Human",
  level=1,
  xp=null,
  stats=null,
  knownSpellIds=[],
  memorizedSpellIds=[]
}={}){
  const mageStats=stats ? {...stats} : {
    str:roll3d6(),
    dex:roll3d6(),
    con:roll3d6(),
    int:roll3d6(),
    wis:roll3d6(),
    cha:roll3d6()
  };

  if(!stats){
    while(mageStats.int<MAGE_CLASS.minimumIntelligence){
      mageStats.int=roll3d6();
    }
  }

  const eligibility=mageClassEligibility({race,stats:mageStats});
  if(!eligibility.ok){
    throw new Error(eligibility.reason);
  }

  race=eligibility.race;

  const mageLevel=clamp(Math.floor(Number(level)||1),1,20);
  const conAdj=nonWarriorConHpAdjustment(mageStats.con);
  let maxHp=0;

  for(let current=1;current<=Math.min(mageLevel,10);current++){
    maxHp+=Math.max(1,d(MAGE_CLASS.hitDie)+conAdj);
  }

  if(mageLevel>10){
    maxHp+=(mageLevel-10)*MAGE_CLASS.hpPerLevelAfterHitDice;
  }

  const mage={
    id:`mage-${Date.now()}`,
    type:"mage",
    classId:MAGE_CLASS.id,
    className:MAGE_CLASS.name,
    classGroup:MAGE_CLASS.group,
    specialization:null,
    name,
    race,
    alignment:"neutral",
    level:mageLevel,
    xp:(xp!==null && xp!==undefined && Number.isFinite(Number(xp))) ? Number(xp) : mageLevelData(mageLevel).xp,
    stats:mageStats,
    hp:maxHp,
    maxHp,
    ac:10,
    thaco:mageThaco(mageLevel),
    move:12,
    halfMove:6,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    inventory:[],
    knownSpellIds:[],
    memorizedSpellIds:[],
    failedSpellLearning:{},
    weapon:"Unarmed",
    weaponBaseName:"Unarmed",
    weaponDamageSM:"1d2",
    weaponDamageL:"1d2",
    attackBonus:0,
    damageBonus:0,
    facing:"right",
    facingHex:0
  };

  applyMageClassRules(mage);
  mage.ac=calculateArmorClass(mage);

  for(const spellId of knownSpellIds){
    mageAddKnownSpell(mage,spellId,{ignoreLearningRoll:true});
  }

  for(const spellId of memorizedSpellIds){
    if(mage.knownSpellIds.includes(spellId)){
      const spell=getSpellEntry(spellId);
      const slots=mageBaseSpellSlots(mage);
      if(spell && mageMemorizedCountAtLevel(mage,spell.level)<slots[spell.level-1]){
        mage.memorizedSpellIds.push(spellId);
      }
    }
  }

  return mage;
}

function levelUpMage(mage){
  if(!isMageCharacter(mage) || mage.level>=20) return null;

  mage.level++;
  let hpGain=0;

  if(mage.level<=10){
    hpGain=Math.max(1,d(MAGE_CLASS.hitDie)+nonWarriorConHpAdjustment(mage.stats?.con||10));
  }else{
    hpGain=MAGE_CLASS.hpPerLevelAfterHitDice;
  }

  mage.maxHp+=hpGain;
  mage.hp=Math.min(mage.maxHp,mage.hp+hpGain);
  applyMageClassRules(mage);

  return {
    level:mage.level,
    hpGain,
    row:mageLevelData(mage.level),
    failedLearningLocksNowRetryable:Object.entries(mage.failedSpellLearning)
      .filter(([,failedAt])=>Number(failedAt)<mage.level)
      .map(([spellId])=>spellId)
  };
}

function awardMageXp(mage,baseXp){
  if(!isMageCharacter(mage) || !Number.isFinite(Number(baseXp)) || Number(baseXp)<=0){
    return null;
  }

  const raw=Math.floor(Number(baseXp));
  const bonus=mage.stats?.int>=MAGE_CLASS.primeRequisiteXpBonusThreshold
    ? Math.round(raw*0.10)
    : 0;

  mage.xp+=raw+bonus;
  const gained=[];

  while(mage.level<20 && mage.xp>=mageLevelData(mage.level+1).xp){
    const result=levelUpMage(mage);
    if(result) gained.push(result);
  }

  return {baseXp:raw,bonus,total:raw+bonus,newXp:mage.xp,levels:gained};
}

function mageCanEquipItem(mage,item){
  if(!isMageCharacter(mage) || !item) return false;
  if(item.slot==="armor" || item.slot==="shield") return false;

  if(item.type==="Weapon" || item.slot==="weapon" || item.slot==="backup-weapon"){
    const name=String(item.baseName || item.name || "").toLowerCase();
    return MAGE_CLASS.weapons.some(allowed=>
      name.includes(allowed.toLowerCase())
    );
  }

  return true;
}

/* Public development API: Character Generation and future tests can consume
   the Mage subsystem without reaching into implementation details. */
window.AdventurePartyMageSystem={
  classRules:MAGE_CLASS,
  levels:MAGE_LEVELS,
  intelligence:MAGE_INTELLIGENCE_TABLE,
  specialists:WIZARD_SPECIALIST_SCHOOLS,
  makeMageCharacter,
  mageClassEligibility,
  canonicalMageRace,
  applyMageClassRules,
  mageLevelData,
  mageIntelligenceData,
  wizardSchoolForSpell,
  mageSavingThrows,
  mageMaximumSpellLevel,
  mageBaseSpellSlots,
  mageAvailableSpellSlots,
  mageCanLearnSpell,
  mageCanReceiveStartingSpell,
  mageAttemptLearnSpell,
  mageAddKnownSpell,
  mageStudySpells,
  mageStudyMinutesForSpellIds,
  mageMemorizedCount,
  mageCanCastMemorizedSpell,
  mageConsumeMemorizedSpell,
  levelUpMage,
  awardMageXp,
  mageCanEquipItem
};

/* ============================================================
   R136 — STANDARD AD&D 2E CLERIC FOUNDATION
   ------------------------------------------------------------
   This defines the class for Character Generation / future party units.
   It does not add a Cleric to the current combat-test party and does not
   invent priest spells that are not yet in Adventure Party's spell catalog.
   ============================================================ */

const CLERIC_CLASS={
  id:"cleric",
  name:"Cleric",
  group:"Priest",
  minimumWisdom:9,
  primeRequisite:"Wisdom",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:["All"],
  alignments:"Any alignment acceptable to the deity/mythos",

  hitDie:8,
  hitDiceThroughLevel:9,
  hpPerLevelAfterHitDice:2,

  armor:"Any armor",
  shields:"Any shield",
  weapons:"Blunt / bludgeoning weapons only for the standard Cleric",

  initialWeaponProficiencies:2,
  weaponProficiencyRate:4,
  weaponNonproficiencyPenalty:-3,
  initialNonweaponProficiencies:4,
  nonweaponProficiencyRate:3,

  spellLevels:7,
  majorSpheres:[
    "All","Astral","Charm","Combat","Creation","Divination",
    "Guardian","Healing","Necromantic","Protection","Summoning","Sun"
  ],
  minorSpheres:["Elemental"],
  excludedSpheres:["Animal","Plant","Weather"],

  canTurnUndead:true,
  turningAttemptsPerEncounter:1,
  turningAffectedDice:"2d6",
  evilPriestPower:"Command undead instead of turning them",
  followerLevel:8,
  followerRequirement:"Establish a place of worship of significant size",
  strongholdApprovalLevel:9,
  baseMovement:12
};

const CLERIC_XP_LEVELS=[
  0,1500,3000,6000,13000,27500,55000,110000,225000,450000,
  675000,900000,1125000,1350000,1575000,1800000,2025000,
  2250000,2475000,2700000
];

const CLERIC_SPELL_SLOT_ROWS=[
  [1,0,0,0,0,0,0],
  [2,0,0,0,0,0,0],
  [2,1,0,0,0,0,0],
  [3,2,0,0,0,0,0],
  [3,3,1,0,0,0,0],
  [3,3,2,0,0,0,0],
  [3,3,2,1,0,0,0],
  [3,3,3,2,0,0,0],
  [4,4,3,2,1,0,0],
  [4,4,3,3,2,0,0],
  [5,4,4,3,2,1,0],
  [6,5,5,3,2,2,0],
  [6,6,6,4,2,2,0],
  [6,6,6,5,3,2,1],
  [6,6,6,6,4,2,1],
  [7,7,7,6,4,3,1],
  [7,7,7,7,5,3,2],
  [8,8,8,8,6,4,2],
  [9,9,8,8,6,4,2],
  [9,9,9,8,7,5,2]
];

const PRIEST_SAVING_THROW_BANDS=[
  {min:1,max:3,death:10,wand:14,poly:13,breath:16,spell:15},
  {min:4,max:6,death:9,wand:13,poly:12,breath:15,spell:14},
  {min:7,max:9,death:7,wand:11,poly:10,breath:13,spell:12},
  {min:10,max:12,death:6,wand:10,poly:9,breath:12,spell:11},
  {min:13,max:15,death:5,wand:9,poly:8,breath:11,spell:10},
  {min:16,max:18,death:4,wand:8,poly:7,breath:10,spell:9},
  {min:19,max:Infinity,death:2,wand:6,poly:5,breath:8,spell:7}
];

function savingThrowsFromBands(level,bands){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  const row=bands.find(row=>lvl>=row.min && lvl<=row.max) || bands[bands.length-1];
  return {death:row.death,wand:row.wand,poly:row.poly,breath:row.breath,spell:row.spell};
}

function clericSavingThrows(level){
  return savingThrowsFromBands(level,PRIEST_SAVING_THROW_BANDS);
}

function clericThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return Math.max(8,20-(Math.floor((lvl-1)/3)*2));
}

function clericWeaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return CLERIC_CLASS.initialWeaponProficiencies+
    Math.floor((lvl-1)/CLERIC_CLASS.weaponProficiencyRate);
}

function clericNonweaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return CLERIC_CLASS.initialNonweaponProficiencies+
    Math.floor((lvl-1)/CLERIC_CLASS.nonweaponProficiencyRate);
}

const CLERIC_LEVELS=Array.from({length:20},(_,index)=>{
  const level=index+1;
  return {
    level,
    xp:CLERIC_XP_LEVELS[index],
    thaco:clericThaco(level),
    hd:level<=9 ? `${level}d8` : `9d8 + ${(level-9)*2}`,
    wp:clericWeaponProficiencySlots(level),
    nwp:clericNonweaponProficiencySlots(level),
    spellSlots:[...CLERIC_SPELL_SLOT_ROWS[index]]
  };
});

function clericLevelData(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return CLERIC_LEVELS[lvl-1];
}

function clericBaseSpellSlots(clericOrLevel,wisdom=null){
  const level=typeof clericOrLevel==="object"
    ? Number(clericOrLevel?.level)||1
    : Number(clericOrLevel)||1;
  const wis=wisdom!==null
    ? Number(wisdom)
    : Number(clericOrLevel?.stats?.wis ?? 18);
  const slots=[...clericLevelData(level).spellSlots];

  /* PHB Table 24 footnotes: 6th-level priest spells require WIS 17;
     7th-level priest spells require WIS 18. */
  if(wis<17) slots[5]=0;
  if(wis<18) slots[6]=0;
  return slots;
}

function clericClassEligibility({race="Human",alignment="true-neutral",stats={},deityAlignments=null}={}){
  if((Number(stats.wis)||0)<CLERIC_CLASS.minimumWisdom){
    return {ok:false,reason:`Cleric requires Wisdom ${CLERIC_CLASS.minimumWisdom}.`};
  }
  if(!isValidAlignment(alignment)){
    return {ok:false,reason:"Cleric requires one of the nine standard alignments."};
  }
  if(!classAllowsAlignment("cleric",alignment,{deityAlignments})){
    return {ok:false,reason:"That alignment is not permitted by the selected deity/mythos."};
  }
  return {ok:true,race:String(race||"Human"),alignment:normalizeAlignmentId(alignment)};
}

function applyClericClassRules(cleric){
  if(!cleric) return cleric;
  const row=clericLevelData(cleric.level);
  cleric.classId=CLERIC_CLASS.id;
  cleric.className=CLERIC_CLASS.name;
  cleric.classGroup=CLERIC_CLASS.group;
  cleric.ruleset=RULESET.name;
  cleric.primeRequisite=CLERIC_CLASS.primeRequisite;
  cleric.primeRequisiteXpBonus=(cleric.stats?.wis||0)>=CLERIC_CLASS.primeRequisiteXpBonusThreshold;
  cleric.xpBonusPercent=cleric.primeRequisiteXpBonus ? 10 : 0;
  cleric.thaco=row.thaco;
  cleric.saves=clericSavingThrows(cleric.level);
  cleric.weaponProficiencySlots=row.wp;
  cleric.nonweaponProficiencySlots=row.nwp;
  cleric.weaponNonproficiencyPenalty=CLERIC_CLASS.weaponNonproficiencyPenalty;
  cleric.allowedArmor=CLERIC_CLASS.armor;
  cleric.allowedShields=CLERIC_CLASS.shields;
  cleric.allowedWeapons=CLERIC_CLASS.weapons;
  cleric.spellSlots=clericBaseSpellSlots(cleric);
  cleric.canTurnUndead=!!CLERIC_CLASS.canTurnUndead && alignmentData(cleric.alignment)?.morality!=="evil";
  cleric.canCommandUndead=alignmentData(cleric.alignment)?.morality==="evil";
  cleric.followerEligible=(cleric.level||1)>=CLERIC_CLASS.followerLevel;
  cleric.strongholdApprovalEligible=(cleric.level||1)>=CLERIC_CLASS.strongholdApprovalLevel;
  return cleric;
}

function makeClericCharacter({
  name="Cleric",
  race="Human",
  alignment="true-neutral",
  level=1,
  xp=null,
  stats=null,
  deityAlignments=null
}={}){
  const clericStats=stats ? {...stats} : {
    str:roll3d6(),dex:roll3d6(),con:roll3d6(),int:roll3d6(),wis:roll3d6(),cha:roll3d6()
  };

  if(!stats){
    while(clericStats.wis<CLERIC_CLASS.minimumWisdom){
      clericStats.wis=roll3d6();
    }
  }

  const eligibility=clericClassEligibility({race,alignment,stats:clericStats,deityAlignments});
  if(!eligibility.ok) throw new Error(eligibility.reason);

  const clericLevel=clamp(Math.floor(Number(level)||1),1,20);
  const conAdj=nonWarriorConHpAdjustment(clericStats.con);
  let maxHp=0;
  for(let current=1;current<=Math.min(clericLevel,9);current++){
    maxHp+=Math.max(1,d(CLERIC_CLASS.hitDie)+conAdj);
  }
  if(clericLevel>9){
    maxHp+=(clericLevel-9)*CLERIC_CLASS.hpPerLevelAfterHitDice;
  }

  const cleric={
    id:`cleric-${Date.now()}`,
    type:"cleric",
    classId:CLERIC_CLASS.id,
    className:CLERIC_CLASS.name,
    classGroup:CLERIC_CLASS.group,
    name,
    race:eligibility.race,
    alignment:eligibility.alignment,
    deityAlignments:Array.isArray(deityAlignments) ? [...deityAlignments] : null,
    level:clericLevel,
    xp:(xp!==null && xp!==undefined && Number.isFinite(Number(xp))) ? Number(xp) : clericLevelData(clericLevel).xp,
    stats:clericStats,
    hp:maxHp,maxHp,
    ac:10,
    thaco:clericThaco(clericLevel),
    move:12,halfMove:6,
    alive:true,fled:false,buffs:[],debuffs:[],inventory:[],
    weapon:"Staff",weaponBaseName:"Staff",weaponCatalogId:"staff",
    weaponDamageSM:"1d6",weaponDamageL:"1d6",
    attackBonus:0,damageBonus:0,
    facing:"right",facingHex:0,
    memorizedPriestSpellIds:[]
  };

  applyClericClassRules(cleric);
  cleric.ac=calculateArmorClass(cleric);
  return cleric;
}

function clericCanEquipItem(cleric,item){
  if(!cleric || !item) return false;
  if(item.slot==="armor" || item.slot==="shield") return true;

  if(item.type==="Weapon" || item.slot==="weapon" || item.slot==="backup-weapon"){
    const weaponId=item.weaponCatalogId || item.catalogWeaponId || item.id;
    if(weaponId && weaponAttackTypesForId(weaponId).includes("B")) return true;
    const name=String(item.baseName || item.name || "").toLowerCase();
    return ["club","flail","hammer","mace","morning star","staff","sling"]
      .some(allowed=>name.includes(allowed));
  }
  return true;
}

window.AdventurePartyClericSystem={
  classRules:CLERIC_CLASS,
  levels:CLERIC_LEVELS,
  spellSlots:CLERIC_SPELL_SLOT_ROWS,
  savingThrowBands:PRIEST_SAVING_THROW_BANDS,
  makeClericCharacter,
  clericClassEligibility,
  applyClericClassRules,
  clericLevelData,
  clericThaco,
  clericSavingThrows,
  clericBaseSpellSlots,
  clericCanEquipItem
};

const THIEF_CLASS={
  name:"Thief",
  group:"Rogue",
  minimumDexterity:9,
  primeRequisite:"Dexterity",
  primeRequisiteXpBonusThreshold:16,
  racesAllowed:"All",
  alignments:"Any except lawful good",

  hitDie:6,
  hitDiceThroughLevel:10,
  hpPerLevelAfterHitDice:2,

  armor:"Leather, studded leather, padded leather, or elven chain",
  shields:"No shield listed for Thief class use",
  weapons:[
    "Club","Dagger","Dart","Hand Crossbow","Knife","Lasso",
    "Short Bow","Sling","Broad Sword","Long Sword","Short Sword","Staff"
  ],

  initialWeaponProficiencies:2,
  weaponProficiencyRate:4,
  weaponNonproficiencyPenalty:-3,
  initialNonweaponProficiencies:3,
  nonweaponProficiencyRate:4,

  initialDiscretionarySkillPoints:60,
  initialMaxPerSkill:30,
  levelSkillPoints:30,
  levelMaxPerSkill:15,
  skillCap:95,

  thievingSkillBaseScores:{
    "Pick Pockets":15,
    "Open Locks":10,
    "Find/Remove Traps":5,
    "Move Silently":10,
    "Hide in Shadows":5,
    "Detect Noise":15,
    "Climb Walls":60,
    "Read Languages":0
  },

  backstabAttackBonus:4,
  backstabRequirement:"Behind the victim and victim unaware of the intended attack",
  backstabLimits:"First qualifying attack only; generally humanoid target with a definable back and reachable significant target area",

  readScrollsLevel:10,
  readScrollMisreadChance:25
};

const ROGUE_SAVING_THROW_BANDS=[
  {min:1,max:4,death:13,wand:14,poly:12,breath:16,spell:15},
  {min:5,max:8,death:12,wand:12,poly:11,breath:15,spell:13},
  {min:9,max:12,death:11,wand:10,poly:10,breath:14,spell:11},
  {min:13,max:16,death:10,wand:8,poly:9,breath:13,spell:9},
  {min:17,max:20,death:9,wand:6,poly:8,breath:12,spell:7},
  {min:21,max:Infinity,death:8,wand:4,poly:7,breath:11,spell:5}
];

function rogueSavingThrows(level){
  return savingThrowsFromBands(level,ROGUE_SAVING_THROW_BANDS);
}

function rogueThaco(level){
  const lvl=clamp(Math.floor(Number(level)||1),1,20);
  return 20-Math.floor((lvl-1)/2);
}

function rogueWeaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return THIEF_CLASS.initialWeaponProficiencies+
    Math.floor((lvl-1)/THIEF_CLASS.weaponProficiencyRate);
}

function rogueNonweaponProficiencySlots(level){
  const lvl=Math.max(1,Math.floor(Number(level)||1));
  return THIEF_CLASS.initialNonweaponProficiencies+
    Math.floor((lvl-1)/THIEF_CLASS.nonweaponProficiencyRate);
}


const EQUIPMENT_DATA_SOURCE={
  title:"OSRIC 2.2",
  scope:"mundane weapons, missile weapons/ammunition, armour and shields",
  pdfPages:[45,46]
};

const WEAPON_CATALOG={
  "arrows":{id:"arrows",name:"Arrows",kind:"ammo",damageSM:"1d6",damageL:"1d6",encumbrance:4,cost:"2 gp per dozen"},
  "axe-battle":{id:"axe-battle",name:"Axe, battle",kind:"weapon",damageSM:"1d8",damageL:"1d8",encumbrance:7,cost:"5 gp"},
  "axe-hand":{id:"axe-hand",name:"Axe, hand",kind:"weapon",damageSM:"1d6",damageL:"1d4",encumbrance:5,cost:"1 gp"},
  "bolt-heavy":{id:"bolt-heavy",name:"Bolt, heavy crossbow",kind:"ammo",damageSM:"1d6+1",damageL:"1d6+1",encumbrance:4,cost:"4 gp per dozen"},
  "bolt-light":{id:"bolt-light",name:"Bolt, light crossbow",kind:"ammo",damageSM:"1d4+1",damageL:"1d4+1",encumbrance:2,cost:"2 gp per dozen"},
  "club":{id:"club",name:"Club",kind:"weapon",damageSM:"1d4",damageL:"1d3",encumbrance:3,cost:"2 cp"},
  "dagger":{id:"dagger",name:"Dagger",kind:"weapon",damageSM:"1d4",damageL:"1d3",encumbrance:1,cost:"2 gp"},
  "dart":{id:"dart",name:"Dart",kind:"weapon",damageSM:"1d3",damageL:"1d2",encumbrance:0.5,cost:"2 sp"},
  "flail-heavy":{id:"flail-heavy",name:"Flail, heavy",kind:"weapon",damageSM:"1d6+1",damageL:"2d4",encumbrance:10,cost:"3 gp"},
  "flail-light":{id:"flail-light",name:"Flail, light",kind:"weapon",damageSM:"1d4+1",damageL:"1d4+1",encumbrance:4,cost:"6 gp"},
  "halberd":{id:"halberd",name:"Halberd",kind:"weapon",damageSM:"1d10",damageL:"2d6",encumbrance:18,cost:"9 gp"},
  "hammer-war-heavy":{id:"hammer-war-heavy",name:"Hammer, war, heavy",kind:"weapon",damageSM:"1d6+1",damageL:"1d6",encumbrance:10,cost:"7 gp"},
  "hammer-war-light":{id:"hammer-war-light",name:"Hammer, war, light",kind:"weapon",damageSM:"1d4+1",damageL:"1d4",encumbrance:5,cost:"1 gp"},
  "javelin":{id:"javelin",name:"Javelin",kind:"weapon",damageSM:"1d6",damageL:"1d4",encumbrance:4,cost:"5 sp",setAgainstCharge:true},
  "lance":{id:"lance",name:"Lance",kind:"weapon",damageSM:"2d4+1",damageL:"3d6",encumbrance:15,cost:"6 gp",setAgainstCharge:true,mountedCharge:true},
  "mace-heavy":{id:"mace-heavy",name:"Mace, heavy",kind:"weapon",damageSM:"1d6+1",damageL:"1d6",encumbrance:10,cost:"10 gp"},
  "mace-light":{id:"mace-light",name:"Mace, light",kind:"weapon",damageSM:"1d4+1",damageL:"1d4+1",encumbrance:5,cost:"4 gp"},
  "morning-star":{id:"morning-star",name:"Morning star",kind:"weapon",damageSM:"2d4",damageL:"1d6+1",encumbrance:12,cost:"5 gp"},
  "pick-heavy":{id:"pick-heavy",name:"Pick, heavy",kind:"weapon",damageSM:"1d6+1",damageL:"2d4",encumbrance:10,cost:"8 gp"},
  "pick-light":{id:"pick-light",name:"Pick, light",kind:"weapon",damageSM:"1d4+1",damageL:"1d4",encumbrance:4,cost:"5 gp"},
  "pole-arm":{id:"pole-arm",name:"Pole arm",kind:"weapon",damageSM:"1d6+1",damageL:"1d10",encumbrance:8,cost:"6 gp",setAgainstCharge:true},
  "sling-bullet":{id:"sling-bullet",name:"Sling bullet",kind:"ammo",damageSM:"1d4+1",damageL:"1d6+1",encumbrance:4,cost:"1 gp per dozen"},
  "sling-stone":{id:"sling-stone",name:"Sling stone",kind:"ammo",damageSM:"1d4",damageL:"1d4",encumbrance:2,cost:"Free"},
  "spear":{id:"spear",name:"Spear",kind:"weapon",damageSM:"1d6",damageL:"1d8",encumbrance:5,cost:"1 gp",setAgainstCharge:true},
  "staff":{id:"staff",name:"Staff",kind:"weapon",damageSM:"1d6",damageL:"1d6",encumbrance:5,cost:"Free"},
  "sword-bastard":{id:"sword-bastard",name:"Sword, claymore/bastard",kind:"weapon",damageSM:"2d4",damageL:"2d8",encumbrance:10,cost:"25 gp"},
  "sword-broad":{id:"sword-broad",name:"Sword, broad",kind:"weapon",damageSM:"2d4",damageL:"1d6+1",encumbrance:8,cost:"10 gp"},
  "sword-long":{id:"sword-long",name:"Sword, long",kind:"weapon",damageSM:"1d8",damageL:"1d12",encumbrance:7,cost:"15 gp"},
  "sword-scimitar":{id:"sword-scimitar",name:"Sword, scimitar",kind:"weapon",damageSM:"1d8",damageL:"1d8",encumbrance:5,cost:"15 gp"},
  "sword-short":{id:"sword-short",name:"Sword, short",kind:"weapon",damageSM:"1d6",damageL:"1d8",encumbrance:3,cost:"8 gp"},
  "sword-two-handed":{id:"sword-two-handed",name:"Sword, two-handed",kind:"weapon",damageSM:"1d10",damageL:"3d6",encumbrance:25,cost:"30 gp"},
  "trident":{id:"trident",name:"Trident",kind:"weapon",damageSM:"1d6+1",damageL:"3d4",encumbrance:5,cost:"4 gp",setAgainstCharge:true}
};

/*
  AD&D weapon attack-type metadata:
  B = Bludgeoning, P = Piercing, S = Slashing.

  Sweep specifically requires S. A mixed-type weapon such as a halberd
  may Sweep only by using its slashing mode; Adventure Party treats an
  automatic Sweep with such a weapon as a Slashing attack.

  The generic "pole-arm" catalog entry is intentionally left unclassified
  until it is replaced by a specific pole-arm weapon record.
*/
const WEAPON_ATTACK_TYPES={
  "arrows":["P"],
  "axe-battle":["S"],
  "axe-hand":["S"],
  "bolt-heavy":["P"],
  "bolt-light":["P"],
  "club":["B"],
  "dagger":["P"],
  "dart":["P"],
  "flail-heavy":["B"],
  "flail-light":["B"],
  "halberd":["P","S"],
  "hammer-war-heavy":["B"],
  "hammer-war-light":["B"],
  "javelin":["P"],
  "lance":["P"],
  "mace-heavy":["B"],
  "mace-light":["B"],
  "morning-star":["B"],
  "pick-heavy":["P"],
  "pick-light":["P"],
  "sling-bullet":["B"],
  "sling-stone":["B"],
  "spear":["P"],
  "staff":["B"],
  "sword-bastard":["S"],
  "sword-broad":["S"],
  "sword-long":["S"],
  "sword-scimitar":["S"],
  "sword-short":["P"],
  "sword-two-handed":["S"],
  "trident":["P"]
};

for(const [weaponId,attackTypes] of Object.entries(WEAPON_ATTACK_TYPES)){
  if(WEAPON_CATALOG[weaponId]){
    WEAPON_CATALOG[weaponId].attackTypes=[...attackTypes];
  }
}

function weaponAttackTypesForId(weaponId){
  return getWeaponCatalogEntry(weaponId)?.attackTypes || [];
}

function weaponSupportsAttackType(weaponId,attackType){
  return weaponAttackTypesForId(weaponId).includes(attackType);
}

function fighterHasSweepSlashingWeapon(fighter){
  if(!fighter?.weaponCatalogId){
    return false;
  }

  return weaponSupportsAttackType(
    fighter.weaponCatalogId,
    FIGHTER_CLASS.sweepRequiredAttackType
  );
}

const MISSILE_WEAPON_CATALOG={
  "axe-hand":{id:"axe-hand",name:"Axe, hand",damageSM:"1d6",damageL:"1d4",rateOfFire:1,rangeIncrementFt:10,encumbrance:5,cost:"1 gp",hurled:true,strengthDamageAllowed:true},
  "bow-long":{id:"bow-long",name:"Bow, long",damageSM:"1d6",damageL:"1d6",rateOfFire:2,rangeIncrementFt:70,encumbrance:12,cost:"60 gp",ammoId:"arrows"},
  "bow-short":{id:"bow-short",name:"Bow, short",damageSM:"1d6",damageL:"1d6",rateOfFire:2,rangeIncrementFt:50,encumbrance:8,cost:"15 gp",ammoId:"arrows"},
  "club":{id:"club",name:"Club",damageSM:"1d4",damageL:"1d3",rateOfFire:1,rangeIncrementFt:10,encumbrance:3,cost:"2 cp",hurled:true,strengthDamageAllowed:true},
  "bow-composite-long":{id:"bow-composite-long",name:"Composite bow, long",damageSM:"1d6",damageL:"1d6",rateOfFire:2,rangeIncrementFt:60,encumbrance:13,cost:"100 gp",ammoId:"arrows",specialStrengthBowPossible:true},
  "bow-composite-short":{id:"bow-composite-short",name:"Composite bow, short",damageSM:"1d6",damageL:"1d6",rateOfFire:2,rangeIncrementFt:50,encumbrance:9,cost:"75 gp",ammoId:"arrows",specialStrengthBowPossible:true},
  "crossbow-heavy":{id:"crossbow-heavy",name:"Crossbow, heavy",damageSM:"1d6+1",damageL:"1d6+1",rateOfFire:0.5,rangeIncrementFt:60,encumbrance:12,cost:"20 gp",ammoId:"bolt-heavy",horsebackAllowed:false},
  "crossbow-light":{id:"crossbow-light",name:"Crossbow, light",damageSM:"1d4+1",damageL:"1d4+1",rateOfFire:1,rangeIncrementFt:60,encumbrance:4,cost:"12 gp",ammoId:"bolt-light"},
  "dagger":{id:"dagger",name:"Dagger",damageSM:"1d4",damageL:"1d4",rateOfFire:2,rangeIncrementFt:10,encumbrance:1,cost:"2 gp",hurled:true,strengthDamageAllowed:true},
  "dart":{id:"dart",name:"Dart",damageSM:"1d3",damageL:"1d2",rateOfFire:3,rangeIncrementFt:15,encumbrance:0.5,cost:"2 sp",hurled:true,strengthDamageAllowed:true},
  "hammer":{id:"hammer",name:"Hammer",damageSM:"1d4+1",damageL:"1d4",rateOfFire:1,rangeIncrementFt:10,encumbrance:5,cost:"1 gp",hurled:true,strengthDamageAllowed:true},
  "javelin":{id:"javelin",name:"Javelin",damageSM:"1d6",damageL:"1d4",rateOfFire:1,rangeIncrementFt:20,encumbrance:2,cost:"5 sp",hurled:true,strengthDamageAllowed:true},
  "sling":{id:"sling",name:"Sling",rateOfFire:1,rangeIncrementFt:35,encumbrance:0.5,cost:"5 sp",ammoChoices:["sling-bullet","sling-stone"]},
  "spear":{id:"spear",name:"Spear",damageSM:"1d6",damageL:"1d8",rateOfFire:1,rangeIncrementFt:15,encumbrance:5,cost:"1 gp",hurled:true,strengthDamageAllowed:true}
};

const ARMOR_CATALOG={
  "banded":{id:"banded",name:"Banded",slot:"armor",encumbrance:35,maxMoveFt:90,acModifier:-6,baseArmorClass:4,cost:"90 gp"},
  "chain":{id:"chain",name:"Mail hauberk or byrnie (chain)",slot:"armor",encumbrance:30,maxMoveFt:90,acModifier:-5,baseArmorClass:5,cost:"75 gp"},
  "chain-elfin":{id:"chain-elfin",name:"Mail, elfin (chain)",slot:"armor",encumbrance:15,maxMoveFt:120,acModifier:-5,baseArmorClass:5,cost:"Not sold"},
  "leather":{id:"leather",name:"Leather",slot:"armor",encumbrance:15,maxMoveFt:120,acModifier:-2,baseArmorClass:8,cost:"5 gp"},
  "padded":{id:"padded",name:"Padded gambeson",slot:"armor",encumbrance:10,maxMoveFt:90,acModifier:-2,baseArmorClass:8,cost:"4 gp"},
  "plate":{id:"plate",name:"Plate",slot:"armor",encumbrance:45,maxMoveFt:60,acModifier:-7,baseArmorClass:3,cost:"400 gp"},
  "ring":{id:"ring",name:"Ring",slot:"armor",encumbrance:35,maxMoveFt:90,acModifier:-3,baseArmorClass:7,cost:"30 gp"},
  "scale":{id:"scale",name:"Scale or lamellar",slot:"armor",encumbrance:40,maxMoveFt:60,acModifier:-4,baseArmorClass:6,cost:"45 gp"},
  "splint":{id:"splint",name:"Splint",slot:"armor",encumbrance:40,maxMoveFt:60,acModifier:-6,baseArmorClass:4,cost:"80 gp"},
  "studded":{id:"studded",name:"Studded",slot:"armor",encumbrance:20,maxMoveFt:90,acModifier:-3,baseArmorClass:7,cost:"15 gp"},
  "shield-large":{id:"shield-large",name:"Shield, large",slot:"shield",encumbrance:10,acBonus:1,cost:"15 gp",rearProtection:false,maxProtectedAttacksPerRound:3},
  "shield-medium":{id:"shield-medium",name:"Shield, medium",slot:"shield",encumbrance:8,acBonus:1,cost:"12 gp",rearProtection:false,maxProtectedAttacksPerRound:2},
  "shield-small":{id:"shield-small",name:"Shield, small",slot:"shield",encumbrance:5,acBonus:1,cost:"10 gp",rearProtection:false,maxProtectedAttacksPerRound:1},
  "field-plate":{id:"field-plate",name:"Field plate (optional)",slot:"armor",maxMoveFt:90,acModifier:-8,baseArmorClass:2,optional:true},
  "full-plate":{id:"full-plate",name:"Full plate (optional)",slot:"armor",maxMoveFt:60,acModifier:-9,baseArmorClass:1,optional:true}
};

function getWeaponCatalogEntry(id){
  return id ? WEAPON_CATALOG[id] || null : null;
}

function getMissileCatalogEntry(id){
  return id ? MISSILE_WEAPON_CATALOG[id] || null : null;
}

function getArmorCatalogEntry(id){
  return id ? ARMOR_CATALOG[id] || null : null;
}

function targetUsesLargeWeaponDamage(target){
  return ["large","huge","gargantuan"].includes(target?.sizeCategory);
}

function damageExpressionForSize(entry,target){
  if(!entry) return "1d2";
  return targetUsesLargeWeaponDamage(target)
    ? (entry.damageL || entry.damageSM || "1d2")
    : (entry.damageSM || entry.damageL || "1d2");
}

function rollDiceExpression(expression){
  const expr=String(expression || "0").trim();
  const match=expr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);

  if(!match){
    const flat=Number(expr);
    return {expression:expr,total:Number.isFinite(flat) ? flat : 0};
  }

  const count=Number(match[1]);
  const sides=Number(match[2]);
  const modifier=match[3] ? Number(match[3]) : 0;

  let total=modifier;
  for(let i=0;i<count;i++){
    total+=d(sides);
  }

  return {expression:expr,total};
}

/* ============================================================
   SPELL CATALOG
   Magic Missile: AD&D 2nd Edition Player's Handbook, 1st-level wizard spell.
   ============================================================ */

const TACTICAL_FEET_PER_HEX=10;

const SPELL_CATALOG={
  "armor":{
    id:"armor",
    name:"Armor",
    spellGroup:"Wizard",
    level:1,
    school:"Conjuration",
    components:["V","S","M"],
    materialComponent:"A piece of finely cured leather blessed by a priest",
    duration:"Special",
    castingTime:"1 round",
    savingThrow:"None",
    areaOfEffect:"1 creature",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Defensive spell; grants AC 6 base if it improves the target.",
    description:"Creates a magical field of force equivalent to AC 6. It remains until dispelled or until the wearer sustains more than 8 + caster level points of cumulative damage.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:131,pdfPage:132}
  },

  "burning-hands":{
    id:"burning-hands",
    name:"Burning Hands",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    components:["V","S"],
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"1/2",
    areaOfEffect:"Caster; 5-foot-long, 120° fan",
    range:{type:"self"},
    combatImplemented:true,
    friendlyFire:true,
    targetMode:"direction",
    damageSummary:"1d3 + 2/caster level fire damage; maximum +20; save for half.",
    description:"A fan of searing flame projects from the caster's hands. The 10-foot hex map abstracts the 5-foot fan to the adjacent forward arc.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:131,pdfPage:132}
  },

  "chill-touch":{
    id:"chill-touch",
    name:"Chill Touch",
    spellGroup:"Wizard",
    level:1,
    school:"Necromancy",
    components:["V","S"],
    duration:"3 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"Caster",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Successful melee touch: 1d4 damage and Strength loss on failed save; special undead fear effect.",
    description:"The caster's hand glows with necromantic energy. Successful melee hits can inflict 1d4 damage and reduce Strength when the victim fails a save.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:132,pdfPage:133}
  },

  "color-spray":{
    id:"color-spray",
    name:"Color Spray",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    components:["V","S","M"],
    materialComponent:"A pinch each of red, yellow, and blue powder or sand",
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"5' × 20' × 20' wedge",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"direction",
    damageSummary:"No HP damage; affects 1d6 creatures with unconscious/blind/stunned results by HD.",
    description:"A fan-shaped spray affects up to 1d6 creatures nearest the caster. Results depend on target Hit Dice/level relative to caster level.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:132,pdfPage:133}
  },

  "enlarge":{
    id:"enlarge",
    name:"Enlarge",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    components:["V","S","M"],
    materialComponent:"A pinch of powdered iron",
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature or object",
    range:{baseYards:0,yardsPerCasterLevel:5},
    combatImplemented:true,
    targetMode:"creature",
    damageSummary:"Creature grows 10%/caster level; HP, AC, and attacks unchanged; weapon damage scales with size.",
    description:"Increases size and weight by up to 10% per caster level. Creature hit points, Armor Class, and attack rolls do not change, but damage rolls increase proportionally.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:133,pdfPage:134}
  },

  "grease":{
    id:"grease",
    name:"Grease",
    spellGroup:"Wizard",
    level:1,
    school:"Conjuration",
    components:["V","S","M"],
    materialComponent:"A bit of pork rind or butter",
    duration:"3 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"10' × 10' square",
    range:{fixedYards:10},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"No damage; creates a slippery hex that can knock creatures prone.",
    description:"Covers a surface with slippery grease. Creatures entering or caught in the area must save vs. spell or fall.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:135,pdfPage:136}
  },

  "light":{
    id:"light",
    name:"Light",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    components:["V","M"],
    materialComponent:"A firefly or a piece of phosphorescent moss",
    duration:"1 turn/level",
    castingTime:1,
    savingThrow:"Special",
    areaOfEffect:"20-foot-radius globe",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"creature",
    damageSummary:"Creates a 20-foot illumination radius; hostile creature can be blinded; −4 attacks/saves and AC worsened by 4.",
    description:"Creates torchlike light with a 20-foot illumination radius. When centered on a creature's visual organs, a failed save blinds it, penalizing attacks and saves by 4 and worsening AC by 4. The light source illuminates nearby battlefield terrain for the spell's duration.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:136,pdfPage:137}
  },

  "magic-missile":{
    id:"magic-missile",
    name:"Magic Missile",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    incantation:"Magicus Telum!",
    components:["V","S"],
    duration:"Instantaneous",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"1 or more creatures in a 10-foot cube",
    range:{baseYards:60,yardsPerCasterLevel:10},
    missileDamage:"1d4+1",
    maxMissiles:5,
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Each missile 1d4+1; missile count rises with caster level to 5 maximum.",
    description:"Creates magical energy missiles that automatically strike a seen or otherwise detected creature.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:136,pdfPage:137}
  },

  "protection-from-evil":{
    id:"protection-from-evil",
    name:"Protection From Evil",
    spellGroup:"Wizard",
    level:1,
    school:"Abjuration",
    components:["V","S","M"],
    materialComponent:"Powdered silver for the protective circle",
    duration:"2 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"touch-creature",
    damageSummary:"Buff: evil attackers suffer −2 to attack; target gains +2 saves against their attacks.",
    description:"Creates a protective barrier. The combat engine implements the attack-roll and saving-throw modifiers against evil creatures.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "shield":{
    id:"shield",
    name:"Shield",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    components:["V","S"],
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Special",
    range:{type:"self"},
    combatImplemented:true,
    targetMode:"self",
    damageSummary:"Front-facing defense: negates Magic Missile; AC 3 vs arrows/bolts/bullets, AC 4 vs other attacks.",
    description:"Creates an invisible frontal barrier. It totally negates Magic Missile, improves frontal Armor Class by attack type, and grants +1 to applicable frontal saving throws.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "shocking-grasp":{
    id:"shocking-grasp",
    name:"Shocking Grasp",
    spellGroup:"Wizard",
    level:1,
    school:"Alteration",
    components:["V","S"],
    duration:"Special",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Creature touched",
    range:{type:"touch"},
    combatImplemented:true,
    targetMode:"adjacent-hostile",
    damageSummary:"Touch attack; 1d8 + caster level electrical damage.",
    description:"Charges the caster's hand with electricity. The combat implementation resolves a normal raw-d20 physical touch attack and discharges on a hit.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:137,pdfPage:138}
  },

  "sleep":{
    id:"sleep",
    name:"Sleep",
    spellGroup:"Wizard",
    level:1,
    school:"Enchantment/Charm",
    components:["V","S","M"],
    materialComponent:"Fine sand, rose petals, or a live cricket",
    duration:"5 rounds/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"Special — 7-hex cluster (center + six adjacent hexes)",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"Affects 2d4 Hit Dice, lowest-HD creatures first; 4+3 HD or higher are immune.",
    description:"Places eligible creatures into magical sleep. Adventure Party uses a fixed symmetric 7-hex cluster: the aimed center hex plus its six adjacent hexes.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "spook":{
    id:"spook",
    name:"Spook",
    spellGroup:"Wizard",
    level:1,
    school:"Illusion/Phantasm",
    components:["V","S"],
    duration:"Special",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"1 creature within 30 feet",
    range:{fixedFeet:30},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed save forces target to flee; initial save penalty −1 per 2 caster levels, max −6.",
    description:"Plays upon natural fears. A failed save forces the target to flee; later rounds grant unpenalized saves.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "taunt":{
    id:"taunt",
    name:"Taunt",
    spellGroup:"Wizard",
    level:1,
    school:"Enchantment",
    components:["V","S","M"],
    materialComponent:"A slug",
    duration:"1 round",
    castingTime:1,
    savingThrow:"Neg.",
    areaOfEffect:"30-foot radius",
    range:{fixedYards:60},
    combatImplemented:true,
    targetMode:"hostile-creature",
    damageSummary:"Failed targets rush the caster and seek melee rather than missile/spell attacks.",
    description:"Provokes creatures of one selected type into furious melee against the caster. The engine applies it to the aimed creature's type within a 3-hex radius.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:138,pdfPage:139}
  },

  "wall-of-fog":{
    id:"wall-of-fog",
    name:"Wall of Fog",
    spellGroup:"Wizard",
    level:1,
    school:"Evocation",
    incantation:"Murus Nebula!",
    components:["V","S","M"],
    materialComponent:"A pinch of split dried peas",
    duration:"2d4 rounds + 1 round/level",
    castingTime:1,
    savingThrow:"None",
    areaOfEffect:"20' cube + 10' cube/level",
    range:{fixedYards:30},
    combatImplemented:true,
    targetMode:"ground",
    damageSummary:"No damage; creates a fog wall that blocks battlefield line of sight.",
    description:"Creates billowing mist that obscures sight beyond two feet. Adventure Party renders the spell as a wall: it extends along its normal geometry but terminates at solid walls, blocked architectural transitions, and the tactical map edge rather than flood-filling around obstacles. Its rendered cloud is 50% transparent for battlefield readability.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:139,pdfPage:140}
  },

  "fireball":{
    id:"fireball",
    name:"Fireball",
    spellGroup:"Wizard",
    level:3,
    school:"Evocation",
    incantation:"Ignis Sphaera!",
    components:["V","S","M"],
    materialComponent:"A tiny ball of bat guano and sulphur",
    duration:"Instantaneous",
    castingTime:3,
    savingThrow:"1/2",
    areaOfEffect:"20-foot radius",
    radiusFeet:20,
    range:{baseYards:10,yardsPerCasterLevel:10},
    damageDie:"1d6",
    damageDicePerCasterLevel:1,
    maxDamageDice:10,
    combatImplemented:true,
    volumetric:true,
    volumeModel:"architectural-flood-fill",
    friendlyFire:true,
    targetMode:"ground",
    damageSummary:"1d6/caster level fire damage, maximum 10d6; save for half.",
    description:"An explosive burst of flame. A successful saving throw vs. spell reduces damage by half. In enclosed spaces the blast volume is redirected by walls and spills through available openings instead of passing through solid architecture.",
    source:{book:"AD&D 2nd Edition Player's Handbook",printedPage:149,pdfPage:150}
  }
}

function getSpellEntry(id){
  return id ? SPELL_CATALOG[id] || null : null;
}

function pruneTransientUnitFx(now=performance.now()){
  castingGlowFx=castingGlowFx.filter(fx=>now<fx.until);
  fireDamageFx=fireDamageFx.filter(fx=>now<fx.until);
  enlargeTransitionFx=enlargeTransitionFx.filter(fx=>now<fx.until);
}

function hasTransientUnitFx(now=performance.now()){
  pruneTransientUnitFx(now);
  return (
    castingGlowFx.length>0 ||
    fireDamageFx.length>0 ||
    enlargeTransitionFx.length>0
  );
}

function transientUnitFxTick(){
  transientUnitFxFrame=null;

  if(
    currentScreen!=="combat" ||
    !game ||
    game.over ||
    !hasTransientUnitFx()
  ){
    return;
  }

  draw();
  transientUnitFxFrame=requestAnimationFrame(transientUnitFxTick);
}

function ensureTransientUnitFxLoop(){
  if(
    transientUnitFxFrame!==null ||
    currentScreen!=="combat" ||
    !game ||
    game.over ||
    !hasTransientUnitFx()
  ){
    return false;
  }

  transientUnitFxFrame=requestAnimationFrame(transientUnitFxTick);
  return true;
}

function triggerCastingGlow(caster,durationMs=1000){
  if(!caster?.id || !caster.alive || caster.fled) return false;

  const started=performance.now();
  /* R147: casting glow always runs one clean 1-second rise/fall cycle. */
  const duration=1000;

  castingGlowFx=castingGlowFx.filter(fx=>fx.unitId!==caster.id);
  castingGlowFx.push({
    unitId:caster.id,
    started,
    until:started+duration,
    duration
  });

  ensureTransientUnitFxLoop();
  return true;
}

function activeCastingGlowFx(unit){
  if(!unit?.id) return null;
  const now=performance.now();
  return castingGlowFx.find(fx=>fx.unitId===unit.id && now<fx.until) || null;
}

/*
  R193 Enlarge presentation.
  The logical footprint never changes: only the sprite render dimensions are
  interpolated. Feet/anchor stay planted on the same tactical hex.
*/
function triggerEnlargeTransition(
  unit,
  fromScale,
  toScale,
  direction="grow",
  durationMs=1000
){
  if(!unit?.id || !unit.alive || unit.fled) return false;

  const started=performance.now();
  const duration=Math.max(1,Number(durationMs)||1000);

  enlargeTransitionFx=enlargeTransitionFx.filter(fx=>fx.unitId!==unit.id);
  enlargeTransitionFx.push({
    unitId:unit.id,
    started,
    until:started+duration,
    duration,
    fromScale:Math.max(0.1,Number(fromScale)||1),
    toScale:Math.max(0.1,Number(toScale)||1),
    direction
  });

  playEnlargeTransitionSound(direction);
  ensureTransientUnitFxLoop();
  return true;
}

function activeEnlargeTransitionFx(unit){
  if(!unit?.id) return null;
  const now=performance.now();
  return enlargeTransitionFx.find(
    fx=>fx.unitId===unit.id && now<fx.until
  ) || null;
}

function enlargeVisualScale(unit){
  if(!unit) return 1;

  const transition=activeEnlargeTransitionFx(unit);
  if(transition){
    const now=performance.now();
    const raw=Math.max(
      0,
      Math.min(
        1,
        (now-transition.started)/Math.max(1,transition.duration)
      )
    );
    /* Smoothstep keeps the size change soft at both ends of the 1-second cue. */
    const eased=raw*raw*(3-2*raw);

    return (
      transition.fromScale+
      (transition.toScale-transition.fromScale)*eased
    );
  }

  const effect=getUnitEffect(unit,"enlarge");
  if(!effect) return 1;

  return Math.max(
    1,
    Number(effect.data?.sizeMultiplier) ||
    Number(effect.data?.damageMultiplier) ||
    1
  );
}

function triggerFireDamageFx(unit,damage=1){
  if(!unit?.id || Number(damage)<=0) return false;

  const started=performance.now();
  const duration=720;
  const existing=fireDamageFx.find(fx=>fx.unitId===unit.id && started<fx.until);

  if(existing){
    existing.started=started;
    existing.until=started+duration;
    existing.duration=duration;
    existing.intensity=Math.min(1.5,(existing.intensity||1)+0.18);
  }else{
    fireDamageFx.push({
      unitId:unit.id,
      started,
      until:started+duration,
      duration,
      intensity:1
    });
  }

  ensureTransientUnitFxLoop();
  return true;
}

function registerElementalDamageFx(unit,damageType,damage){
  if(String(damageType||"").toLowerCase()==="fire" && Number(damage)>0){
    triggerFireDamageFx(unit,damage);
  }
}

/*
  R87 spell incantation framework. The spoken phrase lives on the canonical
  spell record so battlefield speech and the Spell Book share one source of
  truth. Spells without an assigned incantation remain silent.
*/
function speakSpellIncantation(caster,spell,durationMs=1800){
  const incantation=spell?.incantation?.trim();

  if(!caster?.alive || !incantation){
    return false;
  }

  showUnitBarks([caster],incantation,durationMs);
  triggerCastingGlow(caster,1000);
  return true;
}

function commitSpellCast(caster,spell,action,durationMs=1800){
  if(!caster?.alive || !spell) return false;

  if(action?.type==="memorized-spell" && !action.spellCommitted){
    if(!mageConsumeMemorizedSpell(caster,spell.id)){
      setCombatMessage(`${spell.name} is no longer memorized.`);
      return false;
    }

    action.spellCommitted=true;
  }

  speakSpellIncantation(caster,spell,durationMs);
  return true;
}

/* R90: resolve the caster from the action record so shared spell code can be
   used by Carl's test harness, future player-controlled Mages, and party NPC Mages. */
function spellCasterForAction(action){
  return getUnitById(action?.sourceUnitId) || game?.player || null;
}

function magicMissileCountForCasterLevel(casterLevel){
  const level=Math.max(1,Math.floor(Number(casterLevel)||1));
  return Math.min(5,1+Math.floor((level-1)/2));
}

function magicMissileRangeYards(casterLevel){
  const spell=getSpellEntry("magic-missile");
  const level=Math.max(1,Math.floor(Number(casterLevel)||1));
  return spell.range.baseYards+spell.range.yardsPerCasterLevel*level;
}

function fireballRangeYards(casterLevel){
  const spell=getSpellEntry("fireball");
  const level=Math.max(1,Math.floor(Number(casterLevel)||1));
  return spell.range.baseYards+spell.range.yardsPerCasterLevel*level;
}

function fireballDamageDiceForCasterLevel(casterLevel){
  const spell=getSpellEntry("fireball");
  const level=Math.max(1,Math.floor(Number(casterLevel)||1));

  return Math.min(
    spell.maxDamageDice,
    level*spell.damageDicePerCasterLevel
  );
}

function fireballRadiusHexes(){
  const spell=getSpellEntry("fireball");
  return Math.max(
    1,
    Math.round(spell.radiusFeet/TACTICAL_FEET_PER_HEX)
  );
}

function yardsToTacticalHexes(yards){
  const feet=Math.max(0,Number(yards)||0)*3;
  return Math.max(0,Math.floor(feet/TACTICAL_FEET_PER_HEX));
}



const TEST_SPELL_CASTER_LEVEL=6;
let spellCastOverlayOpen=false;

function effectListFor(unit,kind){
  if(!unit) return [];
  const key=kind==="buff" ? "buffs" : "debuffs";
  if(!Array.isArray(unit[key])) unit[key]=[];
  return unit[key];
}

function getUnitEffect(unit,id){
  if(!unit || !id) return null;

  return [
    ...(Array.isArray(unit.buffs) ? unit.buffs : []),
    ...(Array.isArray(unit.debuffs) ? unit.debuffs : [])
  ].find(effect=>effect?.id===id) || null;
}

function removeUnitEffect(unit,id){
  if(!unit || !id) return false;

  let removed=false;

  for(const key of ["buffs","debuffs"]){
    if(!Array.isArray(unit[key])) continue;

    const before=unit[key].length;
    unit[key]=unit[key].filter(effect=>effect?.id!==id);
    removed=removed || unit[key].length!==before;
  }

  return removed;
}

function addUnitEffect(unit,{
  id,
  name,
  kind="buff",
  detail="",
  expiresRound=null,
  data={}
}){
  if(!unit || !id) return null;

  removeUnitEffect(unit,id);

  const effect={
    id,
    name:name || id,
    kind,
    detail,
    expiresRound,
    data:{...data}
  };

  effectListFor(unit,kind).push(effect);

  /* R104: persistent status FX start from the status lifecycle itself. */
  if(["sleep","unconscious","confusion","confused","taunt","shield","light"].includes(id)){
    queueMicrotask(()=>ensurePersistentStatusFxLoop());
  }

  return effect;
}

const MORALE_PANIC_EFFECT_ID="morale-panic";

function setMoraleFleeing(unit,isFleeing){
  if(!unit) return;

  unit.fleeing=!!isFleeing;

  if(unit.fleeing){
    addUnitEffect(unit,{
      id:MORALE_PANIC_EFFECT_ID,
      name:"PANIC!",
      kind:"debuff",
      detail:"Morale broken — fleeing"
    });
  }else{
    removeUnitEffect(unit,MORALE_PANIC_EFFECT_ID);
    if(isKoboldUnit(unit)) unit.panicBarkPending=false;
  }
}

function expireTimedUnitEffects(){
  if(!game) return;

  for(const unit of allUnits()){
    for(const key of ["buffs","debuffs"]){
      if(!Array.isArray(unit[key])) continue;

      const retained=[];

      for(const effect of unit[key]){
        const expired=
          Number.isFinite(effect?.expiresRound) &&
          game.round>=effect.expiresRound;

        if(!expired){
          retained.push(effect);
          continue;
        }

        /*
          R193: Enlarge expires visually instead of snapping back to 100%.
          The effect can be removed immediately because the transient transition
          retains its starting scale independently for the one-second shrink.
        */
        if(effect?.id==="enlarge"){
          const fromScale=Math.max(
            1,
            Number(effect.data?.sizeMultiplier) ||
            Number(effect.data?.damageMultiplier) ||
            1
          );

          triggerEnlargeTransition(
            unit,
            fromScale,
            1,
            "shrink",
            1000
          );
        }
      }

      unit[key]=retained;
    }
  }

  game.areaEffects=(game.areaEffects || []).filter(effect=>
    !Number.isFinite(effect?.expiresRound) ||
    game.round<effect.expiresRound
  );
}

function isEvilAlignment(unit){
  return /\bevil\b/i.test(String(unit?.alignment || ""));
}

function isUndeadUnit(unit){
  return unit?.creatureType==="undead" || unit?.undead===true;
}

function spellHitDiceValue(unit){
  if(!unit) return 0;
  if(Number.isFinite(unit.hitDiceValue)) return unit.hitDiceValue;
  if(Number.isFinite(unit.level)) return unit.level;
  return 1;
}

function spellSaveTargetForUnit(unit){
  if(unit?.saves?.spell){
    return unit.saves.spell;
  }

  if(unit?.id==="player"){
    return (
      unit.saves ||
      warriorSavingThrows(unit.level || 1)
    ).spell;
  }

  if(unit?.controller==="mob"){
    const saveLevel=Math.max(
      1,
      Math.ceil(Number(unit.hitDiceValue)||1)
    );

    return warriorSavingThrows(saveLevel).spell;
  }

  return warriorSavingThrows(
    Math.max(1,Number(unit?.level)||1)
  ).spell;
}

function attackEffectModifier(attacker,defender){
  let modifier=0;

  if(getUnitEffect(attacker,"blind")){
    modifier-=4;
  }

  const chillDebuff=getUnitEffect(attacker,"chill-touch-strength-loss");
  if(chillDebuff){
    const loss=Number(chillDebuff.data?.strengthLoss)||0;
    modifier-=Math.floor(loss/2);
  }

  if(
    getUnitEffect(defender,"protection-from-evil") &&
    isEvilAlignment(attacker)
  ){
    modifier-=2;
  }

  /* AD&D 2e: direct rear physical attacks gain +2 to hit. */
  modifier+=
    attackPositionData(attacker,defender).rearAttackBonus;

  return modifier;
}

function spellSaveRollModifier(target,sourceUnit=null,extraModifier=0){
  let modifier=extraModifier;

  if(getUnitEffect(target,"blind")){
    modifier-=4;
  }

  if(
    sourceUnit &&
    isEvilAlignment(sourceUnit) &&
    getUnitEffect(target,"protection-from-evil")
  ){
    modifier+=2;
  }

  if(
    sourceUnit &&
    getUnitEffect(target,"shield") &&
    attackComesFromFront(target,sourceUnit)
  ){
    modifier+=1;
  }

  return modifier;
}

function rollSpellSave(target,sourceUnit=null,extraModifier=0){
  const targetNumber=spellSaveTargetForUnit(target);
  const rawRoll=d(20);
  const modifier=spellSaveRollModifier(
    target,
    sourceUnit,
    extraModifier
  );
  const modifiedRoll=rawRoll+modifier;

  return {
    rawRoll,
    modifier,
    modifiedRoll,
    targetNumber,
    success:modifiedRoll>=targetNumber
  };
}

function breathSaveTargetForUnit(unit){
  if(unit?.saves?.breath){
    return unit.saves.breath;
  }

  if(unit?.id==="player"){
    return (
      unit.saves ||
      warriorSavingThrows(unit.level || 1)
    ).breath;
  }

  if(unit?.controller==="mob"){
    return warriorSavingThrows(
      Math.max(1,Math.ceil(Number(unit.hitDiceValue)||1))
    ).breath;
  }

  return warriorSavingThrows(
    Math.max(1,Number(unit?.level)||1)
  ).breath;
}

function unitImmuneToDamageType(unit,damageType){
  const wanted=String(damageType || "").toLowerCase();
  return Array.isArray(unit?.damageImmunities) &&
    unit.damageImmunities.some(type=>
      String(type || "").toLowerCase()===wanted
    );
}

function attackComesFromFront(defender,attacker){
  return attackPositionData(
    attacker,
    defender
  ).frontProtected;
}

function effectiveArmorClassForAttack(attacker,defender,attackKind="melee"){
  let ac=defender?.ac ?? 10;
  let usingNormalEquipmentAc=true;

  const armorEffect=getUnitEffect(defender,"armor-spell");
  if(
    armorEffect &&
    Number.isFinite(armorEffect.data?.acValue) &&
    armorEffect.data.acValue<ac
  ){
    ac=armorEffect.data.acValue;
    usingNormalEquipmentAc=false;
  }

  if(getUnitEffect(defender,"blind")){
    ac+=4;
  }

  const position=
    attackPositionData(attacker,defender);

  /*
    Direct rear attacks deny a BENEFICIAL Dexterity AC adjustment.
    A low-Dexterity penalty is not a bonus and therefore remains.
  */
  if(position.dexterityBonusDenied){
    const dexDefensiveAdjustment=
      dexterityAdjustments(defender?.stats?.dex ?? 10).defensive;

    if(dexDefensiveAdjustment<0){
      ac-=dexDefensiveAdjustment;
    }
  }

  /*
    Physical shields do not protect REAR or either REAR-FLANK sector.
    Defender AC normally already contains the shield benefit, so add it
    back when the attack arrives through an unprotected sector.
  */
  if(position.shieldDenied && usingNormalEquipmentAc){
    const shieldBonus=
      armorClassBreakdown(defender).shieldBonus ||
      Number(defender?.shieldBonus) ||
      0;

    if(shieldBonus>0){
      ac+=shieldBonus;
    }
  }

  /* The Shield spell remains a frontal barrier. */
  const shield=getUnitEffect(defender,"shield");
  if(
    shield &&
    position.frontProtected
  ){
    let shieldAc=4;

    if(attackKind==="small-device-missile"){
      shieldAc=3;
    }else if(attackKind==="hand-hurled-missile"){
      shieldAc=2;
    }

    ac=Math.min(ac,shieldAc);
  }

  return clamp(ac,-10,10);
}

function enlargedDamageMultiplier(unit){
  const effect=getUnitEffect(unit,"enlarge");
  return effect
    ? Math.max(1,Number(effect.data?.damageMultiplier)||1)
    : 1;
}

/*
  R195 — ILLUMINATION SYSTEM
  -------------------------
  Illumination is now a reusable battlefield query rather than a one-off Light
  spell drawing. Sources may be attached to moving units or exist as static
  area effects. Future torches, fire, Darkness, day/night, glowing equipment,
  infravision rules, etc. can reuse these functions.

  R195 intentionally does NOT change party line-of-sight or detection rules.
  LOS answers "can a ray reach this hex?"; illumination answers "how brightly
  is that reachable terrain lit?" Those systems can be combined later.
*/
const ILLUMINATION_RULES=Object.freeze({
  lightSpellRadiusHexes:2, /* 20 feet at 10 feet per tactical hex. */
  lightSpellIntensity:1,
  indoorAmbient:0.42,
  outdoorAmbient:0.88,
  illuminatedThreshold:0.58
});

function ambientIlluminationLevel(){
  return game?.condition==="wall"
    ? ILLUMINATION_RULES.indoorAmbient
    : ILLUMINATION_RULES.outdoorAmbient;
}

function illuminationAreaEffects(){
  return (game?.areaEffects || []).filter(
    effect=>effect?.type==="illumination"
  );
}

function illuminationSources(){
  if(!game) return [];

  const sources=[];

  for(const unit of allUnits()){
    if(!unit?.alive || unit.fled) continue;

    const effect=getUnitEffect(unit,"light");
    if(!effect) continue;

    sources.push({
      id:`unit-light:${unit.id}`,
      sourceKind:"unit",
      unitId:unit.id,
      x:unit.x,
      y:unit.y,
      radiusHexes:Math.max(
        1,
        Number(effect.data?.illuminationRadiusHexes) ||
        ILLUMINATION_RULES.lightSpellRadiusHexes
      ),
      intensity:Math.max(
        0,
        Number(effect.data?.illuminationIntensity) ||
        ILLUMINATION_RULES.lightSpellIntensity
      ),
      color:Array.isArray(effect.data?.lightColor)
        ? effect.data.lightColor
        : [255,244,188]
    });
  }

  for(const effect of illuminationAreaEffects()){
    if(!inside(effect.x,effect.y)) continue;

    sources.push({
      id:effect.id || `area-light:${effect.x},${effect.y}`,
      sourceKind:"area",
      x:effect.x,
      y:effect.y,
      radiusHexes:Math.max(
        1,
        Number(effect.radiusHexes) ||
        ILLUMINATION_RULES.lightSpellRadiusHexes
      ),
      intensity:Math.max(
        0,
        Number(effect.intensity) ||
        ILLUMINATION_RULES.lightSpellIntensity
      ),
      color:Array.isArray(effect.color)
        ? effect.color
        : [255,244,188]
    });
  }

  return sources;
}

function illuminationSourceReachesHex(source,x,y){
  if(!source || !inside(x,y)) return false;

  const distance=hexDistance(
    {x:source.x,y:source.y},
    {x,y}
  );

  if(distance>source.radiusHexes) return false;

  if(
    game?.condition==="wall" &&
    lightBlockedBetweenHexes(
      {x:source.x,y:source.y},
      {x,y}
    )
  ){
    return false;
  }

  return true;
}

function illuminationContributionFromSource(source,x,y){
  if(!illuminationSourceReachesHex(source,x,y)) return 0;

  const distance=hexDistance(
    {x:source.x,y:source.y},
    {x,y}
  );
  const radius=Math.max(1,Number(source.radiusHexes)||1);

  /* Smooth radial falloff: center 100%, edge remains visibly illuminated. */
  const normalized=Math.max(0,Math.min(1,distance/(radius+0.45)));
  const falloff=1-(normalized*normalized);

  return Math.max(0,Number(source.intensity)||0)*falloff;
}

function dynamicIlluminationAtHex(x,y){
  let total=0;

  for(const source of illuminationSources()){
    total+=illuminationContributionFromSource(source,x,y);
  }

  return Math.max(0,Math.min(1.5,total));
}

function illuminationAtHex(x,y){
  const ambient=ambientIlluminationLevel();
  const dynamic=dynamicIlluminationAtHex(x,y);

  /* Dynamic light fills the unlit portion of ambient light rather than simply
     adding arbitrary brightness above 100%. */
  return Math.max(
    0,
    Math.min(1,ambient+(1-ambient)*Math.min(1,dynamic))
  );
}

function isHexIlluminated(x,y){
  return illuminationAtHex(x,y)>=ILLUMINATION_RULES.illuminatedThreshold;
}

function makeLightSpellEffectData(casterLevel){
  return {
    casterLevel:Math.max(1,Number(casterLevel)||1),
    illuminationRadiusHexes:ILLUMINATION_RULES.lightSpellRadiusHexes,
    illuminationIntensity:ILLUMINATION_RULES.lightSpellIntensity,
    lightColor:[255,244,188]
  };
}

function lightSpellBehindTargetHex(caster,target){
  const directionIndex=hexDirectionIndexToward(caster,target);
  const dir=HEX_DIRS[directionIndex] || HEX_DIRS[0];
  const behind={
    x:target.x+dir.x,
    y:target.y+dir.y
  };

  return inside(behind.x,behind.y)
    ? behind
    : {x:target.x,y:target.y};
}

function addStaticLightSpellSource(caster,target,casterLevel){
  const position=lightSpellBehindTargetHex(caster,target);
  const durationRounds=10*Math.max(1,Number(casterLevel)||1);

  return addAreaEffect({
    id:`light-spell-static:${caster.id}:${game.round}:${target.id}`,
    type:"illumination",
    sourceName:"Light",
    x:position.x,
    y:position.y,
    radiusHexes:ILLUMINATION_RULES.lightSpellRadiusHexes,
    intensity:ILLUMINATION_RULES.lightSpellIntensity,
    color:[255,244,188],
    expiresRound:game.round+durationRounds
  });
}

function tracePolygonOnContext(targetCtx,points){
  if(!targetCtx || !Array.isArray(points) || points.length<3) return false;

  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++){
    targetCtx.lineTo(points[i].x,points[i].y);
  }
  targetCtx.closePath();
  return true;
}

function convexHullWorldPoints(points){
  const clean=(points || [])
    .filter(point=>Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .map(point=>({x:point.x,y:point.y}))
    .sort((a,b)=>a.x-b.x || a.y-b.y);

  if(clean.length<=2) return clean;

  const cross=(o,a,b)=>
    (a.x-o.x)*(b.y-o.y)-
    (a.y-o.y)*(b.x-o.x);

  const lower=[];
  for(const point of clean){
    while(
      lower.length>=2 &&
      cross(lower[lower.length-2],lower[lower.length-1],point)<=0
    ){
      lower.pop();
    }
    lower.push(point);
  }

  const upper=[];
  for(let i=clean.length-1;i>=0;i--){
    const point=clean[i];
    while(
      upper.length>=2 &&
      cross(upper[upper.length-2],upper[upper.length-1],point)<=0
    ){
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function architecturalLightShadowPolygonWorld(sourceWorld,blocker){
  if(!sourceWorld || !blocker) return [];

  const vertices=architecturalWallWorldVertices(blocker);
  if(vertices.length<3) return [];

  /*
    R202: extrude every wall-rectangle vertex directly away from the point
    light. The convex hull of the wall plus those far points is a conservative
    geometric shadow volume. Because wallBlockingSubsegments("light") splits
    around doors and windows, those openings naturally remain unshadowed.
  */
  const extrusionDistance=Math.max(
    canvas.width,
    canvas.height,
    HEX_W*VIEW_RADIUS*3
  )*3;

  const farPoints=vertices.map(vertex=>{
    const dx=vertex.x-sourceWorld.x;
    const dy=vertex.y-sourceWorld.y;
    const len=Math.hypot(dx,dy)||1;

    return {
      x:vertex.x+(dx/len)*extrusionDistance,
      y:vertex.y+(dy/len)*extrusionDistance
    };
  });

  return convexHullWorldPoints(
    vertices.concat(farPoints)
  );
}

function drawTerrainIlluminationLayer(tiles){
  if(!game) return;

  const sources=illuminationSources();
  if(!sources.length) return;

  const lightCanvas=
    drawTerrainIlluminationLayer.lightCanvas ||
    (drawTerrainIlluminationLayer.lightCanvas=document.createElement("canvas"));

  if(
    lightCanvas.width!==canvas.width ||
    lightCanvas.height!==canvas.height
  ){
    lightCanvas.width=canvas.width;
    lightCanvas.height=canvas.height;
  }

  const lightCtx=lightCanvas.getContext("2d");
  lightCtx.imageSmoothingEnabled=false;

  for(const source of sources){
    const center=hexCenter(source.x,source.y);
    const radiusHexes=Math.max(1,Number(source.radiusHexes)||1);
    const screenRadius=(radiusHexes+0.70)*HEX_W;
    const color=source.color || [255,244,188];
    const sourceAlpha=0.18*Math.min(1.25,source.intensity||1);

    /*
      Preserve the established open-field renderer exactly. R202's hard
      shadow-volume method is architectural/Wall-Test-only.
    */
    if(game.condition!=="wall"){
      const gradient=ctx.createRadialGradient(
        center.x,
        center.y-4,
        2,
        center.x,
        center.y-4,
        screenRadius
      );

      gradient.addColorStop(
        0,
        `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha})`
      );
      gradient.addColorStop(
        0.48,
        `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha*0.72})`
      );
      gradient.addColorStop(
        1,
        `rgba(${color[0]},${color[1]},${color[2]},0)`
      );

      for(const tile of tiles){
        const contribution=illuminationContributionFromSource(
          source,
          tile.x,
          tile.y
        );
        if(contribution<=0) continue;

        const top=hexScreenVertices(tile.x,tile.y);
        const tileCenter=hexCenter(tile.x,tile.y);

        ctx.save();
        polygonPath(top);
        ctx.clip();
        ctx.globalCompositeOperation="lighter";
        ctx.globalAlpha=Math.min(1,0.58+contribution*0.42);
        ctx.fillStyle=gradient;
        ctx.fillRect(
          tileCenter.x-HEX_W/2-2,
          tileCenter.y-HEX_H/2-2,
          HEX_W+4,
          HEX_H+4
        );
        ctx.restore();
      }

      continue;
    }

    lightCtx.clearRect(0,0,lightCanvas.width,lightCanvas.height);
    lightCtx.globalCompositeOperation="source-over";
    lightCtx.globalAlpha=1;

    const gradient=lightCtx.createRadialGradient(
      center.x,
      center.y-4,
      2,
      center.x,
      center.y-4,
      screenRadius
    );

    gradient.addColorStop(
      0,
      `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha})`
    );
    gradient.addColorStop(
      0.48,
      `rgba(${color[0]},${color[1]},${color[2]},${sourceAlpha*0.72})`
    );
    gradient.addColorStop(
      1,
      `rgba(${color[0]},${color[1]},${color[2]},0)`
    );

    /*
      Wall Test begins with one continuous light field. Solid architecture then
      removes authoritative hard shadow volumes from it. This is deliberately
      independent of whole-hex reachability, which was the source of the bleed.
    */
    lightCtx.fillStyle=gradient;
    lightCtx.fillRect(
      center.x-screenRadius,
      center.y-screenRadius-4,
      screenRadius*2,
      screenRadius*2
    );

    const sourceWorld=worldPointForHex(source.x,source.y);

    lightCtx.save();
    lightCtx.globalCompositeOperation="destination-out";
    lightCtx.globalAlpha=1;
    lightCtx.fillStyle="rgba(0,0,0,1)";

    for(const wall of architecturalWalls){
      for(const blocker of wallBlockingSubsegments(wall,"light")){
        const shadowWorld=
          architecturalLightShadowPolygonWorld(sourceWorld,blocker);
        if(shadowWorld.length<3) continue;

        const shadowScreen=shadowWorld.map(point=>
          screenPointForWorld(point)
        );

        if(tracePolygonOnContext(lightCtx,shadowScreen)){
          lightCtx.fill();
        }
      }
    }

    lightCtx.restore();

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.globalAlpha=1;
    ctx.drawImage(lightCanvas,0,0);
    ctx.restore();
  }
}


function fogEffects(){
  return (game?.areaEffects || []).filter(effect=>effect.type==="fog");
}

function greaseEffects(){
  return (game?.areaEffects || []).filter(effect=>effect.type==="grease");
}

function areaEffectContains(effect,x,y){
  return Array.isArray(effect?.cells) &&
    effect.cells.some(cell=>cell.x===x && cell.y===y);
}

function hasFogAtHex(x,y){
  return fogEffects().some(effect=>areaEffectContains(effect,x,y));
}

function hasGreaseAtHex(x,y){
  return greaseEffects().some(effect=>areaEffectContains(effect,x,y));
}

function cubeRound(q,r){
  let x=q;
  let z=r;
  let y=-x-z;

  let rx=Math.round(x);
  let ry=Math.round(y);
  let rz=Math.round(z);

  const xDiff=Math.abs(rx-x);
  const yDiff=Math.abs(ry-y);
  const zDiff=Math.abs(rz-z);

  if(xDiff>yDiff && xDiff>zDiff){
    rx=-ry-rz;
  }else if(yDiff>zDiff){
    ry=-rx-rz;
  }else{
    rz=-rx-ry;
  }

  return {x:rx,y:rz};
}

function hexLineCells(a,b){
  const distance=hexDistance(a,b);
  if(distance<=0) return [{x:a.x,y:a.y}];

  const cells=[];

  for(let i=0;i<=distance;i++){
    const t=i/distance;
    cells.push(
      cubeRound(
        a.x+(b.x-a.x)*t,
        a.y+(b.y-a.y)*t
      )
    );
  }

  return cells.filter((cell,index,array)=>
    index===0 ||
    cell.x!==array[index-1].x ||
    cell.y!==array[index-1].y
  );
}

function lineOfSightBlockedBetweenHexes(source,target){
  if(architecturalWallBlocksLOS(source,target)){
    return true;
  }

  const cells=hexLineCells(source,target);

  return cells.some((cell,index)=>
    index>0 &&
    hasFogAtHex(cell.x,cell.y)
  );
}

function lightBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "light"
    )
  ){
    return true;
  }

  const cells=hexLineCells(source,target);
  return cells.some((cell,index)=>
    index>0 &&
    hasFogAtHex(cell.x,cell.y)
  );
}

function lineOfSightBlocked(source,target){
  if(!source || !target) return false;

  const sourceCells=occupiedHexesAt(source,source.x,source.y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);

  /*
    R186: a large creature is visible/targetable when at least one occupied
    body hex has a clear ray to at least one occupied source hex.
  */
  for(const sourceCell of sourceCells){
    for(const targetCell of targetCells){
      if(!lineOfSightBlockedBetweenHexes(sourceCell,targetCell)){
        return false;
      }
    }
  }

  return true;
}

function projectilePathBlockedBetweenHexes(source,target){
  if(!source || !target) return true;

  if(
    architecturalWallBlocksWorldLine(
      worldPointForHex(source.x,source.y),
      worldPointForHex(target.x,target.y),
      "projectile"
    )
  ){
    return true;
  }

  const cells=hexLineCells(source,target);
  return cells.some((cell,index)=>
    index>0 &&
    hasFogAtHex(cell.x,cell.y)
  );
}

function projectilePathBlocked(source,target){
  if(!source || !target) return false;

  const sourceCells=occupiedHexesAt(source,source.x,source.y);
  const targetCells=occupiedHexesAt(target,target.x,target.y);

  for(const sourceCell of sourceCells){
    for(const targetCell of targetCells){
      if(!projectilePathBlockedBetweenHexes(sourceCell,targetCell)){
        return false;
      }
    }
  }

  return true;
}

/* ============================================================
   R136 — SOFTER CORNER-ANCHORED PARTY LOS / WALL-FRONT PASS
   ------------------------------------------------------------
   Wall Test renders the union of all living friendly units as a continuous world-space line-of-sight mask.
   Visibility rays stop against the NEAR EDGE of thick wall rectangles,
   so blackout can split individual hexes directly at architectural walls.
   A narrow feathered ring softens open-space LOS borders without falling
   back to whole-hex blackouts.
   ============================================================ */

function friendlyVisibilityObservers(){
  if(!game) return [];

  return [game.player,...(game.allies || [])]
    .filter(unit=>unit && unit.alive && !unit.fled);
}

/*
  Kept as a compatibility helper for any code that still wants a single
  representative observer. R133 rendering itself uses the union of every
  living friendly unit's LOS.
*/
function wallTestVisibilityObserver(){
  if(!game || game.condition!=="wall") return null;
  return friendlyVisibilityObservers()[0] || null;
}

function isFriendlyCombatUnit(unit){
  if(!unit || !game) return false;
  return unit===game.player || (game.allies || []).includes(unit);
}

function visibilitySampleWorldPointsForHex(x,y){
  const c=worldPointForHex(x,y);
  const s=0.56;
  const hw=(HEX_W/2)*s;
  const hh=(HEX_H/2)*s;
  const qh=(HEX_H/4)*s;

  return [
    {x:c.x,    y:c.y},
    {x:c.x,    y:c.y-hh},
    {x:c.x+hw, y:c.y-qh},
    {x:c.x+hw, y:c.y+qh},
    {x:c.x,    y:c.y+hh},
    {x:c.x-hw, y:c.y+qh},
    {x:c.x-hw, y:c.y-qh}
  ];
}

function visibilityWorldBounds(){
  const cameraWorld=worldPointForHex(camera.x,camera.y);
  const margin=140;
  const left=cameraWorld.x-(canvas.width*0.47)-margin;
  const top=cameraWorld.y-(canvas.height*0.57)-margin;
  const right=left+canvas.width+(margin*2);
  const bottom=top+canvas.height+(margin*2);

  return {
    left,
    top,
    right,
    bottom,
    corners:[
      {x:left,y:top},
      {x:right,y:top},
      {x:right,y:bottom},
      {x:left,y:bottom}
    ]
  };
}

function visibilitySegments(mode="los"){
  const bounds=visibilityWorldBounds();
  const segments=[];

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,mode)){
      const polygon=architecturalWallWorldVertices(blocker);
      for(const segment of wallPolygonSegments(polygon)){
        segments.push({
          ...segment,
          isWall:true,
          wallId:wall.id
        });
      }
    }
  }

  for(const segment of wallPolygonSegments(bounds.corners)){
    segments.push({...segment,isBoundary:true});
  }

  return {segments,bounds};
}

function cross2d(a,b){
  return (a.x*b.y)-(a.y*b.x);
}

function raySegmentIntersection(origin,angle,segment){
  const r={x:Math.cos(angle),y:Math.sin(angle)};
  const s={x:segment.b.x-segment.a.x,y:segment.b.y-segment.a.y};
  const qp={x:segment.a.x-origin.x,y:segment.a.y-origin.y};
  const denom=cross2d(r,s);

  if(Math.abs(denom)<0.0000001) return null;

  const t=cross2d(qp,s)/denom;
  const u=cross2d(qp,r)/denom;

  if(t<0 || u<0 || u>1) return null;

  return {
    x:origin.x+(r.x*t),
    y:origin.y+(r.y*t),
    t,
    isWall:!!segment.isWall,
    wallId:segment.wallId || null,
    isBoundary:!!segment.isBoundary
  };
}

function castVisibilityRay(origin,angle,segments){
  let best=null;

  for(const segment of segments){
    const hit=raySegmentIntersection(origin,angle,segment);
    if(!hit) continue;
    if(!best || hit.t<best.t){
      best=hit;
    }
  }

  return best;
}

function wallTestVisibilityPolygonWorld(observer,mode="los"){
  if(!observer || game?.condition!=="wall") return [];

  const origin=worldPointForHex(observer.x,observer.y);
  const {segments,bounds}=visibilitySegments(mode);
  const epsilon=0.00018;
  const vertices=[];

  for(const wall of architecturalWalls){
    for(const blocker of wallBlockingSubsegments(wall,mode)){
      vertices.push(...architecturalWallWorldVertices(blocker));
    }
  }
  vertices.push(...bounds.corners);

  const angles=[];
  for(const vertex of vertices){
    const base=Math.atan2(vertex.y-origin.y,vertex.x-origin.x);
    angles.push(base-epsilon,base,base+epsilon);
  }

  angles.push(-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI);

  const hits=[];
  for(const angle of angles){
    const hit=castVisibilityRay(origin,angle,segments);
    if(!hit) continue;
    hits.push({angle,...hit});
  }

  hits.sort((a,b)=>a.angle-b.angle);

  const polygon=[];
  for(const hit of hits){
    const prev=polygon[polygon.length-1];
    if(prev && Math.hypot(prev.x-hit.x,prev.y-hit.y)<0.45){
      continue;
    }
    polygon.push({
      x:hit.x,
      y:hit.y,
      isWall:!!hit.isWall,
      wallId:hit.wallId || null,
      isBoundary:!!hit.isBoundary
    });
  }

  if(
    polygon.length>2 &&
    Math.hypot(
      polygon[0].x-polygon[polygon.length-1].x,
      polygon[0].y-polygon[polygon.length-1].y
    )<0.45
  ){
    polygon.pop();
  }

  return polygon;
}

function fogBlocksVisibilityToHex(observer,x,y){
  const cells=hexLineCells(observer,{x,y});
  return cells.some((cell,index)=>
    index>0 && hasFogAtHex(cell.x,cell.y)
  );
}

function isHexVisibleFromObserver(observer,x,y){
  if(!observer || !inside(x,y)) return false;
  if(observer.x===x && observer.y===y) return true;

  if(fogBlocksVisibilityToHex(observer,x,y)){
    return false;
  }

  const eye=worldPointForHex(observer.x,observer.y);
  const samples=visibilitySampleWorldPointsForHex(x,y);

  return samples.some(sample=>
    !architecturalWallBlocksWorldLine(eye,sample,"los")
  );
}

function isHexVisibleToFriendlyParty(x,y){
  if(game?.condition!=="wall") return true;
  const observers=friendlyVisibilityObservers();
  if(!observers.length) return true;
  return observers.some(observer=>isHexVisibleFromObserver(observer,x,y));
}

function isUnitVisibleToFriendlyParty(unit){
  if(!unit) return false;
  if(game?.condition!=="wall") return true;
  if(isFriendlyCombatUnit(unit)) return true;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return true;

  return observers.some(observer=>
    occupiedHexes(unit).some(cell=>{
      if(fogBlocksVisibilityToHex(observer,cell.x,cell.y)) return false;

      return !architecturalWallBlocksWorldLine(
        worldPointForHex(observer.x,observer.y),
        worldPointForHex(cell.x,cell.y),
        "los"
      );
    })
  );
}

function shouldRenderUnitUnderPartyVisibility(unit){
  return game?.condition!=="wall" || isUnitVisibleToFriendlyParty(unit);
}


/* ============================================================
   R137 — AD&D 2E OFF-LOS LISTEN CHECKS
   ------------------------------------------------------------
   DMG Table 83, Chance to Hear Noise by Race:
   Dwarf 15%, Elf 20%, Gnome 25%, Half-elf 15%, Halfling 20%, Human 15%.
   A Thief's improved Detect Noise percentage supersedes the racial baseline
   when a character record supplies one. The combat engine uses these chances
   as the requested reactive check for each hostile movement sequence that
   occurs outside party LOS.
   ============================================================ */
const ADND2E_HEAR_NOISE_PERCENT_BY_RACE=Object.freeze({
  "dwarf":15,
  "elf":20,
  "gnome":25,
  "half-elf":15,
  "halfling":20,
  "human":15
});

function normalizedListenRace(unit){
  return String(unit?.race || "Human")
    .trim()
    .toLowerCase()
    .replace(/_/g,"-")
    .replace(/\s+/g,"-");
}

function detectNoisePercentForUnit(unit){
  const improved=Number(
    unit?.detectNoisePercent ??
    unit?.thievingSkills?.["Detect Noise"] ??
    unit?.thiefSkills?.["Detect Noise"]
  );

  if(Number.isFinite(improved) && improved>0){
    return clamp(improved,1,95);
  }

  return ADND2E_HEAR_NOISE_PERCENT_BY_RACE[normalizedListenRace(unit)] ?? 15;
}

function friendlyListenersForHiddenMovement(){
  return livingPartyMembers().filter(unit=>
    !getUnitEffect(unit,"sleep") &&
    !getUnitEffect(unit,"unconscious")
  );
}

function rollPartyListenForMobMovement(){
  const results=friendlyListenersForHiddenMovement().map(listener=>{
    const chance=detectNoisePercentForUnit(listener);
    const roll=d(100);
    return {listener,chance,roll,success:roll<=chance};
  });

  return {
    detected:results.some(result=>result.success),
    results
  };
}

function mobPositionVisibleToFriendlyParty(mob,x=mob?.x,y=mob?.y){
  if(!mob) return true;
  if(game?.condition!=="wall") return true;

  return isUnitVisibleToFriendlyParty({...mob,x,y});
}

function clearActivityDetectedFxForUnit(unit){
  if(!activityDetectedFx) return;
  if(unit && activityDetectedFx.unitId!==unit.id) return;

  activityDetectedFx=null;
  if(activityDetectedClearTimer){
    clearTimeout(activityDetectedClearTimer);
    activityDetectedClearTimer=null;
  }
}

function showActivityDetectedFx(unit,durationMs=280){
  if(!unit) return;

  const duration=Math.max(180,Number(durationMs)||280);
  const token=(activityDetectedFx?.token || 0)+1;

  activityDetectedFx={
    unitId:unit.id,
    x:unit.x,
    y:unit.y,
    until:performance.now()+duration,
    token
  };

  if(activityDetectedClearTimer){
    clearTimeout(activityDetectedClearTimer);
  }

  activityDetectedClearTimer=setTimeout(()=>{
    if(activityDetectedFx?.token!==token) return;
    activityDetectedFx=null;
    activityDetectedClearTimer=null;
    if(game && currentScreen==="combat") draw();
  },duration+20);
}

function drawActivityDetectedFx(){
  if(!activityDetectedFx || performance.now()>=activityDetectedFx.until) return;

  const c=hexCenter(activityDetectedFx.x,activityDetectedFx.y);
  drawWhiteBattlefieldText(
    "Activity Detected",
    c.x,
    Math.round(c.y-52),
    {fontSize:13}
  );
}

function createHiddenMobMovementSenseContext(){
  return {
    checked:false,
    detected:false,
    wasHidden:false,
    centered:false
  };
}

function mobMovementPresentationMode(mob,destination,senseContext){
  if(mob?.controller!=="mob") return "visible";

  const visible=mobPositionVisibleToFriendlyParty(
    mob,
    destination?.x ?? mob.x,
    destination?.y ?? mob.y
  );

  if(visible){
    return "visible";
  }

  senseContext.wasHidden=true;

  if(!senseContext.checked){
    const listen=rollPartyListenForMobMovement();
    senseContext.checked=true;
    senseContext.detected=listen.detected;
  }

  return senseContext.detected ? "heard" : "silent";
}

/* Backward-compatible name used by existing warning/bark logic. */
function isHexVisibleToWallTestObserver(x,y){
  return isHexVisibleToFriendlyParty(x,y);
}

function centroidOfPoints(points){
  if(!points.length) return {x:0,y:0};
  let x=0;
  let y=0;
  for(const point of points){
    x+=point.x;
    y+=point.y;
  }
  return {x:x/points.length,y:y/points.length};
}

function expandScreenPolygon(points,amount){
  if(!points.length || !amount) return points.map(point=>({x:point.x,y:point.y}));
  const center=centroidOfPoints(points);
  return points.map(point=>{
    const dx=point.x-center.x;
    const dy=point.y-center.y;
    const len=Math.hypot(dx,dy)||1;
    return {
      x:point.x+(dx/len)*amount,
      y:point.y+(dy/len)*amount
    };
  });
}

function contractScreenPolygonTowardObserver(points,observerScreen,amount){
  if(!points.length || !amount){
    return points.map(point=>({...point}));
  }

  return points.map(point=>{
    /*
      R133: wall-hit vertices are hard anchors. Feather layers may retreat
      through open space, but they are never allowed to pull the LOS boundary
      away from the exact masonry corner/edge that created the occlusion.
    */
    if(point.isWall){
      return {...point};
    }

    const dx=observerScreen.x-point.x;
    const dy=observerScreen.y-point.y;
    const len=Math.hypot(dx,dy)||1;
    const travel=Math.min(Math.max(0,amount),Math.max(0,len-1));
    return {
      ...point,
      x:point.x+(dx/len)*travel,
      y:point.y+(dy/len)*travel
    };
  });
}

function drawWallTestLineOfSightMask(){
  if(game?.condition!=="wall") return;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return;

  const visibilitySets=[];

  for(const observer of observers){
    const worldPolygon=wallTestVisibilityPolygonWorld(observer);
    if(worldPolygon.length<3) continue;

    visibilitySets.push({
      observer,
      observerScreen:screenPointForWorld(worldPointForHex(observer.x,observer.y)),
      screenPolygon:worldPolygon.map(point=>({
        ...screenPointForWorld(point),
        isWall:!!point.isWall,
        wallId:point.wallId || null,
        isBoundary:!!point.isBoundary
      }))
    });
  }

  if(!visibilitySets.length) return;

  const maskCanvas=drawWallTestLineOfSightMask.maskCanvas ||
    (drawWallTestLineOfSightMask.maskCanvas=document.createElement("canvas"));

  if(maskCanvas.width!==canvas.width || maskCanvas.height!==canvas.height){
    maskCanvas.width=canvas.width;
    maskCanvas.height=canvas.height;
  }

  const maskCtx=maskCanvas.getContext("2d");
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  maskCtx.globalCompositeOperation="source-over";

  /* R132: fully unseen terrain remains readable at 70% black. */
  maskCtx.fillStyle="rgba(0,0,0,0.70)";
  maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);

  const maskPolygonPath=points=>{
    if(!points?.length) return;
    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++){
      maskCtx.lineTo(points[i].x,points[i].y);
    }
    maskCtx.closePath();
  };

  /*
    Party LOS is a union. Each friendly polygon removes darkness from the same
    mask. The feather is intentionally INSIDE the true LOS boundary: unseen
    space stays at the requested 70% right up to a wall, while the visible
    side fades gently toward full brightness over roughly 80 screen pixels.
    This also avoids revealing slivers behind solid walls.
  */
  maskCtx.globalCompositeOperation="destination-out";

  const featherBands=[
    {inset:0,  alpha:0.08},
    {inset:12, alpha:0.13},
    {inset:24, alpha:0.20},
    {inset:38, alpha:0.30},
    {inset:52, alpha:0.43},
    {inset:66, alpha:0.62},
    {inset:82, alpha:1.00}
  ];

  for(const {screenPolygon,observerScreen} of visibilitySets){
    for(const band of featherBands){
      const polygon=band.inset===0
        ? screenPolygon
        : contractScreenPolygonTowardObserver(screenPolygon,observerScreen,band.inset);

      maskPolygonPath(polygon);
      maskCtx.fillStyle=`rgba(0,0,0,${band.alpha})`;
      maskCtx.fill();
    }
  }

  maskCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.globalCompositeOperation="source-over";
  ctx.drawImage(maskCanvas,0,0);
  ctx.restore();
}


function worldLineBlockedByOtherArchitecturalWalls(a,b,ignoredWallId){
  for(const wall of architecturalWalls){
    if(wall.id===ignoredWallId) continue;

    for(const blocker of wallBlockingSubsegments(wall,"los")){
      const polygon=architecturalWallWorldVertices(blocker);
      for(const segment of wallPolygonSegments(polygon)){
        if(segmentsIntersect(a,b,segment.a,segment.b)){
          return true;
        }
      }
    }
  }
  return false;
}

function isArchitecturalWallVisibleToFriendlyParty(wall){
  if(game?.condition!=="wall") return true;
  const observers=friendlyVisibilityObservers();
  if(!observers.length) return false;

  /* Sample away from joined endpoints so a neighboring corner wall does not
     falsely hide the wall face we are testing. */
  const samples=[0.16,0.50,0.84].map(t=>({
    x:wall.a.x+(wall.b.x-wall.a.x)*t,
    y:wall.a.y+(wall.b.y-wall.a.y)*t
  }));

  return observers.some(observer=>{
    const eye=worldPointForHex(observer.x,observer.y);
    return samples.some(sample=>
      !worldLineBlockedByOtherArchitecturalWalls(eye,sample,wall.id)
    );
  });
}

function isFogCellArchitecturallyVisibleToFriendlyParty(cell){
  if(!cell || !inside(cell.x,cell.y)) return false;
  if(game?.condition!=="wall") return true;

  const observers=friendlyVisibilityObservers();
  if(!observers.length) return false;

  /*
    Fog itself intentionally blocks gameplay LOS. For this foreground repaint
    we only need to know whether solid architecture hides the fog volume from
    every friendly observer; otherwise the visible fog surface may participate
    in the same depth ordering as masonry and units.
  */
  return observers.some(observer=>
    !architecturalWallBlocksLOS(observer,cell)
  );
}

function drawVisibleArchitecturalWallsOverLOS(){
  if(game?.condition!=="wall" || !architecturalWalls.length) return;

  /*
    R154: the post-LOS foreground repaint uses one shared isometric depth queue
    for visible masonry, units, and Wall of Fog. R153 fog participated in the
    primary actor sort, but the later masonry repaint ignored fog and therefore
    forced every visible wall on top of it. Fog now retains the same depth
    relationship in the final pass: fog closer to the viewer can cover masonry,
    while masonry closer to the viewer still covers fog.
  */
  const foreground=[];
  const visibleWalls=architecturalWalls.filter(
    wall=>isArchitecturalWallVisibleToFriendlyParty(wall)
  );

  /*
    R197: repeat the same exterior-only union outline after the LOS blackout,
    but only for architecture currently visible to the party.
  */
  drawArchitecturalWallShapeOutline(visibleWalls);
  drawArchitecturalWallTopOutline(visibleWalls);

  for(const wall of visibleWalls){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    foreground.push({
      sortY:Math.max(a.y,b.y)+0.25,
      sortX:(a.x+b.x)/2,
      fn:()=>drawArchitecturalWallSegment(wall)
    });
  }

  /* Repaint only fog cells not hidden from the party by solid architecture. */
  for(const effect of game.areaEffects || []){
    if(effect.type!=="fog") continue;

    const visibleFogCells=(effect.cells || []).filter(cell=>
      inside(cell.x,cell.y) &&
      isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W) &&
      isFogCellArchitecturallyVisibleToFriendlyParty(cell)
    );

    let outlineSortY=-Infinity;
    let outlineSortX=0;

    for(const cell of visibleFogCells){
      const c=hexCenter(cell.x,cell.y);
      const sortY=c.y+0.5;
      outlineSortY=Math.max(outlineSortY,sortY);
      outlineSortX=c.x;
      foreground.push({
        sortY,
        sortX:c.x,
        fn:()=>drawFogVolumeCell(cell)
      });
    }

    if(visibleFogCells.length && Number.isFinite(outlineSortY)){
      const visibleEffect={...effect,cells:visibleFogCells};
      foreground.push({
        sortY:outlineSortY+0.02,
        sortX:outlineSortX,
        fn:()=>drawFogEffectOutline(visibleEffect)
      });
    }
  }

  if(game.player?.alive && !game.player.fled){
    const c=hexCenter(game.player.x,game.player.y);
    foreground.push({sortY:c.y,sortX:c.x,fn:()=>drawFighter(game.player)});
  }

  for(const ally of game.allies || []){
    if(!ally?.alive || ally.fled) continue;
    const c=hexCenter(ally.x,ally.y);
    foreground.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>ally.type==="mage" ? drawFriendlyMage(ally) : drawFriendlyArcher(ally)
    });
  }

  for(const enemy of game.enemies || []){
    if(!enemy?.alive || enemy.fled) continue;
    if(!shouldRenderUnitUnderPartyVisibility(enemy)) continue;

    const depth=unitDepthSortPoint(enemy);
    foreground.push({
      sortY:depth.y,
      sortX:depth.x,
      fn:()=>
        enemy.type==="orc"
          ? drawOrc(enemy)
          : enemy.type==="juvenile-red-dragon"
            ? drawLargeTestMob(enemy)
            : drawKobold(enemy)
    });
  }

  foreground.sort((a,b)=>a.sortY-b.sortY || a.sortX-b.sortX);

  for(const item of foreground){
    item.fn();
  }
}

function spellRangeHexes(spell,casterLevel){
  const level=Math.max(1,Number(casterLevel)||1);

  if(spell?.range?.type==="touch") return 1;
  if(spell?.range?.type==="self") return 0;

  if(Number.isFinite(spell?.range?.fixedFeet)){
    return Math.max(
      0,
      Math.floor(spell.range.fixedFeet/TACTICAL_FEET_PER_HEX)
    );
  }

  if(Number.isFinite(spell?.range?.fixedYards)){
    return yardsToTacticalHexes(spell.range.fixedYards);
  }

  if(
    Number.isFinite(spell?.range?.baseYards) &&
    Number.isFinite(spell?.range?.yardsPerCasterLevel)
  ){
    return yardsToTacticalHexes(
      spell.range.baseYards+
      spell.range.yardsPerCasterLevel*level
    );
  }

  return 0;
}

function unitsWithinHexRadius(center,radius){
  return allUnits()
    .filter(unit=>
      unit.alive &&
      !unit.fled &&
      hexDistance(unit,center)<=radius
    );
}

function directionVectorForAim(caster,targetHex){
  const from=hexCenter(caster.x,caster.y);
  const to=hexCenter(targetHex.x,targetHex.y);

  return {
    x:to.x-from.x,
    y:to.y-from.y
  };
}

function unitsInDirectionalWedge(caster,targetHex,maxDistance,halfAngleRadians=Math.PI/3){
  const aim=directionVectorForAim(caster,targetHex);
  const aimLen=Math.hypot(aim.x,aim.y);

  if(aimLen<0.001) return [];

  return allUnits()
    .filter(unit=>
      unit.id!==caster.id &&
      unit.alive &&
      !unit.fled &&
      hexDistance(caster,unit)<=maxDistance
    )
    .map(unit=>{
      const from=hexCenter(caster.x,caster.y);
      const to=hexCenter(unit.x,unit.y);
      const vx=to.x-from.x;
      const vy=to.y-from.y;
      const len=Math.hypot(vx,vy) || 1;
      const dot=(aim.x*vx+aim.y*vy)/(aimLen*len);
      const angle=Math.acos(Math.max(-1,Math.min(1,dot)));

      return {
        unit,
        distance:hexDistance(caster,unit),
        angle
      };
    })
    .filter(entry=>entry.angle<=halfAngleRadians)
    .sort((a,b)=>
      a.distance-b.distance ||
      a.angle-b.angle ||
      a.unit.id.localeCompare(b.unit.id)
    )
    .map(entry=>entry.unit);
}

function hexesWithinRadius(center,radius){
  const cells=[];

  for(let x=center.x-radius;x<=center.x+radius;x++){
    for(let y=center.y-radius;y<=center.y+radius;y++){
      if(
        inside(x,y) &&
        hexDistance({x,y},center)<=radius
      ){
        cells.push({x,y});
      }
    }
  }

  return cells;
}

function directionalWedgeCells(caster,targetHex,maxDistance,halfAngleRadians=Math.PI/3){
  const aim=directionVectorForAim(caster,targetHex);
  const aimLen=Math.hypot(aim.x,aim.y);

  if(aimLen<0.001){
    return [];
  }

  const from=hexCenter(caster.x,caster.y);
  const cells=[];

  for(let x=caster.x-maxDistance;x<=caster.x+maxDistance;x++){
    for(let y=caster.y-maxDistance;y<=caster.y+maxDistance;y++){
      if(
        !inside(x,y) ||
        (x===caster.x && y===caster.y) ||
        hexDistance(caster,{x,y})>maxDistance
      ){
        continue;
      }

      const to=hexCenter(x,y);
      const vx=to.x-from.x;
      const vy=to.y-from.y;
      const len=Math.hypot(vx,vy) || 1;
      const dot=(aim.x*vx+aim.y*vy)/(aimLen*len);
      const angle=Math.acos(Math.max(-1,Math.min(1,dot)));

      if(angle<=halfAngleRadians){
        cells.push({
          x,
          y,
          distance:hexDistance(caster,{x,y}),
          angle
        });
      }
    }
  }

  cells.sort((a,b)=>
    a.distance-b.distance ||
    a.angle-b.angle ||
    a.x-b.x ||
    a.y-b.y
  );

  return cells.map(({x,y})=>({x,y}));
}

function livingUnitsInAreaCells(cells){
  const cellKeys=new Set(
    (cells || []).map(cell=>key(cell.x,cell.y))
  );

  /*
    R186: a multi-hex unit is included once when ANY occupied cell intersects
    the area. Several covered body hexes never multiply damage or saving throws.
  */
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    occupiedHexes(unit).some(cell=>cellKeys.has(key(cell.x,cell.y)))
  );
}

function aimAreaPreviewForAction(action,targetHex){
  if(!action?.spellId || !targetHex || !game?.player){
    return null;
  }

  const spell=getSpellEntry(action.spellId);
  if(!spell){
    return null;
  }

  const caster=spellCasterForAction(action) || activeUnit() || game.player;
  const casterLevel=Math.max(
    1,
    action.casterLevel || TEST_SPELL_CASTER_LEVEL
  );

  let cells=[];
  let tone="control";
  let dangerous=false;

  switch(spell.id){
    case "fireball":
      cells=fireballBlastCells(targetHex);
      tone="damage";
      dangerous=true;
      break;

    case "burning-hands":
      cells=directionalWedgeCells(
        caster,
        targetHex,
        1,
        Math.PI/3
      );
      tone="damage";
      dangerous=true;
      break;

    case "color-spray":
      cells=directionalWedgeCells(
        caster,
        targetHex,
        2,
        Math.PI/3
      );
      tone="control";
      break;

    case "grease":
      cells=inside(targetHex.x,targetHex.y)
        ? [{x:targetHex.x,y:targetHex.y}]
        : [];
      tone="terrain";
      break;

    case "sleep":
      /* R94: fixed symmetric seven-hex footprint: center + six adjacent. */
      cells=hexesWithinRadius(targetHex,1);
      tone="control";
      break;

    case "taunt":
      cells=hexesWithinRadius(targetHex,3);
      tone="control";
      break;

    case "wall-of-fog":
      cells=createWallOfFogCells(
        caster,
        targetHex,
        casterLevel,
        action.wallOfFogOrientationIndex
      ).filter(cell=>inside(cell.x,cell.y));
      tone="fog";
      break;

    default:
      return null;
  }

  const friendlies=dangerous
    ? livingUnitsInAreaCells(cells)
        .filter(unit=>unit.faction===caster.faction)
    : [];

  return {
    spell,
    cells,
    tone,
    dangerous,
    friendlyFireCount:friendlies.length
  };
}

function drawAimAreaPreview(){
  if(!aimMode || !pendingAimAction){
    return;
  }

  const preview=aimAreaPreviewForAction(
    pendingAimAction,
    aimCursor
  );

  if(!preview?.cells?.length){
    return;
  }

  let fill="rgba(127,151,255,0.16)";
  let stroke="rgba(155,180,255,0.72)";

  if(preview.tone==="damage"){
    fill="rgba(255,86,61,0.20)";
    stroke="rgba(255,146,112,0.92)";
  }else if(preview.tone==="terrain"){
    fill="rgba(231,206,104,0.18)";
    stroke="rgba(242,222,135,0.78)";
  }else if(preview.tone==="fog"){
    fill="rgba(198,217,224,0.19)";
    stroke="rgba(220,235,240,0.78)";
  }

  ctx.save();

  for(const cell of preview.cells){
    const top=hexScreenVertices(cell.x,cell.y);
    polygonPath(top);
    ctx.fillStyle=fill;
    ctx.fill();
    ctx.strokeStyle=stroke;
    ctx.lineWidth=1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function addAreaEffect(effect){
  if(!game) return null;
  if(!Array.isArray(game.areaEffects)) game.areaEffects=[];
  game.areaEffects.push(effect);
  draw();
  return effect;
}

function onUnitDamaged(unit,damage){
  if(!unit || damage<=0) return;

  if(getUnitEffect(unit,"sleep")){
    removeUnitEffect(unit,"sleep");
    log(`${unit.name} awakens because it was wounded.`,"system");
  }

  const armor=getUnitEffect(unit,"armor-spell");
  if(armor){
    armor.data.damageTaken=
      (Number(armor.data.damageTaken)||0)+damage;

    if(
      armor.data.damageTaken>
      (Number(armor.data.damageLimit)||0)
    ){
      removeUnitEffect(unit,"armor-spell");
      log(`${unit.name}'s Armor spell collapses after cumulative damage.`,"system");
    }
  }
}

function applyBlindEffect(unit,rounds,sourceName="Light"){
  addUnitEffect(unit,{
    id:"blind",
    name:"Blinded",
    kind:"debuff",
    expiresRound:game.round+Math.max(1,rounds),
    detail:`${sourceName}: −4 attacks, −4 saves, AC worsened by 4`,
    data:{sourceName}
  });
}

function applyProneEffect(unit,rounds=1,sourceName="Grease"){
  addUnitEffect(unit,{
    id:"prone",
    name:"Prone",
    kind:"debuff",
    expiresRound:game.round+Math.max(1,rounds),
    detail:`${sourceName}: knocked down`,
    data:{sourceName}
  });
}

function applyUnconsciousEffect(unit,rounds,sourceName){
  addUnitEffect(unit,{
    id:"unconscious",
    name:"Unconscious",
    kind:"debuff",
    expiresRound:game.round+Math.max(1,rounds),
    detail:`${sourceName}: unable to act`,
    data:{sourceName}
  });

  /* R104: unconsciousness now owns a persistent battlefield status VFX. */
  ensurePersistentStatusFxLoop();
}

function applyConfusionEffect(unit,rounds=1,sourceName="Confusion"){
  addUnitEffect(unit,{
    id:"confusion",
    name:"Confused",
    kind:"debuff",
    expiresRound:game.round+Math.max(1,rounds),
    detail:`${sourceName}: confused / disoriented`,
    data:{sourceName}
  });

  /* R104: future confusion-producing spells can use this shared helper. */
  ensurePersistentStatusFxLoop();
}

function applyStunnedEffect(unit,rounds=1,sourceName="Color Spray"){
  addUnitEffect(unit,{
    id:"stunned",
    name:"Stunned",
    kind:"debuff",
    expiresRound:game.round+Math.max(1,rounds),
    detail:`${sourceName}: unable to act`,
    data:{sourceName}
  });
}

/*
  R150 — Volumetric spell propagation
  -----------------------------------
  Many spell areas represent a fixed amount of magical volume rather than a
  shape that can simply pass through solid architecture. The engine keeps the
  spell's normal open-field footprint when unobstructed. If walls cut that
  footprint apart, inaccessible volume is re-routed through open neighboring
  hex transitions until the same cell-volume budget is exhausted.

  Architectural wall segments block this flow by default. Future door/window
  segments can opt out with `blocksVolume:false`, allowing fire/fog to pass
  through the opening even when movement rules differ.
*/
function volumetricCellUsable(x,y){
  return inside(x,y) && !walls.has(key(x,y));
}

function architecturalWallBlocksVolumeStep(from,to){
  if(!from || !to || !architecturalWalls.length) return false;

  return architecturalWallBlocksWorldLine(
    worldPointForHex(from.x,from.y),
    worldPointForHex(to.x,to.y),
    "volume"
  );
}

function volumetricStepOpen(from,to){
  return (
    !!from &&
    !!to &&
    volumetricCellUsable(to.x,to.y) &&
    !architecturalWallBlocksVolumeStep(from,to)
  );
}

function uniqueHexCells(cells){
  const result=[];
  const seen=new Set();

  for(const cell of cells || []){
    if(!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue;
    const k=key(cell.x,cell.y);
    if(seen.has(k)) continue;
    seen.add(k);
    result.push({x:cell.x,y:cell.y});
  }

  return result;
}

function volumetricSpreadCells(origin,nominalCells,options={}){
  const nominal=uniqueHexCells(nominalCells);
  if(!nominal.length || !origin) return [];

  /* The original footprint defines how much magical volume exists. */
  const budget=Math.max(1,Number(options.volumeCellBudget)||nominal.length);
  const nominalKeys=new Set(nominal.map(cell=>key(cell.x,cell.y)));
  const result=[];
  const resultKeys=new Set();

  function addResult(cell){
    const k=key(cell.x,cell.y);
    if(resultKeys.has(k)) return false;
    if(!volumetricCellUsable(cell.x,cell.y)) return false;
    resultKeys.add(k);
    result.push({x:cell.x,y:cell.y});
    return true;
  }

  /*
    Start at the spell's actual origin. If the chosen point lies on a coarse
    blocked terrain hex, use the closest usable cell from the nominal volume.
  */
  let seed=null;
  if(
    nominalKeys.has(key(origin.x,origin.y)) &&
    volumetricCellUsable(origin.x,origin.y)
  ){
    seed={x:origin.x,y:origin.y};
  }else{
    seed=nominal
      .filter(cell=>volumetricCellUsable(cell.x,cell.y))
      .sort((a,b)=>
        hexDistance(origin,a)-hexDistance(origin,b) ||
        a.x-b.x || a.y-b.y
      )[0] || null;
  }

  if(!seed) return [];

  /*
    First preserve every nominal cell that is connected to the spell origin
    without crossing a volume-blocking wall. In an open field this retains the
    exact legacy footprint with no reshaping at all.
  */
  const nominalQueue=[seed];
  const nominalSeen=new Set([key(seed.x,seed.y)]);
  addResult(seed);

  for(let qi=0;qi<nominalQueue.length;qi++){
    const cur=nominalQueue[qi];

    for(const dir of HEX_DIRS){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);
      if(nominalSeen.has(nk) || !nominalKeys.has(nk)) continue;
      if(!volumetricStepOpen(cur,next)) continue;

      nominalSeen.add(nk);
      nominalQueue.push(next);
      addResult(next);
    }
  }

  /*
    Any volume that a wall displaced now spills from the reachable portion of
    the effect, flowing through doors/openings and around corners one hex step
    at a time until its original volume budget is filled.
  */
  if(result.length<budget){
    const queue=result.map(cell=>({x:cell.x,y:cell.y}));
    const searched=new Set(resultKeys);

    for(let qi=0;qi<queue.length && result.length<budget;qi++){
      const cur=queue[qi];

      for(const dir of HEX_DIRS){
        if(result.length>=budget) break;

        const next={x:cur.x+dir.x,y:cur.y+dir.y};
        const nk=key(next.x,next.y);
        if(searched.has(nk)) continue;
        searched.add(nk);

        if(!volumetricStepOpen(cur,next)) continue;

        queue.push(next);
        addResult(next);
      }
    }
  }

  /*
    Record path distance through the final filled volume. Fireball uses this to
    shape its visual dome even when the blast snakes through a doorway.
  */
  const finalKeys=new Set(result.map(cell=>key(cell.x,cell.y)));
  const distanceByKey=new Map([[key(seed.x,seed.y),0]]);
  const distanceQueue=[seed];

  for(let qi=0;qi<distanceQueue.length;qi++){
    const cur=distanceQueue[qi];
    const curDistance=distanceByKey.get(key(cur.x,cur.y)) || 0;

    for(const dir of HEX_DIRS){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);
      if(!finalKeys.has(nk) || distanceByKey.has(nk)) continue;
      if(!volumetricStepOpen(cur,next)) continue;

      distanceByKey.set(nk,curDistance+1);
      distanceQueue.push(next);
    }
  }

  return result.slice(0,budget).map(cell=>({
    ...cell,
    volumeDistance:
      distanceByKey.get(key(cell.x,cell.y)) ?? hexDistance(seed,cell)
  }));
}

/*
  R152 — AD&D 2e confined-space Fireball volume
  ------------------------------------------------
  The classic confined-space rule treats Fireball as roughly 33,000 cubic feet,
  i.e. about thirty-three 10' x 10' x 10' cubes. Adventure Party's tactical map
  is 2D, so an indoor 10-foot hex is used as one such volume unit.

  Open-field Fireball remains the existing radius-2 / 19-hex footprint.
  When the detonation point is indoors, the spell first fills up to 33 reachable
  indoor hex-volumes. If an opening lets the blast spill outdoors, only the
  remaining indoor volume is converted to outdoor area at the ratio 19 / 33.
*/
const FIREBALL_INDOOR_VOLUME_UNITS=33;
const FIREBALL_OUTDOOR_HEX_EQUIVALENT=19;

function fireballHexEnvironment(cell){
  if(!cell) return "outdoor";
  return environmentAtWorldPoint(worldPointForHex(cell.x,cell.y));
}

function fireballIndoorBlastCells(targetHex){
  if(!targetHex) return [];

  const seed={x:targetHex.x,y:targetHex.y};
  if(
    fireballHexEnvironment(seed)!=="indoor" ||
    !volumetricCellUsable(seed.x,seed.y)
  ){
    return [];
  }

  /*
    One indoor tactical hex consumes one 10' cube of the 33-cube budget.
    Once the wavefront crosses outdoors, one outdoor hex consumes 33/19 of
    those indoor units. Equivalently, whatever budget remains is reduced by
    the requested 19/33 indoor-to-outdoor spread ratio.
  */
  const outdoorUnitCost=
    FIREBALL_INDOOR_VOLUME_UNITS/FIREBALL_OUTDOOR_HEX_EQUIVALENT;
  let usedVolume=0;

  const result=[];
  const seen=new Set();
  const queue=[{x:seed.x,y:seed.y,volumeDistance:0}];
  seen.add(key(seed.x,seed.y));

  for(let qi=0;qi<queue.length;qi++){
    const cur=queue[qi];
    const environment=fireballHexEnvironment(cur);
    const cellCost=environment==="indoor" ? 1 : outdoorUnitCost;

    if(usedVolume+cellCost>FIREBALL_INDOOR_VOLUME_UNITS+1e-9){
      continue;
    }

    usedVolume+=cellCost;
    result.push({
      x:cur.x,
      y:cur.y,
      volumeDistance:cur.volumeDistance,
      volumeEnvironment:environment,
      volumeCost:cellCost
    });

    for(const dir of HEX_DIRS){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);
      if(seen.has(nk)) continue;
      if(!volumetricStepOpen(cur,next)) continue;

      seen.add(nk);
      queue.push({
        x:next.x,
        y:next.y,
        volumeDistance:cur.volumeDistance+1
      });
    }
  }

  return result;
}


function fireballBlastCells(targetHex){
  const radius=fireballRadiusHexes();
  const nominal=hexesWithinRadius(targetHex,radius);

  if(fireballHexEnvironment(targetHex)==="indoor"){
    const confined=fireballIndoorBlastCells(targetHex);
    if(confined.length) return confined;
  }

  /* Outdoor cast: retain the established 19-hex open-field behavior. */
  return volumetricSpreadCells(targetHex,nominal,{
    volumeCellBudget:nominal.length
  });
}

function wallOfFogAutoOrientationIndex(caster,targetHex){
  const directions=HEX_DIRS;
  const targetVector=directionVectorForAim(caster,targetHex);
  let bestIndex=0;
  let bestDot=-Infinity;

  const from=hexCenter(caster.x,caster.y);

  for(let i=0;i<directions.length;i++){
    const d=directions[i];
    const to=hexCenter(caster.x+d.x,caster.y+d.y);
    const vx=to.x-from.x;
    const vy=to.y-from.y;
    const dot=vx*targetVector.x+vy*targetVector.y;

    if(dot>bestDot){
      bestDot=dot;
      bestIndex=i;
    }
  }

  return bestIndex;
}

function wallOfFogGeometry(caster,targetHex,casterLevel,orientationIndex=null){
  const directions=HEX_DIRS;
  const autoIndex=wallOfFogAutoOrientationIndex(caster,targetHex);
  const bestIndex=Number.isInteger(orientationIndex)
    ? ((orientationIndex%6)+6)%6
    : autoIndex;

  const wallDirection=directions[(bestIndex+2)%6];
  const depthDirection=directions[bestIndex];
  const length=Math.max(2,2+Math.floor(casterLevel));
  const half=Math.floor(length/2);

  return {wallDirection,depthDirection,length,half,orientationIndex:bestIndex};
}

function wallOfFogOrientationLabel(orientationIndex){
  const index=((Number(orientationIndex)||0)%6+6)%6;
  const wallIndex=(index+2)%6;
  const oppositeIndex=(wallIndex+3)%6;
  return `${HEX_DIRS[wallIndex].name}/${HEX_DIRS[oppositeIndex].name}`;
}

function nominalWallOfFogCells(caster,targetHex,casterLevel,orientationIndex=null){
  const {wallDirection,depthDirection,half}=wallOfFogGeometry(
    caster,
    targetHex,
    casterLevel,
    orientationIndex
  );
  const cells=[];
  const seen=new Set();

  for(let i=-half;i<=half;i++){
    const bx=targetHex.x+wallDirection.x*i;
    const by=targetHex.y+wallDirection.y*i;

    for(let depth=0;depth<2;depth++){
      const x=bx+depthDirection.x*depth;
      const y=by+depthDirection.y*depth;
      const k=key(x,y);

      if(seen.has(k)) continue;
      seen.add(k);
      cells.push({x,y});
    }
  }

  return cells;
}

function createWallOfFogCells(caster,targetHex,casterLevel,orientationIndex=null){
  const {wallDirection,depthDirection,half}=wallOfFogGeometry(
    caster,
    targetHex,
    casterLevel,
    orientationIndex
  );

  const cells=[];
  const seen=new Set();

  function cellOpen(cell){
    return !!cell &&
      inside(cell.x,cell.y) &&
      !isWall(cell.x,cell.y);
  }

  function addCell(cell){
    if(!cellOpen(cell)) return false;
    const k=key(cell.x,cell.y);
    if(seen.has(k)) return true;
    seen.add(k);
    cells.push({x:cell.x,y:cell.y});
    return true;
  }

  function addColumn(base){
    if(!addCell(base)) return false;

    const depthCell={
      x:base.x+depthDirection.x,
      y:base.y+depthDirection.y
    };

    if(
      cellOpen(depthCell) &&
      !architecturalWallBlocksStep(base,depthCell)
    ){
      addCell(depthCell);
    }

    return true;
  }

  /*
    R153: Wall of Fog is a wall, not a conserved/flood-filled volume. Start at
    the targeted wall segment and extend independently in both lateral
    directions. Each side terminates the moment it reaches the map edge, a
    blocked hex, or an architectural wall transition. Nothing wraps around the
    obstruction and no displaced fog is reallocated elsewhere.
  */
  if(!cellOpen(targetHex)) return [];
  addColumn({x:targetHex.x,y:targetHex.y});

  for(const sign of [-1,1]){
    let previous={x:targetHex.x,y:targetHex.y};

    for(let step=1;step<=half;step++){
      const next={
        x:targetHex.x+wallDirection.x*step*sign,
        y:targetHex.y+wallDirection.y*step*sign
      };

      if(!cellOpen(next)) break;
      if(architecturalWallBlocksStep(previous,next)) break;

      addColumn(next);
      previous=next;
    }
  }

  return cells;
}


function drawSpellAreaEffects(){
  if(!game?.areaEffects?.length) return;

  /*
    R94: persistent ground effects remain on the floor pass. Fog is no longer
    painted as a translucent floor decal; it is inserted into the actor/depth
    sort as a volumetric obstruction by drawFogVolumeCell().
  */
  for(const effect of game.areaEffects){
    if(effect.type!=="grease") continue;

    for(const cell of effect.cells || []){
      if(!inside(cell.x,cell.y)) continue;
      const top=hexScreenVertices(cell.x,cell.y);
      polygonPath(top);
      ctx.fillStyle="rgba(164,150,75,0.32)";
      ctx.fill();
      ctx.strokeStyle="rgba(230,214,120,0.85)";
      ctx.lineWidth=2;
      ctx.stroke();
    }
  }
}

function drawFogVolumeCell(cell){
  if(
    !cell ||
    !inside(cell.x,cell.y) ||
    !isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  ){
    return;
  }

  const c=hexCenter(cell.x,cell.y);
  const height=HEX_W; // R94: approximately one hex-width tall.
  const top=hexScreenVertices(cell.x,cell.y);
  const time=performance.now();
  const seedBase=(Math.abs(cell.x*73856093 ^ cell.y*19349663)>>>0);

  ctx.save();
  /*
    R150: Wall of Fog remains a gameplay LOS obstruction, but its rendered
    volume is 50% transparent so terrain and any depth-visible sprites can be
    seen through the cloud.
  */
  ctx.globalAlpha=0.5;

  /*
    R151: animate the fog so the body subtly churns and breathes rather than
    reading as a static stack of mist. The whole cell still composites at
    half opacity for readability.
  */
  polygonPath(top);
  ctx.fillStyle="rgba(207,216,218,0.84)";
  ctx.fill();

  const drift=Math.sin((time*0.0017)+(cell.x*0.61)+(cell.y*0.43))*3.0;
  const grad=ctx.createLinearGradient(c.x,c.y-height-4,c.x,c.y+7);
  grad.addColorStop(0,"rgba(236,241,242,0.60)");
  grad.addColorStop(0.45,"rgba(214,223,225,0.82)");
  grad.addColorStop(1,"rgba(188,199,201,0.88)");
  ctx.fillStyle=grad;
  ctx.fillRect(c.x-HEX_W*0.48+drift*0.18,c.y-height-2,HEX_W*0.96,height+10);

  /* Billowing animated puffs. */
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
    ctx.fillStyle=i%2
      ? `rgba(225,232,233,${0.74*alphaPulse})`
      : `rgba(197,207,209,${0.78*alphaPulse})`;
    ctx.fill();
  }

  /* Bright animated cap and side accents retain readable volume. */
  const capBob=Math.sin(time*0.0022 + seedBase*0.000002)*3;
  ctx.beginPath();
  ctx.ellipse(c.x+drift*0.14,c.y-height+5+capBob*0.28,HEX_W*0.42,12,0,0,Math.PI*2);
  ctx.fillStyle="rgba(242,246,247,0.68)";
  ctx.fill();

  ctx.strokeStyle="rgba(236,242,243,0.52)";
  ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(c.x-HEX_W*0.42+drift*0.12,c.y-height+8);
  ctx.lineTo(c.x-HEX_W*0.42+drift*0.12,c.y-2);
  ctx.moveTo(c.x+HEX_W*0.42+drift*0.12,c.y-height+8);
  ctx.lineTo(c.x+HEX_W*0.42+drift*0.12,c.y-2);
  ctx.stroke();

  ctx.restore();
}

function drawFogEffectOutline(effect){
  if(!effect || effect.type!=="fog" || !Array.isArray(effect.cells) || !effect.cells.length){
    return;
  }

  const visible=effect.cells.filter(cell=>
    inside(cell.x,cell.y) &&
    isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  );
  if(!visible.length) return;

  const time=performance.now();
  const centers=visible.map(cell=>hexCenter(cell.x,cell.y));
  const minX=Math.floor(Math.min(...centers.map(c=>c.x)) - HEX_W*1.3);
  const maxX=Math.ceil(Math.max(...centers.map(c=>c.x)) + HEX_W*1.3);
  const minY=Math.floor(Math.min(...centers.map(c=>c.y)) - HEX_W*1.5);
  const maxY=Math.ceil(Math.max(...centers.map(c=>c.y)) + HEX_W*0.3);
  const width=Math.max(1,maxX-minX+1);
  const height=Math.max(1,maxY-minY+1);

  const bodyCanvas=document.createElement("canvas");
  bodyCanvas.width=width;
  bodyCanvas.height=height;
  const bodyCtx=bodyCanvas.getContext("2d");
  bodyCtx.imageSmoothingEnabled=false;

  for(const cell of visible){
    const c=hexCenter(cell.x,cell.y);
    const seedBase=(Math.abs(cell.x*73856093 ^ cell.y*19349663)>>>0);
    const drift=Math.sin((time*0.0017)+(cell.x*0.61)+(cell.y*0.43))*3.0;
    const lx=-minX;
    const ly=-minY;

    const top=hexScreenVertices(cell.x,cell.y);
    bodyCtx.beginPath();
    bodyCtx.moveTo(top[0].x+lx,top[0].y+ly);
    for(let i=1;i<top.length;i++) bodyCtx.lineTo(top[i].x+lx,top[i].y+ly);
    bodyCtx.closePath();
    bodyCtx.fillStyle='rgba(0,0,0,1)';
    bodyCtx.fill();

    bodyCtx.fillRect(c.x-HEX_W*0.48+drift*0.18+lx,c.y-HEX_W-2+ly,HEX_W*0.96,HEX_W+10);

    for(let i=0;i<8;i++){
      const a=((seedBase + i*2654435761)>>>0);
      const fx=((a & 1023)/1023)-0.5;
      const fy=(((a>>>10)&1023)/1023);
      const rx=16+((a>>>20)&7);
      const ry=9+((a>>>23)&7);
      const phase=(a & 255)*0.023;
      const sway=Math.sin(time*0.0021+phase)*4.0;
      const lift=Math.cos(time*0.0018+phase*1.7)*2.3;
      const px=c.x+fx*HEX_W*0.70+sway+lx;
      const py=c.y-8-fy*(HEX_W-12)+lift+ly;
      bodyCtx.beginPath();
      bodyCtx.ellipse(px,py,rx,ry,0,0,Math.PI*2);
      bodyCtx.fill();
    }

    const capBob=Math.sin(time*0.0022 + seedBase*0.000002)*3;
    bodyCtx.beginPath();
    bodyCtx.ellipse(c.x+drift*0.14+lx,c.y-HEX_W+5+capBob*0.28+ly,HEX_W*0.42,12,0,0,Math.PI*2);
    bodyCtx.fill();
  }

  const outlineCanvas=document.createElement("canvas");
  outlineCanvas.width=bodyCanvas.width;
  outlineCanvas.height=bodyCanvas.height;
  const outlineCtx=outlineCanvas.getContext("2d");
  outlineCtx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      outlineCtx.drawImage(bodyCanvas,dx,dy);
    }
  }

  outlineCtx.globalCompositeOperation="destination-out";
  outlineCtx.drawImage(bodyCanvas,0,0);
  outlineCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=0.82;
  ctx.drawImage(outlineCanvas,minX,minY);
  ctx.restore();
}


function greaseSaveForUnit(unit,sourceUnit=null){
  const save=rollSpellSave(unit,sourceUnit);

  if(save.success){
    log(
      `${unit.name} keeps footing in Grease: ${save.modifiedRoll} vs ${save.targetNumber}.`,
      "system"
    );
    removeUnitEffect(unit,"prone");
    return true;
  }

  applyProneEffect(unit,1,"Grease");
  log(
    `${unit.name} falls in Grease: ${save.modifiedRoll} vs ${save.targetNumber}.`,
    "bad"
  );

  return false;
}

function handleTurnControlEffects(actor){
  if(!actor || !actor.alive) return false;

  if(getUnitEffect(actor,"sleep")){
    setCombatMessage(`${actor.name} is asleep and cannot act.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    setUnitActionBanner(actor,"Sleeping");
    aiTimer=setTimeout(()=>{
      aiTimer=null;
      if(!game.over) endTurn();
    },Math.max(350,combatActionPauseRemaining()));
    return true;
  }

  if(getUnitEffect(actor,"unconscious")){
    setCombatMessage(`${actor.name} is unconscious and cannot act.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    setUnitActionBanner(actor,"Unconscious");
    aiTimer=setTimeout(()=>{
      aiTimer=null;
      if(!game.over) endTurn();
    },Math.max(350,combatActionPauseRemaining()));
    return true;
  }

  if(getUnitEffect(actor,"stunned")){
    setCombatMessage(`${actor.name} is stunned and loses this action.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    setUnitActionBanner(actor,"Stunned");
    aiTimer=setTimeout(()=>{
      aiTimer=null;
      if(!game.over) endTurn();
    },Math.max(350,combatActionPauseRemaining()));
    return true;
  }

  if(occupiedHexes(actor).some(cell=>hasGreaseAtHex(cell.x,cell.y))){
    const stood=greaseSaveForUnit(actor,game.player);

    if(!stood){
      setCombatMessage(`${actor.name} slips and falls in Grease.`,COMBAT_MESSAGE_MIN_HOLD_MS);
      setUnitActionBanner(actor,"Falling");
      aiTimer=setTimeout(()=>{
        aiTimer=null;
        if(!game.over) endTurn();
      },Math.max(350,combatActionPauseRemaining()));
      return true;
    }
  }

  const spook=getUnitEffect(actor,"spook");
  if(spook){
    const source=getUnitById(spook.data?.sourceUnitId) || game.player;
    const save=rollSpellSave(actor,source);

    if(save.success){
      removeUnitEffect(actor,"spook");
      log(`${actor.name} overcomes Spook and stops fleeing.`,"system");
    }else{
      setUnitActionBanner(actor,"Fleeing from Spook");

      aiTimer=setTimeout(async()=>{
        aiTimer=null;

        const sourceNow=getUnitById(spook.data?.sourceUnitId) || game.player;

        await animateEntitySteps(
          actor,
          actor.move || 6,
          ()=>fleeStep(actor,sourceNow),
          105
        );

        if(!game.over) endTurn();
      },120);

      return true;
    }
  }

  return false;
}


let spellbookActiveLevel=1;

function spellLevelLabel(level){
  if(level===1) return "1st Level";
  if(level===2) return "2nd Level";
  if(level===3) return "3rd Level";
  return `${level}th Level`;
}

function formatSpellRange(spell){
  if(!spell?.range) return "Special";

  if(spell.range.type==="self") return "0 / caster";
  if(spell.range.type==="touch") return "Touch";
  if(Number.isFinite(spell.range.fixedFeet)) return `${spell.range.fixedFeet} feet`;
  if(Number.isFinite(spell.range.fixedYards)) return `${spell.range.fixedYards} yards`;

  if(
    Number.isFinite(spell.range.baseYards) &&
    Number.isFinite(spell.range.yardsPerCasterLevel)
  ){
    return `${spell.range.baseYards} yards + ${spell.range.yardsPerCasterLevel} yards/level`;
  }

  return "Special";
}

function spellDamageSummary(spell){
  return spell?.damageSummary || "—";
}

function renderSpellBook(level=spellbookActiveLevel){
  const tabs=document.getElementById("spellbookTabs");
  const content=document.getElementById("spellbookContent");

  if(!tabs || !content) return;

  const spells=Object.values(SPELL_CATALOG)
    .slice()
    .sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name));

  const levels=[...new Set(spells.map(spell=>spell.level))]
    .sort((a,b)=>a-b);

  if(!levels.includes(level)){
    level=levels[0] || 1;
  }

  spellbookActiveLevel=level;

  tabs.innerHTML=levels.map(spellLevel=>
    `<button class="spellbook-tab ${spellLevel===level ? "active" : ""}" `+
    `data-spell-level="${spellLevel}" type="button">`+
    `${spellLevelLabel(spellLevel)}`+
    `</button>`
  ).join("");

  const selected=spells.filter(spell=>spell.level===level);

  content.innerHTML=selected.map(spell=>
    `<article class="spell-card">`+
      `<header class="spell-card-title">`+
        `<h2>${spell.name}</h2>`+
        `<span>${spell.spellGroup} ${spell.level} — ${spell.school}</span>`+
      `</header>`+
      `<div class="spell-card-body">`+
        `<div class="spell-stat-grid">`+
          `<span>Range</span><span>${formatSpellRange(spell)}</span>`+
          `<span>Incantation</span><span>${spell.incantation || "—"}</span>`+
          `<span>Components</span><span>${spell.components.join(", ")}</span>`+
          `<span>Duration</span><span>${spell.duration}</span>`+
          `<span>Casting Time</span><span>${spell.castingTime}</span>`+
          `<span>Area of Effect</span><span>${spell.areaOfEffect}</span>`+
          `<span>Saving Throw</span><span>${spell.savingThrow}</span>`+
          `<span>Damage / Effect</span><span>${spellDamageSummary(spell)}</span>`+
          `<span>Combat</span><span class="spell-combat-note">${spell.combatImplemented ? "Implemented" : "Catalog only"}</span>`+
          `${spell.friendlyFire ? `<span>Friendly Fire</span><span>YES — all units in the damaging AoE are valid targets</span>` : ""}`+
          `${spell.materialComponent ? `<span>Material</span><span>${spell.materialComponent}</span>` : ""}`+
        `</div>`+
        `<div class="spell-description">${spell.description || ""}</div>`+
        `<div class="spell-source">Source: ${spell.source.book}, printed page ${spell.source.printedPage}.</div>`+
      `</div>`+
    `</article>`
  ).join("");
}

let classbookActiveClass="fighter";

function classbookTabButton(id,label){
  return `<button class="spellbook-tab ${id===classbookActiveClass ? "active" : ""}" `+
    `data-class-id="${id}" type="button">${label}</button>`;
}

function classSectionHeading(title){
  return `<h3 style="color:var(--gold);margin:14px 0 7px">${title}</h3>`;
}

function savingThrowBandRows(bands){
  return bands.map(row=>
    `<tr>`+
      `<td>${row.max===Infinity ? `${row.min}+` : `${row.min}-${row.max}`}</td>`+
      `<td>${row.death}</td><td>${row.wand}</td><td>${row.poly}</td><td>${row.breath}</td><td>${row.spell}</td>`+
    `</tr>`
  ).join("");
}

function savingThrowTableHtml(bands){
  return `<div style="overflow:auto"><table class="class-reference-table">`+
    `<thead><tr><th>Levels</th><th>Para/Poison/Death</th><th>Rod/Staff/Wand</th><th>Petrify/Polymorph</th><th>Breath</th><th>Spell</th></tr></thead>`+
    `<tbody>${savingThrowBandRows(bands)}</tbody></table></div>`;
}

const WARRIOR_SAVING_THROW_BANDS=[
  {min:1,max:2,death:14,wand:16,poly:15,breath:17,spell:17},
  {min:3,max:4,death:13,wand:15,poly:14,breath:16,spell:16},
  {min:5,max:6,death:11,wand:13,poly:12,breath:13,spell:14},
  {min:7,max:8,death:10,wand:12,poly:11,breath:12,spell:13},
  {min:9,max:10,death:8,wand:10,poly:9,breath:9,spell:11},
  {min:11,max:12,death:7,wand:9,poly:8,breath:8,spell:10},
  {min:13,max:14,death:5,wand:7,poly:6,breath:5,spell:8},
  {min:15,max:16,death:4,wand:6,poly:5,breath:4,spell:7},
  {min:17,max:Infinity,death:3,wand:5,poly:4,breath:4,spell:6}
];

function fighterClassBookHtml(){
  const levels=FIGHTER_LEVELS.map(row=>
    `<tr><td>${row.level}</td><td>${row.xp.toLocaleString()}</td><td>${row.thaco}</td>`+
    `<td>${row.hd}</td><td>${row.attacks}</td><td>${row.wp}</td><td>${row.nwp}</td></tr>`
  ).join("");

  return `<article class="spell-card">`+
    `<header class="spell-card-title"><h2>Fighter</h2><span>Warrior Class</span></header>`+
    `<div class="spell-card-body">`+
      `<div class="class-reference-grid">`+
        `<div><b>Ability Requirement</b><br>Strength ${FIGHTER_CLASS.minimumStrength}</div>`+
        `<div><b>Prime Requisite</b><br>${FIGHTER_CLASS.primeRequisite}; ${FIGHTER_CLASS.primeRequisiteXpBonusThreshold}+ earns +10% XP</div>`+
        `<div><b>Races / Alignment</b><br>All standard PC races; any alignment</div>`+
        `<div><b>Hit Points</b><br>d${FIGHTER_CLASS.hitDie} through level ${FIGHTER_CLASS.hitDiceThroughLevel}; +${FIGHTER_CLASS.hpPerLevelAfterHitDice}/level thereafter</div>`+
        `<div><b>Armor / Shields</b><br>${FIGHTER_CLASS.armor}; ${FIGHTER_CLASS.shields}</div>`+
        `<div><b>Weapons</b><br>${FIGHTER_CLASS.weapons}</div>`+
        `<div><b>Weapon Proficiencies</b><br>${FIGHTER_CLASS.initialWeaponProficiencies} initially; +1 after every ${FIGHTER_CLASS.weaponProficiencyRate} levels advanced; nonproficiency ${FIGHTER_CLASS.weaponNonproficiencyPenalty}</div>`+
        `<div><b>Nonweapon Proficiencies</b><br>${FIGHTER_CLASS.initialNonweaponProficiencies} initially; +1 after every ${FIGHTER_CLASS.nonweaponProficiencyRate} levels advanced</div>`+
      `</div>`+
      classSectionHeading("Level Progression")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th><th>XP</th><th>THAC0</th><th>HD / Fixed HP</th><th>Base Attacks</th><th>WP</th><th>NWP</th></tr></thead><tbody>${levels}</tbody></table></div>`+
      classSectionHeading("Saving Throws")+savingThrowTableHtml(WARRIOR_SAVING_THROW_BANDS)+
      classSectionHeading("Fighter Abilities")+
      `<div class="class-reference-grid">`+
        `<div><b>Weapon Specialization</b><br>Available to single-class Fighters. Melee specialization improves attack/damage and attack rate.</div>`+
        `<div><b>Warrior Sweep</b><br>${FIGHTER_CLASS.sweepAttackRule}; target must be ${FIGHTER_CLASS.sweepTargetRule}; ${FIGHTER_CLASS.sweepWeaponRule}.</div>`+
        `<div><b>Stronghold / Followers</b><br>At level ${FIGHTER_CLASS.followerLevel}, a Fighter who establishes a stronghold can attract followers.</div>`+
        `<div><b>Positional Combat</b><br>Rear attacks are a core combat rule shared by classes; they are not a Fighter-only ability.</div>`+
      `</div>`+
      `<div class="class-reference-note">Source trace: AD&amp;D 2nd Edition Player's Handbook Warrior/Fighter rules, Tables 14-16, 34, 53/54, and 60. Adventure Party's automatic Sweep remains the project's explicit 2e combat interpretation.</div>`+
    `</div></article>`;
}

function mageClassBookHtml(){
  const levels=MAGE_LEVELS.map(row=>
    `<tr><td>${row.level}</td><td>${row.xp.toLocaleString()}</td><td>${row.thaco}</td><td>${row.hd}</td><td>${row.wp}</td><td>${row.nwp}</td></tr>`
  ).join("");

  const spellRows=MAGE_LEVELS.map(row=>
    `<tr><td>${row.level}</td>${row.spellSlots.map(value=>`<td>${value || "—"}</td>`).join("")}</tr>`
  ).join("");

  const intelligenceRows=Object.entries(MAGE_INTELLIGENCE_TABLE)
    .filter(([score])=>Number(score)>=9)
    .map(([score,row])=>
      `<tr><td>${score}</td><td>${row.maxSpellLevel}</td><td>${row.chanceToLearn}%</td>`+
      `<td>${row.maxSpellsPerLevel===Infinity ? "All" : row.maxSpellsPerLevel}</td><td>${row.spellImmunity || "—"}</td></tr>`
    ).join("");

  const specialistRows=Object.values(WIZARD_SPECIALIST_SCHOOLS).map(row=>
    `<tr><td>${row.name}</td><td>${row.school}</td><td>${row.races.join(", ")}</td>`+
    `<td>${row.minimumAbility.score} ${row.minimumAbility.ability}</td><td>${row.oppositionSchools.join(", ")}</td></tr>`
  ).join("");

  return `<article class="spell-card">`+
    `<header class="spell-card-title"><h2>Mage</h2><span>Wizard Class — Generalist</span></header>`+
    `<div class="spell-card-body">`+
      `<div class="class-reference-grid">`+
        `<div><b>Ability Requirement</b><br>Intelligence ${MAGE_CLASS.minimumIntelligence}</div>`+
        `<div><b>Prime Requisite</b><br>${MAGE_CLASS.primeRequisite}; ${MAGE_CLASS.primeRequisiteXpBonusThreshold}+ earns +10% XP</div>`+
        `<div><b>Races / Alignment</b><br>${MAGE_CLASS.racesAllowed.join(", ")}; any alignment</div>`+
        `<div><b>Hit Points</b><br>d${MAGE_CLASS.hitDie} through level ${MAGE_CLASS.hitDiceThroughLevel}; +${MAGE_CLASS.hpPerLevelAfterHitDice}/level thereafter</div>`+
        `<div><b>Armor / Shields</b><br>${MAGE_CLASS.armor}; ${MAGE_CLASS.shields}</div>`+
        `<div><b>Weapons</b><br>${MAGE_CLASS.weapons.join(", ")}</div>`+
        `<div><b>Weapon Proficiencies</b><br>${MAGE_CLASS.initialWeaponProficiencies} initially; +1 after every ${MAGE_CLASS.weaponProficiencyRate} levels advanced; nonproficiency ${MAGE_CLASS.weaponNonproficiencyPenalty}</div>`+
        `<div><b>Nonweapon Proficiencies</b><br>${MAGE_CLASS.initialNonweaponProficiencies} initially; +1 after every ${MAGE_CLASS.nonweaponProficiencyRate} levels advanced</div>`+
      `</div>`+
      classSectionHeading("Level Progression")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th><th>XP</th><th>THAC0</th><th>HD / Fixed HP</th><th>WP</th><th>NWP</th></tr></thead><tbody>${levels}</tbody></table></div>`+
      classSectionHeading("Saving Throws")+savingThrowTableHtml(MAGE_SAVING_THROW_BANDS)+
      classSectionHeading("Wizard Spell Slots")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th>${Array.from({length:9},(_,i)=>`<th>${i+1}</th>`).join("")}</tr></thead><tbody>${spellRows}</tbody></table></div>`+
      `<div class="class-reference-note">A memorized spell occupies one slot of its spell level and is expended when cast. A Mage may memorize the same known spell more than once.</div>`+
      classSectionHeading("Intelligence and Spell Learning")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>INT</th><th>Max Spell Lvl</th><th>Learn</th><th>Max Known / Lvl</th><th>Immunity</th></tr></thead><tbody>${intelligenceRows}</tbody></table></div>`+
      classSectionHeading("Spell Book & Memorization")+
      `<div class="class-reference-grid">`+
        `<div><b>Known vs. Memorized</b><br>Known spells are recorded in the spell book; memorized spells are prepared castings.</div>`+
        `<div><b>Study</b><br>Requires a rested mind and spell-book access; ${MAGE_CLASS.studyMinutesPerSpellLevel} minutes × spell level per memorized spell.</div>`+
        `<div><b>Failed Learning</b><br>A failed learn-spell check cannot be retried until the Mage gains a character level.</div>`+
        `<div><b>Research / Items</b><br>Spell research is supported; at level ${MAGE_CLASS.scrollPotionCreationLevel}, Wizards may pen scrolls and brew potions under campaign rules.</div>`+
      `</div>`+
      classSectionHeading("Wizard Schools / Specialists")+
      `<div class="class-reference-note">The Mage is the generalist Wizard. Specialist opposition schools, ability requirements, and learning hooks are recorded, but specialist bonus slots are not yet active.</div>`+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Specialist</th><th>School</th><th>Races</th><th>Minimum</th><th>Opposition</th></tr></thead><tbody>${specialistRows}</tbody></table></div>`+
      `<div class="class-reference-note">Source trace: Player's Handbook Tables 4, 20-22, 34, 53/54, and 60, plus Wizard spell-learning, spell-book, and memorization rules.</div>`+
    `</div></article>`;
}

function clericClassBookHtml(){
  const levels=CLERIC_LEVELS.map(row=>
    `<tr><td>${row.level}</td><td>${row.xp.toLocaleString()}</td><td>${row.thaco}</td><td>${row.hd}</td><td>${row.wp}</td><td>${row.nwp}</td></tr>`
  ).join("");
  const spellRows=CLERIC_LEVELS.map(row=>
    `<tr><td>${row.level}</td>${row.spellSlots.map(value=>`<td>${value || "—"}</td>`).join("")}</tr>`
  ).join("");

  return `<article class="spell-card">`+
    `<header class="spell-card-title"><h2>Cleric</h2><span>Priest Class — Standard Cleric</span></header>`+
    `<div class="spell-card-body">`+
      `<div class="class-reference-grid">`+
        `<div><b>Ability Requirement</b><br>Wisdom ${CLERIC_CLASS.minimumWisdom}</div>`+
        `<div><b>Prime Requisite</b><br>${CLERIC_CLASS.primeRequisite}; ${CLERIC_CLASS.primeRequisiteXpBonusThreshold}+ earns +10% XP</div>`+
        `<div><b>Races</b><br>All</div>`+
        `<div><b>Alignment</b><br>${CLERIC_CLASS.alignments}</div>`+
        `<div><b>Hit Points</b><br>d${CLERIC_CLASS.hitDie} through level ${CLERIC_CLASS.hitDiceThroughLevel}; +${CLERIC_CLASS.hpPerLevelAfterHitDice}/level thereafter</div>`+
        `<div><b>Armor / Shields</b><br>${CLERIC_CLASS.armor}; ${CLERIC_CLASS.shields}</div>`+
        `<div><b>Weapons</b><br>${CLERIC_CLASS.weapons}</div>`+
        `<div><b>Proficiencies</b><br>${CLERIC_CLASS.initialWeaponProficiencies} WP (+1 / ${CLERIC_CLASS.weaponProficiencyRate} levels), nonprof ${CLERIC_CLASS.weaponNonproficiencyPenalty}; ${CLERIC_CLASS.initialNonweaponProficiencies} NWP (+1 / ${CLERIC_CLASS.nonweaponProficiencyRate} levels)</div>`+
      `</div>`+
      classSectionHeading("Level Progression")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th><th>XP</th><th>THAC0</th><th>HD / Fixed HP</th><th>WP</th><th>NWP</th></tr></thead><tbody>${levels}</tbody></table></div>`+
      classSectionHeading("Saving Throws")+savingThrowTableHtml(PRIEST_SAVING_THROW_BANDS)+
      classSectionHeading("Base Priest Spell Slots")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th>${Array.from({length:7},(_,i)=>`<th>${i+1}</th>`).join("")}</tr></thead><tbody>${spellRows}</tbody></table></div>`+
      `<div class="class-reference-note">These are base priest slots before Wisdom bonus spells. Only priests receive bonus spells for high Wisdom. 6th-level priest spells require Wisdom 17; 7th-level spells require Wisdom 18.</div>`+
      classSectionHeading("Spheres of Influence")+
      `<div class="class-reference-grid">`+
        `<div><b>Major Access</b><br>${CLERIC_CLASS.majorSpheres.join(", ")}</div>`+
        `<div><b>Minor Access</b><br>${CLERIC_CLASS.minorSpheres.join(", ")} — only 1st- through 3rd-level spells from a minor sphere</div>`+
        `<div><b>No Standard Access</b><br>${CLERIC_CLASS.excludedSpheres.join(", ")}</div>`+
        `<div><b>Preparation</b><br>Priest spells are received through prayer/faith rather than copied into a Wizard-style spell book.</div>`+
      `</div>`+
      classSectionHeading("Turning Undead")+
      `<div class="class-reference-grid">`+
        `<div><b>Attempt</b><br>One attempt per Cleric per encounter; it consumes the Cleric's action/round and requires freedom to speak and gesture.</div>`+
        `<div><b>Result</b><br>Use the priest level vs. undead type/HD table; a successful result affects ${CLERIC_CLASS.turningAffectedDice} undead, lowest HD first.</div>`+
        `<div><b>T / D</b><br>T is automatic turning; D destroys the affected undead outright.</div>`+
        `<div><b>Evil Clerics</b><br>${CLERIC_CLASS.evilPriestPower}.</div>`+
      `</div>`+
      classSectionHeading("Followers / Stronghold")+
      `<div class="class-reference-grid">`+
        `<div><b>Level ${CLERIC_CLASS.followerLevel}</b><br>With a significant place of worship, the Cleric can attract a fanatically loyal body of followers.</div>`+
        `<div><b>Level ${CLERIC_CLASS.strongholdApprovalLevel}</b><br>The Cleric may receive official approval to establish a religious stronghold.</div>`+
      `</div>`+
      `<div class="class-reference-note"><b>Engine status:</b> R136 adds the reusable Cleric class, progression, priest saves/THAC0, equipment restrictions, alignment/deity validation hook, base spell slots, sphere access, and turning-undead rules metadata. No Cleric is spawned in the current combat test and the priest spell catalog/active turning command will be added separately rather than invented here.</div>`+
      `<div class="class-reference-note">Source trace: Player's Handbook Priest/Cleric rules and Tables 23, 24, 34, 53/54, 60, and 61.</div>`+
    `</div></article>`;
}

function thiefClassBookHtml(){
  const skills=Object.entries(THIEF_CLASS.thievingSkillBaseScores)
    .map(([skill,score])=>`<tr><td>${skill}</td><td>${score}%</td></tr>`).join("");
  const levels=THIEF_LEVELS.map(row=>
    `<tr><td>${row.level}</td><td>${row.xp.toLocaleString()}</td><td>${rogueThaco(row.level)}</td>`+
    `<td>${row.hd}</td><td>${row.backstab}</td><td>${rogueWeaponProficiencySlots(row.level)}</td><td>${rogueNonweaponProficiencySlots(row.level)}</td></tr>`
  ).join("");

  return `<article class="spell-card">`+
    `<header class="spell-card-title"><h2>Thief</h2><span>Rogue Class</span></header>`+
    `<div class="spell-card-body">`+
      `<div class="class-reference-grid">`+
        `<div><b>Ability Requirement</b><br>Dexterity ${THIEF_CLASS.minimumDexterity}</div>`+
        `<div><b>Prime Requisite</b><br>${THIEF_CLASS.primeRequisite}; ${THIEF_CLASS.primeRequisiteXpBonusThreshold}+ earns +10% XP</div>`+
        `<div><b>Races</b><br>${THIEF_CLASS.racesAllowed}</div>`+
        `<div><b>Alignment</b><br>${THIEF_CLASS.alignments}</div>`+
        `<div><b>Hit Points</b><br>d${THIEF_CLASS.hitDie} through level ${THIEF_CLASS.hitDiceThroughLevel}; +${THIEF_CLASS.hpPerLevelAfterHitDice}/level thereafter</div>`+
        `<div><b>Armor / Shields</b><br>${THIEF_CLASS.armor}; ${THIEF_CLASS.shields}</div>`+
        `<div><b>Weapons</b><br>${THIEF_CLASS.weapons.join(", ")}</div>`+
        `<div><b>Proficiencies</b><br>${THIEF_CLASS.initialWeaponProficiencies} WP and ${THIEF_CLASS.initialNonweaponProficiencies} NWP; +1 each after every 4 levels advanced; nonprof ${THIEF_CLASS.weaponNonproficiencyPenalty}</div>`+
      `</div>`+
      classSectionHeading("Level Progression")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Lvl</th><th>XP</th><th>THAC0</th><th>HD / Fixed HP</th><th>Backstab</th><th>WP</th><th>NWP</th></tr></thead><tbody>${levels}</tbody></table></div>`+
      classSectionHeading("Saving Throws")+savingThrowTableHtml(ROGUE_SAVING_THROW_BANDS)+
      classSectionHeading("Backstab")+
      `<div class="class-reference-grid">`+
        `<div><b>Attack Bonus</b><br>+${THIEF_CLASS.backstabAttackBonus} when all Backstab conditions are met</div>`+
        `<div><b>Position / Awareness</b><br>Attack from directly behind a victim unaware of the intended attack</div>`+
        `<div><b>Defense</b><br>Negates the target's shield and beneficial Dexterity AC adjustment</div>`+
        `<div><b>Damage</b><br>Multiply standard weapon damage first; add Strength and magical bonuses afterward</div>`+
        `<div><b>Limits</b><br>${THIEF_CLASS.backstabLimits}</div>`+
        `<div><b>Scroll Use</b><br>At level ${THIEF_CLASS.readScrollsLevel}, limited magical/clerical scroll use begins; ${THIEF_CLASS.readScrollMisreadChance}% chance to misread.</div>`+
      `</div>`+
      classSectionHeading("Thieving Skill Base Scores")+
      `<table class="class-reference-table"><thead><tr><th>Skill</th><th>Base</th></tr></thead><tbody>${skills}</tbody></table>`+
      `<div class="class-reference-note">At 1st level: ${THIEF_CLASS.initialDiscretionarySkillPoints} discretionary points, max ${THIEF_CLASS.initialMaxPerSkill} to one skill. Later levels: +${THIEF_CLASS.levelSkillPoints}, max ${THIEF_CLASS.levelMaxPerSkill} to one skill per level; adjusted cap ${THIEF_CLASS.skillCap}%.</div>`+
      `<div class="class-reference-note"><b>Engine status:</b> rear-sector geometry exists and is ready for Backstab, but no Thief unit is active in the combat test yet.</div>`+
      `<div class="class-reference-note">Source trace: Player's Handbook Rogue/Thief rules and Tables 25-30, 34, 53/54, and 60.</div>`+
    `</div></article>`;
}

function alignmentClassBookHtml(){
  const rows=[
    ["Lawful",ALIGNMENT_SYSTEM.alignments["lawful-good"],ALIGNMENT_SYSTEM.alignments["lawful-neutral"],ALIGNMENT_SYSTEM.alignments["lawful-evil"]],
    ["Neutral",ALIGNMENT_SYSTEM.alignments["neutral-good"],ALIGNMENT_SYSTEM.alignments["true-neutral"],ALIGNMENT_SYSTEM.alignments["neutral-evil"]],
    ["Chaotic",ALIGNMENT_SYSTEM.alignments["chaotic-good"],ALIGNMENT_SYSTEM.alignments["chaotic-neutral"],ALIGNMENT_SYSTEM.alignments["chaotic-evil"]]
  ];

  const matrix=rows.map(([ethos,...entries])=>
    `<tr><th>${ethos}</th>${entries.map(entry=>`<td><b>${entry.name} (${entry.abbr})</b><br>${entry.summary}</td>`).join("")}</tr>`
  ).join("");

  return `<article class="spell-card">`+
    `<header class="spell-card-title"><h2>Alignment</h2><span>Ethos × Morality</span></header>`+
    `<div class="spell-card-body">`+
      `<div class="class-reference-grid">`+
        `<div><b>Ethical Axis</b><br>Law — Neutrality — Chaos describes attitudes toward order, organization, society, and individual freedom.</div>`+
        `<div><b>Moral Axis</b><br>Good — Neutrality — Evil describes moral outlook and treatment of others.</div>`+
        `<div><b>Role-Playing Tool</b><br>Alignment guides moral and ethical choices; it is not intended as a straitjacket that dictates every action.</div>`+
        `<div><b>Non-Aligned Creatures</b><br>Creatures incapable of moral/ethical judgment can be non-aligned; for alignment-detection purposes the PHB treats them as neutral.</div>`+
      `</div>`+
      classSectionHeading("Nine Alignments")+
      `<div style="overflow:auto"><table class="class-reference-table"><thead><tr><th>Ethos</th><th>Good</th><th>Neutral</th><th>Evil</th></tr></thead><tbody>${matrix}</tbody></table></div>`+
      classSectionHeading("Current Class Restrictions")+
      `<div class="class-reference-grid">`+
        `<div><b>Fighter</b><br>Any alignment.</div>`+
        `<div><b>Mage</b><br>Any alignment.</div>`+
        `<div><b>Thief</b><br>Any alignment except Lawful Good.</div>`+
        `<div><b>Cleric</b><br>Any alignment acceptable to the selected deity/mythos; the deity hook is built into the R136 class eligibility API.</div>`+
      `</div>`+
      `<div class="class-reference-note"><b>Engine status:</b> R136 establishes canonical IDs, abbreviations, normalization aliases, class-validation hooks, and display names for all nine alignments. Character Generation can consume this system directly in a later pass.</div>`+
      `<div class="class-reference-note">Source trace: Player's Handbook alignment chapter, including the Law/Chaos and Good/Evil axes, the nine combinations, and the role-playing guidance.</div>`+
    `</div></article>`;
}

function renderClassBook(classId=classbookActiveClass){
  const tabs=document.getElementById("classbookTabs");
  const content=document.getElementById("classbookContent");
  if(!tabs || !content) return;

  if(!["fighter","mage","cleric","thief","alignment"].includes(classId)){
    classId="fighter";
  }

  classbookActiveClass=classId;
  tabs.innerHTML=
    classbookTabButton("fighter","Fighter")+
    classbookTabButton("mage","Mage")+
    classbookTabButton("cleric","Cleric")+
    classbookTabButton("thief","Thief")+
    classbookTabButton("alignment","Alignment");

  const renderers={
    fighter:fighterClassBookHtml,
    mage:mageClassBookHtml,
    cleric:clericClassBookHtml,
    thief:thiefClassBookHtml,
    alignment:alignmentClassBookHtml
  };
  content.innerHTML=renderers[classId]();
}

const FIGHTER_LEVELS=[
  {level:1, xp:0,       thaco:20, hd:"1d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"Warrior/Fighter foundation; weapon specialization is available to a single-class fighter."},
  {level:2, xp:2000,    thaco:19, hd:"2d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:3, xp:4000,    thaco:18, hd:"3d10",      attacks:"1/round",    wp:4,  nwp:3, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot; warrior saves improve."},
  {level:4, xp:8000,    thaco:17, hd:"4d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:5, xp:16000,   thaco:16, hd:"5d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"Warrior saving throws improve."},
  {level:6, xp:32000,   thaco:15, hd:"6d10",      attacks:"1/round",    wp:5,  nwp:4, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:7, xp:64000,   thaco:14, hd:"7d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"Base melee attack rate improves to 3 attacks every 2 rounds; warrior saves improve."},
  {level:8, xp:125000,  thaco:13, hd:"8d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"THAC0 improves by 1; gain another d10 Hit Die."},
  {level:9, xp:250000,  thaco:12, hd:"9d10",      attacks:"3/2 rounds", wp:6,  nwp:5, gain:"+1 WP/NWP; warrior saves improve; becomes a Lord and may attract followers after establishing a stronghold."},
  {level:10,xp:500000,  thaco:11, hd:"9d10 + 3",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"No more Hit Dice; add a fixed +3 HP per fighter level from this point onward."},
  {level:11,xp:750000,  thaco:10, hd:"9d10 + 6",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"Warrior saving throws improve."},
  {level:12,xp:1000000, thaco:9,  hd:"9d10 + 9",  attacks:"3/2 rounds", wp:7,  nwp:6, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:13,xp:1250000, thaco:8,  hd:"9d10 + 12", attacks:"2/round",    wp:8,  nwp:7, gain:"Base melee attack rate improves to 2 attacks every round; warrior saves improve."},
  {level:14,xp:1500000, thaco:7,  hd:"9d10 + 15", attacks:"2/round",    wp:8,  nwp:7, gain:"THAC0 improves by 1; +3 HP."},
  {level:15,xp:1750000, thaco:6,  hd:"9d10 + 18", attacks:"2/round",    wp:8,  nwp:7, gain:"+1 WP/NWP; warrior saving throws improve."},
  {level:16,xp:2000000, thaco:5,  hd:"9d10 + 21", attacks:"2/round",    wp:9,  nwp:8, gain:"THAC0 improves by 1; +3 HP."},
  {level:17,xp:2250000, thaco:4,  hd:"9d10 + 24", attacks:"2/round",    wp:9,  nwp:8, gain:"Final core warrior saving-throw band begins; +3 HP."},
  {level:18,xp:2500000, thaco:3,  hd:"9d10 + 27", attacks:"2/round",    wp:9, nwp:8, gain:"+1 weapon proficiency slot; +1 nonweapon proficiency slot."},
  {level:19,xp:2750000, thaco:2,  hd:"9d10 + 30", attacks:"2/round",    wp:10, nwp:9, gain:"THAC0 improves by 1; +3 HP."},
  {level:20,xp:3000000, thaco:1,  hd:"9d10 + 33", attacks:"2/round",    wp:10, nwp:9, gain:"THAC0 reaches 1; +3 HP."}
];

const THIEF_LEVELS=[
  {level:1, xp:0,       hd:"1d6",      backstab:"×2"},
  {level:2, xp:1250,    hd:"2d6",      backstab:"×2"},
  {level:3, xp:2500,    hd:"3d6",      backstab:"×2"},
  {level:4, xp:5000,    hd:"4d6",      backstab:"×2"},
  {level:5, xp:10000,   hd:"5d6",      backstab:"×3"},
  {level:6, xp:20000,   hd:"6d6",      backstab:"×3"},
  {level:7, xp:40000,   hd:"7d6",      backstab:"×3"},
  {level:8, xp:70000,   hd:"8d6",      backstab:"×3"},
  {level:9, xp:110000,  hd:"9d6",      backstab:"×4"},
  {level:10,xp:160000,  hd:"10d6",     backstab:"×4"},
  {level:11,xp:220000,  hd:"10d6 + 2", backstab:"×4"},
  {level:12,xp:440000,  hd:"10d6 + 4", backstab:"×4"},
  {level:13,xp:660000,  hd:"10d6 + 6", backstab:"×5"},
  {level:14,xp:880000,  hd:"10d6 + 8", backstab:"×5"},
  {level:15,xp:1100000, hd:"10d6 + 10",backstab:"×5"},
  {level:16,xp:1320000, hd:"10d6 + 12",backstab:"×5"},
  {level:17,xp:1540000, hd:"10d6 + 14",backstab:"×5"},
  {level:18,xp:1760000, hd:"10d6 + 16",backstab:"×5"},
  {level:19,xp:1980000, hd:"10d6 + 18",backstab:"×5"},
  {level:20,xp:2200000, hd:"10d6 + 20",backstab:"×5"}
];

function fighterLevelData(level){
  return FIGHTER_LEVELS[Math.max(0,Math.min(19,level-1))];
}

function fighterLevelForXp(xp){
  let result=FIGHTER_LEVELS[0];

  for(const row of FIGHTER_LEVELS){
    if(xp>=row.xp){
      result=row;
    }else{
      break;
    }
  }

  return result.level;
}

function warriorSavingThrows(level){
  if(level<=2)  return {death:14,wand:16,poly:15,breath:17,spell:17};
  if(level<=4)  return {death:13,wand:15,poly:14,breath:16,spell:16};
  if(level<=6)  return {death:11,wand:13,poly:12,breath:13,spell:14};
  if(level<=8)  return {death:10,wand:12,poly:11,breath:12,spell:13};
  if(level<=10) return {death:8, wand:10,poly:9, breath:9, spell:11};
  if(level<=12) return {death:7, wand:9, poly:8, breath:8, spell:10};
  if(level<=14) return {death:5, wand:7, poly:6, breath:5, spell:8};
  if(level<=16) return {death:4, wand:6, poly:5, breath:4, spell:7};
  return             {death:3, wand:5, poly:4, breath:4, spell:6};
}

function fighterBaseAttacksThisRound(level,round){
  if(level>=13) return 2;
  if(level>=7) return round%2===0 ? 2 : 1;
  return 1;
}

function fighterSpecialistAttacksThisRound(level,round){
  /* PHB melee specialization:
     1-6: 3/2, 7-12: 2/1, 13+: 5/2. */
  if(level>=13) return round%2===0 ? 3 : 2;
  if(level>=7) return 2;
  return round%2===0 ? 2 : 1;
}

function fighterAttacksThisRound(fighter,round){
  if(
    fighter?.specializedWeapon &&
    fighter.weaponBaseName===fighter.specializedWeapon
  ){
    return fighterSpecialistAttacksThisRound(fighter.level,round);
  }

  return fighterBaseAttacksThisRound(fighter.level,round);
}

function fighterNextLevelXp(level){
  const next=FIGHTER_LEVELS[level];
  return next ? next.xp : null;
}

function formatExceptionalStrength(value){
  if(!value) return "";
  return value===100 ? "00" : String(value).padStart(2,"0");
}

function formatStrengthValue(fighter){
  if(!fighter) return "—";
  if(fighter.stats.str===18 && fighter.exceptionalStrength){
    return `18/${formatExceptionalStrength(fighter.exceptionalStrength)}`;
  }
  return String(fighter.stats.str);
}

function applyFighterClassRules(fighter){
  const row=fighterLevelData(fighter.level);

  fighter.classId="fighter";
  fighter.ruleset=RULESET.name;
  fighter.classGroup=FIGHTER_CLASS.group;
  fighter.minimumStrength=FIGHTER_CLASS.minimumStrength;
  fighter.primeRequisite=FIGHTER_CLASS.primeRequisite;

  fighter.thaco=row.thaco;
  fighter.attacksLabel=row.attacks;

  fighter.weaponProficiencySlots=row.wp;
  fighter.nonweaponProficiencySlots=row.nwp;
  fighter.weaponNonproficiencyPenalty=FIGHTER_CLASS.weaponNonproficiencyPenalty;

  fighter.canWeaponSpecialize=FIGHTER_CLASS.canWeaponSpecialize;

  fighter.allowedArmor=FIGHTER_CLASS.armor;
  fighter.allowedShields=FIGHTER_CLASS.shields;
  fighter.allowedWeapons=FIGHTER_CLASS.weapons;

  fighter.saves=warriorSavingThrows(fighter.level);
  fighter.title=fighter.level>=9 ? "Lord" : "Fighter";

  fighter.followerEligible=
    fighter.level>=FIGHTER_CLASS.followerLevel;

  fighter.followerRequirement=
    FIGHTER_CLASS.followerRequirement;

  fighter.primeRequisiteXpBonus=
    fighter.stats.str>=FIGHTER_CLASS.primeRequisiteXpBonusThreshold;
}

function levelUpFighter(fighter){
  if(fighter.level>=20) return null;

  fighter.level++;
  let hpGain=0;

  if(fighter.level<=9){
    hpGain=Math.max(1,d(10)+conHpAdjustment(fighter.stats.con));
  }else{
    hpGain=3;
  }

  fighter.maxHp+=hpGain;
  fighter.hp=Math.min(fighter.maxHp,fighter.hp+hpGain);

  applyFighterClassRules(fighter);

  return {
    level:fighter.level,
    hpGain,
    row:fighterLevelData(fighter.level)
  };
}

function awardFighterXp(baseXp){
  const fighter=game?.player;
  if(!fighter || !baseXp || game.xpAwarded) return "";

  game.xpAwarded=true;

  const bonus=fighter.stats.str>=FIGHTER_CLASS.primeRequisiteXpBonusThreshold
    ? Math.round(baseXp*0.10)
    : 0;

  const total=baseXp+bonus;
  const oldLevel=fighter.level;

  fighter.xp+=total;

  const gained=[];

  while(
    fighter.level<20 &&
    fighter.xp>=fighterLevelData(fighter.level+1).xp
  ){
    const result=levelUpFighter(fighter);
    if(result) gained.push(result);
  }

  if(persistentFighter===fighter){
    persistentFighter=fighter;
  }

  log(
    `Experience: ${baseXp} XP`+
    `${bonus ? ` + ${bonus} prime-requisite bonus` : ""}`+
    ` = ${total} XP. Total ${fighter.xp}.`,
    "good"
  );

  for(const g of gained){
    log(
      `LEVEL UP! Fighter reaches level ${g.level}; +${g.hpGain} HP; THAC0 ${fighterLevelData(g.level).thaco}.`,
      "good"
    );
  }

  updateUi();

  const levelText=gained.length
    ? ` Level gained: ${oldLevel} → ${fighter.level}.`
    : "";

  return ` Awarded ${total} XP${bonus ? " (includes 10% Strength bonus)" : ""}.${levelText}`;
}

function strengthMods(score,exceptional=0){
  if(score<=3) return {hit:-3,damage:-1};
  if(score<=5) return {hit:-2,damage:-1};
  if(score<=7) return {hit:-1,damage:0};
  if(score<=15) return {hit:0,damage:0};
  if(score===16) return {hit:0,damage:1};
  if(score===17) return {hit:1,damage:1};

  if(score===18 && exceptional){
    if(exceptional<=50) return {hit:1,damage:3};
    if(exceptional<=75) return {hit:2,damage:3};
    if(exceptional<=90) return {hit:2,damage:4};
    if(exceptional<=99) return {hit:2,damage:5};
    return {hit:3,damage:6};
  }

  return {hit:1,damage:2};
}

const DEXTERITY_TABLE={
  1:  {reaction:-6, missile:-6, defensive: 5},
  2:  {reaction:-4, missile:-4, defensive: 5},
  3:  {reaction:-3, missile:-3, defensive: 4},
  4:  {reaction:-2, missile:-2, defensive: 3},
  5:  {reaction:-1, missile:-1, defensive: 2},
  6:  {reaction: 0, missile: 0, defensive: 1},
  7:  {reaction: 0, missile: 0, defensive: 0},
  8:  {reaction: 0, missile: 0, defensive: 0},
  9:  {reaction: 0, missile: 0, defensive: 0},
  10: {reaction: 0, missile: 0, defensive: 0},
  11: {reaction: 0, missile: 0, defensive: 0},
  12: {reaction: 0, missile: 0, defensive: 0},
  13: {reaction: 0, missile: 0, defensive: 0},
  14: {reaction: 0, missile: 0, defensive: 0},
  15: {reaction: 0, missile: 0, defensive:-1},
  16: {reaction: 1, missile: 1, defensive:-2},
  17: {reaction: 2, missile: 2, defensive:-3},
  18: {reaction: 2, missile: 2, defensive:-4},
  19: {reaction: 3, missile: 3, defensive:-4},
  20: {reaction: 3, missile: 3, defensive:-4},
  21: {reaction: 4, missile: 4, defensive:-5},
  22: {reaction: 4, missile: 4, defensive:-5},
  23: {reaction: 4, missile: 4, defensive:-5},
  24: {reaction: 5, missile: 5, defensive:-6},
  25: {reaction: 5, missile: 5, defensive:-6}
};

function dexterityAdjustments(score){
  const value=clamp(
    Number.isFinite(Number(score))
      ? Math.round(Number(score))
      : 10,
    1,
    25
  );

  return DEXTERITY_TABLE[value];
}

function formatSignedAdjustment(value){
  if(value>0) return `+${value}`;
  return String(value);
}

function calculateArmorClass(unit){
  if(!unit) return 10;

  const inventory=Array.isArray(unit.inventory)
    ? unit.inventory
    : [];

  const armorItem=inventory.find(item=>
    item.slot==="armor" &&
    item.equipped
  );

  const shieldItem=inventory.find(item=>
    item.slot==="shield" &&
    item.equipped
  );

  const armor=
    getArmorCatalogEntry(armorItem?.catalogArmorId) ||
    armorItem ||
    null;

  const shield=
    getArmorCatalogEntry(shieldItem?.catalogArmorId) ||
    shieldItem ||
    null;

  /*
    AD&D 2e:
    - Unarmored base AC is 10.
    - Equipped armor supplies the new base AC.
    - Dexterity Defensive Adjustment is applied with the sign printed
      in the Dexterity table: negative improves AC; positive worsens AC.
  */
  const armorBaseAc=
    Number.isFinite(armor?.baseArmorClass)
      ? armor.baseArmorClass
      : 10;

  const dexAdjustments=
    dexterityAdjustments(unit.stats?.dex ?? 10);

  const dexDefensiveAdjustment=
    dexAdjustments.defensive;

  const shieldBonus=Number.isFinite(shield?.acBonus)
    ? shield.acBonus
    : 0;

  const otherBonus=Number.isFinite(unit.otherAcBonus)
    ? unit.otherAcBonus
    : 0;

  const result=
    armorBaseAc
    + dexDefensiveAdjustment
    - shieldBonus
    - otherBonus;

  return clamp(result,-10,10);
}

function armorClassBreakdown(unit){
  const inventory=Array.isArray(unit?.inventory)
    ? unit.inventory
    : [];

  const armorItem=inventory.find(item=>
    item.slot==="armor" &&
    item.equipped
  );

  const shieldItem=inventory.find(item=>
    item.slot==="shield" &&
    item.equipped
  );

  const armor=
    getArmorCatalogEntry(armorItem?.catalogArmorId) ||
    armorItem ||
    null;

  const shield=
    getArmorCatalogEntry(shieldItem?.catalogArmorId) ||
    shieldItem ||
    null;

  const armorBaseAc=
    Number.isFinite(armor?.baseArmorClass)
      ? armor.baseArmorClass
      : 10;

  const dexAdjustments=
    dexterityAdjustments(unit?.stats?.dex ?? 10);

  const shieldBonus=Number.isFinite(shield?.acBonus)
    ? shield.acBonus
    : 0;

  const otherBonus=Number.isFinite(unit?.otherAcBonus)
    ? unit.otherAcBonus
    : 0;

  return {
    armorName:armor?.name || "Unarmored",
    armorBaseAc,

    dexReactionAdjustment:dexAdjustments.reaction,
    dexMissileAdjustment:dexAdjustments.missile,
    dexDefensiveAdjustment:dexAdjustments.defensive,

    shieldName:shield?.name || "None",
    shieldBonus,
    otherBonus,

    finalAc:calculateArmorClass(unit)
  };
}

function conHpAdjustment(score){
  if(score<=3) return -2;
  if(score<=6) return -1;
  if(score<=14) return 0;
  if(score===15) return 1;
  if(score===16) return 2;
  if(score===17) return 3;
  return 4;
}

function makeFighter(){
  if(persistentFighter){
    const f=persistentFighter;

    f.name="Dungeon Crawler Carl";
    if(!f.race) f.race="Human";
    f.buffs=[];
    f.debuffs=[];
    f.hp=f.maxHp;
    f.x=0;
    f.y=0;
    f.alive=true;
    f.fled=false;
    f.turnMoves=0;
    f.fullMove=false;
    f.waitedThisRound=false;
    f.guard=false;
    f.guardRound=0;
    f.guardBaselineAdjacentIds=[];
    f.facing="right";
    f.facingHex=0;
    f.sweepUsedThisRound=false;
    f.attacksThisRound=2;
    f.attacksRemaining=2;

    if(!f.weaponBaseName) f.weaponBaseName="Long Sword";
    if(!Array.isArray(f.proficientWeapons)) f.proficientWeapons=["Long Sword"];
    if(f.specializedWeapon===undefined) f.specializedWeapon=null;

    /* R44 canonical test loadout: named sword + equipped chain mail. */
    const previousInventory=Array.isArray(f.inventory) ? f.inventory : [];
    const oldSword=previousInventory.find(item=>item?.name==="Flaming Sword +5");
    const oldChain=previousInventory.find(item=>
      item?.catalogArmorId==="chain" ||
      item?.name==="Chain Mail" ||
      item?.name==="Mail hauberk or byrnie (chain)"
    );

    f.inventory=[
      {
        name:"Flaming Sword +5",
        type:"Weapon",
        slot:"weapon",
        equippable:true,
        equipped:oldSword ? oldSword.equipped!==false : true,
        qty:1,
        magical:true,
        catalogWeaponId:"sword-long",
        baseName:"Long Sword",
        magicHitBonus:5,
        magicDamageBonus:5,
        bonusDamageExpression:"1d6",
        bonusDamageType:"fire",
        detail:"Magical item built on the catalog Sword, long base weapon."
      },
      {
        name:"Chain Mail",
        type:"Armor",
        slot:"armor",
        equippable:true,
        equipped:oldChain ? oldChain.equipped!==false : true,
        qty:1,
        magical:false,
        catalogArmorId:"chain",
        detail:"Mail hauberk or byrnie (chain)."
      }
,
      {
        name:"Scroll of Magic Missile",
        type:"Scroll",
        usable:true,
        useLabel:"USE",
        qty:1,
        magical:true,
        spellId:"magic-missile",
        scrollCasterLevel:6,
        testUseOverride:true,
        detail:"Contains Magic Missile. Adventure Party combat-test item; USE it, then AIM at a hostile creature."
      },
      {
        name:"Scroll of Fireball",
        type:"Scroll",
        usable:true,
        useLabel:"USE",
        qty:1,
        magical:true,
        spellId:"fireball",
        scrollCasterLevel:6,
        testUseOverride:true,
        detail:"Contains Fireball. USE it, then AIM at the desired blast point."
      }
    ];

    if(!Array.isArray(f.magicItems)){
      f.magicItems=[];
    }else{
      f.magicItems=[];
    }

    syncFighterEquipment(f);
    applyFighterClassRules(f);
    return f;
  }

  let stats;
  do{
    stats={
      str:roll3d6(),
      dex:roll3d6(),
      con:roll3d6(),
      int:roll3d6(),
      wis:roll3d6(),
      cha:roll3d6()
    };
  }while(stats.str<9);

  const exceptionalStrength=
    stats.str===18 ? d(100) : 0;

  const sm=strengthMods(stats.str,exceptionalStrength);
  const conAdj=conHpAdjustment(stats.con);

  const firstHp=Math.max(1,d(10)+conAdj);

  const fighter={
    id:"player",
    type:"fighter",
    faction:"player",
    alignment:"neutral",
    sizeCategory:"medium",
    name:"Dungeon Crawler Carl",
    race:"Human",
    className:"Fighter",
    level:1,
    xp:3000000,
    stats,
    exceptionalStrength,
    hp:firstHp,
    maxHp:firstHp,
    ac:10,
    thaco:20,
    move:12,
    halfMove:6,
    weapon:"Flaming Sword +5",
    weaponBaseName:"Long Sword",
    proficientWeapons:["Long Sword"],
    specializedWeapon:null,

    inventory:[
      {
        name:"Flaming Sword +5",
        type:"Weapon",
        slot:"weapon",
        equippable:true,
        equipped:true,
        qty:1,
        magical:true,
        catalogWeaponId:"sword-long",
        baseName:"Long Sword",
        magicHitBonus:5,
        magicDamageBonus:5,
        bonusDamageExpression:"1d6",
        bonusDamageType:"fire",
        detail:"Magical item built on the catalog Sword, long base weapon."
      },
      {
        name:"Chain Mail",
        type:"Armor",
        slot:"armor",
        equippable:true,
        equipped:true,
        qty:1,
        magical:false,
        catalogArmorId:"chain",
        detail:"Mail hauberk or byrnie (chain)."
      }
 ,
      {
        name:"Scroll of Magic Missile",
        type:"Scroll",
        usable:true,
        useLabel:"USE",
        qty:1,
        magical:true,
        spellId:"magic-missile",
        scrollCasterLevel:6,
        testUseOverride:true,
        detail:"Contains Magic Missile. Adventure Party combat-test item; USE it, then AIM at a hostile creature."
      },
      {
        name:"Scroll of Fireball",
        type:"Scroll",
        usable:true,
        useLabel:"USE",
        qty:1,
        magical:true,
        spellId:"fireball",
        scrollCasterLevel:6,
        testUseOverride:true,
        detail:"Contains Fireball. USE it, then AIM at the desired blast point."
      }
    ],

    magicItems:[],

    weaponDamageSM:"1d8",
    weaponDamageL:"1d12",
    attackBonus:sm.hit,
    damageBonus:sm.damage,
    weaponHitBonus:5,
    weaponDamageBonus:5,
    bonusDamageExpression:"1d6",
    bonusDamageType:"fire",
    x:0,
    y:0,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    turnMoves:0,
    fullMove:false,
    waitedThisRound:false,
    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],
    sweepUsedThisRound:false,
    attacksThisRound:2,
    attacksRemaining:2,
    facing:"right",
    facingHex:0
  };

  /* Build HP exactly through Fighter 20:
     levels 2-9 add d10 + warrior CON adjustment;
     levels 10-20 add fixed +3 HP. */
  for(let level=2;level<=9;level++){
    fighter.maxHp+=Math.max(1,d(10)+conAdj);
  }
  fighter.maxHp+=(20-9)*3;
  fighter.hp=fighter.maxHp;
  fighter.level=20;

  syncFighterEquipment(fighter);
  applyFighterClassRules(fighter);
  fighter.attacksThisRound=2;
  fighter.attacksRemaining=2;

  persistentFighter=fighter;
  return fighter;
}


function makeFriendlyElvenRanger(){
  const stats={
    str:roll3d6(),
    dex:roll3d6(),
    con:roll3d6(),
    int:roll3d6(),
    wis:roll3d6(),
    cha:roll3d6()
  };

  /*
    This is intentionally a combat-test Ranger shell.
    We are not yet asserting unverified 2e Ranger qualification,
    racial modifiers, or Ranger-only class abilities.
  */
  const conAdj=conHpAdjustment(stats.con);

  let hp=3; /* Current warrior-style fixed level-10 increment. */
  for(let i=0;i<9;i++){
    hp+=Math.max(1,d(10)+conAdj);
  }

  const ranger={
    id:"party-ranger-01",
    type:"ranger",
    controller:"npc",
    faction:"player",
    alignment:"good",

    name:"Elven Ranger",
    race:"Elf",
    sex:"Female",
    className:"Ranger",
    classGroup:"Warrior",
    level:10,

    sizeCategory:"medium",

    stats,
    hp,
    maxHp:hp,

    thaco:11,
    saves:warriorSavingThrows(10),

    x:-1,
    y:1,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],

    move:9,
    halfMove:4,

    ac:10,

    weapon:"Short Sword",
    weaponCatalogId:"sword-short",
    weaponDamageSM:"1d6",
    weaponDamageL:"1d8",
    meleeRange:1,

    rangedWeapon:"Longbow",
    missileCatalogId:"bow-long",
    weaponInHand:"ranged",

    missileRateOfFire:2,
    missileRangeIncrementFt:70,
    missileRangeIncrementHexes:7,
    missileMaxRangeHexes:21,

    attackBonus:0,
    missileAttackBonus:0,

    inventory:[
      {
        name:"Longbow",
        type:"Weapon",
        slot:"weapon",
        equippable:true,
        equipped:true,
        qty:1,
        magical:false,
        catalogMissileWeaponId:"bow-long",
        role:"Primary ranged weapon"
      },
      {
        name:"Short Sword",
        type:"Weapon",
        slot:"backup-weapon",
        equippable:false,
        equipped:false,
        qty:1,
        magical:false,
        catalogWeaponId:"sword-short",
        role:"Backup melee weapon"
      },
      {
        name:"Chain Mail",
        type:"Armor",
        slot:"armor",
        equippable:true,
        equipped:true,
        qty:1,
        magical:false,
        catalogArmorId:"chain"
      }
    ],

    shotsThisRound:2,
    shotsRemaining:2,

    guard:false,
    facing:"right",
    facingHex:0
  };

  ranger.ac=calculateArmorClass(ranger);

  return ranger;
}


/* ============================================================
   R92 LEVEL-20 PLAYER-CONTROLLED PARTY MAGE
   ------------------------------------------------------------
   This is the level-20 development Mage used to exercise the R89
   Mage system in live combat. R92 makes Baub player-controlled on his
   own initiative turn. It is not a new class rule.
   ============================================================ */
function makeTestPartyMage(){
  const knownSpellIds=Object.values(SPELL_CATALOG)
    .filter(spell=>spell?.spellGroup==="Wizard")
    .map(spell=>spell.id);

  /*
    Level 20 grants five 1st-level and five 3rd-level slots. The current
    combat catalog has no implemented 2nd-level spells yet, so the test
    loadout intentionally leaves those and higher unused.
  */
  const memorizedSpellIds=[
    "shield",
    "magic-missile",
    "magic-missile",
    "sleep",
    "wall-of-fog",
    "fireball",
    "fireball",
    "fireball",
    "fireball",
    "fireball"
  ];

  const mage=makeMageCharacter({
    name:"Baub",
    race:"Human",
    level:20,
    stats:{
      str:10,
      dex:15,
      con:16,
      int:18,
      wis:14,
      cha:12
    },
    knownSpellIds,
    memorizedSpellIds
  });

  mage.id="party-mage-01";
  mage.controller="player";
  mage.faction="player";
  mage.sex="Male";
  mage.x=1;
  mage.y=0;
  mage.move=12;
  mage.halfMove=6;
  mage.weapon="Staff";
  mage.weaponBaseName="Staff";
  mage.weaponCatalogId="staff";
  mage.weaponAttackTypes=["B"];
  mage.weaponDamageSM="1d6";
  mage.weaponDamageL="1d6";
  mage.meleeRange=1;
  mage.inventory=[
    {
      name:"Staff",
      type:"Weapon",
      slot:"weapon",
      equippable:true,
      equipped:true,
      qty:1,
      magical:false,
      catalogWeaponId:"staff",
      role:"Mage weapon"
    },
    {
      name:"Spell Book",
      type:"Spell Book",
      usable:false,
      qty:1,
      magical:true,
      detail:`${mage.knownSpellIds.length} known Wizard spells`
    }
  ];
  mage.weaponInHand="melee";
  mage.attackBonus=0;
  mage.damageBonus=0;
  mage.guard=false;
  mage.turnMoves=0;
  mage.fullMove=false;
  mage.waitedThisRound=false;
  mage.attacksThisRound=1;
  mage.attacksRemaining=1;
  mage.facing="right";
  mage.facingHex=0;
  mage.ac=calculateArmorClass(mage);

  return mage;
}

function livingPartyMembers(){
  if(!game) return [];

  return [
    game.player,
    ...(game.allies || [])
  ].filter(unit=>
    unit &&
    unit.alive &&
    !unit.fled
  );
}

function nearestLivingPartyTarget(fromUnit){
  return livingPartyMembers()
    .slice()
    .sort((a,b)=>
      unitDistance(fromUnit,a)-unitDistance(fromUnit,b) ||
      a.id.localeCompare(b.id)
    )[0] || null;
}

function checkPartyDefeat(){
  if(!game || game.over) return false;

  if(livingPartyMembers().length===0){
    game.over=true;
    game.active=null;

    setTimeout(()=>{
      finishCombat(
        "Defeat",
        "All player-party members have gone down."
      );
    },deathFx ? 1000 : 100);

    return true;
  }

  return false;
}

function makeKobold(index,position){
  const hp=d(4);

  return {
    id:`kobold-${String(index+1).padStart(2,"0")}`,
    type:"kobold",
    species:"kobold",
    controller:"mob",
    sizeCategory:"small",
    faction:"enemy",
    alignment:"lawful evil",
    name:"Kobold",
    hp,
    maxHp:hp,

    hitDiceValue:0.5,
    hitDiceLabel:"1/2",

    ac:7,
    thaco:20,
    move:6,
    halfMove:3,
    weapon:"Dagger",
    weaponCatalogId:"dagger",
    meleeRange:1,
    weaponDamageSM:"1d4",
    weaponDamageL:"1d3",
    attackBonus:0,
    damageBonus:0,
    weaponHitBonus:0,
    weaponDamageBonus:0,

    /* R62 test loadout: dagger only. */
    rangedWeapon:null,
    missileCatalogId:null,
    missileAmmoCatalogId:null,
    rangedDamageSM:null,
    rangedDamageL:null,
    missileRateOfFire:0,
    missileRangeIncrementFt:0,

    morale:9,
    xpValue:7,

    /* R84 generic visual-pose state. */
    poseName:"stand",
    poseUntil:0,

    x:position.x,
    y:position.y,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    fleeing:false,
    fleeSteps:0,
    fleeEscapeDistance:10,
    panicBarkPending:false,
    xpCounted:false,

    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],

    facing:(position.x + position.y*0.5)>=0 ? "left" : "right",
    facingHex:hexDirectionIndexToward(position,{x:0,y:0})
  };
}

function makeKoboldBodyguard(index,position){
  /*
    R108 Monstrous Manual Kobold bodyguard:
      AC 6; HD 1-1; fixed 4 hp; THAC0 20; damage 1-6; XP 15.
    User-selected visual/equipment loadout: short sword, wooden/wicker shield,
    leather armor. The monster entry's AC 6 remains authoritative.
  */
  return {
    id:`kobold-bodyguard-${String(index+1).padStart(2,"0")}`,
    type:"kobold-bodyguard",
    species:"kobold",
    controller:"mob",
    sizeCategory:"small",
    faction:"enemy",
    alignment:"lawful evil",
    name:"Kobold Body Guard",

    hp:4,
    maxHp:4,
    hitDiceValue:1,
    hitDiceLabel:"1-1",

    ac:6,
    unarmoredAc:10,
    thaco:20,
    move:6,
    halfMove:3,

    weapon:"Short Sword",
    weaponCatalogId:"sword-short",
    weaponInHand:"melee",
    meleeRange:1,
    weaponDamageSM:"1d6",
    weaponDamageL:"1d8",
    attackBonus:0,
    damageBonus:0,
    weaponHitBonus:0,
    weaponDamageBonus:0,

    armorName:"Leather Armor",
    shieldName:"Wood/Wicker Shield",

    rangedWeapon:null,
    missileCatalogId:null,
    missileAmmoCatalogId:null,
    rangedDamageSM:null,
    rangedDamageL:null,
    missileRateOfFire:0,
    missileRangeIncrementFt:0,

    morale:9,
    moraleLabel:"Average (8-10)",
    xpValue:15,

    poseName:"stand",
    poseUntil:0,

    x:position.x,
    y:position.y,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    fleeing:false,
    fleeSteps:0,
    fleeEscapeDistance:10,
    panicBarkPending:false,
    xpCounted:false,

    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],

    facing:(position.x + position.y*0.5)>=0 ? "left" : "right",
    facingHex:hexDirectionIndexToward(position,{x:0,y:0})
  };
}


function makeKoboldSlinger(index,position){
  /*
    R113 Kobold Slinger: ordinary Kobold durability with a dedicated ranged
    loadout. User-defined equipment is a sling plus 10 sling bullets.
  */
  const hp=d(4);

  return {
    id:`kobold-slinger-${String(index+1).padStart(2,"0")}`,
    type:"kobold-slinger",
    species:"kobold",
    controller:"mob",
    sizeCategory:"small",
    faction:"enemy",
    alignment:"lawful evil",
    name:"Kobold Slinger",

    hp,
    maxHp:hp,
    hitDiceValue:0.5,
    hitDiceLabel:"1/2",

    ac:7,
    thaco:20,
    move:6,
    halfMove:3,

    /* Slingers are deliberately ranged-only in this test subtype. */
    weapon:null,
    weaponCatalogId:null,
    weaponInHand:"ranged",
    meleeRange:0,
    weaponDamageSM:null,
    weaponDamageL:null,
    attackBonus:0,
    damageBonus:0,
    weaponHitBonus:0,
    weaponDamageBonus:0,

    rangedWeapon:"Sling",
    missileCatalogId:"sling",
    missileAmmoCatalogId:"sling-bullet",
    missileAmmoName:"Sling bullet",
    missileAmmoQuantity:10,
    missileRateOfFire:1,
    missileRangeIncrementFt:35,
    missileAttackBonus:0,
    rangedDamageSM:"1d4+1",
    rangedDamageL:"1d6+1",
    slingShortRange:4,
    slingMediumRange:7,
    slingLongRange:11,

    morale:9,
    moraleLabel:"Average (8-10)",
    xpValue:7,

    poseName:"stand",
    poseUntil:0,

    x:position.x,
    y:position.y,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    fleeing:false,
    fleeSteps:0,
    fleeEscapeDistance:10,
    panicBarkPending:false,
    xpCounted:false,

    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],

    facing:(position.x + position.y*0.5)>=0 ? "left" : "right",
    facingHex:hexDirectionIndexToward(position,{x:0,y:0})
  };
}

function isKoboldUnit(unit){
  return !!unit && (
    unit.species==="kobold" ||
    unit.type==="kobold" ||
    unit.type==="kobold-bodyguard" ||
    unit.type==="kobold-slinger"
  );
}


function makeOrc(index,position){
  /*
    AD&D 2e standard Orc, using the armored/equipped values from the
    Monstrous Manual stat block supplied for this test:
      AC 6 (10 unarmored)
      MV 9 (12 unarmored)
      HD 1
      THAC0 19
      #AT 1
      Dmg 1d8 by weapon
      Morale Steady (11-12)
      XP 15
  */
  const hp=d(8);

  return {
    id:`orc-${String(index+1).padStart(2,"0")}`,
    type:"orc",
    controller:"mob",
    sizeCategory:"medium",
    faction:"enemy",
    alignment:"lawful evil",
    name:"Orc",

    hp,
    maxHp:hp,

    hitDiceValue:1,
    hitDiceLabel:"1",

    ac:6,
    unarmoredAc:10,

    thaco:19,

    move:9,
    unarmoredMove:12,
    halfMove:4,

    weapon:"Scimitar",
    weaponCatalogId:"sword-scimitar",
    weaponInHand:"melee",
    meleeRange:1,
    weaponDamageSM:"1d8",
    weaponDamageL:"1d8",

    attackBonus:0,
    damageBonus:0,
    weaponHitBonus:0,
    weaponDamageBonus:0,

    rangedWeapon:null,
    missileCatalogId:null,
    missileAmmoCatalogId:null,
    rangedDamageSM:null,
    rangedDamageL:null,
    missileRateOfFire:0,
    missileRangeIncrementFt:0,

    morale:11,
    moraleLabel:"Steady (11-12)",
    xpValue:15,

    /* R84 generic visual-pose state. */
    poseName:"stand",
    poseUntil:0,

    /* Stored for a future lighting/day-night system. */
    brightLightAttackPenalty:-1,

    x:position.x,
    y:position.y,

    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],

    fleeing:false,
    fleeSteps:0,
    fleeEscapeDistance:10,
    xpCounted:false,

    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],

    facing:(position.x + position.y*0.5)>=0 ? "left" : "right",
    facingHex:hexDirectionIndexToward(position,{x:0,y:0})
  };
}


function makeLargeMobTest(position){
  /*
    R187 juvenile Red Dragon test creature.

    AD&D 2e Monstrous Manual / Dragon, General:
      Age category 4 (Juvenile), 15 HD, AC -3, MV 9 / Fl 30 (C) / Jp 3,
      claw/claw/bite, 1d10/1d10/3d10, +4 age-category combat damage modifier,
      Fanatic morale, fire immunity, and an 8d10+4 cone of fire.
    The tactical test keeps R186's symmetric 7-hex footprint.
  */
  let hp=0;
  for(let i=0;i<15;i++) hp+=d(8);

  return {
    id:"juvenile-red-dragon-01",
    type:"juvenile-red-dragon",
    species:"red-dragon",
    creatureType:"dragon",
    controller:"mob",
    sizeCategory:"gargantuan",
    adndSize:"G",
    footprintId:"hex7",
    faction:"enemy",
    alignment:"chaotic evil",
    name:"Juvenile Red Dragon",

    ageCategory:4,
    ageLabel:"Juvenile (26-50 years)",
    intelligence:"Exceptional (15-16)",

    hp,
    maxHp:hp,

    hitDiceValue:15,
    hitDiceLabel:"15",

    ac:-3,
    thaco:7,

    move:9,
    flyMove:30,
    flyManeuverability:"C",
    jumpMove:3,
    halfMove:4,

    weapon:"Bite",
    weaponCatalogId:null,
    weaponInHand:"melee",
    meleeRange:1,
    weaponDamageSM:"3d10",
    weaponDamageL:"3d10",

    attackBonus:0,
    damageBonus:4,
    weaponHitBonus:0,
    weaponDamageBonus:0,
    attacksPerRound:3,
    attackRoutine:"Claw / Claw / Bite",
    naturalAttacks:{
      claw:"1d10",
      bite:"3d10"
    },

    rangedWeapon:null,
    missileCatalogId:null,
    missileAmmoCatalogId:null,
    rangedDamageSM:null,
    rangedDamageL:null,
    missileRateOfFire:0,
    missileRangeIncrementFt:0,

    breathWeapon:{
      name:"Cone of Fire",
      damageExpression:"8d10+4",
      damageType:"fire",
      rangeFeet:90,
      rangeHexes:9,
      mouthWidthFeet:5,
      endWidthFeet:30,
      save:"breath",
      saveForHalf:true,
      cooldownRounds:3,
      lastUsedRound:-999
    },

    damageImmunities:["fire"],
    specialAbilities:[
      "Affect Normal Fires 3/day",
      "Pyrotechnics 3/day"
    ],
    magicResistance:0,

    morale:18,
    moraleLabel:"Fanatic (17-18)",
    xpValue:12000,

    poseName:"stand",
    poseUntil:0,

    x:position.x,
    y:position.y,
    alive:true,
    fled:false,
    buffs:[],
    debuffs:[],
    fleeing:false,
    fleeSteps:0,
    fleeEscapeDistance:10,
    xpCounted:false,

    guard:false,
    guardRound:0,
    guardBaselineAdjacentIds:[],

    facing:(position.x + position.y*0.5)>=0 ? "left" : "right",
    facingHex:hexDirectionIndexToward(position,{x:0,y:0}),

    /*
      R190: measured from the user's new attack-pose placement reference.
      The reference seven-hex block is 1.8125× the engine footprint scale.
      Converting the 161 px source width back to engine scale gives 89 px.
      Standing / attack heights preserve their separate source aspect ratios.
    */
    dragonRenderWidth:89,
    dragonStandRenderHeight:104,
    dragonAttackRenderHeight:107,
    dragonAnchorOffsetX:3,
    dragonAnchorOffsetY:41,
    hpBarWidth:72,
    hpBarOffsetY:72
  };
}

function makeLargeMobTestEncounter(condition="grass"){
  const candidates=
    condition==="wall"
      ? [
          {x:8,y:0},
          {x:9,y:-2},
          {x:7,y:2},
          {x:-9,y:1}
        ]
      : [
          {x:8,y:0},
          {x:8,y:-2},
          {x:6,y:3},
          {x:-8,y:1},
          {x:3,y:7}
        ];

  for(const position of candidates){
    const unit=makeLargeMobTest(position);
    const cells=occupiedHexes(unit);

    if(
      cells.every(cell=>
        inside(cell.x,cell.y) &&
        !isWall(cell.x,cell.y) &&
        hexDistance(cell,{x:0,y:0})>=2
      )
    ){
      lastMobDeployment={
        direction:"JUVENILE RED DRAGON",
        anchorDistance:hexDistance(position,{x:0,y:0}),
        anchor:{...position},
        clusterRadius:1,
        count:1
      };
      return [unit];
    }
  }

  throw new Error("Unable to place the Juvenile Red Dragon on this battlefield.");
}

function axialRing(radius){
  if(radius===0) return [{x:0,y:0}];

  const results=[];
  let current={x:-radius,y:radius};

  const walkDirs=[
    {x:1,y:0},
    {x:1,y:-1},
    {x:0,y:-1},
    {x:-1,y:0},
    {x:-1,y:1},
    {x:0,y:1}
  ];

  for(const dir of walkDirs){
    for(let i=0;i<radius;i++){
      results.push({x:current.x,y:current.y});
      current={
        x:current.x+dir.x,
        y:current.y+dir.y
      };
    }
  }

  return results;
}


const MOB_DEPLOYMENT_DIRECTIONS=[
  {name:"NW",x:0,y:-1},
  {name:"NE",x:1,y:-1},
  {name:"E", x:1,y:0},
  {name:"SE",x:0,y:1},
  {name:"SW",x:-1,y:1},
  {name:"W", x:-1,y:0}
];

function axialDisk(center,radius){
  const results=[];

  for(let dx=-radius;dx<=radius;dx++){
    const minDy=Math.max(-radius,-dx-radius);
    const maxDy=Math.min(radius,-dx+radius);

    for(let dy=minDy;dy<=maxDy;dy++){
      results.push({
        x:center.x+dx,
        y:center.y+dy
      });
    }
  }

  return results;
}

function randomIntInclusive(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

/* Monstrous Manual band guideline: two bodyguards per 40 ordinary kobolds. */
function koboldBodyguardCountForBand(normalCount){
  return Math.floor(Math.max(0,Number(normalCount)||0)/40)*2;
}

function makeKoboldArmy(count=10,bodyguardCount=koboldBodyguardCountForBand(count),slingerCount=0){
  /*
    R72 finite-map deployment:
    preserve the clustered 6–12 hex deployment intent. R108 includes
    ordinary Kobolds plus the current Body Guard contingent in the same band.
  */
  const totalCount=count+Math.max(0,bodyguardCount)+Math.max(0,slingerCount);
  let selected=null;

  for(let attempt=0;attempt<120;attempt++){
    const direction=
      MOB_DEPLOYMENT_DIRECTIONS[
        Math.floor(Math.random()*MOB_DEPLOYMENT_DIRECTIONS.length)
      ];

    const anchorDistance=randomIntInclusive(6,12);

    const anchor={
      x:direction.x*anchorDistance,
      y:direction.y*anchorDistance
    };

    const candidates=axialDisk(anchor,3)
      .filter(pos=>
        inside(pos.x,pos.y) &&
        hexDistance(pos,{x:0,y:0})>=2
      )
      .map(pos=>({
        ...pos,
        deploymentScore:
          hexDistance(pos,anchor)*10+
          Math.random()*12
      }))
      .sort((a,b)=>
        a.deploymentScore-b.deploymentScore ||
        a.x-b.x ||
        a.y-b.y
      );

    if(candidates.length>=totalCount){
      selected={
        direction,
        anchorDistance,
        anchor,
        candidates
      };
      break;
    }
  }

  if(!selected){
    const direction=MOB_DEPLOYMENT_DIRECTIONS.find(d=>d.name==="E");
    const anchorDistance=8;
    const anchor={x:8,y:0};

    const candidates=axialDisk(anchor,3)
      .filter(pos=>
        inside(pos.x,pos.y) &&
        hexDistance(pos,{x:0,y:0})>=2
      )
      .map(pos=>({
        ...pos,
        deploymentScore:
          hexDistance(pos,anchor)*10+
          Math.random()*12
      }))
      .sort((a,b)=>
        a.deploymentScore-b.deploymentScore ||
        a.x-b.x ||
        a.y-b.y
      );

    selected={
      direction,
      anchorDistance,
      anchor,
      candidates
    };
  }

  const positions=selected.candidates
    .slice(0,totalCount)
    .map(({x,y})=>({x,y}));

  if(positions.length<totalCount){
    throw new Error(
      `Unable to find ${totalCount} legal Kobold-band deployment hexes within the finite battlefield.`
    );
  }

  lastMobDeployment={
    direction:selected.direction.name,
    anchorDistance:selected.anchorDistance,
    anchor:{...selected.anchor},
    clusterRadius:3,
    count:positions.length
  };

  const normals=positions
    .slice(0,count)
    .map((pos,index)=>makeKobold(index,pos));

  const bodyguards=positions
    .slice(count,count+bodyguardCount)
    .map((pos,index)=>makeKoboldBodyguard(index,pos));

  const slingers=positions
    .slice(count+bodyguardCount,count+bodyguardCount+slingerCount)
    .map((pos,index)=>makeKoboldSlinger(index,pos));

  return [...normals,...bodyguards,...slingers];
}



function makeWallTestKoboldArmy(count=10,bodyguardCount=3,slingerCount=3){
  const total=count+bodyguardCount+slingerCount;
  const positions=axialDisk({x:6,y:0},2)
    .filter(pos=>inside(pos.x,pos.y))
    .sort((a,b)=>a.y-b.y || a.x-b.x)
    .slice(0,total);

  if(positions.length<total){
    throw new Error("Wall Test could not place the Kobold test group.");
  }

  lastMobDeployment={
    direction:"E — Wall Test",
    anchorDistance:6,
    anchor:{x:6,y:0},
    clusterRadius:2,
    count:positions.length
  };

  return [
    ...positions.slice(0,count).map((pos,index)=>makeKobold(index,pos)),
    ...positions.slice(count,count+bodyguardCount).map((pos,index)=>makeKoboldBodyguard(index,pos)),
    ...positions.slice(count+bodyguardCount,total).map((pos,index)=>makeKoboldSlinger(index,pos))
  ];
}

function makeOrcArmy(count=10,occupiedUnits=[]){
  /*
    A separate compact Orc warband. Orcs deploy in a radius-2 cluster,
    normally 7–13 hexes from Carl, and cannot overlap the existing
    Kobold group or party members.
  */
  const occupiedKeys=new Set(
    (occupiedUnits || []).map(unit=>key(unit.x,unit.y))
  );

  let selected=null;

  for(let attempt=0;attempt<160;attempt++){
    const direction=
      MOB_DEPLOYMENT_DIRECTIONS[
        Math.floor(Math.random()*MOB_DEPLOYMENT_DIRECTIONS.length)
      ];

    const anchorDistance=randomIntInclusive(7,13);
    const anchor={
      x:direction.x*anchorDistance,
      y:direction.y*anchorDistance
    };

    const candidates=axialDisk(anchor,2)
      .filter(pos=>
        inside(pos.x,pos.y) &&
        hexDistance(pos,{x:0,y:0})>=3 &&
        !occupiedKeys.has(key(pos.x,pos.y))
      )
      .map(pos=>({
        ...pos,
        deploymentScore:
          hexDistance(pos,anchor)*10+
          Math.random()*10
      }))
      .sort((a,b)=>
        a.deploymentScore-b.deploymentScore ||
        a.x-b.x ||
        a.y-b.y
      );

    if(candidates.length>=count){
      selected={
        direction,
        anchorDistance,
        anchor,
        candidates
      };
      break;
    }
  }

  if(!selected){
    const fallbackAnchors=[
      {name:"W",x:-12,y:2},
      {name:"NE",x:8,y:-8},
      {name:"SW",x:-8,y:8},
      {name:"SE",x:2,y:8}
    ];

    for(const fallback of fallbackAnchors){
      const candidates=axialDisk(
        {x:fallback.x,y:fallback.y},
        2
      )
        .filter(pos=>
          inside(pos.x,pos.y) &&
          hexDistance(pos,{x:0,y:0})>=3 &&
          !occupiedKeys.has(key(pos.x,pos.y))
        );

      if(candidates.length>=count){
        selected={
          direction:{name:fallback.name},
          anchorDistance:hexDistance(
            {x:0,y:0},
            {x:fallback.x,y:fallback.y}
          ),
          anchor:{x:fallback.x,y:fallback.y},
          candidates
        };
        break;
      }
    }
  }

  if(!selected || selected.candidates.length<count){
    throw new Error(
      `Unable to find ${count} legal Orc deployment hexes on the finite battlefield.`
    );
  }

  const positions=selected.candidates
    .slice(0,count)
    .map(({x,y})=>({x,y}));

  lastOrcDeployment={
    direction:selected.direction.name,
    anchorDistance:selected.anchorDistance,
    anchor:{...selected.anchor},
    clusterRadius:2,
    count:positions.length
  };

  return positions.map(
    (pos,index)=>makeOrc(index,pos)
  );
}

let combatLogPinFrame=0;

function pinCombatLogToBottom(){
  const logBox=ui?.combatLog;
  if(!logBox) return;

  const pin=()=>{
    /*
      scrollHeight includes the R203 bottom gutter. Pinning to the full extent
      guarantees the newest line ends above the viewport edge instead of
      sitting flush against (or visually under) the command-bar boundary.
    */
    logBox.scrollTop=logBox.scrollHeight;
  };

  pin();

  if(typeof requestAnimationFrame!=="function") return;

  if(combatLogPinFrame){
    cancelAnimationFrame(combatLogPinFrame);
  }

  combatLogPinFrame=requestAnimationFrame(()=>{
    pin();
    combatLogPinFrame=requestAnimationFrame(()=>{
      pin();
      combatLogPinFrame=0;
    });
  });

  /*
    Font swaps and browser layout can occur after the next two animation frames.
    One delayed correction keeps the log bottom-pinned after those late reflows.
  */
  clearTimeout(pinCombatLogToBottom._lateTimer);
  pinCombatLogToBottom._lateTimer=setTimeout(pin,120);
}

function log(text,kind=""){
  const div=document.createElement("div");
  div.className=`log-line ${kind}`.trim();
  div.textContent=text;
  ui.combatLog.appendChild(div);
  pinCombatLogToBottom();
}

function setLastRoll(text){
  ui.lastRoll.textContent=text;
}

function allUnits(){
  return game
    ? [
        game.player,
        ...(game.allies || []),
        ...game.enemies
      ]
    : [];
}

function livingUnitAt(x,y){
  return allUnits().find(unit=>
    unit?.alive &&
    !unit.fled &&
    unitOccupiesHex(unit,x,y)
  ) || null;
}

function getUnitById(id){
  if(!game || !id) return null;
  if(id==="player") return game.player;

  const ally=(game.allies || []).find(unit=>unit.id===id);
  if(ally) return ally;

  return game.enemies.find(unit=>unit.id===id) || null;
}

function activeEnemies(){
  return game
    ? game.enemies.filter(k=>k.alive && !k.fled)
    : [];
}

function livingEnemies(){
  return game
    ? game.enemies.filter(k=>k.alive)
    : [];
}

function enemyAtHex(x,y,excludeId=null){
  return game?.enemies.find(k=>
    k.id!==excludeId &&
    k.alive &&
    !k.fled &&
    unitOccupiesHex(k,x,y)
  ) || null;
}

function occupiedByAnyUnit(x,y,excludeId=null){
  return allUnits().some(unit=>
    unit?.id!==excludeId &&
    unit?.alive &&
    !unit.fled &&
    unitOccupiesHex(unit,x,y)
  );
}

function countNeutralizedEnemies(){
  if(!game) return 0;
  return game.enemies.filter(k=>!k.alive || k.fled).length;
}

function markEnemyNeutralized(enemy){
  if(!enemy || enemy.xpCounted) return;
  enemy.xpCounted=true;
  game.xpPool+=(enemy.xpValue||0);
}

function checkCombatVictory(){
  if(!game || game.over) return false;

  if(activeEnemies().length===0){
    game.over=true;

    setTimeout(()=>{
      finishCombat(
        "Victory",
        `All ${game.enemies.length} hostile units are dead or have fled. `+
        livingPartyMembers()
          .map(unit=>`${unit.name} ${unit.hp}/${unit.maxHp} HP`)
          .join("; ")+"."
      );
    },deathFx ? 1000 : 100);

    return true;
  }

  return false;
}

function newGame(condition=selectedCombatCondition){
  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }

  const player=makeFighter();

  /*
    R186: configure terrain before encounter placement so a large footprint can
    validate every occupied cell against architectural walls at spawn time.
  */
  configureArchitecturalWalls(condition);

  /*
    R179 combat setup cleanup: the default battle test now starts with Carl
    as the sole player character. Ranger and Mage definitions remain in the
    engine for future roster selection but are not spawned automatically.
  */
  const kobolds=
    selectedMobEncounter==="kobolds"
      ? (condition==="wall" ? makeWallTestKoboldArmy(10,3,3) : makeKoboldArmy(10,3,3))
      : [];

  const enemies=
    selectedMobEncounter==="large-test"
      ? makeLargeMobTestEncounter(condition)
      : [...kobolds];

  /* R114: Orcs remain defined in the engine but are removed from this combat simulation. */
  lastOrcDeployment=null;

  camera.x=player.x;
  camera.y=player.y;

  game={
    round:0,
    over:false,
    condition,
    player,
    allies:[],
    enemies,
    order:[],
    turnIndex:0,
    active:null,
    xpAwarded:false,
    xpPool:0,
    areaEffects:[],

    /*
      R136 Monstrous Manual Kobold morale applies only to the Kobold encounter.
      Large-MOB test encounters use per-unit morale and do not share this group
      state.
    */
    enemyGroupMorale:kobolds.length
      ? {
          id:"kobold-group",
          label:"Kobold group",
          baseMorale:kobolds[0]?.morale ?? 9,
          moraleLabel:"Average (8-10)",
          initialCount:kobolds.length,
          manualRatioThreshold:1.5,
          manualRatioChecked:false,
          broken:false,
          checks:0
        }
      : null
  };

  lastPlayerVisibilityObserverId=null;

  aimMode=false;
  pendingAimAction=null;
  spellCastInProgress=false;
  sweepInProgress=false;
  quickCommandUnitIds.clear();
  quickCommandActive=false;
  quickCommandUnitId=null;
  quickCommandGeneration++;
  quickCommandRunning=false;
  aimCursor.x=player.x;
  aimCursor.y=player.y;

  if(deathFxTimer){
    clearTimeout(deathFxTimer);
    deathFxTimer=null;
  }

  if(unitBarkClearTimer){
    clearTimeout(unitBarkClearTimer);
    unitBarkClearTimer=null;
  }

  if(activityDetectedClearTimer){
    clearTimeout(activityDetectedClearTimer);
    activityDetectedClearTimer=null;
  }
  activityDetectedFx=null;

  deathFx=null;
  projectileFx=null;
  areaDamageFx=null;
  fireballExplosionFx=null;
  dragonBreathFx=null;
  colorSprayFx=null;
  magicEffectFx=[];
  castingGlowFx=[];
  fireDamageFx=[];
  if(transientUnitFxFrame!==null){
    cancelAnimationFrame(transientUnitFxFrame);
    transientUnitFxFrame=null;
  }
  deathActionPauseUntil=0;

  combatOpeningSpeechDone=false;
  combatAwaitingStart=false;
  if(combatMessageClearTimer){
    clearTimeout(combatMessageClearTimer);
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(combatMessageFlashTimer);
    combatMessageFlashTimer=null;
  }

  combatMessageSequence++;
  combatMessageText="";
  combatMessageTone="normal";
  combatMessageHoldUntil=0;

  ui.combatLog.innerHTML="";
  ui.resultOverlay.classList.remove("show");

  log("Combat stress test initialized.","system");
  log(
    condition==="wall"
      ? "Combat Condition: WALL TEST — enlarged indoor grey-floor building, no indoor trees, solid architectural walls block movement and line of sight; use the open west entrance."
      : "Combat Condition: GRASSY BATTLEFIELD — open-field movement and line of sight.",
    "system"
  );
  log(
    `Temporary battlefield: ${MAP_WIDTH_HEXES} × ${MAP_HEIGHT_HEXES} hexes. Fleeing units must cross a map edge to escape.`,
    "system"
  );
  log(
    `Level ${player.level} Fighter ready: ${player.maxHp} HP, AC ${player.ac}, THAC0 ${player.thaco}, `+
    `${player.weapon}, ${player.attacksLabel}.`,
    "system"
  );

  if(selectedMobEncounter==="large-test"){
    const large=enemies[0];
    log(
      `Juvenile Red Dragon deployed as one combat entity across ${unitFootprintCellCount(large)} occupied hexes; `+
      `${large.maxHp} HP, AC ${large.ac}, THAC0 ${large.thaco}, Move ${large.move}.`,
      "system"
    );
    log(
      "Multi-hex test rules: one initiative slot, one HP pool, one target identity, one save/damage resolution per area effect.",
      "system"
    );
  }else{
    log(
      `10 Kobolds deployed: AC 7, THAC0 20, Move 6, 1d4 HP each; dagger only; new dagger sprite set.`,
      "system"
    );

    log(
      `3 Kobold Body Guards deployed: AC 6, THAC0 20, Move 6, 4 HP each; Short Sword 1d6, shield, leather armor; XP 15.`,
      "system"
    );

    log(
      `3 Kobold Slingers deployed: AC 7, THAC0 20, Move 6, 1d4 HP each; Sling with 10 sling bullets; XP 7.`,
      "system"
    );
  }

  if(lastMobDeployment){
    log(
      selectedMobEncounter==="large-test"
        ? `Red Dragon pivot: ${lastMobDeployment.anchor.x},${lastMobDeployment.anchor.y}; 7-hex radius-1 footprint.`
        : (
            `Kobold deployment: ${lastMobDeployment.direction}, `+
            `anchor ${lastMobDeployment.anchorDistance} hexes from Carl, `+
            `cluster radius ${lastMobDeployment.clusterRadius}.`
          ),
      "system"
    );
  }


  /*
    R65: Carl no longer has opening dialogue.
    The combat screen immediately waits for the player's Space input.
  */
  combatOpeningSpeechDone=true;
  combatAwaitingStart=true;

  ui.roundLabel.textContent="ROUND —";
  ui.initiativeLabel.textContent="INIT: —";
  ui.turnBanner.textContent="<Press Space to Begin>";

  setCombatMessage(
    "<Press Space to Begin>",
    0,
    0
  );

  updateUi();
  draw();
}

function rollInitiative(){
  const rolls=[];

  for(const unit of allUnits()){
    if(!unit.alive || unit.fled) continue;

    rolls.push({
      id:unit.id,
      roll:d(10),
      tie:d(10)
    });
  }

  rolls.sort((a,b)=>
    a.roll-b.roll ||
    a.tie-b.tie ||
    a.id.localeCompare(b.id)
  );

  return rolls;
}

function startRound(){
  if(game.over) return;

  game.round++;
  expireTimedUnitEffects();
  game.player.turnMoves=0;
  game.player.fullMove=false;
  game.player.waitedThisRound=false;
  game.player.sweepUsedThisRound=false;
  sweepInProgress=false;
  game.player.attacksThisRound=fighterAttacksThisRound(game.player,game.round);
  game.player.attacksRemaining=game.player.attacksThisRound;

  for(const ally of game.allies || []){
    if(!ally.alive || ally.fled) continue;

    if(isPlayerControlledUnit(ally)){
      ally.turnMoves=0;
      ally.fullMove=false;
      ally.waitedThisRound=false;
      ally.attacksThisRound=1;
      ally.attacksRemaining=1;
    }

    ally.shotsThisRound=ally.missileRateOfFire || 1;
    ally.shotsRemaining=ally.shotsThisRound;
  }

  const rolls=rollInitiative();
  game.order=rolls.map(entry=>entry.id);
  game.turnIndex=0;

  const fighterRoll=rolls.find(entry=>entry.id==="player")?.roll ?? "—";
  const firstUnit=getUnitById(game.order[0]);

  ui.roundLabel.textContent=`ROUND ${game.round}`;
  ui.initiativeLabel.textContent=
    `INIT: FTR ${fighterRoll} / ${activeEnemies().length} MOBS`;

  log(
    `Round ${game.round}: ${game.order.length} initiative slots. `+
    `${firstUnit?.name || "Unknown"} acts first. `+
    `Fighter attacks this round: ${game.player.attacksThisRound}.`,
    "system"
  );

  beginTurn();
}

function unitActionName(unit){
  return unit?.name || "Unit";
}

function unitActionWeapon(unit){
  return (
    unit?.weapon ||
    unit?.weaponBaseName ||
    unit?.rangedWeapon ||
    "weapon"
  );
}

function setUnitActionBanner(unit,action){
  if(!ui?.turnBanner) return;

  /* R137: do not reveal an off-LOS hostile's identity/action in the banner. */
  if(
    unit?.controller==="mob" &&
    game?.condition==="wall" &&
    !mobPositionVisibleToFriendlyParty(unit)
  ){
    ui.turnBanner.textContent=
      activityDetectedFx?.unitId===unit.id
        ? "ACTIVITY DETECTED"
        : "ENEMY ACTIVITY";
    return;
  }

  ui.turnBanner.textContent=
    `${unitActionName(unit)} — ${action}`;
}

function refreshTurnBanner(){
  if(!game) return;

  if(game.over){
    ui.turnBanner.textContent="COMBAT COMPLETE";
    return;
  }

  if(game.round===0){
    if(combatAwaitingStart && combatOpeningSpeechDone){
      ui.turnBanner.textContent="<Press Space to Begin>";
    }else{
      ui.turnBanner.textContent="Dungeon Crawler Carl";
    }
    return;
  }

  const active=getUnitById(game.active);

  if(aimMode){
    const aimingSpell=
      pendingAimAction?.spellId
        ? getSpellEntry(pendingAimAction.spellId)?.name
        : null;
    const aimer=activePlayerControlledUnit() || active || game.player;

    ui.turnBanner.textContent=aimingSpell
      ? `${aimer.name} — Aiming ${aimingSpell}`
      : `${aimer.name} — Aiming`;
    return;
  }

  if(isPlayerControlledUnit(active)){
    ui.turnBanner.textContent=(
      isQuickCommandUnit(active)
        ? `${active.name} — Quick Command`
        : active.guard
          ? `${active.name} — Guarding`
          : `${active.name} — Your Turn`
    );
  }else if(active?.controller==="npc"){
    setUnitActionBanner(active,"Ready");
  }else if(active?.controller==="mob"){
    setUnitActionBanner(active,active.fleeing ? "Fleeing" : "Ready");
  }else{
    ui.turnBanner.textContent="AWAITING INITIATIVE";
  }
}

function beginTurn(){
  if(game.over) return;

  const holdRemaining=combatActionPauseRemaining();
  if(holdRemaining>0){
    if(aiTimer) clearTimeout(aiTimer);
    aiTimer=setTimeout(()=>{ aiTimer=null; beginTurn(); },holdRemaining);
    return;
  }

  if(game.turnIndex>=game.order.length){
    startRound();
    return;
  }

  const actorId=game.order[game.turnIndex];
  const actor=getUnitById(actorId);

  if(!actor || !actor.alive || actor.fled){
    game.turnIndex++;
    beginTurn();
    return;
  }

  game.active=actorId;

  /*
    R137: an unseen hostile no longer gives away its position merely by becoming
    the active initiative actor. Camera focus is earned by LOS or a successful
    party Listen check during movement.
  */
  if(actor.controller!=="mob" || mobPositionVisibleToFriendlyParty(actor)){
    centerCameraOn(actor);
  }

  refreshTurnBanner();
  updateUi();
  draw();

  if(handleTurnControlEffects(actor)) return;

  if(isPlayerControlledUnit(actor)){
    if(actor.guard){
      actor.guard=false;
      actor.guardBaselineAdjacentIds=[];
      log(`${actor.name}'s unused Guard stance expires as the next action begins.`,"system");
    }

    actor.turnMoves=0;
    actor.fullMove=false;
    if(!Number.isFinite(actor.attacksThisRound)) actor.attacksThisRound=1;
    if(!Number.isFinite(actor.attacksRemaining)) actor.attacksRemaining=actor.attacksThisRound;

    log(`${actor.name} is active under player control. ${activeEnemies().length} hostile units remain in combat.`,"system");

    syncQuickCommandState(actor.id);
    if(isQuickCommandUnit(actor)){
      const token=quickCommandGeneration;
      aiTimer=setTimeout(()=>{ aiTimer=null; runQuickCommandPlayerTurn(token); },220);
    }
    return;
  }

  if(actor.controller==="mob" && actor.guard){
    actor.guard=false;
    actor.guardBaselineAdjacentIds=[];
    log(`${actor.name}'s unused MOB Guard expires as its next turn begins.`,"system");
  }

  aiTimer=setTimeout(()=>{
    aiTimer=null;
    if(actor.controller==="npc"){
      if(actor.type==="mage") friendlyMageTurn(actor);
      else friendlyNpcTurn(actor);
    }else{
      mobTurn(actor);
    }
  },260);
}

function endTurn(){
  if(game.over) return;

  game.turnIndex++;
  game.active=null;
  updateUi();
  draw();

  const delay=Math.max(
    180,
    combatActionPauseRemaining()
  );

  aiTimer=setTimeout(()=>{
    aiTimer=null;
    beginTurn();
  },delay);
}



function longbowRangeBand(attacker,defender){
  const distance=unitDistance(attacker,defender);
  const increment=Math.max(
    1,
    attacker.missileRangeIncrementHexes || 7
  );

  if(distance<=increment){
    return {distance,band:"SHORT",penalty:0};
  }

  if(distance<=increment*2){
    return {distance,band:"MEDIUM",penalty:-2};
  }

  if(distance<=Math.min(
    attacker.missileMaxRangeHexes || increment*3,
    increment*3
  )){
    return {distance,band:"LONG",penalty:-4};
  }

  return {distance,band:"OUT",penalty:null};
}

function arrowMissEndpoint(attacker,defender){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const dx=to.x-from.x;
  const dy=to.y-from.y;
  const len=Math.hypot(dx,dy) || 1;
  const ux=dx/len;
  const uy=dy/len;
  const side=((attacker.x+attacker.y)%2===0) ? 1 : -1;

  return {
    x:to.x + ux*26 + (-uy)*13*side,
    y:to.y - 18 + uy*8
  };
}

async function animateArrowProjectile(attacker,defender,hit){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const startPoint={
    x:from.x,
    y:from.y-16
  };

  const endPoint=hit
    ? {x:to.x,y:to.y-15}
    : arrowMissEndpoint(attacker,defender);

  const distance=Math.hypot(
    endPoint.x-startPoint.x,
    endPoint.y-startPoint.y
  );

  const duration=Math.max(
    130,
    Math.min(300,100+distance*0.22)
  );

  const started=performance.now();

  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx={
      kind:"arrow",
      start:startPoint,
      end:endPoint,
      t,
      arcHeight:Math.max(7,Math.min(18,distance*0.035))
    };

    draw();

    if(t>=1) break;
    await sleep(16);
  }

  projectileFx=null;
  draw();
}

async function longbowAttack(attacker,defender){
  if(
    game.over ||
    !attacker?.alive ||
    !defender?.alive
  ){
    return {hit:false,killed:false,damage:0};
  }

  if(projectilePathBlocked(attacker,defender)){
    setCombatMessage(`${attacker.name} does not have a clear firing lane.`);
    return {hit:false,killed:false,damage:0,blockedByObstacle:true};
  }

  const range=longbowRangeBand(attacker,defender);

  if(range.penalty===null){
    return {hit:false,killed:false,damage:0,outOfRange:true};
  }

  const position=
    attackPositionData(attacker,defender);

  await focusRangedAttacker(attacker);

  attacker.weaponInHand="ranged";
  setUnitActionBanner(attacker,`Firing Longbow — ${position.label}`);

  updateFacingForStep(
    attacker,
    defender.x-attacker.x,
    defender.y-attacker.y
  );

  triggerUnitAttackPose(attacker);

  /* R97: do not play the successful-hit transient until the roll is known to hit. */
  const rawRoll=d(20);

  const dexMissileAdjustment=
    dexterityAdjustments(attacker.stats?.dex ?? 10).missile;

  const totalAttackBonus=
    (attacker.missileAttackBonus||0)+
    dexMissileAdjustment+
    range.penalty+
    attackEffectModifier(attacker,defender);

  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "small-device-missile"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  const resolution=resolveMissileAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  playNaturalAttackRollSound(rawRoll);

  setLastRoll(
    `${attacker.name} longbow [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored); `
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}; `
    )+
    `${range.band} ${range.distance} hexes`
  );

  if(resolution.hit){
    /* Confirmed Longbow hit: retain the existing successful-hit sound. */
    playAttackSound();
  }

  await animateArrowProjectile(
    attacker,
    defender,
    resolution.hit
  );

  if(!resolution.hit){
    await focusRangedMissTarget(defender);

    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} fires at ${defender.name} from ${position.label}: `+
      `${resolution.automatic ? "automatic miss." : `modified ${resolution.modifiedRoll} vs ${targetNumber}, miss.`}`,
      "system"
    );

    flashAttack(attacker,defender,false);

    return {
      hit:false,
      killed:false,
      damage:0,
      criticalMiss:rawRoll===1,
      attackSector:position.label,
      attackPosition:position
    };
  }

  const bow=getMissileCatalogEntry("bow-long");
  const damageExpression=damageExpressionForSize(
    bow,
    defender
  );

  const damageRoll=rollDiceExpression(
    damageExpression
  );

  const damage=Math.max(1,damageRoll.total);

  defender.hp=Math.max(
    0,
    defender.hp-damage
  );
  onUnitDamaged(defender,damage);

  await focusDamagedTargetIfOffscreen(defender);

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} hits ${defender.name} from ${position.label} with a Longbow for ${damage} damage (${damageExpression}).`,
    "good"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);

    markEnemyNeutralized(defender);

    if(
      isKoboldUnit(defender) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:0,
        source:"Longbow"
      });
    }

    log(
      `${defender.name} is brought down by ${attacker.name}.`,
      "good"
    );

    updateUi();
    draw();

    if(checkCombatVictory()){
      return {
        hit:true,
        killed:true,
        damage
      };
    }

    return {
      hit:true,
      killed:true,
      damage
    };
  }

  updateUi();
  draw();

  return {
    hit:true,
    killed:false,
    damage
  };
}

function nearestEnemyForFriendlyNpc(npc){
  return activeEnemies()
    .slice()
    .sort((a,b)=>
      unitDistance(npc,a)-unitDistance(npc,b) ||
      a.hp-b.hp ||
      a.id.localeCompare(b.id)
    )[0] || null;
}


function mageMemorizedAction(mage,spellId){
  return {
    type:"memorized-spell",
    spellId,
    casterLevel:mage.level,
    sourceUnitId:mage.id,
    spellCommitted:false
  };
}

function bestSafeFireballTarget(mage,source=mage){
  const spell=getSpellEntry("fireball");
  const range=spellRangeHexes(spell,mage?.level);
  let best=null;

  for(const centerEnemy of activeEnemies()){
    if(unitDistance(source,centerEnemy)>range) continue;
    if(lineOfSightBlocked(source,centerEnemy)) continue;

    const cells=fireballBlastCells(centerEnemy);
    const affected=livingUnitsInAreaCells(cells);
    const friendlyCount=affected.filter(unit=>unit.faction===mage.faction).length;
    if(friendlyCount>0) continue;

    const enemies=affected.filter(unit=>unit.faction!==mage.faction);
    const score=enemies.length*100 + enemies.reduce((sum,unit)=>sum+Math.max(0,20-unit.hp),0);

    if(!best || score>best.score){
      best={
        x:centerEnemy.x,
        y:centerEnemy.y,
        enemyCount:enemies.length,
        score
      };
    }
  }

  return best;
}

function bestSafeSleepTarget(mage,source=mage){
  const spell=getSpellEntry("sleep");
  const range=spellRangeHexes(spell,mage?.level);
  let best=null;

  for(const centerEnemy of activeEnemies()){
    if(unitDistance(source,centerEnemy)>range) continue;
    if(lineOfSightBlocked(source,centerEnemy)) continue;

    /* Sleep's implemented area is one complete 7-hex radius-1 cluster. */
    const cells=hexesWithinRadius(centerEnemy,1);
    const affected=livingUnitsInAreaCells(cells);
    if(affected.some(unit=>unit.faction===mage.faction)) continue;

    const eligible=affected.filter(unit=>
      unit.faction!==mage.faction &&
      spellHitDiceValue(unit)<4.375
    );

    if(!best || eligible.length>best.enemyCount){
      best={x:centerEnemy.x,y:centerEnemy.y,enemyCount:eligible.length};
    }
  }

  return best;
}

function bestMageOffensiveActionFrom(mage,source=mage){
  if(!mage?.alive || mage.fled) return null;

  if(mageCanCastMemorizedSpell(mage,"fireball")){
    const blast=bestSafeFireballTarget(mage,source);
    if(blast?.enemyCount>=2){
      return {
        spellId:"fireball",
        targetHex:{x:blast.x,y:blast.y},
        target:null,
        score:3000+blast.score
      };
    }
  }

  if(mageCanCastMemorizedSpell(mage,"sleep")){
    const sleepTarget=bestSafeSleepTarget(mage,source);
    if(sleepTarget?.enemyCount>=2){
      return {
        spellId:"sleep",
        targetHex:{x:sleepTarget.x,y:sleepTarget.y},
        target:null,
        score:2000+sleepTarget.enemyCount*100
      };
    }
  }

  if(mageCanCastMemorizedSpell(mage,"magic-missile")){
    const spell=getSpellEntry("magic-missile");
    const range=spellRangeHexes(spell,mage.level);
    const target=activeEnemies()
      .filter(enemy=>
        unitDistance(source,enemy)<=range &&
        !lineOfSightBlocked(source,enemy)
      )
      .sort((a,b)=>
        unitDistance(source,a)-unitDistance(source,b) ||
        a.hp-b.hp ||
        a.id.localeCompare(b.id)
      )[0] || null;

    if(target){
      return {
        spellId:"magic-missile",
        targetHex:{x:target.x,y:target.y},
        target,
        score:1000-Math.min(999,unitDistance(source,target))
      };
    }
  }

  return null;
}

function bestMageVisibleEnemyFrom(mage,source=mage){
  if(!mage || !source) return null;

  return activeEnemies()
    .filter(enemy=>
      enemy.alive &&
      !enemy.fled &&
      !lineOfSightBlocked(source,enemy)
    )
    .sort((a,b)=>
      unitDistance(source,a)-unitDistance(source,b) ||
      a.hp-b.hp ||
      a.id.localeCompare(b.id)
    )[0] || null;
}

/*
  R138: Mage movement solves LOS before spell selection.
  The path search knows nothing about Fireball, Sleep, Magic Missile, or any
  other spell. It finds the nearest safe reachable hex with clear LOS to at
  least one enemy. Only after the Mage actually occupies such a hex may spell
  selection run.
*/
function pathToNearestMageLosHex(mage,{avoidThreatened=true}={}){
  if(!mage?.alive || mage.fled) return null;

  const targets=activeEnemies();
  if(!targets.length) return null;

  const start={x:mage.x,y:mage.y};
  const queue=[start];
  const seen=new Set([key(start.x,start.y)]);
  const came=new Map();

  const reconstruct=(end)=>{
    const path=[];
    let cur={x:end.x,y:end.y};

    while(cur){
      path.push(cur);
      if(cur.x===start.x && cur.y===start.y) break;
      cur=came.get(key(cur.x,cur.y)) || null;
    }

    path.reverse();
    return path;
  };

  while(queue.length){
    const cur=queue.shift();
    const threatened=avoidThreatened && rangedAiPositionThreatened(mage,cur);
    const visibleEnemy=!threatened
      ? bestMageVisibleEnemyFrom(mage,cur)
      : null;

    if(visibleEnemy){
      return {
        path:reconstruct(cur),
        visibleEnemy,
        losHex:{x:cur.x,y:cur.y}
      };
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const na={x:cur.x+a.x,y:cur.y+a.y};
      const nb={x:cur.x+b.x,y:cur.y+b.y};
      const da=Math.min(...targets.map(target=>hexDistance(na,target)));
      const db=Math.min(...targets.map(target=>hexDistance(nb,target)));
      return da-db || a.x-b.x || a.y-b.y;
    });

    for(const dir of dirs){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);

      if(seen.has(nk)) continue;
      if(isWall(next.x,next.y)) continue;
      if(architecturalWallBlocksStep(cur,next)) continue;
      if(occupiedByAnyUnit(next.x,next.y,mage.id)) continue;

      seen.add(nk);
      came.set(nk,{x:cur.x,y:cur.y});
      queue.push(next);
    }
  }

  return null;
}

async function castMageAiAction(mage,action){
  if(!action) return false;

  return await castPreparedCombatSpell(
    mageMemorizedAction(mage,action.spellId),
    action.targetHex,
    action.target
  );
}

async function friendlyMageTurn(mage){
  const quickControlledPlayerMage=!!(
    mage &&
    mage.controller==="player" &&
    isQuickCommandUnit(mage)
  );

  if(
    game.over ||
    !mage ||
    (mage.controller!=="npc" && !quickControlledPlayerMage) ||
    mage.type!=="mage" ||
    game.active!==mage.id ||
    !mage.alive
  ){
    return;
  }

  /*
    R138 LOS-first spellcaster logic:
    1) If no enemy is visible, do NOT choose a spell yet.
    2) Move toward the nearest safe hex with LOS, even if it takes multiple rounds.
    3) Only after the Mage actually occupies an LOS hex is spell selection allowed.
  */
  let visibleEnemy=bestMageVisibleEnemyFrom(mage,mage);

  if(!visibleEnemy){
    setUnitActionBanner(mage,"Seeking Line of Sight");

    const plan=pathToNearestMageLosHex(mage,{avoidThreatened:true});

    if(plan?.path?.length>1){
      const stepsToLosHex=plan.path.length-1;
      const movementLimit=Math.min(
        Math.max(0,mage.move||0),
        stepsToLosHex
      );
      const reachesLosThisTurn=movementLimit>=stepsToLosHex;
      const canCastAfterMove=
        reachesLosThisTurn &&
        stepsToLosHex<=Math.max(0,mage.halfMove||0);

      log(
        reachesLosThisTurn
          ? `${mage.name} has no line of sight and moves ${stepsToLosHex} hex${stepsToLosHex===1 ? "" : "es"} to gain it.`
          : `${mage.name} has no line of sight and advances toward the nearest LOS hex (${stepsToLosHex} hexes away).`,
        "system"
      );

      await animateAiAlongPath(mage,plan.path,movementLimit);

      if(game.over) return;
      if(!mage.alive){ endTurn(); return; }

      visibleEnemy=bestMageVisibleEnemyFrom(mage,mage);

      /* Still en route: absolutely no spell decision is made this round. */
      if(!visibleEnemy){
        if(!game.over) endTurn();
        return;
      }

      /*
        The Mage reached LOS, but a move beyond half movement consumes the turn
        under the current move-and-cast action rule. Spell choice waits until the
        next round rather than being preselected while moving.
      */
      if(!canCastAfterMove){
        log(
          `${mage.name} reaches a clear line of sight but has moved too far to cast this round.`,
          "system"
        );
        if(!game.over) endTurn();
        return;
      }
    }else{
      log(`${mage.name} cannot find a reachable line-of-sight hex and holds position.`,"system");
      if(!game.over) endTurn();
      return;
    }
  }

  /* LOS now exists. Only now may the Mage evaluate which spell fits best. */
  setUnitActionBanner(mage,"Choosing Spell");
  log(`${mage.name} has line of sight and reviews memorized spells.`,"system");

  let action=bestMageOffensiveActionFrom(mage,mage);

  if(action){
    const cast=await castMageAiAction(mage,action);
    if(cast) return;
  }

  /* If no useful offensive spell is legal, establish personal defense. */
  if(
    !getUnitEffect(mage,"shield") &&
    mageCanCastMemorizedSpell(mage,"shield")
  ){
    await castPreparedCombatSpell(
      mageMemorizedAction(mage,"shield"),
      {x:mage.x,y:mage.y},
      mage
    );
    return;
  }

  /* Out of useful prepared spells: use the Staff if adjacent. */
  const adjacent=activeEnemies()
    .filter(enemy=>canMeleeReach(mage,enemy))
    .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));

  if(adjacent.length){
    setUnitActionBanner(mage,"Staff Attack");
    const result=attack(mage,adjacent[0]);
    if(result?.hit || result?.criticalMiss){
      await waitForCombatActionPause();
    }else{
      await sleep(180);
    }
  }else{
    log(`${mage.name} has LOS but no useful prepared spell and holds position.`,"system");
  }

  if(!game.over) endTurn();
}


/* ============================================================
   R127 RANGED AI FIRING-LANE SEARCH
   Ranged AI treats LOS as a positional problem. If no enemy can be
   targeted from the current hex, search the movement graph for the nearest
   legal hex that has both weapon range and clear line of sight to any enemy.
   ============================================================ */
function rangedAiOpponents(unit){
  if(!unit) return [];

  return unit.faction==="player"
    ? activeEnemies()
    : livingPartyMembers();
}

function rangedAiSourceEntity(unit,source){
  if(!unit || !source) return source;
  if(source===unit) return unit;
  return {...unit,x:source.x,y:source.y};
}

function rangedAiRangeBandFrom(unit,source,target){
  if(!unit || !source || !target) return {distance:Infinity,band:"OUT",penalty:null};

  const sourceEntity=rangedAiSourceEntity(unit,source);
  const distance=unitDistance(sourceEntity,target);

  if(unit.rangedWeapon==="Sling"){
    const shortRange=Math.max(1,unit.slingShortRange||4);
    const mediumRange=Math.max(shortRange,unit.slingMediumRange||7);
    const longRange=Math.max(mediumRange,unit.slingLongRange||11);

    if(distance<=shortRange) return {distance,band:"SHORT",penalty:0};
    if(distance<=mediumRange) return {distance,band:"MEDIUM",penalty:-2};
    if(distance<=longRange) return {distance,band:"LONG",penalty:-5};
    return {distance,band:"OUT",penalty:null};
  }

  if(unit.rangedWeapon==="Longbow"){
    const increment=Math.max(1,unit.missileRangeIncrementHexes||7);
    const maxRange=Math.min(unit.missileMaxRangeHexes||increment*3,increment*3);

    if(distance<=increment) return {distance,band:"SHORT",penalty:0};
    if(distance<=increment*2) return {distance,band:"MEDIUM",penalty:-2};
    if(distance<=maxRange) return {distance,band:"LONG",penalty:-4};
    return {distance,band:"OUT",penalty:null};
  }

  return {distance,band:"OUT",penalty:null};
}

function rangedAiPositionThreatened(unit,source){
  const sourceEntity=rangedAiSourceEntity(unit,source);

  return rangedAiOpponents(unit).some(enemy=>
    enemy.alive &&
    !enemy.fled &&
    unitDistance(sourceEntity,enemy)<=1 &&
    canMeleeReach(sourceEntity,enemy)
  );
}

function rangedAiCanAttackFrom(unit,source,target){
  if(
    !unit ||
    !source ||
    !target?.alive ||
    target.fled ||
    target.faction===unit.faction
  ){
    return false;
  }

  if(
    Number.isFinite(unit.missileAmmoQuantity) &&
    unit.missileAmmoQuantity<=0
  ){
    return false;
  }

  const sourceEntity=rangedAiSourceEntity(unit,source);
  const range=rangedAiRangeBandFrom(unit,source,target);
  if(range.penalty===null) return false;

  /* Dedicated Slingers will not stand toe-to-toe and sling at range 1. */
  if(unit.type==="kobold-slinger" && range.distance<=1){
    return false;
  }

  return !projectilePathBlocked(sourceEntity,target);
}

function bestRangedAiTargetFrom(unit,source=unit){
  const sourceEntity=rangedAiSourceEntity(unit,source);

  return rangedAiOpponents(unit)
    .filter(target=>rangedAiCanAttackFrom(unit,source,target))
    .sort((a,b)=>
      unitDistance(sourceEntity,a)-unitDistance(sourceEntity,b) ||
      a.hp-b.hp ||
      a.id.localeCompare(b.id)
    )[0] || null;
}

function pathToNearestRangedFiringHex(unit,{avoidThreatened=true}={}){
  if(!unit?.alive || unit.fled || !unit.rangedWeapon) return null;

  const targets=rangedAiOpponents(unit);
  if(!targets.length) return null;

  const start={x:unit.x,y:unit.y};
  const queue=[start];
  const seen=new Set([key(start.x,start.y)]);
  const came=new Map();

  const reconstruct=(end)=>{
    const path=[];
    let cur={x:end.x,y:end.y};

    while(cur){
      path.push(cur);
      if(cur.x===start.x && cur.y===start.y) break;
      cur=came.get(key(cur.x,cur.y)) || null;
    }

    path.reverse();
    return path;
  };

  while(queue.length){
    const cur=queue.shift();
    const threatened=avoidThreatened && rangedAiPositionThreatened(unit,cur);
    const target=!threatened ? bestRangedAiTargetFrom(unit,cur) : null;

    if(target){
      return {
        path:reconstruct(cur),
        target,
        firingHex:{x:cur.x,y:cur.y},
        distance:unitDistanceAt(unit,cur.x,cur.y,target)
      };
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const na={x:cur.x+a.x,y:cur.y+a.y};
      const nb={x:cur.x+b.x,y:cur.y+b.y};
      const da=Math.min(...targets.map(target=>unitDistanceAt(unit,na.x,na.y,target)));
      const db=Math.min(...targets.map(target=>unitDistanceAt(unit,nb.x,nb.y,target)));
      return da-db || a.x-b.x || a.y-b.y;
    });

    for(const dir of dirs){
      const next={x:cur.x+dir.x,y:cur.y+dir.y};
      const nk=key(next.x,next.y);

      if(seen.has(nk)) continue;
      if(unitTransitionBlocked(unit,cur,next)) continue;

      seen.add(nk);
      came.set(nk,{x:cur.x,y:cur.y});
      queue.push(next);
    }
  }

  return null;
}

async function animateAiAlongPath(unit,path,maxSteps){
  if(!unit || !Array.isArray(path) || path.length<2) return 0;

  const steps=Math.min(
    Math.max(0,Number(maxSteps)||0),
    path.length-1
  );

  let index=1;
  await animateEntitySteps(
    unit,
    steps,
    ()=>path[index++] || null,
    105
  );

  return steps;
}

async function friendlyNpcTurn(npc){
  if(
    game.over ||
    !npc ||
    npc.controller!=="npc" ||
    game.active!==npc.id ||
    !npc.alive
  ){
    return;
  }

  setUnitActionBanner(npc,"Choosing Target");

  log(
    `${npc.name} selects its action as a friendly NPC.`,
    "system"
  );

  /* Adjacent hostiles still force the Ranger onto her Short Sword. */
  const adjacentEnemy=activeEnemies()
    .filter(enemy=>canMeleeReach(npc,enemy))
    .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id))[0] || null;

  if(adjacentEnemy){
    log(
      `${npc.name} draws her Short Sword against the adjacent ${adjacentEnemy.name}.`,
      "system"
    );

    const result=attack(npc,adjacentEnemy);
    npc.shotsRemaining=0;

    if(game.over) return;

    if(result?.hit || result?.criticalMiss){
      await waitForCombatActionPause();
    }else{
      await sleep(180);
    }

    if(!game.over) endTurn();
    return;
  }

  /*
    R127: if the Ranger has no legal Longbow shot from here, find the nearest
    reachable hex that restores LOS to any enemy. A firing hex reached within
    half movement preserves the shot; a farther firing lane uses the turn to
    reposition under the current movement/action rules.
  */
  let target=bestRangedAiTargetFrom(npc,npc);

  if(!target){
    const plan=pathToNearestRangedFiringHex(npc,{avoidThreatened:true});

    if(plan?.path?.length>1){
      const stepsToFiringHex=plan.path.length-1;
      const canMoveAndFire=stepsToFiringHex<=Math.max(0,npc.halfMove||0);
      const movementLimit=canMoveAndFire
        ? stepsToFiringHex
        : Math.min(Math.max(0,npc.move||0),stepsToFiringHex);

      log(
        canMoveAndFire
          ? `${npc.name} has no clear Longbow shot and moves ${stepsToFiringHex} hex${stepsToFiringHex===1 ? "" : "es"} to gain line of sight.`
          : `${npc.name} has no line of sight and advances toward a firing lane (${stepsToFiringHex} hexes away).`,
        "system"
      );

      await animateAiAlongPath(npc,plan.path,movementLimit);

      if(game.over) return;
      if(!npc.alive){ endTurn(); return; }

      if(!canMoveAndFire){
        if(!game.over) endTurn();
        return;
      }

      target=bestRangedAiTargetFrom(npc,npc);
    }
  }

  if(!target){
    log(`${npc.name} cannot find a reachable Longbow firing lane this turn.`,"system");
    if(!game.over) endTurn();
    return;
  }

  let shots=Math.max(
    1,
    Math.floor(npc.shotsRemaining || npc.missileRateOfFire || 1)
  );

  while(shots>0 && !game.over && npc.alive){
    /* A hostile may have become adjacent after the previous shot/kill. */
    const adjacent=activeEnemies()
      .filter(enemy=>canMeleeReach(npc,enemy))
      .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id))[0] || null;

    if(adjacent){
      log(
        `${npc.name} switches to her Short Sword against the adjacent ${adjacent.name}.`,
        "system"
      );

      const result=attack(npc,adjacent);
      npc.shotsRemaining=0;
      shots=0;

      if(game.over) return;
      if(result?.hit || result?.criticalMiss){
        await waitForCombatActionPause();
      }else{
        await sleep(180);
      }
      break;
    }

    target=bestRangedAiTargetFrom(npc,npc);
    if(!target){
      log(`${npc.name} has no remaining hostile in a clear Longbow firing lane.`,"system");
      break;
    }

    const result=await longbowAttack(npc,target);

    shots--;
    npc.shotsRemaining=shots;

    if(game.over) return;

    if(result?.hit || result?.criticalMiss){
      await waitForCombatActionPause();
    }else{
      await sleep(180);
    }
  }

  if(!game.over){
    endTurn();
  }
}

function slingRangeBand(attacker,defender){
  const distance=unitDistance(attacker,defender);

  if(distance<=attacker.slingShortRange){
    return {distance,band:"SHORT",penalty:0};
  }

  if(distance<=attacker.slingMediumRange){
    return {distance,band:"MEDIUM",penalty:-2};
  }

  if(distance<=attacker.slingLongRange){
    return {distance,band:"LONG",penalty:-5};
  }

  return {distance,band:"OUT",penalty:null};
}

function canSling(attacker,defender){
  if(!attacker?.rangedWeapon || !defender?.alive) return false;
  if(Number.isFinite(attacker.missileAmmoQuantity) && attacker.missileAmmoQuantity<=0) return false;

  const range=slingRangeBand(attacker,defender);
  return range.penalty!==null;
}

const MOB_MISSILE_DEFAULT_DISTANCE=4;

function mobCanMissileAttack(mob,target){
  if(
    !mob ||
    mob.controller!=="mob" ||
    !target?.alive ||
    getUnitEffect(mob,"taunt")
  ){
    return false;
  }

  const distance=unitDistance(mob,target);

  /* R113 Slingers are dedicated missile troops and may fire from 2+ hexes. */
  if(mob.type==="kobold-slinger"){
    if(distance<=1) return false;
  }else if(distance<=MOB_MISSILE_DEFAULT_DISTANCE){
    return false;
  }

  if(projectilePathBlocked(mob,target)){
    return false;
  }

  if(mob.rangedWeapon==="Sling"){
    return canSling(mob,target);
  }

  return false;
}

async function mobMissileAttack(mob,target){
  if(mob.rangedWeapon==="Sling"){
    await slingAttack(mob,target);
    return true;
  }

  return false;
}


function slingMissEndpoint(attacker,defender){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);

  const dx=to.x-from.x;
  const dy=to.y-from.y;
  const len=Math.hypot(dx,dy) || 1;
  const ux=dx/len;
  const uy=dy/len;

  /* Let misses sail slightly past and to one side of the target. */
  const side=((attacker.x+attacker.y)%2===0) ? 1 : -1;

  return {
    x:to.x + ux*28 + (-uy)*10*side,
    y:to.y - 20 + uy*18 + ux*10*side
  };
}

function slingLaunchPoint(attacker){
  const c=hexCenter(attacker.x,attacker.y);
  const side=attacker.facing==="right" ? 1 : -1;

  return {
    x:c.x + side*10,
    y:c.y - 18
  };
}

function slingImpactPoint(defender){
  const c=hexCenter(defender.x,defender.y);

  return {
    x:c.x,
    y:c.y - 16
  };
}

async function animateSlingProjectile(attacker,defender,hit){
  const startPoint=slingLaunchPoint(attacker);
  const endPoint=hit
    ? slingImpactPoint(defender)
    : slingMissEndpoint(attacker,defender);

  const distance=Math.hypot(endPoint.x-startPoint.x,endPoint.y-startPoint.y);
  const duration=Math.max(150,Math.min(320,110+distance*0.28));
  const arcHeight=Math.max(18,Math.min(34,12+distance*0.08));
  const started=performance.now();

  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx={
      kind:"rock",
      start:startPoint,
      end:endPoint,
      t,
      arcHeight
    };

    draw();

    if(t>=1) break;

    await sleep(16);
  }

  projectileFx=null;
  draw();
}

async function slingAttack(attacker,defender){
  if(game.over || !attacker.alive || !defender.alive) return false;

  if(Number.isFinite(attacker.missileAmmoQuantity) && attacker.missileAmmoQuantity<=0){
    setCombatMessage(`${attacker.name} is out of sling bullets.`);
    log(`${attacker.name} has no sling bullets remaining.`,"system");
    return false;
  }

  if(projectilePathBlocked(attacker,defender)){
    setCombatMessage(`${attacker.name} does not have a clear firing lane.`);
    return;
  }

  const range=slingRangeBand(attacker,defender);

  if(range.penalty===null){
    return;
  }

  const position=
    attackPositionData(attacker,defender);

  await focusRangedAttacker(attacker);

  setUnitActionBanner(attacker,`Preparing Sling — ${position.label}`);

  playSlingWindupSound();
  draw();

  /* Let the player hear/see the sling wind-up before release. */
  await sleep(430);

  if(game.over || !attacker.alive || !defender.alive) return;

  attacker.weaponInHand="ranged";
  setUnitActionBanner(attacker,"Firing Sling");

  triggerUnitAttackPose(attacker);
  playSlingReleaseSound();

  if(Number.isFinite(attacker.missileAmmoQuantity)){
    attacker.missileAmmoQuantity=Math.max(0,attacker.missileAmmoQuantity-1);
    updateUi();
  }

  /* Roll the physical attack die BEFORE applying any modifier. */
  const rawRoll=d(20);

  const dexMissileAdjustment=
    attacker.stats?.dex !== undefined
      ? dexterityAdjustments(attacker.stats.dex).missile
      : 0;

  const totalAttackBonus=
    (attacker.missileAttackBonus||0)+
    dexMissileAdjustment+
    range.penalty+
    attackEffectModifier(attacker,defender);

  /* THAC0/AC target before range, Dexterity, or other attack modifiers. */
  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "small-device-missile"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  const resolution=resolveMissileAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  playNaturalAttackRollSound(rawRoll);

  const hit=resolution.hit;

  setLastRoll(
    `${attacker.name} sling [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored); `
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}; `
    )+
    `${range.band} ${range.distance} hexes `+
    `(range ${formatSignedAdjustment(range.penalty)}`+
    `${dexMissileAdjustment ? `, DEX missile ${formatSignedAdjustment(dexMissileAdjustment)}` : ""})`
  );

  await animateSlingProjectile(attacker,defender,hit);

  if(!hit){
    await focusRangedMissTarget(defender);

    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} slings a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "bullet" : "stone"} at ${defender.name} from ${position.label}, ${range.distance} hexes: `+
      `${resolution.automatic ? `raw d20 ${rawRoll}, automatic miss.` : `raw d20 ${rawRoll}, modified ${resolution.modifiedRoll} vs ${targetNumber}, miss.`}`,
      "bad"
    );

    flashAttack(attacker,defender,false);
    refreshTurnBanner();

    if(rawRoll===1){
      await waitForCombatActionPause();
    }

    return;
  }

  playRockImpactSound();

  const damageExpression=missileDamageExpression(attacker,defender);
  const damageRoll=rollDiceExpression(damageExpression);
  const damage=Math.max(1,damageRoll.total);

  defender.hp=Math.max(0,defender.hp-damage);
  onUnitDamaged(defender,damage);

  await focusDamagedTargetIfOffscreen(defender);

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} slings a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "bullet" : "stone"} at ${defender.name} from ${position.label}, ${range.distance} hexes `+
    `(${range.band}) and hits for ${damage} damage (${damageExpression}).`,
    "bad"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);

    log(`${defender.name} is slain by a ${attacker.missileAmmoCatalogId==="sling-bullet" ? "sling bullet" : "sling stone"}.`,"bad");

    updateUi();
    draw();

    if(defender.faction==="player"){
      if(defender.id==="player"){
        ui.turnBanner.textContent="DUNGEON CRAWLER CARL FALLEN";
      }

      checkPartyDefeat();
    }

    await waitForCombatActionPause();
    return;
  }

  updateUi();
  refreshTurnBanner();
}



function resolveChillTouchOnHit(attacker,defender){
  const effect=getUnitEffect(attacker,"chill-touch");

  if(!effect || !defender?.alive){
    return 0;
  }

  const casterLevel=Number(effect.data?.casterLevel)||1;

  if(isUndeadUnit(defender)){
    const save=rollSpellSave(defender,attacker);

    if(!save.success){
      addUnitEffect(defender,{
        id:"spook",
        name:"Fleeing from Chill Touch",
        kind:"debuff",
        expiresRound:game.round+Math.max(1,d(4)+casterLevel),
        detail:"Undead repelled by Chill Touch",
        data:{sourceUnitId:attacker.id}
      });
    }

    return 0;
  }

  const save=rollSpellSave(defender,attacker);

  if(save.success){
    log(`${defender.name} resists the Chill Touch rider effect.`,"system");
    return 0;
  }

  const extra=rollDiceExpression("1d4").total;
  defender.hp=Math.max(0,defender.hp-extra);
  onUnitDamaged(defender,extra);

  const existing=getUnitEffect(defender,"chill-touch-strength-loss");
  const strengthLoss=(Number(existing?.data?.strengthLoss)||0)+1;

  addUnitEffect(defender,{
    id:"chill-touch-strength-loss",
    name:"Chill Touch: Strength Loss",
    kind:"debuff",
    detail:`Strength loss ${strengthLoss}; attack penalty ${formatSignedAdjustment(-Math.floor(strengthLoss/2))}`,
    data:{strengthLoss}
  });

  log(
    `${attacker.name}'s Chill Touch adds ${extra} damage and 1 point of Strength loss to ${defender.name}.`,
    "good"
  );

  return extra;
}

function meleeDamageExpression(attacker,defender){
  const catalogEntry=getWeaponCatalogEntry(attacker?.weaponCatalogId);
  if(catalogEntry) return damageExpressionForSize(catalogEntry,defender);

  return targetUsesLargeWeaponDamage(defender)
    ? (attacker?.weaponDamageL || attacker?.weaponDamageSM || "1d2")
    : (attacker?.weaponDamageSM || attacker?.weaponDamageL || "1d2");
}

function missileDamageExpression(attacker,defender){
  const ammo=getWeaponCatalogEntry(attacker?.missileAmmoCatalogId);
  if(ammo) return damageExpressionForSize(ammo,defender);

  const missile=getMissileCatalogEntry(attacker?.missileCatalogId);
  if(missile) return damageExpressionForSize(missile,defender);

  return targetUsesLargeWeaponDamage(defender)
    ? (attacker?.rangedDamageL || attacker?.rangedDamageSM || "1d2")
    : (attacker?.rangedDamageSM || attacker?.rangedDamageL || "1d2");
}

function attack(attacker,defender,options={}){
  if(game.over || !attacker.alive || !defender.alive){
    return {hit:false,killed:false,damage:0};
  }

  if(unitDistance(attacker,defender)<=1 && !canMeleeReach(attacker,defender)){
    setCombatMessage("A wall blocks the melee attack.");
    return {hit:false,killed:false,damage:0,blockedByWall:true};
  }

  const position=
    attackPositionData(attacker,defender);

  faceEntityToward(attacker,defender);
  attacker.weaponInHand="melee";

  triggerUnitAttackPose(attacker);

  setUnitActionBanner(
    attacker,
    options.actionLabel
      ? `${options.actionLabel} — ${position.label}`
      : `Attacking ${position.label} with ${unitActionWeapon(attacker)}`
  );

  /* R97: the hit/attack transient is result-dependent.
     A miss must produce only the whiff cue, never the hit transient. */

  const weaponHitBonus=attacker.weaponHitBonus || 0;
  const totalAttackBonus=
    (attacker.attackBonus || 0)+
    weaponHitBonus+
    attackEffectModifier(attacker,defender);

  /* Roll the physical attack die BEFORE applying any modifier. */
  const rawRoll=d(20);

  /* THAC0/AC establishes the unmodified target number. */
  const targetArmorClass=effectiveArmorClassForAttack(
    attacker,
    defender,
    "melee"
  );

  const targetNumber=
    attacker.thaco-targetArmorClass;

  /*
    Natural 1/20 are resolved from rawRoll before totalAttackBonus
    is ever considered by the resolver.
  */
  const resolution=resolveMeleeAttackD20(
    rawRoll,
    targetNumber,
    totalAttackBonus
  );

  playNaturalAttackRollSound(rawRoll);

  const hit=resolution.hit;

  setLastRoll(
    `${attacker.name} [${position.label}]: RAW d20 ${rawRoll}`+
    (
      resolution.automatic
        ? ` — ${resolution.automatic} (modifiers ignored)`
        : ` ${formatSignedAdjustment(totalAttackBonus)} = ${resolution.modifiedRoll} vs target ${targetNumber}`
    )+
    (
      position.directRear
        ? ` — rear +2; beneficial DEX AC and shield denied`
        : position.rearFlank
          ? ` — rear flank; shield denied`
          : ""
    )
  );

  if(!hit){
    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll
      );
    }

    log(
      `${attacker.name} attacks ${defender.name} from ${position.label}: raw d20 ${rawRoll}`+
      `${resolution.automatic ? " — automatic miss." : `, modified ${resolution.modifiedRoll} vs ${targetNumber} — miss.`}`,
      attacker.id==="player" ? "" : "bad"
    );
    flashAttack(attacker,defender,false);
    return {
      hit:false,
      killed:false,
      damage:0,
      criticalMiss:rawRoll===1,
      attackSector:position.label,
      attackPosition:position
    };
  }

  /* Confirmed melee hit: retain the existing successful-hit sound. */
  playAttackSound();

  const baseExpression=meleeDamageExpression(attacker,defender);
  const baseRoll=rollDiceExpression(baseExpression);
  const enlargedMultiplier=enlargedDamageMultiplier(attacker);
  const scaledBaseDamage=Math.ceil(baseRoll.total*enlargedMultiplier);
  const weaponBonus=(attacker.damageBonus||0)+(attacker.weaponDamageBonus||0);
  const bonusRoll=
    attacker.bonusDamageExpression
      ? rollDiceExpression(attacker.bonusDamageExpression)
      : {expression:null,total:0};

  let damage=Math.max(1,scaledBaseDamage+weaponBonus+bonusRoll.total);
  defender.hp=Math.max(0,defender.hp-damage);
  onUnitDamaged(defender,damage);
  if(attacker.bonusDamageType==="fire" && bonusRoll.total>0){
    registerElementalDamageFx(defender,"fire",bonusRoll.total);
  }

  const chillExtra=resolveChillTouchOnHit(attacker,defender);

  if(chillExtra>0){
    damage+=chillExtra;
  }

  if(rawRoll===20){
    setCriticalRollNotification(
      attacker,
      defender,
      rawRoll,
      damage,
      false
    );
  }else{
    setCombatMessage(
      `${attacker.name} damages ${defender.name} for ${damage} damage`,
      COMBAT_MESSAGE_MIN_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      defender.id==="player" ? "player-damage" : "normal"
    );
  }

  log(
    `${attacker.name} hits ${defender.name} from ${position.label} for ${damage} damage `+
    `(base ${baseExpression} → ${baseRoll.total}`+
    `${weaponBonus ? ` ${weaponBonus>=0?"+":""}${weaponBonus}` : ""}`+
    `${bonusRoll.expression ? ` + ${bonusRoll.total} ${attacker.bonusDamageType || "bonus"}` : ""}).`,
    attacker.id==="player" ? "good" : "bad"
  );

  flashAttack(attacker,defender,true);

  if(defender.hp<=0){
    defender.alive=false;

    if(rawRoll===20){
      setCriticalRollNotification(
        attacker,
        defender,
        rawRoll,
        damage,
        true
      );
    }else{
      setCombatMessage(
        `${defender.name} goes down and is dying`,
        COMBAT_MESSAGE_MIN_HOLD_MS,
        COMBAT_MESSAGE_DISPLAY_MS,
        defender.id==="player" ? "player-damage" : "normal"
      );
    }

    playAgonySound(defender);
    playDeathSound(defender);
    triggerDeathFx(defender);
    markEnemyNeutralized(isKoboldUnit(defender) ? defender : null);

    if(
      isKoboldUnit(defender) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:0,
        source:attacker.weapon || "melee attack"
      });
    }

    log(`${defender.name} is slain.`,"good");

    updateUi();
    draw();

    if(defender.faction==="player"){
      if(defender.id==="player"){
        ui.turnBanner.textContent="DUNGEON CRAWLER CARL FALLEN";
      }

      if(checkPartyDefeat()){
        return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
      }

      return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
    }

    if(checkCombatVictory()){
      return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
    }

    return {hit:true,killed:true,damage,attackSector:position.label,attackPosition:position};
  }

  updateUi();
  return {hit:true,killed:false,damage,attackSector:position.label,attackPosition:position};
}

function koboldGroupDeadCount(){
  if(!game) return 0;

  return game.enemies.filter(unit=>
    isKoboldUnit(unit) &&
    !unit.alive
  ).length;
}

function koboldGroupMoraleState(){
  return game?.enemyGroupMorale || null;
}

function koboldGroupLivingCount(){
  if(!game) return 0;
  return game.enemies.filter(unit=>isKoboldUnit(unit) && unit.alive && !unit.fled).length;
}

function koboldOppositionLivingCount(){
  if(!game) return 0;
  return [game.player,...(game.allies || [])]
    .filter(unit=>unit && unit.alive && !unit.fled).length;
}

function buildKoboldGroupMoraleCheck({
  casualties=0,
  magicCasualties=0,
  source=""
}={}){
  const state=koboldGroupMoraleState();

  if(
    !state ||
    state.broken ||
    state.manualRatioChecked ||
    activeEnemies().length===0 ||
    casualties<=0
  ){
    return null;
  }

  const livingKobolds=koboldGroupLivingCount();
  const livingOpposition=koboldOppositionLivingCount();
  if(livingOpposition<=0) return null;

  const currentRatio=livingKobolds/livingOpposition;
  const previousLivingKobolds=livingKobolds+Math.max(0,casualties);
  const previousRatio=previousLivingKobolds/livingOpposition;
  const threshold=Number(state.manualRatioThreshold)||1.5;

  /*
    Monstrous Manual, Kobold: "Should the kobolds be reduced to only a
    three to two ratio in their favor, they must make a morale check."
    Trigger once when casualties cross from better than 3:2 to 3:2 or worse.
    The old generic 25%/50% casualty triggers are deliberately not applied to
    this Kobold group anymore; they remain concepts for future generic morale.
  */
  if(!(previousRatio>threshold && currentRatio<=threshold)){
    return null;
  }

  state.manualRatioChecked=true;

  return {
    state,
    casualties,
    magicCasualties,
    source,
    deadNow:koboldGroupDeadCount(),
    currentFraction:state.initialCount>0 ? koboldGroupDeadCount()/state.initialCount : 0,
    currentRatio,
    previousRatio,
    livingKobolds,
    livingOpposition,
    reasons:[
      `Kobolds have been reduced to ${livingKobolds}:${livingOpposition} (${currentRatio.toFixed(2)}:1), no better than the Monstrous Manual 3:2 threshold`
    ],
    groupLossModifier:0
  };
}

/* R85/R88 morale bark presentation:
   A failed Kobold group check still breaks the whole surviving group immediately,
   but each Kobold says "run away!" only when its own first fleeing turn begins.
   R88 couples a short high-pitched panic yap to that same one-time bark, so both
   the text and sound occur once per Kobold rather than as a group-wide burst. */
function resolveKoboldGroupMoraleCheck(check){
  if(!check || !game || game.over){
    return null;
  }

  const {
    state,
    reasons,
    groupLossModifier
  }=check;

  state.checks++;

  const moraleTarget=clamp(
    state.baseMorale+groupLossModifier,
    2,
    20
  );

  const roll=d(10)+d(10);
  const failed=roll>moraleTarget;

  setLastRoll(
    `Kobold group morale: 2d10 = ${roll} vs ${moraleTarget} `+
    `(base ${state.baseMorale} — ${state.moraleLabel || "Average"}${groupLossModifier ? ` ${groupLossModifier}` : ""})`
  );

  if(failed){
    state.broken=true;

    const survivors=activeEnemies()
      .filter(unit=>isKoboldUnit(unit));

    for(const unit of survivors){
      setMoraleFleeing(unit,true);
      unit.guard=false;
      unit.guardBaselineAdjacentIds=[];
      unit.fleeSteps=0;
      unit.panicBarkPending=true;
    }

    log(
      `KOBOLD GROUP MORALE FAILS: 2d10 ${roll} > ${moraleTarget}. `+
      `Trigger: ${reasons.join("; ")}. All surviving Kobolds break and flee.`,
      "good"
    );

    setCombatMessage(
      `KOBOLD GROUP MORALE FAILS — ${roll} > ${moraleTarget} — SURVIVORS FLEE`,
      COMBAT_MESSAGE_DISPLAY_MS,
      COMBAT_MESSAGE_DISPLAY_MS
    );

    refreshTurnBanner();
  }else{
    log(
      `Kobold group morale holds: 2d10 ${roll} ≤ ${moraleTarget}. `+
      `Trigger: ${reasons.join("; ")}.`,
      "system"
    );

    setCombatMessage(
      `KOBOLD GROUP MORALE HOLDS — ${roll} ≤ ${moraleTarget}`,
      COMBAT_MESSAGE_DISPLAY_MS,
      COMBAT_MESSAGE_DISPLAY_MS
    );
  }

  updateUi();
  draw();

  return {
    failed,
    roll,
    moraleTarget,
    reasons:[...reasons]
  };
}

function maybeShowInitialMoralePanicBark(unit){
  if(
    !unit ||
    !isKoboldUnit(unit) ||
    !unit.fleeing ||
    !unit.panicBarkPending
  ){
    return false;
  }

  unit.panicBarkPending=false;
  showUnitBarks([unit],"run away!",900);
  playKoboldPanicYap();
  return true;
}

function scheduleKoboldGroupMoraleCheck(
  event={},
  delayMs=COMBAT_MESSAGE_DISPLAY_MS
){
  const check=buildKoboldGroupMoraleCheck(event);

  if(!check){
    return false;
  }

  /*
    Hold combat long enough to display the current damage/death message,
    then the group-morale consequence, without initiative overwriting either.
  */
  combatMessageHoldUntil=Math.max(
    combatMessageHoldUntil,
    performance.now()+delayMs+COMBAT_MESSAGE_DISPLAY_MS
  );

  setTimeout(()=>{
    if(
      !game ||
      game.over ||
      check.state.broken
    ){
      return;
    }

    resolveKoboldGroupMoraleCheck(check);
  },Math.max(0,delayMs));

  return true;
}


let freeStrikeInProgress=false;

function unitHasRangedWeaponInHand(unit){
  if(!unit) return false;

  if(unit.weaponInHand==="ranged"){
    return true;
  }

  if(unit.weaponInHand==="melee"){
    return false;
  }

  const equipped=(unit.inventory || []).find(item=>
    item?.equipped &&
    (
      item.slot==="weapon" ||
      item.slot==="backup-weapon"
    )
  );

  if(equipped){
    if(
      equipped.catalogMissileWeaponId ||
      equipped.missileWeapon ||
      equipped.role==="Primary ranged weapon"
    ){
      return true;
    }

    if(equipped.catalogWeaponId){
      return false;
    }
  }

  /*
    MOBs without an inventory model use rangedWeapon as the best
    indication of what is currently in hand.
  */
  return !!(
    unit.controller==="mob" &&
    unit.rangedWeapon
  );
}

function unitCanMakeLeavingHexFreeAttack(attacker,mover){
  if(
    !attacker ||
    !mover ||
    !attacker.alive ||
    attacker.fled ||
    attacker.fleeing ||
    attacker.faction===mover.faction ||
    unitHasRangedWeaponInHand(attacker) ||
    getUnitEffect(attacker,"sleep") ||
    getUnitEffect(attacker,"unconscious") ||
    getUnitEffect(attacker,"stunned")
  ){
    return false;
  }

  const reach=Math.max(
    1,
    Number(attacker.meleeRange)||1
  );

  return reach===1
    ? canMeleeReach(attacker,mover)
    : unitDistance(attacker,mover)<=reach;
}

function leavingHexFreeAttackers(mover){
  if(!game || !mover) return [];

  return allUnits()
    .filter(unit=>
      unit.id!==mover.id &&
      unitCanMakeLeavingHexFreeAttack(unit,mover)
    )
    .sort((a,b)=>a.id.localeCompare(b.id));
}

async function performLeavingHexFreeAttacks(mover,destination){
  if(
    !game ||
    game.over ||
    !mover?.alive ||
    freeStrikeInProgress
  ){
    return !!(
      mover?.alive &&
      !mover?.fled &&
      !game?.over
    );
  }

  const attackers=leavingHexFreeAttackers(mover);

  if(!attackers.length){
    return true;
  }

  freeStrikeInProgress=true;

  try{
    for(const attacker of attackers){
      if(
        game.over ||
        !mover.alive ||
        mover.fled
      ){
        break;
      }

      if(!unitCanMakeLeavingHexFreeAttack(attacker,mover)){
        continue;
      }

      log(
        `${mover.name} leaves a threatened hex — ${attacker.name} gets a free attack.`,
        attacker.faction==="player" ? "good" : "bad"
      );

      const result=attack(
        attacker,
        mover,
        {
          actionLabel:
            `Free Attack with ${unitActionWeapon(attacker)}`
        }
      );

      updateUi();
      draw();

      /*
        This reaction does not consume the attacker's normal initiative
        action. Keep only a short beat so the reaction still reads as
        immediate.
      */
      if(result?.killed){
        await waitForCombatActionPause();
        break;
      }

      await sleep(result?.hit ? 220 : 140);
    }
  }finally{
    freeStrikeInProgress=false;
  }

  if(!game.over){
    refreshTurnBanner();
    updateUi();
    draw();
  }

  return !!(
    mover.alive &&
    !mover.fled &&
    !game.over
  );
}

async function tryPlayerMove(dx,dy){
  const p=activePlayerControlledUnit();
  if(
    game.over || !p || game.active!==p.id || !p.alive ||
    sweepInProgress || mobGuardReactionInProgress || freeStrikeInProgress ||
    isCombatActionPauseActive()
  ) return;

  const nx=p.x+dx;
  const ny=p.y+dy;

  if(isWall(nx,ny) || architecturalWallBlocksStep(p,{x:nx,y:ny})){ log("Movement blocked by wall.","system"); return; }

  const enemy=enemyAtHex(nx,ny);
  if(enemy){
    if(p.fullMove){ log("A full move forfeits the melee attack this round.","system"); return; }
    if(p.turnMoves>p.halfMove){ log("You have moved too far to attack this round.","system"); return; }

    updateFacingForStep(p,dx,dy);

    if(p.id==="player" && isSweepEligibleTarget(enemy) && canUseSweep()){
      await performSweep(enemy);
      return;
    }

    const result=attack(p,enemy);
    if(result?.killed || result?.criticalMiss) await waitForCombatActionPause();
    if(!game.over) finishPlayerAttackAction();
    return;
  }

  if(occupiedByAnyUnit(nx,ny,p.id)){ log("That hex is occupied.","system"); return; }

  if(!p.fullMove && p.turnMoves>=p.halfMove){
    p.fullMove=true;
    log(`Movement passes the attack threshold; Full Move activates automatically (${p.move} hex maximum).`,"system");
  }

  const maxMove=p.fullMove ? p.move : p.halfMove;
  if(p.turnMoves>=maxMove){ log(`Movement allowance exhausted (${maxMove}).`,"system"); return; }

  const canLeave=await performLeavingHexFreeAttacks(p,{x:nx,y:ny});
  if(!canLeave){
    if(!game.over && !p.alive) endTurn();
    return;
  }

  updateFacingForStep(p,dx,dy);
  setUnitActionBanner(p,"Moving");
  p.x=nx; p.y=ny; p.turnMoves++;
  maybeRecenterCamera(p);
  playMoveSound();
  log(`${p.name} moves to hex ${nx},${ny} (${p.turnMoves}/${maxMove}).`);
  updateUi(); draw();

  await triggerMobGuardsAgainst(p);
  if(game.over || !p.alive) return;

  if(p.turnMoves>=maxMove && p.fullMove){
    log("Full movement complete.","system");
    endTurn();
  }
}

async function playerAttackKey(){
  const p=activePlayerControlledUnit();
  if(
    game.over || !p || game.active!==p.id || sweepInProgress ||
    mobGuardReactionInProgress || isCombatActionPauseActive()
  ) return;

  if(p.fullMove){ log("Cannot attack after choosing a full move.","system"); return; }

  const targets=activeEnemies().filter(k=>canMeleeReach(p,k)).sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));
  if(!targets.length){ log("No adjacent target.","system"); return; }
  const target=targets[0];

  if(p.id==="player" && isSweepEligibleTarget(target) && canUseSweep()){
    await performSweep(target);
    return;
  }

  const result=attack(p,target);
  if(result?.killed || result?.criticalMiss) await waitForCombatActionPause();
  if(!game.over) finishPlayerAttackAction();
}

function chooseFullMove(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || isCombatActionPauseActive()) return;
  if(p.turnMoves>0){ log("Choose full move before moving.","system"); return; }
  p.fullMove=true;
  log(`${p.name} selects Full Move: up to ${p.move} hexes; no melee attack this turn.`,"system");
  updateUi();
}

function selectedPlayerUnitForQuickCommand(){
  if(!game) return null;
  return activePlayerControlledUnit();
}

function cancelQuickCommandForUnit(unitOrId,reason=""){
  const id=typeof unitOrId==="string" ? unitOrId : unitOrId?.id;
  if(!id || !quickCommandUnitIds.has(id)) return false;

  quickCommandUnitIds.delete(id);
  quickCommandGeneration++;
  syncQuickCommandState();

  if(reason){
    log(reason,"system");
  }

  refreshTurnBanner();
  updateUi();
  draw();
  return true;
}

function cancelAllQuickCommands(reason=""){
  if(!quickCommandUnitIds.size) return false;

  const count=quickCommandUnitIds.size;
  quickCommandUnitIds.clear();
  quickCommandGeneration++;
  syncQuickCommandState();

  if(reason){
    log(reason,"system");
  }

  if(count>0){
    setCombatMessage(
      count===1 ? "Quick canceled." : `Quick canceled for ${count} characters.`
    );
  }

  refreshTurnBanner();
  updateUi();
  draw();
  return true;
}


function chooseQuickCommandTarget(player){
  const enemies=activeEnemies()
    .slice()
    .sort((a,b)=>
      hexDistance(player,a)-hexDistance(player,b) ||
      a.hp-b.hp ||
      a.id.localeCompare(b.id)
    );

  if(!enemies.length) return {target:null,path:null};

  for(const target of enemies){
    if(canMeleeReach(player,target)){
      return {target,path:[{x:player.x,y:player.y}]};
    }

    const path=pathToAdjacent(player,target,player);
    if(path && path.length>1){
      return {target,path};
    }
  }

  return {target:enemies[0],path:null};
}

async function runQuickCommandPlayerTurn(token=quickCommandGeneration){
  const selected=getUnitById(quickCommandUnitId);

  if(
    quickCommandRunning ||
    !isQuickCommandUnit(selected) ||
    token!==quickCommandGeneration ||
    !game ||
    game.over ||
    !selected ||
    game.active!==selected.id ||
    !selected.alive ||
    selected.fled ||
    !isPlayerControlledUnit(selected)
  ) return;

  quickCommandRunning=true;

  try{
    exitAimMode(false,true);
    closeCharacterSheet();

    const p=selected;

    /* R134: a Quick-Commanded player Mage uses the existing spell-aware Mage AI. */
    if(p.type==="mage"){
      await friendlyMageTurn(p);
      return;
    }

    while(
      isQuickCommandUnit(p) &&
      token===quickCommandGeneration &&
      !game.over &&
      game.active===p.id &&
      p.alive
    ){
      const pauseRemaining=combatActionPauseRemaining();
      if(pauseRemaining>0){
        await sleep(pauseRemaining);
        continue;
      }

      const adjacent=activeEnemies()
        .filter(enemy=>canMeleeReach(p,enemy))
        .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));

      if(adjacent.length){
        if(p.fullMove || p.turnMoves>p.halfMove){
          playerDone();
          break;
        }

        const target=adjacent[0];

        if(isSweepEligibleTarget(target) && canUseSweep()){
          await performSweep(target);
          break;
        }

        const result=attack(p,target);

        if(result?.hit || result?.criticalMiss){
          await waitForCombatActionPause();
        }else{
          await sleep(170);
        }

        if(
          !isQuickCommandUnit(p) ||
          token!==quickCommandGeneration ||
          game.over ||
          game.active!==p.id
        ) break;

        finishPlayerAttackAction();
        await sleep(90);
        continue;
      }

      const choice=chooseQuickCommandTarget(p);

      if(!choice.target){
        playerDone();
        break;
      }

      if(!choice.path || choice.path.length<=1){
        if(p.turnMoves===0 && !p.fullMove){
          chooseGuard();
        }else{
          playerDone();
        }
        break;
      }

      const next=choice.path[1];
      await tryPlayerMove(next.x-p.x,next.y-p.y);

      if(
        !isQuickCommandUnit(p) ||
        token!==quickCommandGeneration ||
        game.over ||
        game.active!==p.id
      ) break;

      await sleep(90);
    }
  }finally{
    quickCommandRunning=false;
    updateUi();
    draw();
  }
}

function activateQuickCommand(){
  if(
    !game ||
    game.over ||
    game.round===0 ||
    isCombatActionPauseActive() ||
    spellCastInProgress
  ) return false;

  const selected=selectedPlayerUnitForQuickCommand();

  if(!selected){
    setCombatMessage("Quick Command requires the active player-controlled unit.");
    return false;
  }

  quickCommandUnitIds.add(selected.id);
  quickCommandGeneration++;
  syncQuickCommandState(selected.id);
  const token=quickCommandGeneration;

  exitAimMode(false,true);
  closeCharacterSheet();

  log(`${selected.name} is under Quick computer control. Press Escape to cancel Quick for all player-controlled characters.`,"system");
  setCombatMessage(`${selected.name} is set to Quick. Hit <ESC> to cancel Quick.`);

  refreshTurnBanner();
  updateUi();
  draw();

  setTimeout(()=>{
    if(
      isQuickCommandUnit(selected) &&
      token===quickCommandGeneration &&
      game?.active===selected.id
    ){
      runQuickCommandPlayerTurn(token);
    }
  },120);

  return true;
}

function playerDone(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || game.active!==p.id || isCombatActionPauseActive()) return;
  exitAimMode(false);
  log(`${p.name} ends the turn.`,"system");
  endTurn();
}

function finishPlayerAttackAction(){
  if(game.over) return;
  const p=activePlayerControlledUnit();
  if(!p) return;

  p.attacksRemaining=Math.max(0,(p.attacksRemaining||1)-1);
  updateUi();

  if(p.attacksRemaining<=0){ endTurn(); return; }

  log(`${p.attacksRemaining} melee attack${p.attacksRemaining===1?"":"s"} remaining this round.`,"system");
  refreshTurnBanner();
  draw();
}


function isSweepEligibleTarget(unit){
  return !!(
    unit &&
    unit.alive &&
    !unit.fled &&
    unit.faction==="enemy" &&
    typeof unit.hitDiceValue==="number" &&
    unit.hitDiceValue<1
  );
}

function adjacentSweepTargets(){
  if(!game?.player) return [];

  return activeEnemies()
    .filter(unit=>
      isSweepEligibleTarget(unit) &&
      canMeleeReach(game.player,unit)
    )
    .sort((a,b)=>a.hp-b.hp || a.id.localeCompare(b.id));
}

function canUseSweep(){
  if(
    !game ||
    game.over ||
    game.active!=="player" ||
    !game.player.alive ||
    !FIGHTER_CLASS.canSweep ||
    sweepInProgress
  ){
    return false;
  }

  const p=game.player;

  if(p.fullMove) return false;
  if(p.turnMoves>p.halfMove) return false;
  if(p.sweepUsedThisRound) return false;

  /*
    R53 Sweep weapon gate:
    only an equipped weapon capable of a Slashing (S) attack can Sweep.
    Piercing-only, Bludgeoning-only, missile, or unarmed attacks cannot.
  */
  if(!fighterHasSweepSlashingWeapon(p)) return false;

  /* Sweep replaces an unused normal attack routine for this round. */
  if(p.attacksRemaining!==p.attacksThisRound) return false;

  return adjacentSweepTargets().length>0;
}

async function performSweep(preferredTarget=null){
  if(!canUseSweep()) return false;

  if(
    preferredTarget &&
    (
      !isSweepEligibleTarget(preferredTarget) ||
      !canMeleeReach(game.player,preferredTarget)
    )
  ){
    return false;
  }

  exitAimMode(false);

  const p=game.player;
  p.sweepUsedThisRound=true;
  sweepInProgress=true;

  const maxSweepAttacks=p.level;
  let attacksMade=0;
  let sweepInterruptedByCriticalMiss=false;
  const attackedOnce=new Set();

  ui.turnBanner.textContent=
    `${p.name} sweeps with ${p.weapon || p.weaponBaseName || "weapon"}`;

  log(
    `${p.name} automatically Sweeps with ${p.weaponBaseName || p.weapon} `+
    `using its Slashing (S) attack: up to ${maxSweepAttacks} attacks.`,
    "good"
  );

  try{
    while(
      attacksMade<maxSweepAttacks &&
      !game.over &&
      p.alive
    ){
      const eligible=adjacentSweepTargets();

      if(!eligible.length){
        break;
      }

      let target=null;

      if(
        attacksMade===0 &&
        preferredTarget &&
        eligible.includes(preferredTarget)
      ){
        target=preferredTarget;
      }

      if(!target){
        target=eligible.find(unit=>!attackedOnce.has(unit.id));
      }

      if(!target){
        attackedOnce.clear();
        target=eligible[0];
      }

      if(!target) break;

      attackedOnce.add(target.id);

      const dx=target.x-p.x;
      const dy=target.y-p.y;
      updateFacingForStep(p,dx,dy);

      const result=attack(p,target);
      attacksMade++;

      updateUi();
      draw();

      if(game.over) break;

      if(result?.criticalMiss){
        sweepInterruptedByCriticalMiss=true;
        await waitForCombatActionPause();
        log(`${p.name}'s Sweep is interrupted immediately by the critical miss.`,"bad");
        break;
      }

      if(result?.hit){
        await waitForCombatActionPause();
      }else{
        await sleep(145);
      }
    }

    p.attacksRemaining=0;

    log(
      sweepInterruptedByCriticalMiss
        ? `${p.name}'s automatic Sweep ends after ${attacksMade} attack${attacksMade===1?"":"s"}.`
        : `${p.name} completes the automatic Sweep after ${attacksMade} attack${attacksMade===1?"":"s"}.`,
      sweepInterruptedByCriticalMiss ? "bad" : "system"
    );
  }finally{
    sweepInProgress=false;
  }

  updateUi();
  draw();

  if(!game.over){
    endTurn();
  }

  return true;
}

function unitAtHex(x,y){
  if(
    game?.player?.alive &&
    !game.player.fled &&
    unitOccupiesHex(game.player,x,y)
  ){
    return game.player;
  }

  const ally=(game?.allies || []).find(unit=>
    unit.alive &&
    !unit.fled &&
    unitOccupiesHex(unit,x,y)
  );

  if(ally){
    return ally;
  }

  return enemyAtHex(x,y);
}

function activeUnit(){
  return getUnitById(game?.active);
}

function isPlayerControlledUnit(unit){
  return !!(
    unit &&
    unit.alive &&
    !unit.fled &&
    (unit.id==="player" || unit.controller==="player")
  );
}

function activePlayerControlledUnit(){
  const unit=activeUnit();
  return isPlayerControlledUnit(unit) ? unit : null;
}

function isSpellTargetingMode(){
  return !!(
    aimMode &&
    pendingAimAction?.spellId &&
    activePlayerControlledUnit()
  );
}

function controlledUnitCanAct(unit=activePlayerControlledUnit()){
  return !!(
    unit &&
    game &&
    !game.over &&
    game.active===unit.id &&
    unit.alive &&
    !unit.fled
  );
}

function enterAimMode(){
  if(!game || game.over) return;

  const actor=activeUnit() || game.player;

  aimMode=true;
  aimCursor.x=actor.x;
  aimCursor.y=actor.y;

  maybeRecenterCamera(aimCursor);
  refreshTurnBanner();
  updateUi();
  draw();
}

function centerCameraOnAimHex(){
  if(!aimMode || !game || game.over) return false;
  centerCameraOn(aimCursor);
  updateUi();
  draw();
  return true;
}

function clearPendingAimAction(showMessage=false){
  if(!pendingAimAction) return;
  pendingAimAction=null;
  if(showMessage){
    setCombatMessage("Targeting canceled.");
  }
}

function exitAimMode(redraw=true,cancelPending=true){
  if(!aimMode){
    if(cancelPending) clearPendingAimAction(false);
    return false;
  }

  aimMode=false;
  if(cancelPending) clearPendingAimAction(false);
  refreshTurnBanner();
  updateUi();

  if(redraw){
    draw();
  }

  return true;
}

function moveAimCursor(dx,dy){
  if(!aimMode) return;

  const nx=aimCursor.x+dx;
  const ny=aimCursor.y+dy;

  if(!inside(nx,ny)){
    return;
  }

  aimCursor.x=nx;
  aimCursor.y=ny;

  maybeRecenterCamera(aimCursor);
  updateUi();
  draw();
}

function rotateWallOfFogAimOrientation(step){
  if(
    !aimMode ||
    !pendingAimAction ||
    pendingAimAction.spellId!=="wall-of-fog" ||
    !Number.isFinite(step) ||
    step===0
  ){
    return false;
  }

  const caster=spellCasterForAction(pendingAimAction) || activePlayerControlledUnit();
  if(!caster) return false;

  const current=Number.isInteger(pendingAimAction.wallOfFogOrientationIndex)
    ? pendingAimAction.wallOfFogOrientationIndex
    : wallOfFogAutoOrientationIndex(caster,aimCursor);

  const next=((current+(step>0 ? 1 : -1))%6+6)%6;
  pendingAimAction.wallOfFogOrientationIndex=next;

  setCombatMessage(
    `Wall of Fog orientation: ${wallOfFogOrientationLabel(next)} — mouse wheel rotates; click to cast.`,
    500
  );
  updateUi();
  draw();
  return true;
}

function removeOneInventoryItem(fighter,itemName){
  if(!fighter?.inventory) return false;
  const index=fighter.inventory.findIndex(item=>item.name===itemName);
  if(index<0) return false;

  const item=fighter.inventory[index];
  if((item.qty||1)>1){
    item.qty--;
  }else{
    fighter.inventory.splice(index,1);
  }
  return true;
}

function useInventoryItem(index){
  const fighter=game?.player;
  if(!fighter || !Array.isArray(fighter.inventory)) return;

  const item=fighter.inventory[index];
  if(!item || !item.usable) return;

  if(
    game.over ||
    game.round===0 ||
    game.active!=="player" ||
    !fighter.alive ||
    isCombatActionPauseActive()
  ){
    log("That item can only be used during Carl's active combat turn.","system");
    return;
  }

  if(item.spellId==="magic-missile" || item.spellId==="fireball"){
    pendingAimAction={
      type:"spell-scroll",
      spellId:item.spellId,
      itemName:item.name,
      casterLevel:item.scrollCasterLevel || 6,
      sourceUnitId:fighter.id
    };

    closeCharacterSheet();
    enterAimMode();

    if(item.spellId==="fireball"){
      setCombatMessage("Scroll ready: AIM Fireball at the desired blast point.");
      log(`${fighter.name} readies ${item.name}; choose a blast point with AIM.`,"system");
    }else{
      setCombatMessage("Scroll ready: AIM Magic Missile at a hostile creature.");
      log(`${fighter.name} readies ${item.name}; choose a target with AIM.`,"system");
    }
  }
}

async function animateMagicMissile(attacker,defender,index,total){
  const from=hexCenter(attacker.x,attacker.y);
  const to=hexCenter(defender.x,defender.y);
  const sideOffset=(index-(total-1)/2)*5;

  const start={x:from.x+sideOffset,y:from.y-20};
  const end={x:to.x+sideOffset*0.5,y:to.y-15};
  const duration=190;
  const started=performance.now();

  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx={kind:"magic-missile",start,end,t,arcHeight:0};
    draw();

    if(t>=1) break;
    await sleep(16);
  }

  projectileFx=null;
  draw();
}

async function castMagicMissileFromScroll(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(!caster || !spell || !target || !target.alive || target.faction===caster.faction){
    setCombatMessage("Magic Missile requires a living hostile creature.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  const shield=getUnitEffect(target,"shield");

  if(shield){
    spellCastInProgress=true;
    commitSpellCast(caster,getSpellEntry(action?.spellId),action);
    pendingAimAction=null;
    exitAimMode(false,false);

    setUnitActionBanner(caster,"Casting Magic Missile");
    setCombatMessage(`${target.name}'s Shield negates Magic Missile.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    log(`${target.name}'s Shield spell totally negates Magic Missile.`,"system");

    if(action.itemName){
      removeOneInventoryItem(caster,action.itemName);
    }

    await waitForCombatActionPause();
    spellCastInProgress=false;

    if(!game.over){
      endTurn();
    }

    return true;
  }

  const casterLevel=Math.max(1,action.casterLevel||6);
  const rangeYards=magicMissileRangeYards(casterLevel);
  const rangeHexes=yardsToTacticalHexes(rangeYards);
  const distance=unitDistance(caster,target);

  if(distance>rangeHexes){
    setCombatMessage(`${target.name} is out of Magic Missile range (${rangeHexes} hexes).`);
    return false;
  }

  const missileCount=magicMissileCountForCasterLevel(casterLevel);
  const damageRolls=[];

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  await focusRangedAttacker(caster);

  setUnitActionBanner(caster,"Casting Magic Missile");

  playAttackSound();

  for(let i=0;i<missileCount;i++){
    await animateMagicMissile(caster,target,i,missileCount);
    playMagicMissileHitSound(i);
    damageRolls.push(rollDiceExpression(spell.missileDamage).total);
    await sleep(90);
  }

  const totalDamage=damageRolls.reduce((sum,value)=>sum+value,0);
  target.hp=Math.max(0,target.hp-totalDamage);
  onUnitDamaged(target,totalDamage);

  await focusDamagedTargetIfOffscreen(target);

  if(action.itemName){
    removeOneInventoryItem(caster,action.itemName);
  }

  setCombatMessage(
    `${caster.name} damages ${target.name} for ${totalDamage} damage`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );

  log(
    `${caster.name} uses ${action.itemName || spell.name}: ${missileCount} Magic Missiles `+
    `(${damageRolls.join(" + ")}) strike ${target.name} for ${totalDamage} damage. `+
    `No attack roll; no saving throw.`,
    "good"
  );

  if(target.hp<=0){
    target.alive=false;
    setCombatMessage(`${target.name} goes down and is dying`,COMBAT_MESSAGE_MIN_HOLD_MS);
    playAgonySound(target);
    playDeathSound(target);
    triggerDeathFx(target);
    markEnemyNeutralized(target);

    if(
      isKoboldUnit(target) &&
      activeEnemies().length>0
    ){
      scheduleKoboldGroupMoraleCheck({
        casualties:1,
        magicCasualties:1,
        source:"Magic Missile"
      });
    }

    log(`${target.name} is brought down by Magic Missile.`,"good");
    checkCombatVictory();
  }

  spellCastInProgress=false;
  updateUi();
  draw();
  await waitForCombatActionPause();

  if(!game.over){
    endTurn();
  }

  return true;
}


function spellSaveTargetForUnit(unit){
  if(unit?.saves?.spell){
    return unit.saves.spell;
  }

  if(unit?.id==="player"){
    return (
      unit.saves ||
      warriorSavingThrows(unit.level || 1)
    ).spell;
  }

  if(unit?.controller==="mob"){
    /*
      AD&D 2e monsters generally use the Warrior saving-throw table.
      Intelligent monsters save at a level based on Hit Dice. For this
      sub-1-HD kobold test, use the 1st-level Warrior band.
    */
    const saveLevel=Math.max(
      1,
      Math.ceil(Number(unit.hitDiceValue)||1)
    );

    return warriorSavingThrows(saveLevel).spell;
  }

  return warriorSavingThrows(
    Math.max(1,Number(unit?.level)||1)
  ).spell;
}

async function animateFireballProjectile(caster,targetHex){
  const startCenter=hexCenter(caster.x,caster.y);
  const endCenter=hexCenter(targetHex.x,targetHex.y);

  const start={
    x:startCenter.x,
    y:startCenter.y-18
  };

  const end={
    x:endCenter.x,
    y:endCenter.y-7
  };

  const duration=280;
  const started=performance.now();

  while(true){
    const elapsed=performance.now()-started;
    const t=Math.min(1,elapsed/duration);

    projectileFx={
      kind:"fireball",
      start,
      end,
      t,
      arcHeight:0
    };

    draw();

    if(t>=1) break;
    await sleep(16);
  }

  projectileFx=null;
  draw();
}

/*
  R99 Fireball impact: the blast expands through the entire affected tactical
  volume. The horizontal footprint remains exactly the damage footprint and the
  dome rises through the same vertical volume, but the visual mass is now built
  from overlapping translucent spherical flame lobes instead of hard squares.
  Damage itself is still applied simultaneously before this visual beat.
*/
async function animateFireballExplosion(targetHex,radiusHexes,blastCells=null){
  const duration=820;
  const started=performance.now();
  const radius=Math.max(1,Number(radiusHexes)||1);
  const cells=(blastCells?.length ? blastCells : fireballBlastCells(targetHex))
    .map(cell=>({...cell}));

  fireballExplosionFx={
    x:targetHex.x,
    y:targetHex.y,
    radiusHexes:radius,
    cells,
    maxVolumeDistance:Math.max(
      radius,
      ...cells.map(cell=>
        Number.isFinite(cell.volumeDistance)
          ? cell.volumeDistance
          : hexDistance(targetHex,cell)
      )
    ),
    started,
    duration
  };

  while(true){
    const elapsed=performance.now()-started;
    draw();
    if(elapsed>=duration) break;
    await sleep(16);
  }

  fireballExplosionFx=null;
  draw();
}


/*
  R100 Color Spray VFX.
  The PHB describes a vivid fan-shaped spray of clashing colors springing from
  the wizard's hand. The tactical footprint is still the existing 2-hex wedge.
  This renderer uses overlapping translucent color lobes along rays to every
  wedge cell so the fan is bright and continuous without becoming an opaque
  modern particle cloud.
*/
async function animateColorSprayEffect(caster,targetHex,cells){
  const duration=1500;
  const started=performance.now();

  colorSprayFx={
    casterId:caster.id,
    targetHex:{x:targetHex.x,y:targetHex.y},
    cells:(cells || []).map(cell=>({x:cell.x,y:cell.y})),
    started,
    duration
  };

  playColorSpraySound();

  while(true){
    const elapsed=performance.now()-started;
    draw();
    if(elapsed>=duration) break;
    await sleep(16);
  }

  colorSprayFx=null;
  draw();
}

/*
  R93 reusable magical status-effect presentation.
  Multiple affected units can animate in the same short beat; the staggered
  starts make an area spell readable without turning resolution into a long
  serial queue. Every unit receives the shared magic SFX exactly once.
*/
async function animateMagicEffectOnUnits(units,kind="generic",options={}){
  const targets=(units || []).filter(unit=>unit?.alive && !unit.fled);
  if(!targets.length) return;

  const staggerMs=Math.min(55,Math.max(24,260/Math.max(1,targets.length)));
  const effectDuration=680;
  const started=performance.now();

  magicEffectFx=targets.map((unit,index)=>({
    unitId:unit.id,
    kind,
    started:started+index*staggerMs,
    duration:effectDuration,
    soundPlayed:false
  }));

  const totalDuration=effectDuration+(targets.length-1)*staggerMs;

  while(true){
    const now=performance.now();

    magicEffectFx.forEach((fx,index)=>{
      if(!fx.soundPlayed && now>=fx.started){
        fx.soundPlayed=true;
        if(options.playSound!==false){
          playMagicEffectSound(fx.kind,index);
        }
      }
    });

    draw();
    if(now-started>=totalDuration) break;
    await sleep(16);
  }

  magicEffectFx=[];
  draw();
}

async function showAreaEffectUnitResolution({
  unit,
  sourceName,
  damage,
  secondaryEffects=[],
  killed=false,
  damageIcon=null
}){
  if(!unit) return;

  const secondary=secondaryEffects
    .filter(Boolean)
    .join(" — ");

  const tone=
    unit.id==="player"
      ? "player-damage"
      : "normal";

  /*
    R86: display a spell-specific damage icon over the victim while its
    sequential AoE damage result is being presented. Fireball reuses the
    same fireball glyph as the projectile, rather than introducing a second
    visual language for fire damage.
  */
  if(damageIcon && damage>0){
    areaDamageFx={
      unitId:unit.id,
      kind:damageIcon
    };
  }else{
    areaDamageFx=null;
  }

  setCombatMessage(
    `${unit.name} takes ${damage} ${sourceName} damage`+
    `${secondary ? ` — ${secondary}` : ""}`,
    AREA_EFFECT_UNIT_RESOLUTION_MS,
    AREA_EFFECT_UNIT_RESOLUTION_MS,
    tone
  );

  draw();
  await waitForCombatActionPause();

  areaDamageFx=null;
  draw();

  if(killed){
    setCombatMessage(
      `${unit.name} goes down and is dying — ${sourceName}`,
      AREA_EFFECT_UNIT_RESOLUTION_MS,
      AREA_EFFECT_UNIT_RESOLUTION_MS,
      tone
    );

    await waitForCombatActionPause();
  }
}

async function castFireballFromScroll(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry(action?.spellId);

  if(!caster || !spell || !targetHex){
    return false;
  }

  const casterLevel=Math.max(1,action.casterLevel||6);

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to the Fireball blast point.");
    return false;
  }

  const rangeYards=fireballRangeYards(casterLevel);
  const rangeHexes=yardsToTacticalHexes(rangeYards);
  const distance=hexDistance(caster,targetHex);

  if(distance>rangeHexes){
    setCombatMessage(
      `That blast point is out of Fireball range (${rangeHexes} hexes).`
    );
    return false;
  }

  const radiusHexes=fireballRadiusHexes();
  const blastCells=fireballBlastCells(targetHex);
  const affected=livingUnitsInAreaCells(blastCells);
  const friendlyTargets=affected.filter(unit=>unit.faction===caster.faction);

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);
  updateUi();

  setUnitActionBanner(caster,"Casting Fireball");

  /*
    R138: Fireball belongs visually to its destination. Center the camera on
    the selected blast hex before any Fireball projectile/explosion VFX begins.
  */
  centerCameraOn(targetHex);
  draw();
  await sleep(160);

  /* Small fiery projectile from caster to selected blast hex. */
  await animateFireballProjectile(caster,targetHex);

  const damageDice=fireballDamageDiceForCasterLevel(casterLevel);
  const rolledDamage=rollDiceExpression(`${damageDice}d6`).total;

  if(action.itemName){
    removeOneInventoryItem(caster,action.itemName);
  }

  /*
    Roll every save first, then apply every HP change in one batch. This is
    the R93 simultaneous-AoE rule: no victim waits for the previous victim's
    damage message or icon before taking the same Fireball blast.
  */
  const results=affected.map(unit=>{
    const immune=unitImmuneToDamageType(unit,"fire");
    const saveTarget=immune ? null : spellSaveTargetForUnit(unit);
    const saveRoll=immune ? null : d(20);
    const saved=!immune && saveRoll>=saveTarget;
    const damage=immune
      ? 0
      : saved
        ? Math.floor(rolledDamage/2)
        : rolledDamage;

    return {unit,immune,saveTarget,saveRoll,saved,damage};
  });

  for(const result of results){
    const {unit,damage}=result;
    if(damage<=0) continue;
    unit.hp=Math.max(0,unit.hp-damage);
    onUnitDamaged(unit,damage);
    registerElementalDamageFx(unit,"fire",damage);
  }

  updateUi();
  draw();

  log(
    `${caster.name} uses ${action.itemName || "Fireball"}: Fireball detonates at hex `+
    `${targetHex.x},${targetHex.y}; ${damageDice}d6 = ${rolledDamage} damage before saves; `+
    `${affected.length} creature${affected.length===1 ? "" : "s"} caught in the blast; `+
    `${blastCells.length} tactical hex-volumes filled`+
    `${fireballHexEnvironment(targetHex)==="indoor" ? ` (${blastCells.filter(cell=>cell.volumeEnvironment==="indoor").length} indoor, ${blastCells.filter(cell=>cell.volumeEnvironment==="outdoor").length} outdoor after 19/33 conversion)` : ""}.`+
    `${friendlyTargets.length ? ` FRIENDLY FIRE: ${friendlyTargets.length} friendly unit${friendlyTargets.length===1 ? "" : "s"} in blast.` : ""}`,
    friendlyTargets.length ? "bad" : "good"
  );

  for(const result of results){
    const {unit,immune,saveTarget,saveRoll,saved,damage}=result;

    if(immune){
      log(
        unit.name+" is immune to fire and takes no Fireball damage.",
        "system"
      );
      continue;
    }

    log(
      unit.name+": save vs. spell "+saveRoll+" vs "+saveTarget+" — "+
      (saved ? "success, half damage" : "failure, full damage")+
      "; "+damage+" damage.",
      saved ? "system" : "bad"
    );
  }

  setCombatMessage(
    affected.length
      ? `FIREBALL ERUPTS — ${affected.length} TARGET${affected.length===1 ? "" : "S"} TAKE DAMAGE`
      : "FIREBALL ERUPTS — NO CREATURES CAUGHT IN THE BLAST",
    900,
    900,
    friendlyTargets.length ? "player-damage" : "normal"
  );

  /* One impact sound and one expanding fire sphere for the whole blast. */
  playFireballExplosionSound();
  await animateFireballExplosion(targetHex,radiusHexes,blastCells);

  let koboldCasualties=0;
  const killedResults=results.filter(result=>result.unit.hp<=0);

  /*
    Damage happened simultaneously above. Death feedback still honors the
    existing per-death combat beat so skull/agony feedback is not lost.
  */
  for(const result of killedResults){
    const unit=result.unit;
    unit.alive=false;

    if(unit.controller==="mob"){
      markEnemyNeutralized(unit);
      if(isKoboldUnit(unit)) koboldCasualties++;
    }

    log(`${unit.name} goes down and is dying from the Fireball.`,"bad");
    playAgonySound(unit);
    playDeathSound(unit);
    triggerDeathFx(unit);
    updateUi();
    draw();
    await waitForDeathActionPause();
  }

  if(koboldCasualties>0 && activeEnemies().length>0){
    const moraleScheduled=scheduleKoboldGroupMoraleCheck(
      {
        casualties:koboldCasualties,
        magicCasualties:koboldCasualties,
        source:"Fireball"
      },
      0
    );

    if(moraleScheduled){
      await waitForCombatActionPause();
    }
  }

  /*
    Current battlefield has no walls/doors/solid obstacles, so the PHB rule
    for early detonation against an intervening barrier is preserved as
    spell metadata but has no tactical obstacle to resolve yet.
  */

  spellCastInProgress=false;
  updateUi();
  draw();

  const victory=checkCombatVictory();
  const defeat=checkPartyDefeat();

  if(!victory && !defeat){
    await waitForCombatActionPause();
    if(!game.over) endTurn();
  }

  return true;
}


function testSpellTargetPrompt(spell){
  if(spell?.id==="wall-of-fog"){
    return "AIM at the desired battlefield hex; use the mouse wheel to rotate the wall";
  }

  switch(spell.targetMode){
    case "self":
      return "casts on the caster";
    case "touch-creature":
      return "AIM at self or an adjacent creature";
    case "adjacent-hostile":
      return "AIM at an adjacent hostile creature";
    case "hostile-creature":
      return "AIM at a hostile creature";
    case "creature":
      return "AIM at a creature";
    case "direction":
      return "AIM in the desired direction";
    case "ground":
      return "AIM at the desired battlefield hex";
    default:
      return "choose a target with AIM";
  }
}

function beginMageCombatSpell(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();

  if(
    !spell || !spell.combatImplemented || !isMageCharacter(caster) ||
    !mageCanCastMemorizedSpell(caster,spellId) || game.over ||
    game.active!==caster.id || isCombatActionPauseActive() || spellCastInProgress
  ) return false;

  closeSpellCastOverlay();
  const action={
    type:"memorized-spell", spellId, casterLevel:caster.level,
    sourceUnitId:caster.id, testHarness:false, spellCommitted:false
  };

  if(spell.targetMode==="self"){
    castPreparedCombatSpell(action,{x:caster.x,y:caster.y},caster);
    return true;
  }

  pendingAimAction=action;
  enterAimMode();
  if(spell.id==="wall-of-fog"){
    const autoOrientation=wallOfFogAutoOrientationIndex(caster,aimCursor);
    setCombatMessage(
      `${spell.name}: AIM the center, then use the mouse wheel to rotate (${wallOfFogOrientationLabel(autoOrientation)}). Click to cast.`
    );
  }else{
    setCombatMessage(`${spell.name}: ${testSpellTargetPrompt(spell)}.`);
  }
  return true;
}

function beginSelectedCombatSpell(spellId){
  const caster=activePlayerControlledUnit();
  if(isMageCharacter(caster)) return beginMageCombatSpell(spellId);
  if(caster?.id==="player") return beginCombatTestSpell(spellId);
  return false;
}

function beginCombatTestSpell(spellId){
  const spell=getSpellEntry(spellId);
  const caster=activePlayerControlledUnit();

  if(
    !spell || !spell.combatImplemented || !caster || caster.id!=="player" ||
    game.over || game.active!==caster.id || isCombatActionPauseActive() || spellCastInProgress
  ) return false;

  closeSpellCastOverlay();
  const action={
    type:"test-spell", spellId, casterLevel:TEST_SPELL_CASTER_LEVEL,
    sourceUnitId:caster.id, testHarness:true
  };

  if(spell.targetMode==="self"){
    castPreparedCombatSpell(action,{x:caster.x,y:caster.y},caster);
    return true;
  }

  pendingAimAction=action;
  enterAimMode();
  if(spell.id==="wall-of-fog"){
    const autoOrientation=wallOfFogAutoOrientationIndex(caster,aimCursor);
    setCombatMessage(
      `${spell.name}: AIM the center, then use the mouse wheel to rotate (${wallOfFogOrientationLabel(autoOrientation)}). Click to cast.`
    );
  }else{
    setCombatMessage(`${spell.name}: ${testSpellTargetPrompt(spell)}.`);
  }
  return true;
}

function finishTestSpellCast(caster,spellName,action=null){
  spellCastInProgress=false;
  updateUi();
  draw();

  log(
    action?.type==="memorized-spell"
      ? `${caster.name} casts ${spellName}.`
      : `${caster.name} completes test casting of ${spellName}.`,
    "system"
  );

  if(checkCombatVictory() || checkPartyDefeat()){
    return;
  }

  if(!game.over){
    endTurn();
  }
}

function validCreatureTargetWithinRange(caster,target,spell,casterLevel,allowFriendly=true){
  if(!caster || !target || !target.alive) return false;

  if(!allowFriendly && target.faction===caster.faction){
    return false;
  }

  const range=spellRangeHexes(spell,casterLevel);
  return unitDistance(caster,target)<=range;
}

async function castArmorSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("armor");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Armor requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  let acValue=6;

  if(target.stats?.dex!==undefined){
    acValue+=dexterityAdjustments(target.stats.dex).defensive;
  }

  if(target.ac<=acValue){
    setCombatMessage(`${target.name} already has AC ${target.ac}; Armor provides no improvement.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"armor-spell",
      name:"Armor",
      kind:"buff",
      detail:`Magical AC ${acValue}; collapses after >${8+level} cumulative damage`,
      data:{
        casterLevel:level,
        acValue,
        damageLimit:8+level,
        damageTaken:0
      }
    });

    setCombatMessage(`${target.name} gains Armor (AC ${acValue}).`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Armor",action);
  return true;
}

async function castShieldSpell(action){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"shield",
    name:"Shield",
    kind:"buff",
    expiresRound:game.round+5*level,
    detail:"Frontal: negates Magic Missile; AC 3 vs arrows/bolts/bullets; AC 4 vs other attacks; +1 saves",
    data:{casterLevel:level}
  });

  setCombatMessage(`${caster.name} raises a shimmering Shield.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Shield",action);
  return true;
}

async function castChillTouchSpell(action){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const rounds=3+level;

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(caster,{
    id:"chill-touch",
    name:"Chill Touch",
    kind:"buff",
    expiresRound:game.round+rounds,
    detail:`Melee hits can add 1d4 damage and Strength loss; ${rounds} rounds`,
    data:{casterLevel:level}
  });

  setCombatMessage(`${caster.name}'s hand glows with Chill Touch.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Chill Touch",action);
  return true;
}

async function castEnlargeSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("enlarge");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Enlarge target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  if(target.faction!==caster.faction){
    const save=rollSpellSave(target,caster);

    if(save.success){
      setCombatMessage(`${target.name} resists Enlarge.`,COMBAT_MESSAGE_MIN_HOLD_MS);
      await waitForCombatActionPause();
      finishTestSpellCast(caster,"Enlarge",action);
      return true;
    }
  }

  const multiplier=1+(0.10*level);
  const priorScale=enlargeVisualScale(target);

  addUnitEffect(target,{
    id:"enlarge",
    name:"Enlarged",
    kind:"buff",
    expiresRound:game.round+5*level,
    detail:`Size ${Math.round(multiplier*100)}%; weapon base damage ×${multiplier.toFixed(1)}`,
    data:{
      casterLevel:level,
      damageMultiplier:multiplier,
      sizeMultiplier:multiplier
    }
  });

  /*
    R193: visual scale follows the same percentage as the spell's size increase.
    Occupied hexes, pathfinding, melee reach, and collision footprint are not
    changed by this presentation-only sprite scaling.
  */
  triggerEnlargeTransition(
    target,
    Math.max(1,priorScale),
    multiplier,
    multiplier>=priorScale ? "grow" : "shrink",
    1000
  );

  setCombatMessage(`${target.name} grows to ${Math.round(multiplier*100)}% normal size.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Enlarge",action);
  return true;
}

async function castProtectionFromEvilSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("protection-from-evil");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Protection From Evil requires self or an adjacent creature.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addUnitEffect(target,{
    id:"protection-from-evil",
    name:"Protection From Evil",
    kind:"buff",
    expiresRound:game.round+2*level,
    detail:"Evil attackers −2 to hit; +2 saves against their attacks",
    data:{casterLevel:level}
  });

  setCombatMessage(`${target.name} gains Protection From Evil.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Protection From Evil",action);
  return true;
}

async function castLightSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("light");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;
  const durationRounds=10*level;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,true)){
    setCombatMessage("Light target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  if(target.faction===caster.faction){
    addUnitEffect(target,{
      id:"light",
      name:"Light",
      kind:"buff",
      expiresRound:game.round+durationRounds,
      detail:"20-foot illumination radius",
      data:makeLightSpellEffectData(level)
    });

    playMagicEffectSound("light");
    setCombatMessage(
      `${target.name} shines with magical Light.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );
  }else{
    const save=rollSpellSave(target,caster);

    if(save.success){
      const source=addStaticLightSpellSource(caster,target,level);
      playMagicEffectSound("light");

      setCombatMessage(
        `${target.name} saves; Light forms behind it and illuminates the area.`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );

      if(source){
        ensurePersistentStatusFxLoop();
      }
    }else{
      applyBlindEffect(target,durationRounds,"Light");
      addUnitEffect(target,{
        id:"light",
        name:"Light",
        kind:"debuff",
        expiresRound:game.round+durationRounds,
        detail:"20-foot illumination radius; centered on the eyes",
        data:makeLightSpellEffectData(level)
      });

      playMagicEffectSound("light");
      setCombatMessage(
        `${target.name} is blinded and illuminated by Light.`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );
    }
  }

  ensurePersistentStatusFxLoop();
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Light",action);
  return true;
}

async function resolveAoeDamageSpell({
  caster,
  spellName,
  targets,
  damage,
  saveForHalf=true,
  magicCasualtySource=spellName,
  damageType=null
}){
  let koboldCasualties=0;

  for(const unit of targets){
    const save=saveForHalf
      ? rollSpellSave(unit,caster)
      : null;

    const actualDamage=save?.success
      ? Math.floor(damage/2)
      : damage;

    unit.hp=Math.max(0,unit.hp-actualDamage);
    onUnitDamaged(unit,actualDamage);
    registerElementalDamageFx(unit,damageType,actualDamage);

    await showAreaEffectUnitResolution({
      unit,
      sourceName:spellName,
      damage:actualDamage,
      secondaryEffects:save
        ? [
            `SAVE ${save.modifiedRoll} vs ${save.targetNumber}: `+
            `${save.success ? "SUCCESS — HALF DAMAGE" : "FAILED — FULL DAMAGE"}`
          ]
        : [],
      killed:unit.hp<=0
    });

    if(unit.hp<=0){
      unit.alive=false;
      playAgonySound(unit);
      playDeathSound(unit);
      triggerDeathFx(unit);

      if(unit.controller==="mob"){
        markEnemyNeutralized(unit);

        if(isKoboldUnit(unit)){
          koboldCasualties++;
        }
      }
    }
  }

  if(koboldCasualties>0 && activeEnemies().length>0){
    const scheduled=scheduleKoboldGroupMoraleCheck({
      casualties:koboldCasualties,
      magicCasualties:koboldCasualties,
      source:magicCasualtySource
    },0);

    if(scheduled){
      await waitForCombatActionPause();
    }
  }
}

async function castBurningHandsSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    targetHex.x===caster.x &&
    targetHex.y===caster.y
  ){
    setCombatMessage("AIM Burning Hands in a direction away from the caster.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Burning Hands");

  const blastCells=directionalWedgeCells(
    caster,
    targetHex,
    1,
    Math.PI/3
  );

  /*
    As with Fireball, no faction filtering is allowed here.
    A friendly standing in the fan is burned normally.
  */
  const targets=livingUnitsInAreaCells(blastCells);
  const friendlyTargets=targets.filter(unit=>
    unit.faction===caster.faction
  );

  const damage=d(3)+Math.min(20,2*level);

  if(friendlyTargets.length){
    log(
      `Burning Hands friendly fire: ${friendlyTargets.map(unit=>unit.name).join(", ")} caught in the fan.`,
      "bad"
    );
  }

  await resolveAoeDamageSpell({
    caster,
    spellName:"Burning Hands",
    targets,
    damage,
    saveForHalf:true,
    damageType:"fire"
  });

  if(!targets.length){
    setCombatMessage("Burning Hands scorches empty ground.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Burning Hands",action);
  return true;
}

async function castColorSpraySpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    targetHex.x===caster.x &&
    targetHex.y===caster.y
  ){
    setCombatMessage("AIM Color Spray in a direction away from the caster.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Color Spray");

  const maxAffected=d(6);
  const sprayCells=directionalWedgeCells(
    caster,
    targetHex,
    2,
    Math.PI/3
  );

  const candidates=livingUnitsInAreaCells(sprayCells)
    .filter(unit=>unit.id!==caster.id)
    .sort((a,b)=>
      hexDistance(caster,a)-hexDistance(caster,b) ||
      a.id.localeCompare(b.id)
    )
    .slice(0,maxAffected);

  /* One shared prismatic fan for the whole instantaneous spell. */
  await animateColorSprayEffect(
    caster,
    targetHex,
    sprayCells
  );

  const newlyUnconscious=[];

  for(const unit of candidates){
    const hd=spellHitDiceValue(unit);
    let saved=false;
    let save=null;

    if(hd>level || hd>=6){
      save=rollSpellSave(unit,caster);
      saved=save.success;
    }

    if(saved){
      setCombatMessage(
        `${unit.name} saves against Color Spray (${save.modifiedRoll} vs ${save.targetNumber}).`,
        COMBAT_MESSAGE_MIN_HOLD_MS
      );
      await waitForCombatActionPause();
      continue;
    }

    if(hd<=level){
      const rounds=d(4)+d(4);
      applyUnconsciousEffect(unit,rounds,"Color Spray");
      newlyUnconscious.push(unit);
      setCombatMessage(`${unit.name} is knocked unconscious by Color Spray for ${rounds} rounds.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else if(hd<=level+2){
      const rounds=d(4);
      applyBlindEffect(unit,rounds,"Color Spray");
      setCombatMessage(`${unit.name} is blinded by Color Spray for ${rounds} rounds.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else{
      applyStunnedEffect(unit,1,"Color Spray");
      setCombatMessage(`${unit.name} is stunned by Color Spray.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
  }

  if(!candidates.length){
    setCombatMessage("Color Spray catches no creatures.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  if(newlyUnconscious.length){
    /* Strong one-shot status application; persistent orbiting stars take over afterward. */
    await animateMagicEffectOnUnits(newlyUnconscious,"unconscious",{playSound:false});
    ensurePersistentStatusFxLoop();
  }

  finishTestSpellCast(caster,"Color Spray",action);
  return true;
}

async function castGreaseSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("grease");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Grease target hex is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to that hex.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  addAreaEffect({
    id:`grease-${Date.now()}`,
    type:"grease",
    name:"Grease",
    cells:[{x:targetHex.x,y:targetHex.y}],
    expiresRound:game.round+3+level,
    sourceUnitId:caster.id
  });

  const occupants=livingUnitsInAreaCells([
    {x:targetHex.x,y:targetHex.y}
  ]);

  for(const unit of occupants){
    const stood=greaseSaveForUnit(unit,caster);

    setCombatMessage(
      stood
        ? `${unit.name} keeps footing in Grease.`
        : `${unit.name} slips and falls in Grease.`,
      COMBAT_MESSAGE_MIN_HOLD_MS
    );

    await waitForCombatActionPause();
  }

  if(!occupants.length){
    setCombatMessage("Grease coats the targeted hex.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Grease",action);
  return true;
}

async function castSleepSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("sleep");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Sleep center is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,targetHex)){
    setCombatMessage("Line of sight is blocked to the Sleep center.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);
  setUnitActionBanner(caster,"Casting Sleep");

  let hdPool=d(4)+d(4);
  /* R94: Sleep uses one complete radius-1 hex cluster (7 hexes). */
  const sleepCells=hexesWithinRadius(targetHex,1);

  const candidates=livingUnitsInAreaCells(sleepCells)
    .filter(unit=>
      !isUndeadUnit(unit) &&
      spellHitDiceValue(unit)<4.375
    )
    .sort((a,b)=>
      spellHitDiceValue(a)-spellHitDiceValue(b) ||
      hexDistance(a,targetHex)-hexDistance(b,targetHex) ||
      a.id.localeCompare(b.id)
    );

  const affected=[];

  for(const unit of candidates){
    const hd=spellHitDiceValue(unit);
    if(hd>hdPool) continue;

    hdPool-=hd;
    affected.push(unit);

    addUnitEffect(unit,{
      id:"sleep",
      name:"Magical Sleep",
      kind:"debuff",
      expiresRound:game.round+5*level,
      detail:"Sleep: cannot act; wounding awakens",
      data:{sourceUnitId:caster.id}
    });

    log(`${unit.name} falls into magical sleep.`,"system");
  }

  if(affected.length){
    setCombatMessage(
      `SLEEP TAKES HOLD — ${affected.length} CREATURE${affected.length===1 ? "" : "S"} FALL ASLEEP`,
      900,
      900
    );

    /*
      First consumer of the reusable R93 magic-effect framework: every unit
      that actually receives Sleep gets a visible magical shimmer and its own
      short magic SFX cue during one shared animation beat.
    */
    await animateMagicEffectOnUnits(affected,"sleep");

    /* R95: transition from the stronger application burst to the quiet persistent status FX. */
    ensurePersistentStatusFxLoop();
  }else{
    setCombatMessage("Sleep affects no eligible creatures.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Sleep",action);
  return true;
}


async function castSpookSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("spook");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !validCreatureTargetWithinRange(caster,target,spell,level,false) ||
    isUndeadUnit(target)
  ){
    setCombatMessage("Spook requires a living hostile creature within 30 feet.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const penalty=-Math.min(6,Math.floor(level/2));
  const save=rollSpellSave(target,caster,penalty);

  if(save.success){
    setCombatMessage(`${target.name} resists Spook.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }else{
    addUnitEffect(target,{
      id:"spook",
      name:"Spooked",
      kind:"debuff",
      detail:"Forced to flee; new unmodified save each later turn",
      data:{sourceUnitId:caster.id}
    });

    setCombatMessage(`${target.name} panics and flees from Spook.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Spook",action);
  return true;
}

async function castTauntSpell(action,target){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("taunt");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(!validCreatureTargetWithinRange(caster,target,spell,level,false)){
    setCombatMessage("Taunt target is out of range.");
    return false;
  }

  if(lineOfSightBlocked(caster,target)){
    setCombatMessage("Line of sight is blocked to that target.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const targetType=target.type || target.name;
  const candidates=unitsWithinHexRadius(target,3)
    .filter(unit=>
      unit.faction!==caster.faction &&
      (unit.type || unit.name)===targetType &&
      !isUndeadUnit(unit)
    );

  for(const unit of candidates){
    const save=rollSpellSave(unit,caster);

    if(save.success){
      setCombatMessage(`${unit.name} resists Taunt.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }else{
      addUnitEffect(unit,{
        id:"taunt",
        name:"Taunted",
        kind:"debuff",
        expiresRound:game.round+1,
        detail:`Compelled to rush ${caster.name} for melee`,
        data:{sourceUnitId:caster.id}
      });
      ensurePersistentStatusFxLoop();

      setCombatMessage(`${unit.name} is enraged by Taunt and rushes the caster.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
  }

  if(!candidates.length){
    setCombatMessage("Taunt catches no creatures of that type.",COMBAT_MESSAGE_MIN_HOLD_MS);
    await waitForCombatActionPause();
  }

  finishTestSpellCast(caster,"Taunt",action);
  return true;
}

async function castShockingGraspSpell(action,target){
  const caster=spellCasterForAction(action);
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(
    !target ||
    target.faction===caster.faction ||
    !target.alive ||
    !canMeleeReach(caster,target)
  ){
    setCombatMessage("Shocking Grasp requires an adjacent hostile creature.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const position=
    attackPositionData(caster,target);

  faceEntityToward(caster,target);
  setUnitActionBanner(caster,`Casting Shocking Grasp — ${position.label}`);

  const rawRoll=d(20);
  const attackBonus=attackEffectModifier(caster,target);
  const targetAC=effectiveArmorClassForAttack(caster,target,"melee");
  const targetNumber=caster.thaco-targetAC;
  const resolution=resolveMeleeAttackD20(rawRoll,targetNumber,attackBonus);

  playNaturalAttackRollSound(rawRoll);

  if(!resolution.hit){
    playMissSound();
    if(rawRoll===1){
      setCriticalRollNotification(caster,target,rawRoll);
    }else{
      setCombatMessage(`${caster.name} misses the Shocking Grasp touch attack.`,COMBAT_MESSAGE_MIN_HOLD_MS);
    }

    await waitForCombatActionPause();
    finishTestSpellCast(caster,"Shocking Grasp",action);
    return true;
  }

  const damage=d(8)+level;
  target.hp=Math.max(0,target.hp-damage);
  onUnitDamaged(target,damage);

  if(rawRoll===20){
    setCriticalRollNotification(caster,target,rawRoll,damage,target.hp<=0);
  }else{
    setCombatMessage(`${caster.name} shocks ${target.name} for ${damage} damage.`,COMBAT_MESSAGE_MIN_HOLD_MS);
  }

  if(target.hp<=0){
    target.alive=false;
    playAgonySound(target);
    playDeathSound(target);
    triggerDeathFx(target);

    if(target.controller==="mob"){
      markEnemyNeutralized(target);

      if(isKoboldUnit(target) && activeEnemies().length>0){
        scheduleKoboldGroupMoraleCheck({
          casualties:1,
          magicCasualties:1,
          source:"Shocking Grasp"
        });
      }
    }
  }

  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Shocking Grasp",action);
  return true;
}

async function castWallOfFogSpell(action,targetHex){
  const caster=spellCasterForAction(action);
  const spell=getSpellEntry("wall-of-fog");
  const level=action.casterLevel||TEST_SPELL_CASTER_LEVEL;

  if(hexDistance(caster,targetHex)>spellRangeHexes(spell,level)){
    setCombatMessage("Wall of Fog target is out of range.");
    return false;
  }

  spellCastInProgress=true;
  commitSpellCast(caster,getSpellEntry(action?.spellId),action);
  pendingAimAction=null;
  exitAimMode(false,false);

  const duration=d(4)+d(4)+level;
  const cells=createWallOfFogCells(
    caster,
    targetHex,
    level,
    action.wallOfFogOrientationIndex
  );

  addAreaEffect({
    id:`fog-${Date.now()}`,
    type:"fog",
    name:"Wall of Fog",
    cells,
    visualHeightPx:HEX_W,
    expiresRound:game.round+duration,
    sourceUnitId:caster.id
  });

  const visibleFogCells=cells.filter(cell=>
    inside(cell.x,cell.y) &&
    isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
  ).length;
  setCombatMessage(
    `Wall of Fog rises across ${visibleFogCells} visible hex${visibleFogCells===1 ? "" : "es"}, ending at solid obstacles and the map edge.`,
    COMBAT_MESSAGE_MIN_HOLD_MS
  );
  await waitForCombatActionPause();
  finishTestSpellCast(caster,"Wall of Fog",action);
  return true;
}

async function castPreparedCombatSpell(action,targetHex,targetUnit){
  const spell=getSpellEntry(action?.spellId);

  if(!spell) return false;

  switch(spell.id){
    case "magic-missile":
      return await castMagicMissileFromScroll(action,targetUnit);
    case "fireball":
      return await castFireballFromScroll(action,targetHex);
    case "armor":
      return await castArmorSpell(action,targetUnit);
    case "burning-hands":
      return await castBurningHandsSpell(action,targetHex);
    case "chill-touch":
      return await castChillTouchSpell(action);
    case "color-spray":
      return await castColorSpraySpell(action,targetHex);
    case "enlarge":
      return await castEnlargeSpell(action,targetUnit);
    case "grease":
      return await castGreaseSpell(action,targetHex);
    case "light":
      return await castLightSpell(action,targetUnit);
    case "protection-from-evil":
      return await castProtectionFromEvilSpell(action,targetUnit);
    case "shield":
      return await castShieldSpell(action);
    case "shocking-grasp":
      return await castShockingGraspSpell(action,targetUnit);
    case "sleep":
      return await castSleepSpell(action,targetHex);
    case "spook":
      return await castSpookSpell(action,targetUnit);
    case "taunt":
      return await castTauntSpell(action,targetUnit);
    case "wall-of-fog":
      return await castWallOfFogSpell(action,targetHex);
  }

  return false;
}

async function activateAimTarget(){
  if(!aimMode || !game || game.over) return false;

  const target=unitAtHex(aimCursor.x,aimCursor.y);

  if(pendingAimAction){
    const action={...pendingAimAction};
    const spell=getSpellEntry(action.spellId);

    if(!spell){
      return false;
    }

    if(
      ["hostile-creature","adjacent-hostile"].includes(spell.targetMode) &&
      (!target || target.faction===game.player.faction)
    ){
      setCombatMessage(`${spell.name} requires a hostile creature target.`);
      return false;
    }

    if(
      ["creature","touch-creature"].includes(spell.targetMode) &&
      !target
    ){
      setCombatMessage(`${spell.name} requires a creature target.`);
      return false;
    }

    return await castPreparedCombatSpell(
      action,
      {x:aimCursor.x,y:aimCursor.y},
      target
    );
  }

  const actor=activePlayerControlledUnit();
  if(
    actor &&
    target &&
    target.faction!==actor.faction &&
    target.alive &&
    canMeleeReach(actor,target)
  ){
    const contact=occupiedHexes(target).find(cell=>
      hexDistance(actor,cell)===1 &&
      !architecturalWallBlocksStep(actor,cell)
    );

    if(contact){
      exitAimMode(false,false);
      await tryPlayerMove(
        contact.x-actor.x,
        contact.y-actor.y
      );
      return true;
    }
  }

  updateUi();
  draw();
  return false;
}

function waitCurrentUnit(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || isCombatActionPauseActive()) return;

  exitAimMode(false);
  if(p.turnMoves>0 || p.fullMove){
    log("Wait must be chosen before moving this turn.","system");
    updateUi(); draw(); return;
  }

  const laterActors=game.order.slice(game.turnIndex+1).map(getUnitById).filter(unit=>unit?.alive && !unit.fled);

  if(!p.waitedThisRound && laterActors.length){
    p.waitedThisRound=true;
    const [id]=game.order.splice(game.turnIndex,1);
    game.order.push(id);
    game.active=null;
    setUnitActionBanner(p,"Waiting");
    log(`${p.name} waits and yields to the next initiative slot.`,"system");
    updateUi(); draw();
    aiTimer=setTimeout(()=>{ aiTimer=null; beginTurn(); },180);
    return;
  }

  log(`No later initiative remains; ${p.name} gives up the rest of this round.`,"system");
  endTurn();
}


function adjacentHostileIdsFor(unit){
  if(!game || !unit) return [];

  const hostiles=unit.faction==="player"
    ? activeEnemies()
    : livingPartyMembers();

  return hostiles
    .filter(other=>
      other.alive &&
      !other.fled &&
      canMeleeReach(unit,other)
    )
    .map(other=>other.id);
}

function wasAdjacentWhenGuardSet(guardUnit,otherUnit){
  return !!(
    guardUnit &&
    otherUnit &&
    Array.isArray(guardUnit.guardBaselineAdjacentIds) &&
    guardUnit.guardBaselineAdjacentIds.includes(otherUnit.id)
  );
}

function chooseGuard(){
  const p=activePlayerControlledUnit();
  if(game.over || !p || isCombatActionPauseActive()) return;

  exitAimMode(false);
  if(p.turnMoves>0 || p.fullMove){
    log(`Guard requires ${p.name} to hold position; it cannot be chosen after moving.`,"system");
    updateUi(); draw(); return;
  }

  p.guard=true;
  p.guardRound=game.round;
  p.guardBaselineAdjacentIds=adjacentHostileIdsFor(p);
  setUnitActionBanner(p,"Guarding");
  log(
    p.guardBaselineAdjacentIds.length
      ? `${p.name} guards: enemies already adjacent do not trigger Guard; the first new enemy entering melee range will be attacked.`
      : `${p.name} guards: the first new enemy entering melee range will be attacked.`,
    "good"
  );
  refreshTurnBanner(); updateUi(); draw();
  endTurn();
}

function maybeTriggerPlayerGuard(mob){
  const guarder=livingPartyMembers()
    .filter(unit=>
      isPlayerControlledUnit(unit) &&
      unit.guard &&
      mob?.alive && !mob.fled &&
      canMeleeReach(unit,mob) &&
      !wasAdjacentWhenGuardSet(unit,mob)
    )
    .sort((a,b)=>a.id.localeCompare(b.id))[0];

  if(!guarder) return false;

  guarder.guard=false;
  guarder.guardBaselineAdjacentIds=[];
  log(`GUARD! ${guarder.name} attacks ${mob.name} as it newly enters an adjacent hex.`,"good");
  setUnitActionBanner(guarder,`Guard Attack with ${unitActionWeapon(guarder)}`);
  attack(guarder,mob);
  updateUi(); draw();
  return true;
}


function canMobGuard(mob){
  return !!(
    mob &&
    mob.controller==="mob" &&
    mob.alive &&
    !mob.fled &&
    !mob.fleeing &&
    mob.weapon &&
    (mob.meleeRange||1)>=1
  );
}

function enterMobGuard(mob,reason="cannot make an attack"){
  if(!canMobGuard(mob)) return false;

  mob.guard=true;
  mob.guardRound=game.round;
  mob.guardBaselineAdjacentIds=adjacentHostileIdsFor(mob);

  setUnitActionBanner(mob,"Guarding");

  log(
    `${mob.name} fills the closest available position and GUARDS (${reason}); `+
    `only a newly adjacent enemy can trigger the reaction.`,
    "system"
  );

  updateUi();
  draw();
  return true;
}

async function triggerMobGuardsAgainst(target){
  if(
    !game ||
    game.over ||
    !target?.alive ||
    mobGuardReactionInProgress
  ){
    return;
  }

  const guards=activeEnemies()
    .filter(mob=>
      mob.controller==="mob" &&
      mob.guard &&
      canMobGuard(mob) &&
      !wasAdjacentWhenGuardSet(mob,target) &&
      canMeleeAttackTarget(mob,target)
    )
    .sort((a,b)=>a.id.localeCompare(b.id));

  if(!guards.length) return;

  mobGuardReactionInProgress=true;

  try{
    for(const mob of guards){
      if(game.over || !target.alive) break;
      if(!mob.alive || mob.fled || !mob.guard) continue;

      mob.guard=false;
      mob.guardBaselineAdjacentIds=[];

      log(
        `MOB GUARD! ${mob.name} attacks ${target.name} as the target newly enters an adjacent hex.`,
        "bad"
      );

      setUnitActionBanner(
        mob,
        `Guard Attack with ${unitActionWeapon(mob)}`
      );

      const result=attack(mob,target);
      updateUi();
      draw();

      if(result?.hit){
        await waitForCombatActionPause();

        if(result?.killed){
          break;
        }
      }else{
        await sleep(160);
      }
    }
  }finally{
    mobGuardReactionInProgress=false;
  }

  if(!game.over){
    refreshTurnBanner();
    updateUi();
    draw();
  }
}

function passableForPath(x,y,mover,target){
  if(!mover){
    return !isWall(x,y) && !occupiedByAnyUnit(x,y,null);
  }

  /*
    R186: pathfinding validates the mover's COMPLETE destination footprint.
    Target cells require no special case because overlap with the target's
    footprint is rejected by canUnitStandAt().
  */
  return canUnitStandAt(mover,x,y);
}

/* Open-map shortest path. With no obstacles, repeatedly choosing the
   neighbor that decreases hex distance produces a shortest route. */
function pathToAdjacent(start,target,mover){
  if(canMeleeReach(start,target)){
    return [{x:start.x,y:start.y}];
  }

  const queue=[{x:start.x,y:start.y}];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let end=null;
  let guard=0;

  while(queue.length && guard<3000){
    guard++;
    const cur=queue.shift();
    const curMover=mover ? {...mover,x:cur.x,y:cur.y} : cur;

    if(canMeleeReach(curMover,target)){
      end=cur;
      break;
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      if(mover){
        const da=unitDistanceAt(mover,cur.x+a.x,cur.y+a.y,target);
        const db=unitDistanceAt(mover,cur.x+b.x,cur.y+b.y,target);
        return da-db;
      }

      const da=hexDistance({x:cur.x+a.x,y:cur.y+a.y},target);
      const db=hexDistance({x:cur.x+b.x,y:cur.y+b.y},target);
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const k=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(k)) continue;
      if(mover && unitTransitionBlocked(mover,cur,next)) continue;
      if(!passableForPath(nx,ny,mover,target)) continue;

      seen.add(k);
      came.set(k,cur);
      queue.push(next);
    }
  }

  if(!end){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur=end;

  while(cur){
    path.push(cur);
    const prev=came.get(key(cur.x,cur.y));
    if(!prev) break;
    cur=prev;
  }

  path.reverse();
  return path;
}


function mobPathToPartyTarget(mob,target){
  if(!mob || !target) return null;

  if(canMeleeReach(mob,target)){
    return [{x:mob.x,y:mob.y}];
  }

  const path=pathToAdjacent(mob,target,mob);

  return path && path.length>1
    ? path
    : null;
}

function selectMobPartyTarget(mob){
  const candidates=livingPartyMembers()
    .slice()
    .sort((a,b)=>
      unitDistance(mob,a)-unitDistance(mob,b) ||
      a.id.localeCompare(b.id)
    );

  if(!candidates.length){
    return {
      target:null,
      path:null,
      reachable:false,
      nearest:null
    };
  }

  const nearest=candidates[0];

  for(const target of candidates){
    const path=mobPathToPartyTarget(mob,target);

    if(path){
      return {
        target,
        path,
        reachable:true,
        nearest
      };
    }
  }

  return {
    target:nearest,
    path:null,
    reachable:false,
    nearest
  };
}

function pathToHex(start,target,mover){
  if(start.x===target.x && start.y===target.y){
    return [{x:start.x,y:start.y}];
  }

  if(mover && !canUnitStandAt(mover,target.x,target.y)){
    return [{x:start.x,y:start.y}];
  }

  if(!mover && occupiedByAnyUnit(target.x,target.y,null)){
    return [{x:start.x,y:start.y}];
  }

  const queue=[{x:start.x,y:start.y}];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let end=null;
  let guard=0;

  while(queue.length && guard<4000){
    guard++;
    const cur=queue.shift();

    if(cur.x===target.x && cur.y===target.y){
      end=cur;
      break;
    }

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const da=hexDistance(
        {x:cur.x+a.x,y:cur.y+a.y},
        target
      );
      const db=hexDistance(
        {x:cur.x+b.x,y:cur.y+b.y},
        target
      );
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const nk=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(nk)) continue;

      if(mover){
        if(unitTransitionBlocked(mover,cur,next)) continue;
      }else{
        if(isWall(nx,ny)) continue;
        if(architecturalWallBlocksStep(cur,next)) continue;
        if(occupiedByAnyUnit(nx,ny,null)) continue;
      }

      seen.add(nk);
      came.set(nk,cur);
      queue.push(next);
    }
  }

  if(!end){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur=end;

  while(cur){
    path.push(cur);
    const prev=came.get(key(cur.x,cur.y));
    if(!prev) break;
    cur=prev;
  }

  path.reverse();
  return path;
}

function pathToClosestReachable(start,target,mover,maxSteps){
  const startNode={
    x:start.x,
    y:start.y,
    steps:0
  };

  const queue=[startNode];
  const came=new Map();
  const seen=new Set([key(start.x,start.y)]);

  let best=startNode;
  let bestDistance=mover
    ? approachDistanceAt(mover,startNode.x,startNode.y,target)
    : hexDistance(startNode,target);

  while(queue.length){
    const cur=queue.shift();

    if(cur.steps>=maxSteps) continue;

    const dirs=[...HEX_DIRS].sort((a,b)=>{
      const da=mover
        ? approachDistanceAt(mover,cur.x+a.x,cur.y+a.y,target)
        : hexDistance({x:cur.x+a.x,y:cur.y+a.y},target);
      const db=mover
        ? approachDistanceAt(mover,cur.x+b.x,cur.y+b.y,target)
        : hexDistance({x:cur.x+b.x,y:cur.y+b.y},target);
      return da-db;
    });

    for(const dir of dirs){
      const nx=cur.x+dir.x;
      const ny=cur.y+dir.y;
      const nk=key(nx,ny);
      const next={x:nx,y:ny};

      if(seen.has(nk)) continue;

      if(mover){
        if(unitTransitionBlocked(mover,cur,next)) continue;
      }else{
        if(isWall(nx,ny)) continue;
        if(architecturalWallBlocksStep(cur,next)) continue;
        if(occupiedByAnyUnit(nx,ny,null)) continue;
      }

      const steps=cur.steps+1;
      const node={x:nx,y:ny,steps};

      seen.add(nk);
      came.set(nk,{x:cur.x,y:cur.y});
      queue.push(node);

      const distance=mover
        ? approachDistanceAt(mover,nx,ny,target)
        : hexDistance(node,target);

      if(
        distance<bestDistance ||
        (
          distance===bestDistance &&
          best.steps===0 &&
          steps>0
        ) ||
        (
          distance===bestDistance &&
          best.steps>0 &&
          steps<best.steps
        )
      ){
        best=node;
        bestDistance=distance;
      }
    }
  }

  if(best.x===start.x && best.y===start.y){
    return [{x:start.x,y:start.y}];
  }

  const path=[];
  let cur={x:best.x,y:best.y};

  while(cur){
    path.push(cur);

    if(cur.x===start.x && cur.y===start.y){
      break;
    }

    cur=came.get(key(cur.x,cur.y)) || null;
  }

  path.reverse();
  return path;
}

function clickPathStep(targetHex){
  const p=activePlayerControlledUnit();
  if(game?.over || !p || game?.active!==p.id || !p.alive || aimMode || isCombatActionPauseActive()) return;

  if(targetHex.x===p.x && targetHex.y===p.y) return;
  const clickedEnemy=enemyAtHex(targetHex.x,targetHex.y);
  let path;

  if(clickedEnemy){
    if(canMeleeReach(p,clickedEnemy)){
      const contact=occupiedHexes(clickedEnemy).find(cell=>
        hexDistance(p,cell)===1 &&
        !architecturalWallBlocksStep(p,cell)
      );

      if(contact){
        tryPlayerMove(contact.x-p.x,contact.y-p.y);
      }
      return;
    }
    path=pathToAdjacent(p,clickedEnemy,p);
  }else{
    path=pathToHex(p,targetHex,p);
  }

  if(!path || path.length<2){ log("No path to that hex.","system"); return; }
  const next=path[1];
  const dx=next.x-p.x;
  const dy=next.y-p.y;
  if(!HEX_DIRS.some(dir=>dir.x===dx && dir.y===dy)){
    log("Pathfinding could not produce a legal next step.","system");
    return;
  }
  tryPlayerMove(dx,dy);
}

function fleeStep(unit,threat){
  /*
    R72 fleeing:
    reaching an edge is not enough. A unit escapes only when it has
    another movement point and attempts to step from an edge hex to
    an out-of-bounds coordinate.
  */
  if(isMapEdgeHex(unit.x,unit.y)){
    const escapeOptions=HEX_DIRS
      .map(dir=>({
        x:unit.x+dir.x,
        y:unit.y+dir.y,
        escape:true
      }))
      .filter(pos=>!inside(pos.x,pos.y))
      .map(pos=>({
        ...pos,
        distance:threat
          ? hexDistance(pos,threat)
          : 0
      }))
      .sort((a,b)=>
        b.distance-a.distance ||
        a.x-b.x ||
        a.y-b.y
      );

    if(escapeOptions.length){
      return escapeOptions[0];
    }
  }

  const options=HEX_DIRS
    .map(dir=>({
      x:unit.x+dir.x,
      y:unit.y+dir.y
    }))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat
        ? unitDistanceAt(unit,pos.x,pos.y,threat)
        : 0
    }));

  options.sort((a,b)=>
    b.distance-a.distance ||
    a.x-b.x ||
    a.y-b.y
  );

  return options[0] || null;
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function animateEntitySteps(entity,steps,stepProvider,delay=145){
  const senseContext=createHiddenMobMovementSenseContext();

  for(let i=0;i<steps;i++){
    if(
      game.over ||
      !entity.alive ||
      entity.fled
    ){
      return false;
    }

    const next=stepProvider();

    if(!next){
      return false;
    }

    if(next.escape){
      /*
        The edge-crossing attempt is itself leaving a threatened hex,
        so resolve free strikes before the unit disappears.
      */
      const canLeave=await performLeavingHexFreeAttacks(
        entity,
        next
      );

      if(!canLeave){
        return false;
      }

      const mode=mobMovementPresentationMode(
        entity,
        {x:entity.x,y:entity.y},
        senseContext
      );

      updateFacingForStep(
        entity,
        next.x-entity.x,
        next.y-entity.y
      );

      if(mode!=="silent"){
        setUnitActionBanner(entity,"Escaping");
      }

      if(mode==="heard"){
        centerCameraOn(entity);
        senseContext.centered=true;
        showActivityDetectedFx(entity,Math.max(280,delay+120));
        refreshTurnBanner();
      }

      entity.fled=true;
      if(entity.fleeing){
        setMoraleFleeing(entity,false);
      }
      entity.guard=false;
      entity.guardBaselineAdjacentIds=[];

      if(entity.controller==="mob"){
        markEnemyNeutralized(entity);
      }

      if(mode!=="silent"){
        playMoveSound();
        log(
          `${entity.name} moves past the battlefield edge and escapes combat.`,
          "good"
        );
        updateUi();
        draw();
      }

      if(entity.faction==="player"){
        checkPartyDefeat();
      }else{
        checkCombatVictory();
      }

      return true;
    }

    if(!next.escape && unitTransitionBlocked(entity,entity,next)){
      return false;
    }

    const canLeave=await performLeavingHexFreeAttacks(
      entity,
      next
    );

    if(!canLeave){
      return false;
    }

    const mode=mobMovementPresentationMode(entity,next,senseContext);

    updateFacingForStep(
      entity,
      next.x-entity.x,
      next.y-entity.y
    );

    if(mode!=="silent"){
      setUnitActionBanner(
        entity,
        entity.fleeing || getUnitEffect(entity,"spook")
          ? "Fleeing"
          : "Moving"
      );
    }

    entity.x=next.x;
    entity.y=next.y;

    if(mode==="visible"){
      clearActivityDetectedFxForUnit(entity);
      if(senseContext.wasHidden){
        centerCameraOn(entity);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(entity);
      }
      playMoveSound();
      draw();
    }else if(mode==="heard"){
      if(!senseContext.centered){
        centerCameraOn(entity);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(entity);
      }
      showActivityDetectedFx(entity,Math.max(280,delay+120));
      refreshTurnBanner();
      playMoveSound();
      draw();
    }
    /* mode === "silent": state advances immediately with no camera, sound, draw, or delay. */

    if(entity.controller==="mob" && maybeTriggerPlayerGuard(entity)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over || !entity.alive){
        return false;
      }
    }

    if(mode!=="silent"){
      await sleep(delay);
    }
  }

  return true;
}

async function animateMobAlongPath(mob,path,maxSteps){
  const steps=Math.min(maxSteps,Math.max(0,path.length-1));
  const senseContext=createHiddenMobMovementSenseContext();

  for(let i=1;i<=steps;i++){
    if(game.over || !mob.alive || mob.fled) return false;

    if(unitTransitionBlocked(mob,mob,path[i])) return false;

    const canLeave=await performLeavingHexFreeAttacks(
      mob,
      path[i]
    );

    if(!canLeave){
      return false;
    }

    const mode=mobMovementPresentationMode(mob,path[i],senseContext);

    updateFacingForStep(
      mob,
      path[i].x-mob.x,
      path[i].y-mob.y
    );

    if(mode!=="silent"){
      setUnitActionBanner(mob,"Moving");
    }

    mob.x=path[i].x;
    mob.y=path[i].y;

    if(mode==="visible"){
      clearActivityDetectedFxForUnit(mob);
      if(senseContext.wasHidden){
        centerCameraOn(mob);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(mob);
      }
      playMoveSound();
      draw();
    }else if(mode==="heard"){
      if(!senseContext.centered){
        centerCameraOn(mob);
        senseContext.centered=true;
      }else{
        maybeRecenterCamera(mob);
      }
      showActivityDetectedFx(mob,400);
      refreshTurnBanner();
      playMoveSound();
      draw();
    }
    /* mode === "silent": consume hidden steps immediately and invisibly. */

    if(maybeTriggerPlayerGuard(mob)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over) return false;
      if(!mob.alive) return false;
    }

    if(mode!=="silent"){
      await sleep(105);
    }
  }

  return true;
}



function dragonBreathReady(dragon){
  const breath=dragon?.breathWeapon;
  if(!breath || !game) return false;

  const cooldown=Math.max(1,Number(breath.cooldownRounds)||3);
  const last=Number(breath.lastUsedRound);
  return !Number.isFinite(last) || (game.round-last)>=cooldown;
}

function dragonBreathSourceHex(dragon,target){
  const directionIndex=hexDirectionIndexToward(dragon,target);
  const dir=HEX_DIRS[directionIndex] || HEX_DIRS[0];

  return {
    x:dragon.x+dir.x,
    y:dragon.y+dir.y,
    directionIndex
  };
}

/*
  R187 maps the AD&D 2e 90-foot, 5-to-30-foot fire cone to the current
  10-foot tactical hex scale. From the front body hex, the plume extends
  nine hexes. The final four rows widen to three tactical cells.
*/
function dragonBreathCells(dragon,target){
  if(!dragon?.breathWeapon || !target) return [];

  const range=Math.max(1,Number(dragon.breathWeapon.rangeHexes)||9);
  const source=dragonBreathSourceHex(dragon,target);
  const forward=HEX_DIRS[source.directionIndex] || HEX_DIRS[0];
  const left=HEX_DIRS[(source.directionIndex+5)%6];
  const right=HEX_DIRS[(source.directionIndex+1)%6];
  const ownCells=new Set(occupiedHexes(dragon).map(cell=>key(cell.x,cell.y)));
  const result=[];
  const seen=new Set();

  const addCell=(cell,step,lane)=>{
    if(
      !inside(cell.x,cell.y) ||
      isWall(cell.x,cell.y) ||
      ownCells.has(key(cell.x,cell.y)) ||
      hexDistance(source,cell)>range+(lane===0 ? 0 : 1) ||
      architecturalWallBlocksLOS(source,cell)
    ){
      return;
    }

    const cellKey=key(cell.x,cell.y);
    if(seen.has(cellKey)) return;
    seen.add(cellKey);
    result.push({
      x:cell.x,
      y:cell.y,
      breathStep:step,
      breathLane:lane
    });
  };

  for(let step=1;step<=range;step++){
    const center={
      x:source.x+forward.x*step,
      y:source.y+forward.y*step
    };

    addCell(center,step,0);

    if(step>=6){
      addCell(
        {x:center.x+left.x,y:center.y+left.y},
        step,-1
      );
      addCell(
        {x:center.x+right.x,y:center.y+right.y},
        step,1
      );
    }
  }

  return result.sort((a,b)=>
    a.breathStep-b.breathStep ||
    a.breathLane-b.breathLane ||
    a.x-b.x ||
    a.y-b.y
  );
}

function bestDragonBreathPlan(dragon){
  if(!dragonBreathReady(dragon)) return null;

  const party=livingPartyMembers();
  if(!party.length) return null;

  const partyIds=new Set(party.map(unit=>unit.id));
  const plans=[];

  for(const target of party){
    const cells=dragonBreathCells(dragon,target);
    const affected=livingUnitsInAreaCells(cells)
      .filter(unit=>unit.id!==dragon.id);
    const partyVictims=affected.filter(unit=>partyIds.has(unit.id));

    if(!partyVictims.length) continue;

    const collateral=affected.filter(unit=>
      unit.controller==="mob" &&
      unit.id!==dragon.id &&
      !partyIds.has(unit.id)
    ).length;

    plans.push({
      target,
      cells,
      affected,
      partyVictims,
      collateral,
      score:
        partyVictims.length*1000 -
        collateral*500 -
        unitDistance(dragon,target)
    });
  }

  plans.sort((a,b)=>
    b.score-a.score ||
    b.partyVictims.length-a.partyVictims.length ||
    unitDistance(dragon,a.target)-unitDistance(dragon,b.target)
  );

  return plans[0] || null;
}

async function animateDragonBreath(dragon,plan){
  const duration=1050;
  const started=performance.now();
  const source=dragonBreathSourceHex(dragon,plan.target);

  dragonBreathFx={
    dragonId:dragon.id,
    source,
    directionIndex:source.directionIndex,
    cells:plan.cells.map(cell=>({...cell})),
    rangeHexes:Math.max(1,Number(dragon.breathWeapon?.rangeHexes)||9),
    started,
    duration
  };

  playDragonBreathSound();

  while(true){
    const elapsed=performance.now()-started;
    draw();
    if(elapsed>=duration) break;
    await sleep(16);
  }

  dragonBreathFx=null;
  draw();
}

async function juvenileRedDragonBreathAttack(dragon,plan){
  if(!dragon?.alive || !plan?.cells?.length) return false;

  const breath=dragon.breathWeapon;
  faceEntityToward(dragon,plan.target);
  triggerUnitAttackPose(dragon);
  setUnitActionBanner(dragon,"Breathing Fire");

  breath.lastUsedRound=game.round;

  const rolledDamage=rollDiceExpression(
    breath.damageExpression || "8d10+4"
  ).total;

  const affected=livingUnitsInAreaCells(plan.cells)
    .filter(unit=>unit.id!==dragon.id);

  const results=affected.map(unit=>{
    const immune=unitImmuneToDamageType(unit,breath.damageType || "fire");

    if(immune){
      return {
        unit,
        immune:true,
        saveTarget:null,
        saveRoll:null,
        saved:false,
        damage:0
      };
    }

    const saveTarget=breathSaveTargetForUnit(unit);
    const saveRoll=d(20);
    const saved=saveRoll>=saveTarget;
    const damage=saved
      ? Math.floor(rolledDamage/2)
      : rolledDamage;

    return {
      unit,
      immune:false,
      saveTarget,
      saveRoll,
      saved,
      damage
    };
  });

  for(const result of results){
    const unit=result.unit;
    const damage=result.damage;
    if(damage<=0) continue;

    unit.hp=Math.max(0,unit.hp-damage);
    onUnitDamaged(unit,damage);
    registerElementalDamageFx(unit,"fire",damage);
  }

  updateUi();
  draw();

  log(
    dragon.name+" breathes a "+(breath.rangeFeet || 90)+"' cone of fire: "+
    (breath.damageExpression || "8d10+4")+" = "+rolledDamage+
    " damage before saves; "+affected.length+" creature"+
    (affected.length===1 ? "" : "s")+" caught.",
    "bad"
  );

  for(const result of results){
    if(result.immune){
      log(
        result.unit.name+" is immune to fire and takes no breath-weapon damage.",
        "system"
      );
      continue;
    }

    log(
      result.unit.name+": save vs. breath "+result.saveRoll+" vs "+
      result.saveTarget+" — "+
      (result.saved ? "success, half damage" : "failure, full damage")+
      "; "+result.damage+" damage.",
      result.saved ? "system" : "bad"
    );
  }

  setCombatMessage(
    affected.length
      ? dragon.name.toUpperCase()+" BREATHES FIRE — "+affected.length+
        " TARGET"+(affected.length===1 ? "" : "S")+" IN THE CONE"
      : dragon.name.toUpperCase()+" BREATHES FIRE",
    1000,
    1300,
    "player-damage"
  );

  await animateDragonBreath(dragon,plan);

  const killed=results.filter(result=>
    result.damage>0 &&
    result.unit.hp<=0 &&
    result.unit.alive
  );

  for(const result of killed){
    const unit=result.unit;
    unit.alive=false;

    if(unit.controller==="mob"){
      markEnemyNeutralized(unit);
    }

    log(unit.name+" goes down and is dying in the dragonfire.","bad");
    playAgonySound(unit);
    playDeathSound(unit);
    triggerDeathFx(unit);
    updateUi();
    draw();
    await waitForDeathActionPause();
  }

  checkPartyDefeat();
  return true;
}

async function juvenileRedDragonMeleeRoutine(dragon,target){
  const attacks=[
    {name:"Claw",damage:"1d10"},
    {name:"Claw",damage:"1d10"},
    {name:"Bite",damage:"3d10"}
  ];

  const original={
    weapon:dragon.weapon,
    weaponDamageSM:dragon.weaponDamageSM,
    weaponDamageL:dragon.weaponDamageL
  };

  let lastResult=null;

  for(const attackSpec of attacks){
    if(
      game.over ||
      !dragon.alive ||
      !target?.alive ||
      !canMeleeAttackTarget(dragon,target)
    ){
      break;
    }

    dragon.weapon=attackSpec.name;
    dragon.weaponDamageSM=attackSpec.damage;
    dragon.weaponDamageL=attackSpec.damage;

    lastResult=attack(
      dragon,
      target,
      {actionLabel:attackSpec.name}
    );

    if(lastResult?.killed || lastResult?.criticalMiss){
      await waitForCombatActionPause();
    }else{
      await sleep(190);
    }
  }

  dragon.weapon=original.weapon;
  dragon.weaponDamageSM=original.weaponDamageSM;
  dragon.weaponDamageL=original.weaponDamageL;

  return lastResult;
}

async function juvenileRedDragonTurn(dragon,target){
  let breathPlan=bestDragonBreathPlan(dragon);

  if(breathPlan){
    await juvenileRedDragonBreathAttack(dragon,breathPlan);
    if(!game.over) endTurn();
    return;
  }

  if(canMeleeAttackTarget(dragon,target)){
    if(maybeTriggerPlayerGuard(dragon)){
      await sleep(Math.max(240,combatActionPauseRemaining()));
      if(game.over) return;
      if(!dragon.alive){
        endTurn();
        return;
      }
    }

    await juvenileRedDragonMeleeRoutine(dragon,target);
    if(!game.over) endTurn();
    return;
  }

  const path=pathToClosestReachable(
    dragon,
    target,
    dragon,
    dragon.move
  );
  const steps=Math.max(0,path.length-1);

  if(steps>0){
    await animateMobAlongPath(dragon,path,steps);

    if(game.over) return;
    if(!dragon.alive){
      endTurn();
      return;
    }
  }

  if(steps<=dragon.halfMove){
    breathPlan=bestDragonBreathPlan(dragon);

    if(breathPlan){
      await juvenileRedDragonBreathAttack(dragon,breathPlan);
      if(!game.over) endTurn();
      return;
    }

    if(canMeleeAttackTarget(dragon,target)){
      if(maybeTriggerPlayerGuard(dragon)){
        await sleep(Math.max(240,combatActionPauseRemaining()));
        if(game.over) return;
        if(!dragon.alive){
          endTurn();
          return;
        }
      }

      await juvenileRedDragonMeleeRoutine(dragon,target);
      if(!game.over) endTurn();
      return;
    }
  }

  if(steps>0){
    log(
      dragon.name+" closes to "+unitDistance(dragon,target)+
      " hexes from "+target.name+".",
      "system"
    );
  }

  if(canMobGuard(dragon)){
    enterMobGuard(
      dragon,
      dragonBreathReady(dragon)
        ? "closing for a breath-weapon lane"
        : "breath weapon is recharging"
    );
  }

  if(!game.over) endTurn();
}


function rangedRetreatStep(unit,threat){
  const options=HEX_DIRS
    .map(dir=>({x:unit.x+dir.x,y:unit.y+dir.y}))
    .filter(pos=>
      inside(pos.x,pos.y) &&
      !unitTransitionBlocked(unit,unit,pos)
    )
    .map(pos=>({
      ...pos,
      distance:threat ? unitDistanceAt(unit,pos.x,pos.y,threat) : 0
    }))
    .sort((a,b)=>b.distance-a.distance || a.x-b.x || a.y-b.y);
  return options[0] || null;
}

async function mobTurn(mob){
  if(
    game.over ||
    !mob ||
    mob.controller!=="mob" ||
    game.active!==mob.id ||
    !mob.alive ||
    mob.fled
  ){
    return;
  }

  const taunt=getUnitEffect(mob,"taunt");
  const tauntSource=taunt
    ? getUnitById(taunt.data?.sourceUnitId)
    : null;

  const targetChoice=
    tauntSource?.alive
      ? {
          target:tauntSource,
          path:mobPathToPartyTarget(mob,tauntSource),
          reachable:true,
          nearest:tauntSource
        }
      : selectMobPartyTarget(mob);

  const target=targetChoice.target;

  if(!target){
    checkPartyDefeat();
    return;
  }

  if(
    targetChoice.reachable &&
    targetChoice.nearest &&
    target.id!==targetChoice.nearest.id
  ){
    log(
      `${mob.name} cannot path to ${targetChoice.nearest.name}; `+
      `it switches to reachable target ${target.name}.`,
      "system"
    );
  }else if(!targetChoice.reachable){
    log(
      `${mob.name} cannot find a complete path to any party member; `+
      `it fills toward ${target.name}.`,
      "system"
    );
  }

  if(mob.fleeing){
    maybeShowInitialMoralePanicBark(mob);

    refreshTurnBanner();

    await animateEntitySteps(
      mob,
      mob.move,
      ()=>fleeStep(mob,target),
      105
    );

    if(game.over){
      return;
    }

    if(mob.fled || !mob.alive){
      endTurn();
      return;
    }

    const distance=unitDistance(mob,target);

    log(
      isMapEdgeHex(mob.x,mob.y)
        ? `${mob.name} reaches the battlefield edge; another movement point is required to escape.`
        : `${mob.name} flees to ${distance} hexes away.`,
      "system"
    );

    if(!game.over) endTurn();
    return;
  }

  const startingDistance=unitDistance(mob,target);

  if(mob.type==="juvenile-red-dragon"){
    await juvenileRedDragonTurn(mob,target);
    return;
  }

  /*
    R127 Kobold Slinger AI: Slingers are dedicated ranged troops. If they do
    not currently have a legal shot, they search the movement graph for the
    nearest unthreatened hex with LOS and Sling range to ANY party member.
    Reaching that lane within half movement allows an immediate shot; a more
    distant lane becomes a full-turn repositioning goal.
  */
  if(mob.type==="kobold-slinger" && !taunt){
    if((mob.missileAmmoQuantity||0)>0){
      let firingTarget=
        !rangedAiPositionThreatened(mob,mob)
          ? bestRangedAiTargetFrom(mob,mob)
          : null;

      if(!firingTarget){
        const plan=pathToNearestRangedFiringHex(mob,{avoidThreatened:true});

        if(plan?.path?.length>1){
          const stepsToFiringHex=plan.path.length-1;
          const canMoveAndFire=stepsToFiringHex<=Math.max(0,mob.halfMove||0);
          const movementLimit=canMoveAndFire
            ? stepsToFiringHex
            : Math.min(Math.max(0,mob.move||0),stepsToFiringHex);

          log(
            canMoveAndFire
              ? `${mob.name} has no clear Sling shot and moves ${stepsToFiringHex} hex${stepsToFiringHex===1 ? "" : "es"} to gain line of sight.`
              : `${mob.name} has no line of sight and moves toward a firing lane (${stepsToFiringHex} hexes away).`,
            "system"
          );

          await animateMobAlongPath(mob,plan.path,movementLimit);

          if(game.over) return;
          if(!mob.alive){ endTurn(); return; }

          if(!canMoveAndFire){
            if(!game.over) endTurn();
            return;
          }

          firingTarget=
            !rangedAiPositionThreatened(mob,mob)
              ? bestRangedAiTargetFrom(mob,mob)
              : null;
        }
      }

      if(firingTarget && mobCanMissileAttack(mob,firingTarget)){
        log(
          `${mob.name} uses its Sling (${mob.missileAmmoQuantity} bullets remaining before the shot).`,
          "system"
        );
        await mobMissileAttack(mob,firingTarget);
        if(!game.over) endTurn();
        return;
      }
    }

    if((mob.missileAmmoQuantity||0)<=0){
      log(`${mob.name} is out of sling bullets and holds position.`,"system");
    }else{
      log(`${mob.name} cannot find a reachable Sling firing lane and holds position.`,"system");
    }

    if(canMobGuard(mob)){
      enterMobGuard(mob,"ranged firing lane unavailable");
    }
    if(!game.over) endTurn();
    return;
  }

  /*
    CORE MOB LOGIC:
    > 4 hexes: default to a missile attack if capable and in range.
    <=4 hexes: close for melee.
  */
  if(
    startingDistance>MOB_MISSILE_DEFAULT_DISTANCE &&
    mobCanMissileAttack(mob,target)
  ){
    log(
      `${mob.name} is ${startingDistance} hexes away and defaults to ${mob.rangedWeapon} fire.`,
      "system"
    );

    await mobMissileAttack(mob,target);

    if(!game.over) endTurn();
    return;
  }

  /* Already in melee range: attack immediately. */
  if(canMeleeAttackTarget(mob,target)){
    if(maybeTriggerPlayerGuard(mob)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over) return;
      if(!mob.alive){
        endTurn();
        return;
      }
    }

    const result=attack(mob,target);

    if(result?.killed || result?.criticalMiss){
      await waitForCombatActionPause();
    }

    if(!game.over) endTurn();
    return;
  }

  /*
    The target cannot necessarily be reached because other mobs may occupy
    the best melee hexes. Search every legal hex this mob can reach this turn
    and fill the one with the smallest remaining distance to the target.
  */
  const path=pathToClosestReachable(
    mob,
    target,
    mob,
    mob.move
  );

  const steps=Math.max(0,path.length-1);

  if(steps>0){
    await animateMobAlongPath(mob,path,steps);

    if(game.over) return;

    if(!mob.alive){
      endTurn();
      return;
    }
  }

  const endingDistance=unitDistance(mob,target);

  /*
    If the mob managed to reach melee range without exceeding half movement,
    it attacks. Otherwise its action becomes Guard.
  */
  if(
    canMeleeAttackTarget(mob,target) &&
    steps<=mob.halfMove
  ){
    if(maybeTriggerPlayerGuard(mob)){
      await sleep(Math.max(240,combatActionPauseRemaining()));

      if(game.over) return;
      if(!mob.alive){
        endTurn();
        return;
      }
    }

    const result=attack(mob,target);

    if(result?.killed || result?.criticalMiss){
      await waitForCombatActionPause();
    }

    if(!game.over) endTurn();
    return;
  }

  /*
    A rare mob that started beyond four hexes but could not make its default
    missile attack may have moved into valid missile range using <= half move.
  */
  if(
    startingDistance>MOB_MISSILE_DEFAULT_DISTANCE &&
    steps<=mob.halfMove &&
    mobCanMissileAttack(mob,target)
  ){
    log(
      `${mob.name} moves into missile range and uses ${mob.rangedWeapon}.`,
      "system"
    );

    await mobMissileAttack(mob,target);

    if(!game.over) endTurn();
    return;
  }

  if(steps>0){
    log(
      `${mob.name} fills the closest reachable hex: distance ${endingDistance} from ${target.name}.`,
      "system"
    );
  }else{
    log(
      `${mob.name} cannot get any closer this turn.`,
      "system"
    );
  }

  if(canMobGuard(mob)){
    enterMobGuard(
      mob,
      canMeleeAttackTarget(mob,target)
        ? "full movement prevents an immediate attack"
        : "the target is still outside melee range"
    );
  }

  if(!game.over) endTurn();
}


function collectLootFromSlainEnemies(){
  const items=new Map();
  const add=(name,qty=1)=>{
    const amount=Math.max(0,Number(qty)||0);
    if(!name || amount<=0) return;
    items.set(name,(items.get(name)||0)+amount);
  };

  const slain=(game?.enemies || []).filter(enemy=>!enemy.alive && !enemy.fled);

  for(const enemy of slain){
    if(enemy.weapon) add(enemy.weapon,1);
    if(enemy.rangedWeapon) add(enemy.rangedWeapon,1);
    if(enemy.armorName) add(enemy.armorName,1);
    if(enemy.shieldName) add(enemy.shieldName,1);
    if(enemy.missileAmmoName && Number(enemy.missileAmmoQuantity)>0){
      add(enemy.missileAmmoName,enemy.missileAmmoQuantity);
    }
  }

  return {
    slain,
    fled:(game?.enemies || []).filter(enemy=>enemy.fled),
    items:[...items.entries()]
      .map(([name,qty])=>({name,qty}))
      .sort((a,b)=>a.name.localeCompare(b.name))
  };
}

function showXpLootScreen(title,text,xpAwarded=0){
  const loot=collectLootFromSlainEnemies();

  currentScreen="xp-loot";
  combatScreen.classList.remove("active");
  combatConditionsScreen?.classList.remove("active");
  launcherScreen.classList.remove("active");
  xpLootScreen.classList.add("active");

  document.getElementById("xpLootOutcome").textContent=String(title || "COMBAT COMPLETE").toUpperCase();
  document.getElementById("xpLootIntro").textContent=text || "Combat complete.";
  document.getElementById("xpLootXp").textContent=String(xpAwarded||0);
  document.getElementById("xpLootSlain").textContent=String(loot.slain.length);
  document.getElementById("xpLootFled").textContent=String(loot.fled.length);

  const list=document.getElementById("xpLootItems");
  list.innerHTML="";

  if(!loot.items.length){
    const empty=document.createElement("div");
    empty.className="xp-loot-empty";
    empty.textContent="No recoverable equipment.";
    list.appendChild(empty);
  }else{
    for(const item of loot.items){
      const name=document.createElement("div");
      name.textContent=item.name;
      const qty=document.createElement("div");
      qty.className="qty";
      qty.textContent=`× ${item.qty}`;
      list.append(name,qty);
    }
  }

  updateAudioIndicators();
}

function finishCombat(title,text){
  game.over=true;
  game.active=null;
  quickCommandUnitIds.clear();
  quickCommandActive=false;
  quickCommandUnitId=null;
  quickCommandGeneration++;
  quickCommandRunning=false;

  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }

  let xpAwarded=0;
  let xpText="";

  if(title==="Victory"){
    const fighter=game?.player;
    const baseXp=game.xpPool || 0;
    const bonus=fighter?.stats?.str>=FIGHTER_CLASS.primeRequisiteXpBonusThreshold
      ? Math.round(baseXp*0.10)
      : 0;
    xpAwarded=baseXp+bonus;
    xpText=awardFighterXp(baseXp);
  }

  ui.turnBanner.textContent="COMBAT COMPLETE";
  ui.resultOverlay.classList.remove("show");
  updateUi();
  showXpLootScreen(title,text+xpText,xpAwarded);
}

function unitStatus(unit){
  if(!unit) return "—";

  if(isPlayerControlledUnit(unit)){
    if(unit.guard) return "GUARDING";
    if(game.active===unit.id) return "ACTIVE — PLAYER CONTROL";
    if(unit.waitedThisRound) return "WAITING";
    return "READY — PLAYER CONTROL";
  }

  if(unit.controller==="npc"){
    if(game.active===unit.id) return "ACTIVE — FRIENDLY NPC";
    return "FRIENDLY NPC";
  }

  if(unit.controller==="mob"){
    if(unit.fleeing) return "FLEEING";
    if(unit.guard) return "GUARDING";
    if(game.active===unit.id) return "ACTIVE";
    return "HOSTILE MOB";
  }

  return "—";
}


function normalizeUnitEffect(effect){
  if(effect===null || effect===undefined){
    return null;
  }

  if(typeof effect==="string"){
    return {name:effect,detail:""};
  }

  if(typeof effect==="object"){
    return {
      name:String(effect.name || effect.label || effect.id || "Effect"),
      detail:String(
        effect.detail ||
        effect.description ||
        effect.durationLabel ||
        ""
      )
    };
  }

  return {name:String(effect),detail:""};
}

function renderUnitStatusEffects(unit){
  const buffs=(Array.isArray(unit?.buffs) ? unit.buffs : [])
    .map(normalizeUnitEffect)
    .filter(Boolean);

  const debuffs=(Array.isArray(unit?.debuffs) ? unit.debuffs : [])
    .map(normalizeUnitEffect)
    .filter(Boolean);

  const entries=[
    ...buffs.map(effect=>({kind:"buff",...effect})),
    ...debuffs.map(effect=>({kind:"debuff",...effect}))
  ];

  if(!entries.length){
    ui.unitInfoEffects.innerHTML="";
    ui.unitInfoEffects.hidden=true;
    return;
  }

  /*
    No visible "Buff" or "Debuff" category labels.
    The positive/negative styling identifies the effect type.
  */
  ui.unitInfoEffects.innerHTML=entries.map(effect=>
    `<div class="unit-effect ${effect.kind}">`+
      `<div>${effect.name}</div>`+
      `${effect.detail ? `<div>${effect.detail}</div>` : ""}`+
    `</div>`
  ).join("");

  ui.unitInfoEffects.hidden=false;
}


function unitHpDisplay(unit){
  if(!unit) return "—";

  const current=Number(unit.hp ?? 0);
  const maximum=Number(unit.maxHp ?? current);

  if(current<maximum){
    return `<span class="hp-current-damaged">${current}</span>/${maximum}`;
  }

  return `${current}/${maximum}`;
}

function updateUnitInfoPanel(){
  if(!game) return;

  let inspected=aimMode
    ? unitAtHex(aimCursor.x,aimCursor.y)
    : activeUnit();

  /* R132: aiming over darkness must not reveal a hidden enemy in the info panel. */
  if(
    aimMode &&
    inspected &&
    !isFriendlyCombatUnit(inspected) &&
    !isUnitVisibleToFriendlyParty(inspected)
  ){
    inspected=null;
  }

  /* Preserve the last valid unit display during initiative gaps/empty AIM hexes. */
  if(!inspected){
    return;
  }

  ui.unitInfoMode.textContent=aimMode
    ? (
        pendingAimAction
          ? `${getSpellEntry(pendingAimAction.spellId)?.name || "TARGET ACTION"}`
          : "INSPECT / TARGET"
      )
    : "";

  ui.unitInfoRows.innerHTML="";
  ui.unitInfoEffects.innerHTML="";
  ui.unitInfoEffects.hidden=true;

  /* Compact combat panel intentionally omits ability scores. */
  ui.unitInfoAbilities.innerHTML="";
  ui.unitInfoAbilities.hidden=true;

  ui.unitInfoName.textContent=inspected.name;

  const facingText=tacticalFacingLabel(inspected);
  const aimingUnit=activePlayerControlledUnit();
  const aimedAttackSector=
    aimMode && aimingUnit?.alive && inspected.id!==aimingUnit.id
      ? attackPositionData(aimingUnit,inspected).label
      : null;

  if(inspected.id==="player"){
    const moveText=inspected.fullMove
      ? `${inspected.move} FULL`
      : `${inspected.halfMove} + ATTACK`;

    ui.unitInfoRows.innerHTML=
      `<span>Class</span><span>Fighter ${inspected.level}</span>`+
      `<span>Facing</span><span>${facingText}</span>`+
      `<span>HP</span><span>${unitHpDisplay(inspected)}</span>`+
      `<span>AC</span><span>${inspected.ac}</span>`+
      `<span>THAC0</span><span>${inspected.thaco}</span>`+
      `<span>Attacks</span><span>${inspected.attacksRemaining}/${inspected.attacksThisRound} (${inspected.attacksLabel})</span>`+
      `<span>Move</span><span>${moveText}</span>`+
      `<span>Weapon</span><span>${inspected.weapon}</span>`+
      `<span>Proficient</span><span>${inspected.proficientWeapons.join(", ")}</span>`;
  }else if(inspected.type==="mage"){
    const slotText=(inspected.spellSlots || []).
      map((count,index)=>count ? `${index+1}:${count}` : null).
      filter(Boolean).
      join(" ");
    ui.unitInfoRows.innerHTML=
      `<span>Race / Sex</span><span>${inspected.race} / ${inspected.sex}</span>`+
      `<span>Class</span><span>Mage ${inspected.level}</span>`+
      `<span>Facing</span><span>${facingText}</span>`+
      `${aimedAttackSector ? `<span>Your Attack Sector</span><span>${aimedAttackSector}</span>` : ""}`+
      `<span>Controller</span><span>${isPlayerControlledUnit(inspected) ? "Player Controlled" : "Player-Controlled Mage"}</span>`+
      `<span>HP</span><span>${unitHpDisplay(inspected)}</span>`+
      `<span>AC</span><span>${inspected.ac}</span>`+
      `<span>THAC0</span><span>${inspected.thaco}</span>`+
      `<span>Move</span><span>${inspected.move}</span>`+
      `<span>INT</span><span>${inspected.stats?.int ?? "—"}</span>`+
      `<span>Max Spell Level</span><span>${inspected.maxSpellLevel}</span>`+
      `<span>Known / Memorized</span><span>${inspected.knownSpellIds?.length || 0} / ${inspected.memorizedSpellIds?.length || 0}</span>`+
      `<span>Spell Slots</span><span>${slotText || "—"}</span>`+
      `<span>Armor</span><span>None</span>`+
      `<span>Weapon</span><span>${inspected.weapon}</span>`;
  }else if(inspected.controller==="npc"){
    ui.unitInfoRows.innerHTML=
      `<span>Race / Sex</span><span>${inspected.race} / ${inspected.sex}</span>`+
      `<span>Class</span><span>${inspected.className} ${inspected.level}</span>`+
      `<span>Facing</span><span>${facingText}</span>`+
      `${aimedAttackSector ? `<span>Your Attack Sector</span><span>${aimedAttackSector}</span>` : ""}`+
      `<span>Controller</span><span>Friendly NPC</span>`+
      `<span>HP</span><span>${unitHpDisplay(inspected)}</span>`+
      `<span>AC</span><span>${inspected.ac}</span>`+
      `<span>THAC0</span><span>${inspected.thaco}</span>`+
      `<span>Move</span><span>${inspected.move}</span>`+
      `<span>Armor</span><span>Chain Mail</span>`+
      `<span>Ranged</span><span>Longbow</span>`+
      `<span>Backup</span><span>Short Sword</span>`+
      `<span>Rate of Fire</span><span>${inspected.missileRateOfFire}/round</span>`;
  }else{
    ui.unitInfoRows.innerHTML=
      `<span>Type</span><span>${inspected.name}</span>`+
      `<span>Facing</span><span>${facingText}</span>`+
      `${aimedAttackSector ? `<span>Your Attack Sector</span><span>${aimedAttackSector}</span>` : ""}`+
      `<span>Controller</span><span>MOB</span>`+
      `<span>Footprint</span><span>${unitFootprintCellCount(inspected)} hex${unitFootprintCellCount(inspected)===1 ? "" : "es"}</span>`+
      `<span>HD</span><span>${inspected.hitDiceLabel || "—"}</span>`+
      `<span>HP</span><span>${unitHpDisplay(inspected)}</span>`+
      `<span>AC</span><span>${inspected.ac}</span>`+
      `<span>THAC0</span><span>${inspected.thaco}</span>`+
      `<span>Move</span><span>${inspected.move}</span>`+
      `<span>Melee</span><span>${inspected.weapon ? `${inspected.weapon} ${inspected.weaponDamageSM || "—"} vs S/M` : "None"}</span>`+
      `<span>Ranged</span><span>${inspected.rangedWeapon || "None"}</span>`+
      `${inspected.missileAmmoCatalogId ? `<span>Ammo</span><span>${inspected.missileAmmoName || inspected.missileAmmoCatalogId}: ${inspected.missileAmmoQuantity ?? "—"}</span>` : ""}`+
      (
        isKoboldUnit(inspected)
          ? `<span>Group Morale</span><span>${game.enemyGroupMorale?.moraleLabel || inspected.moraleLabel || "Average (8-10)"} — target ${game.enemyGroupMorale?.baseMorale ?? inspected.morale}${game.enemyGroupMorale?.broken ? " — BROKEN" : ""}</span>`
          : `<span>Morale</span><span>${inspected.moraleLabel || inspected.morale || "—"}</span>`
      );

    if(inspected.type==="juvenile-red-dragon"){
      const breathState=dragonBreathReady(inspected)
        ? "READY"
        : "Recharging — last used round "+inspected.breathWeapon.lastUsedRound;

      ui.unitInfoRows.innerHTML+=
        "<span>Routine</span><span>Claw 1d10+4 / Claw 1d10+4 / Bite 3d10+4</span>"+
        "<span>Breath</span><span>90' cone — 8d10+4 fire — save vs Breath for half</span>"+
        "<span>Breath Cycle</span><span>Once every 3 rounds — "+breathState+"</span>"+
        "<span>Defense</span><span>Immune to fire; MR Nil</span>"+
        "<span>Innate</span><span>Affect Normal Fires 3/day; Pyrotechnics 3/day</span>"+
        "<span>Flight</span><span>30 (C); Jump 3</span>";
    }
  }

  renderUnitStatusEffects(inspected);
}

function renderClassReport(){
  const fighter=game?.player || persistentFighter;
  if(!fighter) return;

  const summary=document.getElementById("classSummary");
  const body=document.getElementById("classTableBody");

  const nextXp=fighterNextLevelXp(fighter.level);
  const saves=fighter.saves || warriorSavingThrows(fighter.level);

  summary.innerHTML=
    `<div><b>Rule Group</b><br><span>Fighter Class Rules</span></div>`+
    `<div><b>Rules</b><br><span>${RULESET.name}</span></div>`+
    `<div><b>Class Group</b><br><span>${FIGHTER_CLASS.group}</span></div>`+
    `<div><b>Requirement</b><br><span>STR ${FIGHTER_CLASS.minimumStrength} minimum</span></div>`+
    `<div><b>Prime Requisite</b><br><span>${FIGHTER_CLASS.primeRequisite}${fighter.primeRequisiteXpBonus ? " (+10% XP)" : ""}</span></div>`+

    `<div><b>Current</b><br><span>Fighter ${fighter.level} (${fighter.title})</span></div>`+
    `<div><b>XP</b><br><span>${fighter.xp}${nextXp!==null ? ` / ${nextXp}` : " / MAX"}</span></div>`+
    `<div><b>HP / THAC0</b><br><span>${fighter.maxHp} / ${fighter.thaco}</span></div>`+
    `<div><b>Attacks</b><br><span>${fighter.attacksLabel}</span></div>`+

    `<div><b>Hit Die</b><br><span>d${FIGHTER_CLASS.hitDie}; through level ${FIGHTER_CLASS.hitDiceThroughLevel}</span></div>`+
    `<div><b>Post-HD HP</b><br><span>+${FIGHTER_CLASS.hpPerLevelAfterHitDice} HP/level</span></div>`+
    `<div><b>Weapon Slots</b><br><span>${fighter.weaponProficiencySlots}; nonprof ${fighter.weaponNonproficiencyPenalty}</span></div>`+
    `<div><b>NWP Slots</b><br><span>${fighter.nonweaponProficiencySlots} base class slots</span></div>`+

    `<div><b>Armor / Shields</b><br><span>${fighter.allowedArmor}; ${fighter.allowedShields}</span></div>`+
    `<div><b>Weapons</b><br><span>${fighter.allowedWeapons}</span></div>`+
    `<div><b>Specialization</b><br><span>${fighter.canWeaponSpecialize ? "Eligible" : "No"}; current: ${fighter.specializedWeapon || "none"}</span></div>`+
    `<div><b>Sweep</b><br><span>Automatic; ${FIGHTER_CLASS.sweepAttackRule}; targets ${FIGHTER_CLASS.sweepTargetRule}; ${FIGHTER_CLASS.sweepWeaponRule}</span></div>`+
    `<div><b>Followers</b><br><span>${fighter.followerEligible ? "Eligible if stronghold established" : "Not yet eligible"}</span></div>`+

    `<div><b>Strength</b><br><span>${formatStrengthValue(fighter)}</span></div>`+
    `<div><b>Saves</b><br><span>D${saves.death} W${saves.wand} P${saves.poly} B${saves.breath} S${saves.spell}</span></div>`+
    `<div><b>Current Weapon</b><br><span>${fighter.weapon} (${(fighter.weaponAttackTypes || []).join("/") || "no B/P/S type"})</span></div>`+
    `<div><b>Weapon Training</b><br><span>${fighter.proficientWeapons.join(", ")} proficient; ${fighter.specializedWeapon ? fighter.specializedWeapon+" specialized" : "not specialized"}</span></div>`

  body.innerHTML="";

  for(const row of FIGHTER_LEVELS){
    const tr=document.createElement("tr");

    if(row.level===fighter.level){
      tr.classList.add("current-level");
    }else if(row.level<fighter.level){
      tr.classList.add("reached-level");
    }

    tr.innerHTML=
      `<td>${row.level}</td>`+
      `<td>${row.xp.toLocaleString()}</td>`+
      `<td>${row.thaco}</td>`+
      `<td>${row.hd}</td>`+
      `<td>${row.attacks}</td>`+
      `<td>${row.wp}</td>`+
      `<td>${row.nwp}</td>`+
      `<td>${row.gain}</td>`;

    body.appendChild(tr);
  }
}

function openClassReport(){
  if(!game?.player) return;

  exitAimMode(false);
  closeCharacterSheet();
  classReportOpen=true;
  renderClassReport();

  document.getElementById("classOverlay").classList.add("show");
}

function closeClassReport(){
  classReportOpen=false;
  document.getElementById("classOverlay").classList.remove("show");
}




function renderSpellCastList(){
  const list=document.getElementById("spellCastList");
  const subtitle=document.getElementById("spellCastSubtitle");
  if(!list) return;

  const caster=activePlayerControlledUnit() || game?.player;
  const mageMode=isMageCharacter(caster);
  let spells=[];

  if(mageMode){
    const counts=new Map();
    for(const spellId of caster.memorizedSpellIds || []){
      counts.set(spellId,(counts.get(spellId)||0)+1);
    }

    spells=[...counts.keys()]
      .map(id=>getSpellEntry(id))
      .filter(spell=>spell?.combatImplemented)
      .sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name));

    if(subtitle){
      subtitle.textContent=`Mage ${caster.level} — memorized spells only. Casting consumes one memorized copy.`;
    }

    if(!spells.length){
      list.innerHTML=`<div class="sheet-item"><b>No combat-ready spells memorized.</b><span>Study from the Mage's spell book before combat.</span></div>`;
      return;
    }

    list.innerHTML=spells.map(spell=>
      `<button class="spell-cast-choice" data-cast-spell="${spell.id}" type="button">`+
        `<b>${spell.name} ×${counts.get(spell.id)}</b>`+
        `<span>Wizard ${spell.level} — ${spell.school}</span>`+
        `<span>${formatSpellRange(spell)} — ${spellDamageSummary(spell)}</span>`+
      `</button>`
    ).join("");
    return;
  }

  if(subtitle){
    subtitle.textContent=`Combat-test harness — caster level ${TEST_SPELL_CASTER_LEVEL}. This does not grant Dungeon Crawler Carl wizard class abilities.`;
  }

  spells=Object.values(SPELL_CATALOG)
    .filter(spell=>spell.combatImplemented)
    .sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name));

  list.innerHTML=spells.map(spell=>
    `<button class="spell-cast-choice" data-cast-spell="${spell.id}" type="button">`+
      `<b>${spell.name}</b>`+
      `<span>Wizard ${spell.level} — ${spell.school}</span>`+
      `<span>${formatSpellRange(spell)} — ${spellDamageSummary(spell)}</span>`+
    `</button>`
  ).join("");
}

function openSpellCastOverlay(){
  if(
    !game ||
    game.over ||
    game.round===0 ||
    !activePlayerControlledUnit() ||
    spellCastInProgress ||
    isCombatActionPauseActive()
  ){
    return;
  }

  exitAimMode(false,true);
  closeCharacterSheet();

  spellCastOverlayOpen=true;
  renderSpellCastList();
  document.getElementById("spellCastOverlay").classList.add("show");
  updateUi();
}

function closeSpellCastOverlay(){
  spellCastOverlayOpen=false;
  document.getElementById("spellCastOverlay")?.classList.remove("show");
  updateUi();
}

function syncFighterEquipment(fighter){
  if(!fighter) return;

  const inventory=Array.isArray(fighter.inventory) ? fighter.inventory : [];
  const weaponItem=inventory.find(item=>item.slot==="weapon" && item.equipped);

  if(weaponItem){
    const baseWeapon=getWeaponCatalogEntry(weaponItem.catalogWeaponId);

    fighter.weapon=weaponItem.name;
    fighter.weaponBaseName=weaponItem.baseName || baseWeapon?.name || weaponItem.name;
    fighter.weaponCatalogId=weaponItem.catalogWeaponId || null;
    fighter.weaponAttackTypes=[
      ...(baseWeapon?.attackTypes || weaponItem.attackTypes || [])
    ];
    fighter.weaponDamageSM=baseWeapon?.damageSM || weaponItem.damageSM || "1d2";
    fighter.weaponDamageL=baseWeapon?.damageL || weaponItem.damageL || fighter.weaponDamageSM;
    fighter.weaponEncumbrance=baseWeapon?.encumbrance ?? weaponItem.encumbrance ?? 0;
    fighter.weaponHitBonus=weaponItem.magicHitBonus ?? weaponItem.hitBonus ?? 0;
    fighter.weaponDamageBonus=weaponItem.magicDamageBonus ?? weaponItem.damageBonus ?? 0;
    fighter.bonusDamageExpression=weaponItem.bonusDamageExpression || null;
    fighter.bonusDamageType=weaponItem.bonusDamageType || null;
  }else{
    fighter.weapon="Unarmed";
    fighter.weaponBaseName="Unarmed";
    fighter.weaponCatalogId=null;
    fighter.weaponAttackTypes=[];
    fighter.weaponDamageSM="1d2";
    fighter.weaponDamageL="1d2";
    fighter.weaponEncumbrance=0;
    fighter.weaponHitBonus=0;
    fighter.weaponDamageBonus=0;
    fighter.bonusDamageExpression=null;
    fighter.bonusDamageType=null;
  }

  const armorItem=inventory.find(item=>item.slot==="armor" && item.equipped);
  const armor=getArmorCatalogEntry(armorItem?.catalogArmorId) || armorItem || null;

  fighter.move=
    Number.isFinite(armor?.maxMoveFt)
      ? Math.max(1,Math.round(armor.maxMoveFt/10))
      : FIGHTER_CLASS.baseMovement;

  fighter.halfMove=Math.floor(fighter.move/2);
  fighter.ac=calculateArmorClass(fighter);
}

function toggleInventoryEquip(index){
  const fighter=game?.player || persistentFighter;
  if(!fighter || !Array.isArray(fighter.inventory)) return;

  const item=fighter.inventory[index];
  if(!item || !item.equippable) return;

  if(item.equipped){
    item.equipped=false;
  }else{
    if(item.slot){
      for(const other of fighter.inventory){
        if(other!==item && other.slot===item.slot){
          other.equipped=false;
        }
      }
    }
    item.equipped=true;
  }

  syncFighterEquipment(fighter);
  applyFighterClassRules(fighter);

  if(game?.player===fighter){
    updateUi();
    draw();
  }else{
    renderCharacterSheet();
  }
}

function renderInventoryHtml(fighter){
  const inventory=fighter.inventory || [];

  if(!inventory.length){
    return `<div class="sheet-item"><b>Empty</b><span>—</span></div>`;
  }

  const canUseCombatItem=
    !!game &&
    !game.over &&
    game.round>0 &&
    game.active==="player" &&
    game.player?.alive &&
    !isCombatActionPauseActive();

  return inventory.map((item,index)=>
    `<div class="sheet-item">`+
      `<b>${item.name}</b>`+
      `<span>${item.equipped ? "Equipped" : item.type}${item.qty>1 ? ` ×${item.qty}` : ""}</span>`+
      `<div class="actions">`+
        `${item.equippable ? `<button class="equip-button ${item.equipped ? "equipped" : ""}" data-equip-index="${index}" type="button">${item.equipped ? "UNEQUIP" : "EQUIP"}</button>` : ""}`+
        `${item.usable ? `<button class="equip-button" data-use-index="${index}" type="button" ${canUseCombatItem ? "" : "disabled"}>${item.useLabel || "USE"}</button>` : ""}`+
      `</div>`+
      `<div class="detail">${item.type}${item.detail ? ` — ${item.detail}` : ""}</div>`+
    `</div>`
  ).join("");
}

function renderMageMagicHtml(mage){
  mageEnsureSpellState(mage);
  const known=(mage.knownSpellIds || [])
    .map(id=>getSpellEntry(id))
    .filter(Boolean)
    .sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name));

  const memorizedCounts=new Map();
  for(const id of mage.memorizedSpellIds || []){
    memorizedCounts.set(id,(memorizedCounts.get(id)||0)+1);
  }

  const slots=mageBaseSpellSlots(mage);
  const used=slots.map((_,index)=>mageMemorizedCountAtLevel(mage,index+1));
  const slotText=slots
    .map((total,index)=>total ? `L${index+1}: ${used[index]}/${total}` : null)
    .filter(Boolean)
    .join(" · ") || "No spell slots";

  return (
    `<div class="sheet-item">`+
      `<b>Mage Spell Book</b>`+
      `<span>${known.length} known · ${mage.memorizedSpellIds.length} memorized</span>`+
      `<div class="detail">${slotText}; maximum spell level ${mageMaximumSpellLevel(mage)}; learn chance ${mageIntelligenceData(mage.stats?.int).chanceToLearn}%.</div>`+
    `</div>`+
    known.map(spell=>
      `<div class="sheet-item">`+
        `<b>${spell.name}</b>`+
        `<span>Wizard ${spell.level} — memorized ×${memorizedCounts.get(spell.id)||0}</span>`+
        `<div class="detail">${spell.school}; ${formatSpellRange(spell)}; ${spellDamageSummary(spell)}</div>`+
      `</div>`
    ).join("")
  );
}

function renderMagicHtml(fighter){
  if(isMageCharacter(fighter)){
    return renderMageMagicHtml(fighter);
  }

  const spells=Object.values(SPELL_CATALOG)
    .slice()
    .sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name));

  return (
    `<div class="sheet-item">`+
      `<b>Spell System</b>`+
      `<span>${spells.length} entries</span>`+
      `<div class="detail">Carl has no memorized spells. Spell items may invoke catalog spells.</div>`+
    `</div>`+
    spells.map(spell=>
      `<div class="sheet-item">`+
        `<b>${spell.name}</b>`+
        `<span>Wizard ${spell.level} — ${spell.school}</span>`+
        `<div class="detail">Range ${formatSpellRange(spell)}; `+
        `${spell.components.join(", ")}; ${spell.duration}; casting time ${spell.castingTime}; `+
        `${spell.areaOfEffect}; save ${spell.savingThrow}; ${spellDamageSummary(spell)}</div>`+
      `</div>`
    ).join("")
  );
}

function renderCharacterSheet(){
  const subject=activePlayerControlledUnit() || game?.player || persistentFighter;
  if(!subject) return;

  const subtitle=document.getElementById("sheetSubtitle");
  if(subtitle) subtitle.textContent=`Adventure Party — AD&D 2nd Edition ${subject.className || "Character"}`;

  if(isMageCharacter(subject)){
    const mage=subject;
    const saves=mage.saves || mageSavingThrows(mage.level);
    const slots=(mage.spellSlots || []).map((count,index)=>count ? `${index+1}:${count}` : null).filter(Boolean).join(" ");
    const nextRow=MAGE_LEVELS.find(row=>row.level===mage.level+1);

    document.getElementById("sheetIdentity").innerHTML=
      `<span>Name</span><span>${mage.name}</span>`+
      `<span>Class</span><span>Mage ${mage.level}</span>`+
      `<span>Group</span><span>${mage.classGroup}</span>`+
      `<span>Race</span><span>${mage.race}</span>`+
      `<span>Alignment</span><span>${alignmentDisplayName(mage.alignment)}</span>`+
      `<span>Rules</span><span>${mage.ruleset}</span>`+
      `<span>XP</span><span>${mage.xp}${nextRow ? ` / ${nextRow.xp}` : " / MAX"}</span>`+
      `<span>Prime Requisite</span><span>Intelligence${mage.primeRequisiteXpBonus ? " (+10% XP)" : ""}</span>`;

    document.getElementById("sheetCombat").innerHTML=
      `<span>HP</span><span>${mage.hp}/${mage.maxHp}</span>`+
      `<span>AC</span><span>${mage.ac}</span>`+
      `<span>THAC0</span><span>${mage.thaco}</span>`+
      `<span>Attacks</span><span>${mage.attacksRemaining||1}/${mage.attacksThisRound||1}</span>`+
      `<span>Move</span><span>${mage.move}</span>`+
      `<span>Weapon</span><span>${mage.weapon}</span>`+
      `<span>Damage</span><span>${mage.weaponDamageSM || "1d6"}</span>`+
      `<span>Armor / Shield</span><span>None / None</span>`;

    document.getElementById("sheetAbilities").innerHTML=
      `<span>Strength</span><span>${mage.stats.str}</span>`+
      `<span>Dexterity</span><span>${mage.stats.dex}</span>`+
      `<span>Constitution</span><span>${mage.stats.con}</span>`+
      `<span>Intelligence</span><span>${mage.stats.int}</span>`+
      `<span>Wisdom</span><span>${mage.stats.wis}</span>`+
      `<span>Charisma</span><span>${mage.stats.cha}</span>`;

    document.getElementById("sheetSaves").innerHTML=
      `<span>Paralyzation / Poison / Death</span><span>${saves.death}</span>`+
      `<span>Rod / Staff / Wand</span><span>${saves.wand}</span>`+
      `<span>Petrification / Polymorph</span><span>${saves.poly}</span>`+
      `<span>Breath Weapon</span><span>${saves.breath}</span>`+
      `<span>Spell</span><span>${saves.spell}</span>`;

    document.getElementById("sheetTraining").innerHTML=
      `<div class="sheet-item"><b>Weapon Proficiency Slots</b><span>${mage.weaponProficiencySlots}</span><div class="detail">Allowed: ${mage.allowedWeapons.join(", ")}</div></div>`+
      `<div class="sheet-item"><b>Nonweapon Proficiency Slots</b><span>${mage.nonweaponProficiencySlots}</span></div>`+
      `<div class="sheet-item"><b>Nonproficiency Penalty</b><span>${mage.weaponNonproficiencyPenalty}</span></div>`+
      `<div class="sheet-item"><b>Maximum Spell Level</b><span>${mage.maxSpellLevel}</span><div class="detail">Base slots ${slots || "—"}</div></div>`;

    document.getElementById("sheetInventory").innerHTML=(mage.inventory||[]).map(item=>
      `<div class="sheet-item"><b>${item.name}</b><span>${item.type}${item.qty>1 ? ` ×${item.qty}` : ""}</span><div class="detail">${item.detail || item.role || ""}</div></div>`
    ).join("") || `<div class="sheet-item"><b>Empty</b><span>—</span></div>`;
    document.getElementById("sheetMagic").innerHTML=renderMageMagicHtml(mage);
    document.getElementById("sheetStatus").innerHTML=
      `<span>Current Hex</span><span>${mage.x}, ${mage.y}</span>`+
      `<span>Facing</span><span>${mage.facing}</span>`+
      `<span>Controller</span><span>Player</span>`+
      `<span>Guard</span><span>${mage.guard ? "Active" : "No"}</span>`+
      `<span>Full Move</span><span>${mage.fullMove ? "Yes" : "No"}</span>`+
      `<span>Alive</span><span>${mage.alive ? "Yes" : "No"}</span>`;
    return;
  }

  const fighter=game?.player || persistentFighter;
  if(!fighter) return;
  syncFighterEquipment(fighter);
  const nextXp=fighterNextLevelXp(fighter.level);
  const saves=fighter.saves || warriorSavingThrows(fighter.level);
  const acBreakdown=armorClassBreakdown(fighter);

  document.getElementById("sheetIdentity").innerHTML=
    `<span>Name</span><span>${fighter.name}</span>`+`<span>Class</span><span>${fighter.className} ${fighter.level}</span>`+
    `<span>Group</span><span>${fighter.classGroup}</span>`+`<span>Title</span><span>${fighter.title}</span>`+
    `<span>Alignment</span><span>${alignmentDisplayName(fighter.alignment)}</span>`+
    `<span>Rules</span><span>${fighter.ruleset}</span>`+`<span>XP</span><span>${fighter.xp}${nextXp!==null ? ` / ${nextXp}` : " / MAX"}</span>`+
    `<span>Prime Requisite</span><span>${fighter.primeRequisite}</span>`;
  document.getElementById("sheetCombat").innerHTML=
    `<span>HP</span><span>${fighter.hp}/${fighter.maxHp}</span>`+`<span>AC</span><span>${fighter.ac}</span>`+
    `<span>AC Base</span><span>${acBreakdown.armorBaseAc} (${acBreakdown.armorName})</span>`+
    `<span>DEX Defensive Adj.</span><span>${formatSignedAdjustment(acBreakdown.dexDefensiveAdjustment)}</span>`+
    `<span>DEX Missile Adj.</span><span>${formatSignedAdjustment(acBreakdown.dexMissileAdjustment)}</span>`+
    `<span>DEX Reaction Adj.</span><span>${formatSignedAdjustment(acBreakdown.dexReactionAdjustment)}</span>`+
    `<span>Shield</span><span>${acBreakdown.shieldBonus ? "−"+acBreakdown.shieldBonus+" ("+acBreakdown.shieldName+")" : "None"}</span>`+
    `<span>Other AC</span><span>${acBreakdown.otherBonus ? "−"+acBreakdown.otherBonus : "0"}</span>`+
    `<span>THAC0</span><span>${fighter.thaco}</span>`+`<span>Attacks</span><span>${fighter.attacksLabel}</span>`+
    `<span>Current Attacks</span><span>${fighter.attacksRemaining}/${fighter.attacksThisRound}</span>`+
    `<span>Move</span><span>${fighter.move}</span>`+`<span>Weapon</span><span>${fighter.weapon}</span>`+
    `<span>Base Weapon</span><span>${fighter.weaponBaseName}</span>`+
    `<span>Attack Bonus</span><span>${((fighter.attackBonus||0)+(fighter.weaponHitBonus||0))>=0?"+":""}${(fighter.attackBonus||0)+(fighter.weaponHitBonus||0)}</span>`+
    `<span>Damage vs S/M</span><span>${fighter.weaponDamageSM}</span>`+`<span>Damage vs Large</span><span>${fighter.weaponDamageL}</span>`;
  document.getElementById("sheetAbilities").innerHTML=
    `<span>Strength</span><span>${formatStrengthValue(fighter)}</span>`+`<span>Dexterity</span><span>${fighter.stats.dex}</span>`+
    `<span>Constitution</span><span>${fighter.stats.con}</span>`+`<span>Intelligence</span><span>${fighter.stats.int}</span>`+
    `<span>Wisdom</span><span>${fighter.stats.wis}</span>`+`<span>Charisma</span><span>${fighter.stats.cha}</span>`;
  document.getElementById("sheetSaves").innerHTML=
    `<span>Paralyzation / Poison / Death</span><span>${saves.death}</span>`+`<span>Rod / Staff / Wand</span><span>${saves.wand}</span>`+
    `<span>Petrification / Polymorph</span><span>${saves.poly}</span>`+`<span>Breath Weapon</span><span>${saves.breath}</span>`+
    `<span>Spell</span><span>${saves.spell}</span>`;
  document.getElementById("sheetTraining").innerHTML=
    `<div class="sheet-item"><b>Weapon Proficiency Slots</b><span>${fighter.weaponProficiencySlots}</span><div class="detail">Proficient: ${fighter.proficientWeapons.join(", ") || "None"}</div></div>`+
    `<div class="sheet-item"><b>Weapon Specialization</b><span>${fighter.specializedWeapon || "None selected"}</span></div>`+
    `<div class="sheet-item"><b>Nonweapon Proficiency Slots</b><span>${fighter.nonweaponProficiencySlots}</span></div>`+
    `<div class="sheet-item"><b>Nonproficiency Penalty</b><span>${fighter.weaponNonproficiencyPenalty}</span></div>`;
  document.getElementById("sheetInventory").innerHTML=renderInventoryHtml(fighter);
  document.getElementById("sheetMagic").innerHTML=renderMagicHtml(fighter);
  document.getElementById("sheetStatus").innerHTML=
    `<span>Current Hex</span><span>${fighter.x}, ${fighter.y}</span>`+`<span>Facing</span><span>${fighter.facing}</span>`+
    `<span>Guard</span><span>${fighter.guard ? "Active" : "No"}</span>`+`<span>Sweep Used</span><span>${fighter.sweepUsedThisRound ? "Yes" : "No"}</span>`+
    `<span>Full Move</span><span>${fighter.fullMove ? "Yes" : "No"}</span>`+`<span>Alive</span><span>${fighter.alive ? "Yes" : "No"}</span>`;
}

function openCharacterSheet(){
  if(!game?.player) return;

  exitAimMode(false);
  closeClassReport();

  characterSheetOpen=true;
  renderCharacterSheet();

  document.getElementById("sheetOverlay").classList.add("show");
  updateUi();
}

function closeCharacterSheet(){
  characterSheetOpen=false;
  document.getElementById("sheetOverlay").classList.remove("show");
  updateUi();
}

function updateUi(){
  if(!game) return;

  updateUnitInfoPanel();

  const movementCommand=document.getElementById("movementCommand");
  const aimButton=document.getElementById("aimButton");
  const aimCenterButton=document.getElementById("aimCenterButton");
  const waitButton=document.getElementById("waitButton");
  const guardButton=document.getElementById("guardButton");
  const quickButton=document.getElementById("quickButton");
  const castButton=document.getElementById("castButton");
  const sheetButton=document.getElementById("sheetButton");
  const doneButton=document.getElementById("doneButton");
  const returnButton=document.getElementById("returnButton");

  if(sheetButton){
    sheetButton.classList.toggle("active",characterSheetOpen);
  }

  if(characterSheetOpen){
    renderCharacterSheet();
  }

  const preCombatLocked=
    game.round===0 &&
    (
      !combatOpeningSpeechDone ||
      combatAwaitingStart
    );

  const activePc=activePlayerControlledUnit();

  const playerCanAct=
    !game.over && !preCombatLocked && !isCombatActionPauseActive() &&
    !freeStrikeInProgress && !!activePc && game.active===activePc.id;

  const spellTargeting=isSpellTargetingMode();
  const aimOnly=aimMode && !spellTargeting;

  if(movementCommand){
    movementCommand.hidden=spellTargeting || aimOnly;
  }

  if(aimButton){
    aimButton.hidden=spellTargeting || aimOnly;
    aimButton.classList.toggle("active",aimMode);
    aimButton.disabled=!playerCanAct || spellCastInProgress;
  }

  if(aimCenterButton){
    aimCenterButton.hidden=!aimMode;
    aimCenterButton.disabled=!aimMode || game.over;
    aimCenterButton.innerHTML='<span class="shortcut-key">C</span>ENTER';
    aimCenterButton.setAttribute(
      "aria-label",
      spellTargeting
        ? "Center camera on spell target, shortcut C"
        : "Center camera on current aim hex, shortcut C"
    );
  }

  if(waitButton){
    waitButton.hidden=spellTargeting || aimOnly;
    waitButton.disabled=!playerCanAct;
  }

  if(guardButton){
    guardButton.hidden=spellTargeting || aimOnly;
    guardButton.disabled=!playerCanAct;
    guardButton.classList.toggle("active",!!activePc?.guard);
  }

  if(quickButton){
    quickButton.hidden=spellTargeting || aimOnly;
    quickButton.classList.toggle(
      "active",
      isQuickCommandUnit(activePc)
    );
    quickButton.disabled=!playerCanAct || spellCastInProgress;
  }

  if(castButton){
    castButton.hidden=aimOnly;
    castButton.classList.toggle("active",spellCastOverlayOpen || spellTargeting);
    castButton.disabled=!playerCanAct || spellCastInProgress;
    castButton.innerHTML=spellTargeting
      ? 'CA<span class="shortcut-key">S</span>T'
      : 'CAST';
    castButton.setAttribute(
      "aria-label",
      spellTargeting ? "Cast spell at current target, shortcut S" : "Cast spell"
    );
  }

  if(sheetButton){
    sheetButton.hidden=spellTargeting || aimOnly;
  }

  if(doneButton){
    doneButton.hidden=spellTargeting || aimOnly;
    doneButton.disabled=
      game.over ||
      (
        !preCombatLocked &&
        !playerCanAct
      );

    doneButton.classList.toggle(
      "active",
      game.round===0 &&
      combatOpeningSpeechDone &&
      combatAwaitingStart
    );
  }


  if(returnButton){
    const anyQuick=quickCommandUnitIds.size>0;
    returnButton.innerHTML=anyQuick
      ? 'Hit &lt;ESC&gt; to cancel Quick'
      : spellTargeting
        ? 'ESC — ABORT SPELL CASTING'
        : (aimOnly ? 'ESC — ABORT AIM' : 'ESC — RETURN TO LAUNCHER');
    returnButton.setAttribute(
      "aria-label",
      anyQuick
        ? "Hit Escape to cancel Quick for all player-controlled characters"
        : spellTargeting
          ? "Escape to abort spell casting"
          : (aimOnly ? "Escape to abort Aim" : "Escape to return to launcher")
    );
  }

}

function polygonPath(points){
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);

  for(let i=1;i<points.length;i++){
    ctx.lineTo(points[i].x,points[i].y);
  }

  ctx.closePath();
}

function terrainColor(x,y){
  const h=terrainHash(x,y);
  const value=h%9;

  switch(value){
    case 0:return "#7fcc31";
    case 1:return "#73c52c";
    case 2:return "#88d539";
    case 3:return "#6fbe2a";
    case 4:return "#95dd43";
    case 5:return "#67b227";
    case 6:return "#7bc933";
    case 7:return "#8cd93c";
    default:return "#75c82f";
  }
}

function polygonPath(points){
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);

  for(let i=1;i<points.length;i++){
    ctx.lineTo(points[i].x,points[i].y);
  }

  ctx.closePath();
}

function terrainHash(x,y){
  /* Coordinate hash works for negative coordinates too. */
  const n=Math.abs(
    Math.imul(x,73856093) ^
    Math.imul(y,19349663)
  );
  return n>>>0;
}

function terrainColor(x,y){
  const h=terrainHash(x,y);
  const value=h%8;

  switch(value){
    case 0:return "#6eb946";
    case 1:return "#74be49";
    case 2:return "#7ac44d";
    case 3:return "#69b041";
    case 4:return "#80c954";
    case 5:return "#72b84a";
    case 6:return "#85ce57";
    default:return "#67ad40";
  }
}

function terrainRand(x,y,salt){
  const n=terrainHash(
    x + salt*17,
    y - salt*23
  );
  return (n % 10000) / 10000;
}

function drawGrassDetails(x,y){
  const top=hexScreenVertices(x,y);
  const c=hexCenter(x,y);

  ctx.save();
  polygonPath(top);
  ctx.clip();

  const greens=[
    "#8fd45e",
    "#83cd54",
    "#7cc74f",
    "#75c149",
    "#6db743",
    "#64ac3d",
    "#5ea438"
  ];

  const khaki=[
    "#bba66a",
    "#c4b375",
    "#a8945f",
    "#d1bf82"
  ];

  /* Dense micro-cells across nearly the whole hex so the grass fully fills the tile. */
  const minX=Math.floor(c.x-28);
  const maxX=Math.floor(c.x+28);
  const minY=Math.floor(c.y-18);
  const maxY=Math.floor(c.y+18);

  for(let yy=minY; yy<=maxY; yy+=4){
    for(let xx=minX; xx<=maxX; xx+=4){
      const gx=Math.floor((xx-c.x+40)/4);
      const gy=Math.floor((yy-c.y+40)/4);
      const salt=600 + gx*31 + gy*47;

      const shade=greens[
        Math.floor(terrainRand(x,y,salt)*greens.length) % greens.length
      ];

      ctx.fillStyle=shade;
      ctx.fillRect(
        xx + Math.floor((terrainRand(x,y,salt+1)-0.5)*2),
        yy + Math.floor((terrainRand(x,y,salt+2)-0.5)*2),
        4 + Math.floor(terrainRand(x,y,salt+3)*2),
        4 + Math.floor(terrainRand(x,y,salt+4)*2)
      );

      if(terrainRand(x,y,salt+5)>0.72){
        ctx.fillStyle=greens[
          (Math.floor(terrainRand(x,y,salt+6)*greens.length)+2) % greens.length
        ];
        ctx.fillRect(
          xx + 1 + Math.floor((terrainRand(x,y,salt+7)-0.5)*2),
          yy + 1 + Math.floor((terrainRand(x,y,salt+8)-0.5)*2),
          2 + Math.floor(terrainRand(x,y,salt+9)*2),
          2 + Math.floor(terrainRand(x,y,salt+10)*2)
        );
      }
    }
  }

  /* Mottled green / dry-grass patches inspired by the first two reference hexes. */
  const patches=9 + (terrainHash(x,y)%5);
  for(let i=0;i<patches;i++){
    const salt=900+i*17;
    const useKhaki=terrainRand(x,y,salt)>0.68;
    ctx.fillStyle = useKhaki
      ? khaki[Math.floor(terrainRand(x,y,salt+1)*khaki.length) % khaki.length]
      : greens[Math.floor(terrainRand(x,y,salt+2)*greens.length) % greens.length];

    ctx.beginPath();
    ctx.ellipse(
      c.x - 20 + terrainRand(x,y,salt+3)*40,
      c.y - 13 + terrainRand(x,y,salt+4)*26,
      4 + terrainRand(x,y,salt+5)*10,
      3 + terrainRand(x,y,salt+6)*7,
      terrainRand(x,y,salt+7)*Math.PI,
      0,Math.PI*2
    );
    ctx.fill();
  }

  /* Extra brighter / darker clustered dabs to keep the hex lively without
     leaving empty-feeling areas. */
  const clumps=6 + Math.floor(terrainRand(x,y,1200)*5);
  for(let i=0;i<clumps;i++){
    const salt=1220+i*13;
    const dark = terrainRand(x,y,salt) > 0.55;
    ctx.fillStyle = dark ? "rgba(58,125,41,0.55)" : "rgba(178,227,103,0.45)";

    const rx = Math.floor(c.x - 20 + terrainRand(x,y,salt+1)*40);
    const ry = Math.floor(c.y - 13 + terrainRand(x,y,salt+2)*26);
    const blocks = 3 + Math.floor(terrainRand(x,y,salt+3)*4);

    for(let b=0;b<blocks;b++){
      ctx.fillRect(
        rx + Math.floor(terrainRand(x,y,salt+20+b)*7),
        ry + Math.floor(terrainRand(x,y,salt+40+b)*7),
        3,3
      );
    }
  }

  /* Soft highlight/shadow keeps the tile dimensional while preserving full coverage. */
  ctx.fillStyle=`rgba(255,248,190,${0.05 + terrainRand(x,y,1500)*0.04})`;
  ctx.beginPath();
  ctx.ellipse(
    c.x - 7 + terrainRand(x,y,1501)*10,
    c.y - 6 + terrainRand(x,y,1502)*8,
    16 + terrainRand(x,y,1503)*10,
    8 + terrainRand(x,y,1504)*6,
    terrainRand(x,y,1505)*Math.PI,
    0,Math.PI*2
  );
  ctx.fill();

  ctx.fillStyle=`rgba(38,86,22,${0.05 + terrainRand(x,y,1510)*0.05})`;
  ctx.beginPath();
  ctx.ellipse(
    c.x - 8 + terrainRand(x,y,1511)*16,
    c.y - 2 + terrainRand(x,y,1512)*8,
    12 + terrainRand(x,y,1513)*10,
    6 + terrainRand(x,y,1514)*5,
    terrainRand(x,y,1515)*Math.PI,
    0,Math.PI*2
  );
  ctx.fill();

  ctx.restore();
}

function drawHexFill(x,y){
  const top=hexScreenVertices(x,y);
  const c=hexCenter(x,y);
  const tileSet=activeCombatTerrainTileSet();
  const image=TERRAIN_TILESET_IMAGES.get(tileSet.id);

  ctx.save();
  polygonPath(top);
  ctx.clip();

  /* Safe fallback while a terrain sheet is loading. */
  ctx.fillStyle=tileSet.background || "#4d613e";
  ctx.fillRect(
    c.x-HEX_W/2,
    c.y-HEX_H/2,
    HEX_W,
    HEX_H
  );

  if(
    image?.complete &&
    image.naturalWidth>0
  ){
    const tileIndex=chooseTerrainTileIndex(
      tileSet,
      x,
      y
    );

    const sourceColumn=
      tileIndex % tileSet.columns;

    const sourceRow=
      Math.floor(tileIndex/tileSet.columns);

    const sx=
      sourceColumn*tileSet.sourceTileWidth;

    const sy=
      sourceRow*tileSet.sourceTileHeight;

    /*
      The source sheet uses the same pointy-top hex orientation as
      the battlefield. Scaling to HEX_W/HEX_H intentionally flattens
      it to the game's existing isometric tactical proportions.
    */
    ctx.imageSmoothingEnabled=true;

    ctx.drawImage(
      image,
      sx,
      sy,
      tileSet.sourceTileWidth,
      tileSet.sourceTileHeight,
      c.x-HEX_W/2-0.6,
      c.y-HEX_H/2-0.6,
      HEX_W+1.2,
      HEX_H+1.2
    );
  }

  ctx.restore();
}

function drawHexGridLine(x,y){
  const top=hexScreenVertices(x,y);
  const tileSet=activeCombatTerrainTileSet();
  const outdoorStroke=
    tileSet.gridStroke ||
    "rgba(38,91,42,0.78)";

  polygonPath(top);
  ctx.strokeStyle=outdoorStroke;
  ctx.lineWidth=1.5;
  ctx.stroke();

  if(game?.condition!=="wall" || !architecturalSpaces.length){
    return;
  }

  /*
    R206: only border portions lying over indoor floor are repainted black.
    Outdoor portions remain the terrain's normal green.
  */
  for(const space of architecturalSpaces){
    if(space.environment!=="indoor" || !space.polygon?.length) continue;

    const points=space.polygon.map(point=>screenPointForWorld(point));
    if(points.length<3) continue;

    ctx.save();
    if(tracePolygonOnContext(ctx,points)){
      ctx.clip();
      polygonPath(top);
      ctx.strokeStyle="#050507";
      ctx.lineWidth=1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}


/*
  R189 — MULTI-HEX HOVER FOOTPRINT
  --------------------------------
  Hovering any occupied cell of a visible multi-hex unit highlights its entire
  occupied footprint. Hidden hostile units in the wall/LOS test do not expand
  the hover footprint, preventing hover UI from revealing an unseen creature.
*/
function hoverHighlightCells(){
  if(!hoverHex || aimMode) return [];

  const hoveredUnit=unitAtHex(hoverHex.x,hoverHex.y);
  if(!hoveredUnit || unitFootprintCellCount(hoveredUnit)<=1){
    return [hoverHex];
  }

  if(
    hoveredUnit.controller==="mob" &&
    game?.condition==="wall" &&
    !mobPositionVisibleToFriendlyParty(hoveredUnit)
  ){
    return [hoverHex];
  }

  return occupiedHexes(hoveredUnit)
    .filter(cell=>inside(cell.x,cell.y));
}

function drawFloor(){
  const tileSet=activeCombatTerrainTileSet();

  ctx.fillStyle="#08080c";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const tiles=visibleHexes();

  /* Every visible hex gets a full grass texture fill. */
  for(const tile of tiles){
    drawHexFill(tile.x,tile.y);
  }

  /* Dark green grid lines sit on top, matching the reference treatment. */
  for(const tile of tiles){
    drawHexGridLine(tile.x,tile.y);
  }

  for(const cell of hoverHighlightCells()){
    const top=hexScreenVertices(cell.x,cell.y);

    polygonPath(top);
    ctx.fillStyle="rgba(229,205,131,0.10)";
    ctx.fill();

    ctx.strokeStyle="#d6c56f";
    ctx.lineWidth=1.6;
    ctx.stroke();
  }

  if(aimMode){
    drawAimAreaPreview();

    const top=hexScreenVertices(aimCursor.x,aimCursor.y);

    polygonPath(top);
    ctx.fillStyle="rgba(121,231,231,0.16)";
    ctx.fill();

    ctx.strokeStyle="#fff19a";
    ctx.lineWidth=3;
    ctx.stroke();

    const c=hexCenter(aimCursor.x,aimCursor.y);
    ctx.strokeStyle="#79e7e7";
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.moveTo(c.x-9,c.y);
    ctx.lineTo(c.x+9,c.y);
    ctx.moveTo(c.x,c.y-6);
    ctx.lineTo(c.x,c.y+6);
    ctx.stroke();
  }
}


function visibleHexes(){
  const tiles=[];
  const baseX=Math.floor(camera.x);
  const baseY=Math.floor(camera.y);

  for(let x=baseX-VIEW_RADIUS;x<=baseX+VIEW_RADIUS;x++){
    for(let y=baseY-VIEW_RADIUS;y<=baseY+VIEW_RADIUS;y++){
      const c=hexCenter(x,y);

      if(!inside(x,y)){
        continue;
      }

      if(
        c.x < -HEX_W ||
        c.x > canvas.width+HEX_W ||
        c.y < -HEX_H ||
        c.y > canvas.height+HEX_H
      ){
        continue;
      }

      tiles.push({
        x,
        y,
        sortY:c.y,
        sortX:c.x
      });
    }
  }

  tiles.sort((a,b)=>a.sortY-b.sortY || a.sortX-b.sortX);
  return tiles;
}

function drawFloor(){
  const tileSet=activeCombatTerrainTileSet();

  ctx.fillStyle="#08080c";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const tiles=visibleHexes();

  for(const tile of tiles){
    drawHexFill(tile.x,tile.y);
  }

  /* R123: continuous indoor floors overlay and split the outdoor hex textures. */
  drawArchitecturalFloorRegions();

  /* R195: dynamic light sources brighten terrain before grid/UI overlays. */
  drawTerrainIlluminationLayer(tiles);

  for(const tile of tiles){
    drawHexGridLine(tile.x,tile.y);
  }

  for(const cell of hoverHighlightCells()){
    const top=hexScreenVertices(cell.x,cell.y);

    polygonPath(top);
    ctx.fillStyle="rgba(229,205,131,0.10)";
    ctx.fill();

    ctx.strokeStyle="#a69c6d";
    ctx.lineWidth=1.5;
    ctx.stroke();
  }

  if(aimMode){
    drawAimAreaPreview();

    const top=hexScreenVertices(aimCursor.x,aimCursor.y);

    polygonPath(top);
    ctx.fillStyle="rgba(121,231,231,0.16)";
    ctx.fill();

    ctx.strokeStyle="#fff19a";
    ctx.lineWidth=3;
    ctx.stroke();

    const c=hexCenter(aimCursor.x,aimCursor.y);
    ctx.strokeStyle="#79e7e7";
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.moveTo(c.x-9,c.y);
    ctx.lineTo(c.x+9,c.y);
    ctx.moveTo(c.x,c.y-6);
    ctx.lineTo(c.x,c.y+6);
    ctx.stroke();
  }
}

function drawActiveHex(entity,color){
  for(const cell of occupiedHexes(entity)){
    const top=hexScreenVertices(cell.x,cell.y);

    polygonPath(top);
    ctx.fillStyle=color==="player"
      ? "rgba(121,231,231,0.10)"
      : "rgba(223,107,107,0.10)";
    ctx.fill();

    ctx.strokeStyle=color==="player" ? "#79e7e7" : color;
    ctx.lineWidth=3;
    ctx.stroke();
  }
}

function drawHpBar(entity,color){
  if(
    !entity ||
    !entity.maxHp ||
    entity.hp<=0 ||
    entity.hp>=entity.maxHp
  ){
    return;
  }

  const c=unitFootprintScreenCenter(entity);
  const large=unitFootprintCellCount(entity)>1;
  const width=Math.max(34,Number(entity.hpBarWidth)||(large ? 64 : 34));
  const ratio=Math.max(0,Math.min(1,entity.hp/entity.maxHp));
  const px=c.x-width/2;
  const baseOffset=Number(entity.hpBarOffsetY)||(large ? 78 : 39);
  const visualScale=enlargeVisualScale(entity);
  const py=c.y-(baseOffset*Math.max(1,visualScale));

  ctx.fillStyle="#17151a";
  ctx.fillRect(px,py,width,4);

  ctx.fillStyle=color;
  ctx.fillRect(px,py,Math.round(width*ratio),4);

  ctx.strokeStyle="#050508";
  ctx.lineWidth=1;
  ctx.strokeRect(px,py,width,4);
}

function drawCastingGlowSilhouette(
  image,
  drawW,
  drawH,
  fx,
  anchor={x:0.5,y:1}
){
  if(!fx || !image?.complete || drawW<=0 || drawH<=0) return;

  const now=performance.now();
  const phase=Math.max(0,Math.min(1,(now-fx.started)/Math.max(1,fx.duration)));

  /*
    R147: one smooth 1-second envelope: 0% -> 100% -> 0%.
    sin(pi*t) gives exactly that shape with peak opacity at 0.5 seconds.
  */
  const envelope=Math.sin(Math.PI*phase);
  if(envelope<=0.001) return;

  const pad=9;
  const w=Math.max(1,Math.ceil(drawW+pad*2));
  const h=Math.max(1,Math.ceil(drawH+pad*2));
  const mask=document.createElement("canvas");
  mask.width=w;
  mask.height=h;
  const mctx=mask.getContext("2d");
  mctx.imageSmoothingEnabled=false;
  mctx.drawImage(image,pad,pad,drawW,drawH);
  mctx.globalCompositeOperation="source-in";
  /* R149: casting glow tint changed from violet to white. */
  mctx.fillStyle="rgba(255,255,255,1)";
  mctx.fillRect(0,0,w,h);
  mctx.globalCompositeOperation="source-over";

  const spriteAnchor=anchor || {x:0.5,y:1};
  const baseX=-Math.round(drawW*spriteAnchor.x)-pad;
  const baseY=-Math.round(drawH*spriteAnchor.y)-pad;

  ctx.save();
  /* R149: source-over preserves the white glow color as opacity falls off. */
  ctx.globalCompositeOperation="source-over";
  ctx.imageSmoothingEnabled=false;

  /*
    Spatial falloff: the glow is strongest right against the caster silhouette
    and becomes progressively fainter the farther it spreads away.
  */
  /* R149: approximately 50% more transparent by halving the ring opacities. */
  const rings=[
    {radius:8, alpha:0.025},
    {radius:6, alpha:0.04},
    {radius:4, alpha:0.07},
    {radius:3, alpha:0.11},
    {radius:2, alpha:0.19},
    {radius:1, alpha:0.31}
  ];

  for(const ring of rings){
    ctx.globalAlpha=ring.alpha*envelope;
    for(let dy=-ring.radius;dy<=ring.radius;dy++){
      for(let dx=-ring.radius;dx<=ring.radius;dx++){
        if(dx===0 && dy===0) continue;
        const d2=dx*dx+dy*dy;
        const outer=ring.radius*ring.radius;
        const inner=(ring.radius-1)*(ring.radius-1);
        if(d2>outer || d2<=inner) continue;
        ctx.drawImage(mask,baseX+dx,baseY+dy);
      }
    }
  }

  /* Tightest contour also becomes 50% more transparent. */
  ctx.globalAlpha=0.5*envelope;
  for(let dy=-1;dy<=1;dy++){
    for(let dx=-1;dx<=1;dx++){
      if(dx===0 && dy===0) continue;
      ctx.drawImage(mask,baseX+dx,baseY+dy);
    }
  }

  ctx.restore();
}


function pixelAssetIdForUnitPose(unit,poseName=null){
  if(!unit) return null;
  const pose=poseName || activeUnitPoseName(unit) || "stand";

  if(unit.type==="kobold"){
    if(pose==="prone") return "kobold-prone";
    return pose==="attack" ? "kobold-attack" : "kobold-stand";
  }
  if(unit.type==="kobold-bodyguard"){
    return pose==="attack" ? "kobold-bodyguard-attack" : "kobold-bodyguard-stand";
  }
  if(unit.type==="kobold-slinger"){
    return pose==="attack" ? "kobold-slinger-attack" : "kobold-slinger-stand";
  }
  if(unit.type==="orc"){
    return pose==="attack" ? "orc-attack" : "orc-stand";
  }
  if(unit.type==="juvenile-red-dragon"){
    return pose==="attack"
      ? "juvenile-red-dragon-attack"
      : "juvenile-red-dragon";
  }
  return null;
}

function runtimeAnchorForAsset(id){
  const asset=getPixelEditorAsset(id);
  return asset?.runtimeAnchor || {x:0.5,y:1};
}

function drawSpriteFacing(image,c,drawW,drawH,facing,nativeFacing="right",entity=null,anchor=null){
  if(
    !image ||
    !image.complete ||
    !image.naturalWidth ||
    !image.naturalHeight
  ){
    return;
  }

  ctx.save();
  ctx.imageSmoothingEnabled=false;

  const shouldFlip=facing!==nativeFacing;
  const renderSource=image._crispRenderSource || image;
  const spriteAnchor=anchor || {x:0.5,y:1};

  /*
    R193: Enlarge changes only presentation size. The translated world anchor
    remains unchanged, so the unit continues to occupy its original footprint.
  */
  const enlargeScale=enlargeVisualScale(entity);
  const visualDrawW=Math.max(1,drawW*enlargeScale);
  const visualDrawH=Math.max(1,drawH*enlargeScale);

  ctx.translate(c.x,c.y);

  if(shouldFlip){
    ctx.scale(-1,1);
  }

  /*
    The target glows throughout the grow/shrink transition using the same
    silhouette treatment as spellcasting. If both happen together, Enlarge
    takes precedence so the glow follows the changing sprite dimensions.
  */
  const transitionFx=activeEnlargeTransitionFx(entity);
  const glowFx=transitionFx || activeCastingGlowFx(entity);

  if(glowFx){
    drawCastingGlowSilhouette(
      renderSource,
      visualDrawW,
      visualDrawH,
      glowFx,
      spriteAnchor
    );
  }

  try{
    ctx.drawImage(
      renderSource,
      -Math.round(visualDrawW*spriteAnchor.x),
      -Math.round(visualDrawH*spriteAnchor.y),
      visualDrawW,
      visualDrawH
    );
  }catch(error){
    console.error("Sprite draw skipped because the image source is invalid.",error);
  }

  ctx.restore();
}


function clearCombatMessage(){
  combatMessageSequence++;

  if(combatMessageClearTimer){
    clearTimeout(combatMessageClearTimer);
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(combatMessageFlashTimer);
    combatMessageFlashTimer=null;
  }

  combatMessageText="";
  combatMessageTone="normal";

  if(currentScreen==="combat"){
    draw();
  }
}

function setCombatMessage(
  message,
  holdMs=0,
  displayMs=COMBAT_MESSAGE_DISPLAY_MS,
  tone="normal"
){
  combatMessageSequence++;
  const sequence=combatMessageSequence;

  if(combatMessageClearTimer){
    clearTimeout(combatMessageClearTimer);
    combatMessageClearTimer=null;
  }

  if(combatMessageFlashTimer){
    clearInterval(combatMessageFlashTimer);
    combatMessageFlashTimer=null;
  }

  combatMessageText=String(message || "");
  combatMessageTone=tone || "normal";

  if(holdMs>0){
    combatMessageHoldUntil=Math.max(
      combatMessageHoldUntil,
      performance.now()+holdMs
    );
  }

  if(
    combatMessageText &&
    (
      combatMessageTone==="critical-hit" ||
      combatMessageTone==="critical-miss"
    )
  ){
    combatMessageFlashTimer=setInterval(()=>{
      if(sequence!==combatMessageSequence){
        clearInterval(combatMessageFlashTimer);
        combatMessageFlashTimer=null;
        return;
      }

      if(currentScreen==="combat"){
        draw();
      }
    },CRITICAL_FLASH_INTERVAL_MS);
  }

  /*
    Normal combat notifications clear after roughly 1.5 seconds.
    displayMs === 0 is reserved for persistent prompts.
  */
  if(combatMessageText && displayMs>0){
    combatMessageClearTimer=setTimeout(()=>{
      if(sequence!==combatMessageSequence){
        return;
      }

      combatMessageClearTimer=null;

      if(combatMessageFlashTimer){
        clearInterval(combatMessageFlashTimer);
        combatMessageFlashTimer=null;
      }

      combatMessageText="";
      combatMessageTone="normal";

      if(currentScreen==="combat"){
        draw();
      }
    },displayMs);
  }

  if(currentScreen==="combat"){
    updateUi();
    draw();
  }
}

function setCriticalRollNotification(attacker,defender,rawRoll,damage=null,killed=false){
  if(rawRoll===1){
    setCombatMessage(
      `CRITICAL MISS! ${attacker.name} misses ${defender.name}`,
      CRITICAL_MESSAGE_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      "critical-miss"
    );
    return;
  }

  if(rawRoll===20){
    const message=killed
      ? `CRITICAL HIT! ${defender.name} goes down and is dying`
      : (
          damage===null
            ? `CRITICAL HIT! ${attacker.name} hits ${defender.name}`
            : `CRITICAL HIT! ${attacker.name} damages ${defender.name} for ${damage} damage`
        );

    setCombatMessage(
      message,
      CRITICAL_MESSAGE_HOLD_MS,
      COMBAT_MESSAGE_DISPLAY_MS,
      "critical-hit"
    );
  }
}

function drawCombatMessageBox(){
  if(!game || !combatMessageText){
    return;
  }

  ctx.save();

  /*
    Full-width combat notification strip, flush with the bottom
    edge of the tactical battlefield.
  */
  const boxW=canvas.width;
  const boxH=44;
  const x=0;
  const y=canvas.height-boxH;

  const flashPhase=
    Math.floor(performance.now()/CRITICAL_FLASH_INTERVAL_MS)%2===0;

  let background="rgba(5,5,9,0.92)";
  let border="#e5cd83";
  let lettering="#fff19a";

  if(combatMessageTone==="critical-hit"){
    background=flashPhase
      ? "rgba(10,62,24,0.96)"
      : "rgba(4,25,10,0.96)";
    border=flashPhase ? "#7dff91" : "#31a94d";
    lettering=flashPhase ? "#d8ffde" : "#73f58a";
  }else if(combatMessageTone==="critical-miss"){
    background=flashPhase
      ? "rgba(78,12,16,0.96)"
      : "rgba(31,5,8,0.96)";
    border=flashPhase ? "#ff7f88" : "#bd3946";
    lettering=flashPhase ? "#ffe1e3" : "#ff727e";
  }else if(combatMessageTone==="player-damage"){
    background="rgba(62,8,12,0.96)";
    border="#d94a57";
    lettering="#ff9aa2";
  }

  ctx.fillStyle=background;
  ctx.fillRect(x,y,boxW,boxH);

  ctx.strokeStyle=border;
  ctx.lineWidth=2;
  ctx.strokeRect(
    x+1,
    y+1,
    boxW-2,
    boxH-2
  );

  ctx.font='18px "AdventureGoldBox", "Gold Box", "GoldBox", "Lucida Console", monospace';
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillStyle=lettering;

  ctx.fillText(
    combatMessageText,
    canvas.width/2,
    y+boxH/2,
    boxW-28
  );

  ctx.restore();
}

function beginCombatFromPrompt(){
  if(
    !game ||
    game.over ||
    !combatOpeningSpeechDone ||
    !combatAwaitingStart
  ){
    return false;
  }

  combatAwaitingStart=false;

  setCombatMessage("Combat begins.");
  ui.turnBanner.textContent="ROLLING INITIATIVE...";
  updateUi();
  draw();

  startRound();
  return true;
}

function drawFighter(p){
  const c=hexCenter(p.x,p.y);

  if(game.active==="player"){
    drawActiveHex(p,"player");
  }

  drawHpBar(p,"#94e084");

  const fighterDims=spriteRenderDimensions("fighter",fighterSprite,26,35);
  const drawW=fighterDims.width;
  const drawH=fighterDims.height;

  ctx.save();
  ctx.translate(c.x,c.y+2);
  /* R38: combat unit shadows expanded by exactly 50%. */
  ctx.scale(0.93,0.33);
  ctx.fillStyle="rgba(0,0,0,0.46)";
  ctx.beginPath();
  ctx.arc(0,0,12,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  drawSpriteFacing(
    fighterSprite,
    c,
    drawW,
    drawH,
    p.facing,
    getSpriteAssetSpec("fighter")?.nativeFacing || "left",
    p,
    runtimeAnchorForAsset("fighter")
  );

}


function drawFriendlyArcher(npc){
  const c=hexCenter(npc.x,npc.y);

  if(game.active===npc.id){
    drawActiveHex(npc,"#78d7c4");
  }

  if(npc.alive){
    drawHpBar(npc,"#78d7c4");
  }

  const targetH=33;
  const scale=targetH/fighterSprite.height;
  const drawW=Math.max(
    1,
    Math.round(fighterSprite.width*scale)
  );
  const drawH=Math.max(
    1,
    Math.round(fighterSprite.height*scale)
  );

  ctx.save();
  ctx.translate(c.x,c.y+2);
  ctx.scale(0.90,0.31);
  ctx.fillStyle="rgba(0,0,0,0.44)";
  ctx.beginPath();
  ctx.arc(0,0,11,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  drawSpriteFacing(
    fighterSprite,
    c,
    drawW,
    drawH,
    npc.facing,
    "left",
    npc
  );

  /*
    Temporary visual identifier until the Ranger receives her own sprite:
    a small bow glyph and friendly-Ranger marker.
  */
  const side=npc.facing==="right" ? 1 : -1;

  ctx.save();

  ctx.strokeStyle="#d4b46a";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(
    c.x+side*(drawW/2+6),
    c.y-17,
    7,
    -Math.PI/2,
    Math.PI/2,
    side<0
  );
  ctx.stroke();

  ctx.strokeStyle="#e9dfbd";
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(
    c.x+side*(drawW/2+4),
    c.y-24
  );
  ctx.lineTo(
    c.x+side*(drawW/2+4),
    c.y-10
  );
  ctx.stroke();

  ctx.restore();
}


function drawFriendlyMage(mage){
  const c=hexCenter(mage.x,mage.y);

  if(game.active===mage.id){
    drawActiveHex(mage,"#ba8cff");
  }

  if(mage.alive){
    drawHpBar(mage,"#ba8cff");
  }

  const targetH=33;
  const scale=targetH/fighterSprite.height;
  const drawW=Math.max(1,Math.round(fighterSprite.width*scale));
  const drawH=Math.max(1,Math.round(fighterSprite.height*scale));

  ctx.save();
  ctx.translate(c.x,c.y+2);
  ctx.scale(0.90,0.31);
  ctx.fillStyle="rgba(0,0,0,0.44)";
  ctx.beginPath();
  ctx.arc(0,0,11,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  drawSpriteFacing(
    fighterSprite,
    c,
    drawW,
    drawH,
    mage.facing,
    "left",
    mage
  );

  /* Temporary Mage identifier until dedicated wizard art is supplied. */
  ctx.save();
  ctx.font='bold 11px "AdventureGoldBox", "Lucida Console", monospace';
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineWidth=3;
  ctx.strokeStyle="#08050d";
  ctx.fillStyle="#d8b6ff";
  ctx.strokeText("M",c.x,c.y-35);
  ctx.fillText("M",c.x,c.y-35);
  ctx.restore();
}

function drawKobold(k){
  const c=hexCenter(k.x,k.y);

  if(game.active===k.id){
    drawActiveHex(
      k,
      "#df6b6b"
    );
  }

  if(k.alive){
    drawHpBar(k,"#df6b6b");
  }

  /*
    R110 Kobold art uses the shared unit-pose framework:
      - standing frame for idle, movement, and fleeing
      - action frame for every attack type
      - prone frame for magical sleep, unconsciousness, or canonical prone
      - dead kobolds are not yet rendered with the prone frame
      - R115 swaps in the newer prone kobold art with transparent background
  */
  const standSprite=unitPoseDefinition(k)?.sprites?.stand || koboldSprite;
  const activePoseName=activeUnitPoseName(k);
  const sprite=unitPoseSprite(k,standSprite);

  if(!sprite?.complete || !sprite.naturalWidth){
    return;
  }

  /* R162: explicit per-asset render dimensions replace implicit source-size scaling. */
  const koboldAssetId=pixelAssetIdForUnitPose(k,activePoseName) || "kobold-stand";
  const koboldDims=spriteRenderDimensions(koboldAssetId,sprite,27,28);
  const drawW=koboldDims.width;
  const drawH=koboldDims.height;

  const spriteAnchor={
    x:c.x,
    y:activePoseName==="prone" ? c.y+10 : c.y+3
  };

  /* Keep the separately rendered battlefield/contact shadow. */
  if(activePoseName==="prone"){
    /*
      R118: use the chosen Option 5 prone size (18 px) and give prone kobolds a
      contact shadow that touches the sprite and tracks its rendered width.
    */
    const proneShadowW=Math.max(10,Math.round(drawW*0.46));
    const proneShadowH=Math.max(2,Math.round(drawH*0.12));
    ctx.save();
    ctx.translate(c.x,spriteAnchor.y);
    ctx.fillStyle="rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(0,-1,proneShadowW,proneShadowH,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(c.x,c.y+3);
    ctx.scale(0.87,0.30);
    ctx.fillStyle="rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.arc(0,0,11,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  drawSpriteFacing(
    sprite,
    spriteAnchor,
    drawW,
    drawH,
    k.facing,
    getSpriteAssetSpec(koboldAssetId)?.nativeFacing || unitPoseNativeFacing(k,"right"),
    k,
    runtimeAnchorForAsset(koboldAssetId)
  );
}


function drawOrc(orc){
  const c=hexCenter(orc.x,orc.y);

  if(game.active===orc.id){
    drawActiveHex(
      orc,
      "#e08058"
    );
  }

  if(orc.alive){
    drawHpBar(orc,"#e08058");
  }

  /* R84: Orc standing/action art now runs through the shared unit-pose framework. */
  const sprite=unitPoseSprite(orc,orcStandSprite);

  if(!sprite?.complete || !sprite.naturalWidth){
    return;
  }

  const orcAssetId=pixelAssetIdForUnitPose(orc,activeUnitPoseName(orc)) || "orc-stand";
  const orcDims=spriteRenderDimensions(orcAssetId,sprite,34,36);
  const drawW=orcDims.width;
  const drawH=orcDims.height;

  const spriteAnchor={
    x:c.x,
    y:c.y+4
  };

  /* Keep the separately rendered battlefield/contact shadow. */
  ctx.save();
  ctx.translate(c.x,c.y+4);
  ctx.scale(1.00,0.34);
  ctx.fillStyle="rgba(0,0,0,0.48)";
  ctx.beginPath();
  ctx.arc(0,0,12,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  drawSpriteFacing(
    sprite,
    spriteAnchor,
    drawW,
    drawH,
    orc.facing,
    getSpriteAssetSpec(orcAssetId)?.nativeFacing || unitPoseNativeFacing(orc,"right"),
    orc,
    runtimeAnchorForAsset(orcAssetId)
  );
}



function dragonPresentationMetrics(mob,poseName=activeUnitPoseName(mob) || "stand"){
  const center=unitFootprintScreenCenter(mob);
  const attack=poseName==="attack";
  const width=Math.max(1,Number(mob?.dragonRenderWidth)||89);
  const height=Math.max(
    1,
    Number(
      attack
        ? mob?.dragonAttackRenderHeight
        : mob?.dragonStandRenderHeight
    ) || (attack ? 107 : 104)
  );
  const lateral=Math.max(0,Number(mob?.dragonAnchorOffsetX)||3);
  const vertical=Math.max(0,Number(mob?.dragonAnchorOffsetY)||41);

  /*
    The supplied placement reference faces left. Mirroring the sprite should
    mirror its small lateral placement bias as well, so the body remains
    centered over the seven occupied cells in either facing.
  */
  const anchor={
    x:center.x+(mob?.facing==="left" ? -lateral : lateral),
    y:center.y+vertical
  };

  return {
    poseName,
    attack,
    center,
    width,
    height,
    anchor,
    nativeFacing:"left"
  };
}

function drawLargeTestMob(mob){
  const footprint=occupiedHexes(mob);

  if(game.active===mob.id){
    drawActiveHex(mob,"#e08058");
  }

  if(mob.alive){
    drawHpBar(mob,"#e08058");
  }

  /*
    Keep a very faint footprint wash while the multi-hex system is under test.
    The dragon itself has no baked or separately rendered ground shadow.
  */
  ctx.save();
  for(const cell of footprint){
    if(
      game?.condition==="wall" &&
      !isHexVisibleToFriendlyParty(cell.x,cell.y)
    ){
      continue;
    }

    const top=hexScreenVertices(cell.x,cell.y);
    polygonPath(top);
    ctx.fillStyle="rgba(170,70,46,0.035)";
    ctx.fill();
    ctx.strokeStyle="rgba(224,128,88,0.18)";
    ctx.lineWidth=1;
    ctx.stroke();
  }
  ctx.restore();

  const poseName=activeUnitPoseName(mob) || "stand";
  const sprite=unitPoseSprite(mob,juvenileRedDragonStandSprite);

  if(!sprite?.complete || !sprite.naturalWidth){
    return;
  }

  const presentation=dragonPresentationMetrics(mob,poseName);

  drawSpriteFacing(
    sprite,
    presentation.anchor,
    presentation.width,
    presentation.height,
    mob.facing,
    presentation.nativeFacing,
    mob,
    {x:0.5,y:1}
  );
}


function drawFireballGlyph(x,y,scale=1){
  /*
    R102: retain the overlapping spherical flame lobes, but add a light
    VFX-local grain/pixel pass so the projectile feels more at home beside the
    pixel-art battlefield without reverting to chunky square blast volumes.
  */
  const lobes=[
    {ox:-4.4,oy: 1.6,r:7.1,color:"rgba(132,25,6,1)"},
    {ox: 3.8,oy: 1.0,r:7.4,color:"rgba(211,53,8,1)"},
    {ox:-1.0,oy:-3.7,r:7.9,color:"rgba(255,101,12,1)"},
    {ox: 1.0,oy: 2.7,r:7.0,color:"rgba(255,154,22,1)"},
    {ox:-1.4,oy:-0.5,r:5.3,color:"rgba(255,211,53,1)"},
    {ox: 0.5,oy:-1.1,r:3.0,color:"rgba(255,247,190,1)"}
  ];

  function glyphHash01(a,b,c){
    let n=(
      Math.imul((a|0)+97,73856093) ^
      Math.imul((b|0)-53,19349663) ^
      Math.imul((c|0)+11,83492791)
    )>>>0;
    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;
    return (n>>>0)/4294967295;
  }

  ctx.save();
  for(const lobe of lobes){
    ctx.fillStyle=lobe.color;
    ctx.beginPath();
    ctx.arc(
      x+lobe.ox*scale,
      y+lobe.oy*scale,
      lobe.r*scale,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  /* Subtle low-opacity pixel grain pass over the fire mass. */
  const grainPalette=[
    "rgba(98,18,7,1)",
    "rgba(181,42,8,1)",
    "rgba(255,120,18,1)",
    "rgba(255,220,110,1)"
  ];
  for(let i=0;i<16;i++){
    const h1=glyphHash01(Math.round(x*10),Math.round(y*10),i);
    const h2=glyphHash01(Math.round(x*10)+31,Math.round(y*10)-17,i+19);
    const px=x+(h1-0.5)*13.5*scale;
    const py=y+(h2-0.5)*13.5*scale;
    const size=(h1>0.72 ? 3 : 2)*Math.max(1,Math.round(scale));
    ctx.fillStyle=grainPalette[i%grainPalette.length];
    ctx.fillRect(Math.round(px),Math.round(py),size,size);
  }
  ctx.restore();
}


function drawProjectileFx(){
  if(!projectileFx) return;

  const {start,end,t,arcHeight}=projectileFx;
  const effectiveArcHeight=projectileFx.kind==="magic-missile" ? 0 : (arcHeight || 0);

  const x=start.x + (end.x-start.x)*t;
  const yLinear=start.y + (end.y-start.y)*t;
  const y=yLinear - Math.sin(Math.PI*t)*effectiveArcHeight;

  ctx.save();

  const trailT=Math.max(0,t-0.10);
  const tx=start.x + (end.x-start.x)*trailT;
  const tyLinear=start.y + (end.y-start.y)*trailT;
  const ty=tyLinear - Math.sin(Math.PI*trailT)*effectiveArcHeight;

  if(projectileFx.kind==="fireball"){
    /*
      R138 experiment: the Fireball projectile is fully opaque. The lobe
      geometry is unchanged so only opacity is being evaluated.
    */
    ctx.save();

    const dx=end.x-start.x;
    const dy=end.y-start.y;
    const trailColors=[
      "rgba(122,21,7,1)",
      "rgba(216,58,12,1)",
      "rgba(255,122,24,1)",
      "rgba(255,208,42,1)"
    ];

    for(let i=1;i<=7;i++){
      const pt=Math.max(0,t-i*0.028);
      const ex=start.x+dx*pt;
      const ey=start.y+dy*pt;
      const r=Math.max(2.2,7.8-i*0.68);
      ctx.fillStyle=trailColors[Math.min(trailColors.length-1,Math.floor((7-i)/2))];
      ctx.beginPath();
      ctx.arc(ex,ey,r,0,Math.PI*2);
      ctx.fill();
    }

    drawFireballGlyph(x,y,1);
    ctx.restore();
  }else{
    /* Smooth trail retained for non-Fireball projectiles. */
    ctx.strokeStyle="rgba(214,198,156,0.55)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(x,y);
    ctx.stroke();
  }

  if(projectileFx.kind==="magic-missile"){
    ctx.strokeStyle="rgba(169,205,255,0.55)";
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.moveTo(tx,ty);
    ctx.lineTo(x,y);
    ctx.stroke();

    ctx.fillStyle="#d8edff";
    ctx.strokeStyle="#6aa7ff";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(x,y,5.5,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle="rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x-1.5,y-1.5,2,0,Math.PI*2);
    ctx.fill();
  }else if(projectileFx.kind==="arrow"){
    const angle=Math.atan2(
      end.y-start.y,
      end.x-start.x
    );

    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);

    ctx.strokeStyle="#e7d8ac";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(-9,0);
    ctx.lineTo(9,0);
    ctx.stroke();

    ctx.fillStyle="#d7c28a";
    ctx.beginPath();
    ctx.moveTo(10,0);
    ctx.lineTo(5,-3);
    ctx.lineTo(5,3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }else if(projectileFx.kind==="fireball"){
    /* Fireball head/trail were already drawn above. */
  }else{
    /* Rock */
    ctx.fillStyle="#9b9587";
    ctx.strokeStyle="#19171b";
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.ellipse(x,y,4.5,3.6,0.2,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    /* Tiny highlight */
    ctx.fillStyle="rgba(255,245,214,0.75)";
    ctx.beginPath();
    ctx.ellipse(x-1.2,y-1.2,1.1,0.8,0,0,Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}


function drawDragonBreathFx(){
  if(!dragonBreathFx) return;

  const fx=dragonBreathFx;
  const dragon=getUnitById(fx.dragonId);
  if(!dragon) return;

  const now=performance.now();
  const elapsed=Math.max(0,now-fx.started);
  const frameMs=58;
  const frame=Math.floor(elapsed/frameMs);
  const steppedElapsed=Math.min(fx.duration,frame*frameMs);
  const t=Math.max(0,Math.min(1,steppedElapsed/Math.max(1,fx.duration)));

  const growthEnd=0.58;
  const growth=Math.min(1,t/growthEnd);
  const fade=t<0.72
    ? 1
    : Math.max(0,1-(t-0.72)/0.28);

  if(growth<=0 || fade<=0) return;

  const presentation=dragonPresentationMetrics(dragon,"attack");
  const mouth={
    x:presentation.anchor.x+
      (dragon.facing==="left" ? -1 : 1)*presentation.width*0.36,
    y:presentation.anchor.y-presentation.height*0.41
  };

  function hash32(a,b,c,d){
    let n=(
      Math.imul((a|0)+4099,73856093) ^
      Math.imul((b|0)-8191,19349663) ^
      Math.imul((c|0)+131,83492791) ^
      Math.imul((d|0)+17,2654435761)
    )>>>0;
    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;
    return n>>>0;
  }

  function hash01(a,b,c,d){
    return hash32(a,b,c,d)/4294967295;
  }

  const flamePalette=[
    [112,18,6],
    [176,34,6],
    [229,67,7],
    [255,112,12],
    [255,171,30],
    [255,218,78],
    [255,244,174],
    [255,255,236]
  ];

  /*
    R192 separates gameplay geometry from presentation geometry.
    fx.cells still controls who is hit and how walls constrain the breath, but
    the visible flame is now built as one true geometric cone from the muzzle.
  */
  const visibleCells=(fx.cells || [])
    .filter(cell=>
      Number(cell.breathStep||0) <=
      Math.max(1,Math.ceil((Number(fx.rangeHexes)||9)*growth))
    )
    .slice();

  if(!visibleCells.length) return;

  const maxVisibleStep=Math.max(
    ...visibleCells.map(cell=>Math.max(1,Number(cell.breathStep)||1))
  );
  const farRow=visibleCells.filter(cell=>
    (Number(cell.breathStep)||1)===maxVisibleStep
  );
  const farCenterCell=
    farRow.find(cell=>(Number(cell.breathLane)||0)===0) ||
    farRow[Math.floor(farRow.length/2)] ||
    visibleCells[visibleCells.length-1];

  const farCenter=hexCenter(farCenterCell.x,farCenterCell.y);
  farCenter.y-=7;

  const fullDx=farCenter.x-mouth.x;
  const fullDy=farCenter.y-mouth.y;
  const fullLength=Math.max(1,Math.hypot(fullDx,fullDy));
  const dirX=fullDx/fullLength;
  const dirY=fullDy/fullLength;
  const normalX=-dirY;
  const normalY=dirX;
  const directionAngle=Math.atan2(dirY,dirX);

  /*
    End width is deliberately narrower than the raw 3-hex tactical footprint.
    The VFX now reads as a projected cone instead of a group of filled hexes.
  */
  const fullEndHalfWidth=Math.min(
    62,
    Math.max(34,fullLength*0.115)
  );
  const currentLength=fullLength*growth;
  const currentEndHalfWidth=4+(fullEndHalfWidth-4)*growth;

  const coneEnd={
    x:mouth.x+dirX*currentLength,
    y:mouth.y+dirY*currentLength
  };

  const bodyCanvas=document.createElement("canvas");
  bodyCanvas.width=ctx.canvas.width;
  bodyCanvas.height=ctx.canvas.height;
  const bodyCtx=bodyCanvas.getContext("2d");
  bodyCtx.imageSmoothingEnabled=false;

  /*
    Hard presentation clip: every flame lobe is clipped inside one tapered cone.
    This prevents the outer silhouette from following individual tactical hexes.
  */
  bodyCtx.save();
  bodyCtx.beginPath();
  bodyCtx.moveTo(
    mouth.x+normalX*3,
    mouth.y+normalY*3
  );
  bodyCtx.lineTo(
    coneEnd.x+normalX*currentEndHalfWidth,
    coneEnd.y+normalY*currentEndHalfWidth
  );
  bodyCtx.lineTo(
    coneEnd.x-normalX*currentEndHalfWidth,
    coneEnd.y-normalY*currentEndHalfWidth
  );
  bodyCtx.lineTo(
    mouth.x-normalX*3,
    mouth.y-normalY*3
  );
  bodyCtx.closePath();
  bodyCtx.clip();

  /*
    R192 uses many small lobes along continuous cone slices. Lobe radius is
    roughly half the R191 value, and the number of cross-cone samples grows
    gradually with distance rather than jumping when the tactical footprint
    widens from one lane to three.
  */
  const sliceCount=52;
  const visibleSlices=Math.max(2,Math.ceil(sliceCount*growth));

  for(let slice=0;slice<visibleSlices;slice++){
    const q=(slice+1)/sliceCount;
    const centerX=mouth.x+dirX*fullLength*q;
    const centerY=mouth.y+dirY*fullLength*q;
    const halfWidth=4+(fullEndHalfWidth-4)*q;
    const acrossCount=3+Math.round(q*5);

    for(let across=0;across<acrossCount;across++){
      const lateralNorm=
        acrossCount===1
          ? 0
          : (across/(acrossCount-1))*2-1;

      const h1=hash01(slice,across,frame%7,11);
      const h2=hash01(slice+71,across-37,frame+19,23);
      const h3=hash01(slice-43,across+113,frame+31,37);
      const h4=hash01(slice+149,across+29,frame+47,53);

      const lateral=
        lateralNorm*halfWidth*0.88+
        (h1-0.5)*2.8;
      const alongJitter=(h2-0.5)*2.3;

      const px=
        centerX+
        dirX*alongJitter+
        normalX*lateral;
      const py=
        centerY+
        dirY*alongJitter+
        normalY*lateral;

      const radius=(
        5.4+
        q*3.7+
        h3*1.7
      )*Math.max(0.48,Math.min(1,growth*1.18));

      const rx=radius*(1.13+0.08*h1);
      const ry=radius*(0.72+0.08*h4);

      const lateralHeat=1-Math.min(1,Math.abs(lateralNorm));
      const heat=Math.max(
        0,
        0.96-
        q*0.18-
        (1-lateralHeat)*0.62
      );

      let colorIndex=Math.round(
        2+
        heat*5+
        (h4>0.70 ? 1 : h4<0.18 ? -1 : 0)
      );
      colorIndex=Math.max(
        0,
        Math.min(flamePalette.length-1,colorIndex)
      );

      const [r,g,b]=flamePalette[colorIndex];
      bodyCtx.fillStyle=`rgba(${r},${g},${b},1)`;
      bodyCtx.beginPath();
      bodyCtx.ellipse(
        px,
        py,
        rx,
        ry,
        directionAngle,
        0,
        Math.PI*2
      );
      bodyCtx.fill();
    }

    /*
      Narrow white-hot center stream. It is independent of the outer lobes,
      keeping the brightest material on the centerline instead of filling the
      whole cone.
    */
    const coreH=hash01(slice,frame,83,97);
    const coreRadius=(3.0+q*1.9)*(0.82+coreH*0.18);
    const coreX=centerX+normalX*(coreH-0.5)*1.5;
    const coreY=centerY+normalY*(coreH-0.5)*1.5;

    bodyCtx.fillStyle=
      q<0.62
        ? "rgba(255,255,244,1)"
        : "rgba(255,245,184,1)";
    bodyCtx.beginPath();
    bodyCtx.ellipse(
      coreX,
      coreY,
      coreRadius*1.75,
      coreRadius*0.82,
      directionAngle,
      0,
      Math.PI*2
    );
    bodyCtx.fill();
  }

  /*
    Compact muzzle bridge keeps the VFX visually attached to the attacking
    sprite while preserving the narrow cone origin.
  */
  for(let i=0;i<5;i++){
    const q=(i+1)/70;
    const px=mouth.x+dirX*fullLength*q;
    const py=mouth.y+dirY*fullLength*q;
    const radius=(3.6+i*0.7)*Math.max(0.55,growth);

    bodyCtx.fillStyle=
      i<4
        ? "rgba(255,255,246,1)"
        : "rgba(255,225,96,1)";
    bodyCtx.beginPath();
    bodyCtx.ellipse(
      px,
      py,
      radius*1.55,
      radius*0.70,
      directionAngle,
      0,
      Math.PI*2
    );
    bodyCtx.fill();
  }

  bodyCtx.restore();

  const silhouetteCanvas=document.createElement("canvas");
  silhouetteCanvas.width=bodyCanvas.width;
  silhouetteCanvas.height=bodyCanvas.height;
  const silhouetteCtx=silhouetteCanvas.getContext("2d");
  silhouetteCtx.imageSmoothingEnabled=false;
  silhouetteCtx.drawImage(bodyCanvas,0,0);
  silhouetteCtx.globalCompositeOperation="source-in";
  silhouetteCtx.fillStyle="rgba(0,0,0,1)";
  silhouetteCtx.fillRect(
    0,
    0,
    silhouetteCanvas.width,
    silhouetteCanvas.height
  );
  silhouetteCtx.globalCompositeOperation="source-over";

  const outlineCanvas=document.createElement("canvas");
  outlineCanvas.width=bodyCanvas.width;
  outlineCanvas.height=bodyCanvas.height;
  const outlineCtx=outlineCanvas.getContext("2d");
  outlineCtx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      outlineCtx.drawImage(silhouetteCanvas,dx,dy);
    }
  }

  outlineCtx.globalCompositeOperation="destination-out";
  outlineCtx.drawImage(silhouetteCanvas,0,0);
  outlineCtx.globalCompositeOperation="source-over";

  ctx.save();
  ctx.imageSmoothingEnabled=false;

  /*
    Smoke now follows the cone's centerline rather than tactical cells, so the
    far exhaust cannot reintroduce a hex-shaped silhouette.
  */
  const smokePuffCount=22;
  for(let puff=0;puff<smokePuffCount;puff++){
    const h1=hash01(puff,frame+307,5,13);
    const h2=hash01(puff+97,frame-179,17,29);
    const h3=hash01(puff-211,frame+263,31,43);

    const q=0.64+h1*0.36;
    if(q>growth+0.02) continue;

    const halfWidth=4+(fullEndHalfWidth-4)*q;
    const lateral=(h2-0.5)*halfWidth*1.30;
    const age=(t+h3*0.24)%1;

    const sx=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;
    const sy=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral-
      age*(18+q*24);

    const smokeRadius=(
      7+
      q*11+
      hash01(puff,frame,59,71)*5
    )*(0.78+0.28*growth);
    const smokeAlpha=(0.10+q*0.12)*(1-age*0.72)*fade;

    ctx.globalAlpha=smokeAlpha;
    ctx.fillStyle=
      puff%3===0
        ? "#171a1e"
        : puff%3===1
          ? "#292c30"
          : "#3a3c3f";
    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy,
      smokeRadius*1.15,
      smokeRadius*0.72,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();
  }

  /* R191 white-hot bloom retained around the tighter R192 cone. */
  ctx.save();
  ctx.globalCompositeOperation="lighter";
  ctx.filter="blur(6px)";
  ctx.globalAlpha=0.31*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.filter="blur(2px)";
  ctx.globalAlpha=0.19*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.restore();

  ctx.globalAlpha=0.55*fade;
  ctx.drawImage(outlineCanvas,0,0);

  ctx.globalAlpha=0.92*fade;
  ctx.drawImage(bodyCanvas,0,0);

  ctx.globalCompositeOperation="lighter";
  ctx.globalAlpha=0.25*fade;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.globalCompositeOperation="source-over";
  ctx.globalAlpha=1;

  /*
    Grain samples uniformly inside the presentation cone instead of selecting
    tactical cells. This preserves the pixel texture without exposing hex rows.
  */
  const grainCount=Math.max(180,Math.round(340*growth));
  for(let i=0;i<grainCount;i++){
    const q=hash01(i,fx.source.x+11,fx.source.y-17,3)*growth;
    const h2=hash01(i,fx.source.x-29,fx.source.y+7,9);
    const h3=hash01(i,fx.source.x+53,fx.source.y+91,15);
    const halfWidth=4+(fullEndHalfWidth-4)*q;
    const lateral=(h2-0.5)*2*halfWidth*0.90;

    const px=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;
    const py=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral;
    const size=h3>0.84 ? 3 : 2;
    const lateralNorm=
      halfWidth>0
        ? Math.min(1,Math.abs(lateral)/halfWidth)
        : 0;

    ctx.fillStyle=
      lateralNorm<0.34
        ? `rgba(255,255,232,${0.74*fade})`
        : lateralNorm<0.72
          ? `rgba(255,210,82,${0.64*fade})`
          : `rgba(235,78,8,${0.48*fade})`;

    ctx.fillRect(
      Math.round(px),
      Math.round(py),
      size,
      size
    );
  }

  /*
    Embers also follow the cone mathematically. They may drift beyond the flame
    edge as they rise, but their source distribution remains conical.
  */
  const particleCount=420;
  for(let i=0;i<particleCount;i++){
    const born=hash01(fx.source.x+211,fx.source.y-97,i,7)*0.46;
    if(t<born) continue;

    const life=Math.max(
      0,
      Math.min(1,(t-born)/Math.max(0.01,1-born))
    );
    if(life>=1) continue;

    const q=hash01(fx.source.x-43,fx.source.y+67,i,13);
    if(q>growth+0.07) continue;

    const halfWidth=4+(fullEndHalfWidth-4)*Math.min(1,q);
    const lateral=(
      hash01(fx.source.x+19,fx.source.y+149,i,23)-0.5
    )*2*halfWidth*1.08;

    const rise=life*(
      9+
      hash01(fx.source.x+89,fx.source.y-17,i,31)*30
    );

    const px=
      mouth.x+
      dirX*fullLength*q+
      normalX*lateral;
    const py=
      mouth.y+
      dirY*fullLength*q+
      normalY*lateral-
      rise;

    const sizeRoll=hash01(fx.source.x-131,fx.source.y+41,i,47);
    const size=
      sizeRoll>0.94
        ? 3
        : sizeRoll>0.55
          ? 2
          : 1;
    const alpha=Math.max(0,1-life)*0.62*fade;

    ctx.fillStyle=
      i%3===0
        ? `rgba(255,242,150,${alpha})`
        : i%3===1
          ? `rgba(255,132,20,${alpha})`
          : `rgba(196,45,8,${alpha})`;

    if(i%4===0){
      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        Math.max(2,size+2)
      );
    }else{
      ctx.fillRect(
        Math.round(px),
        Math.round(py),
        size,
        size
      );
    }
  }

  ctx.restore();
}

function drawFireballExplosionFx(){
  if(!fireballExplosionFx) return;

  const fx=fireballExplosionFx;
  const elapsed=Math.max(0,performance.now()-fx.started);

  /*
    R138 Fireball opacity experiment: the volumetric cloud still uses
    overlapping spherical flame lobes, but all drawn Fireball pixels are opaque.
    Motion remains lightly stepped so the effect still belongs beside retro art,
    but the actual volume is intentionally organic and continuous.
  */
  const frameMs=58;
  const frame=Math.floor(elapsed/frameMs);
  const steppedElapsed=Math.min(fx.duration,frame*frameMs);
  const t=Math.max(0,Math.min(1,steppedElapsed/fx.duration));

  const growthEnd=0.58;
  const growth=Math.min(1,t/growthEnd);
  const fade=t<0.67
    ? 1
    : Math.max(0,1-(t-0.67)/0.33);

  const radius=Math.max(1,Number(fx.radiusHexes)||1);
  const cells=(fx.cells?.length
    ? fx.cells
    : hexesWithinRadius({x:fx.x,y:fx.y},radius)
  ).slice();

  const center={x:fx.x,y:fx.y};
  const verticalRadius=radius*HEX_W;
  const spreadRadius=Math.max(
    radius,
    Number(fx.maxVolumeDistance)||radius
  );

  cells.sort((a,b)=>{
    const ac=hexCenter(a.x,a.y);
    const bc=hexCenter(b.x,b.y);
    return ac.y-bc.y || ac.x-bc.x;
  });

  function hash32(a,b,c,d){
    let n=(
      Math.imul((a|0)+4099,73856093) ^
      Math.imul((b|0)-8191,19349663) ^
      Math.imul((c|0)+131,83492791) ^
      Math.imul((d|0)+17,2654435761)
    )>>>0;
    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;
    return n>>>0;
  }

  function hash01(a,b,c,d){
    return hash32(a,b,c,d)/4294967295;
  }

  /* Warm limited palette; overlap/alpha supplies intermediate values. */
  const flamePalette=[
    [91,17,7],
    [145,28,7],
    [211,51,8],
    [245,85,11],
    [255,128,18],
    [255,177,30],
    [255,218,73],
    [255,244,170]
  ];

  ctx.save();
  /*
    R143: treat the requested transparency as a readable translucent flame
    body: 75% opacity / 25% transparency. Terrain and units remain visible
    through the blast without washing the flame colors away.
  */
  const fireballBodyOpacity=0.75*fade;

  /*
    R141: render the Fireball body to an offscreen canvas, then stamp a 2-pixel
    black silhouette around the combined body so the entire flame mass reads as
    one outlined object rather than many separately outlined lobes.
  */
  const bodyCanvas=document.createElement("canvas");
  bodyCanvas.width=ctx.canvas.width;
  bodyCanvas.height=ctx.canvas.height;
  const bodyCtx=bodyCanvas.getContext("2d");
  bodyCtx.imageSmoothingEnabled=false;

  for(const cell of cells){
    const ring=Number.isFinite(cell.volumeDistance)
      ? cell.volumeDistance
      : hexDistance(center,cell);
    const horizontalNorm=ring/(spreadRadius+0.35);
    const domeFactor=Math.sqrt(Math.max(0,1-horizontalNorm*horizontalNorm));
    const maxHeight=Math.max(16,verticalRadius*domeFactor);
    const c=hexCenter(cell.x,cell.y);

    /*
      Each horizontal cell gets several large translucent spheres through the
      vertical column. Neighboring cells use radii wider than half a hex, so
      the 19-cell footprint fuses into one continuous cloud rather than 19
      individual puffs.
    */
    const layerCount=Math.max(2,Math.ceil(maxHeight/22));

    for(let layer=layerCount;layer>=0;layer--){
      const z=(layer/layerCount)*maxHeight*growth;
      const verticalNorm=z/Math.max(1,verticalRadius);
      const volumeDistance=Math.sqrt(
        horizontalNorm*horizontalNorm+verticalNorm*verticalNorm
      );

      if(volumeDistance>growth+0.15) continue;

      const heat=Math.max(0,1-volumeDistance);
      const lobes=3+Math.round(heat*2);

      for(let i=0;i<lobes;i++){
        const h1=hash01(cell.x,cell.y,layer,i+frame%3);
        const h2=hash01(cell.x+71,cell.y-37,layer,i+19);
        const h3=hash01(cell.x-43,cell.y+113,layer,i+31);
        const h4=hash01(cell.x+149,cell.y+29,layer,i+47);

        const ox=(h1-0.5)*HEX_W*0.76;
        const oy=(h2-0.5)*HEX_H*0.34;

        /* Large radii are intentional: overlap is the visual construction. */
        const radiusPx=(
          HEX_W*(0.30+0.14*h3) *
          (0.78+0.28*heat) *
          Math.max(0.22,growth)
        );
        const ry=radiusPx*(0.72+0.12*h4);

        const flicker=(frame+i+layer)%3;
        let colorIndex=Math.round(
          heat*(flamePalette.length-1)+
          (flicker===0 ? 1 : flicker===2 ? -1 : 0)
        );
        colorIndex=Math.max(0,Math.min(flamePalette.length-1,colorIndex));
        const [r,g,b]=flamePalette[colorIndex];

        /* Outer lobes are intentionally fully opaque in the current experiment. */
        const alpha=1;

        bodyCtx.fillStyle=`rgba(${r},${g},${b},${alpha})`;
        bodyCtx.beginPath();
        bodyCtx.ellipse(
          c.x+ox,
          c.y-z+oy,
          radiusPx,
          ry,
          0,
          0,
          Math.PI*2
        );
        bodyCtx.fill();

        /* Small inner glow volume on hotter lobes; still spherical, no squares. */
        if(heat>0.50 && h1>0.42){
          const innerAlpha=1;
          bodyCtx.fillStyle=`rgba(255,232,112,${innerAlpha})`;
          bodyCtx.beginPath();
          bodyCtx.ellipse(
            c.x+ox-radiusPx*0.14,
            c.y-z+oy-ry*0.16,
            radiusPx*0.58,
            ry*0.54,
            0,
            0,
            Math.PI*2
          );
          bodyCtx.fill();
        }
      }
    }
  }

  const silhouetteCanvas=document.createElement("canvas");
  silhouetteCanvas.width=bodyCanvas.width;
  silhouetteCanvas.height=bodyCanvas.height;
  const silhouetteCtx=silhouetteCanvas.getContext("2d");
  silhouetteCtx.imageSmoothingEnabled=false;
  silhouetteCtx.drawImage(bodyCanvas,0,0);
  silhouetteCtx.globalCompositeOperation="source-in";
  silhouetteCtx.fillStyle="rgba(0,0,0,1)";
  silhouetteCtx.fillRect(0,0,silhouetteCanvas.width,silhouetteCanvas.height);
  silhouetteCtx.globalCompositeOperation="source-over";

  /*
    R143: build a true OUTSIDE-only outline ring. R141/R142 stamped the whole
    black silhouette behind the translucent body, so the black interior showed
    through the flame and made transparency look like darkening. We now dilate
    the silhouette by 2 px, then subtract the original silhouette from it.
  */
  const outlineCanvas=document.createElement("canvas");
  outlineCanvas.width=bodyCanvas.width;
  outlineCanvas.height=bodyCanvas.height;
  const outlineCtx=outlineCanvas.getContext("2d");
  outlineCtx.imageSmoothingEnabled=false;

  for(let dy=-2;dy<=2;dy++){
    for(let dx=-2;dx<=2;dx++){
      if(dx===0 && dy===0) continue;
      if((dx*dx)+(dy*dy)>4) continue;
      outlineCtx.drawImage(silhouetteCanvas,dx,dy);
    }
  }

  outlineCtx.globalCompositeOperation="destination-out";
  outlineCtx.drawImage(silhouetteCanvas,0,0);
  outlineCtx.globalCompositeOperation="source-over";

  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=0.92*fade;
  ctx.drawImage(outlineCanvas,0,0);
  ctx.globalAlpha=fireballBodyOpacity;
  ctx.drawImage(bodyCanvas,0,0);
  ctx.globalAlpha=1;

  /* Light fire-only grain/dither filter pass. */
  if(growth>0.10 && fade>0){
    const c=hexCenter(fx.x,fx.y);
    const maxRx=radius*HEX_W*1.16*growth;
    const maxRy=Math.max(18,radius*HEX_H*0.92*growth);
    const grainCount=Math.max(70,Math.round(90*growth));
    const grainPalette=[
      [120,24,8,0.08],
      [202,52,10,0.09],
      [255,134,22,0.10],
      [255,221,116,0.08]
    ];
    for(let i=0;i<grainCount;i++){
      const h1=hash01(fx.x+11,fx.y-17,i,3);
      const h2=hash01(fx.x-29,fx.y+7,i,9);
      const h3=hash01(fx.x+53,fx.y+91,i,15);
      const angle=h1*Math.PI*2;
      const rr=Math.sqrt(h2);
      const px=c.x+Math.cos(angle)*maxRx*rr;
      const py=c.y-maxRy*0.70*rr+Math.sin(angle)*maxRy*0.55*rr;
      const size=(h3>0.82 ? 3 : 2);
      const sw=Math.round(size*(0.85+growth*0.30));
      const sh=Math.max(2,Math.round(sw*(0.90+0.22*h1)));
      const [r,g,b]=grainPalette[i%grainPalette.length];
      ctx.fillStyle=`rgba(${r},${g},${b},${0.68*fade})`;
      ctx.fillRect(Math.round(px),Math.round(py),sw,sh);
    }
  }

  /*
    R144: substantially denser Fireball particle field. We keep the same
    deterministic ember/spark behavior, but increase the count by roughly an
    order of magnitude so the blast throws off many more visible motes.
  */
  if(growth>0.08 && fade>0){
    const c=hexCenter(fx.x,fx.y);
    const particleCount=340;
    const blastRadius=spreadRadius*HEX_W*Math.max(0.3,growth);

    for(let i=0;i<particleCount;i++){
      const born=hash01(fx.x+211,fx.y-97,i,7)*0.38;
      const life=Math.max(0,Math.min(1,(t-born)/Math.max(0.01,1-born)));
      if(t<born || life>=1) continue;

      const angle=hash01(fx.x-43,fx.y+67,i,13)*Math.PI*2;
      const speed=0.52+hash01(fx.x+19,fx.y+149,i,23)*0.88;
      const radial=blastRadius*(0.38+life*speed);
      const rise=life*(24+hash01(fx.x+89,fx.y-17,i,31)*42);
      const px=c.x+Math.cos(angle)*radial;
      const py=c.y+Math.sin(angle)*radial*0.56-rise;
      const sizeRoll=hash01(fx.x-131,fx.y+41,i,47);
      const size=sizeRoll>0.92 ? 3 : (sizeRoll>0.48 ? 2 : 1);
      const alpha=Math.max(0,(1-life))*0.72*fade;

      ctx.fillStyle=i%3===0
        ? `rgba(255,236,132,${alpha})`
        : (i%3===1
          ? `rgba(255,132,20,${alpha})`
          : `rgba(196,45,8,${alpha})`);

      if(i%4===0){
        ctx.fillRect(Math.round(px),Math.round(py),size,Math.max(2,size+2));
      }else{
        ctx.fillRect(Math.round(px),Math.round(py),size,size);
      }
    }
  }

  ctx.restore();
}




function drawColorSprayFx(){
  if(!colorSprayFx || !game) return;

  const fx=colorSprayFx;
  const caster=getUnitById(fx.casterId);
  if(!caster || !caster.alive || caster.fled) return;

  const elapsed=Math.max(0,performance.now()-fx.started);
  const frameMs=38;
  const steppedElapsed=Math.floor(elapsed/frameMs)*frameMs;
  const steppedT=Math.max(
    0,
    Math.min(1,steppedElapsed/Math.max(1,fx.duration))
  );

  const growth=Math.min(1,steppedT/0.32);

  const sustainMs=750;
  const fadeMs=750;
  const fadeStart=Math.min(1,sustainMs/Math.max(1,fx.duration));
  const fadeEnd=Math.min(1,(sustainMs+fadeMs)/Math.max(1,fx.duration));
  const inFade=steppedT>=fadeStart;
  const fadeProgress=inFade
    ? Math.max(0,Math.min(1,(steppedT-fadeStart)/Math.max(0.0001,fadeEnd-fadeStart)))
    : 0;
  const baseFade=inFade ? (1-fadeProgress) : 1;

  const source=hexCenter(caster.x,caster.y);
  const start={x:source.x,y:source.y-23};
  const aimCenter=hexCenter(fx.targetHex.x,fx.targetHex.y);
  const aimDx=aimCenter.x-start.x;
  const aimDy=aimCenter.y-start.y;
  const aimLen=Math.hypot(aimDx,aimDy) || 1;
  const dir={x:aimDx/aimLen,y:aimDy/aimLen};
  const normal={x:-dir.y,y:dir.x};

  const cells=(fx.cells || []).map(cell=>{
    const c=hexCenter(cell.x,cell.y);
    const end={x:c.x,y:c.y-13};
    const vx=end.x-start.x;
    const vy=end.y-start.y;
    return {
      ...cell,
      end,
      lateral:vx*normal.x+vy*normal.y,
      forward:vx*dir.x+vy*dir.y,
      distance:hexDistance(caster,cell)
    };
  }).sort((a,b)=>
    a.forward-b.forward ||
    a.lateral-b.lateral ||
    a.x-b.x || a.y-b.y
  );

  if(!cells.length) return;

  const colors=[
    [255,24,52],   // red
    [255,120,0],   // orange
    [255,230,0],   // yellow
    [48,245,70],   // green
    [0,220,255],   // blue-cyan
    [32,88,255],   // indigo
    [196,22,255]   // violet
  ];

  function hash01(a,b,c,d=0){
    let n=(
      Math.imul((a|0)+71,73856093) ^
      Math.imul((b|0)-37,19349663) ^
      Math.imul((c|0)+19,83492791) ^
      Math.imul((d|0)+7,2654435761)
    )>>>0;
    n^=n>>>13;
    n=Math.imul(n,1274126177)>>>0;
    n^=n>>>16;
    return (n>>>0)/4294967295;
  }

  function lerp(a,b,t){
    return a+(b-a)*t;
  }

  function fillStar(cx,cy,rOuter,rInner,points,color,alpha){
    ctx.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
    ctx.beginPath();
    for(let i=0;i<points*2;i++){
      const angle=(-Math.PI/2)+(Math.PI*i/points);
      const r=i%2===0 ? rOuter : rInner;
      const x=cx+Math.cos(angle)*r;
      const y=cy+Math.sin(angle)*r;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
  }

  const minLat=cells[0].lateral;
  const maxLat=cells[cells.length-1].lateral;
  const latSpan=Math.max(1,maxLat-minLat);
  const furthest=Math.max(...cells.map(c=>c.forward));
  const frontProgress=Math.max(0.18,growth);
  const frontCenter={
    x:start.x+dir.x*furthest*frontProgress,
    y:start.y+dir.y*furthest*frontProgress - 6.0*frontProgress
  };
  const frontWidth=(latSpan+HEX_W*1.16)*(0.26+0.74*growth);
  const bandWidth=frontWidth/colors.length;

  const strobeSeed=Math.floor(steppedElapsed/frameMs);
  const strobeRand=hash01(fx.targetHex.x+311,fx.targetHex.y-127,strobeSeed,17);
  const strobePulse=inFade
    ? (strobeRand>0.72 ? 1.0 : (strobeRand>0.44 ? 0.42 : 0.12))
    : 1;
  const fade=baseFade*strobePulse;

  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.imageSmoothingEnabled=false;
  ctx.lineCap='butt';
  ctx.lineJoin='miter';

  /*
    R148: simplify Color Spray into seven broad, separate, solid rainbow arcs.
    Each rainbow color gets exactly one major band/arc rather than many mixed
    streaks or particle clouds.
  */
  for(let i=0;i<colors.length;i++){
    const color=colors[i];
    const t=(i+0.5)/colors.length;
    const offset=lerp(-0.5,0.5,t)*frontWidth;
    const bulge=offset*0.14;

    const sx=start.x + normal.x*offset*0.08;
    const sy=start.y + normal.y*offset*0.05;
    const ex=frontCenter.x + normal.x*offset;
    const ey=frontCenter.y + normal.y*offset*0.32;
    const cx1=sx + dir.x*(furthest*0.28*growth) + normal.x*bulge;
    const cy1=sy + dir.y*(furthest*0.28*growth) + normal.y*bulge*0.38;
    const cx2=sx + dir.x*(furthest*0.74*growth) + normal.x*bulge*1.35;
    const cy2=sy + dir.y*(furthest*0.74*growth) + normal.y*bulge*0.48;

    /* Broad solid band. */
    ctx.strokeStyle=`rgba(${color[0]},${color[1]},${color[2]},${0.68*fade})`;
    ctx.lineWidth=Math.max(8,bandWidth*0.92);
    ctx.beginPath();
    ctx.moveTo(sx,sy);
    ctx.bezierCurveTo(cx1,cy1,cx2,cy2,ex,ey);
    ctx.stroke();

    /* Narrower brighter core inside the same single-color arc. */
    ctx.strokeStyle=`rgba(${Math.min(255,color[0]+28)},${Math.min(255,color[1]+28)},${Math.min(255,color[2]+28)},${0.88*fade})`;
    ctx.lineWidth=Math.max(3,bandWidth*0.36);
    ctx.beginPath();
    ctx.moveTo(sx,sy);
    ctx.bezierCurveTo(cx1,cy1,cx2,cy2,ex,ey);
    ctx.stroke();
  }

  /* Preserve the hand-origin radial feel, but only with the seven rainbow colors. */
  for(let i=0;i<colors.length;i++){
    const color=colors[i];
    const spread=(i-(colors.length-1)/2)/((colors.length-1)/2 || 1);
    const angle=Math.atan2(dir.y,dir.x)+spread*0.30;
    const len=furthest*(0.90+0.06*Math.abs(spread))*growth;
    ctx.strokeStyle=`rgba(${color[0]},${color[1]},${color[2]},${0.80*fade})`;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(start.x,start.y);
    ctx.lineTo(start.x+Math.cos(angle)*len,start.y+Math.sin(angle)*len);
    ctx.stroke();
  }

  /* Compact source star instead of any oval bloom. */
  fillStar(start.x,start.y,7*Math.max(0.35,growth),2.6*Math.max(0.35,growth),4,[255,240,110],0.54*fade);

  /* A few larger glints along the front edge, one per rainbow band. */
  for(let i=0;i<colors.length;i++){
    const color=colors[i];
    const t=(i+0.5)/colors.length;
    const offset=lerp(-0.5,0.5,t)*frontWidth;
    const px=frontCenter.x + normal.x*offset - dir.x*(4+(i%2)*3);
    const py=frontCenter.y + normal.y*offset*0.32 - dir.y*(3+(i%3)) - 2;
    fillStar(px,py,6+(i%2),2.2,4,color,0.48*fade);
  }

  ctx.restore();
}



function drawMagicEffectFx(){
  if(!magicEffectFx?.length || !game) return;

  const now=performance.now();

  for(const fx of magicEffectFx){
    const unit=getUnitById(fx.unitId);
    if(!unit || unit.fled) continue;

    const local=(now-fx.started)/fx.duration;
    if(local<0 || local>1) continue;

    const c=hexCenter(unit.x,unit.y);
    const fade=Math.sin(Math.PI*local);
    const rise=local*13;
    const centerY=c.y-30-rise*0.25;

    const palette=
      fx.kind==="unconscious"
        ? {
            outer:[255,218,105],
            inner:[244,244,218],
            sparkA:[255,236,153],
            sparkB:[255,255,224]
          }
        : fx.kind==="confusion"
          ? {
              outer:[197,103,255],
              inner:[88,224,255],
              sparkA:[231,151,255],
              sparkB:[121,239,255]
            }
          : {
              outer:[132,188,255],
              inner:[201,145,255],
              sparkA:[231,199,255],
              sparkB:[174,224,255]
            };

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";

    /* Strong application rings. */
    const ringRadius=10+local*12;
    ctx.strokeStyle=`rgba(${palette.outer[0]},${palette.outer[1]},${palette.outer[2]},${0.78*fade})`;
    ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.ellipse(c.x,centerY,ringRadius,ringRadius*0.48,0,0,Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle=`rgba(${palette.inner[0]},${palette.inner[1]},${palette.inner[2]},${0.60*fade})`;
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.ellipse(c.x,centerY,ringRadius*0.66,ringRadius*0.32,0,0,Math.PI*2);
    ctx.stroke();

    /* Orbiting application sparkles. */
    for(let i=0;i<6;i++){
      const angle=local*Math.PI*3.2+(Math.PI*2*i/6);
      const orbit=12+(i%2)*5;
      const sx=c.x+Math.cos(angle)*orbit;
      const sy=centerY+Math.sin(angle)*orbit*0.55-(i%3)*2;
      const size=1.7+(i%2)*0.9;
      const col=i%2 ? palette.sparkA : palette.sparkB;

      ctx.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},${0.90*fade})`;
      ctx.beginPath();
      ctx.moveTo(sx,sy-size*2);
      ctx.lineTo(sx+size*0.55,sy-size*0.55);
      ctx.lineTo(sx+size*2,sy);
      ctx.lineTo(sx+size*0.55,sy+size*0.55);
      ctx.lineTo(sx,sy+size*2);
      ctx.lineTo(sx-size*0.55,sy+size*0.55);
      ctx.lineTo(sx-size*2,sy);
      ctx.lineTo(sx-size*0.55,sy-size*0.55);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    /* Kind-specific application symbol. */
    if(fx.kind==="sleep"){
      ctx.save();
      ctx.font='bold 12px "AdventureGoldBox", "Lucida Console", monospace';
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.lineWidth=2.5;
      ctx.strokeStyle=`rgba(14,9,24,${0.85*fade})`;
      ctx.fillStyle=`rgba(213,190,255,${0.95*fade})`;
      const zX=c.x+13+local*5;
      const zY=c.y-43-local*16;
      ctx.strokeText("Z",zX,zY);
      ctx.fillText("Z",zX,zY);
      ctx.restore();
    }else if(fx.kind==="unconscious"){
      drawStatusStar(c.x+12+local*3,c.y-44-local*9,3.8,`rgba(255,231,135,${0.95*fade})`,`rgba(20,13,5,${0.86*fade})`);
      drawStatusStar(c.x-11-local*2,c.y-39-local*5,2.8,`rgba(255,250,211,${0.88*fade})`,`rgba(20,13,5,${0.80*fade})`);
    }else if(fx.kind==="confusion"){
      ctx.save();
      ctx.font='bold 13px "AdventureGoldBox", "Lucida Console", monospace';
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.lineWidth=2.8;
      ctx.strokeStyle=`rgba(9,7,16,${0.88*fade})`;
      ctx.fillStyle=`rgba(220,146,255,${0.94*fade})`;
      const qX=c.x+Math.cos(local*Math.PI*3.2)*15;
      const qY=c.y-43+Math.sin(local*Math.PI*3.2)*6-local*6;
      ctx.strokeText("?",qX,qY);
      ctx.fillText("?",qX,qY);
      ctx.restore();
    }
  }
}

function drawStatusStar(x,y,radius,fill,stroke){
  ctx.save();
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const angle=-Math.PI/2+i*Math.PI/5;
    const r=i%2===0 ? radius : radius*0.42;
    const px=x+Math.cos(angle)*r;
    const py=y+Math.sin(angle)*r;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.closePath();
  ctx.fillStyle=fill;
  ctx.fill();
  ctx.strokeStyle=stroke;
  ctx.lineWidth=1.2;
  ctx.stroke();
  ctx.restore();
}

/*
  R105 persistent status presentation.
  Sleep, unconsciousness, confusion, and taunt share one requestAnimationFrame
  loop, but each status gets a distinct visual language. The loop runs only while
  at least one visible unit actually carries one of these debuffs.
*/
function persistentSleepUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive && !unit.fled && !!getUnitEffect(unit,"sleep")
  );
}

function persistentUnconsciousUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive && !unit.fled && !!getUnitEffect(unit,"unconscious")
  );
}

function persistentConfusionUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    !!(
      getUnitEffect(unit,"confusion") ||
      getUnitEffect(unit,"confused")
    )
  );
}

function persistentTauntUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    !!getUnitEffect(unit,"taunt")
  );
}

function persistentShieldUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    !!getUnitEffect(unit,"shield")
  );
}

function persistentLightUnits(){
  if(!game || game.over) return [];
  return allUnits().filter(unit=>
    unit?.alive &&
    !unit.fled &&
    !!getUnitEffect(unit,"light")
  );
}

function hasPersistentStatusFx(){
  return (
    persistentSleepUnits().length>0 ||
    persistentUnconsciousUnits().length>0 ||
    persistentConfusionUnits().length>0 ||
    persistentTauntUnits().length>0 ||
    persistentShieldUnits().length>0 ||
    persistentLightUnits().length>0 ||
    illuminationAreaEffects().length>0
  );
}

function drawPersistentSleepStatusFx(){
  const sleepers=persistentSleepUnits();
  if(!sleepers.length) return;

  const now=performance.now();

  for(let index=0;index<sleepers.length;index++){
    const unit=sleepers[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;
    const c=hexCenter(unit.x,unit.y);
    const phase=(now/1000)+(index*0.31);
    const pulse=(Math.sin(phase*Math.PI*2*0.62)+1)/2;
    const centerY=c.y-29;

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";

    const ringRadius=11+pulse*2.5;
    ctx.strokeStyle=`rgba(126,181,255,${0.18+pulse*0.12})`;
    ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.ellipse(c.x,centerY,ringRadius,ringRadius*0.43,0,0,Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle=`rgba(205,157,255,${0.12+pulse*0.10})`;
    ctx.lineWidth=1.1;
    ctx.beginPath();
    ctx.ellipse(c.x,centerY,ringRadius*0.68,ringRadius*0.28,0,0,Math.PI*2);
    ctx.stroke();

    for(let mote=0;mote<2;mote++){
      const angle=phase*1.45+mote*Math.PI;
      const mx=c.x+Math.cos(angle)*14;
      const my=centerY+Math.sin(angle)*6;
      ctx.fillStyle=`rgba(191,220,255,${0.26+pulse*0.12})`;
      ctx.beginPath();
      ctx.arc(mx,my,1.3,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();

    const drift=((now + index*370)%1800)/1800;
    const zX=c.x+13+drift*5;
    const zY=c.y-42-drift*13;
    const zFade=Math.sin(Math.PI*drift);

    ctx.save();
    ctx.font='bold 11px "AdventureGoldBox", "Lucida Console", monospace';
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.lineWidth=2.6;
    ctx.strokeStyle=`rgba(8,6,14,${0.74*zFade})`;
    ctx.fillStyle=`rgba(207,190,255,${0.68*zFade})`;
    ctx.strokeText("Z",zX,zY);
    ctx.fillText("Z",zX,zY);
    ctx.restore();
  }
}

function drawPersistentUnconsciousStatusFx(){
  const units=persistentUnconsciousUnits();
  if(!units.length) return;

  const now=performance.now();

  for(let index=0;index<units.length;index++){
    const unit=units[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;
    const c=hexCenter(unit.x,unit.y);
    const phase=(now/1000)+(index*0.27);
    const pulse=(Math.sin(phase*Math.PI*2*0.48)+1)/2;
    const centerY=c.y-31;

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.strokeStyle=`rgba(255,226,122,${0.13+pulse*0.09})`;
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.ellipse(c.x,centerY,12+pulse*2,5.5+pulse,0,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();

    /* Classic slow orbiting stars, visually distinct from Sleep's Zs. */
    for(let star=0;star<3;star++){
      const angle=phase*1.55+(Math.PI*2*star/3);
      const sx=c.x+Math.cos(angle)*14;
      const sy=centerY+Math.sin(angle)*5.8-(star===1 ? 2 : 0);
      const brightness=0.72+0.18*Math.sin(phase*2.3+star);
      drawStatusStar(
        sx,
        sy,
        star===0 ? 3.2 : 2.6,
        `rgba(255,232,135,${brightness})`,
        `rgba(12,8,3,${Math.min(0.88,brightness+0.10)})`
      );
    }
  }
}

function drawPersistentConfusionStatusFx(){
  const units=persistentConfusionUnits();
  if(!units.length) return;

  const now=performance.now();

  for(let index=0;index<units.length;index++){
    const unit=units[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;
    const c=hexCenter(unit.x,unit.y);
    const phase=(now/1000)+(index*0.33);
    const wobble=Math.sin(phase*Math.PI*2*0.80);
    const centerY=c.y-31;

    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";

    ctx.strokeStyle=`rgba(194,105,255,${0.21+0.06*Math.abs(wobble)})`;
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.ellipse(c.x+wobble*2.3,centerY,13.5,5.4,0.16*wobble,0,Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle=`rgba(91,225,255,${0.15+0.05*(1-Math.abs(wobble))})`;
    ctx.lineWidth=1.1;
    ctx.beginPath();
    ctx.ellipse(c.x-wobble*1.5,centerY+1,9.0,3.8,-0.18*wobble,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();

    /* Two counter-rotating question marks. */
    for(let q=0;q<2;q++){
      const direction=q===0 ? 1 : -1;
      const angle=phase*1.65*direction+q*Math.PI;
      const qx=c.x+Math.cos(angle)*14;
      const qy=centerY+Math.sin(angle)*6-3;
      const alpha=0.72+0.16*Math.sin(phase*2.5+q);

      ctx.save();
      ctx.font='bold 11px "AdventureGoldBox", "Lucida Console", monospace';
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.lineWidth=2.4;
      ctx.strokeStyle=`rgba(8,6,14,${Math.min(0.90,alpha+0.10)})`;
      ctx.fillStyle=q===0
        ? `rgba(220,145,255,${alpha})`
        : `rgba(110,232,255,${alpha})`;
      ctx.strokeText("?",qx,qy);
      ctx.fillText("?",qx,qy);
      ctx.restore();
    }
  }
}




/*
  R194 persistent Shield spell VFX.

  Shield remains mechanically frontal exactly as before. The VFX reads the
  unit's live six-direction facing every frame and positions a translucent
  magical barrier slightly forward of the unit's sprite. The barrier scales
  with Enlarge presentation size but never changes the unit's occupied hexes.
*/
/*
  R195 persistent Light spell combat VFX.
  The terrain-light pool is handled by the illumination system; this layer is
  the visible magical source attached to the affected unit.
*/
function drawPersistentLightSpellFx(){
  const units=persistentLightUnits();
  if(!units.length) return;

  const now=performance.now();

  for(let index=0;index<units.length;index++){
    const unit=units[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;

    const c=unitFootprintScreenCenter(unit);
    const scale=Math.max(1,enlargeVisualScale(unit));
    const phase=(now/1000)+(index*0.37);
    const pulse=(Math.sin(phase*Math.PI*2*0.72)+1)/2;
    const centerY=c.y-22*scale;

    ctx.save();
    ctx.globalCompositeOperation="lighter";

    /* Soft body halo. */
    const glowRadius=(18+3*pulse)*scale;
    const gradient=ctx.createRadialGradient(
      c.x,
      centerY,
      1,
      c.x,
      centerY,
      glowRadius
    );
    gradient.addColorStop(
      0,
      `rgba(255,255,226,${0.22+0.08*pulse})`
    );
    gradient.addColorStop(
      0.42,
      `rgba(255,238,154,${0.13+0.05*pulse})`
    );
    gradient.addColorStop(
      1,
      "rgba(255,226,110,0)"
    );

    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.arc(c.x,centerY,glowRadius,0,Math.PI*2);
    ctx.fill();

    /* Four restrained rays keep the effect readable as magical light. */
    ctx.strokeStyle=`rgba(255,249,205,${0.20+0.12*pulse})`;
    ctx.lineWidth=1.1*scale;

    for(let ray=0;ray<4;ray++){
      const angle=(Math.PI/2)*ray+phase*0.22;
      const inner=(10+2*pulse)*scale;
      const outer=(16+4*pulse)*scale;

      ctx.beginPath();
      ctx.moveTo(
        c.x+Math.cos(angle)*inner,
        centerY+Math.sin(angle)*inner
      );
      ctx.lineTo(
        c.x+Math.cos(angle)*outer,
        centerY+Math.sin(angle)*outer
      );
      ctx.stroke();
    }

    /* Slow orbiting motes. */
    for(let mote=0;mote<3;mote++){
      const angle=
        phase*1.35+
        (Math.PI*2*mote/3);
      const orbit=(13+(mote%2)*4)*scale;
      const mx=c.x+Math.cos(angle)*orbit;
      const my=centerY+Math.sin(angle)*orbit*0.58;

      ctx.fillStyle=`rgba(255,255,222,${0.62+0.18*pulse})`;
      ctx.beginPath();
      ctx.arc(mx,my,1.2*scale,0,Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }
}


function drawPersistentShieldSpellFx(){
  const units=persistentShieldUnits();
  if(!units.length) return;

  const now=performance.now();

  for(let index=0;index<units.length;index++){
    const unit=units[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;

    const center=unitFootprintScreenCenter(unit);
    const facingIndex=facingDirectionIndex(unit);
    const dir=HEX_DIRS[facingIndex] || HEX_DIRS[0];
    const originHex=hexCenter(unit.x,unit.y);
    const forwardHex=hexCenter(unit.x+dir.x,unit.y+dir.y);

    let fx=forwardHex.x-originHex.x;
    let fy=forwardHex.y-originHex.y;
    const fLen=Math.hypot(fx,fy)||1;
    fx/=fLen;
    fy/=fLen;

    /* Tangent across the barrier's face in screen space. */
    const tx=-fy;
    const ty=fx;

    const scale=Math.max(1,enlargeVisualScale(unit));
    const pulse=(Math.sin((now/1000)*Math.PI*2*0.82+(index*0.41))+1)/2;
    const shimmer=(Math.sin((now/1000)*Math.PI*2*1.65+(index*0.73))+1)/2;

    /*
      The shield sits ahead of the unit, centered around chest height.
      Slight vertical lift keeps it visually attached to the sprite rather than
      looking like a ground decal.
    */
    const forwardOffset=(22+2*pulse)*scale;
    const lift=22*scale;
    const cx=center.x+fx*forwardOffset;
    const cy=center.y+fy*forwardOffset-lift;

    const halfWidth=(10.5+1.2*pulse)*scale;
    const halfHeight=(18.5+1.0*shimmer)*scale;

    const top={x:cx,y:cy-halfHeight};
    const upperRight={
      x:cx+tx*halfWidth,
      y:cy+ty*halfWidth-halfHeight*0.26
    };
    const lowerRight={
      x:cx+tx*halfWidth*0.78,
      y:cy+ty*halfWidth*0.78+halfHeight*0.44
    };
    const bottom={
      x:cx,
      y:cy+halfHeight
    };
    const lowerLeft={
      x:cx-tx*halfWidth*0.78,
      y:cy-ty*halfWidth*0.78+halfHeight*0.44
    };
    const upperLeft={
      x:cx-tx*halfWidth,
      y:cy-ty*halfWidth-halfHeight*0.26
    };

    ctx.save();
    ctx.lineJoin="round";
    ctx.lineCap="round";

    /* Soft outer aura behind the crisp shield silhouette. */
    ctx.globalCompositeOperation="lighter";
    ctx.shadowColor="rgba(165,225,255,0.72)";
    ctx.shadowBlur=8+4*pulse;
    ctx.fillStyle=`rgba(142,215,255,${0.055+0.025*pulse})`;
    ctx.strokeStyle=`rgba(214,245,255,${0.22+0.10*pulse})`;
    ctx.lineWidth=3.2*scale;

    ctx.beginPath();
    ctx.moveTo(top.x,top.y);
    ctx.lineTo(upperRight.x,upperRight.y);
    ctx.lineTo(lowerRight.x,lowerRight.y);
    ctx.lineTo(bottom.x,bottom.y);
    ctx.lineTo(lowerLeft.x,lowerLeft.y);
    ctx.lineTo(upperLeft.x,upperLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* Main translucent magical pane. */
    ctx.shadowBlur=0;
    ctx.globalCompositeOperation="source-over";
    ctx.fillStyle=`rgba(122,211,244,${0.12+0.035*pulse})`;
    ctx.strokeStyle=`rgba(225,251,255,${0.42+0.16*pulse})`;
    ctx.lineWidth=1.45*scale;

    ctx.beginPath();
    ctx.moveTo(top.x,top.y);
    ctx.lineTo(upperRight.x,upperRight.y);
    ctx.lineTo(lowerRight.x,lowerRight.y);
    ctx.lineTo(bottom.x,bottom.y);
    ctx.lineTo(lowerLeft.x,lowerLeft.y);
    ctx.lineTo(upperLeft.x,upperLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /*
      Inner highlight arc gives the pane curvature and a subtle shimmer without
      turning it into an opaque physical shield.
    */
    ctx.strokeStyle=`rgba(255,255,255,${0.20+0.22*shimmer})`;
    ctx.lineWidth=0.9*scale;
    ctx.beginPath();
    ctx.moveTo(
      top.x+tx*halfWidth*0.18,
      top.y+halfHeight*0.20
    );
    ctx.quadraticCurveTo(
      cx+tx*halfWidth*0.28,
      cy,
      bottom.x+tx*halfWidth*0.08,
      bottom.y-halfHeight*0.24
    );
    ctx.stroke();

    /* Small traveling glint across the upper rim. */
    const glintT=((now/850)+(index*0.29))%1;
    const gx=
      upperLeft.x+
      (upperRight.x-upperLeft.x)*glintT;
    const gy=
      upperLeft.y+
      (upperRight.y-upperLeft.y)*glintT;

    ctx.globalCompositeOperation="lighter";
    ctx.fillStyle=`rgba(255,255,255,${0.40+0.30*shimmer})`;
    ctx.beginPath();
    ctx.arc(gx,gy,1.35*scale,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
}


function drawPersistentTauntStatusFx(){
  const units=persistentTauntUnits();
  if(!units.length) return;

  const now=performance.now();

  for(let index=0;index<units.length;index++){
    const unit=units[index];
    if(!shouldRenderUnitUnderPartyVisibility(unit)) continue;
    const c=hexCenter(unit.x,unit.y);
    const phase=(now/1000)+(index*0.29);
    const pulse=(Math.sin(phase*Math.PI*2*1.15)+1)/2;

    /* R107: rollback the anger symbol and use a simple centered exclamation point. */
    const bob=Math.sin(phase*Math.PI*2*1.15)*1.5;
    const alpha=0.82+0.14*pulse;
    const exX=c.x;
    const exY=c.y-45+bob;

    ctx.save();
    ctx.font='bold 12px "AdventureGoldBox", "Lucida Console", monospace';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.lineWidth=2.8;
    ctx.strokeStyle=`rgba(10,5,4,${Math.min(0.95,alpha+0.08)})`;
    ctx.fillStyle=`rgba(255,102,48,${alpha})`;
    ctx.strokeText('!',exX,exY);
    ctx.fillText('!',exX,exY);
    ctx.restore();
  }
}



function persistentStatusFxTick(){
  persistentStatusFxFrame=null;

  if(
    currentScreen!=="combat" ||
    !game ||
    game.over ||
    !hasPersistentStatusFx()
  ){
    return;
  }

  draw();
  persistentStatusFxFrame=requestAnimationFrame(persistentStatusFxTick);
}

function ensurePersistentStatusFxLoop(){
  if(
    persistentStatusFxFrame!==null ||
    currentScreen!=="combat" ||
    !game ||
    game.over ||
    !hasPersistentStatusFx()
  ){
    return false;
  }

  persistentStatusFxFrame=requestAnimationFrame(persistentStatusFxTick);
  return true;
}

function drawFireDamageFx(){
  if(!game || !fireDamageFx.length) return;

  const now=performance.now();

  for(const fx of fireDamageFx){
    const unit=getUnitById(fx.unitId);
    if(!unit || unit.fled) continue;

    const age=Math.max(0,now-fx.started);
    const t=Math.max(0,Math.min(1,age/Math.max(1,fx.duration)));
    if(t>=1) continue;

    const c=hexCenter(unit.x,unit.y);
    const fade=t<0.62 ? 1 : Math.max(0,1-(t-0.62)/0.38);
    const intensity=Math.max(0.7,Number(fx.intensity)||1);
    const frame=Math.floor(age/70);

    ctx.save();
    ctx.globalAlpha=fade;
    ctx.imageSmoothingEnabled=false;

    const flames=[
      {x:-7,y:0,h:13,w:7,phase:0,color:"#d52b08",inner:"#ff8a13"},
      {x:0,y:-2,h:18,w:8,phase:2,color:"#ed3e08",inner:"#ffd44d"},
      {x:7,y:1,h:12,w:6,phase:4,color:"#b91f07",inner:"#ff7410"}
    ];

    for(const flame of flames){
      const flicker=((frame+flame.phase)%3)-1;
      const height=flame.h*intensity+flicker*2;
      const width=flame.w*intensity;
      const baseY=c.y-5;
      const x=c.x+flame.x;

      ctx.fillStyle=flame.color;
      ctx.beginPath();
      ctx.moveTo(x-width/2,baseY);
      ctx.quadraticCurveTo(x-width*0.72,baseY-height*0.43,x+flicker,baseY-height);
      ctx.quadraticCurveTo(x+width*0.72,baseY-height*0.42,x+width/2,baseY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle=flame.inner;
      ctx.beginPath();
      ctx.moveTo(x-width*0.25,baseY-1);
      ctx.quadraticCurveTo(x-width*0.20,baseY-height*0.28,x+1,baseY-height*0.58);
      ctx.quadraticCurveTo(x+width*0.25,baseY-height*0.22,x+width*0.18,baseY-1);
      ctx.closePath();
      ctx.fill();
    }

    /*
      R144: increase the victim-side fire motes by roughly an order of magnitude
      so fire hits shed many more visible embers.
    */
    for(let i=0;i<50;i++){
      const seed=(i*37+fx.unitId.length*19+frame*11)%101;
      const ex=c.x-12+(seed%25)+((i%5)-2)*1.4;
      const ey=c.y-14-((seed*7+i*5)%18)-t*(8+(i%4));
      const size=i%11===0 ? 3 : 2;
      const alpha=0.38+0.62*(1-t);
      ctx.fillStyle=i%3===0
        ? `rgba(255,179,33,${alpha})`
        : (i%3===1
          ? `rgba(255,90,11,${alpha})`
          : `rgba(216,42,7,${alpha})`);
      ctx.fillRect(Math.round(ex),Math.round(ey),size,size);
    }

    ctx.restore();
  }
}

function drawAreaDamageFx(){
  if(!areaDamageFx || !game) return;

  const unit=getUnitById(areaDamageFx.unitId);
  if(!unit || unit.fled) return;

  const c=hexCenter(unit.x,unit.y);

  if(areaDamageFx.kind==="fireball"){
    /*
      Legacy R86 marker retained for compatibility with old/generic calls.
      R93 Fireball itself no longer invokes this per-unit damage marker.
    */
    const bob=(Math.floor(performance.now()/120)%2)*2;
    const x=c.x;
    const y=c.y-47-bob;

    ctx.save();
    ctx.shadowColor="rgba(255,70,0,0.75)";
    ctx.shadowBlur=8;
    drawFireballGlyph(x,y,1.45);
    ctx.restore();
  }
}

function drawDeathFx(){
  if(!deathFx) return;
  if(!deathMarkerSprite.complete || !deathMarkerSprite.naturalWidth) return;

  const deathSubject={
    id:deathFx.unitId,
    footprintId:deathFx.footprintId || "single",
    facingHex:deathFx.facingHex,
    x:deathFx.x,
    y:deathFx.y
  };

  if(
    game?.condition==="wall" &&
    !occupiedHexes(deathSubject).some(cell=>
      isHexVisibleToFriendlyParty(cell.x,cell.y)
    )
  ){
    return;
  }
  const c=unitFootprintScreenCenter(deathSubject);
  const elapsed=performance.now()-deathFx.started;

  if(elapsed<0 || elapsed>1000) return;

  /* Preserve the original flash cadence at roughly 8 Hz. */
  const visible=Math.floor(elapsed/125)%2===0;
  if(!visible) return;

  const x=c.x;
  const y=c.y-25;
  const deathDims=spriteRenderDimensions("death-marker",deathMarkerSprite,40,40);
  const drawW=deathDims.width;
  const drawH=deathDims.height;
  const renderSource=deathMarkerSprite._crispRenderSource || deathMarkerSprite;

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.shadowColor="rgba(0,0,0,0.9)";
  ctx.shadowBlur=7;
  ctx.drawImage(
    renderSource,
    x-Math.round(drawW/2),
    y-Math.round(drawH/2),
    drawW,
    drawH
  );
  ctx.restore();
}


function showUnitBarks(units,text,durationMs=3000){
  const until=performance.now()+durationMs;

  for(const unit of units || []){
    if(!unit?.alive || unit.fled) continue;

    unit.barkText=text;
    unit.barkUntil=until;
  }

  if(unitBarkClearTimer){
    clearTimeout(unitBarkClearTimer);
  }

  unitBarkClearTimer=setTimeout(()=>{
    unitBarkClearTimer=null;
    draw();
  },durationMs+30);

  draw();
}

function drawWhiteBattlefieldText(textValue,x,y,{fontSize=14,maxWidth=null}={}){
  if(!textValue) return;

  ctx.save();
  ctx.font=`${fontSize}px "AdventureGoldBox", "Gold Box", "GoldBox", "Lucida Console", monospace`;
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineWidth=4;
  ctx.lineJoin="round";
  ctx.strokeStyle="#000";
  ctx.fillStyle="#fff";

  if(Number.isFinite(maxWidth)){
    ctx.strokeText(textValue,x,y,maxWidth);
    ctx.fillText(textValue,x,y,maxWidth);
  }else{
    ctx.strokeText(textValue,x,y);
    ctx.fillText(textValue,x,y);
  }

  ctx.restore();
}

function drawAimFriendlyFireWarning(){
  if(!aimMode || !pendingAimAction) return;
  if(game?.condition==="wall" && !isHexVisibleToWallTestObserver(aimCursor.x,aimCursor.y)) return;

  const preview=aimAreaPreviewForAction(
    pendingAimAction,
    aimCursor
  );

  if(
    !preview ||
    !preview.dangerous ||
    preview.friendlyFireCount<=0
  ){
    return;
  }

  const c=hexCenter(aimCursor.x,aimCursor.y);
  drawWhiteBattlefieldText(
    `FRIENDLY FIRE: ${preview.friendlyFireCount}`,
    c.x,
    Math.round(c.y-38),
    {fontSize:12}
  );
}

function drawUnitBarks(){
  if(!game) return;

  const now=performance.now();

  for(const unit of allUnits()){
    if(
      !unit?.alive ||
      unit.fled ||
      !unit.barkText ||
      !Number.isFinite(unit.barkUntil) ||
      now>=unit.barkUntil
    ){
      continue;
    }

    if(game?.condition==="wall" && !isHexVisibleToWallTestObserver(unit.x,unit.y)){
      continue;
    }

    const c=hexCenter(unit.x,unit.y);
    const textValue=unit.barkText;
    const fontSize=14;
    const yOffset=isKoboldUnit(unit) ? 47 : 58;

    const y=Math.round(c.y-yOffset);

    /*
      R125: all white battlefield speech is rendered through the shared
      foreground text helper so it always has a solid black outline.
    */
    drawWhiteBattlefieldText(
      textValue,
      c.x,
      y,
      {fontSize}
    );
  }
}

function draw(){
  if(!game) return;

  const tiles=visibleHexes();

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawFloor();
  drawWallTestFloorPlan();
  drawArchitecturalWallShadows();

  /*
    R197: outline the union silhouette once before wall bodies enter the shared
    depth queue. Units/fog can still correctly cover the outline afterward.
  */
  drawArchitecturalWallShapeOutline(architecturalWalls);
  drawArchitecturalWallTopOutline(architecturalWalls);

  drawSpellAreaEffects();

  const actors=[];
  const treeDecorations=visibleTreeDecorations(tiles);
  const tileSet=activeCombatTerrainTileSet();

  for(const wall of architecturalWalls){
    const a=screenPointForWorld(wall.a);
    const b=screenPointForWorld(wall.b);
    actors.push({
      sortY:Math.max(a.y,b.y)+0.25,
      sortX:(a.x+b.x)/2,
      fn:()=>drawArchitecturalWallSegment(wall)
    });
  }

  for(const tree of treeDecorations){
    const c=hexCenter(tree.x,tree.y);
    const sortOffset=tree.occupied
      ? (tileSet.treeOccupiedSortOffset ?? -0.25)
      : (tileSet.treeBaseSortOffset ?? 3);

    actors.push({
      sortY:c.y+sortOffset,
      sortX:c.x,
      fn:()=>drawTreeDecoration(tree)
    });
  }

  /*
    R94 volumetric fog participates in the same isometric depth ordering as
    units and trees. Off-map/off-screen fog cells are not rendered, so a wall
    that logically continues beyond the battlefield does not reveal map bounds
    or terrain detail outside the visible play space.
  */
  for(const effect of game.areaEffects || []){
    if(effect.type!=="fog") continue;

    let fogFrontSortY=-Infinity;
    let fogFrontSortX=0;

    for(const cell of effect.cells || []){
      if(
        !inside(cell.x,cell.y) ||
        !isHexOnBattlefieldScreen(cell.x,cell.y,HEX_W)
      ){
        continue;
      }

      const c=hexCenter(cell.x,cell.y);
      fogFrontSortY=Math.max(fogFrontSortY,c.y+0.5);
      fogFrontSortX=c.x;
      actors.push({
        sortY:c.y+0.5,
        sortX:c.x,
        fn:()=>drawFogVolumeCell(cell)
      });
    }

    if(Number.isFinite(fogFrontSortY)){
      actors.push({
        sortY:fogFrontSortY+0.02,
        sortX:fogFrontSortX,
        fn:()=>drawFogEffectOutline(effect)
      });
    }
  }

  if(game.player.alive){
    const c=hexCenter(game.player.x,game.player.y);
    actors.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>drawFighter(game.player)
    });
  }

  for(const ally of game.allies || []){
    if(!ally.alive || ally.fled) continue;

    const c=hexCenter(ally.x,ally.y);

    actors.push({
      sortY:c.y,
      sortX:c.x,
      fn:()=>
        ally.type==="mage"
          ? drawFriendlyMage(ally)
          : drawFriendlyArcher(ally)
    });
  }

  for(const enemy of game.enemies){
    if(!enemy.alive || enemy.fled) continue;
    if(!shouldRenderUnitUnderPartyVisibility(enemy)) continue;

    const depth=unitDepthSortPoint(enemy);

    actors.push({
      sortY:depth.y,
      sortX:depth.x,
      fn:()=>
        enemy.type==="orc"
          ? drawOrc(enemy)
          : enemy.type==="juvenile-red-dragon"
            ? drawLargeTestMob(enemy)
            : drawKobold(enemy)
    });
  }

  actors.sort(
    (a,b)=>a.sortY-b.sortY || a.sortX-b.sortX
  );

  for(const actor of actors){
    actor.fn();
  }

  drawPersistentLightSpellFx();
  drawPersistentShieldSpellFx();
  drawPersistentSleepStatusFx();
  drawPersistentUnconsciousStatusFx();
  drawPersistentConfusionStatusFx();
  drawPersistentTauntStatusFx();
  drawColorSprayFx();
  drawMagicEffectFx();
  drawAreaDamageFx();
  drawDragonBreathFx();
  drawFireballExplosionFx();
  drawFireDamageFx();

  drawProjectileFx();

  /*
    R129: blackout unseen hexes after all physical battlefield layers so units,
    walls, shadows, terrain, and transient effects are concealed together.
    UI/message/text passes remain readable above the visibility mask.
  */
  drawWallTestLineOfSightMask();

  /*
    R133: visible masonry is repainted after the LOS overlay. The darkness
    therefore begins behind the occluding wall face instead of drawing its
    diagonal shadow across the front of a wall the party can actually see.
  */
  drawVisibleArchitecturalWallsOverLOS();

  /* R170 weather is battlefield-only; UI text remains above it. */
  drawWeatherVfx(performance.now());

  /*
    R185: the one-second death marker is tactical foreground feedback rather
    than physical scenery. Draw it after the post-LOS masonry repaint so a
    directly adjacent north wall cannot hide the skull-and-crossbones marker.
    drawDeathFx() still performs its own wall-test visibility check.
  */
  drawDeathFx();
  drawCombatMessageBox();

  /*
    R125: white battlefield text is a dedicated final foreground pass.
    Speech/incantations and friendly-fire warnings are therefore never
    painted beneath other battlefield labels or effects.
  */
  drawUnitBarks();
  drawActivityDetectedFx();
  drawAimFriendlyFireWarning();
}

function flashAttack(attacker,defender,hit){
  const original=ui.turnBanner.textContent;
  const weapon=unitActionWeapon(attacker);

  ui.turnBanner.textContent=hit
    ? `${attacker.name} hits ${defender.name} with ${weapon}`
    : `${attacker.name} misses ${defender.name} with ${weapon}`;

  setTimeout(()=>{
    if(!game.over){
      ui.turnBanner.textContent=original;
    }
  },350);
}

/* ============================================================
   APPLICATION INPUT
   ============================================================ */

function handleLauncherKey(event){
  if(event.key==="ArrowDown"){
    launcherSelection=(launcherSelection+1)%launcherButtons.length;
    updateLauncherSelection();
    event.preventDefault();
    return;
  }

  if(event.key==="ArrowUp"){
    launcherSelection=(launcherSelection-1+launcherButtons.length)%launcherButtons.length;
    updateLauncherSelection();
    event.preventDefault();
    return;
  }

  if(event.key==="Enter"){
    event.preventDefault();
    activateLauncherSelection();
  }
}

function handleCombatKey(event){
  const code=event.code;
  const keyLower=event.key.toLowerCase();

  const directions={
    "KeyD":{x: 1,y: 0},
    "Numpad6":{x: 1,y: 0},

    "KeyW":{x: 1,y:-1},
    "Numpad9":{x: 1,y:-1},

    "KeyE":{x: 0,y:-1},
    "Numpad7":{x: 0,y:-1},

    "KeyS":{x:-1,y: 0},
    "Numpad4":{x:-1,y: 0},

    "KeyZ":{x:-1,y: 1},
    "Numpad1":{x:-1,y: 1},

    "KeyX":{x: 0,y: 1},
    "Numpad3":{x: 0,y: 1}
  };

  const arrowAliases={
    "ArrowLeft":{x:-1,y:0},
    "ArrowRight":{x:1,y:0},
    "ArrowUp":{x:1,y:-1},
    "ArrowDown":{x:-1,y:1}
  };

  if(event.key==="Escape"){
    event.preventDefault();

    const canceledQuick=cancelAllQuickCommands(
      quickCommandUnitIds.size ? "Quick canceled for all player-controlled characters." : ""
    );

    if(spellCastOverlayOpen){
      closeSpellCastOverlay();
      return;
    }

    if(characterSheetOpen){
      closeCharacterSheet();
      return;
    }

    if(classReportOpen){
      closeClassReport();
      return;
    }

    if(isSpellTargetingMode()){
      exitAimMode(false,true);
      setCombatMessage("Spell casting aborted.");
      refreshTurnBanner();
      updateUi();
      draw();
      return;
    }

    if(exitAimMode()){
      return;
    }

    if(canceledQuick){
      return;
    }

    showLauncher();
    return;
  }

  if(game && game.round===0){
    event.preventDefault();

    if(
      (event.code==="Space" || event.key===" ") &&
      combatOpeningSpeechDone &&
      combatAwaitingStart
    ){
      beginCombatFromPrompt();
    }

    return;
  }

  if(isSpellTargetingMode()){
    if(keyLower==="s" || event.key==="Enter" || event.key===" "){
      event.preventDefault();
      activateAimTarget();
      return;
    }

    if(keyLower==="c"){
      event.preventDefault();
      centerCameraOnAimHex();
      return;
    }

    const spellAimDir=directions[code] || arrowAliases[event.key];
    if(spellAimDir){
      event.preventDefault();
      moveAimCursor(spellAimDir.x,spellAimDir.y);
      return;
    }

    /* While a spell is targeted, unrelated battlefield commands are suppressed. */
    event.preventDefault();
    return;
  }

  if(aimMode){
    if(keyLower==="c"){
      event.preventDefault();
      centerCameraOnAimHex();
      return;
    }

    if(event.key==="Enter" || event.key===" "){
      event.preventDefault();
      activateAimTarget();
      return;
    }

    const dir=directions[code] || arrowAliases[event.key];
    if(dir){
      event.preventDefault();
      moveAimCursor(dir.x,dir.y);
      return;
    }

    /* Ordinary Aim suppresses unrelated battlefield commands. */
    event.preventDefault();
    return;
  }

  if(keyLower==="q"){
    event.preventDefault();
    activateQuickCommand();
    return;
  }

  /* C is the Character command. */
  if(keyLower==="c"){
    event.preventDefault();

    if(classReportOpen){
      return;
    }

    if(characterSheetOpen){
      closeCharacterSheet();
    }else{
      openCharacterSheet();
    }

    return;
  }

  if(classReportOpen || characterSheetOpen || spellCastOverlayOpen){
    return;
  }

  if(keyLower==="a"){
    event.preventDefault();

    if(spellCastInProgress){
      return;
    }

    if(aimMode){
      exitAimMode(true,true);
    }else{
      enterAimMode();
    }

    return;
  }

  if(keyLower==="r"){
    event.preventDefault();
    newGame(selectedCombatCondition);
    return;
  }

  if(game && game.over) return;

  const dir=directions[code] || arrowAliases[event.key];

  if(dir){
    event.preventDefault();
    tryPlayerMove(dir.x,dir.y);
    return;
  }

  if(event.key===" "){
    event.preventDefault();
    playerDone();
    return;
  }

  if(keyLower==="g"){
    event.preventDefault();
    chooseGuard();
  }
}



function handleCombatConditionsKey(event){
  if(event.key==="Escape"){
    event.preventDefault();
    showLauncher();
    return;
  }

  if(event.key==="ArrowLeft" || event.key==="ArrowRight" || event.key==="ArrowUp" || event.key==="ArrowDown"){
    event.preventDefault();
    selectedCombatCondition=selectedCombatCondition==="grass" ? "wall" : "grass";
    updateCombatConditionSelection();
    return;
  }

  if(event.key==="Enter"){
    event.preventDefault();
    showCombat(selectedCombatCondition);
  }
}

function handleXpLootKey(event){
  if(event.key==="Escape"){
    event.preventDefault();
    showLauncher();
  }
}

function handleSpellBookKey(event){
  if(event.key==="Escape"){
    event.preventDefault();
    showLauncher();
  }
}

function handleClassBookKey(event){
  if(event.key==="Escape"){
    event.preventDefault();
    showLauncher();
  }
}

function handlePixelKey(event){
  if(event.key==="Escape"){
    event.preventDefault();
    showLauncher();
    return;
  }

  const keyLower=event.key.toLowerCase();

  if(keyLower==="p"){
    event.preventDefault();
    setPixelEditorTool("pencil");
  }else if(keyLower==="e"){
    event.preventDefault();
    setPixelEditorTool("eraser");
  }
}

document.addEventListener("keydown",(event)=>{
  if(currentScreen==="launcher"){
    handleLauncherKey(event);
  }else if(currentScreen==="combat"){
    handleCombatKey(event);
  }else if(currentScreen==="combat-conditions"){
    handleCombatConditionsKey(event);
  }else if(currentScreen==="xp-loot"){
    handleXpLootKey(event);
  }else if(currentScreen==="pixel"){
    handlePixelKey(event);
  }else if(currentScreen==="spellbook"){
    handleSpellBookKey(event);
  }else if(currentScreen==="classbook"){
    handleClassBookKey(event);
  }
});


function canvasEventPoint(event){
  const rect=canvas.getBoundingClientRect();
  return {
    x:(event.clientX-rect.left)*(canvas.width/rect.width),
    y:(event.clientY-rect.top)*(canvas.height/rect.height)
  };
}

canvas.addEventListener("mousemove",(event)=>{
  const p=canvasEventPoint(event);
  const h=hexAtCanvasPoint(p.x,p.y);
  hoverHex=inside(h.x,h.y) ? h : null;

  /*
    In AIM mode, mouse hover drives the same target cursor used by
    keyboard aiming. The AoE footprint therefore previews live before
    the player clicks to commit the spell.
  */
  if(aimMode && hoverHex){
    aimCursor.x=hoverHex.x;
    aimCursor.y=hoverHex.y;
    updateUi();
  }

  draw();
});

canvas.addEventListener("mouseleave",()=>{
  hoverHex=null;
  draw();
});

canvas.addEventListener("wheel",(event)=>{
  if(
    currentScreen==="combat" &&
    aimMode &&
    pendingAimAction?.spellId==="wall-of-fog"
  ){
    event.preventDefault();
    rotateWallOfFogAimOrientation(event.deltaY>0 ? 1 : -1);
  }
},{passive:false});

canvas.addEventListener("click",(event)=>{
  if(currentScreen!=="combat" || game?.over) return;

  if(game?.round===0){
    return;
  }

  const p=canvasEventPoint(event);
  const h=hexAtCanvasPoint(p.x,p.y);

  if(!h || !inside(h.x,h.y)) return;

  if(aimMode){
    aimCursor.x=h.x;
    aimCursor.y=h.y;
    maybeRecenterCamera(aimCursor);
    updateUi();
    draw();

    const aimedUnit=unitAtHex(h.x,h.y);

    if(
      pendingAimAction ||
      (
        aimedUnit &&
        activePlayerControlledUnit() &&
        aimedUnit.faction!==activePlayerControlledUnit().faction &&
        hexDistance(activePlayerControlledUnit(),aimedUnit)===1
      )
    ){
      activateAimTarget();
    }
    return;
  }

  if(!activePlayerControlledUnit()) return;

  /* Movement click:
     compute a route to the clicked destination and take exactly
     one legal step along it. A new click recomputes the route. */
  clickPathStep(h);
});

ui.restartButton.addEventListener("click",()=>newGame(selectedCombatCondition));

document.getElementById("aimButton").addEventListener("click",()=>{
  if(
    game?.round===0 &&
    (!combatOpeningSpeechDone || combatAwaitingStart)
  ){
    return;
  }

  if(aimMode){
    exitAimMode(true,true);
  }else{
    enterAimMode();
  }
});

document.getElementById("aimCenterButton").addEventListener("click",()=>{
  centerCameraOnAimHex();
});

document.getElementById("doneButton").addEventListener("click",()=>{
  if(
    game?.round===0 &&
    combatOpeningSpeechDone &&
    combatAwaitingStart
  ){
    beginCombatFromPrompt();
    return;
  }

  playerDone();
});

document.getElementById("waitButton").addEventListener("click",waitCurrentUnit);
document.getElementById("guardButton").addEventListener("click",chooseGuard);
document.getElementById("quickButton").addEventListener("click",()=>{
  const activePc=activePlayerControlledUnit();
  if(activePc && isQuickCommandUnit(activePc)){
    cancelQuickCommandForUnit(activePc,`${activePc.name} leaves Quick mode.`);
  }else{
    activateQuickCommand();
  }
});

document.getElementById("castButton").addEventListener("click",()=>{
  if(isSpellTargetingMode()){
    activateAimTarget();
    return;
  }

  if(spellCastOverlayOpen){
    closeSpellCastOverlay();
  }else{
    openSpellCastOverlay();
  }
});

document.getElementById("closeSpellCastButton").addEventListener("click",closeSpellCastOverlay);

document.getElementById("spellCastList").addEventListener("click",(event)=>{
  const button=event.target.closest("[data-cast-spell]");
  if(!button) return;

  beginSelectedCombatSpell(button.dataset.castSpell);
});

document.getElementById("sheetButton").addEventListener("click",()=>{
  if(characterSheetOpen){
    closeCharacterSheet();
  }else{
    openCharacterSheet();
  }
});

document.getElementById("closeSheetButton").addEventListener("click",closeCharacterSheet);

document.getElementById("sheetInventory").addEventListener("click",(event)=>{
  const useButton=event.target.closest("[data-use-index]");
  if(useButton){
    const index=Number(useButton.dataset.useIndex);
    if(Number.isNaN(index)) return;
    useInventoryItem(index);
    return;
  }

  const equipButton=event.target.closest("[data-equip-index]");
  if(!equipButton) return;

  const index=Number(equipButton.dataset.equipIndex);
  if(Number.isNaN(index)) return;
  toggleInventoryEquip(index);
});

document.getElementById("closeClassButton").addEventListener("click",closeClassReport);

document.getElementById("spellbookReturnButton").addEventListener("click",showLauncher);
document.getElementById("classbookReturnButton").addEventListener("click",showLauncher);

document.getElementById("classbookTabs").addEventListener("click",(event)=>{
  const button=event.target.closest("[data-class-id]");
  if(!button) return;
  renderClassBook(button.dataset.classId);
});

document.getElementById("spellbookTabs").addEventListener("click",(event)=>{
  const button=event.target.closest("[data-spell-level]");
  if(!button) return;

  const level=Number(button.dataset.spellLevel);
  if(!Number.isFinite(level)) return;

  renderSpellBook(level);
});

document.getElementById("returnButton").addEventListener("click",()=>{
  if(quickCommandUnitIds.size){
    cancelAllQuickCommands("Quick canceled for all player-controlled characters.");
    return;
  }

  if(isSpellTargetingMode()){
    exitAimMode(false,true);
    setCombatMessage("Spell casting aborted.");
    refreshTurnBanner();
    updateUi();
    draw();
    return;
  }

  if(!exitAimMode()){
    showLauncher();
  }
});

document.getElementById("testSfxButton").addEventListener("click",async(event)=>{
  event.preventDefault();
  event.stopPropagation();
  await playSfxTestSequence();
});

updateAudioIndicators();


window.addEventListener("error",(event)=>{
  if(currentScreen!=="combat") return;

  console.error("Adventure Party runtime error:",event.error || event.message);

  const banner=document.getElementById("turnBanner");
  if(banner){
    banner.textContent="RUNTIME ERROR";
  }

  const logBox=document.getElementById("combatLog");
  if(logBox){
    const line=document.createElement("div");
    line.className="log-line bad";
    line.textContent="Runtime error: "+event.message;
    logBox.appendChild(line);
    pinCombatLogToBottom();
  }
});

window.addEventListener("unhandledrejection",(event)=>{
  if(currentScreen!=="combat") return;

  console.error("Adventure Party rejected promise:",event.reason);

  const banner=document.getElementById("turnBanner");
  if(banner){
    banner.textContent="RUNTIME ERROR";
  }

  const logBox=document.getElementById("combatLog");
  if(logBox){
    const line=document.createElement("div");
    line.className="log-line bad";
    line.textContent="Runtime error: "+(event.reason?.message || String(event.reason));
    logBox.appendChild(line);
    pinCombatLogToBottom();
  }
});

fitBattleCanvas();

/* Try to start title music. Browser policy may leave it suspended;
   the first keyboard or pointer input then unlocks the SAME context. */
ensureAudioContext();

if(audioCtx && audioCtx.state==="running"){
  audioReady=true;
  startTitleMusic();
}

updateAudioIndicators();
window.addEventListener("DOMContentLoaded",()=>{
  verifyLocalGoldBoxFont();
});

/* R107 reusable persistent debuff VFX hook: Sleep, Unconscious, Confusion, Taunt. */
window.AdventurePartyStatusFx={
  applyConfusionEffect,
  applyUnconsciousEffect,
  animateStatusApplicationFx:animateMagicEffectOnUnits,
  persistentTauntUnits,
  ensurePersistentStatusFxLoop
};
