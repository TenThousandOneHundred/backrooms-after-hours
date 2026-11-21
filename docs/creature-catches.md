# Creature catches

Each of the 25 catches opens with an attack and cuts into a second Blender action at impact. The game plays the short film only for the captured explorer and synthesizes its sound on that device. The security camera plays its detection shot and resets the player. Reduced motion presents a still from the same shot.

The editable actions live in the Bacteria, Bestiary, LevelCreatures and Residents Blender libraries. Look for the actor name followed by **Attack** or **Jumpscare** in the NLA editor. The original encounter AI still determines when the attack connects.

## Watch the silent previews

| Creature | Catch | Creature | Catch |
| --- | --- | --- | --- |
| [Bacteria](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/bacteria.mp4) | Throws its hood sideways and opens the second jaw | [Hound](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/hound.mp4) | Snaps its muzzle around the lens |
| [Smiler](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/smiler.mp4) | Tilts its grin out of the dark | [Deathmoth](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/moth.mp4) | Folds its wings around the viewer |
| [Skin-Stealer](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/skinstealer.mp4) | Peels its mask sideways while reaching | [Wretch](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/wretch.mp4) | Uncoils its spine into a howl |
| [Kitty](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/kitty.mp4) | Snaps its blank head from shoulder to shoulder | [Watcher](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/watcher.mp4) | Swivels the eye inside its mantle |
| [Partygoer](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/partygoer.mp4) | Lets the balloon swing as the sleeve lunges | [Animation](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/animation.mp4) | Jerks its control bar and clacks its jaw |
| [Animated King](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/king.mp4) | Bows the mask before the royal strike | [Clump](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/clump.mp4) | Folds three hands across the lens |
| [Crawler](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/crawler.mp4) | Twists its back and sweeps its paired hooks | [Plastic Shark](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/shark.mp4) | Whips its tail and banks into a bite |
| [Leviathan](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/leviathan.mp4) | Breaches from below and rolls across the lens | [Faceling](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/faceling.mp4) | Reaches up as its blank face rolls sideways |
| [Security Camera](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/camera.mp4) | Pans past the viewer and snaps back into focus | [Neighborhood Watch](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/neighborhoodwatch.mp4) | Braces its stilts and drops the eye |
| [Farmer Faceling](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/farmer.mp4) | Swings the motor across the viewer | [Aranea Membri](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/membri.mp4) | Drops its carapace between two reaching forelegs |
| [Scratcher](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/scratcher.mp4) | Rakes across the lens with a forelimb | [Bone Thief](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/bonethief.mp4) | Extends a hand out of the burrow |
| [Party Host](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/partyhost.mp4) | Spreads its sleeves and folds them around the viewer | [Veil](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/veil.mp4) | Turns three masks in opposing directions |
| [Bellwether](https://tenthousandonehundred.github.io/backrooms-after-hours/encounters/catches/bellwether.mp4) | Parts its petals and swings the clapper overhead |  |  |

## Optimization measurements

Chrome on an Apple M1 MacBook Pro with 16 GiB RAM, at a 1366 × 768 viewport. Standard rendered at 1366 × 768, Performance at 1024 × 576. This machine served as the school-laptop proxy. The baseline was commit `4c52c3b`.

The catch test measured the synchronous cost of the catch handler separately from animation playback. It forced matching Bacteria, Hound and Smiler contacts three times per preset and sampled 46 browser animation callbacks per catch. The previous release rendered a portrait, copied it to JPEG and drew the world again inside the handler. The new release preloads compressed bytes for the current stage and creates a video decoder on capture. These setup figures exclude network transfer and time to the first decoded video frame.

| Preset | Median setup before → after | Displayed p95 before → after |
| --- | ---: | ---: |
| Standard | 116.3 → 1.6 ms | 16.8 → 16.7 ms |
| Performance | 93.5 → 1.5 ms | 16.7 → 16.7 ms |

Three paired runs per route measured ordinary gameplay with the replay scripts in [tools/graphics-review](../tools/graphics-review). The host ran the campaign with seven independently connected WebRTC guests visible. Each cell gives the median of three per-run p95 values in milliseconds. The synchronized work measurement ends at GPU readback.

| Route | Preset | Displayed p95 before → after | Work p95 before → after |
| --- | --- | ---: | ---: |
| Level 0 walk | Standard | 16.7 → 16.7 | 10.1 → 10.6 |
| Level 0 walk | Performance | 16.7 → 16.7 | 8.8 → 9.0 |
| Bacteria approach and strike | Standard | 16.7 → 16.7 | 11.0 → 11.8 |
| Bacteria approach and strike | Performance | 16.7 → 16.8 | 9.1 → 9.3 |
| Dark Poolrooms | Standard | 16.7 → 16.7 | 8.6 → 7.9 |
| Dark Poolrooms | Performance | 16.7 → 16.8 | 6.7 → 6.4 |
| Eight-player host | Standard | 16.7 → 16.7 | 12.0 → 12.1 |
| Eight-player host | Performance | 16.7 → 16.7 | 9.8 → 9.8 |

On the first pass the eight-player Standard host reached a 33.3 ms displayed p95. The final pass removed idle video decoders, skipped drawing the world underneath the opaque catch, and moved repeated camera-transform work out of individual floor draws. Simulation and co-op continue behind the film. [Raw samples from both passes](creature-catch-benchmark.json).

The 25 films and stills together fell from 10.26 MB in the first encode to 5.41 MB. Both encodes used 960 × 540 at 30 fps. Across the 25 movies the median compression similarity score (SSIM) was 0.989. Only the current stage’s creatures are preloaded.
