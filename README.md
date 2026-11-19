# Backrooms After Hours

**[Play in your desktop browser](https://tenthousandonehundred.github.io/backrooms-after-hours/)**

A first-person, single-player browser game inspired by *Escape the Backrooms*. Find four broken ladder pieces in the yellow lobby, make your way through the Habitable Zone, and follow the campaign into the Poolrooms, Terror Hotel, Plastic Mariana, and the arcade. The Bunker connects the ending routes. Four discoveries unlock the fifth ending on the same save.

The east telephone exchange links Records, Dispatch, and the old switchboard to the original Level 0 corridors. Two ladder pieces went missing there. Ringing phones draw the Bacteria, and staying in its sight can turn a stalk into a charge. From inside a locker you can hear its claws dragging past. Footsteps in the next aisle can give it away before you see it. Sprinting makes noise, hiding breaks pursuit, and getting caught kills you and sends you back to your checkpoint.

The game uses original, condensed layouts that recreate the campaign progression. Each area loads as you enter it. Checkpoints, puzzle progress, inventory, discovered endings, and settings are saved in the browser you use to play.

![The playable yellow lobby, seen from the player’s perspective](docs/lobby.webp)

In the Lobby, the Bacteria shares its hunting ground with two other creatures. The **Veil** sings when you look into its floating masks. Turn away or break sight to escape its hold. The ceiling-dwelling **Bellwether** knocks twice before listening. Stand still or crouch-walk until it tolls. The toll draws the roaming hunter toward the bell, giving you a chance to slip past. The masks also appear in the guest wing, and a Bellwether hangs in the archive.

## Controls

| Action | Input |
| --- | --- |
| Move and look | WASD and mouse |
| Look without mouse capture | Drag the view or use the left and right arrow keys |
| Sprint / crouch / jump | Shift / C or Ctrl / Space |
| Interact, pick up, or hide | E |
| Flashlight or lidar in Lights Out | F |
| Almond water / energy bar | 1 / 2 |
| Inventory / pause | Tab / Esc |

The field manual on the title screen lists controls and ending discoveries. Continue expedition returns to the latest checkpoint. Starting a new run replaces that browser's campaign record.

## Make and play mods

Open **Mods** on the title screen to import a JSON expedition or play **Dead Letter Office**, a two-level sample. Mods have independent checkpoints. The [modding guide](https://tenthousandonehundred.github.io/backrooms-after-hours/modding.html) includes a working first room, the tile alphabet, supported monsters, and the full marker reference. Edit the [sample file](public/mods/dead-letter.json) to build and share your own expedition.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. To check the campaign and play the production build:

```sh
npm test
npm run build
npm run preview
```

The GitHub Pages workflow runs the campaign tests and TypeScript build, then deploys the static output from `main`.

## Credits

Created as an unofficial fan game. *Escape the Backrooms* is the gameplay reference by Fancy Games and Blackbird Interactive, published by Secret Mode. The story route was cross-checked against a [recorded solo playthrough](https://www.youtube.com/watch?v=JSLfVceuQQU), a [campaign guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2917649860), and the [publisher's Level 421 update](https://wearesecretmode.com/escape-the-backrooms-patch-notes).

The Bacteria uses a skinned Blender model with painted vertex colors, a packed hide normal map, and six skeletal animations for listening, stalking, chasing, winding up, striking, and recovering. Its fatal close-up comes from the live 3D model. The editable [Blender source](art/Bacteria.blend) and [browser model](public/models/bacteria.glb) are included. The Veil and Bellwether share a separate [Blender source file](art/Residents.blend). The environments, remaining creatures, and sound are procedural. OpenAI ImageGen was used for the title artwork and the Hound and Smiler portraits. Three.js is distributed under the [MIT license](public/licenses/Three.txt). Barlow Condensed and IBM Plex Mono are bundled under the [Barlow](public/licenses/Barlow-Condensed.txt) and [IBM Plex](public/licenses/IBM-Plex-Mono.txt) SIL Open Font Licenses.

## Playability checks

The unit tests verify map reachability, required items, physical puzzle inputs, and ending gates. There is also a browser route test that drives movement, mouse look, interaction keys, keypads, retries, and ending choices through a fresh campaign. It accelerates the simulation clock and samples a rendered frame in each scene.

To run it, start the development server, open it in a fresh browser profile, then run the following in that page's developer console. The test starts a new run in that profile.

```js
await (await import('/tests/player-route.mjs')).runRoute()
```

For a shorter check, pass `{ lobbyOnly: true }` to test hiding from the Bacteria, its attack, and retrying with the ladder piece still in your inventory.
