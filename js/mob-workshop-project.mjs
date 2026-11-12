import {normalizeQuiverArrows} from './quiver-arrow-settings.mjs?v=R238C312';
import {normalizeBackEquipment} from './studio-back-equipment.mjs?v=R238C312';
import {validateDraft} from './mob-workshop-core.mjs?v=R238C313';
import {migrateFits,savedFit} from './mob-workshop-fit-store.mjs';

// Validate portable dependencies before replacing the currently open project.
// Combat publishing can reuse this boundary; this is not a deployment adapter.
export function validateWorkshopProject(value) {
  if (!value?.draft) throw Error('Project has no Workshop definition.');
  const draft = validateDraft(structuredClone(value.draft));
  const bytes = value.files?.['model.bin'];
  if (draft.model && (!(bytes instanceof ArrayBuffer || ArrayBuffer.isView(bytes)) || !bytes.byteLength))
    throw Error('Project is missing its model file.');
  const ids = new Set();
  for (const clip of draft.clips) {
    if (typeof clip.id!=='string' || !clip.id || ids.has(clip.id)) throw Error('Animation clip IDs must be unique.');
    ids.add(clip.id);
    if (!Number.isFinite(clip.duration) || clip.duration < 0 || !Array.isArray(clip.data?.tracks) || !clip.data.tracks.length)
      throw Error('Animation has no usable track data: ' + (clip.name || clip.id));
    if(!Number.isFinite(clip.data.duration)||Math.abs(clip.data.duration-clip.duration)>.00001)
      throw Error('Animation duration does not match its track payload: '+clip.id);
    const bindings=new Set();
    for (const track of clip.data.tracks) {
      const times = track.times, values = track.values;
      if (typeof track.name!=='string' || track.name.lastIndexOf('.')<=0 || bindings.has(track.name) || !['number','vector','quaternion','bool','string','color'].includes(track.type) ||
          !Array.isArray(times) || !times.length || !Array.isArray(values) || !values.length || values.length % times.length)
        throw Error('Invalid animation track: ' + (track.name || clip.id));
      bindings.add(track.name);
      if (times.some((t,i)=>!Number.isFinite(t) || t<0 || t>clip.duration+.00001 || (i>0 && t<times[i-1])))
        throw Error('Animation key times are invalid: ' + track.name);
      const width=values.length/times.length;
      if ((track.type==='quaternion' && width!==4) || (['vector','color'].includes(track.type) && width!==3) ||
          (['number','bool','string'].includes(track.type) && width!==1) ||
          (!['bool','string'].includes(track.type) && values.some(v=>!Number.isFinite(v))) ||
          (track.type==='bool'&&values.some(v=>typeof v!=='boolean')) ||
          (track.type==='string'&&values.some(v=>typeof v!=='string')))
        throw Error('Animation key values are invalid: ' + track.name);
    }
  }
  migrateFits(draft);
  normalizeBackEquipment({...savedFit(draft,'back'),item:draft.equipment.back});
  for (const settings of Object.values(draft.equipment.fitsByItem)) {
    if(settings?.arrows)normalizeQuiverArrows(settings.arrows);
    if (!settings || !['position','rotation'].every(k=>Array.isArray(settings[k]) && settings[k].length===3 && settings[k].every(Number.isFinite)) ||
        !Number.isFinite(settings.sizePercent) || settings.sizePercent<=0)
      throw Error('Invalid saved equipment fit.');
  }
  return {draft, files:{...(value.files || {})}};
}
