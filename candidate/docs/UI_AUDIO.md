# UI and title audio — local pass

- `js/ui-audio.mjs` owns semantic open/back playback, two decoded-buffer caches, a UI gain, mute state, compound-transition coalescing, stale-request cancellation and cross-page navigation intent.
- User file Inventory_Close_01.wav is `assets/audio/sfx/ui/page-open.wav`; Inventory_Close_02.wav is `page-back.wav`. Files are copied without editing. UI volume defaults to 45% under the shared SFX mixer on the main game; `adventurePartyUiAudio.setVolume(0..1)` adjusts it independently.
- Main-menu screens, combat entry, inventory, character sheet, class report and spell panel use semantic transitions. Duplicate opens and closing already-closed panels are silent. Switching overlays produces one final cue.
- Root application pages load the same service. Same-origin page links carry an open/back intent to the destination. Return links and exploration Escape use back; editor Test Map uses open. Settings details use open/back. Browser autoplay restrictions remain respected; pending page cues can wait for the first gesture.
- Arcane Dust (`068_Arcane_Dust.wav`) is now the title loop, connected to music gain. It decodes once, loops through one source and stops on leaving title/muting. Re-entry reuses the buffer. Embedded title note data, oscillator sequencer and obsolete R218 title-disable stages were removed. No standalone MIDI file was tracked in the repository.
- Existing game sounds otherwise unchanged. User-provided audio provenance is recorded in ATTRIBUTIONS.md; no third-party license assertion is made.
- Local Node suite: 133/133 passed. Browser confirms semantic open/back cues and title music running after return. No push/deployment requested for this pass.
