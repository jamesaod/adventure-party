// Elliptical corpse fringes retired. Shoreline foam and unit ripples are separate.
// Keep the shader interface stable until a true settled-pose waterline is available.
export const WATER_CONTACT_LIMIT=64;
const NO_CONTACTS=Object.freeze([]);
export function collectWaterContacts(){return NO_CONTACTS;}
