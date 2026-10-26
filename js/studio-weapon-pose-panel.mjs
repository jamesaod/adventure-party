import { createWeaponPoseProfilePackage } from './weapon-pose-profile-export.mjs';

/**
 * Studio extension for recording reproducible weapon-pose samples.
 * The exported JSON is authoritative development handoff data; it does not
 * publish or replace a combat sprite set by itself.
 */
const POSE_NAMES = ['ready', 'attack', 'prone'];
const saved = new Map();
const APPEARANCE_BY_STUDIO_WEAPON = Object.freeze({
  'medieval-sword': Object.freeze({
    appearanceId: 'flaming-sword-5', itemName: 'Flaming Sword +5', visualClass: 'sword', poseProfileId: 'one-handed-swing'
  }),
  'wooden-staff': Object.freeze({appearanceId:'wooden-staff',itemName:'Wooden Staff',visualClass:'staff',poseProfileId:'two-handed-swing'}),
  'short-sword': Object.freeze({appearanceId:'short-sword',itemName:'Short Sword',visualClass:'sword',poseProfileId:'one-handed-thrust'}),
  'dagger': Object.freeze({appearanceId:'dagger',itemName:'Dagger',visualClass:'dagger',poseProfileId:'one-handed-thrust'}),
  crossbow: Object.freeze({appearanceId:'crossbow',itemName:'Crossbow',visualClass:'crossbow',poseProfileId:'direct-fire'}),
  'recurve-bow': Object.freeze({appearanceId:'recurve-bow',itemName:'Recurve Bow',visualClass:'bow',poseProfileId:'bow'}),
  spear: Object.freeze({
    appearanceId: 'spear', itemName: 'Spear', visualClass: 'spear', poseProfileId: 'two-handed-thrust'
  }),
  'battle-axe': Object.freeze({
    appearanceId: 'battle-axe', itemName: 'Battle Axe', visualClass: 'battle-axe', poseProfileId: 'one-handed-swing'
  }),
  'medieval-two-handed-sword': Object.freeze({
    appearanceId: 'two-handed-sword', itemName: 'Two-Handed Sword', visualClass: 'two-handed-sword', poseProfileId: 'two-handed-swing'
  })
});

function studioApi() { return window.adventureParty3DStudio; }
function snapshot() { return studioApi()?.snapshot?.() || null; }
function currentSample(note = '') {
  const snap = snapshot();
  const selected = snap?.selectedAnimation;
  if (!snap || !selected) throw new Error('Select an animation before recording a pose.');
  const rightHand = snap.equipment?.settings?.rightHand || 'none';
  if (!APPEARANCE_BY_STUDIO_WEAPON[rightHand]) throw new Error('Equip a registered Studio weapon before recording this profile.');
  return {
    animation: selected.name,
    sourceId: selected.sourceId || selected.name,
    timeSeconds: selected.time,
    frameNumber: null,
    sampleRate: null,
    gripCorrection: null,
    note,
    studioEquipment: structuredClone(snap.equipment?.settings || null)
  };
}
function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function slug(value) { return String(value || 'weapon-pose-profile').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(); }
function descriptorForSnapshot(snap) {
  const rightHand = snap?.equipment?.settings?.rightHand || 'none';
  const descriptor = APPEARANCE_BY_STUDIO_WEAPON[rightHand];
  if (!descriptor) throw new Error('Equip a registered Studio weapon before exporting.');
  return { ...descriptor, studioAssetId: rightHand };
}

function init() {
  const anchor = document.querySelector('.studio-animation');
  if (!anchor || document.getElementById('studioWeaponPoseProfilePanel')) return;
  const panel = document.createElement('section');
  panel.id = 'studioWeaponPoseProfilePanel';
  panel.className = 'studio-panel chrome studio-weapon-pose-profile';
  panel.innerHTML = `
    <h2>Weapon pose profile</h2>
    <p class="studio-note">Record the exact current animation time and equipment grip, then export reproducible profile data for development.</p>
    <label class="studio-field">Profile ID<input id="studioPoseProfileId" value="one-handed-swing"></label>
    <label class="studio-field">Profile name<input id="studioPoseProfileName" value="One-handed swinging weapon"></label>
    <label class="studio-field">Pose note<textarea id="studioPoseNote" rows="2" placeholder="Optional note about this exact frame"></textarea></label>
    <div class="studio-capture-buttons" id="studioPoseRecordButtons"></div>
    <div id="studioPoseProfileStatus" class="studio-note" role="status">Equip a registered weapon, then record Ready, Attack, and Prone.</div>
    <button id="studioExportPoseProfile" class="studio-button studio-primary studio-wide-button" type="button">Export pose profile JSON</button>`;
  anchor.insertAdjacentElement('afterend', panel);
  const buttons = panel.querySelector('#studioPoseRecordButtons');
  for (const pose of POSE_NAMES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'studio-button'; button.dataset.pose = pose;
    button.textContent = `Record ${pose}`;
    button.addEventListener('click', () => {
      try {
        saved.set(pose, currentSample(panel.querySelector('#studioPoseNote').value));
        button.classList.add('selected');
        const sample = saved.get(pose);
        panel.querySelector('#studioPoseProfileStatus').textContent = `${pose}: ${sample.animation} @ ${sample.timeSeconds.toFixed(3)} s recorded.`;
      } catch (error) { panel.querySelector('#studioPoseProfileStatus').textContent = error.message; }
    });
    buttons.append(button);
  }
  panel.querySelector('#studioExportPoseProfile').addEventListener('click', () => {
    try {
      const snap = snapshot();
      if (!snap) throw new Error('Studio diagnostics are not ready yet.');
      for (const pose of POSE_NAMES) if (!saved.has(pose)) throw new Error(`Record ${pose} before exporting.`);
      const equipmentDescriptor = descriptorForSnapshot(snap);
      const profileIdField=panel.querySelector('#studioPoseProfileId');
      const profileNameField=panel.querySelector('#studioPoseProfileName');
      if(!profileIdField.value.trim()||profileIdField.value.trim()==='one-handed-swing')profileIdField.value=equipmentDescriptor.poseProfileId;
      if(equipmentDescriptor.poseProfileId==='two-handed-swing'&&profileNameField.value.trim()==='One-handed swinging weapon')profileNameField.value='Two-handed swinging weapon';
      if(equipmentDescriptor.poseProfileId==='two-handed-thrust'&&profileNameField.value.trim()==='One-handed swinging weapon')profileNameField.value='Two-Handed Stab';
      if(equipmentDescriptor.poseProfileId==='bow'&&profileNameField.value.trim()==='One-handed swinging weapon')profileNameField.value='Bow';
      if(equipmentDescriptor.poseProfileId==='direct-fire'&&profileNameField.value.trim()==='One-handed swinging weapon')profileNameField.value='Direct Fire Weapons (Crossbow)';
      if(equipmentDescriptor.poseProfileId==='one-handed-thrust'&&profileNameField.value.trim()==='One-handed swinging weapon')profileNameField.value='One-handed stabbing weapon';
      const rightHand = snap.equipment?.settings?.rightHand;
      for (const pose of POSE_NAMES) {
        if (saved.get(pose)?.studioEquipment?.rightHand !== rightHand) {
          throw new Error('All three samples must use the same equipped weapon. Record the profile again after changing equipment.');
        }
      }
      const packageData = createWeaponPoseProfilePackage({
        profile: {
          id: panel.querySelector('#studioPoseProfileId').value.trim(),
          name: panel.querySelector('#studioPoseProfileName').value.trim(),
          revision: 1,
          visualClass: equipmentDescriptor.visualClass
        },
        mob: { type: snap.mobType, name: snap.model, heightInches: snap.mobType === 'fighter' ? 76 : null },
        model: {
          id: snap.libraryModelId || snap.model,
          bodyReferenceHeightInches: snap.mobType === 'fighter' ? 76 : null
        },
        equipment: {
          ...equipmentDescriptor,
          studio: structuredClone(snap.equipment?.settings || null)
        },
        poses: Object.fromEntries(saved),
        combatMappings: { ready: 'ready', attack: 'attack', prone: 'prone' },
        studio: {
          layoutId: snap.layoutId, resolutionPercent: snap.resolutionPercent,
          modelScalePercent: snap.modelScalePercent, hexScalePercent: snap.hexScalePercent,
          lighting: snap.lighting, heading: snap.heading, upAxis: snap.upAxis,
          frameHeight: snap.frameHeight, frameCenter: snap.frameCenter,
          renderSize: snap.renderSize
        },
        notes: 'Weapon-pose profile handoff. JSON is authoritative; captured sprite publication remains a separate step.'
      });
      download(`${slug(packageData.profile.id)}.${equipmentDescriptor.visualClass}.weapon-pose-profile.json`, `${JSON.stringify(packageData, null, 2)}\n`);
      panel.querySelector('#studioPoseProfileStatus').textContent = `${equipmentDescriptor.itemName} profile JSON exported.`;
    } catch (error) { panel.querySelector('#studioPoseProfileStatus').textContent = error.message; }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();