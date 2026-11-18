import { stage, item, act, code, exit, note, hide, prop, noteKeys, rangeFlags } from './campaign-format.ts';

export const opening = [
  stage(
    'lobby',
    'Level 0',
    'The Lobby',
    'lobby',
    'The humming started before you opened your eyes. The carpet is still damp.',
    'Find the four pieces of a maintenance ladder. The missing door key is in the ceiling cubby.',
    `
##########################
#......#.....1.........#.#
#..##..#..######.##.!..#.#
#..##.....#.....3#...#...#
#......#..#..#...#...#.E.#
####...#.....#...###.#...#
#..2...#..K..#....T..#...#
#....###.....#####.......#
#......#..L..#....###.##.#
#..##..#.....#....#...##.#
#..##....###......#......#
#.....#H.###.#....#...#.##
#..4..#......##.......#..#
###.###.##....#..##...#..#
#...#...#...W.#..##......#
#.......#..@.....#...N...#
##########################`,
    {
      ...noteKeys(
        ['Left ladder rail', 'Lower rung assembly', 'Upper rung assembly', 'Right ladder rail'],
        'rail',
        'ladder',
      ),
      L: {
        ...act(
          'Reassemble maintenance ladder',
          'ladder-built',
          'ladder',
          'The rails click together. The key cubby is within reach.',
          rangeFlags('rail', 4),
        ),
        consumes: rangeFlags('rail', 4),
      },
      K: item('Ceiling cubby key', 'lobby-key', 'key', 'The worn brass key is marked SERVICE ACCESS.', [
        'ladder-built',
      ]),
      E: exit('Unlock the service door', 'pitwalk', ['lobby-key']),
      H: hide('Climb inside the grey service locker'),
      T: hide('Hide beneath the abandoned drafting desk', 'desk'),
      W: note(
        'Pencil marks on a torn sleeve',
        'It follows the noise of running feet. Turn two corners, go low, get inside something. I heard it scratching outside this locker for ten minutes.',
      ),
      N: note(
        'Maintenance slip',
        'Left the service key above the broken ladder. Four pieces, all in this wing.',
      ),
    },
    'bacteria',
  ),
  stage(
    'pitwalk',
    'Level 0 / Service void',
    'The Broken Floor',
    'lobby',
    'The paint stripe runs the whole length of the beam. Everything beneath it is dark.',
    'Cross the intact strips to the far vent. A lower service route is available if you fall.',
    `
##################
#......V.........#
#..###...###.....#
#..XXX...XXX..XX.#
#..XXX...XXX..XX.#
#XXXXXXX|XXXXXXXX#
#XXXXXXX|XXXXXXXX#
#XXXXXXX|XXXXXXXX#
#..XX..........X.#
#..XXXXXXXX....X.#
#.......@........#
##################`,
    {
      X: exit('Drop into the service void', 'lower', [], 'pit'),
      V: exit('Enter the ventilation shaft', 'garage', [], 'vent'),
    },
  ),
  stage(
    'lower',
    'Level 0 / Subfloor',
    'The Service Void',
    'dark',
    'An arrow has been scratched into the concrete at ankle height.',
    'Follow the marks to the maintenance vent.',
    `
#################
#@....#...A.....#
####..#.#.#####.#
#.....#.#...#...#
#..####.###.#.#.#
#......A....#.#.#
######.######.#.#
#....A....#...#V#
#..H......#.....#
#################`,
    {
      A: prop('light', 0xe6b051),
      H: hide('Hide in the service cabinet'),
      V: exit('Crawl into the garage vent', 'garage', [], 'vent'),
    },
  ),
  stage(
    'garage',
    'Level 1 / Deck A',
    'Habitable Zone',
    'garage',
    'Every parking bay is empty except four. The elevator wants four digits.',
    'Read the numbered parking bays and use the legend beside the elevator.',
    `
#####################
#..R..#..B..#...E.K.#
#.....#.....#.......#
#...................#
#.##..##..##..##....#
#.##..##..##..##..N.#
#...................#
#.....#.....#.......#
#..G..#..Y..#.......#
#................@..#
#####################`,
    {
      R: { ...note('Bay 01 • red sedan', 'The first bay holds a red sedan.', 'car'), color: 0xb43a31 },
      B: { ...note('Bay 02 • blue sedan', 'The second bay holds a blue sedan.', 'car'), color: 0x416fa6 },
      G: { ...note('Bay 03 • green sedan', 'The third bay holds a green sedan.', 'car'), color: 0x657f4a },
      Y: { ...note('Bay 04 • yellow sedan', 'The fourth bay holds a yellow sedan.', 'car'), color: 0xd4ae38 },
      N: note(
        'Lift service legend',
        'Bay transponder digits: yellow 8, red 2, green 6, blue 4. Enter the digits in bay order, 01 through 04.',
      ),
      K: code('Call the car lift', '2468', 'garage-lift', 'The lift shudders awake.'),
      E: exit('Ride to the lower deck', 'garagekeys', ['garage-lift'], 'elevator'),
    },
  ),
  stage(
    'garagekeys',
    'Level 1 / Deck B',
    'The Four Locks',
    'garage',
    'Footprints lead out of an empty hazard suit. A moment later they lead back into it.',
    'Collect the four service keys and unlock the security passage.',
    `
#####################
#1...#....2....#...3#
#....#.........#....#
#........##.........#
#.######.##.######..#
#..H............!..E#
#......########.....#
#.####.#......#..#..#
#4...#......A....#..#
#....#.@.........#..#
#####################`,
    {
      ...noteKeys(
        [
          'Red-thread service key',
          'Green-thread service key',
          'Blue-thread service key',
          'White-thread service key',
        ],
        'garagekey',
        'key',
      ),
      A: item('Almond water', 'almond-garage', 'bottle', 'An unopened bottle from the supply cabinet.'),
      H: hide('Close the locker door'),
      E: exit('Turn the four service keys', 'darkdeck', rangeFlags('garagekey', 4)),
    },
    'skinstealer',
  ),
  stage(
    'darkdeck',
    'Level 1 / Service parking',
    'The Dark Garage',
    'garage',
    'A lift chime rings on the lower parking deck. A second pair of boots answers your own.',
    'Find the utility lift at the far end of the lower garage. Hide if the Skin-Stealer sees you.',
    `
#######################
#@..v.....##..#...H...#
##..###...##..#.###...#
#...###...##..#....v..#
#....v..#.##..###..##.#
#..##...#....!..#...E.#
#..##..H#..##...###...#
#.......#.......v.....#
#######################`,
    {
      v: prop('car', 0x515959),
      H: hide('Close the service locker'),
      E: exit('Take the utility lift to the Hub', 'hub', [], 'elevator'),
    },
    'skinstealer',
    Math.PI / 2,
  ),
  stage(
    'hub',
    'Transit / M.E.G.',
    'The Hub',
    'hub',
    'Numbered doors recede into the tunnel. Somebody kept the terminals powered.',
    'Bring the terminal online. Previously opened sector doors work as shortcuts.',
    `
#############################
#..A....#..B....#..C....#..D#
#.......#.......#.......#...#
#...........................#
#.........................G.#
#..##....##....##....##.....#
#...........................#
#..N...#.....@.....#..K..T..#
#############################`,
    {
      N: note(
        'Maintenance log',
        'Terminal clock stopped at 08:24. Engineering reset the access PIN to match the four clock digits.',
      ),
      K: code('Unlock maintenance terminal', '0824', 'hub-terminal', 'Operator profile restored.'),
      T: act(
        'Release the garage shutter',
        'hub-open',
        'terminal',
        'The roller mechanism winds up in the dark.',
        ['hub-terminal'],
      ),
      G: exit('Enter the unlit parking deck', 'blackgarage', ['hub-open']),
      A: exit('Office access door', 'office', ['shortcut-office']),
      B: exit('Level 7 waterfront', 'ocean', ['shortcut-ocean']),
      C: exit('Courtyard access door', 'courtyard2', ['shortcut-court']),
      D: exit('Bunker lift', 'bunker', ['wrong'], 'elevator'),
    },
  ),
  stage(
    'blackgarage',
    'Level 1 / Deck C',
    'Lights Between Doors',
    'garage',
    'The lamps buzz for a moment before coming on. The dark between them has teeth.',
    'Move between the lit alcoves. The upper ramp leads to a second exit.',
    `
#########################
#@..L..#.....L..#.....S.#
###....#........#..##...#
#....#...####.....##....#
#....#......L..#........#
#L...#...!..#..#...L...E#
#########################`,
    {
      L: hide('Shelter in the light', 'light'),
      E: exit('Open the maintenance tunnel', 'pipes'),
      S: exit('Open the M.E.G. stairwell', 'stair', ['wrong']),
    },
    'smiler',
  ),
  stage(
    'pipes',
    'Level 2',
    'Pipe Dreams',
    'pipes',
    'The metal knocks once behind you. Then every pipe answers at once.',
    'Take the station branch. Watch for a side door under the last lamp.',
    `
###############################
#@....F..................##...#
####################.##..##...#
#E...................##.......#
###########################..##
#R.....................!.....##
###############################`,
    {
      F: item(
        'Maintenance flashlight',
        'torch',
        'flashlight',
        'A charged torch. Hounds recoil from its beam.',
      ),
      E: exit('Station access door', 'station', ['torch']),
      R: note('FUN route shutter', 'The slats are buckled inward. Something on the other side is smiling.'),
    },
    'smiler',
    Math.PI / 2,
  ),
  stage(
    'station',
    'Level 3',
    'Electrical Station',
    'station',
    'Three red indicators above the feeder racks. Three breakers per bank.',
    'Energize all three banks in order. Flash a Hound in the face to break its charge.',
    `
###########################
#1...#...2...#...3..#..E..#
#.##.#.##.##.#.#.##.#..##.#
#............#.#....#.....#
#####.###.####.####...##..#
#4......#.5..#.....6......#
#.##.##...##...###.######.#
#....#...###.#..H.....!...#
###..#.###...#..###.####..#
#7...#...8......#......9..#
#....@.....####...##......#
###########################`,
    {
      ...Object.fromEntries(
        rangeFlags('breaker', 9).map((f, i) => [
          String(i + 1),
          act(
            'Bank ' + 'ABC'[Math.floor(i / 3)] + ' / breaker ' + ((i % 3) + 1),
            f,
            'panel',
            'The breaker latches green.',
            i < 3 ? [] : i < 6 ? rangeFlags('breaker', 3) : rangeFlags('breaker', 6).slice(3),
          ),
        ]),
      ),
      H: hide('Hide behind the relay rack', 'shelf'),
      E: exit('Open the station fire door', 'office', rangeFlags('breaker', 9)),
    },
    'hound',
  ),
  stage(
    'office',
    'Level 4',
    'Abandoned Office',
    'office',
    'The coffee in the mugs is still warm. All the clocks read lunch.',
    'Count objects in the break room for the vending keypad, then pass the camera wing.',
    `
######################
#..c.c...#..t...t....#
#..c.c...#.....v...K.#
#..c.............v...#
######..######.####..#
#H....@......#...C...#
#...##..##...#...##..#
#...##..##.......##..#
#..B..........!...E..#
######################`,
    {
      c: prop('chair'),
      t: prop('table'),
      v: prop('plant'),
      K: code(
        'Vend access token • chairs / tables / plants',
        '522',
        'office-token',
        'A visitor pass drops into the tray.',
      ),
      C: act(
        'Disable camera loop',
        'office-camera',
        'terminal',
        'The security monitor freezes on an empty corridor.',
        ['office-token'],
      ),
      H: act('Unbolt the Hub shortcut', 'shortcut-office', 'panel', 'The Hub door unlocks from this side.'),
      B: exit('Enter the Hub', 'hub', ['shortcut-office']),
      E: exit('Leave by the hotel stair', 'hotel', ['office-camera']),
    },
    'camera',
  ),
  stage(
    'hotel',
    'Level 5 / Lobby',
    'Terror Hotel',
    'hotel',
    'The receptionist never looks up. Dust falls from its sleeve in little yellow wings.',
    'Read the portraits in age order, then trade three lots of moth jelly at the dumbwaiter.',
    `
#######################
#..A....B....C....K...#
#.......###...........#
#..1....#.#.....2..#..#
####..###.###..###.#..#
#.....#.....#..#...#..#
#.@...#..D..#....3.#.E#
#.......H.............#
#######################`,
    {
      A: note(
        'Portrait • Grandmother',
        'A woman in her seventies. Her brass portrait plate bears a 7.',
        'portrait',
      ),
      B: note('Portrait • Child', 'A child holds a model train. The frame is numbered 3.', 'portrait'),
      C: note('Portrait • Father', 'A middle-aged man in a porter’s uniform. Frame number 9.', 'portrait'),
      K: code('Portrait latch • youngest first', '397', 'hotel-gallery', 'The moth nursery opens.'),
      ...Object.fromEntries(
        rangeFlags('jelly', 3).map((f, i) => [
          String(i + 1),
          item('Collect moth jelly ' + (i + 1), f, 'bottle', 'A lump of amber jelly sticks to the jar.', [
            'hotel-gallery',
          ]),
        ]),
      ),
      D: {
        ...act(
          'Send jelly up the dumbwaiter',
          'hotel-master',
          'panel',
          'Three brass keys return on an empty plate.',
          rangeFlags('jelly', 3),
        ),
        consumes: rangeFlags('jelly', 3),
      },
      H: hide('Hide under the banquet table', 'table'),
      E: exit('Take the guest lift', 'hotelrooms', ['hotel-master'], 'elevator'),
    },
  ),
  stage(
    'hotelrooms',
    'Level 5 / Guest wing',
    'The Boiler Rooms',
    'hotel',
    'A name is missing from every mailbox. The hallway is hot enough to blister the wallpaper.',
    'Find the three numbered guest slips, open the service keypad, and slip past the Deathmoth.',
    `
######################
#1...#2...#...3.#...E#
#....#....#.....#.##.#
#...................!#
####.####.###.###.##.#
#@....K....H....#....#
######################`,
    {
      '1': item('Guest slip • I / 17', 'mail1', 'note', 'The first slip reads 17.'),
      '2': item('Guest slip • II / 56', 'mail2', 'note', 'The second slip reads 56.'),
      '3': item('Guest slip • III / 4', 'mail3', 'note', 'The third slip reads 4.'),
      K: code(
        'Enter the guest-wing code',
        '17564',
        'hotel-service',
        'The service crawlspace is open.',
        rangeFlags('mail', 3),
      ),
      H: hide('Crouch beneath the laundry table', 'table'),
      E: exit('Follow the cooler pipes', 'pipesreturn', ['hotel-service'], 'vent'),
    },
    'moth',
    Math.PI / 2,
  ),
  stage(
    'pipesreturn',
    'Level 2 / Return',
    'The Other Branch',
    'pipes',
    'The STATION arrow points back the way you came. Someone has painted FUN on the other wall.',
    'Follow the FUN branch and sprint for the side door.',
    `
##########################
#@......................##
####################.##.##
#E...................##..#
############.##########..#
#...............!........#
##########################`,
    { E: exit('Push through the party door', 'fun') },
    'smiler',
    Math.PI / 2,
  ),
  stage(
    'fun',
    'Level Fun',
    'Party Rooms',
    'party',
    'The song skips every time you move. The figures at the tables never blink.',
    'Cross the party rooms. Tables provide cover when the Partygoer turns.',
    `
#######################
#..T..t.#...t...#....E#
#....t..#...T...#..t..#
#..###..###..##.#.##..#
#..#.....t....#.......#
#..#..T.......###.....#
#....###..t...#T...!..#
#@.....t....#.....t...#
#######################`,
    {
      T: hide('Hide under the party table', 'table'),
      t: prop('table', 0xe6bb92),
      E: exit('Slip through the tiled doorway', 'pool'),
    },
    'partygoer',
  ),
  stage(
    'pool',
    'Level 37',
    'Poolrooms',
    'pool',
    'A room full of daylight, with no sky beyond the windows. The water barely moves.',
    'Follow the white tiles and the sunken columns toward the red exit lamp.',
    `
#######################
#........#......L...E.#
#..##....#..##.....#..#
#..##.......##..##.#..#
#.....####......##....#
#..#...L....#.......#.#
#..#..##....#.###...#.#
#.....##....#......L..#
#..@......#...........#
#######################`,
    { L: prop('light', 0xbceef3), E: exit('Open the red-lit fire door', 'run') },
  ),
  stage(
    'run',
    'Level !',
    'Run For Your Life',
    'chase',
    'The alarm starts as you clear the doorway. The beds in the corridor are on their sides.',
    'Sprint down the red corridor. Use the gaps beside the overturned beds.',
    `
#####################################
#!..@.........##........#..........E#
#......##.....##...##...#...##...#..#
#......##..........##.......##...#..#
#####################################`,
    { E: exit('Push the emergency bar', 'library') },
    'clump',
    Math.PI / 2,
  ),
];
