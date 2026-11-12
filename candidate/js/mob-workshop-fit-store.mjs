// Durable fits belong to a model, item and socket; the slot mirror is legacy UI state.
export function fitKey(draft, slot, item = draft.equipment[slot]) {
  if (!['main', 'off', 'shield', 'back'].includes(slot)) throw Error('Unknown equipment fit slot.');
  return JSON.stringify([draft.model?.id || draft.model?.file || 'unassigned', slot, item]);
}
export function migrateFits(draft) {
  const e = draft.equipment;
  e.back ??= 'auto';
  e.fitsByItem ??= {};
  e.grips ??= {};
  if (e.fitStoreVersion === 1) return;
  for (const slot of ['main', 'off', 'shield', 'back']) {
    if (e[slot] && e[slot] !== 'none' && e.grips[slot])
      e.fitsByItem[fitKey(draft, slot)] ??= structuredClone(e.grips[slot]);
  }
  e.fitStoreVersion = 1;
}
export function savedFit(draft, slot, item = draft.equipment[slot]) {
  migrateFits(draft);
  const fit = draft.equipment.fitsByItem[fitKey(draft, slot, item)];
  return fit ? structuredClone(fit) : null;
}
export function saveFit(draft, slot, settings) {
  migrateFits(draft);
  draft.equipment.grips[slot] = structuredClone(settings);
  if (draft.equipment[slot] && draft.equipment[slot] !== 'none')
    draft.equipment.fitsByItem[fitKey(draft, slot)] = structuredClone(settings);
}
export function resetFit(draft, slot) {
  migrateFits(draft);
  delete draft.equipment.fitsByItem[fitKey(draft, slot)];
  delete draft.equipment.grips[slot];
}
