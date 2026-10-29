import {resolveEquipmentLibrary,emptyEquipmentLibrary} from './equipment-library-core.mjs?v=R238C199';
export const equipmentStorageKey='adventure-party-equipment:'+ (typeof location==='undefined'?'/':new URL('.',location.href).pathname);
export function readEquipmentLibrary(){
 const raw=typeof localStorage==='undefined'?null:localStorage.getItem(equipmentStorageKey);
 const data=raw?JSON.parse(raw):emptyEquipmentLibrary();resolveEquipmentLibrary(data);return data;
}
export function saveEquipmentLibrary(data){resolveEquipmentLibrary(data);localStorage.setItem(equipmentStorageKey,JSON.stringify(data));}
