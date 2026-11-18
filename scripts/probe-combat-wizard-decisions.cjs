const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8276/index.html');await page.click('[data-screen="combat"]');await page.waitForFunction(()=>typeof updateCombatMobSelection==='function');
 await page.evaluate(()=>{combatIncludeCarl=false;combatMobRoster[0].count=2;combatMobRoster[1].type='mob:wood-elf-mage';combatMobRoster[1].count=1;updateCombatMobSelection();});await page.click('#beginBattleButton');
 await page.waitForFunction(()=>['ready','failed'].includes(document.querySelector('#combatPreparation')?.dataset.state),null,{timeout:120000});if(await page.locator('#combatPreparation').getAttribute('data-state')==='failed')throw Error(await page.locator('#combatPreparation').innerText());
 const results=await page.evaluate(async()=>{
  const mage=allUnits().find(u=>u.classId==='mage'),enemies=allUnits().filter(u=>u.faction!==mage.faction);const origin={x:mage.x,y:mage.y};
  game.round=1;game.active=mage.id;combatAwaitingStart=false;endTurn=()=>{};mage.workshopBehavior={...mage.workshopBehavior,spellExplain:true};mage.turnMoves=0;
  mage.hp=2;mage.maxHp=12;mage.memorizedSpellIds=['shield'];mage.workshopSpellCasterLevels.shield=5;
  enemies[0].x=origin.x+1;enemies[0].y=origin.y;enemies[1].x=origin.x+12;enemies[1].y=origin.y;
  const defenseResult=await repositoryCasterTurn(mage),defense={scenario:'cornered wounded wizard',handled:defenseResult,shield:!!getUnitEffect(mage,'shield'),remaining:[...mage.memorizedSpellIds],decision:mage.lastSpellAiDecision};
  mage.hp=12;mage.turnMoves=0;mage.memorizedSpellIds=['sleep'];mage.workshopSpellCasterLevels.sleep=5;game.active=mage.id;
  enemies[0].x=origin.x+4;enemies[0].y=origin.y;enemies[1].x=origin.x+4;enemies[1].y=origin.y+1;
  const controlResult=await repositoryCasterTurn(mage),control={scenario:'grouped orcs',handled:controlResult,sleeping:enemies.filter(u=>getUnitEffect(u,'sleep')).length,remaining:[...mage.memorizedSpellIds],decision:mage.lastSpellAiDecision};
  return [defense,control];
 });console.log(JSON.stringify({results,errors},null,2));if(errors.length||!results[0].shield||results[0].remaining.length||!results[1].sleeping||results[1].remaining.length)throw Error('Wizard live decision/effect verification failed');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
