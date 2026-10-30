import {validateMap, cellKey, FACINGS} from './exploration-core.mjs?v=R238C206';

// The map and first-person view share the same authored grid and live state.
// North is the top edge; there is no separately authored illustration to drift.
export function explorationMapMarkup(map, state) {
  validateMap(map);
  const size = 16, insetX = 16, insetY = 26;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 292" role="img" aria-label="Old Tollhouse, 16 by 16 map. Party at column ${state.x + 1}, row ${state.z + 1}, facing ${FACINGS[state.facing]}.">`,
    '<defs><pattern id="mapWallHatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="#80572f" stroke-width=".45" opacity=".4"/></pattern></defs>',
    '<g fill="#654224" font-family="Georgia, serif" font-size="10" text-anchor="middle"><text x="144" y="13">N ↑</text><text x="24" y="22">1</text><text x="264" y="22">16</text></g>'
  ];
  for (let z = 0; z < map.height; z++) {
    for (let x = 0; x < map.width; x++) {
      const px = insetX + x * size, py = insetY + z * size;
      const wall = map.grid[z][x] === '#';
      parts.push(`<rect data-cell="${x},${z}" data-kind="${wall ? 'wall' : 'floor'}" x="${px}" y="${py}" width="${size}" height="${size}" fill="${wall ? 'url(#mapWallHatch)' : '#fff0ca'}" fill-opacity="${wall ? '1' : '.45'}" stroke="#987345" stroke-opacity=".32" stroke-width=".5"/>`);
      if (!wall) {
        // Ink the actual room/corridor perimeter, including isolated pillars.
        for (const [dx, dz, a, b, c, d] of [[0,-1,0,0,16,0],[1,0,16,0,16,16],[0,1,0,16,16,16],[-1,0,0,0,0,16]]) {
          if (map.grid[z + dz]?.[x + dx] === '#') parts.push(`<path d="M${px+a} ${py+b}L${px+c} ${py+d}" stroke="#684322" stroke-width="1.8"/>`);
        }
      }
    }
  }
  for (const door of map.doors) {
    const open = state.openDoors.has(cellKey(door.x, door.z));
    parts.push(`<g data-door="${door.x},${door.z}" data-open="${open}" transform="translate(${insetX+(door.x+.5)*size} ${insetY+(door.z+.5)*size}) rotate(${door.axis === 'x' ? 90 : 0})" stroke="#5c391f" fill="none">`);
    parts.push(open ? '<path d="M-6 0V-12" stroke-width="2.5"/><path d="M6 0A12 12 0 0 0-6-12" stroke-width=".7" stroke-dasharray="2 1"/>' : '<rect x="-6" y="-2" width="12" height="4" fill="#b38a55" stroke-width="1.2"/>');
    parts.push('</g>');
  }
  parts.push(`<g data-party="${state.x},${state.z},${state.facing}" transform="translate(${insetX+(state.x+.5)*size} ${insetY+(state.z+.5)*size}) rotate(${state.facing*90})"><circle r="7" fill="#f4dfac" stroke="#694021" stroke-width=".7"/><path d="M0-6L4.5 4L0 2L-4.5 4Z" fill="#633b20"/></g></svg>`);
  return parts.join('');
}
