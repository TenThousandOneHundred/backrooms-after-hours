import type { DetailSpec } from './stage-detail-types';

// Each little assembly belongs to the architecture of one destination. All positions
// are in wall-local metres, so seams, old fasteners and their stains move together.
export const exteriorDetails: Record<string, DetailSpec> = {
  village: {
    name: 'Sun-bleached ice cream menu shutters',
    build(d) {
      for (const x of [-.93, .93]) d.box('#685440', x,.64,.08,.075,1.28,.1);
      d.box('#9c9983',0,.93,.1,2.02,.68,.12);
      for (let i=0;i<8;i++) d.box(i%3===0?'#a76762':'#e1cc9c',-.86+i*.246,1.33,.18,.242,.25,.22);
      for (const [x,c] of [[-.48,'#b58a7e'],[0,'#b3b995'],[.48,'#b79d68']] as const) {
        d.disc(c,x,.97,.178,.23,.018);
        d.rod('#ae895e',[x-.08,.88,.19],[x,.7,.19],.028);
        d.rod('#ae895e',[x+.08,.88,.19],[x,.7,.19],.028);
      }
      d.stain('rust',.91,.59,.16,.75);
    },
  },
  castle: {
    name:'Backstage pulley with a slack counterweight',
    build(d) {
      d.box('#60432e',-.36,1.96,.12,1.46,.14,.21,-.035);
      d.rod('#614530',[-1.02,1.5,.11],[-.48,1.96,.11],.045);
      for (const x of [-.82,.2]) {
        d.disc('#554a38',x,1.9,.24,.31,.08);
        d.disc('#b2a178',x,1.9,.296,.076,.025);
      }
      d.rod('#a38f64',[-.96,1.92,.27],[-.96,.48,.19],.014);
      d.rod('#ad9b72',[-.82,2.05,.26],[.2,2.05,.26],.017);
      d.rod('#a38f64',[.34,1.92,.27],[.34,1.1,.26],.017);
      d.box('#524d45',.34,.88,.18,.25,.42,.19,.04);
      d.stain('scuff',.34,.69,.4,1.25);
    },
  },
  courtyard1: {
    name:'Copper downspout and rain-washed masonry',
    build(d) {
      d.stain('mineral',-.26,.65,.61,1.27);
      d.rod('#728478',[-.27,2.59,.15],[-.27,.47,.15],.079);
      d.rod('#68776a',[-.27,.47,.15],[-.09,.31,.26],.08);
      for (const y of [.63,1.46,2.18]) d.box('#605d54',-.27,y,.16,.27,.059,.19);
      d.box('#676a62',.47,1.56,.09,.82,.052,.18,-.028);
      d.stain('damp',.47,1.18,.66,.72);
    },
  },
  suburbs: {
    name:'Leaning triple roadside mailboxes',
    build(d) {
      for (let i=0;i<3;i++) {
        const x=-.64+i*.61, y=.94+i*.045;
        d.box('#6e6555',x,y/2,.12,.095,y,.15,(i-1)*.045);
        d.box(['#726f61','#677a75','#8c786c'][i],x,y,.14,.49,.31,.24,(i-1)*.029);
        d.box('#353c39',x,y+.039,.274,.29,.025,.018);
        d.box('#9e4c3d',x+.19,y+.18,.265,.036,.22,.028);
        d.box('#af6650',x+.14,y+.28,.265,.13,.07,.031);
      }
    },
  },
  outpost: {
    name:'Decommissioned decontamination spray manifold',
    build(d) {
      d.stain('mineral',0,.83,1.41,1.62);
      d.rod('#88958a',[-.64,1.89,.15],[.62,1.89,.15],.042);
      for (const x of [-.6,0,.58]) {
        d.rod('#767f75',[x,1.9,.15],[x,1.75,.26],.033);
        d.disc('#aab3a7',x,1.73,.26,.18,.055);
      }
      d.rod('#778878',[-.64,1.89,.15],[-.64,.21,.15],.043);
      d.disc('#8f4c3e',-.64,.8,.225,.24,.035);
      d.disc('#a6a398',-.64,.8,.253,.1,.026);
    },
  },
  field: {
    name:'Broken grain sieve on timber legs',
    build(d) {
      for(const x of [-.74,.74]) d.box('#766445',x,.51,.11,.11,1.02,.16,(x>0?.05:-.05));
      for(const y of [.51,1.2]) d.box('#8c7352',0,y,.17,1.66,.096,.13,.026);
      for(let i=0;i<11;i++) d.rod('#847f64',[-.69+i*.135,.56,.17],[-.64+i*.135,1.16-(i===7?.32:0),.19],.014);
      d.rod('#675438',[-.72,.13,.1],[.7,1.14,.11],.049);
    },
  },
  residential: {
    name:'Conduit torn out of a breaker cabinet',
    build(d) {
      d.stain('soot',.22,1.48,.96,1.25);
      d.box('#4d514c',.31,1.33,.09,.64,.79,.16);
      d.box('#262b28',.31,1.34,.18,.53,.63,.028);
      for (const x of [.12,.28,.44]) {
        d.box('#8c7960',x,1.5,.22,.064,.11,.049);
        d.rod('#726454',[x,1.46,.22],[x-.058,1.17,.24],.019);
      }
      d.rod('#736d5d',[.17,.92,.1],[.17,.47,.09],.038);
      d.rod('#736d5d',[.17,.47,.09],[-.61,.47,.09],.038);
    },
  },
  school: {
    name:'Coat pegs and a single forgotten school scarf',
    build(d) {
      d.box('#85664d',0,1.22,.08,2.13,.15,.1,-.009);
      for (const x of [-.84,-.42,0,.42,.84]) {
        d.rod('#99988a',[x,1.21,.11],[x,1.27,.22],.026);
        d.disc('#aaa596',x,1.29,.225,.069,.045);
      }
      d.box('#425467',.37,.91,.153,.13,.71,.05,-.1);
      d.box('#4e6575',.5,1.02,.18,.12,.47,.043,.12);
      for(const y of [.64,.69]) d.box('#b6a688',.395,y,.19,.13,.025,.015,-.1);
      d.stain('scuff',-.37,.68,1.37,.6);
    },
  },
  bunker: {
    name:'Folded stretcher with cracked canvas webbing',
    build(d) {
      for (const x of [-.42,.42]) d.rod('#746c55',[x,.12,.18],[x,1.97,.09],.034);
      d.box('#6c7464',0,1.19,.115,.76,1.18,.09,-.02);
      for(const y of [.78,1.36,1.7]) d.box('#494a3f',0,y,.17,.88,.082,.062,-.016);
      d.box('#aba58b',.06,1.36,.214,.105,.09,.025);
      d.stain('dust',-.42,.25,.35,.36);
    },
  },
  stair: {
    name:'Missing handrail with a broken terminal bracket',
    build(d) {
      d.stain('scuff',-.12,1.05,1.98,.22);
      for (const x of [-.88,.03,.87]) {
        const y=1.03+.19*x;
        d.disc('#746d59',x,y,.06,.16,.05);
        d.rod('#797664',[x,y,.07],[x,y+.09,.23],.029);
      }
      d.rod('#9a917d',[-.99,.95,.24],[.16,1.17,.24],.047);
      d.stain('rust',.87,.89,.16,.44);
    },
  },
  pink: {
    name:'Miniature theatre with a missing curtain',
    build(d) {
      d.box('#987071',0,.47,.12,1.02,.91,.16);
      d.box('#54424a',0,.56,.214,.78,.57,.022);
      d.box('#c69f91',0,.91,.17,1.13,.105,.2);
      for(let i=0;i<4;i++) d.box(i%2?'#976466':'#ae7775',-.33+i*.068,.61,.245,.072,.53-i*.04,.045,.06);
      d.box('#b18980',0,.28,.22,.94,.052,.22);
      d.stain('dust',.48,.18,.34,.27);
    },
  },
  lowstation: {
    name:'Cracked sight glass and three stained sampling taps',
    build(d) {
      d.box('#687570',0,1.26,.08,1.19,.82,.12);
      for (let i=0;i<3;i++) {
        const x=-.37+i*.37;
        d.disc('#414c49',x,1.39,.16,.27,.065);
        d.disc(['#88665c','#84805a','#637f81'][i],x,1.39,.2,.19,.02);
        d.rod('#a1a299',[x,1.06,.15],[x,1.01,.27],.03);
        d.stain('mineral',x,.72,.105,.51);
      }
      d.rod('#393e3b',[-.42,1.46,.22],[-.34,1.31,.22],.01);
    },
  },
  overgrowth: {
    name:'Roots split a buried flume coupling',
    build(d) {
      d.disc('#716449',0,.68,.12,.76,.15);
      d.disc('#363b30',0,.68,.205,.57,.027);
      for(let i=0;i<5;i++) {
        const x=(i-2)*.16;
        d.rod('#726d49',[x,.18,.13],[x+.13,.61,.235],.032+i*.003);
        d.rod('#687048',[x+.13,.61,.235],[x-.08,1.06+i*.11,.14],.023);
        d.rod('#615e42',[x+.02,.85,.2],[x+.22,1.04,.105],.015);
      }
      d.stain('damp',.56,.28,.73,.52);
    },
  },
  grass: {
    name:'Fraying mooring ropes and weathered anchor cleats',
    build(d) {
      for (const x of [-.64,.49]) {
        d.box('#837556',x,.45,.105,.17,.9,.17,x*.045);
        d.box('#777d6b',x,.74,.21,.36,.073,.092);
        d.rod('#b6a27b',[x-.12,.76,.22],[x+.11,.64,.23],.027);
      }
      d.rod('#b29d71',[-.64,.72,.23],[-.18,.38,.24],.031);
      d.rod('#ad9a6f',[-.18,.38,.24],[.48,.72,.23],.028);
      for(let i=0;i<4;i++) d.rod('#beab7e',[-.21,.4,.25],[-.32+.059*i,.24-.03*(i%2),.26],.009);
    },
  },
  courtyard2: {
    name:'Wire-stitched board over shattered wired glass',
    build(d) {
      d.box('#657576',0,1.42,.09,1.31,.94,.11);
      d.box('#3d4d51',0,1.42,.16,1.17,.8,.03);
      for(const x of [-.44,-.22,0,.22,.44]) d.rod('#7c8480',[x,1.03,.188],[x,1.81,.188],.01);
      d.box('#9e886c',-.13,1.49,.209,1.37,.185,.09,.22);
      d.box('#796a57',.06,1.28,.245,1.26,.129,.07,-.17);
      for(const x of [-.5,.46]) d.disc('#444c48',x,1.28-.17*x,.29,.047,.017);
    },
  },
};
