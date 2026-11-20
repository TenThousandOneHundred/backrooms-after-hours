// The loop length is also the period for the projected light. Both are read from
// campaign time so a guest entering midway sees and hears the current phase.
export type LightPattern = 'blinds' | 'water' | 'sweep' | 'banks' | 'panes' | 'pools' | 'beam' | 'embers';
export type LevelAtmosphere = {
  lamp: string; fill: string; haze: string; pattern: LightPattern;
  period: number; spacing: number; bearing: number;
};
function look(lamp: string, fill: string, haze: string, pattern: LightPattern,
  period: number, spacing: number, bearing: number): LevelAtmosphere {
  return { lamp, fill, haze, pattern, period, spacing, bearing };
}
export const levelAtmospheres: Readonly<Record<string, LevelAtmosphere>> = {
  pipesreturn: look('#ffa75b','#758d8b','#674635','blinds',13,3.2,12),
  fun:         look('#ffc274','#b581ba','#79555f','pools',11,5.1,-30),
  pool:        look('#defffb','#74bbc5','#699f9d','water',15,3.4,18),
  run:         look('#ff6151','#ad6470','#6c2930','banks',8,5.5,90),
  library:     look('#efc87e','#72968a','#544e3d','blinds',16,1.6,0),
  village:     look('#ffe8a9','#ac94bf','#ab806c','pools',20,8,36),
  castle:      look('#ffba89','#9c88c1','#55465a','panes',17,2.6,-32),
  dark:        look('#7aabbe','#526674','#17252e','beam',21,7.5,66),
  ocean:       look('#ffc58b','#79adc8','#79929a','sweep',18,10.8,-20),
  depths:      look('#78dfde','#627fbb','#224b62','water',14,5.3,51),
  cave:        look('#cfa3ff','#73a99a','#564665','embers',19,2.8,10),
  projection:  look('#ffe0a1','#89a6ba','#6b6557','beam',12,3.5,24),
  courtyard1:  look('#ffbd9e','#809fc7','#8f777e','panes',16,4.1,41),
  suburbs:     look('#ffa34c','#7d89b1','#514454','pools',18,10.5,-12),
  outpost:     look('#a4f6d9','#8497b0','#455e63','banks',12,4.1,-5),
  field:       look('#ffce73','#a3a681','#a49363','sweep',17,8,16),
  arcade:      look('#fa75ca','#78c6d3','#61496e','panes',10,1.9,8),
  residential: look('#ffc088','#8a9592','#655949','blinds',14,2.2,-19),
  redrooms:    look('#ff715e','#a06780','#682936','beam',15,4.4,-24),
  snack:       look('#ffb9a0','#8dd1bc','#82756a','banks',16,6.3,90),
  hotelchase:  look('#ff9952','#7f85a7','#6a433c','sweep',9,5.9,0),
  courtyard2:  look('#94e9f0','#9895bd','#5a7587','panes',13,2.2,-8),
  deepool:     look('#7ee9fa','#6289bd','#2d5b73','water',17,2.1,75),
  stagnant:    look('#c7d96a','#7e9986','#535e3f','pools',19,4.3,57),
  funplus:     look('#fd89aa','#96c9ae','#875668','sweep',12,4.8,35),
  school:      look('#ffe1aa','#86a2a8','#6c705f','blinds',15,3.8,-8),
  slides:      look('#ff6458','#895f76','#652d3a','banks',13,3.3,0),
  slides2:     look('#ffc15f','#789da4','#6e6352','blinds',11,2.7,80),
  slides3:     look('#dbe4ff','#a198ba','#656779','beam',18,2.9,-41),
  bunker:      look('#a0e3ac','#819ca9','#4a665d','banks',14,2.8,30),
  stair:       look('#fff1c2','#8b9abe','#85888a','sweep',12,6.8,91),
  pink:        look('#ffa9c9','#bc98bc','#ad7c93','pools',16,2.8,28),
  lowstation:  look('#c9f3a0','#8b9eba','#60766a','panes',19,3.2,0),
  plastic:     look('#87deff','#b39dc4','#647e9c','water',12,1.6,-23),
  gym:         look('#ffbd71','#8aabb9','#85715c','banks',17,8.5,90),
  overgrowth:  look('#c5ed81','#799e8b','#617850','embers',18,3.8,-40),
  grass:       look('#ffda94','#95bb97','#a89d78','blinds',20,2.3,32),
};

export function campaignAtmosphere(id: string): LevelAtmosphere | undefined {
  return Object.hasOwn(levelAtmospheres, id) ? levelAtmospheres[id] : undefined;
}
