import {
  stage,
  item,
  act,
  code,
  exit,
  note,
  hide,
  prop,
  rangeFlags,
  end,
  challenge,
} from './campaign-format.ts';

const toys = [
  'Wind-up mouse',
  'Tin soldier',
  'Stuffed rabbit',
  'Moon rattle',
  'Velvet bear',
  'Paper crown',
  'Wooden train',
  'Knitted cat',
  'Porcelain bird',
  'Clockwork dove',
  'Toy telephone',
  'Little pink drum',
];

export const endingStages = [
  stage(
    'bunker',
    'M.E.G. / Operations',
    'The Bunker',
    'bunker',
    'A folded suit waits on your cot. There are four empty frames on the operations board.',
    'Use the bunker routes to recover the other endings. Return to the arcade with all four.',
    `
#########################
#..S....#..P....#..O....#
#.......#.......#.......#
###..#######.#######.####
#.......................#
#...Q..##....##...A.....#
#......##....##.........#
#@.b.........N........G.#
#########################`,
    {
      b: prop('bed'),
      N: note(
        'Operations board',
        'Four dossiers: the white door; the stairwell above the garage; the pink house beyond Lights Out; the city beyond the greenhouse. File all four, then revisit the central cabinet.',
      ),
      S: exit('Transit / dim garage ramp', 'blackgarage', ['wrong']),
      P: exit('Transit / Lights Out workshop', 'dark', ['wrong']),
      O: exit('Descend to lower M.E.G. station', 'lowstation', ['wrong'], 'elevator'),
      A: exit('Lift to Level 3999 arcade', 'arcade', ['wrong'], 'elevator'),
      G: exit('Enter the main Hub', 'hub', ['wrong']),
      Q: item('Bunker almond water', 'almond-bunker', 'bottle', 'A supply bottle from the emergency locker.'),
    },
    undefined,
    Math.PI / 2,
  ),
  stage(
    'stair',
    'Level 9223372036854775807',
    'The Endless Stairwell',
    'stair',
    'The stairs seem familiar on every landing. On the painted plates the numbers advance in impossible jumps.',
    'Follow the numbered landings to Floor 94 and step into the center of the shaft.',
    `
#######################
#@..A...............#.#
##################..#.#
#B..................#.#
#..##################.#
#..................C..#
####################..#
#E........D...........#
#######################`,
    {
      A: act('Pass landing 01', 'floor1', 'light', 'The next visible landing is marked 32.'),
      B: act('Pass landing 32', 'floor32', 'light', 'Four flights later, the number reads 64.', ['floor1']),
      C: act('Pass landing 64', 'floor64', 'light', 'The next rail bears wet paint.', ['floor32']),
      D: act(
        'Read the false 94th-floor marker',
        'floor94',
        'light',
        'The plate reads 94. The void beneath the rail is white.',
        ['floor64'],
      ),
      E: end(
        'suburbs',
        'Step into the stairwell shaft',
        ['floor94'],
        'You fall past every landing without striking one. An ordinary street is waiting below, with every porch light on.',
        'pit',
      ),
    },
    undefined,
    Math.PI / 2,
  ),
  stage(
    'pink',
    'Level 974',
    'Kitty’s House',
    'pink',
    'Twelve circles have been drawn on a tiny theatre stage. Your host stands just outside the lamplight.',
    'Collect twelve lost toys and return them to the little theatre. Keep Kitty in sight.',
    `
#########################
#a...#.b..#....c..#..d.E#
#.##...##.#.####..#.....#
#e..#......f........#...#
#...#.##.####.#.###.#..g#
###...#...!....h..#...###
#i....#.####.#.#..##...j#
#..##.#...k..#....l.#...#
#.....@....H....t...#...#
#########################`,
    {
      ...Object.fromEntries(
        toys.map((name, i) => [
          String.fromCharCode(97 + i),
          item(name, 'toy' + (i + 1), 'toy', 'A faint chime comes from the little theatre.'),
        ]),
      ),
      H: hide('Hide beneath the tea table', 'table'),
      t: prop('table', 0xdf90ab),
      E: {
        ...end(
          'pink',
          'Arrange the toys on the theatre stage',
          rangeFlags('toy', 12),
          'The curtains rise on a model of the house. A new little figure sits inside. It has your face.',
          'desk',
        ),
        consumes: rangeFlags('toy', 12),
      },
    },
    'kitty',
  ),
  stage(
    'lowstation',
    'M.E.G. / Lower station',
    'The Containment Wing',
    'bunker',
    'Plastic balls float in four glass cells. A faded diagram describes a color-mixing experiment.',
    'Decode the containment labels, then calibrate the flower lights to open the hospital.',
    `
#######################
#..C......#..P...#...E#
#..##...#.#.##...#.##.#
#..##...#...##.....#..#
#....F..###..#..G..#..#
###..##.......####.#..#
#@...K...H..!..Y......#
#######################`,
    {
      C: note(
        'Containment cells',
        'Cells 1, 2, 3 contain red, yellow and blue. The door expects the cell numbers needed to make green, then red.',
        'bottle',
      ),
      K: code('Open the containment shutter', '231', 'containment-code', 'The shutter slides away.'),
      F: note(
        'Observation chart',
        'A blue rose, gold daisy and violet tulip are drawn beside the three light controls.',
      ),
      P: act('Set rose lamp to blue', 'flower1', 'light', 'The rose fluoresces blue.', ['containment-code']),
      G: act('Set daisy lamp to gold', 'flower2', 'light', 'The daisy glows gold.', ['containment-code']),
      Y: act('Set tulip lamp to violet', 'flower3', 'light', 'The tulip glows violet.', ['containment-code']),
      H: hide('Hide beneath the hospital gurney', 'bed'),
      E: exit('Enter Bruce’s Discovery Center', 'plastic', rangeFlags('flower', 3)),
    },
    'crawler',
    Math.PI / 2,
  ),
  stage(
    'plastic',
    'Level 421',
    'Plastic Mariana',
    'plastic',
    'Millions of faded play balls roll against an invisible tide. Lone lighthouse beams sweep the dark.',
    'Ignite the three beacons in sequence. Follow the white balls to the gym.',
    `
##########################
#@...#......1...#........#
#.##.#.###......#..###...#
#....#...#..##..#....#...#
###....#....##....2..#...#
#...#####.....####.###...#
#...3....#..........#....#
#.#####..#..##...!..#..E.#
#...........##...........#
##########################`,
    {
      '1': act(
        'Light the hospital beacon',
        'beacon1',
        'lighthouse',
        'A ribbon of white balls points toward the next tower.',
      ),
      '2': act('Light the discovery beacon', 'beacon2', 'lighthouse', 'The light reveals a third lens.', [
        'beacon1',
      ]),
      '3': act(
        'Light the deep beacon',
        'beacon3',
        'lighthouse',
        'A pale trail cuts across the black current.',
        ['beacon2'],
      ),
      E: exit('Follow the white trail into the gym', 'gym', ['beacon3'], 'vent'),
    },
    'shark',
    Math.PI / 2,
  ),
  stage(
    'gym',
    'Level 421 / Discovery Center',
    'The Four Hoops',
    'plastic',
    'The gym clock has no hands. Balls collect under the four nets in colors that match the floor.',
    'Score a plastic ball through each of the four nets to unlatch the exit.',
    `
####################
#..1............2..#
#.....o....o.......#
#..................#
#E....o....o.......#
#..3.....@......4..#
####################`,
    {
      o: prop('toy'),
      ...Object.fromEntries(
        rangeFlags('hoop', 4).map((f, i) => [
          String(i + 1),
          challenge(act('Shoot into basket ' + (i + 1), f, 'hoop', 'The ball rolls down a hidden chute.'), {
            kind: 'throw',
          }),
        ]),
      ),
      E: exit('Push the greenhouse doors', 'overgrowth', rangeFlags('hoop', 4)),
    },
  ),
  stage(
    'overgrowth',
    'Research / Overgrowth',
    'Overgrowth',
    'overgrowth',
    'Vines knot around the slide entrances. Black wire snags on the slide controls. Something pale reaches from a hole near the orange chute.',
    'Restore the slide controls and send each stranded wanderer through an evacuation chute.',
    `
########################
#..V.#.....A...#.....E.#
#....#..p......#...X..*#
#..###.###.###...##....#
#..p.....#...p.....!..##
###..###.#.#####.###...#
#@...P...#.....B...Y...#
########################`,
    {
      '*': { monster: 'bonethief' },
      p: prop('plant'),
      P: note(
        'Evacuation tags',
        'The orange chute is tagged ALPHA. The green chute is tagged BRAVO. Each chute needs an evacuation load.',
      ),
      V: act('Restore slide controls', 'slide-power', 'panel', 'The emergency chutes start humming.'),
      A: challenge(
        item('Assist wanderer Alpha', 'patient-a', 'bed', 'You help the first wanderer to their feet.', [
          'slide-power',
        ]),
        { kind: 'haul', destination: 'evac-a', delivery: 'the orange chute' },
      ),
      B: challenge(
        item('Assist wanderer Bravo', 'patient-b', 'bed', 'You guide the second wanderer out of the vines.', [
          'slide-power',
        ]),
        { kind: 'haul', destination: 'evac-b', delivery: 'the green chute' },
      ),
      X: act('Send Alpha down the orange chute', 'evac-a', 'slide', 'The orange indicator turns white.', [
        'patient-a',
      ]),
      Y: act('Send Bravo down the green chute', 'evac-b', 'slide', 'The green indicator turns white.', [
        'patient-b',
      ]),
      E: exit('Enter the evacuation slide', 'grass', ['evac-a', 'evac-b'], 'slide'),
    },
    'bacteria',
    Math.PI / 2,
  ),
  stage(
    'grass',
    'Threshold / Grassrooms',
    'The Grassrooms',
    'grass',
    'Yellow sunlight fills an enclosed lawn. A pair of wooden platforms hangs from frayed ropes.',
    'Position both platforms, cut loose the plank and spool, then release the four garden locks.',
    `
##########################
#..P...#..K.....#.....1..#
#.###..#..####..#.###....#
#...#..#....R...#...#....#
#.@.#....p..##....#....2.#
#...###..##.####..#####..#
#....Q...#..S....#.......#
#.##...#.#.#####.#.###...#
#..4....p......E......3..#
##########################`,
    {
      p: prop('plant'),
      P: act(
        'Swing the near platform',
        'garden-near',
        'panel',
        'The near platform swings toward the catwalk.',
      ),
      Q: act('Swing the far platform', 'garden-far', 'panel', 'The far platform aligns with the tool shed.'),
      K: item('Gardener’s knife', 'garden-knife', 'tool', 'A small blade for the rigging ropes.', [
        'garden-near',
        'garden-far',
      ]),
      R: act('Cut the suspended plank loose', 'garden-plank', 'crate', 'The plank settles across the gap.', [
        'garden-knife',
      ]),
      S: act('Drop the wooden spool', 'garden-spool', 'spool', 'The spool drops through the glass below.', [
        'garden-plank',
      ]),
      ...Object.fromEntries(
        rangeFlags('garden-lock', 4).map((f, i) => [
          String(i + 1),
          act('Release garden lock ' + (i + 1), f, 'panel', 'The elevator chime sounds.', ['garden-spool']),
        ]),
      ),
      E: end(
        'city',
        'Ride the elevator to floor 11',
        rangeFlags('garden-lock', 4),
        'The elevator opens onto an entire city. Every traffic light is green, and there is nobody left to cross.',
        'elevator',
      ),
    },
  ),
];
