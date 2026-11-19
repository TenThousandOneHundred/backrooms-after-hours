import {
  stage,
  item,
  act,
  code,
  exit,
  note,
  hide,
  prop,
  noteKeys,
  rangeFlags,
  end,
  challenge,
} from './campaign-format.ts';

const tapes = Object.fromEntries(
  [...'abcdefghijklmnop'].map((letter, i) => [
    letter,
    item(
      'Archive tape ' + String(i + 1).padStart(2, '0'),
      'tape' + (i + 1),
      'tape',
      'The reel is marked RETURN TO DESK.',
    ),
  ]),
);

export const middle = [
  stage(
    'library',
    'Archive / The End',
    'The End',
    'library',
    'THE END hangs above the shelves in crooked letters. A single terminal is still indexing the returns.',
    'Recover all sixteen reels and mount the archive. The blind Scratcher follows sound.',
    `
###########################
#..a...b...c...d...A......#
#..#####..#####..#####..e.#
#f...&..g......h.......i..#
#..#####..#####..#####....#
#j......k....!.....l...m..#
#..#####..#####..#####....#
#n....o.........p.....E...#
#.....H....K.....@........#
###########################`,
    {
      ...tapes,
      K: {
        ...act(
          'Mount archived reels',
          'archive-done',
          'terminal',
          'The last tape unwinds. A pale rectangle opens behind the stacks.',
          rangeFlags('tape', 16),
        ),
        consumes: rangeFlags('tape', 16),
      },
      H: hide('Shelter beneath the returns desk', 'desk'),
      A: act(
        'Ring the fire alarm',
        'archive-alarm',
        'panel',
        'The alarm bell rings at the far end of the stacks.',
      ),
      E: exit('Step through the projection', 'village', ['archive-done'], 'door'),
    },
    'scratcher',
  ),
  stage(
    'village',
    'Level 94',
    'Motion',
    'village',
    'Painted clouds hang low over the hills. A tinny nursery tune drifts from an ice-cream van.',
    'Follow the road to the floating castle. Hide in the cottages when the Animations close in.',
    `
########################
#...........#........E.#
#..###..#...#..###.....#
#..#H...#.........##...#
#.....####....##.......#
#.......v..!..#...##...#
#..###.....#.....#.H...#
#..#.H..#..#..#..###...#
#..###..#.....#........#
#@........##.....v.....#
########################`,
    {
      H: hide('Shelter in a cottage wardrobe'),
      v: prop('car', 0xc7a780),
      E: exit('Climb the hanging castle rope', 'castle', [], 'ladder'),
    },
    'animation',
  ),
  stage(
    'castle',
    'Level 94 / Castle',
    'The Animated King',
    'castle',
    'A cardboard sun is nailed to the rafters. The monarch on the stage seems to be painted on both sides.',
    'Set the three matching crates on their marks and restart the coaster. Keep the King in your light.',
    `
###################
#..C..I.#......E..#
#.......#..T......#
#..##.......#.....#
#S....!.....#...M.#
#..##.J.##...O....#
#.......#..@......#
###################`,
    {
      C: challenge(
        {
          ...act('Move the circle crate', 'crest-circle', 'crate', 'The round seal lights up.'),
          color: 0x7dafa8,
        },
        { kind: 'haul', destination: 'castle-I', delivery: 'the green circle seal' },
      ),
      S: challenge(
        { ...act('Move the star crate', 'crest-star', 'crate', 'The star seal lights up.'), color: 0xd2a258 },
        { kind: 'haul', destination: 'castle-J', delivery: 'the gold star seal' },
      ),
      M: challenge(
        { ...act('Move the moon crate', 'crest-moon', 'crate', 'The moon seal lights up.'), color: 0xb18ab8 },
        { kind: 'haul', destination: 'castle-O', delivery: 'the violet moon seal' },
      ),
      I: { ...note('Circle floor seal', 'A circular groove for the green crate.', 'seal'), color: 0x7dafa8 },
      J: {
        ...note('Star floor seal', 'Star-shaped grooves surround this gold seal.', 'seal'),
        color: 0xd2a258,
      },
      O: { ...note('Moon floor seal', 'A crescent is cut into the violet paint.', 'seal'), color: 0xb18ab8 },
      T: challenge(
        act('Power the coaster', 'coaster-power', 'panel', 'The restraints lift. Get to the platform.', [
          'crest-circle',
          'crest-star',
          'crest-moon',
        ]),
        { kind: 'coaster' },
      ),
      E: exit('Board the coaster', 'dark', ['coaster-power'], 'trolley'),
    },
    'king',
  ),
  stage(
    'dark',
    'Level 6',
    'Lights Out',
    'dark',
    'Your torch beam stops at the lens. A survey unit rattles quietly against the workbench.',
    'Collect the LiDAR unit. Pulse it in the dark and follow the main hall past the Wretch.',
    `
#######################
#....#..#....#..#....E#
#.##.#..#.##.#..#.#.###
#.#P....#.#.....#.#...#
#.#####.#.####..#.#.#.#
#@..L...#.......#...#.#
####.####.###.#######.#
#.......#...#...!..H..#
#.#####.###.###.###.#.#
#.....#.........#.....#
#######################`,
    {
      L: item('Handheld LiDAR', 'lidar', 'flashlight', 'Press F to send a ranging pulse across the walls.'),
      P: exit('Open the pink service hatch', 'pink', ['wrong', 'lidar'], 'vent'),
      E: exit('Find the flooded door', 'ocean', ['lidar']),
      H: hide('Hold your breath in the pipe recess', 'locker'),
    },
    'wretch',
    Math.PI / 2,
  ),
  stage(
    'ocean',
    'Level 7',
    'Thalassophobia',
    'ocean',
    'The rooflines of a village stand just above the water. The dive cage hangs from an unmanned crane.',
    'Take the skiff to the dive equipment and lower the cage.',
    `
#######################
#..H......#...........#
#..#...##.#.##.....T.E#
#......##...##........#
#..##......#....###...#
#..##.....#.....###...#
#......##......#......#
#@.B...##...G....S....#
#######################`,
    {
      B: act('Untie the skiff', 'skiff', 'boat', 'The mooring rope falls away.'),
      G: item('Diving mask', 'mask', 'mask', 'The seal holds.', ['skiff']),
      S: item('Air cylinder', 'air-tank', 'bottle', 'The pressure gauge reads full.', ['skiff']),
      T: act(
        'Unlock the waterfront shortcut',
        'shortcut-ocean',
        'panel',
        'The Hub passage is open from the other side.',
      ),
      H: exit('Return to the Hub', 'hub', ['shortcut-ocean']),
      E: exit('Lower the diving cage', 'depths', ['skiff', 'mask', 'air-tank'], 'cage'),
    },
  ),
  stage(
    'depths',
    'Level 7 / Abyss',
    'Below the Village',
    'ocean',
    'The wire snaps. Your cage hits silt and a shadow larger than the village passes overhead.',
    'Follow the guide lights past the damaged cage. The big shadow turns toward a lit torch.',
    `
####################
#@..l....##...H....#
###.###.....##..l..#
#....##.###.##...#.#
#..l....#........#.#
#.####..#.##..#....#
#....l..!.#...#...E#
####################`,
    {
      l: prop('light', 0x61c8de),
      H: hide('Shelter inside the wrecked dive cage', 'cage'),
      E: exit('Swim into the limestone crack', 'cave', [], 'vent'),
    },
    'leviathan',
    Math.PI / 2,
  ),
  stage(
    'cave',
    'Level 8',
    'Cave System',
    'cave',
    'Pale fungi cling to the wet rock. A narrow bridge bends above a fissure.',
    'Follow the fungus through the moth cavern, cross the old bridge and find the survey camp.',
    `
#########################
#@..f..##....f....##....#
###..#.##..#####....#.H.#
#....#....##...###..#.###
#..###.f.##..B......f...#
#...###....##.####.###..#
###...!..#..#....#.....E#
#########################`,
    {
      f: prop('plant', 0x72d2a6),
      B: act('Cross the survey bridge', 'cave-bridge', 'ladder', 'The old bridge swings behind you.'),
      H: hide('Take shelter beneath the ledge', 'crate'),
      E: exit('Enter the survey camp', 'projection', ['cave-bridge']),
    },
    'moth',
    Math.PI / 2,
  ),
  stage(
    'projection',
    'Level 0.11',
    'Shifting Shadows',
    'lobby',
    'The projector points at a blank wall. Chalk circles mark the feet of the missing furniture.',
    'Read the projected shapes, open the tool locker and trip all four shutter releases.',
    `
#######################
#..P.....#...3.......E#
#.###..#.#.#####..#...#
#1....K#...#..L#...H..#
####..####.#...#..##..#
#..2.......#...4......#
#.@...#..##.....#..!..#
#######################`,
    {
      H: hide('Shelter inside the projection booth', 'locker'),
      P: note(
        'Turn the projector',
        'The first shadow is a triangle, the second a square, the third a pentagon. Count edges.',
        'terminal',
      ),
      K: code('Open the tool locker', '345', 'tool-locker', 'The tool locker opens.'),
      L: item('Survey chainsaw', 'saw', 'tool', 'A battered tool for clearing boarded passages.', [
        'tool-locker',
      ]),
      ...Object.fromEntries(
        rangeFlags('shutter', 4).map((flag, i) => [
          String(i + 1),
          act(
            'Clear boards and release shutter ' + (i + 1),
            flag,
            'panel',
            'The shutter relay clicks closed.',
            ['saw'],
          ),
        ]),
      ),
      E: exit('Roll up the garage shutter', 'courtyard1', rangeFlags('shutter', 4)),
    },
    'bacteria',
  ),
  stage(
    'courtyard1',
    'Level 188 / West bridge',
    'Courtyard Windows',
    'courtyard',
    'Five columns of identical windows look onto the empty court. Six floors still have a lamp burning.',
    'Read the lit window columns from the top floor down, then open the bridge gate.',
    `
####################
#..A..B..C..D..F..G#
#..................#
#######...###..#####
#@......#.###...K.E#
####################`,
    {
      A: note('Sixth floor', 'Column 4 is lit on the sixth floor.', 'light'),
      B: note('Fifth floor', 'Column 1 is lit on the fifth floor.', 'light'),
      C: note('Fourth floor', 'Column 5 is lit on the fourth floor.', 'light'),
      D: note('Third floor', 'Column 3 is lit on the third floor.', 'light'),
      F: note('Second floor', 'Column 1 is lit on the second floor.', 'light'),
      G: note('First floor', 'Column 4 is lit on the first floor.', 'light'),
      K: code('Bridge keypad • top to bottom', '415314', 'bridge-code', 'The intercom buzzes once.'),
      E: exit('Cross the bridge gate', 'suburbs', ['bridge-code']),
    },
    undefined,
    Math.PI / 2,
  ),
  stage(
    'suburbs',
    'Level 9',
    'Darkened Suburbs',
    'suburbs',
    'The neighborhood map marks three houses with the same red circle. The Neighborhood Watch sees down the street. Stop beneath a lit porch until the eye passes.',
    'Activate the three home terminals. The outpost holds the administrator card for the field gate.',
    `
#########################
#1...#....2..#...#.H....#
#....#.......#...#......#
###=#####=######=###=####
#...................!...#
#@......T.........E.....#
###=#####=#####=#####=###
#...#.......#...#.......#
#3..#...O...#...#.......#
#########################`,
    {
      ...Object.fromEntries(
        rangeFlags('home', 3).map((f, i) => [
          String(i + 1),
          act('Wake house terminal ' + (i + 1), f, 'terminal', 'One porch light turns green.'),
        ]),
      ),
      T: note(
        'Neighborhood utilities map',
        'The key terminals are in the northwest, northeast and southwest houses. The outpost is at the southern end of this road.',
      ),
      H: hide('Hide in the garage cupboard'),
      O: exit('Enter the abandoned outpost', 'outpost', rangeFlags('home', 3)),
      E: exit('Use administrator card at field gate', 'field', ['admin-card']),
    },
    'neighborhoodwatch',
    Math.PI / 2,
  ),
  stage(
    'outpost',
    'Level 9 / M.E.G.',
    'Abandoned Outpost',
    'bunker',
    'The recorder repeats an unfinished instruction. The decontamination shower is the only operational unit.',
    'Prime the shower and use it on the infected agent to retrieve the field gate card.',
    `
###################
#....V.#..H.#....E#
#.##...#....#.##..#
#.##.#####..#..#..#
#......Q..!...C...#
#@..A.........#...#
###################`,
    {
      A: note(
        'Incident recorder',
        'Prime the decontamination valve. The infected agent still has the administrator card.',
      ),
      V: act('Prime decontamination valve', 'shower-fed', 'valve', 'Water starts knocking in the pipes.'),
      Q: act(
        'Flush the decontamination stall',
        'cured-agent',
        'panel',
        'The shower hisses. A badge clatters across the floor.',
        ['shower-fed'],
      ),
      C: item('Administrator card', 'admin-card', 'key', 'Issued to a name you cannot read.', [
        'cured-agent',
      ]),
      H: hide('Hide in the outpost locker'),
      E: exit('Return to the street', 'suburbs', ['admin-card']),
    },
    'wretch',
    Math.PI / 2,
  ),
  stage(
    'field',
    'Level 10',
    'Bountiful Harvest',
    'field',
    'Rows of wheat disappear into the dusk. The first windmill is silent. So is the engine somewhere in the wheat.',
    'Follow the fence breaks and wake the three wind turbines in sequence.',
    `
#########################
#@..#...###...#......A..#
#.#.#.#.....#.#.######..#
#.#...#####.#.......##..#
#.###.....#.#####.#....!#
#...#####.#...B...#.###.#
###....##...#######.#...#
#C..##..............#.E.#
#########################`,
    {
      A: act('Start the east turbine', 'wind-east', 'turbine', 'The blades swing toward the central tower. A chainsaw starts in the wheat.'),
      B: act('Start the central turbine', 'wind-center', 'turbine', 'A beacon appears at the south fence.', [
        'wind-east',
      ]),
      C: act('Start the south turbine', 'wind-south', 'turbine', 'Lights come on in the arcade car park.', [
        'wind-center',
      ]),
      E: exit('Enter the deserted arcade', 'arcade', ['wind-south']),
    },
    'farmer',
    Math.PI / 2,
  ),
  stage(
    'arcade',
    'Level 3999',
    'The Arcade',
    'arcade',
    'All the scoreboards read zero. The central cabinet has sockets for four save cartridges.',
    'Find the elevator ticket. The central machine starts when all four other endings are recorded.',
    `
#######################
#..a..a..#....a..a..E.#
#..a..a..#..........K.#
#..............##.....#
#..a..a.....F..##.a...#
#..a..a..##.......a...#
#........##....T......#
#..@.............B....#
#######################`,
    {
      a: prop('arcade'),
      T: note('Discarded lift ticket', 'Three floors are punched into the ticket: 9, 3, 1.'),
      K: code(
        'Enter the lift floors',
        '931',
        'arcade-lift',
        'The freight lift drops to the residential annex.',
      ),
      E: exit('Descend in the freight lift', 'residential', ['arcade-lift'], 'elevator'),
      B: exit('Return to the bunker', 'bunker', ['wrong'], 'elevator'),
      F: end(
        'final',
        'Play the central cabinet',
        ['wrong', 'suburbs', 'pink', 'city'],
        'A coin drops. Someone behind the counter calls closing time. Outside, the street is real.',
        'arcade',
      ),
    },
  ),
  stage(
    'residential',
    'Level 0.2',
    'The Red Rooms',
    'lobby',
    'Five breakers are visible through locked service doors. Red light leaks around the baseboards.',
    'Cross into the red side to release the locks, return, and seal the Bone Thief tunnel.',
    `
########################
#..1..#..2..#..3..#...E#
#.....#.....#.....#....#
#......................#
###.######..#####..##..#
#..4...#..5.#..B...##..#
#......#....#..........#
#@..R.........T........#
########################`,
    {
      R: exit('Step through the flickering wall', 'redrooms', [], 'vent'),
      ...Object.fromEntries(
        rangeFlags('res-relay', 5).map((f, i) => [
          String(i + 1),
          challenge(
            act('Reset residential feeder ' + (i + 1), f, 'panel', 'The feeder shows green.', ['red-locks']),
            { kind: 'align' },
          ),
        ]),
      ),
      T: note(
        'Traffic signal placard',
        'Red means something is nearby on the other side. Open the service locks from inside the red rooms.',
      ),
      B: act(
        'Lower the Bone Thief barrier',
        'tunnel-safe',
        'panel',
        'Steel plates seal the tunnel.',
        rangeFlags('res-relay', 5),
      ),
      E: exit('Cross to the freight lift', 'snack', ['tunnel-safe'], 'elevator'),
    },
  ),
  stage(
    'redrooms',
    'Level 0.2 / Negative',
    'Through the Wall',
    'chase',
    'A ring of finger marks surrounds a black hole in the plaster floor. A knuckle shifts inside it.',
    'Give the Bone Thief’s hole a wide berth. Release the locks and return through the broken wall.',
    `
#####################
#@....#...#........K#
#.##..#.#.#.##.###..#
#..#....#...#..#....#
##.########.#..#.##.#
#E.....H.......!..#.#
#####################`,
    {
      K: act(
        'Release the five service locks',
        'red-locks',
        'panel',
        'Five deadbolts slide back somewhere beyond the wall.',
      ),
      E: exit('Clip back through the plaster', 'residential', ['red-locks'], 'vent'),
      H: hide('Hide behind the service trolley', 'trolley'),
    },
    'bonethief',
    Math.PI / 2,
  ),
  stage(
    'snack',
    'Level 6.1',
    'The Snackrooms',
    'snack',
    'Coffee drips into an empty pot. The counter is clean except for a typewriter and a paper placemat.',
    'Read the marked keys on the placemat and type their sequence.',
    `
#################
#A...t...t....E.#
#.............K.#
#..t...t...t....#
#@..P....B......#
#################`,
    {
      t: prop('table'),
      A: item('Cold almond water', 'almond-snack', 'bottle', 'A cold bottle from the diner refrigerator.'),
      B: item('Wrapped energy bar', 'bar-snack', 'bar', 'A sealed bar from the till.'),
      P: note(
        'Paper placemat',
        'The number row is sketched in pencil. Keys 5, 1, 7 and 3 are blackened in sequence.',
      ),
      K: code('Use the typewriter', '5173', 'snack-open', 'The carriage bell rings.'),
      E: exit('Push the kitchen door', 'hotelchase', ['snack-open']),
    },
    undefined,
    Math.PI / 2,
  ),
];
