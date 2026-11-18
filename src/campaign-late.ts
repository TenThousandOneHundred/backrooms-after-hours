import { stage, item, act, code, exit, note, hide, prop, rangeFlags, challenge } from './campaign-format.ts';

export const late = [
  stage(
    'hotelchase',
    'Level !~!',
    'Hotel Chase',
    'chase',
    'The service bell keeps ringing after you take your hand away. At the end of the hall a blue room glows.',
    'Release the gate, follow the blue safe rooms and take the cutter to the boarded fire exit.',
    `
##############################
#@...S.....#.......#..B..H...#
########...#..###.....#####..#
#.....H.......#....#.........#
#.#############..##########..#
#.........!...#.........E....#
####.######...######.#..#.#..#
#.........#..........#..#....#
##############################`,
    {
      S: act(
        'Release the gate magnet',
        'chase-release',
        'panel',
        'The bell stops. Something begins running.',
      ),
      H: hide('Duck inside the blue safe room', 'light'),
      B: item('Board cutter', 'chase-cutter', 'tool', 'The blade is still warm.', ['chase-release']),
      E: exit('Cut the fire-exit boards', 'courtyard2', ['chase-cutter']),
    },
    'clump',
    Math.PI / 2,
  ),
  stage(
    'courtyard2',
    'Level 188 / East wing',
    'Windows to the Soul',
    'courtyard',
    'Rows of hotel windows overlook the elevator. Three empty outlines in the reception carpet are labeled A, B and C.',
    'Recover the three CRT carts, connect them at reception, and descend to the pools.',
    `
#########################
#A..#....#....B.#....H..#
#...#..###.####.###.....#
##.##..............#.##.#
#........#....##...#.!..#
#.######.#..#.##...#....#
#....#C.....#.....##....#
###..#####..###.####..###
#@...L..G....D......T..E#
#########################`,
    {
      A: challenge(
        item('Cart A • reception feed', 'crt1', 'trolley', 'The wheels squeak as you move the cart.'),
        { kind: 'haul', destination: 'court-monitors', delivery: 'reception’s monitor strip' },
      ),
      B: challenge(
        item('Cart B • security feed', 'crt2', 'trolley', 'The monitor shows an empty reception desk.'),
        { kind: 'haul', destination: 'court-monitors', delivery: 'reception’s monitor strip' },
      ),
      C: challenge(item('Cart C • guest feed', 'crt3', 'trolley', 'The screen glows with green static.'), {
        kind: 'haul',
        destination: 'court-monitors',
        delivery: 'reception’s monitor strip',
      }),
      T: act(
        'Connect the CRT carts',
        'court-monitors',
        'terminal',
        'Three pictures align. The service hatch opens.',
        rangeFlags('crt', 3),
      ),
      G: act('Release the Hub deadbolt', 'shortcut-court', 'panel', 'The east-wing shortcut is available.'),
      L: exit('Enter the Hub shortcut', 'hub', ['shortcut-court']),
      H: hide('Hide in a guest wardrobe'),
      D: prop('desk'),
      E: exit('Descend through the service hatch', 'deepool', ['court-monitors'], 'vent'),
    },
    'membri',
    Math.PI / 2,
  ),
  stage(
    'deepool',
    'Level 37.2 / Reservoir',
    'Dark Poolrooms',
    'pool',
    'A life raft scrapes against the bottom of the reservoir. The stairs beside it are stained at last year’s waterline.',
    'Prime the reservoir valves and launch the raft into the stagnant pools.',
    `
########################
#...V...#.....W.....#..#
#.......#...........#..#
#..##....~~~~..##......#
#..##..~~~~~~..##...#..#
#......~~~~~~.......#..#
#..R...~~~~~~...X.....E#
#@.......P......#......#
########################`,
    {
      V: challenge(
        act('Open north inlet', 'pool-inlet-n', 'valve', 'A column of water rises from the drain.'),
        { kind: 'wind' },
      ),
      W: challenge(act('Open east inlet', 'pool-inlet-e', 'valve', 'The raft lifts off the tiles.'), {
        kind: 'wind',
      }),
      X: challenge(act('Open south inlet', 'pool-inlet-s', 'valve', 'The water meets the striped mark.'), {
        kind: 'wind',
      }),
      R: act('Launch the safety raft', 'raft', 'boat', 'The raft drifts into the channel.', [
        'pool-inlet-n',
        'pool-inlet-e',
        'pool-inlet-s',
      ]),
      P: note('Reservoir notice', 'Dark water carries filament bacteria. Keep to the pale perimeter tiles.'),
      E: exit('Paddle into the lock channel', 'stagnant', ['raft'], 'boat'),
    },
  ),
  stage(
    'stagnant',
    'Level 37.2 / Pump house',
    'Stagnant Pools',
    'pool',
    'The float gauge sticks halfway up. In the tiled pump halls the pipes thump like a second heartbeat.',
    'Turn four pump valves, then drain the lock and take the flume.',
    `
#######################
#1..#.~~~.#......#...4#
#.#.#.#~~.#.####.#.#..#
#.#...#...#..H.#...#..#
#.#####.######.#.###..#
#2...~.....!...#.3....#
###..~.#####..#######.#
#@...~...P..........E.#
#######################`,
    {
      ...Object.fromEntries(
        rangeFlags('pump', 4).map((f, i) => [
          String(i + 1),
          challenge(act('Turn pump valve ' + (i + 1), f, 'valve', 'The pump gauge moves one mark.'), {
            kind: 'wind',
          }),
        ]),
      ),
      H: hide('Hide on the inspection platform', 'crate'),
      P: act(
        'Drain the lock',
        'lock-drained',
        'panel',
        'A whirlpool opens the throat of the flume.',
        rangeFlags('pump', 4),
      ),
      E: exit('Enter the tiled flume', 'funplus', ['lock-drained'], 'slide'),
    },
    'clump',
  ),
  stage(
    'funplus',
    'Level Fun+',
    'The Party Continues',
    'party',
    'Four strings of lights meet above a mechanical claw. A colored key is missing from each corner.',
    'Clear the pink, blue, red and cloud wings. Fit their keys into the mechanical arm.',
    `
#########################
#..V....P..#..F.....B...#
#..##......#....##......#
#...##..##.#.##..##.....#
#####...##...##...#######
#.........A........E....#
#.####...#...#...####...#
#..G..R..#...#..L...C...#
#........#.@.#....H..!..#
#########################`,
    {
      V: note(
        'Pink hall • play the VHS',
        'The colors flash pink, yellow, blue, pink. Under the screen: PINK 1, BLUE 2, YELLOW 3.',
        'terminal',
      ),
      P: code(
        'Pink hall • repeat balloon colors',
        '1321',
        'fun-pink',
        'The pink key drops into the return slot.',
      ),
      F: item('Party popper', 'firework', 'bar', 'A compressed-paper popper from the blue table.'),
      B: act(
        'Startle the blue hall host',
        'fun-blue',
        'panel',
        'Confetti bursts and the blue key rolls free.',
        ['firework'],
      ),
      G: note(
        'Red hall • glow-stick chart',
        'Circle glows green (2), star glows yellow (8), triangle glows red (4).',
        'light',
      ),
      R: code(
        'Red hall • triangle / circle / star',
        '428',
        'fun-red',
        'The red key drops out of the blacklight box.',
      ),
      L: note(
        'Cloud hall • inspect balloon ribbons',
        'The striped balloon is heavier than the others. Something taps inside it.',
        'toy',
      ),
      C: act('Pop the striped balloon', 'fun-cloud', 'toy', 'A white cloud key falls out.'),
      H: hide('Duck under the cloud table', 'table'),
      A: challenge(
        act('Align the four-key arm', 'fun-arm', 'panel', 'Four catches turn at once.', [
          'fun-pink',
          'fun-blue',
          'fun-red',
          'fun-cloud',
        ]),
        { kind: 'align' },
      ),
      E: exit('Pull the stage curtain', 'school', ['fun-arm']),
    },
    'partygoer',
  ),
  stage(
    'school',
    'Level 52',
    'The School Halls',
    'school',
    'A figure in a blue mask stands beneath the exit sign. It raises a finger to its lips.',
    'Follow the blue guide lights from classroom to classroom. Stay low near the party.',
    `
########################
#@..g..#....H..#.....E.#
###....#.#####.#.###.#.#
#.....g...#..g....#g.#.#
#..####.###.#.#####..#.#
#.....#...g.#..g.....#.#
#..H..#.....#...!...H..#
########################`,
    {
      g: prop('light', 0x4e9de9),
      H: hide('Hide under a school desk', 'desk'),
      E: exit('Use the final stairwell', 'slides'),
    },
    'partygoer',
    Math.PI / 2,
  ),
  stage(
    'slides',
    'Level 55.1 / Floor I',
    'The Photographic Annex',
    'slides',
    'Two still frames are taped to the elevator panel. Shutter clicks echo across an empty loading floor.',
    'Take the survey camera and photograph the graffiti and the opening to Level 0.',
    `
#####################
#....G..#...........#
#.###...#...##......#
#...#.......##.L....#
#...#..###..........#
#@..C...#......E....#
#####################`,
    {
      C: item('Survey camera', 'camera', 'camera', 'The exposure counter reads 06.'),
      G: challenge(
        act('Photograph the graffiti', 'photo1', 'portrait', 'A white flash freezes the wall markings.', [
          'camera',
        ]),
        { kind: 'photo' },
      ),
      L: challenge(
        act(
          'Photograph the yellow opening',
          'photo2',
          'vent',
          'The photograph shows a passage wider than the opening.',
          ['camera'],
        ),
        { kind: 'photo' },
      ),
      E: exit('Ride the survey lift to floor II', 'slides2', ['photo1', 'photo2'], 'elevator'),
    },
    undefined,
    Math.PI / 2,
  ),
  stage(
    'slides2',
    'Level 55.1 / Floor II',
    'The Empty Motor Pool',
    'slides',
    'The next photos show an abandoned van and a nest of black wires. The wires move.',
    'Photograph the van and the Bacteria sighting, then return to the lift.',
    `
#####################
#..V....#....H......#
#.##..#...#...##.B..#
#.....###.#......!..#
#..##...#...##......#
#@..E...............#
#####################`,
    {
      V: challenge(
        act('Photograph the service van', 'photo3', 'car', 'The van develops without a driver.', ['camera']),
        { kind: 'photo' },
      ),
      B: challenge(
        act(
          'Photograph the Bacteria sighting',
          'photo4',
          'camera',
          'A single black shape crosses the frame.',
          ['camera'],
        ),
        { kind: 'entity-photo' },
      ),
      H: hide('Hide in the motor-pool locker'),
      E: exit('Ride to the sculpture floor', 'slides3', ['photo3', 'photo4'], 'elevator'),
    },
    'bacteria',
    Math.PI / 2,
  ),
  stage(
    'slides3',
    'Level 55.1 / Floor III',
    'The Wrong Door',
    'slides',
    'The lift deposits you among a field of stone faces. The last two negatives are already warm.',
    'Photograph the stone heads and Skin-Stealer sighting, then open the white door.',
    `
#######################
#...S.....#.....D....E#
#..###..#...##....#...#
#......##....##..#....#
#.#....#.........#..!.#
#@....H..##...........#
#######################`,
    {
      S: challenge(
        act('Photograph the stone heads', 'photo5', 'portrait', 'Their faces all turn out black.', [
          'camera',
        ]),
        { kind: 'photo' },
      ),
      D: challenge(
        act(
          'Photograph the Skin-Stealer sighting',
          'photo6',
          'camera',
          'The developed image shows your own suit.',
          ['camera'],
        ),
        { kind: 'entity-photo' },
      ),
      H: hide('Hide in the equipment case', 'crate'),
      E: {
        kind: 'ending',
        name: 'Open the white door',
        ending: 'wrong',
        target: 'bunker',
        gives: ['wrong'],
        need: rangeFlags('photo', 6),
        model: 'door',
        description:
          'A familiar street waits outside. The door swings shut. A second later you wake beneath a M.E.G. blanket.',
      },
    },
    'skinstealer',
    Math.PI / 2,
  ),
];
