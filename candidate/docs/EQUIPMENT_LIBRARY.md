# Equipment Library â€” Candidate Rev 197

Open **Equipment Library** from the title screen or MOB Creator. Each row is an item; selecting its name opens details. Search matches names and stable IDs.

1. Select an existing item, or choose New item / Create variant.
2. Give new items a stable, unique ID. A variant references its base by ID. Enable Override only for fields that differ; unchecked fields inherit. A model can be inherited, selected from existing equipment, or explicitly None. This does not change mesh files or Studio grip defaults.
3. Unique and Enchanted are independent flags. History/description and quest reference are independent too. Campaign-wide unique-instance enforcement is deferred.
4. Save item. Edits are browser-local, scoped separately for stable/candidate. Open or reload MOB Creator to use the shared list for fixed choices, weighted weapons/off-hand and guaranteed inventory. Save the MOB before reloading an existing editor.
5. Export library JSON to submit item definitions for repository integration. Import merges by stable ID; identical entries deduplicate, conflicting definitions stop without replacing existing edits. Reset/remove draft restores a repository item or removes a custom item; referenced custom bases cannot be removed.

MOB exports embed the selected custom definitions and their parent chain in `references.equipmentLibrary`. Imports use those pinned records in that editor without silently replacing the browser library. Repository MOB construction also resolves that embedded catalog. Existing ordinary catalog IDs remain supported. No rendered sprite/pose data is rewritten.

## Schema and boundaries

`adventure-party.equipment-library`, version 1, contains `items: [{id,parentId,overrides}]`. Resolution starts with `item-catalog.mjs`, plus the plain `long-sword` definition, then recursively merges overrides. Explicit `appearance:null` removes a model; arrays replace inherited arrays. Stable IDs, missing parents, cycles, duplicate rows and effect values are validated before storage. `equipmentSnapshot` includes selected records and ancestors only.

The page edits existing rules fields rather than maintaining another weapon-stat system. Existing catalog statistics are preserved; this revision is not a blanket PHB correction. One-handed off-hand eligibility uses existing supported assets or an explicit rule flag, with two-handed exclusion taking precedence. Staff/sling exclusions remain until explicitly overridden by an item definition.

Effects are **definitions only**, visibly labeled as not yet executed by combat. Each effect specifies recipient (wielder/target), trigger, kind, stat/condition/damage parameter, amount/dice, chance, rounds, saving throw that negates, stacking policy and maximum stacks. The owning item ID provides the source. Zero rounds means continuous while equipped or instant for event effects. Effects replace the inherited list when overridden. Existing numeric magic bonuses keep using established engine fields; do not claim arbitrary effects are active.

Run `node scripts/test-equipment-library.mjs` plus repository validation. Tests cover inheritance, no-model items, simultaneous unique/enchantment metadata, effect bounds, duplicates/cycles, hand eligibility and a portable MOB round trip. Browser QA should create a variant, save/reload it, then find it in MOB Creator. No renderer or asset pipeline changes are required.

## Candidate Rev 204 — armor

See [Armor and movement](ARMOR_AND_MOVEMENT.md) for the shared PHB armor catalog, Worn armor selection and specific encumbrance movement. Preserve stable base movement and count carried armor separately from equipped AC.
