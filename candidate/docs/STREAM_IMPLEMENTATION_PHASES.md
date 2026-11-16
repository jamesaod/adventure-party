# Stream baseline reset — R238C453

The user's current direction supersedes the earlier four-phase visual plan. The stream is a deeper bare-dirt channel, using the SAME dirt texture, wet mud darkening and water color blend as the existing rain basins. Its permanent water level remains independent of rainfall. No flow, foam, caustics, pebble material or special 3D stream stones remain active. The retired stream-details module and its dedicated test were backed up and removed. Ordinary ground-cover rocks/sticks and shared rain/footstep splash effects remain intact.

The dirt-to-grass edge and grass-tuft density share a smooth bank mask. Dry edges feather over the shallow bank; actual standing water clears the grass. The new bank elevation also blends into existing bare-patch depressions. Path tracing, width, depth, water level and JSON presets are retained. The obsolete flow slider is removed; old preset flow speeds are accepted but normalized to zero.

A still stream does not keep the weather animation scheduler running by itself. Water interaction effects and weather use the existing scheduler. Terrain remains visual: no swimming, currents or movement penalties.

The previous requests for more stone-bed variation and muddy transitions are superseded by this bare-mud baseline, rather than pending work to reintroduce stone textures. Future additions should start from user feedback on this simple version.
