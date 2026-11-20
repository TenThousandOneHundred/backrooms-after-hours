import { Color, Vector2 } from 'three';
import type { ShaderLib } from 'three';
import type { LevelAtmosphere, LightPattern } from './level-atmosphere';

const masks: Record<LightPattern, string> = {
  // p is in fixture spacings, with a stage-authored bearing. Phase spans one revolution.
  blinds: 'smoothstep(.29,.64,cos(p.x*6.283+.52*sin(phase)+height*.8))',
  water: '1.-smoothstep(.08,.48,abs(sin(p.x*4.+.7*sin(p.y*3.+phase))+cos(p.y*3.-phase)))',
  sweep: 'smoothstep(.35,.92,cos(p.x*2.6+phase+sin(p.y*1.7)*.65))',
  banks: 'smoothstep(-.22,.46,cos(floor(p.x)*1.85+floor(p.y)*.82-phase))',
  panes: '(1.-smoothstep(.30,.48,cell.x))*(1.-smoothstep(.28,.47,cell.y))*(.7+.3*cos(floor(p.x)+phase))',
  pools: '(1.-smoothstep(.09,.54,length(cell)))*(.72+.28*cos(phase+floor(p.y)*1.7))',
  beam: 'exp(-7.*abs(sin(p.x*2.3+height*.32+.50*sin(phase))))',
  embers: 'smoothstep(.29,.84,sin(p.x*2.+sin(phase+p.y))*cos(p.y*2.7-phase))',
};

export function stageProjection(profile: LevelAtmosphere) {
  const angle = (profile.bearing * Math.PI) / 180;
  const uniforms = {
    uStageAngle: { value: new Vector2(Math.cos(angle), Math.sin(angle)).divideScalar(profile.spacing) },
    uStageLamp: { value: new Color(profile.lamp) },
    uStagePhase: { value: 0 },
  };
  return {
    update(time: number) {
      uniforms.uStagePhase.value = (2 * Math.PI * (time % profile.period)) / profile.period;
    },
    apply(shader: Pick<typeof ShaderLib.standard, 'uniforms' | 'vertexShader' | 'fragmentShader'>) {
      Object.assign(shader.uniforms, uniforms);
      // Batched room surfaces store vertices in world coordinates, including stair height.
      shader.vertexShader =
        'varying float vStageHeight;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvStageHeight=transformed.y;',
        );
      shader.fragmentShader =
        'uniform vec2 uStageAngle; uniform vec3 uStageLamp; uniform float uStagePhase; varying float vStageHeight;\n' +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `
          {
          vec2 p=vec2(dot(vCircuitPos,uStageAngle),dot(vCircuitPos,vec2(-uStageAngle.y,uStageAngle.x)));
          float height=vStageHeight, phase=uStagePhase;
          vec2 cell=abs(fract(p+.5)-.5);
          float projected=${masks[profile.pattern]};
          outgoingLight *= .78+.22*projected;
          outgoingLight += diffuseColor.rgb*uStageLamp*projected*.33*(1.-uCircuit*affected*.92);
          }
          #include <opaque_fragment>`,
        );
    },
  };
}
