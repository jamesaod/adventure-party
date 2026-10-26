# Adventure Party — Session Start and Repository Workflow

This file is the first stop for any new ChatGPT / development session working on Adventure Party.

## Non-negotiable default: repository-enabled development
- Treat `jamesaod/adventure-party` as the authoritative project. Work against the existing repository, **not** a detached local recreation or downloadable prototype.
- At the beginning of each session, discover and verify available GitHub/repository tools, repository write permission, the `candidate` branch, latest candidate head/build metadata, open PRs, CI, and publishing status. Do not assume that a previously working tool is present in a new session.
- Read `docs/DEVELOPMENT_WORKFLOW.md` before editing. It defines branch roles, candidate QA PRs, validation, publishing, stable milestones, and QA URLs. Prefer feature/fix branch -> PR to candidate -> validation -> merge -> published candidate QA. Do not deploy directly to stable `main` for ordinary work.
- When the user requests implementation, push, merge, or publish, perform those actions using connected tools where possible and report exact commit/PR/build links and verification. Never claim they happened merely because code was drafted.
- If repository access is unavailable, state the specific capability that failed and avoid presenting local downloads as equivalent to integration.

## Asset workflow — avoid reinventing it
- For ordinary equipment (sword, axe, shield, staff, spear, etc.), use existing asset directories and item/equipment catalog configuration rather than writing a bespoke renderer. Record path/type, scale, attachment/grip points, offsets/rotation, and applicable item metadata.
- Reuse the existing 3D Studio / Pixel Studio preview, action-profile system, on-the-fly equipment-aware sprite render and cache invalidation. Equipment changes regenerate the affected combat sprites.
- Keep MOB/unit packages tied to their own model, animation/pose references, equipment data, placeholder sprite, and MOB identity independent of friendly/hostile allegiance.
- Preserve the existing four-pose system: Ready, Wind Up, Attack, Prone. Physical attack SFX and damage land on Attack, not silent Wind Up.
- For model imports, preserve and consult the existing model/animation workflow documentation in `docs/` before diagnosing rigging issues from scratch.

## Binary asset transfer — verified facts and recovery procedure (2026-10-26)
- A local runtime may be unable to resolve `github.com`, while the **GitHub connector remains operational** with repository write access.
- GitHub connector `create_blob` is confirmed operational for small text probes; it supports `encoding: "base64"` for binary payloads. **This does not establish a working bridge** from local container bytes into connector arguments.
- Available repository write primitives include `create_blob`, `create_tree`, `create_commit`, `update_ref`, `create_file` and `update_file`. Prefer normal feature-branch/PR workflow and avoid mutating published branches without validation.
- When importing binary assets: first check direct Git/network and any tool that can natively read local upload bytes into the same execution environment as repository write actions. Then consider GitHub blob/base64 upload. Verify the returned blob/branch content before declaring transfer successful. Never try to paste or truncate large Base64 strings into the conversation.
- If the bridge is absent, explain what failed and preserve the exact pending task. Look for a supported file bridge rather than repeatedly changing the model, asset pipeline, or user credentials.
- Do not make users manually upload assets by default; manual upload is a fallback, not the normal pipeline.

## Current development context at handoff
- Spear source: uploaded `spear.zip`; optimized version with 512px textures is about 0.76 MiB compressed; mesh is already low-poly, so no decimation needed.
- **Pending:** transfer optimized spear binary model/textures into appropriate repository asset folder; register it in equipment catalog; expose it in 3D/Pixel Studio; associate **Two-Handed Stab** animation; let user inspect alignment with configurable grip/offset/scale. No spear integration/merge/publish had been verified at the time of this note.
- **Deferred:** friendly Orc encounter selection displaying Dungeon Crawler Carl fallback instead of Orc placeholder sprite. Revisit after Unit Packages.
- Always check latest repo state: these pending notes can be superseded by later commits.

## Session continuity / communication preferences
- Prioritize direct implementation, minimal diagnosis when standard workflow already exists, and timely concrete progress.
- When a GitHub action fails, retry once before embarking on extensive troubleshooting; research established fixes before inventing new systems.
- Do not assume a file was pushed, PR merged, or candidate published without checking.
- Keep new handoffs and reproducible integration lessons in the repository so the next session does not have to reverse-engineer prior work.
