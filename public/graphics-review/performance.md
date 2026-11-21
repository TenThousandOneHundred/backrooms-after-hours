# Rendering benchmark

MacBook Pro (MacBookPro17,1), Apple M1, 16 GiB RAM, macOS 26.7.2, Chrome 158. The WebGL device reported ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version). The final four-route comparison uses published baseline 0887973. The final release is 392390d. All eight primary cases use those two revisions. Preparatory samples against merge 946c5cf are available separately. Earlier four-preset coverage compares baseline 56a9ad4 with integrated candidate f3d4121, using revision 54f5a24 for the reservoir. The browser ran both checkouts through local Vite development servers with device pixel ratio 1. The viewport was 1366 × 768, with a 1366 × 768 Standard buffer and a 1024 × 576 Performance buffer.

## Final four-route comparison

The table gives the median of three paired runs per scene and preset. On Level 0 the test holds the normal forward control through a collision-checked aisle for six metres. In the close encounter Bacteria approaches from six metres, winds up, lunges to 0.87 m and recovers, using the same pose flags as campaign AI. The pool route looks across the reservoir. The host route uses seven real WebRTC guests, the normal campaign loop and the same two presets. The attack path is scripted for repeatability. The walk, attack and reservoir use 90 measured frames after 24 warm-up frames. Synchronized frame work ends with a one-pixel GPU readback. Frame interval measures time between animation callbacks.

| Route | Preset | Frame median (ms), before → after | Frame p95 (ms) | Work median (ms) | Work p95 (ms) | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Six-metre Level 0 walk | Standard | 16.7 → 16.7 | 16.7 → 16.8 | 8.9 → 9.1 | 10.5 → 10.5 | 328 → 275 | 184,278 → 186,630 |
| Six-metre Level 0 walk | Performance | 16.7 → 16.7 | 16.8 → 16.7 | 7.9 → 7.4 | 9.0 → 8.3 | 328 → 275 | 184,278 → 186,630 |
| Bacteria windup and strike | Standard | 16.7 → 16.7 | 16.8 → 16.7 | 9.3 → 9.4 | 11.0 → 10.8 | 344 → 289 | 264,307 → 267,355 |
| Bacteria windup and strike | Performance | 16.7 → 16.7 | 16.7 → 16.7 | 7.5 → 7.3 | 9.4 → 9.6 | 344 → 289 | 264,307 → 267,355 |
| Poolrooms reservoir | Standard | 16.7 → 16.7 | 16.7 → 16.7 | 8.3 → 8.0 | 8.8 → 8.8 | 47 → 46 | 37,668 → 38,466 |
| Poolrooms reservoir | Performance | 16.7 → 16.7 | 16.8 → 16.7 | 6.4 → 6.6 | 7.1 → 7.4 | 47 → 46 | 37,668 → 38,466 |
| Networked eight-player host | Standard | 16.7 → 16.7 | 16.7 → 16.7 | 11.0 → 10.5 | 12.2 → 11.7 | 362 → 326 | 370,220 → 372,824 |
| Networked eight-player host | Performance | 16.7 → 16.7 | 16.7 → 16.7 | 9.1 → 8.1 | 10.3 → 10.0 | 362 → 326 | 370,220 → 372,824 |

On the final real host, both presets used 127 → 41 live renderer textures and 170 → 173 geometries. Performance used 1024 × 576, while Standard used 1366 × 768.

Displayed p95 stayed within 5% of baseline in 8/8 cases. Synchronized work p95 met the same threshold in 8/8.

The host recorded presentation cadence during 180 frames per preset after 120 warm-up frames. A second 90-frame window measured synchronized game work from team synchronization through rendering and GPU readback. All seven guest meshes stayed visible in all twelve measured settings.

[Six-metre walk captures, before](baseline-vfinal-aisle.webp) · [After](candidate-vfinal-aisle.webp) · [Bacteria attack, before](baseline-palette-attack.webp) · [After](candidate-palette-attack.webp)

## Fixed camera comparisons

The two builds ran the same seeded camera path in alternating order. Each sample warmed up 24 frames, then measured 90 frames. The table uses the median of three runs. Frame work includes updates and rendering, ending with a one-pixel GPU readback. Frame interval measures actual browser animation callbacks. The host fixture runs real campaign simulation and animates seven real remote explorer meshes using scripted poses. It excludes network and voice transmission.

| Route | Preset | Frame work median, ms (before → after) | Frame work p95, ms | p95 change | Frame interval median, ms | Frame interval p95, ms | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Level 0 crosshall camera sway | Standard | 8.6 → 7.8 | 9.4 → 8.9 | -5.3% | 16.7 → 16.7 | 16.7 → 16.8 | 98 → 92 | 62,602 → 62,602 |
| Level 0 crosshall camera sway | Performance | 6.5 → 6.6 | 7.9 → 7.3 | -7.6% | 16.7 → 16.7 | 16.7 → 16.7 | 98 → 92 | 62,602 → 62,602 |
| Level 0 crosshall camera sway | High | 10.5 → 9.7 | 14.5 → 10.9 | -24.8% | 16.7 → 16.7 | 16.8 → 16.8 | 116 → 110 | 74,272 → 74,272 |
| Level 0 crosshall camera sway | Auto | 10.6 → 10.1 | 12.1 → 11.1 | -8.3% | 16.7 → 16.7 | 16.7 → 16.8 | 116 → 110 | 74,272 → 74,272 |
| Dark Poolrooms reservoir | Standard | 6.7 → 7.0 | 8.8 → 8.5 | -3.4% | 16.7 → 16.7 | 16.8 → 16.7 | 47 → 46 | 37,668 → 38,466 |
| Dark Poolrooms reservoir | Performance | 4.1 → 5.5 | 6.6 → 6.9 | +4.5% | 16.7 → 16.7 | 16.8 → 16.8 | 47 → 46 | 37,668 → 38,466 |
| Dark Poolrooms reservoir | High | 10.1 → 9.2 | 12.8 → 24.0 | +87.5% | 16.7 → 16.7 | 16.8 → 16.8 | 62 → 57 | 58,370 → 59,912 |
| Dark Poolrooms reservoir | Auto | 10.1 → 11.2 | 12.5 → 20.3 | +62.4% | 16.7 → 16.7 | 16.8 → 16.7 | 62 → 57 | 58,370 → 59,912 |
| Close Bacteria locomotion | Standard | 10.4 → 10.3 | 13.3 → 13.3 | -0.0% | 16.7 → 16.7 | 16.8 → 16.7 | 275 → 251 | 274,545 → 276,501 |
| Close Bacteria locomotion | Performance | 8.2 → 7.8 | 9.8 → 9.2 | -6.1% | 16.7 → 16.7 | 16.7 → 16.7 | 275 → 251 | 274,545 → 276,501 |
| Close Bacteria locomotion | High | 14.7 → 11.9 | 20.7 → 14.8 | -28.5% | 16.7 → 16.7 | 16.8 → 16.8 | 293 → 270 | 360,958 → 363,958 |
| Close Bacteria locomotion | Auto | 12.8 → 15.4 | 24.4 → 19.0 | -22.1% | 16.7 → 16.7 | 33.3 → 16.8 | 293 → 270 | 360,958 → 363,958 |
| Eight-explorer host | Standard | 11.6 → 10.9 | 18.2 → 18.3 | +0.5% | 16.7 → 16.7 | 16.8 → 16.8 | 345 → 321 | 370,764 → 373,368 |
| Eight-explorer host | Performance | 9.0 → 8.5 | 9.9 → 9.8 | -1.0% | 16.7 → 16.7 | 16.7 → 16.8 | 345 → 321 | 370,764 → 373,368 |
| Eight-explorer host | High | 15.8 → 12.9 | 23.1 → 14.4 | -37.7% | 16.7 → 16.7 | 16.8 → 16.7 | 433 → 409 | 551,410 → 555,850 |
| Eight-explorer host | Auto | 14.1 → 13.9 | 26.4 → 26.5 | +0.4% | 16.7 → 16.7 | 33.3 → 33.3 | 433 → 409 | 551,410 → 555,850 |

The displayed p95 cadence stayed within 5% of baseline on 8 of eight Standard and Performance cases. Synchronized work p95 stayed within 5% on 8 of eight.

The fixed-route Auto rows maintain identical scale in both builds. The normal Auto measurement below allows automatic scaling. High and fixed-scale Auto had a longer synchronized work p95 in the reservoir even though displayed p95 stayed near 16.7 ms. Three pairs per setting give limited precision in the tail at a 60 Hz presentation rate.

## Resource lifetime

Renderer counts across three visits in the four-preset comparison build. Each cell lists geometry / texture resources, including the seven explorer instances on the host route. These are counts of GPU resource objects. VRAM bytes were unavailable.

| Route | First visit | Second | Third |
| --- | ---: | ---: | ---: |
| Level 0 crosshall camera sway | 72 / 19 | 83 / 21 | 83 / 21 |
| Dark Poolrooms reservoir | 36 / 24 | 36 / 24 | 36 / 24 |
| Close Bacteria locomotion | 166 / 43 | 177 / 43 | 177 / 43 |
| Eight-explorer host | 173 / 51 | 173 / 51 | 173 / 51 |

On the fixed Standard host route, the median live texture count fell from 119 to 51 across the three visits. The optimized avatar shares the bone-palette texture across material groups. Geometry and texture counters include cached assets as well as the current scene.

## Actor footage

The in-game comparison shows the Bacteria windup and strike, Hound chase, Smiler contact response, Veil warning and a seven-explorer group. Each build uses the same camera, action and time sample. [Watch the comparison](In-game%20actor%20motion.mp4) · [View the contact sheet](In-game%20actor%20comparison.jpg)

## Default Auto preset

A normal game loop was observed across seven alternating lobby/Deep Poolrooms visits. The fixed-preset work benchmark above parks its camera deterministically; this separate run reports what the default adaptive controller actually selected.

| Version | Observed scale / actual buffer | Lobby p95 (ms), median of visits | Pool p95 (ms), median of visits | Last lobby textures / geometries |
| --- | --- | ---: | ---: | ---: |
| Before | 1 / 1366 × 768 | 16.7 | 16.7 | 36 / 152 |
| After | 1 / 1366 × 768 | 16.7 | 16.8 | 38 / 155 |

## Eight-player room

Seven separate Chromium guest contexts connected to a real host with the normal room code. The cold-start sample began as soon as all seven explorers appeared. The host used the default Auto graphics setting and rendered seven moving explorer meshes. The guest clients sent positions over real WebRTC data channels and did not render their own GPU scenes on the benchmark machine.

| Version | Roster | Visible remote models | Buffer | Foreground interval p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Before | 8 | 7 | 1366 × 768 | 16.7 |
| After | 8 | 7 | 1366 × 768 | 33.3 |

The eight-player steady-state repeat let the GPU warm up for 120 callbacks after all seven guest models appeared, then sampled 180 frames. The table below is the median of three foreground host sessions.

| Version | Warmed frame median (ms) | Warmed p95 (ms) | All seven drawn |
| --- | ---: | ---: | --- |
| Before | 16.7 | 16.8 | Yes |
| After | 16.7 | 16.8 | Yes |

Each Standard and Performance result below uses three fresh eight-player rooms per build. Each room ran both presets in alternating order. The host sampled 180 callbacks after 120 warm-up frames per preset. Renderer statistics include all passes per frame and all live GPU resources. Guests exercised real room signaling and WebRTC pose traffic. They ran on the host machine and sent a voice-level field with their poses. Audio capture, transmission bandwidth and remote network latency were outside this experiment.

| Preset | Host buffer | Frame median (ms), before → after | Frame p95 (ms) | Draws | Triangles | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Standard | 1366 × 768 | 16.7 → 16.7 | 16.8 → 16.7 | 343 → 319 | 370,002 → 372,606 | 169 → 172 | 126 → 58 |
| Performance | 1024 × 576 | 16.7 → 16.7 | 16.7 → 16.7 | 343 → 319 | 370,002 → 372,606 | 169 → 172 | 126 → 58 |

## CPU and GPU breakdown

Separate instrumented run, 45 sampled frames per route and preset. CPU submit time is wall time spent updating and submitting work, and can include driver stalls. Readback wait includes outstanding GPU work and synchronization. Native GPU-only time is reported only where the browser provides timer queries.

| Route | Preset | CPU submit median, ms (before → after) | CPU p95, ms | GPU median, ms | GPU p95, ms | Readback wait median, ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Level 0 crosshall camera sway | Standard | 1.30 → 2.50 | 3.30 → 3.30 | 3.88 → 3.85 | 4.77 → 4.07 | 5.70 → 5.70 |
| Level 0 crosshall camera sway | Performance | 2.20 → 1.00 | 3.10 → 2.30 | 2.31 → 2.32 | 2.89 → 3.17 | 4.10 → 3.90 |
| Level 0 crosshall camera sway | High | 1.90 → 2.30 | 3.60 → 3.20 | 5.33 → 5.11 | 5.62 → 5.78 | 7.10 → 7.20 |
| Level 0 crosshall camera sway | Auto | 3.10 → 2.70 | 4.10 → 3.40 | 5.39 → 5.15 | 5.72 → 5.74 | 7.00 → 7.40 |
| Dark Poolrooms reservoir | Standard | 1.50 → 1.30 | 1.90 → 1.70 | 3.94 → 3.90 | 4.74 → 4.45 | 6.30 → 6.30 |
| Dark Poolrooms reservoir | Performance | 1.30 → 1.30 | 1.60 → 1.60 | 2.29 → 2.35 | 2.66 → 2.95 | 4.10 → 4.60 |
| Dark Poolrooms reservoir | High | 2.20 → 2.00 | 4.50 → 3.50 | 7.47 → 6.13 | 10.45 → 6.60 | 9.80 → 8.00 |
| Dark Poolrooms reservoir | Auto | 1.20 → 1.60 | 2.90 → 3.00 | 6.27 → 6.10 | 6.99 → 7.27 | 7.90 → 7.80 |
| Close Bacteria locomotion | Standard | 1.80 → 1.60 | 3.50 → 3.20 | 5.33 → 5.18 | 5.61 → 5.87 | 7.40 → 7.80 |
| Close Bacteria locomotion | Performance | 1.80 → 1.70 | 3.60 → 3.50 | 3.79 → 3.54 | 4.10 → 4.20 | 5.80 → 5.90 |
| Close Bacteria locomotion | High | 2.50 → 2.20 | 4.10 → 3.50 | 7.15 → 7.07 | 7.79 → 7.87 | 9.50 → 9.50 |
| Close Bacteria locomotion | Auto | 2.30 → 2.30 | 3.80 → 3.90 | 6.95 → 7.01 | 8.13 → 7.82 | 9.30 → 9.30 |
| Eight-explorer host | Standard | 2.10 → 2.00 | 2.50 → 4.00 | 5.23 → 5.15 | 5.67 → 5.90 | 8.10 → 7.70 |
| Eight-explorer host | Performance | 2.40 → 2.00 | 3.90 → 3.50 | 3.65 → 3.50 | 4.22 → 4.17 | 6.50 → 5.70 |
| Eight-explorer host | High | 2.80 → 2.50 | 3.30 → 4.10 | 7.27 → 7.10 | 7.95 → 8.10 | 10.20 → 9.40 |
| Eight-explorer host | Auto | 2.70 → 2.90 | 3.30 → 3.80 | 7.29 → 8.07 | 7.89 → 12.81 | 10.20 → 10.50 |

## Final Bacteria optimization

The attack row in the final four-route table uses shared monster skeleton palettes in final release 392390d. The median Standard renderer texture count in the close encounter changed from 60 to 34. These files record the additional three pairs per preset. [Baseline attack repeat](palette-baseline.json) · [Final attack repeat](palette-candidate.json) · [Final capture](candidate-palette-attack.webp)

Primary table raw data for release 392390d: [baseline walk](vfinal-walk-baseline.json) · [release walk](vfinal-walk-candidate.json) · [baseline reservoir](vfinal-pool-baseline.json) · [release reservoir](vfinal-pool-candidate.json) · [baseline and release real rooms](room-host.json). The room data use the releasedRooms field. The attack data appear above.

## Reproduce and inspect

Draw and triangle counts use the indicated camera and include every pass (color, shadow, reflection). Moving to another point in a level can change both draw counts and GPU load. The Apple M1 results apply to this device, Chrome version and viewport. These measurements used local assets and do not measure public download time.

Replay the [fixed camera scenes](../../tools/graphics-review/fixed-scenes.mjs), [guided routes](../../tools/graphics-review/guided-routes.mjs) and [networked host](../../tools/graphics-review/room-host.mjs) against the comparison checkouts. The [stage capture script](../../tools/graphics-review/capture-stages.mjs) produces matched stage images.

Raw samples include [baseline](paired-baseline.json), [integrated build](paired-candidate.json), [baseline reservoir](final-pool-baseline.json), [final reservoir](final-pool-candidate.json), [baseline Auto](baseline-auto.json), [integrated Auto](candidate-auto.json), [baseline GPU timers](split-baseline.json), [integrated GPU timers](split-candidate.json), [baseline reservoir GPU timers](split-pool-baseline.json), [final reservoir GPU timers](split-pool-candidate.json), [networked host](room-host.json), [original baseline guided routes](guided-baseline.json), [original candidate guided routes](guided-candidate.json), [published baseline guided routes](guided-final-baseline.json), [merged release guided routes](guided-final-candidate.json), [published baseline reservoir](pool-merged-baseline.json), and [merged release reservoir](pool-merged-candidate.json).
