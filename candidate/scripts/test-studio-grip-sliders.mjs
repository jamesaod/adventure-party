import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('3d-studio.html','utf8');
const studio = readFileSync('js/3d-studio.mjs','utf8');
const css = readFileSync('css/3d-studio.css','utf8');
assert.match(html, /Candidate Rev (11[7-9]|1[2-9][0-9]|[2-9][0-9]{2}|[1-9][0-9]{3,})/);
assert.match(html, /css\/3d-studio\.css\?v=R238C181/);

for (const [name, min, max, step] of [
  ['Position','-1','1','0.005'],
  ['Rotation','-180','180','1']
]) {
  for (const axis of ['X','Y','Z']) {
    const id = 'studioWeapon' + name + axis;
    const input = html.match(new RegExp('<input id="' + id + '"[^>]*>'))?.[0];
    assert.ok(input, 'Grip slider is present: ' + id);
    assert.match(input, /type="range"/, id + ' must be a slider, not a number field');
    for (const [attr,value] of [['min',min],['max',max],['step',step]]) {
      assert.ok(input.includes(attr + '="' + value + '"'), id + ' retains safe ' + attr);
    }
    assert.ok(html.includes('id="' + id + 'Value"'), id + ' shows a precise live numeric value');
    assert.ok(html.includes('for="' + id + '"'), id + ' value is associated with the slider');
  }
}

assert.ok(css.includes('.studio-equipment-axes.studio-grip-slider-axes') &&
  css.includes('grid-template-columns:minmax(0,1fr)'),
  'Each grip slider is full-width for precise adjustment');
assert.ok(studio.includes("ui[`Weapon${name}${axis}`].addEventListener('input'"),
  'Changes apply while a slider is dragged, not only on release');
assert.ok(studio.includes('void changeEquipment(next, { resetPose: false })'),
  'Changing the grip never restarts the reviewed animation');
assert.ok(studio.includes("ui[`Weapon${name}${axis}Value`].textContent = formatted"),
  'Current position/rotation values are always visible');
assert.ok(studio.includes("name === 'Position' ? value.toFixed(3)"),
  'Fine 0.005 position increments are legible');
assert.ok(studio.includes('field.disabled = busy || locked'),
  'Captured sprites still lock equipment settings');
assert.ok(studio.includes('poseCapture?.saveWorkspace();'),
  'Equipment customization remains persistable');
console.log('PASS grip sliders: 6 live X/Y/Z controls, numeric feedback, unchanged limits and no animation reset.');
