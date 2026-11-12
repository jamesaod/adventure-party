import {normalizeQuiverArrows} from './quiver-arrow-settings.mjs?v=R238C312';

// Adapter for the existing attachment gizmo. Persist through the Back fit store.
export function createQuiverArrowEditor({back,preview}){
 return {
  snapshot:()=>({settings:normalizeQuiverArrows(back.snapshot().settings.arrows)}),
  getAttachmentSocket:()=>preview.bundle(),
  select(value){
   const settings=normalizeQuiverArrows(value);
   const updated=back.select({...back.snapshot().settings,arrows:settings});
   preview.setBundleSettings(settings);
   return updated;
  }
 };
}
