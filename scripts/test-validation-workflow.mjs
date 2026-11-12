import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combatRegressionFiles} from './run-combat-regressions.mjs';
const source=readFileSync('.github/workflows/adventure-party-validation.yml','utf8');
// A plain YAML scalar folds indented commands into arguments to the first node.
assert(!/run: node[^\n]*\n[ \t]+node /.test(source),'Multiple commands require a YAML block scalar');
assert.match(source,/node scripts\/run-combat-regressions\.mjs/);
const files=combatRegressionFiles();
for(const name of ['test-combat-spell-actions','test-combat-frame-pacing','test-workshop-arrow-preview','test-bow-audio','test-animation-timeline','test-combat-corpse-performance'])assert(files.includes('scripts/'+name+'.mjs'),name+' must run in CI');
for(const file of files)assert(!source.includes('node '+file+'\n'),'Do not run '+file+' twice');
console.log('PASS CI command boundaries and automatic combat/Workshop regression coverage');
