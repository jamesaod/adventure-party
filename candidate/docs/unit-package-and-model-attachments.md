# Unit Package and Model Attachment Specification (v1)

## Purpose
Author a character or MOB once and reference shared model, animation and equipment assets by ID. Unit definitions are immutable templates. Battlefield instances have unique instance IDs and mutable state. **Do not** store current HP, location or temporary effects in the template.

## Schema
The canonical data-only functions live in `js/unit-package.mjs`:
- `createUnitPackage` and `validateUnitPackage`: versioned unit definition
- `defineModelAttachmentProfile`: model-specific bone/socket corrections
- `registerUnitDefinition`: reject duplicate stable MOB definition IDs
- `instantiateUnit`: clone state and inventory safely for each deployed unit

Example:
```json
{
  "schema": "adventure-party.unit-package",
  "version": 1,
  "id": "orc-warrior-01",
  "name": "Orc Warrior",
  "modelId": "orc-base",
  "character": {
    "classId": "fighter",
    "level": 3,
    "abilities": {},
    "rules": {"system": "adnd-2e"}
  },
  "actionProfiles": ["one-handed-swing", "throw"],
  "equipment": [{"itemId": "battle-axe", "slot": "right-hand"}],
  "attachments": {
    "modelId": "orc-base",
    "sockets": {
      "right-hand-grip": {
        "bone": "mixamorigRightHand",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": 1
      }
    }
  },
  "references": {"model": "assets/models/orc-base.glb"},
  "mob": {"faction": "orc", "morale": 11}
}
```

## Attachment resolution (intended renderer integration)
1. Resolve the model's anatomical attachment socket / bone.
2. Apply model-specific attachment profile translation, rotation and scale.
3. Apply equipment's own grip origin and default size.
4. Apply optional model + item exception calibration from existing equipment profiles.
5. Transform by character pose and render. Missing corrections are identity transforms, not hard errors.

Store bone names and offsets per model. The weapon asset and action animation can be shared across characters of different builds. Preserve per-item corrections as exceptional overrides rather than making each weapon a new renderer specialization.

## Development/export roadmap
**Implemented now:** versioned data format, stable identities, model attachment definitions, instance separation, validation and round-trip JSON-compatible values.

**Still to integrate:** Studio Unit editor, class-stat rule calculators, persisted unit catalog, portable ZIP export/import, model/rig validation, attachment application in live renderer, initial MOB templates migrated, and an end-to-end browser test. Those should be delivered in subsequent candidate revisions, not claimed as complete by this specification.

## Compatibility
No existing MOBs or saved games are rewritten by the foundation. Old sprite-set manifests and action-profile catalogs are retained. Existing characters may be migrated one by one; stable asset IDs and per-model calibration must be preserved.
