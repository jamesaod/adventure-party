// One authored tree per entry; all retain Sugar Maple species behavior.
export const MAPLE_CATALOG=Object.freeze({
 original:{label:'Original',directory:'sugar-maple',heightFeet:66.9,crownFeet:[58.52,58.49],triangles:25944,winterTriangles:13162},
 tall:{label:'Tall / upright',directory:'sugar-maple/variants/tall',heightFeet:71.54,crownFeet:[58.11,60.24],triangles:24404,winterTriangles:12606},
 broad:{label:'Broad crown',directory:'sugar-maple/variants/broad',heightFeet:70.71,crownFeet:[71.78,75.43],triangles:24180,winterTriangles:12032}
});
export function mapleCatalogEntry(id){return MAPLE_CATALOG[id]||MAPLE_CATALOG.original;}
export function selectedMapleId(search=globalThis.location?.search||''){const id=new URLSearchParams(search).get('mapleVariant');return Object.hasOwn(MAPLE_CATALOG,id)?id:'original';}
