"""Author the two editable NLA tracks per actor. Run with Blender's Python.

Usage: python author-catches.py ART_DIRECTORY TEMPORARY_GLTF_DIRECTORY
Use copies of the pre-catch campaign libraries as input for a clean bake.
The saved Blender files keep the catch tracks muted alongside the existing NLA. The scratch glTFs are used for filming, not loaded by the game.
"""
from pathlib import Path
import sys
from math import radians
import bpy
from mathutils import Euler, Quaternion, Matrix

# Each control has three local-space poses in degrees: anticipation, attack, face at the lens.
# For armatures these address pose bones; on articulated props they address object pivots.
shots = {
    'Bacteria': ('bacteria', 10, 3, {
        'Skull': ((-18,16,-9),(22,-12,6),(-13,5,-15)), 'Mandible': ((5,0,0),(-32,0,0),(-49,0,0)),
        'Chest': ((-12,-9,4),(15,12,-6),(5,-11,2)), 'Forearm.L': ((8,2,14),(-22,6,-24),(-8,10,29))}),
    'Hound': ('hound', 9, 3, {'Muzzle': ((-18,0,14),(23,0,-21),(-8,0,11)), 'Mandible': ((3,0,0),(-37,0,0),(16,0,0)), 'Withers': ((-11,4,0),(9,-6,0),(3,4,0))}),
    'Smiler': ('smiler', 14, 2, {'Visage': ((0,9,-27),(-9,-18,6),(9,12,-5)), 'Rictus': ((-5,0,11),(17,0,-8),(-19,-5,12))}),
    'Deathmoth': ('moth', 8, 4, {'Wing-1': ((7,32,0),(-16,-54,8),(8,72,-12)), 'Wing1': ((5,-36,0),(-10,49,-7),(16,-69,15)), 'Thorax': ((-26,3,0),(17,-18,0),(-9,14,0))}),
    'SkinStealer': ('skinstealer', 12, 4, {'Mask': ((0,6,-31),(-8,17,24),(18,-19,-12)), 'Forearm-1': ((21,18,-5),(-41,9,22),(-16,-31,4)), 'Arm1': ((-9,12,10),(27,-22,-35),(46,7,-20))}),
    'Wretch': ('wretch', 9, 3, {'Spine': ((-28,6,0),(25,-12,6),(32,3,-8)), 'Howl': ((16,6,0),(-26,-6,8),(-34,10,-17)), 'Forearm1': ((9,6,0),(-33,17,-20),(19,-9,-31))}),
    'Kitty': ('kitty', 16, 2, {'BlankFace': ((0,0,5),(0,0,-56),(22,12,48)), 'Arm-1': ((4,0,-4),(-26,0,38),(-39,19,-8)), 'Arm1': ((3,0,4),(-4,0,-15),(-47,-13,10))}),
    'Watcher': ('watcher', 15, 2, {'Reliquary': ((0,0,-62),(3,0,27),(-18,2,-7)), 'Mantle': ((-3,7,3),(11,-17,-8),(6,18,9))}),
    'Partygoer': ('partygoer', 12, 3, {'Balloon': ((0,22,-24),(17,-31,8),(-23,12,33)), 'PaintedSmile': ((16,0,21),(-13,10,-6),(8,5,-23)), 'Sleeve1': ((-12,0,9),(53,12,-42),(24,-31,-16))}),
    'Animation': ('animation', 7, 3, {'ControlBar': ((0,0,-25),(0,0,33),(9,0,-32)), 'ChatteringJaw': ((4,0,0),(-28,0,0),(-41,0,2)), 'ArmHinge-1': ((21,6,-39),(-43,10,24),(14,-24,32)), 'CarvedHead': ((0,0,19),(-9,6,-27),(15,9,35))}),
    'AnimatedKing': ('king', 13, 4, {'RoyalMask': ((-28,0,2),(13,-6,2),(-6,12,-8)), 'Forearm1': ((-23,0,-45),(35,9,36),(-12,-21,26)), 'Doublet': ((-9,4,1),(12,5,-9),(4,-8,5))}),
    'Clump': ('clump', 10, 3, {'Clutch01': ((9,24,6),(-31,-39,-9),(47,18,22)), 'Clutch04': ((-15,-19,11),(38,27,-25),(-28,-16,24)), 'Clutch07': ((23,7,0),(-22,-21,48),(31,9,-38)), 'Knot': ((2,-8,7),(12,18,-16),(-11,-16,5))}),
    'Crawler': ('crawler', 8, 4, {'SegmentedBack': ((-14,15,8),(21,-23,-12),(-8,32,17)), 'Hook-1_0Upper': ((7,16,3),(-35,-15,19),(32,10,-16)), 'Hook1_0Upper': ((11,-9,-8),(-26,22,-31),(44,-18,13))}),
    'PlasticShark': ('shark', 10, 3, {'Hull': ((-6,20,-22),(18,-13,28),(-24,16,9)), 'CaudalFin': ((0,5,-37),(4,-3,51),(-8,6,-48))}),
    'Leviathan': ('leviathan', 14, 5, {'AbyssalBody': ((-24,8,6),(19,-13,-13),(-15,24,5)), 'Tail': ((0,-13,-56),(12,7,41),(-21,5,-34))}),
    'Faceling': ('faceling', 15, 3, {'UnmarkedFace': ((3,0,-5),(-3,0,39),(15,8,-51)), 'Forearm1': ((11,0,3),(-17,4,-16),(-37,-9,-20)), 'Arm-1': ((1,0,-2),(-7,0,9),(-32,22,13))}),
    'SecurityCamera': ('camera', 9, 2, {'OpticalHousing': ((12,0,-53),(-17,0,24),(14,0,-4)), 'Pedestal': ((0,0,14),(0,0,-23),(0,0,8))}),
    'NeighborhoodWatch': ('neighborhoodwatch', 14, 2, {'Orb': ((5,3,49),(-21,-7,-23),(23,0,7)), 'Stilt-1_0Upper': ((-12,6,3),(26,-7,17),(-18,10,-16)), 'Stilt1_1Upper': ((-8,0,3),(33,9,-20),(-24,-9,19))}),
    'AraneaMembri': ('membri', 8, 3, {'Carapace': ((-18,8,5),(19,-11,-9),(25,22,8)), 'Arm-1_0Upper': ((18,-11,-28),(-42,15,34),(-20,9,-36)), 'Arm1_0Upper': ((23,12,22),(-37,-21,-28),(-18,-14,41))}),
    'Scratcher': ('scratcher', 10, 3, {'Back': ((6,-6,-28),(-14,17,24),(18,-13,-10)), 'Rake1Upper': ((38,9,-31),(-49,-6,48),(13,16,-27)), 'Rake-1Lower': ((15,-12,5),(-16,12,-23),(39,-11,25))}),
    'BoneThief': ('bonethief', 15, 2, {'Reach': ((-37,-11,15),(14,18,-17),(34,-12,6)), 'Burrow': ((-6,0,0),(12,7,0),(-11,-3,0))}),
    'FarmerFaceling': ('farmer', 11, 4, {'Motor': ((2,12,31),(24,-26,-43),(-11,23,21)), 'Farmer': ((-12,0,19),(17,-11,-14),(21,7,-4))}),
    'PartyHost': ('partyhost', 13, 4, {'Sleeve-1': ((10,-9,-49),(42,18,18),(-14,4,-31)), 'Sleeve1': ((9,11,47),(38,-16,-22),(-17,-9,29)), 'Host': ((-22,4,0),(9,10,7),(16,-19,-12))}),
    'Veil': ('veil', 13, 3, {'Mask0': ((0,0,-29),(12,0,18),(-18,5,-3)), 'Mask1': ((4,12,34),(-17,-9,-36),(23,19,7)), 'Mask2': ((-8,-14,21),(14,12,-25),(-17,-16,-8)), 'Mantle': ((-9,0,5),(13,10,-10),(-16,0,8))}),
    'Bellwether': ('bellwether', 12, 3, {'Throat': ((-19,0,22),(24,6,-17),(-31,10,4)), 'Tongue': ((29,0,15),(-42,-12,-3),(36,17,-19)), **{'Petal'+str(i):((7,0,-5),(27,8,6),(-31,-6,4)) for i in range(10)}}),
}

def create_tracks(root):
    kind, windup, snap, controls = shots[root.name]
    members = [root, *root.children_recursive]
    targets = {}
    for name in controls:
        full = root.name + '_' + name
        for owner in members:
            if owner.name == full:
                targets[name] = owner, owner
                break
            if owner.type == 'ARMATURE':
                bone = owner.pose.bones.get(full) or owner.pose.bones.get(name)
                if bone:
                    targets[name] = owner, bone
                    break
        if name not in targets:
            raise ValueError((root.name, name))

    # Work in the original local rest basis, including pivots with nontrivial orientations.
    base = {n: t.matrix_basis.to_quaternion().copy() for n,(o,t) in targets.items()}
    rests = {n:(t.rotation_mode,t.matrix_basis.copy()) for n,(o,t) in targets.items()}
    for phase in ('Attack','Jumpscare'):
        name = root.name + phase
        owners = {o for o,t in targets.values()}
        for owner in owners:
            ad = owner.animation_data_create()
            ad.action = bpy.data.actions.new(name + ' ' + owner.name)
        for n,(owner,target) in targets.items():
            a,b,c = [Euler(tuple(map(radians, v))).to_quaternion() for v in controls[n]]
            rest = Quaternion()
            # End on the exact starting pose of the following cut. A short hold after
            # the windup makes the asymmetric impact read even on a small display.
            keys = ([(1,rest),(windup-2,a),(windup,a),(windup+4,b)] if phase=='Attack' else
                    [(1,b),(1+snap,c),(6+snap,c),(10+snap,c.slerp(b,.30)),(15+snap,c)])
            target.rotation_mode = 'QUATERNION'
            for frame, delta in keys:
                target.rotation_quaternion = base[n] @ delta
                if root.name=='BoneThief' and n=='Reach':
                    progress = (0,.12,.12,.94) if phase=='Attack' else (.94,1.25,1.25,1.08,1.18)
                    amount = progress[[k[0] for k in keys].index(frame)]
                    target.scale = (.86+.14*amount, .22+.85*amount, .22+.80*amount)
                    target.keyframe_insert(data_path='scale',frame=frame,group=n)
                target.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=n)
        for owner in owners:
            ad=owner.animation_data
            action=ad.action
            slot=ad.action_slot
            ad.action=None
            track=ad.nla_tracks.new()
            track.name=name
            strip=track.strips.new(name,1,action)
            strip.action_slot=slot
            strip.extrapolation='NOTHING'
            track.mute=True
    for n,(owner,target) in targets.items():
        mode,matrix=rests[n]
        target.rotation_mode=mode
        target.matrix_basis=matrix

def author(art, temp):
    temp.mkdir(parents=True,exist_ok=True)
    for lib in ['Bestiary','LevelCreatures','Bacteria','Residents']:
        path=art/(lib+'.blend')
        bpy.ops.wm.open_mainfile(filepath=str(path))
        scene=bpy.context.scene
        previous=[]
        for obj in scene.objects:
            ad=obj.animation_data
            if not ad: continue
            previous.append((ad,ad.action,ad.action_slot,[(tr,tr.mute) for tr in ad.nla_tracks]))
            ad.action=None
            for tr in list(ad.nla_tracks):
                if any(tr.name == r + p for r in shots for p in ('Attack','Jumpscare')): raise ValueError('Use an unmodified source library')
                tr.mute=True
        scene.frame_set(0)
        roots=[obj for obj in scene.objects if not obj.parent and obj.name in shots]
        for root in roots:
            create_tracks(root)
        fresh=[tr for obj in scene.objects if obj.animation_data for tr in obj.animation_data.nla_tracks if tr.name in {n+p for n in shots for p in ('Attack','Jumpscare')}]
        # For the scratch export, omit the old NLA strips entirely. Reopen the
        # saved source afterwards so these temporary edits never affect its library.
        for ad,act,slot,tracks in previous:
            for tr,mute in tracks: tr.mute=mute
            if act:
                ad.action=act
                ad.action_slot=slot
        scene.frame_set(0)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
        for ad,act,slot,tracks in previous:
            ad.action=None
            for tr,mute in tracks: ad.nla_tracks.remove(tr)
        for tr in fresh: tr.mute=False
        scene.frame_set(0)
        opts=dict(scene.get('glTF2ExportSettings',{}))
        opts.update(export_format='GLB',export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,export_yup=True)
        bpy.ops.export_scene.gltf(filepath=str(temp/(lib+'.glb')),**opts)
        print('Finished',lib,len(roots),flush=True)

if __name__=='__main__':
    author(*map(Path,sys.argv[-2:]))
