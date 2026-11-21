# Repeating a graphics comparison

Run Vite from a baseline checkout and a candidate checkout on different local ports on the same machine. Keep the dependency cache separate for each checkout. Install Playwright in a separate test directory containing these scripts and use its Chrome channel. Test output goes in `graphics-results` unless `GRAPHICS_OUTPUT` points elsewhere.

```sh
node capture-stages.mjs before 5173
node capture-stages.mjs after 5174
node fixed-scenes.mjs 5173 5174 both paired 3
node guided-routes.mjs 5173 5174 both guided 3
node catch-timing.mjs before 5173
node catch-timing.mjs after 5174
node room-host.mjs 5173 standard
node room-host.mjs 5174 performance
```

The stage captures use Standard, a fixed animation time and 896 × 504 frames. The paths in `stage-views.json` are authored world grid coordinates selected from the campaign registry. The two timing scripts run alternating builds in one browser and use a 1366 × 768 viewport. Run timing with other GPU workloads closed. The room-host runner connects seven independent WebRTC clients through a generated room code and samples the foreground host. Alternate the starting preset and server order across three pairs. See the published performance report for warmup, sampling, resolution, and multiplayer details.

The catch timing test repeats Bacteria, Hound and Smiler contacts on Standard and Performance. Its setup timer ends when the synchronous capture handler returns. The frame interval samples cover the start of the on-screen catch.
