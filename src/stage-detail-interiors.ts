import type { DetailDrawing as D, DetailSpec, Point } from './stage-detail-types';

const zinc='#999b8b', iron='#464944', rust='#83543a', ivory='#c7bea0', brass='#a28b59', ink='#313730';

// The rims are built out of tube segments; spokes cast their own small shadows.
function ring(d:D, c:string, x:number,y:number,z:number,r:number,t:number,segments=12) {
  for(let i=0;i<segments;i++) {
    const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
    d.rod(c,[x+r*Math.cos(a),y+r*Math.sin(a),z],[x+r*Math.cos(b),y+r*Math.sin(b),z],t);
  }
}
function rivets(d:D,x:number,y:number,w:number,h:number,z:number) {
  for(const dx of [-1,1])for(const dy of [-1,1])d.disc(zinc,x+dx*w/2,y+dy*h/2,z,.031,.012);
}
function cabinet(d:D,x:number,y:number,w:number,h:number,paint:string) {
  d.box(ink,x,y,.067,w+.035,h+.034,.114);
  d.box(paint,x,y,.132,w,h,.036);
  rivets(d,x,y,w-.08,h-.08,.157);
}
function grille(d:D,x:number,y:number,w:number,h:number,count:number,paint:string) {
  cabinet(d,x,y,w,h,paint);
  d.box(ink,x,y,.155,w*.90,h*.85,.017);
  for(let i=0;i<count;i++)d.box(paint,x,y-h*.36+i*h*.72/Math.max(1,count-1),.186,w*.87,.024,.062);
}
function sheaf(d:D,x:number,y:number,w:number,h:number,paper:string,tilt:number) {
  d.box('#716c59',x+.006,y-.009,.043,w+.009,h+.01,.014,tilt);
  d.box(paper,x,y,.055,w,h,.01,tilt);
  d.box('#c3ae76',x,y+h*.44,.067,w*.27,.048,.011,-tilt*.3);
}
function tubing(d:D,c:string,points:Point[],rad:number) {
  for(let i=1;i<points.length;i++)d.rod(c,points[i-1],points[i],rad);
}
function wheel(d:D,x:number,y:number,z:number,size:number) {
  d.disc(iron,x,y,z-.018,size*.78,.055); d.disc(rust,x,y,z+.045,size*.22,.12);
  ring(d,'#98533f',x,y,z+.12,size*.46,.021);
  for(let i=0;i<4;i++){const a=.27+i*Math.PI/2;
    d.rod('#995e46',[x,y,z+.12],[x+size*.43*Math.cos(a),y+size*.43*Math.sin(a),z+.12],.014);}
  d.disc(zinc,x,y,z+.147,.079,.021);
}
function gauge(d:D,x:number,y:number,z:number,r:number,angle:number) {
  d.disc(iron,x,y,z,r*2,.06); d.disc(ivory,x,y,z+.038,r*1.76,.015);
  for(let i=0;i<7;i++){
    const a=.18+i*Math.PI*.146;
    d.rod(iron,[x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.65,z+.052],
      [x+Math.cos(a)*r*.80,y+Math.sin(a)*r*.80,z+.052],.005);
  }
  d.rod('#6d392d',[x,y,z+.064],[x+r*.66*Math.cos(angle),y+r*.66*Math.sin(angle),z+.064],.01);
  d.disc(iron,x,y,z+.069,r*.18,.018);
}
function pegs(d:D,x:number,y:number,n:number,spacing:number) {
  for(let i=0;i<n;i++){
    const px=x+(i-(n-1)/2)*spacing;
    d.disc(brass,px,y,.09,.084,.032);
    tubing(d,'#7a7260',[[px,y,.11],[px,y-.042,.19],[px,y+.022,.225]],.016);
  }
}
function stripe(d:D,x:number,y:number,w:number,c:string) {
  d.box(c,x,y,.057,w,.055,.014);
}

export const interiorDetails:Record<string,DetailSpec> = {
  lobby:{name:'Ghost of the filing counter',build(d){
    d.stain('damp',-.37,1.01,1.57,1.87);
    // Torn top wallpaper reveals the grey backing along a staggered paperhanging seam.
    d.box('#ab9569',-.52,1.18,.036,.022,2.24,.022);
    d.box('#9b8b67',-.31,1.81,.045,.41,.63,.015,-.045);
    d.box('#c8af73',-.37,1.91,.074,.39,.44,.035,-.101);
    d.box('#cbb782',.22,.95,.083,1.98,.085,.12,-.013);
    for(const x of [-.61,.72]){d.box('#71664e',x,.82,.088,.07,.20,.10);d.disc(brass,x,.83,.15,.032,.01);}
    d.stain('scuff',.32,.54,1.98,.78);
  }},
  pitwalk:{name:'Removed safety gantry',build(d){
    for(const x of [-1.02,1.02]){
      cabinet(d,x,1.18,.29,.48,'#8e7b4d');
      d.rod(iron,[x,1.2,.16],[x,1.38,.30],.036);
      d.stain('rust',x,.69,.44,.8);
    }
    tubing(d,'#8b8163',[[-1.03,1.37,.30],[-.47,1.14,.24],[.12,1.05,.18],[.78,1.20,.26],[.94,1.31,.28]],.016);
  }},
  lower:{name:'Filter box with collapsed fins',build(d){
    grille(d,-.24,1.49,1.22,.68,9,'#92927c');
    for(let i=0;i<4;i++)d.box('#a7a187',.25+i*.075,1.44,.225,.19,.026,.045,-.31-i*.13);
    d.stain('soot',-.18,1.93,1.72,.79); d.stain('rust',-.59,.83,.28,.70);
  }},
  garage:{name:'Torn expansion joint guard',build(d){
    d.stain('scuff',0,.97,2.7,1.35);
    for(const x of [-.84,.80]){
      cabinet(d,x,1.01,.98,.22,'#6b6b54');
      for(let i=-1;i<=1;i++)d.box('#cfac66',x+i*.25,1.01,.16,.10,.185,.013,-.42);
    }
    tubing(d,rust,[[-.32,.64,.13],[-.19,.76,.24],[.02,.72,.22],[.24,.89,.10]],.024);
  }},
  garagekeys:{name:'Empty mechanic tool shadowboard',build(d){
    cabinet(d,-.12,1.45,1.56,.90,'#867c62');
    for(let row=0;row<3;row++)for(let col=0;col<8;col++)
      d.disc('#524d40',-.74+col*.18,1.18+row*.22,.155,.018,.012);
    for(const x of [-.57,-.23,.19]){
      d.rod(iron,[x,1.25,.183],[x+.035,1.58,.183],.021);
      ring(d,iron,x+.038,1.63,.18,.043,.012,7);
    }
    d.box('#9a8564',.26,.79,.18,1.65,.09,.26);d.stain('rust',-.4,.67,1.48,.37);
  }},
  darkdeck:{name:'Folded convex traffic mirror',build(d){
    d.rod(rust,[-.12,1.94,.02],[-.16,2.04,.27],.044);
    d.disc('#7e543b',-.16,1.96,.25,.80,.09);
    d.disc('#a6aaa0',-.16,1.96,.302,.70,.02);
    tubing(d,'#686a60',[[-.47,2.06,.321],[-.23,1.99,.321],[-.15,2.06,.321],[.10,1.88,.321]],.012);
    d.stain('damp',-.16,1.39,.66,.87);
  }},
  hub:{name:'Disconnected pneumatic dispatch rack',build(d){
    for(let i=0;i<3;i++){
      const x=-.49+i*.46;
      d.rod('#8a8871',[x,.29,.12],[x,1.48+i*.18,.12],.073);
      d.disc(brass,x,1.58+i*.18,.13,.31,.10);
      d.disc('#403f35',x,1.58+i*.18,.19,.227,.025);
      d.box(zinc,x,.65,.19,.20,.067,.062);
    }
    d.stain('dust',.04,.29,1.61,.49);
  }},
  blackgarage:{name:'Emergency lighting battery carcass',build(d){
    cabinet(d,-.07,1.94,1.06,.47,'#888a74');
    for(const x of [-.48,.34]){
      d.disc(iron,x,2.13,.19,.28,.12);d.disc('#c6bf9e',x,2.13,.266,.21,.035);
    }
    tubing(d,ink,[[.27,1.78,.17],[.42,1.44,.15],[.3,1.18,.10],[.37,1.02,.16]],.014);
    d.stain('soot',-.15,2.29,1.4,.57);
  }},
  pipes:{name:'Bleeding bypass valve',build(d){
    tubing(d,'#6f776d',[[-1.28,1.7,.12],[-.40,1.7,.12],[-.23,1.54,.12],[.94,1.54,.12]],.075);
    for(const x of [-.93,.63])d.box(rust,x,1.65,.15,.08,.26,.21);
    wheel(d,-.29,1.68,.14,.59);gauge(d,.46,1.93,.14,.16,1.91);
    d.stain('rust',-.29,.93,.62,1.42);
  }},
  station:{name:'Porcelain feeder insulators',build(d){
    cabinet(d,.02,1.65,1.41,.58,'#696d62');
    for(const x of [-.43,.01,.45]){
      for(let i=0;i<4;i++)d.disc(i%2?'#b2ad94':'#e0d6ad',x,1.67,.155+i*.034,.24-i*.024,.033);
      tubing(d,'#574e42',[[x,1.67,.31],[x+.03,1.32,.26],[x-.09,1.14,.18],[x-.08,.59,.12]],.022);
    }
    d.stain('soot',.40,2.09,.47,.85);
  }},
  office:{name:'Lunch clock and sun-faded memos',build(d){
    d.stain('dust',-.38,1.9,.67,.74);
    d.disc('#777362',-.36,1.93,.085,.49,.10);d.disc('#ddd7be',-.36,1.93,.149,.44,.018);
    d.rod(ink,[-.36,1.93,.17],[-.36,2.10,.17],.009);
    d.rod(ink,[-.36,1.93,.173],[-.26,1.97,.173],.012);
    sheaf(d,.31,1.44,.30,.39,'#b9b398',-.09);sheaf(d,.51,1.35,.26,.31,'#cdc6ac',.12);
    for(let i=0;i<4;i++)stripe(d,.52,1.40-i*.04,.12,'#9a947b');
  }},
  hotel:{name:'Moth-dusted bell annunciator',build(d){
    cabinet(d,-.02,1.64,1.44,.59,'#694933');
    d.box('#93805a',-.02,1.64,.159,1.35,.5,.022);
    for(let i=0;i<5;i++) {
      const x=-.55+i*.264;d.disc('#4c4638',x,1.68,.186,.19,.045);
      d.box(i===3?'#974d39':'#baa879',x,1.69,.218,.074,.11,.015,i===3?.48:.04);
      d.box(ivory,x,1.47,.186,.15,.04,.016);
    }
    d.stain('dust',0,1.08,1.64,.47);
  }},
  hotelrooms:{name:'Scorched laundry chute',build(d){
    cabinet(d,.08,1.34,1.08,.79,'#86816b');d.box(ink,.08,1.33,.16,.83,.55,.025);
    d.box('#8f8a77',.06,1.16,.20,.80,.23,.19,-.035);
    d.rod(brass,[-.19,1.19,.31],[.30,1.19,.31],.019);
    d.stain('soot',.06,2.00,1.32,1.0);d.stain('rust',.44,.68,.23,.83);
  }},
  pipesreturn:{name:'Steam trap and condensate legs',build(d){
    tubing(d,rust,[[-1.14,1.93,.18],[-.30,1.93,.18],[-.30,1.39,.18],[.4,1.39,.18],[.4,1.93,.18],[1.18,1.93,.18]],.057);
    d.disc('#766e54',.05,1.41,.19,.31,.19);
    for(const x of [-.63,.74])d.box('#555e54',x,1.93,.16,.072,.22,.19);
    d.stain('mineral',.02,1.01,.76,.64); d.stain('rust',-.27,.74,.3,1.06);
  }},
  fun:{name:'Slack birthday rosettes',build(d){
    const cord:Point[]=[[-1.15,2.09,.09],[-.58,1.92,.10],[0,1.88,.10],[.59,1.94,.10],[1.12,2.12,.09]];
    tubing(d,'#817457',cord,.012);
    for(let i=0;i<3;i++){
      const x=-.66+i*.65,y=i===1?1.77:1.85;
      for(let k=0;k<8;k++)d.box(i===1?'#8d8698':i===0?'#b27f74':'#bca36e',x,y,.107+k*.002,.07,.30,.018,k*Math.PI/8);
      d.disc(ivory,x,y,.14,.072,.02);
    }
    d.stain('scuff',.16,.72,2.25,.49);
  }},
  pool:{name:'Hollow overflow and mineral tide line',build(d){
    d.stain('mineral',0,.31,2.78,.49); d.stain('damp',.19,.31,1.75,.52);
    grille(d,-.15,.82,1.18,.29,4,'#9aa79e');
    for(let i=0;i<6;i++)d.box('#bfc6ac',-.70+i*.245,.49,.055,.065,.075,.015,-.1+i*.035);
  }},
  run:{name:'Bent stretcher impact rail',build(d){
    for(const x of [-1.03,.98])d.box('#6f6d64',x,.98,.095,.12,.23,.15);
    tubing(d,'#aeb3a3',[[-1.3,1.02,.17],[-.55,1.02,.17],[-.29,.91,.22],[.10,.88,.24],[.42,1.02,.17],[1.27,1.02,.17]],.043);
    d.stain('scuff',-.05,.86,1.97,.61);d.stain('rust',.96,.70,.30,.51);
  }},
  library:{name:'Tape splicing bench rack',build(d){
    cabinet(d,.04,1.46,1.26,.67,'#706c5a');
    for(const [x,r] of [[-.26,.18],[.32,.146]]) {
      d.disc('#494b42',x,1.49,.178,r*2,.043);ring(d,'#a39e86',x,1.49,.211,r*.86,.012,12);
      for(let i=0;i<3;i++)d.disc(ink,x+r*.47*Math.cos(i*2.09),1.49+r*.47*Math.sin(i*2.09),.214,.049,.014);
    }
    tubing(d,'#584837',[[-.38,1.37,.207],[-.10,1.13,.20],[.14,.97,.15],[.33,1.33,.20]],.007);
  }},
  dark:{name:'Sheared antenna feed bracket',build(d){
    cabinet(d,-.12,1.26,.31,.53,'#596059');
    tubing(d,zinc,[[-.12,1.26,.18],[.09,1.59,.21],[.11,2.31,.16]],.028);
    for(let j=0;j<4;j++)d.rod(zinc,[-.37+j*.05,1.68+j*.14,.17],[.51-j*.07,1.76+j*.14,.17],.012);
    d.stain('damp',-.17,.67,.57,.78);
  }},
  ocean:{name:'Storm-stripped jetty mooring',build(d){
    for(const x of [-.53,.54]){
      d.box('#6a5c4d',x,.58,.12,.21,1.16,.23,.024*x);
      d.box('#797d69',x,.86,.13,.23,.072,.24);
    }
    tubing(d,'#968668',[[-.53,.92,.22],[-.17,.67,.28],[.22,.63,.30],[.54,.86,.21]],.037);
    d.box('#86755a',0,.37,.1,1.27,.12,.16,.054);
  }},
  depths:{name:'Imploded dive helmet viewport',build(d){
    d.disc('#74735d',.02,.97,.15,.66,.24);
    d.disc('#454f4a',.02,.97,.278,.45,.023);ring(d,brass,.02,.97,.30,.228,.021);
    for(const offset of [-.105,0,.105])d.rod(zinc,[.02+offset,.80,.315],[.02+offset,1.14,.315],.012);
    d.stain('mineral',-.03,.50,1.1,.6);d.stain('rust',.25,.47,.35,.73);
  }},
  cave:{name:'Calcite rind around the seep',build(d){
    d.stain('damp',-.04,1.42,2.02,1.91);
    for(let i=0;i<8;i++){
      const x=-.89+i*.235,top=1.76+.12*Math.sin(i*1.63),length=.20+.19*(1+Math.cos(i*2.14));
      tubing(d,i%3?'#a49b7d':'#bdb394',[[x,top,.055],[x+.08,top-.11,.135],[x+.13,top-length,.072]],.027+(i%3)*.009);
    }
    d.stain('mineral',-.1,1.25,2.0,.82);
  }},
  projection:{name:'Rewound projection screen',build(d){
    d.rod('#716d59',[-.98,2.22,.14],[.99,2.22,.14],.072);
    d.box('#c3bc9c',-.05,1.91,.095,1.79,.52,.03,-.016);
    d.rod(zinc,[-.92,1.66,.12],[.85,1.63,.12],.016);
    tubing(d,'#7a735b',[[.14,1.64,.14],[.13,1.29,.16],[.19,1.24,.17],[.22,1.31,.17]],.009);
    d.stain('dust',.01,1.06,1.83,.98);
  }},
  arcade:{name:'Coin return and coin scars',build(d){
    cabinet(d,-.04,1.24,.64,.92,'#464d4c');
    for(const x of [-.18,.12]){
      d.box(zinc,x,1.42,.17,.145,.23,.03);d.box(ink,x,1.44,.193,.023,.105,.014);
      d.box('#98604b',x,1.15,.188,.13,.075,.042);
    }
    d.box(ink,-.03,.93,.19,.27,.09,.033);d.stain('scuff',-.08,.71,.94,.71);
  }},
  redrooms:{name:'Stripped alarm cage',build(d){
    d.disc('#5d5048',0,1.94,.11,.51,.15);
    d.disc('#a64739',0,1.94,.198,.30,.09);
    for(const x of [-.16,-.05,.06,.16]) {
      const rise=.23-Math.abs(x)*.40;
      tubing(d,zinc,[[x,1.94-rise,.14],[x,1.94-rise*.86,.28],[x,1.94+rise*.86,.28],[x,1.94+rise,.14]],.009);
    }
    d.stain('soot',.03,2.24,.84,.78);d.stain('rust',-.08,1.50,.39,.75);
  }},
  snack:{name:'Greasy order ticket rail',build(d){
    d.stain('damp',.06,1.44,2.06,1.02);
    d.box('#9b9d8d',0,1.83,.12,1.45,.09,.065);
    for(let i=0;i<5;i++){const x=-.51+i*.247;
      sheaf(d,x,1.54+.055*(i%3),.166,.45-.06*(i%3),i%2?'#c0ad8a':'#d4cbb1',.03*(i-2));
      for(let j=0;j<3;j++)d.box('#a49475',x,1.61-j*.045,.07,.1,.012,.007);
    }
  }},
  hotelchase:{name:'Battered luggage elevator gate',build(d){
    cabinet(d,0,1.36,1.29,1.14,'#6b5848');
    d.box(ink,0,1.36,.16,1.14,1.00,.02);
    for(let i=-2;i<=2;i++)for(const sign of [-1,1]){
      const x=i*.20;
      tubing(d,'#927e5d',[[x-.10,1.36+sign*.32,.194],[x+.10,1.36-sign*.32,.194]],.014);
    }
    d.stain('scuff',.08,.61,1.74,.54);
  }},
  deepool:{name:'Corroded pool depth staff',build(d){
    d.stain('mineral',-.18,.39,2.48,.57);
    d.box('#b3c4ba',-.26,.88,.075,.19,1.57,.041);
    for(let i=0;i<12;i++)
      d.box(i%3?'#596d68':'#886656',-.28+(i%3?-.02:0),.22+i*.115,.103,i%3?.068:.131,.021,.012);
    for(const y of [.19,1.55])d.disc(iron,-.26,y,.105,.028,.012);
  }},
  stagnant:{name:'Silted lock gate rack',build(d){
    d.stain('damp',.16,.59,2.61,1.02);d.stain('mineral',-.14,.62,2.04,.52);
    d.rod(rust,[-.40,.08,.14],[-.40,1.74,.14],.043);
    for(let i=0;i<9;i++)d.box('#8c7759',-.34,.39+i*.105,.14,.14,.035,.064,.15);
    wheel(d,-.07,1.31,.13,.53);
  }},
  funplus:{name:'Paper crown embossing dies',build(d){
    d.box('#79664e',.02,1.04,.15,1.41,.11,.25);
    for(let i=0;i<5;i++){const x=-.51+i*.247;
      d.box('#bfac77',x,1.25,.15,.22,.34,.052);
      d.box(i%2?'#a07277':'#9a9265',x+.058,1.43,.15,.105,.20,.048,-.49);
      d.disc(brass,x,1.19,.19,.038,.02);
    }
    d.stain('dust',0,.71,1.72,.50);
  }},
  slides:{name:'Contact sheet drying line',build(d){
    tubing(d,'#969482',[[-1.18,1.99,.14],[0,1.89,.12],[1.18,2.02,.14]],.012);
    for(let j=0;j<4;j++){
      const x=-.76+j*.47,y=1.68+(j%2)*.042;
      d.box('#c7baa0',x,y,.128,.34,.39,.021,.045*(j-2));
      for(let i=0;i<6;i++)d.box((i+j)%3?'#55544b':'#797869',x+(i%2-.5)*.125,y+.10-Math.floor(i/2)*.09,.149,.109,.070,.008);
      d.box(brass,x,y+.227,.15,.035,.105,.027,-.11);
    } d.stain('damp',.14,.94,1.78,.74);
  }},
  slides2:{name:'Motor bay inspection cable',build(d){
    d.stain('soot',-.25,1.44,1.26,1.05);
    cabinet(d,-.58,1.85,.46,.31,'#7a8172');
    for(let k=0;k<3;k++){const x=-.50+k*.041;
      tubing(d,k===1?'#756342':ink,[[x,1.70,.16],[x-.09,1.03,.22],[x+.22,.69-k*.06,.27],[x+.51,.74-k*.05,.26],[x+.64,1.20,.17]],.013);
    }pegs(d,.21,1.25,2,.18);
  }},
  slides3:{name:'Plaster casting core pins',build(d){
    d.stain('dust',-.07,.74,2.18,1.04);
    d.box('#746654',0,1.10,.15,1.48,.105,.27);
    for(const [x,r] of [[-.47,.14],[-.04,.22],[.46,.17]]){
      d.disc('#a49c89',x,1.27+r*.64,.14,r*1.83,.14);
      d.disc('#c7bfa9',x,1.29+r*.64,.23,r*1.34,.059);
      d.rod(iron,[x,1.31,.18],[x+.05,1.66+r,.18],.013);
    }
  }},
  plastic:{name:'Lighthouse lens salvage',build(d){
    d.box('#6e786d',-.08,.66,.16,.97,1.19,.19);
    d.disc('#5b6459',-.08,.83,.263,.80,.105);
    for(let i=0;i<4;i++)ring(d,i%2?'#c2be91':'#979b80',-.08,.84,.32,.093+i*.078,.016,14);
    d.stain('mineral',.04,.31,1.7,.43);
  }},
  gym:{name:'Folded gym climbing bars',build(d){
    for(const x of [-.63,.64])d.box('#89745a',x,1.29,.12,.084,2.24,.17);
    for(let i=0;i<8;i++)d.rod(i%3?'#af8e63':'#9c815f',[-.63,.36+i*.249,.17],[.64,.36+i*.249,.17],.029);
    d.stain('scuff',0,.73,1.65,.81);
  }},
};
