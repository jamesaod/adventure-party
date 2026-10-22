# Preserved Adventure Party workflows

Keep reusable development instructions and skill definitions in this directory so they survive chat changes and can be recovered from Git history.

This is a separate reference directory within the repository. The game does not import it, and the Pages publisher excludes it from both stable and candidate game output. Keep executable game code, runtime data, and game assets in their established locations.

## Start here in a new chat

Ask the assistant to:

> Read `workflow/README.md` and `workflow/skills/adventure-party-workflow/SKILL.md` in `jamesaod/adventure-party` on the current `candidate` branch. Follow the preserved workflow, inspect the current repository state, and continue the requested task.

The repository remains the source of truth for current branches, revisions, code, and deployment status. These files preserve procedures and selected source identities; they do not imply that a pending change has been merged or deployed.

## Preserved skill

| File | Purpose |
| --- | --- |
| [Adventure Party Workflow](skills/adventure-party-workflow/SKILL.md) | Complete skill instructions: repository recovery, candidate/main flow, simple sprite imports, validation, and clear progress reporting. |
| [Orc source reference](skills/adventure-party-workflow/references/por-orcs.md) | Exact user-selected Orc, Orc Leader, and Orc Shaman catalog entries, original filenames, and transformation rules. |
| [Skill interface metadata](skills/adventure-party-workflow/agents/openai.yaml) | Skill name shown in a skill picker, short description, and example invocation. |

The agreed sprite procedure is **selected source PNGs → 4× nearest-neighbor enlargement → `assets/sprites/` → the smallest necessary reference or metadata patch**, while preserving the established rendered size, anchor, footprint, alignment, transparency, and facing. Read the complete skill for handling already-enlarged sources and verifying artwork identity.

## 3d studio sprite sets

Studio renders already have their intended native frame resolution. Preserve those PNGs without an additional 4× enlargement. The repeatable workflow is **select MOB, footprint and resolution → load animated model → adjust model size and lighting → capture ready/attack/prone at chosen times → test in combat → Return to 3d studio → export game assets ZIP → import the ZIP → validate and publish candidate**.

Repository-backed source models are listed in `data/studio-models.json` and kept under `assets/models/<character>/<version>/`. In the studio, choose a **Model library** entry and **Load selected model** to use it. **Dungeon Crawler Carl Ver 2** is the first saved model; its original GLB bytes, Y-up orientation, four animation clips and source checksum are preserved. This source-model workflow is separate from importing a sprite set into combat.

The Animation dropdown keeps embedded FBX takes distinct, with numbered names and durations. If an export contains several motions on one timeline, **Create animation from range** saves named start/end sections into that same dropdown. The selected take, local animation time and ranges persist with the workspace through reloads and combat tests. See the [animation selection guide](../docs/3D_STUDIO.md#select-an-animation) for the exact steps and FBX layer limitations.

New sets offer four formats: single hex, three-hex triangle, three-hex inverted triangle, and seven-hex center/ring. Explicit legacy definitions retain two-wide, five-trapezoid, and four-tall-diamond exports and saved drafts for recovery without adding those choices to the new-set picker. All formats use eighteen frames: ready, attack and prone rows with E/NE/NW/W/SW/SE columns.

**Resolution** changes native image detail from 50–200% in 5% steps. **Model size** independently scales battlefield render dimensions from 25–1000% in 5% steps; both sliders default to 100%. Model size automatically adjusts the viewer zoom so the model keeps its on-screen size and position; its battlefield size and measured height still change. Directional previews center each current sprite at 50% of the preview window height, independently of capture framing; all six windows widen together when a wide/prone pose needs more horizontal room. The central model floor shows the selected occupied-hex footprint for size comparison, and the floor guide is excluded from exported artwork. New models default to Z-up, including the adapted demo source; restored workspaces retain their saved orientation.

Pixel color/outline and lighting controls share one box directly beneath the right-hand Pixel previews panel. Environmental light has color and intensity controls. Directional light has its own color, intensity, elevation, and hex direction; both lights default to white. The first capture locks lighting, footprint, resolution and framing. The MOB target, model size, and shared pixel color/outline settings remain editable. Changing size after capture updates render metadata without recapturing or resampling the PNGs. Saved workspaces above 1000% with layout metadata restore at 1000% with matching render metadata for every captured pose; the captured source pixels remain intact. Recovered older captures without layout metadata must be cleared and captured again before size can change.

Partial and complete sheets autosave with their source pixels, model files, lighting, size and other studio settings in this browser. Confirm the saved status before closing the tab. **Test in combat** saves the exact tested workspace before opening combat in the current tab; a save failure leaves the studio open. **Return to 3d studio** restores the tested captures in that same tab for export. Choosing Dungeon Crawler Carl tests the one existing player character against six Kobolds, without adding Carl copies. Victory, defeat, and manual exit from a studio battle return directly to the studio without a loot screen. These browser drafts are isolated between stable and candidate. Export/import is still the step that produces portable, permanent repository assets.

The [3d studio guide](../docs/3D_STUDIO.md) preserves the capture steps, exact format sizes and sheet mapping. The [sprite-set import guide](../docs/SPRITE_SET_IMPORT.md) preserves the one-command import and manifest format. Character artwork lives in `assets/sprites/<set-id>/`, with one small character manifest and an entry in `data/sprite-sets.json`. The manifest carries the selected MOB, footprint, resolution, model size, frame/anchor, lighting and pose metadata. Optional top-level `modelScalePercent` requires layout metadata; older sets omit it and retain their existing size. Future imports update those assets and references rather than adding image payloads or per-frame declarations to the main game file.

The MOB selector uses the implemented catalog in `js/sprite-layouts.mjs`; tests instantiate the selected creature's existing factory and statistics. Adding a future MOB requires its actual combat implementation and a matching catalog entry. Importing another visual set for an existing MOB only needs the asset folder and index update. Older sets without MOB/footprint metadata retain the single-hex Kobold test defaults.

Keep this workflow directory as reference material outside the published game, and keep executable import tools under `scripts/`.

## Restore or reconstruct the skill

1. Recover the complete `workflow/skills/adventure-party-workflow/` directory from GitHub or a repository checkout. Use Git history to recover an earlier version if needed.
2. Preserve `SKILL.md`, `agents/openai.yaml`, and `references/por-orcs.md` together, with their relative paths intact. `SKILL.md` contains the skill's name, trigger description, and full procedure.
3. Read the instructions directly in any future assistant session. If an installed skill is desired, use that environment's supported skill installation process with the complete directory and its required authorization.
4. Verify that the installed skill is discoverable before claiming installation succeeded. Keeping this directory in GitHub does not itself install an account-level skill or guarantee automatic loading in every chat.
5. Check the live repository's instructions and current user request before applying the recovered procedure. Update stale factual details through the normal repository workflow.

The Orc reference records where the source images came from. It does not contain the original `POR_Sprite_Extraction.zip` archive or replace a backup of that archive. Obtain the original selected files when rebuilding image assets and compare them with the user's reference images.

## Maintain these references

- Capture lasting agreements and corrections here when requested. Keep temporary task progress, revision numbers, and interrupted-operation status out of reusable skill instructions.
- Keep each skill in its own directory under `workflow/skills/`. Add a link here when adding another skill.
- Preserve complete, readable instructions so a skill can be reconstructed without the original chat.
- Link to existing project policy rather than duplicating it unnecessarily. The [development workflow](../docs/DEVELOPMENT_WORKFLOW.md) defines branch roles; the [Git workflow](../docs/GIT_WORKFLOW.md) includes sprite integrity and upload recovery guidance.
- Review and validate changes through a pull request into `candidate`, following the user's current authorization. Preserve this directory's exclusion from the game publisher.
