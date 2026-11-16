import {ACTIVE_BROADLEAF,isBroadleaf} from './broadleaf-family.mjs?v=sweet-birch1';
// Axial hex radii shared by tree spacing and grass placement.
export const TREE_ENVIRONMENT_PROFILES=Object.freeze({'sweet-birch':Object.freeze({radius:2,feather:.65}),'american-beech':Object.freeze({radius:2,feather:.65}),'sugar-maple':Object.freeze({radius:2,feather:.65}),'white-oak':Object.freeze({radius:2,feather:.65}),default:Object.freeze({radius:0,feather:0})});
export function treeExclusionProfile(tree){const base=TREE_ENVIRONMENT_PROFILES[tree.species]||TREE_ENVIRONMENT_PROFILES.default,scale=Number.isFinite(tree.environmentSizeScale)?Math.max(0,tree.environmentSizeScale):1,radius=Math.max(0,tree.exclusionRadiusHexes??base.radius)*scale;return {radius,feather:Math.min(radius,Math.max(0,tree.grassFeatherHexes??base.feather)*scale)};}
export function hexRadius(q,r){return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));}
export function treeExcludesTree(owner,candidate){const d=hexRadius(owner.x-candidate.x,owner.y-candidate.y);return d>0&&d<=treeExclusionProfile(owner).radius;}
export function grassRetention(x,y,zones){let retention=1;for(const t of zones){const r=(y-t.y)/t.row,q=(x-t.x)/t.width-r/2,d=hexRadius(q,r);if(d>=t.radius)continue;const u=t.feather>0?Math.max(0,Math.min(1,(d-t.radius+t.feather)/t.feather)):0;retention=Math.min(retention,u*u*(3-2*u));if(retention===0)break;}return retention;}
globalThis.adventurePartyTreeEnvironment={treeExclusionProfile,treeExcludesTree,isBroadleaf,activeBroadleaf:ACTIVE_BROADLEAF.species};
