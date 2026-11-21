// Camera angles circle the actor's front. Heights are in units of its own silhouette.
export const catchShots = {
  bacteria:          ['Bacteria', 'Bacteria', 12, -7, .15, -9, 'stalk', 92, 13],
  hound:             ['Bestiary', 'Hound', 48, 24, -.10, 16, 'pounce', 144, 12],
  smiler:            ['Bestiary', 'Smiler', -7, 4, .02, -7, 'blackout', 417, 17],
  moth:              ['Bestiary', 'Deathmoth', -30, 12, -.24, -17, 'dive', 286, 11],
  skinstealer:       ['Bestiary', 'SkinStealer', 27, -12, .09, 12, 'stalk', 182, 15],
  wretch:            ['Bestiary', 'Wretch', -26, -4, -.13, -14, 'pounce', 217, 12],
  kitty:             ['Bestiary', 'Kitty', 9, -17, -.32, 10, 'blackout', 637, 19],
  watcher:           ['Bestiary', 'Watcher', -35, 3, .10, -5, 'blackout', 355, 18],
  partygoer:         ['Bestiary', 'Partygoer', 32, 14, -.12, 18, 'stalk', 489, 15],
  animation:         ['Bestiary', 'Animation', -29, 2, .15, -21, 'dive', 307, 10],
  king:              ['Bestiary', 'AnimatedKing', 27, -5, -.24, 9, 'dive', 111, 16],
  clump:             ['Bestiary', 'Clump', 38, -11, .05, 20, 'pounce', 204, 13],
  crawler:           ['Bestiary', 'Crawler', -41, -16, -.14, -14, 'pounce', 166, 11],
  shark:             ['Bestiary', 'PlasticShark', 67, 19, -.09, 22, 'water', 82, 13],
  leviathan:         ['Bestiary', 'Leviathan', -49, -7, -.27, -19, 'water', 54, 17],
  faceling:          ['Bestiary', 'Faceling', -10, 8, .05, 5, 'stalk', 259, 18],
  camera:            ['Bestiary', 'SecurityCamera', 40, 3, -.16, -6, 'lock', 842, 12],
  neighborhoodwatch: ['LevelCreatures', 'NeighborhoodWatch', 21, -10, -.30, 11, 'dive', 129, 17],
  farmer:            ['LevelCreatures', 'FarmerFaceling', -28, -18, .02, -16, 'stalk', 103, 14],
  membri:            ['LevelCreatures', 'AraneaMembri', 34, 9, -.20, 18, 'dive', 234, 11],
  scratcher:         ['LevelCreatures', 'Scratcher', -39, 13, .02, -19, 'pounce', 323, 13],
  bonethief:         ['LevelCreatures', 'BoneThief', 52, 25, .20, 15, 'pounce', 190, 18],
  partyhost:         ['LevelCreatures', 'PartyHost', -33, 1, -.12, -13, 'stalk', 151, 16],
  veil:              ['Residents', 'Veil', -14, 12, .07, 7, 'blackout', 573, 16],
  bellwether:        ['Residents', 'Bellwether', 25, -8, -.45, -11, 'dive', 680, 15],
} as const;

export function catchShot(kind: string) {
  return Object.hasOwn(catchShots, kind) ? catchShots[kind as keyof typeof catchShots] : undefined;
}
