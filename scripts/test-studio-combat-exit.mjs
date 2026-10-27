import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing production function ${name}`);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, `Unterminated production function ${name}`);
  return source.slice(start, end + 2);
}
const returnStart = source.indexOf('document.getElementById("returnButton").addEventListener("click",()=>{');
assert.ok(returnStart >= 0);
const returnHandler = source.slice(returnStart, source.indexOf('\n});', returnStart) + 4);
const functions = [
  'isStudioTestCombat', 'studioReturnUrl', 'returnToStudioFromCombat', 'exitCombat', 'scheduleCombatFinish',
  'finishCombat', 'checkCombatVictory', 'checkPartyDefeat', 'handleCombatKey', 'handleCombatConditionsKey'
];
const restoreUrl = './3d-studio.html?studioRestore=1';
function harness(studioTest, spriteSetId = 'studio-kobold') {
  const calls = { navigation: [], loot: [], xp: [], timers: [], cleared: [], launcher: 0, charms: 0, updates: 0 };
  const sandbox = {
    game: {
      studioSpriteTest: studioTest, over: false, active: 'player', xpPool: 100,
      player: { id: 'player', name: 'Carl', alive: true, hp: 20, maxHp: 50, stats: { str: 18 } },
      enemies: [{ alive: false, spriteSetId }]
    },
    // Routing must follow the battle even when a later setup selection differs.
    selectedMobEncounter: studioTest ? 'orcs' : 'studio-kobold',
    currentScreen: 'combat', combatAwaitingStart: true, aiTimer: 41, deathFx: {},
    inventoryOpen: false, closeInventory: ()=>{},
    quickCommandUnitIds: new Set(), quickCommandActive: true, quickCommandUnitId: 'player',
    quickCommandGeneration: 1, quickCommandRunning: true,
    FIGHTER_CLASS: { primeRequisiteXpBonusThreshold: 16 },
    window: { location: { assign: url => calls.navigation.push(url) } },
    document: { getElementById: () => ({ addEventListener: (event, callback) => { calls.returnClick = callback; } }) },
    setTimeout: (callback, delay) => { calls.timers.push({ callback, delay }); return calls.timers.length; },
    clearTimeout: id => calls.cleared.push(id),
    restoreAllCharmPersonAllegiances: () => { calls.charms++; },
    awardFighterXp: amount => { calls.xp.push(amount); return ' XP awarded.'; },
    showXpLootScreen: (...args) => calls.loot.push(args),
    updateUi: () => { calls.updates++; },
    ui: { turnBanner: {}, resultOverlay: { classList: { remove() {} } } },
    spellCastOverlayOpen: false, characterSheetOpen: false, classReportOpen: false,
    cancelAllQuickCommands: () => false, isSpellTargetingMode: () => false, exitAimMode: () => false,
    console, URLSearchParams
  };
  sandbox.activeEnemies = () => sandbox.game.enemies.filter(unit => unit.alive);
  sandbox.livingPartyMembers = () => sandbox.game.player.alive ? [sandbox.game.player] : [];
  sandbox.showLauncher = () => { calls.launcher++; sandbox.currentScreen = 'launcher'; };
  vm.createContext(sandbox);
  vm.runInContext(functions.map(productionFunction).join('\n') + '\n' + returnHandler, sandbox);
  return { sandbox, calls };
}
const escape = () => ({ key: 'Escape', code: 'Escape', preventDefault() {} });

for (const setId of ['studio-kobold', 'sprite-set:imported-orc-leader']) {
  for (const outcome of ['victory', 'defeat']) {
    const { sandbox, calls } = harness(true, setId);
    if (outcome === 'defeat') sandbox.game.player.alive = false;
    assert.equal(outcome === 'victory' ? sandbox.checkCombatVictory() : sandbox.checkPartyDefeat(), true);
    assert.deepEqual(calls.navigation, [restoreUrl], `${setId} ${outcome} returns immediately`);
    assert.equal(calls.timers.length, 0, 'Studio tests do not wait for the ordinary death-effect delay');
    assert.deepEqual(calls.loot, []);
    assert.deepEqual(calls.xp, [], 'Studio tests bypass XP awards as well as the loot screen');
    assert.equal(sandbox.game.over, true);
    assert.equal(sandbox.game.active, null);
    assert.equal(sandbox.combatAwaitingStart, false);
    assert.equal(calls.charms, 1);
    assert.ok(calls.cleared.includes(41));
    sandbox.finishCombat('Victory', 'Repeated completion');
    sandbox.exitCombat();
    assert.deepEqual(calls.navigation, [restoreUrl], 'Repeated completion or exit cannot trigger another navigation');
  }
  for (const method of ['keyboard', 'button']) {
    const { sandbox, calls } = harness(true, setId);
    if (method === 'keyboard') sandbox.handleCombatKey(escape());
    else calls.returnClick();
    assert.deepEqual(calls.navigation, [restoreUrl], `${method} exits a studio test, including the pre-combat inspection`);
    assert.equal(calls.launcher, 0);
  }
}

for (const outcome of ['victory', 'defeat']) {
  const { sandbox, calls } = harness(false, 'sprite-set:art-used-in-an-ordinary-encounter');
  if (outcome === 'defeat') sandbox.game.player.alive = false;
  assert.equal(outcome === 'victory' ? sandbox.checkCombatVictory() : sandbox.checkPartyDefeat(), true);
  assert.deepEqual(calls.navigation, []);
  assert.equal(calls.timers.length, 1);
  assert.equal(calls.timers[0].delay, 1000, 'Ordinary combat retains its death-effect delay');
  calls.timers[0].callback();
  assert.equal(calls.loot.length, 1, 'Ordinary combat still opens its results and loot screen');
  assert.deepEqual(calls.xp, outcome === 'victory' ? [100] : []);
  assert.equal(calls.loot[0][2], outcome === 'victory' ? 110 : 0);
}

for (const method of ['keyboard', 'button']) {
  const { sandbox, calls } = harness(false);
  if (method === 'keyboard') sandbox.handleCombatKey(escape());
  else calls.returnClick();
  assert.equal(calls.launcher, 1);
  assert.deepEqual(calls.navigation, []);
}

// Opening or backing out of setup is not ending a test, even if the previous
// battle was a studio test or the six-facing preset is currently selected.
for (const previousBattle of [null, { studioSpriteTest: true }]) {
  const { sandbox, calls } = harness(true);
  sandbox.game = previousBattle;
  sandbox.currentScreen = 'combat-conditions';
  sandbox.handleCombatConditionsKey(escape());
  assert.equal(calls.launcher, 1);
  assert.deepEqual(calls.navigation, []);
}

for (const staleState of ['new-battle', 'launcher']) {
  const { sandbox, calls } = harness(false);
  sandbox.checkCombatVictory();
  if (staleState === 'new-battle') sandbox.game = { studioSpriteTest: true, over: false };
  else sandbox.currentScreen = 'launcher';
  calls.timers[0].callback();
  assert.deepEqual(calls.loot, [], 'A delayed previous outcome must not replace the current screen');
  assert.deepEqual(calls.navigation, []);
}

console.log('Studio combat exit: built-in/imported victory, defeat, manual exits, single navigation, ordinary XP/loot, fresh setup, and stale completion guards passed.');

const scoped=harness(true);
scoped.sandbox.window.location.search='?studioSprite=draft&model=orc-leader-male-uniformed&poseLibrary=humanoid-medium';
scoped.sandbox.exitCombat();
assert.equal(scoped.calls.navigation[0],'./3d-studio.html?studioRestore=1&model=orc-leader-male-uniformed&poseLibrary=humanoid-medium','Combat returns to the exact scoped model workspace');
