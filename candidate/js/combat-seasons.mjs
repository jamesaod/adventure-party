export const SEASONS=Object.freeze(['winter','spring','summer','fall']);
let season='summer';
export function setSeason(value){if(!SEASONS.includes(value))throw new RangeError('Unknown season: '+value);if(value===season)return;season=value;globalThis.dispatchEvent?.(new CustomEvent('adventure-party:season-change',{detail:{season}}));globalThis.draw?.();}
export function getSeason(){return season;}
globalThis.adventurePartySeasons=Object.freeze({getSeason,setSeason,seasons:SEASONS});
