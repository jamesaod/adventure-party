import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SPRITE_LAYOUT_PRESETS, SPRITE_LEGACY_LAYOUT_PRESETS, SPRITE_LAYOUTS, SPRITE_MOBS, spriteLayoutOffsets } from '../js/sprite-layouts.mjs';

const allLayoutPresets = [...SPRITE_LAYOUT_PRESETS, ...SPRITE_LEGACY_LAYOUT_PRESETS];

// Run the game's actual footprint, movement, factory, and rendering functions.
const source = fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing production function ${name}`);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, `Unterminated production function ${name}`);
  return source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 2);
}
function productionDeclaration(name, endMarker = '\n};') {
  const start = source.indexOf(`const ${name}=`);
  assert.ok(start >= 0, `Missing production data ${name}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `Unterminated production data ${name}`);
  return source.slice(start, end + endMarker.length);
}
const directions = ['E', 'NE', 'NW', 'W', 'SW', 'SE'];
const vectors = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const walls = new Set(), occupied = new Set(), blockedEdges = new Set();
const image = { complete: true, naturalWidth: 320, naturalHeight: 280 };
const draws = [];
const project = (x, y) => ({ x: 64 * (x + y / 2), y: 31.5 * y });
const sandbox = {
  HEX_DIRS: directions.map((name, index) => ({ name, x: vectors[index][0], y: vectors[index][1] })),
  UNIT_FOOTPRINTS: { single: SPRITE_LAYOUTS.single, hex7: SPRITE_LAYOUTS.hex7 },
  STUDIO_FOOTPRINTS: new Map(allLayoutPresets.map(layout => [layout.id, layout])),
  UNIT_POSE_DEFINITIONS: {},
  registeredStudioSpriteSets: new Map(), selectedStudioSpriteSetId: 'studio-kobold', selectedCombatCondition: 'grass',
  selectedStudioPlayerSpriteSets: new Map(), persistentFighter: null, structuredClone,
  studioSpriteLoading: { state: 'ready' },
  lastMobDeployment: null,
  inside: (x, y) => x >= -12 && x <= 12 && y >= -12 && y <= 12,
  isWall: (x, y) => walls.has(`${x},${y}`),
  occupiedByAnyUnit: (x, y) => occupied.has(`${x},${y}`),
  architecturalWallBlocksStep: (a, b) => blockedEdges.has(`${a.x},${a.y}>${b.x},${b.y}`),
  hexCenter: project,
  d: sides => Math.ceil(sides / 2),
  roll3d6: () => 12,
  game: { active: null, condition: 'grass' },
  drawHpBar() {}, drawActiveHex() {},
  ctx: { save() {}, restore() {}, fill() {}, stroke() {} },
  polygonPath() {}, hexScreenVertices: () => [], isHexVisibleToFriendlyParty: () => true,
  directionalUnitPoseFrame: () => ({ image, assetId: 'sample' }),
  spriteRenderDimensions: () => ({ width: 96, height: 84 }),
  runtimeAnchorForAsset: () => ({ x: 0.5, y: 0.7 }),
  drawSpriteFacing: (img, center, width, height, facing, nativeFacing, unit, anchor) => draws.push({ center, width, height, anchor }),
  console
};
const functions = [
  'key', 'hexDistance', 'facingDirectionIndex', 'hexDirectionIndexToward', 'unitPoseDefinition',
  'unitFootprintDefinition', 'rotateAxialOffset', 'footprintOffsetsForFacing', 'occupiedHexesAt',
  'occupiedHexes', 'unitFootprintCellCount', 'unitOccupiesHex', 'unitFootprintScreenCenter',
  'unitDistance', 'canUnitStandAt', 'canUnitRotateAt', 'unitTransitionBlocked', 'updateFacingForStep', 'faceEntityToward',
  'searchRotatingFootprintPath', 'pathToHex', 'axialDisk',
  'makeKobold', 'makeKoboldBodyguard', 'makeKoboldSlinger', 'makeOrc', 'makeOrcLeader', 'makeOrcShaman',
  'makeLargeMobTest', 'makeStudioTestMob', 'makeStudioKoboldEncounter', 'makeStudioPlayerOpponents', 'drawStudioSpriteMob',
  'drawFighter', 'drawFriendlyArcher', 'drawFriendlyMage',
  'isStudioPlayerSpriteTarget', 'playerSpriteSetForType', 'applyPlayerSpriteSet',
  'makeFighter', 'makeFriendlyElvenRanger', 'makeTestPartyMage', 'clamp',
  'conHpAdjustment', 'strengthMods', 'syncFighterEquipment', 'calculateArmorClass', 'dexterityAdjustments',
  'getWeaponCatalogEntry', 'getArmorCatalogEntry', 'getSpellEntry',
  'applyFighterClassRules', 'fighterLevelData', 'warriorSavingThrows',
  'animateEntitySteps', 'animateMobAlongPath', 'tryPlayerMove'
];
vm.createContext(sandbox);
// Use the actual class progression, equipment, and spell-book implementations
// so a player target cannot silently become a Kobold with a different label.
const mageStart = source.indexOf('const MAGE_CLASS=');
const mageEnd = source.indexOf('function levelUpMage(', mageStart);
const spellStart = source.indexOf('const SPELL_CATALOG=');
const spellEnd = source.indexOf('function getSpellEntry(', spellStart);
vm.runInContext([
  ...['RULESET', 'FIGHTER_CLASS', 'WEAPON_CATALOG', 'ARMOR_CATALOG', 'DEXTERITY_TABLE'].map(name => productionDeclaration(name)),
  productionDeclaration('FIGHTER_LEVELS', '\n];'),
  source.slice(mageStart, mageEnd), source.slice(spellStart, spellEnd),
  ...functions.map(productionFunction)
].join('\n'), sandbox);
const plain = value => JSON.parse(JSON.stringify(value));

// All six rotations agree with the shared studio layout, retain cell count,
// and project the sprite onto the actual footprint's centroid.
for (const layout of allLayoutPresets) {
  const setId = `test-${layout.id}`;
  sandbox.UNIT_POSE_DEFINITIONS[setId] = { spriteLayout: layout };
  const unit = { id: setId, spriteSetId: setId, x: 2, y: 3, alive: true, facing: 'left' };
  for (let facingHex = 0; facingHex < 6; facingHex++) {
    unit.facingHex = facingHex;
    const offsets = sandbox.footprintOffsetsForFacing(unit);
    assert.deepEqual(plain(offsets), spriteLayoutOffsets(layout.id, facingHex));
    assert.equal(new Set(offsets.map(cell => `${cell.x},${cell.y}`)).size, layout.offsets.length);
    const cells = sandbox.occupiedHexes(unit);
    assert.equal(cells.length, layout.offsets.length);
    const expected = cells.map(cell => project(cell.x, cell.y));
    const centroid = {
      x: expected.reduce((sum, point) => sum + point.x, 0) / cells.length,
      y: expected.reduce((sum, point) => sum + point.y, 0) / cells.length
    };
    assert.deepEqual(plain(sandbox.unitFootprintScreenCenter(unit)), centroid);
    draws.length = 0;
    sandbox.drawStudioSpriteMob(unit);
    assert.deepEqual(plain(draws[0]), { center: centroid, width: 96, height: 84, anchor: { x: 0.5, y: 0.7 } });
    for (const drawPlayer of ['drawFighter', 'drawFriendlyArcher', 'drawFriendlyMage']) {
      draws.length = 0;
      sandbox[drawPlayer]({ ...unit, faction: 'player' });
      assert.deepEqual(plain(draws[0]), { center: centroid, width: 96, height: 84, anchor: { x: 0.5, y: 0.7 } },
        `${drawPlayer} renders imported frames at the complete footprint centroid`);
    }
  }
}
assert.deepEqual(plain(sandbox.rotateAxialOffset({ x: 1, y: 0 }, 1)), { x: 1, y: -1 }, 'E rotates toward NE');
assert.equal(sandbox.unitFootprintCellCount({ footprintId: 'trapezoid5' }), 5, 'Death and effect proxies that copy only footprintId retain the registered shape');

const wide = { id: 'wide', spriteSetId: 'test-wide2', x: 0, y: 0, facingHex: 0, facing: 'right' };
walls.add('2,0');
assert.equal(sandbox.unitTransitionBlocked(wide, wide, { x: 1, y: 0 }), true, 'A clear pivot does not permit its second occupied cell inside a wall');
walls.clear();
occupied.add('2,0');
assert.equal(sandbox.unitTransitionBlocked(wide, wide, { x: 1, y: 0 }), true, 'All destination cells avoid other creatures');
occupied.clear();
walls.add('1,-1');
assert.equal(sandbox.updateFacingForStep(wide, 1, -1), false, 'Turning cannot put the outer cell into a wall');
assert.equal(wide.facingHex, 0);
sandbox.faceEntityToward(wide, { x: 1, y: -1 });
assert.equal(wide.facingHex, 0, 'An attack that cannot turn keeps its existing legal facing');
assert.equal(sandbox.canUnitRotateAt(wide, 0, 0, 3), true, 'An open alternative half-turn is allowed');
walls.add('0,1');
assert.equal(sandbox.canUnitRotateAt(wide, 0, 0, 3), false, 'Both blocked half-turn sweeps must prevent a turn');
walls.clear();
blockedEdges.add('1,0>1,-1');
assert.equal(sandbox.canUnitRotateAt(wide, 0, 0, 1), false, 'A rotation cannot cross an architectural wall between cells');
blockedEdges.clear();

// A blocked initial turn requires an actual route around the obstruction.
walls.add('1,-1');
const path = sandbox.pathToHex(wide, { x: 0, y: -1 }, wide);
assert.ok(path.length > 2, 'Orientation-aware search finds a detour instead of an illegal direct turn');
assert.deepEqual(plain(path.at(-1)).x, 0);
assert.deepEqual(plain(path.at(-1)).y, -1);
for (let i = 1; i < path.length; i++) {
  assert.equal(sandbox.unitTransitionBlocked(wide, path[i - 1], path[i], path[i].facingHex), false);
  for (const cell of sandbox.occupiedHexesAt(wide, path[i].x, path[i].y, path[i].facingHex)) {
    assert.equal(walls.has(`${cell.x},${cell.y}`), false);
  }
}
walls.clear();

// Existing nonrotating single and seven-cell creatures retain their footprint
// regardless of sprite facing and still reject an obstructed destination.
const legacySingle = { id: 'single', x: 0, y: 0, facingHex: 0 };
const legacyDragon = { id: 'dragon', x: 0, y: 0, footprintId: 'hex7', facingHex: 0 };
for (const unit of [legacySingle, legacyDragon]) {
  const original = plain(sandbox.occupiedHexes(unit));
  for (let facingHex = 0; facingHex < 6; facingHex++) {
    unit.facingHex = facingHex;
    assert.deepEqual(plain(sandbox.occupiedHexes(unit)), original);
  }
}
walls.add('2,0');
assert.equal(sandbox.unitTransitionBlocked(legacyDragon, legacyDragon, { x: 1, y: 0 }), true);
assert.equal(sandbox.unitTransitionBlocked(legacySingle, legacySingle, { x: 1, y: 0 }), false);
walls.clear();

const expectedMobs = {
  kobold: { ac: 7, thaco: 20, move: 6, hitDiceValue: 0.5, weapon: 'Dagger' },
  'kobold-bodyguard': { ac: 6, thaco: 20, move: 6, hitDiceValue: 1, weapon: 'Short Sword' },
  'kobold-slinger': { ac: 7, thaco: 20, move: 6, hitDiceValue: 0.5, rangedWeapon: 'Sling' },
  orc: { ac: 6, thaco: 19, move: 9, hitDiceValue: 1, weapon: 'Scimitar' },
  'orc-leader': { ac: 6, thaco: 19, move: 9, hitDiceValue: 1, weapon: 'Axe, battle' },
  'orc-shaman': { ac: 6, thaco: 19, move: 9, hitDiceValue: 2, priestLevel: 3, weapon: 'Spear' },
  'juvenile-red-dragon': { ac: -3, thaco: 7, move: 9, hitDiceValue: 15, weapon: 'Bite', attacksPerRound: 3 },
  fighter: { ac: 5, thaco: 1, move: 9, level: 20, weapon: 'Flaming Sword +5', controller: 'player', faction: 'player', attacksThisRound: 2 },
  ranger: { ac: 5, thaco: 11, move: 9, level: 10, weapon: 'Short Sword', rangedWeapon: 'Longbow', controller: 'npc', faction: 'player' },
  mage: { ac: 9, thaco: 14, move: 12, level: 20, weapon: 'Staff', controller: 'player', faction: 'player' }
};
// Every layout can use every existing MOB factory without substituting Kobold
// rules. Placement reserves all occupied cells, including Carl's starting cell.
for (const mob of SPRITE_MOBS) {
  for (const layout of allLayoutPresets) {
    const id = `test-${mob.id}-${layout.id}`;
    sandbox.UNIT_POSE_DEFINITIONS[id] = { spriteLayout: layout };
    sandbox.registeredStudioSpriteSets.set(id, { id, manifestId: id, label: 'Imported test', mobType: mob.id, layoutId: layout.id, footprintCells: layout.offsets.length });
    sandbox.selectedStudioSpriteSetId = id;
    if (mob.targetKind === 'player') sandbox.selectedStudioPlayerSpriteSets.set(mob.id, id);
    const player = sandbox.makeFighter();
    const units = sandbox.makeStudioKoboldEncounter('grass', player);
    assert.equal(units.length, 6);
    assert.deepEqual(plain(units.map(unit => unit.facingHex)), [0, 1, 2, 3, 4, 5]);
    const cells = new Set(sandbox.occupiedHexes(player).map(cell => `${cell.x},${cell.y}`));
    for (const unit of units) {
      assert.equal(unit.type, mob.id);
      for (const [key, value] of Object.entries(expectedMobs[mob.id])) assert.equal(unit[key], value, `${mob.id} preserves ${key}`);
      for (const cell of sandbox.occupiedHexes(unit)) {
        const key = `${cell.x},${cell.y}`;
        assert.equal(cells.has(key), false, `${mob.id}/${layout.id} does not overlap another footprint`);
        assert.equal(sandbox.inside(cell.x, cell.y), true);
        cells.add(key);
      }
    }
    if (mob.targetKind === 'player') {
      const factory = { fighter: 'makeFighter', ranger: 'makeFriendlyElvenRanger', mage: 'makeTestPartyMage' }[mob.id];
      assert.equal(sandbox[factory]().spriteSetId, id, 'The real player factory adopts its selected collection');
      assert.equal(player.id, 'player', 'Inspection copies cannot mutate the persistent player identity');
      for (let i = 1; i < units.length; i++) {
        assert.notEqual(units[i].inventory, units[0].inventory);
        assert.notEqual(units[i].buffs, units[0].buffs);
      }
      if (mob.id === 'fighter') {
        assert.notEqual(units[0].inventory, player.inventory);
        assert.equal(player.spriteSetId, id, 'The actual Carl receives the selected fighter collection');
      }
      if (mob.id === 'mage') {
        assert.ok(units[0].knownSpellIds.includes('magic-missile'));
        assert.equal(units[0].memorizedSpellIds.filter(id => id === 'fireball').length, 5);
      }
      const opponents = sandbox.makeStudioPlayerOpponents([player, ...units]);
      assert.equal(opponents.length, 6);
      for (const enemy of opponents) {
        assert.equal(enemy.type, 'kobold');
        assert.equal(enemy.controller, 'mob');
        assert.equal(enemy.faction, 'enemy');
        assert.equal(cells.has(`${enemy.x},${enemy.y}`), false, 'Live-combat opponents never overlap the friendly formation');
        cells.add(`${enemy.x},${enemy.y}`);
      }
    }
  }
}

// Free strikes are awaited before movement commits. A rotating attacker can
// occupy the planned destination during that reaction; all movement entry
// points must recheck the complete footprint before changing coordinates.
Object.assign(wide, { alive: true, fullMove: false, turnMoves: 0, halfMove: 3, move: 6 });
Object.assign(sandbox, {
  game: { active: wide.id, over: false },
  createHiddenMobMovementSenseContext: () => ({}),
  performLeavingHexFreeAttacks: async () => { occupied.add('2,0'); return true; },
  activePlayerControlledUnit: () => wide,
  sweepInProgress: false, mobGuardReactionInProgress: false, freeStrikeInProgress: false,
  isCombatActionPauseActive: () => false, enemyAtHex: () => null, log() {}
});
for (const move of [
  () => sandbox.animateEntitySteps(wide, 1, () => ({ x: 1, y: 0 }), 0),
  () => sandbox.animateMobAlongPath(wide, [{ x: 0, y: 0 }, { x: 1, y: 0 }], 1),
  () => sandbox.tryPlayerMove(1, 0)
]) {
  occupied.clear();
  await move();
  assert.deepEqual({ x: wide.x, y: wide.y, facingHex: wide.facingHex }, { x: 0, y: 0, facingHex: 0 },
    'A newly blocked reaction destination prevents both the pivot move and facing change');
}
occupied.clear();

console.log('Studio footprints: seven layouts × six facings, player and monster centroid rendering, blocked rotations/movement and reaction races, orientation-aware detours, legacy occupancy, seven monster factories and three real player classes × layouts, and friendly test opponents passed.');
