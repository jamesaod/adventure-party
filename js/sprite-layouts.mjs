/** Capture formats and tactical footprints shared by the studio and combat. */
export const SPRITE_RESOLUTION = Object.freeze({ min: 50, max: 500, step: 5 });
export const SPRITE_MODEL_SCALE = Object.freeze({ min: 25, max: 2000, step: 5 });
export const SPRITE_HEX_SCALE_PERCENT = 109;

function preset(id, label, baseWidth, baseHeight, renderWidth, renderHeight, rotates, cells) {
  return Object.freeze({
    id, label, baseWidth, baseHeight, renderWidth, renderHeight, rotates,
    offsets: Object.freeze(cells.map(([x, y]) => Object.freeze({ x, y })))
  });
}

// Offsets use the combat board's axial coordinates, relative to its pivot hex.
// The illustrated arrangements are the baseline East-facing footprints.
export const SPRITE_LAYOUT_PRESETS = Object.freeze([
  preset('single', 'Single hex', 160, 200, 48, 60, false, [[0, 0]]),
  preset('triangle3', '3 hexes · triangle', 320, 280, 96, 84, true, [[0, 0], [1, 0], [1, -1]]),
  preset('triangle3-inverted', '3 hexes · inverted triangle', 320, 280, 96, 84, true, [[0, 0], [1, 0], [0, 1]]),
  preset('hex7', '7 hexes · center and ring', 480, 400, 144, 120, false,
    [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]])
]);

// Rev 47 exports and saved workspaces must remain recoverable. These formats
// are deliberately separate from the choices offered for a new sprite set.
export const SPRITE_LEGACY_LAYOUT_PRESETS = Object.freeze([
  preset('wide2', '2 hexes · wide', 320, 200, 96, 60, true, [[0, 0], [1, 0]]),
  preset('trapezoid5', '5 hexes · trapezoid', 480, 320, 144, 96, true,
    [[0, 0], [1, 0], [2, 0], [1, -1], [2, -1]]),
  preset('diamond4', '4 hexes · tall diamond', 320, 480, 96, 144, true,
    [[0, 0], [1, 0], [1, -1], [0, 1]])
]);

export const SPRITE_LAYOUTS = Object.freeze(Object.fromEntries(SPRITE_LAYOUT_PRESETS.map(item => [item.id, item])));
export const SPRITE_LEGACY_LAYOUTS = Object.freeze(Object.fromEntries(SPRITE_LEGACY_LAYOUT_PRESETS.map(item => [item.id, item])));

export const SPRITE_MOBS = Object.freeze([
  { id: 'kobold', label: 'Kobold', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'kobold-bodyguard', label: 'Kobold Body Guard', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'kobold-slinger', label: 'Kobold Slinger', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'orc', label: 'Orc', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'orc-archer', label: 'Orc Archer', modelId:'orc-leader-male-uniformed', package:'data/mobs/orc-archer.unit-package.json', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'orc-leader', label: 'Orc Leader', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'orc-shaman', label: 'Orc Shaman', defaultLayout: 'single', targetKind: 'monster' },
  { id: 'juvenile-red-dragon', label: 'Juvenile Red Dragon', defaultLayout: 'hex7', targetKind: 'monster' },
  { id: 'fighter', label: 'Dungeon Crawler Carl — Fighter (test player)', defaultLayout: 'single', targetKind: 'player' },
  { id: 'ranger', label: 'Elven Ranger — Ranger (test player)', defaultLayout: 'single', targetKind: 'player' },
  { id: 'mage', label: 'Baub — Mage (test player)', defaultLayout: 'single', targetKind: 'player' }
].map(item => Object.freeze(item)));

export function spriteLayout(id = 'single') {
  if (Object.prototype.hasOwnProperty.call(SPRITE_LAYOUTS, id)) return SPRITE_LAYOUTS[id];
  if (Object.prototype.hasOwnProperty.call(SPRITE_LEGACY_LAYOUTS, id)) return SPRITE_LEGACY_LAYOUTS[id];
  throw new Error(`Unknown sprite layout: ${String(id)}.`);
}

export function spriteMob(id = 'kobold') {
  if(id==='library-mob')return {id,label:'MOB Library unit',defaultLayout:'single',targetKind:'monster'};
  const found = SPRITE_MOBS.find(item => item.id === id);
  if (!found) throw new Error(`Unknown sprite MOB: ${String(id)}.`);
  return found;
}

export function createSpriteLayoutMetadata(id = 'single', resolutionPercent = 100) {
  const layout = spriteLayout(id);
  const { min, max, step } = SPRITE_RESOLUTION;
  if (!Number.isInteger(resolutionPercent) || resolutionPercent < min || resolutionPercent > max ||
      (resolutionPercent - min) % step !== 0) {
    throw new Error(`Sprite resolution must be ${min}–${max}% in ${step}% steps.`);
  }
  return { id: layout.id, resolutionPercent };
}

export function validateSpriteModelScale(modelScalePercent = 100) {
  const { min, max, step } = SPRITE_MODEL_SCALE;
  if (!Number.isInteger(modelScalePercent) || modelScalePercent < min || modelScalePercent > max ||
      (modelScalePercent - min) % step !== 0) {
    throw new Error(`Sprite model scale must be ${min}–${max}% in ${step}% steps.`);
  }
  return modelScalePercent;
}

export function validateSpriteHexScale(hexScalePercent = 100) {
  if (hexScalePercent !== 100 && hexScalePercent !== SPRITE_HEX_SCALE_PERCENT) {
    throw new Error('Sprite hex scale must be 100% or 109%.');
  }
  return hexScalePercent;
}

/** Resolution sets source detail; model size and hex calibration set combat size. */
export function spriteLayoutDimensions(id = 'single', resolutionPercent = 100, modelScalePercent = 100, hexScalePercent = 100) {
  const metadata = createSpriteLayoutMetadata(id, resolutionPercent);
  const modelScale = validateSpriteModelScale(modelScalePercent);
  const hexScale = validateSpriteHexScale(hexScalePercent);
  const layout = spriteLayout(metadata.id);
  const width = Math.round(layout.baseWidth * metadata.resolutionPercent / 100);
  const height = Math.round(layout.baseHeight * metadata.resolutionPercent / 100);
  if (width > 4096 || height > 4096) throw new Error('Sprite source frames cannot exceed 4096 pixels per side.');
  return {
    width, height,
    renderWidth: layout.renderWidth * modelScale * hexScale / 10000,
    renderHeight: layout.renderHeight * modelScale * hexScale / 10000
  };
}

/** E, NE, NW, W, SW, SE are counterclockwise steps on the combat board. */
export function spriteLayoutOffsets(id = 'single', facingHex = 0) {
  const layout = spriteLayout(id);
  if (!Number.isInteger(facingHex)) throw new Error('Sprite facing must be an integer hex direction.');
  const steps = layout.rotates ? ((facingHex % 6) + 6) % 6 : 0;
  return layout.offsets.map(offset => {
    let { x, y } = offset;
    for (let i = 0; i < steps; i++) [x, y] = [x + y, -x];
    return { x: x || 0, y: y || 0 };
  });
}
