const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true});try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8276/index.html');await page.waitForFunction(()=>typeof showCombat==='function');await page.evaluate(()=>showCombat('grass'));await page.waitForFunction(()=>game?.player&&combatGpu);
const result=await page.evaluate(async()=>{
 if(aiTimer){clearTimeout(aiTimer);aiTimer=null;}game.enemies=[];game.allies=[];game.active=game.player.id;game.round=1;game.over=false;game.player.turnMoves=0;game.player.move=12;game.player.halfMove=6;game.player.fullMove=false;
 combatOpeningSpeechDone=true;combatAwaitingStart=false;hoverHex=null;aimMode=false;
 if(combatTacticalGridVisible())throw Error('Idle grid visible');hoverHex={x:game.player.x,y:game.player.y};if(!combatTacticalGridVisible())throw Error('Selection grid absent');
 const reachable=combatReachableMovement(game.player),target=[...reachable.values()].find(n=>n.steps===3);if(!target)throw Error('No test route');
 await presentCombatFrame();const start={x:game.player.x,y:game.player.y};await clickPathStep(target);
 if(game.player.x!==target.x||game.player.y!==target.y||game.player.turnMoves!==3)throw Error('Destination not reached '+JSON.stringify({unit:game.player.x,target:target.x,moves:game.player.turnMoves}));
 hoverHex=null;await presentCombatFrame();if(combatTacticalGridVisible())throw Error('Idle grid remains');aimMode=true;if(!combatTacticalGridVisible())throw Error('Aiming grid absent');aimMode=false;
 return {start,end:{x:game.player.x,y:game.player.y},steps:game.player.turnMoves};});
if(errors.length)throw Error(errors.join('\n'));console.log('PASS live destination movement and contextual grid',JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
