import { rangeFlags, type Stage } from './campaign-format.ts';
import { exchangeTranscript } from './concourse-plan.ts';
import type { Progress } from './game-state';

type Journal = Pick<Progress, 'flags' | 'endings'>;
type Step = readonly [required: string | readonly string[], instruction: string];
type Guide = { steps: Step[]; exit: string };

const guides: Record<string, Guide> = {
  garage: {
    steps: [
      [
        'garage-lift',
        'Read the four car colors in bay order. The legend by the elevator translates each color into a digit.',
      ],
    ],
    exit: 'The car lift is here. Ride it down to Deck B.',
  },
  garagekeys: {
    steps: [[rangeFlags('garagekey', 4), 'Recover the four thread-marked service keys.']],
    exit: 'Take all four keys to the service door on the parking deck.',
  },
  hub: {
    steps: [
      ['hub-terminal', 'Use the maintenance terminal to bring the garage controls online.'],
      ['hub-open', 'Release the garage shutter from its control panel.'],
    ],
    exit: 'Enter the unlit parking deck, or use a sector door you previously unlocked.',
  },
  pipes: {
    steps: [['torch', 'Find the maintenance flashlight in the tunnel.']],
    exit: 'Follow the station branch to the door under the last lamp.',
  },
  station: {
    steps: ['A', 'B', 'C'].map(
      (bank, i): Step => [
        [1, 2, 3].map((n) => 'breaker' + (i * 3 + n)),
        'Bring the three breakers in Bank ' + bank + ' online.',
      ],
    ),
    exit: 'All three banks are live. Open the station fire door.',
  },
  office: {
    steps: [
      [
        'office-token',
        'Count chairs, tables and plants in the break room. Use the counts at the vending keypad.',
      ],
      ['office-camera', 'Use the access token to disable the camera loop.'],
    ],
    exit: 'The camera loop is down. Leave by the hotel stair.',
  },
  hotel: {
    steps: [
      ['hotel-gallery', 'Read the portraits from youngest to oldest to open the gallery.'],
      [rangeFlags('jelly', 3), 'Gather three lots of moth jelly in the gallery.'],
      ['hotel-master', 'Load the jelly into the dumbwaiter and send it up.'],
    ],
    exit: 'The master key opens the guest lift.',
  },
  hotelrooms: {
    steps: [
      [rangeFlags('mail', 3), 'Recover the numbered guest slips.'],
      ['hotel-service', 'Put the slips in order and enter their digits at the service keypad.'],
    ],
    exit: 'Take the service passage along the cooler pipes.',
  },
  castle: {
    steps: [
      [['crest-circle', 'crest-star', 'crest-moon'], 'Move each crate onto its matching crest.'],
      ['coaster-power', 'Restart the coaster from its platform. Keep the King in your light.'],
    ],
    exit: 'The coaster is running. Board it at the platform.',
  },
  ocean: {
    steps: [
      ['skiff', 'Untie the skiff to reach the dive equipment.'],
      [['mask', 'air-tank'], 'Recover the mask and the air cylinder.'],
    ],
    exit: 'Take the dive equipment to the cage and lower it.',
  },
  projection: {
    steps: [
      ['tool-locker', 'Read the projected shapes and open the tool locker.'],
      ['saw', 'Take the survey chainsaw from the locker.'],
      [rangeFlags('shutter', 4), 'Cut through the boards and release the shutters.'],
    ],
    exit: 'All four releases are free. Roll up the garage shutter.',
  },
  cave: {
    steps: [['cave-bridge', 'Follow the fungus through the moth cavern to the old survey bridge.']],
    exit: 'Cross into the survey camp through the amethyst grotto.',
  },
  courtyard1: {
    steps: [
      [
        'bridge-code',
        'Read the lit window columns from the top floor down. Enter the sequence at the bridge keypad.',
      ],
    ],
    exit: 'Cross the bridge gate in the glass cloister.',
  },
  outpost: {
    steps: [
      ['shower-fed', 'Prime the decontamination valve.'],
      ['cured-agent', 'Flush the stall with the infected agent inside.'],
      ['admin-card', 'Recover the administrator card from decontamination.'],
    ],
    exit: 'Return to the street with the card for the field gate.',
  },
  field: {
    steps: [
      ['wind-east', 'Follow the fence break to the east turbine and start it.'],
      ['wind-center', 'The east turbine is turning. Start the central turbine.'],
      ['wind-south', 'Reach the south turbine through the threshing yard and start it.'],
    ],
    exit: 'All three turbines are turning. Enter the deserted arcade.',
  },
  residential: {
    steps: [
      ['red-locks', 'Step through the flickering wall to release the service locks on the red side.'],
      [rangeFlags('res-relay', 5), 'Reset the five residential feeders.'],
      ['tunnel-safe', 'Lower the barrier across the Bone Thief tunnel.'],
    ],
    exit: 'The tunnel is sealed. Cross to the freight lift.',
  },
  redrooms: {
    steps: [['red-locks', 'Find the release in the rehearsal room. Keep clear of the Bone Thief’s hole.']],
    exit: 'The five locks are open. Return through the flickering plaster.',
  },
  snack: {
    steps: [['snack-open', 'Read the marked keys on the placemat, then type their sequence.']],
    exit: 'The kitchen door is unlatched. Push it open.',
  },
  stair: {
    steps: [
      ['floor1', 'Find the first numbered landing.'],
      ['floor32', 'Climb to the landing marked 32.'],
      ['floor64', 'Find the plate marked 64.'],
      ['floor94', 'Read the false 94th-floor plate on the clock landing.'],
    ],
    exit: 'Step into the center of the shaft below Floor 94.',
  },
  hotelchase: {
    steps: [
      ['chase-release', 'Release the gate magnet.'],
      ['chase-cutter', 'Follow the blue safe rooms to the board cutter in the freight elevator hall.'],
    ],
    exit: 'Use the cutter on the boarded fire exit.',
  },
  courtyard2: {
    steps: [
      [rangeFlags('crt', 3), 'Deliver the three CRT carts to reception.'],
      ['court-monitors', 'Connect the parked monitors at reception.'],
    ],
    exit: 'Descend through the service hatch.',
  },
  deepool: {
    steps: [
      [['pool-inlet-n', 'pool-inlet-e', 'pool-inlet-s'], 'Open the three reservoir inlets.'],
      ['raft', 'Launch the safety raft.'],
    ],
    exit: 'Board the raft and paddle into the lock channel.',
  },
  stagnant: {
    steps: [
      [rangeFlags('pump', 4), 'Open the four pump valves.'],
      ['lock-drained', 'All valves are open. Drain the lock.'],
    ],
    exit: 'Enter the tiled flume.',
  },
  slides: {
    steps: [
      ['camera', 'Pick up the survey camera.'],
      [['photo1', 'photo2'], 'Photograph the graffiti and the yellow opening.'],
    ],
    exit: 'Both exposures are recorded. Ride the survey lift to floor II.',
  },
  slides2: {
    steps: [[['photo3', 'photo4'], 'Photograph the service van and get the Bacteria in frame.']],
    exit: 'Take the lift to the sculpture floor.',
  },
  slides3: {
    steps: [
      [
        ['photo5', 'photo6'],
        'Photograph the stone heads in the plaster cast gallery and frame the Skin-Stealer.',
      ],
    ],
    exit: 'The survey is complete. Open the white door.',
  },
  pink: {
    steps: [[rangeFlags('toy', 12), 'Recover the twelve missing toys for the stage.']],
    exit: 'Bring the toys to the theatre stage and arrange them.',
  },
  lowstation: {
    steps: [
      ['containment-code', 'Read the specimen labels and enter the containment code.'],
      [rangeFlags('flower', 3), 'Set the three specimen lamps to their prescribed colors.'],
    ],
    exit: 'The shutter is open. Enter the discovery center.',
  },
  plastic: {
    steps: [
      ['beacon1', 'Light the hospital beacon.'],
      ['beacon2', 'Follow the white balls to the discovery beacon and light it.'],
      ['beacon3', 'Light the deep beacon among the sunken diving bells.'],
    ],
    exit: 'Follow the white trail into the gym.',
  },
  grass: {
    steps: [
      [['garden-near', 'garden-far'], 'Swing both platforms into position.'],
      ['garden-knife', 'Take the gardener’s knife.'],
      ['garden-plank', 'Cut the suspended plank loose.'],
      ['garden-spool', 'Drop the wooden spool in the seed drying court.'],
      [rangeFlags('garden-lock', 4), 'Open the four garden locks.'],
    ],
    exit: 'Ride the elevator to floor 11.',
  },
  gym: {
    steps: [[rangeFlags('hoop', 4), 'Sink one basket in each net.']],
    exit: 'The greenhouse doors have unlatched. Push through them.',
  },
};

// When just one task is left, point at that task specifically, regardless of collection order.
const leads: Record<string, string> = {
  garagekey4: 'Find the white-thread key in the repair bay.',
  mail3: 'Look for guest slip III down in the laundry.',
  'crest-moon': 'Move the moon crate from the chapel to its matching seal.',
  'air-tank': 'Collect the air cylinder on the salvage jetty.',
  mask: 'Collect the diving mask.',
  shutter4: 'Cut the boards over the release in the double exposure studio.',
  'res-relay5': 'Reset the feeder in the switchyard.',
  crt3: 'Wheel the guest-feed cart from the broadcast exchange to reception.',
  'pool-inlet-s': 'Open the south inlet in the sluice hall.',
  pump4: 'Open the wheel in the settling tanks.',
  photo1: 'Photograph the graffiti in the contact sheet darkroom.',
  photo2: 'Photograph the yellow opening to Level 0.',
  photo3: 'Photograph the service van on the inspection floor.',
  photo4: 'Keep the Bacteria in the viewfinder and take its picture.',
  photo5: 'Photograph the stone heads in the plaster cast gallery.',
  photo6: 'Frame the Skin-Stealer and take its picture.',
  toy12: 'Recover the little drum from the dollhouse theatre.',
  hoop4: 'Sink a basket in the net facing the visitor grandstand.',
};

const archiveReels = rangeFlags('tape', 16);
const railHints = [
  ['rail2', 'Search the north side of the west offices.'],
  ['rail1', 'Follow the north corridor of the east offices.'],
  ['rail3', 'Check the offices beside the red phone.'],
  ['rail4', 'Search the west yellow rooms, past the freestanding wall.'],
];

export function campaignObjective(stage: Stage, journal: Journal): { current: string; notes?: string[] } {
  const has = (flag: string) => journal.flags.includes(flag) || journal.endings.includes(flag);
  if (stage.id === 'lobby') {
    const missing = railHints.filter(([flag]) => !has(flag));
    const ladder = has('lobby-key')
      ? 'Use the cubby key on the service door in the northwest corner of the hall.'
      : has('ladder-built')
        ? 'Take the service key from the ceiling cubby beside the repaired ladder.'
        : !missing.length
          ? 'Bring the four parts to the broken ladder in the northwest corner of the yellow rooms.'
          : `Ladder parts ${4 - missing.length}/4. ${missing[0][1]}`;
    const hatch = has('returns-bled')
      ? 'The pressure is off. Open the hatch on the north wall beside the basement pump.'
      : has('returns-power')
        ? 'Take the ramp south from the central rooms. Hold the red valve open at its foot to bleed the hatch line.'
        : has('exchange-call')
          ? `Enter the three pulse counts at the relay between the angled walls in the central rooms. The receiver tapped ${exchangeTranscript}.`
          : 'Answer the red phone at the far end of the east offices. Listen for three groups of pulses.';
    const current = has('returns-bled')
      ? hatch
      : has('lobby-key') || has('ladder-built') || !missing.length
        ? ladder
        : has('exchange-call')
          ? hatch
          : missing.length < 4
            ? ladder
            : stage.objective!;
    return { current, notes: [ladder, hatch] };
  }
  if (stage.id === 'library') {
    if (has('archive-done'))
      return { current: 'The projection is running. Step through the image behind the stacks.' };
    const count = archiveReels.filter(has).length;
    const reels =
      count === 16
        ? 'Mount the sixteen reels at the returns terminal.'
        : `Archive reels ${count}/16. ${has('tape16') ? 'Search the aisles above Returns.' : 'One reel is filed in the magnetic tape vault.'}`;
    const cart = has('archive-cart')
      ? 'The backup projector is connected. Lock the tracking needle at the splice deck.'
      : 'Wheel the backup projector from the magnetic tape vault to the splice deck at Returns.';
    return { current: has('archive-cart') ? cart : count ? reels : stage.objective!, notes: [reels, cart] };
  }
  if (stage.id === 'suburbs') {
    if (has('admin-card')) return { current: 'Use the administrator card at the field gate.' };
    const count = rangeFlags('home', 3).filter(has).length;
    return {
      current:
        count === 3
          ? 'The three terminals are awake. Enter the abandoned outpost for the field gate card.'
          : `Wake the terminals in the three houses. ${count}/3 online.`,
    };
  }
  if (stage.id === 'dark' && has('lidar')) {
    return {
      current:
        has('wrong') && !has('pink')
          ? 'Use the pink service hatch to reach the Pink House, or follow the main hall to the flooded door.'
          : 'Pulse the LiDAR and follow the main hall to the flooded door beyond the dead antenna array.',
    };
  }
  if (stage.id === 'overgrowth' && has('slide-power')) {
    for (const [tag, name, chute] of [
      ['a', 'Alpha', 'orange'],
      ['b', 'Bravo', 'green'],
    ]) {
      if (has('patient-' + tag) && !has('evac-' + tag))
        return { current: `Release the ${chute} chute to evacuate ${name}.` };
    }
    if (has('evac-a') && has('evac-b'))
      return { current: 'Both wanderers are out. Enter the evacuation slide.' };
    return {
      current: has('evac-a')
        ? 'Bring Bravo from the root house to the green chute.'
        : has('evac-b')
          ? 'Bring Alpha to the orange chute.'
          : 'Bring Alpha to the orange chute or Bravo to the green one.',
    };
  }
  if (stage.id === 'funplus') {
    if (has('fun-arm'))
      return { current: 'The mechanical arm has released the stage curtain. Pull it aside.' };
    const wings = ['pink', 'blue', 'red', 'cloud'].filter((wing) => !has('fun-' + wing));
    if (!wings.length) return { current: 'Fit the four wing keys into the mechanical arm and align it.' };
    if (wings.length === 1 && wings[0] === 'blue' && !has('firework'))
      return { current: 'Find the party popper in the paper crown theatre, then visit the blue hall.' };
    return {
      current: `Recover the keys from the ${wings.join(', ')} ${wings.length === 1 ? 'wing' : 'wings'}. (${4 - wings.length}/4)`,
    };
  }
  if (stage.id === 'bunker' || stage.id === 'arcade') {
    const endings = ['wrong', 'suburbs', 'pink', 'city'];
    const remaining = endings.filter((flag) => !has(flag));
    if (!remaining.length)
      return {
        current:
          stage.id === 'bunker'
            ? 'Take the lift to Level 3999 and play the central arcade cabinet.'
            : 'All four endings are recorded. Play the central cabinet.',
      };
    if (stage.id === 'bunker') {
      const destinations: Record<string, string> = {
        wrong: 'the white door',
        suburbs: 'the dim garage stairwell',
        pink: 'the pink hatch in Lights Out',
        city: 'the lower M.E.G. station',
      };
      return {
        current: `Endings ${4 - remaining.length}/4. Follow the route through ${destinations[remaining[0]]}.`,
      };
    }
    if (has('wrong'))
      return {
        current: 'The central cabinet still needs more endings. Return to the bunker for another route.',
      };
    if (has('arcade-lift')) return { current: 'Descend in the freight lift to the residential floor.' };
  }
  const guide = guides[stage.id];
  if (!guide) return { current: stage.objective || stage.description };
  // A later milestone can consume the items from an earlier one.
  let current = guide.exit;
  for (let i = guide.steps.length - 1; i >= 0; i--) {
    const [required, instruction] = guide.steps[i];
    const flags = typeof required === 'string' ? [required] : required;
    const missing = flags.filter((flag) => !has(flag));
    if (!missing.length) break;
    const hint = missing.length === 1 ? (leads[missing[0]] ?? instruction) : instruction;
    current = flags.length > 1 ? `${hint} (${flags.length - missing.length}/${flags.length})` : hint;
  }
  return { current };
}
