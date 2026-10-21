import { SPRITE_DIRECTIONS, SPRITE_POSES, validateSpriteSetManifest } from './sprite-set-core.mjs?v=R238C57';
import { loadStudioDraft } from './sprite-set-store.mjs?v=R238C57';
import { spriteLayout, spriteMob } from './sprite-layouts.mjs?v=R238C57';

const api = window.adventurePartySpriteSets;
const assets = new Map();
let setSelect, setStatus, inspector, inspectorHelp, combatStudioReturn;

function message(text) { setStatus.textContent = text; }

function makeControls() {
  const panel = document.createElement('section');
  panel.className = 'combat-roster-placeholder';
  panel.setAttribute('aria-label', 'Six-direction sprite test');
  const row = document.createElement('div');
  row.className = 'combat-roster-row';
  const label = document.createElement('label');
  label.className = 'combat-setup-label';
  label.htmlFor = 'combatSpriteSetSelect';
  label.textContent = 'Sprite test set';
  setSelect = document.createElement('select');
  setSelect.id = 'combatSpriteSetSelect';
  setSelect.className = 'combat-roster-add combat-roster-test';
  setSelect.style.cssText = 'max-width:100%;min-width:0;flex:1 1 220px;';
  setSelect.setAttribute('aria-describedby', 'combatSpriteSetStatus');
  const studioLink = document.createElement('a');
  studioLink.id = 'combatSetupStudioReturnLink';
  studioLink.className = 'combat-roster-add combat-roster-test';
  studioLink.href = './3d-studio.html?studioRestore=1';
  studioLink.textContent = 'Return to 3d studio';
  row.append(label, setSelect, studioLink);
  setStatus = document.createElement('p');
  setStatus.id = 'combatSpriteSetStatus';
  setStatus.className = 'small';
  setStatus.setAttribute('role', 'status');
  setStatus.style.cssText = 'margin:8px 12px;overflow-wrap:anywhere;';
  panel.append(row, setStatus);
  document.querySelector('.combat-condition-actions').before(panel);
  setSelect.addEventListener('change', () => api.select(setSelect.value));

  inspector = document.createElement('section');
  inspector.id = 'combatSpriteInspector';
  inspector.className = 'panel chrome';
  inspector.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = 'Inspect sprite poses';
  heading.style.cssText = 'margin:0 0 8px;font-size:18px;color:var(--gold);';
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  for (const pose of ['ready', 'attack', 'prone', 'live']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'combat-action';
    button.dataset.spriteInspect = pose;
    button.textContent = pose[0].toUpperCase() + pose.slice(1);
    button.addEventListener('click', () => api.inspect(pose));
    buttons.append(button);
  }
  const help = document.createElement('p');
  inspectorHelp = help;
  help.className = 'small';
  help.style.cssText = 'margin:8px 0 0;';
  inspector.append(heading, buttons, help);
  document.querySelector('#combatScreen .side').append(inspector);
  combatStudioReturn = document.createElement('a');
  combatStudioReturn.id = 'combatStudioReturnLink';
  combatStudioReturn.className = 'combat-action';
  combatStudioReturn.href = './3d-studio.html?studioRestore=1';
  combatStudioReturn.textContent = 'Return to 3d studio';
  document.getElementById('returnButton').before(combatStudioReturn);
  document.addEventListener('adventure-party:sprite-state', refreshControls);
  refreshControls();
}

function refreshControls() {
  const snapshot = api.snapshot();
  const options = snapshot.sets.map(set => new Option(set.mobType
    ? `${set.label} — ${spriteMob(set.mobType).label} · ${set.footprintCells} hex${set.footprintCells === 1 ? '' : 'es'}`
    : set.label, set.id));
  setSelect.replaceChildren(...options);
  setSelect.value = snapshot.selectedId;
  inspector.hidden = !snapshot.inspecting;
  const selectedSet = snapshot.sets.find(set => set.id === snapshot.selectedId);
  inspectorHelp.textContent = selectedSet?.mobType === 'fighter'
    ? 'Inspect one Dungeon Crawler Carl using the selected sprite collection. Kobolds provide opponents. Space begins combat and restores live poses; movement and attacks turn Carl to the matching facing. Completed tests return directly to 3d studio without a loot screen.'
    : 'Preview all six facings before combat. Player targets are friendly characters with their own class rules; Kobolds provide opponents. Space begins combat and restores live poses. Completed tests return directly to 3d studio without a loot screen.';
  combatStudioReturn.hidden = snapshot.encounter !== 'studio-kobold';
  const selected = { stand: 'ready', attack: 'attack', prone: 'prone' }[snapshot.inspectionPose] || 'live';
  inspector.querySelectorAll('[data-sprite-inspect]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.spriteInspect === selected));
  });
}

async function decodeImages(manifest, sourceUrls) {
  const names = SPRITE_POSES.flatMap(pose => SPRITE_DIRECTIONS.map(facing => manifest.poses[pose].frames[facing]));
  const results = await Promise.allSettled(names.map(async name => {
    const image = new Image();
    image.decoding = 'async';
    image.src = sourceUrls[name];
    await image.decode();
    if (image.naturalWidth !== manifest.frame.width || image.naturalHeight !== manifest.frame.height) {
      throw new Error(`${name} does not match the declared frame size.`);
    }
    return [name, image];
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw new Error(`The sprite images could not all be loaded. ${failure.reason?.message || failure.reason}`);
  return Object.fromEntries(results.map(result => result.value));
}

async function registerSet(manifest, sourceUrls, objectUrls = []) {
  try {
    const images = await decodeImages(manifest, sourceUrls);
    const id = api.register({ manifest, images, sourceUrls, layout: spriteLayout(manifest.layout?.id || 'single') });
    for (const url of assets.get(id) || []) URL.revokeObjectURL(url);
    assets.set(id, objectUrls);
    return id;
  } catch (error) {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    throw error;
  }
}

async function loadRepositorySet(entry) {
  if (!entry || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '') ||
    entry.manifest !== `assets/sprites/${entry.id}/manifest.json`) {
    throw new Error('A sprite-set index entry has an invalid folder path.');
  }
  const manifestUrl = new URL(entry.manifest, location.href);
  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${entry.id}'s manifest (${response.status}).`);
  const manifest = validateSpriteSetManifest(await response.json());
  if (manifest.id !== entry.id) throw new Error(`Sprite-set ID does not match its folder: ${entry.id}.`);
  if (entry.defaultFor !== undefined && manifest.mobType !== entry.defaultFor) {
    throw new Error(`${entry.id}'s default player binding does not match its captured MOB.`);
  }
  const sourceUrls = {};
  for (const pose of SPRITE_POSES) {
    for (const facing of SPRITE_DIRECTIONS) {
      const filename = manifest.poses[pose].frames[facing];
      const url = new URL(filename, manifestUrl);
      if (entry.revision) url.searchParams.set('v', String(entry.revision));
      sourceUrls[filename] = url.href;
    }
  }
  return registerSet(manifest, sourceUrls);
}

async function loadDraft() {
  const draft = await loadStudioDraft();
  if (!draft) throw new Error('No studio draft is saved for this game. Use Test in combat in 3d studio first.');
  const manifest = validateSpriteSetManifest(draft.manifest);
  const sourceUrls = {}, urls = [];
  try {
    for (const pose of SPRITE_POSES) {
      for (const facing of SPRITE_DIRECTIONS) {
        const filename = manifest.poses[pose].frames[facing];
        const file = draft.files?.[filename];
        if (!(file instanceof Blob) || !file.size) throw new Error(`The saved draft is missing ${filename}.`);
        const url = URL.createObjectURL(file);
        urls.push(url);
        sourceUrls[filename] = url;
      }
    }
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
  const id = await registerSet(manifest, sourceUrls, urls);
  if (api.loadingState?.() === 'timed-out' || api.canAutoSelectDraft?.() === false) {
    message(`${manifest.label} is now available in the sprite test selector. Choose it when you are ready to begin another test.`);
    return;
  }
  api.select(id, { openSetup: true });
  const mob = spriteMob(manifest.mobType || 'kobold');
  const layout = spriteLayout(manifest.layout?.id || 'single');
  const targetNote = mob.id === 'fighter'
    ? 'One Dungeon Crawler Carl uses this collection, keeping his Fighter rules and equipment, against six Kobolds.'
    : mob.targetKind === 'player'
    ? 'Six friendly copies use this character’s class and equipment. This collection also supplies the matching test player’s sprites.'
    : 'The selected monster keeps its existing combat rules.';
  const inspectNote = mob.id === 'fighter' ? 'Carl’s captured poses' : 'all six directions';
  message(`${manifest.label}: ${mob.label}, ${layout.offsets.length}-hex footprint, 18 captured sprites. ${targetNote} Choose Begin Battle to inspect ${inspectNote}.`);
}

async function start() {
  if (!api) return;
  makeControls();
  message('Use the selected set with the six-facing encounter.');
  const wantsDraft = new URLSearchParams(location.search).get('studioSprite') === 'draft';
  try {
    const response = await fetch('data/sprite-sets.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Sprite-set index could not be loaded (${response.status}).`);
    const index = await response.json();
    if (index.version !== 1 || !Array.isArray(index.sets) || index.sets.length > 256) {
      throw new Error('Sprite-set index format is invalid.');
    }
    if (new Set(index.sets.map(entry => entry?.id)).size !== index.sets.length) {
      throw new Error('Sprite-set index contains duplicate character IDs.');
    }
    api.setDefaults(index.sets);
    const results = await Promise.allSettled(index.sets.map(loadRepositorySet));
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) message(`${failed.length} sprite set(s) could not be loaded. ${failed[0].reason.message}`);
    else if (index.sets.length) message(`${index.sets.length} asset-folder set(s) available. Assigned player sets supply their matching character’s sprites in ordinary combat; selecting a set overrides that assignment for this session.`);
  } catch (error) { message(error.message); }
  if (wantsDraft) {
    message('Loading the studio capture…');
    try { await loadDraft(); }
    catch (error) {
      if (api.loadingState?.() !== 'timed-out' && api.canAutoSelectDraft?.() !== false) {
        api.select('studio-kobold', { openSetup: true });
      }
      message(error.message);
    }
  }
}

start().catch(error => {
  if (setStatus) message(error.message);
  else console.error('Sprite sets could not start:', error);
}).finally(() => api?.finishLoading?.());
