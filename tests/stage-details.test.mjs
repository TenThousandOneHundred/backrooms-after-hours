import {test} from 'node:test';
import assert from 'node:assert/strict';
import { stages } from '../src/campaign.ts';
import { interiorDetails } from '../src/stage-detail-interiors.ts';
import { exteriorDetails } from '../src/stage-detail-exteriors.ts';
import { stageDetailAnchors } from '../src/stage-detail-anchors.ts';

const artwork={...exteriorDetails,...interiorDetails};
test('every campaign stage has its own physically built, named vignette',()=>{
  assert.deepEqual(Object.keys(artwork).sort(),Object.keys(stages).sort());
  assert.equal(new Set(Object.values(artwork).map(a=>a.name)).size,Object.keys(stages).length);
  const assemblies=new Set();
  for(const [id,spec] of Object.entries(artwork)) {
    const parts=[];
    const d=Object.fromEntries(['box','disc','rod','stain'].map(op=>[op,(...args)=>parts.push([op,...args])]));
    spec.build(d);
    assert.ok(parts.filter(([op])=>op!=='stain').length>=3,id);
    for(const [op,color,...args] of parts){
      assert.ok(args.flat().every(Number.isFinite),id+' finite '+op);
      if(op!=='stain')assert.match(color,/^#[a-f0-9]{6}$/i);
      else assert.ok(['mineral','rust','scuff','soot','damp','dust'].includes(color),id);
      if(op==='box')assert.ok(args.slice(3,6).every(v=>v>0),id);
      if(op==='disc' || op==='stain')assert.ok(args.slice(-2).every(v=>v>0),id);
      if(op==='rod')assert.ok(args[2]>0 && args[0].some((v,i)=>v!==args[1][i]),id);
    }
    assemblies.add(JSON.stringify(parts));
  }
  assert.equal(assemblies.size,Object.keys(stages).length);
});

test('every official stage places its wall art within reach of the entry and away from interactables',()=>{
  for(const s of Object.values(stages)){
    const starts=stageDetailAnchors(s);
    assert.ok(starts.length>=1 && starts.length<=3,s.id);
    assert.deepEqual(starts,stageDetailAnchors(s));
    assert.ok(Math.hypot(starts[0].x-s.spawn[0], starts[0].z-s.spawn[1])<=7,s.id);
    for(const {x,z,dx,dz} of starts){
      assert.equal(s.map[z][x],'.',s.id);
      assert.equal(s.map[z+dz][x+dx],'#',s.id);
      assert.ok(![...s.props,...s.objects].some(p=>p.x===x && p.z===z),s.id);
      assert.ok(!s.props.some(p=>p.solid && p.x===x+dx && p.z===z+dz),s.id);
    }
  }
});
