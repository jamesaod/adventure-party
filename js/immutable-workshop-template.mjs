// Only validated, privately cloned runtime templates enter this pool.
const templates=new WeakSet();
export function sealWorkshopTemplate(value){const seen=new WeakSet();function freeze(o){if(!o||typeof o!=='object'||seen.has(o))return;seen.add(o);for(const v of Object.values(o))freeze(v);Object.freeze(o);}freeze(value);templates.add(value);return value;}
export const isSharedWorkshopTemplate=value=>!!value&&templates.has(value);
