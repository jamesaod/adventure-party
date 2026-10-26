import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const game=readFileSync(new URL('../js/adventure-party.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const catalog=readFileSync(new URL('../mob-catalog.html',import.meta.url),'utf8');
for(const id of ['inventoryButton','inventoryOverlay','inventoryList','closeInventoryButton'])
 assert.ok(page.includes('id="'+id+'"'),id+' is required');
assert.ok(!page.includes('id="sheetInventory"'),'Character sheet must not contain inventory list');
assert.ok(page.includes('data-screen="mob-catalog"'),'MOB Catalog must appear on launcher');
assert.ok(game.includes('function openInventory()')&&game.includes('function closeInventory()'));
assert.ok(game.includes('function renderCombatInventory()'));
assert.ok(game.includes('document.getElementById("inventoryList").addEventListener("click"'));
assert.ok(game.includes('if(keyLower==="i")'),'Inventory hotkey must work');
assert.ok(game.includes('if(inventoryOpen){closeInventory();return;}'),'Escape closes inventory');
assert.ok(game.includes('window.location.assign("./mob-catalog.html")'));
assert.ok(catalog.includes("SPRITE_MOBS") && catalog.includes("studio-models.json"),
 'Catalog should use existing registered MOBs and models');
assert.ok(!game.includes('getElementById("sheetInventory")'));
console.log('PASS MOB catalog launcher, separate inventory modal and existing equip/use handlers');
