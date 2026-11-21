"""Bake the stage hardware patina and wall deposits from the licensed environment scans."""
import math
import random
from pathlib import Path
from PIL import Image, ImageOps

surfaces = Path(__file__).resolve().parents[1] / "public" / "surfaces"
metal = Image.open(surfaces / "metal.webp").convert("L")
softened = metal.resize((256, 256), Image.Resampling.LANCZOS).point(lambda n: round(166 + .34 * n))
softened.convert("RGB").save(surfaces / "hardware-patina.webp", quality=84, method=6)
plaster = ImageOps.autocontrast(Image.open(surfaces / "plaster.webp").convert("L"))
grains = plaster.resize((384, 256), Image.Resampling.LANCZOS)
kinds = [
    ("mineral", (211, 205, 178)), ("damp", (74, 75, 57)), ("rust", (142, 77, 42)),
    ("dust", (171, 155, 120)), ("soot", (51, 52, 46)), ("scuff", (73, 66, 59)),
]
atlas = Image.new("RGBA", (384, 256))
for idx, (kind, tint) in enumerate(kinds):
    rng = random.Random(kind)
    streaks = [(rng.uniform(.04,.96), rng.uniform(.13,.95), rng.uniform(.005,.035)) for _ in range(22)]
    for x in range(128):
        u = (x+.5)/128
        edge = max(0, math.sin(u*math.pi))
        ridge = .38 + .065*math.sin(u*13) + .037*math.cos(u*36)
        run = max(length*math.exp(-((u-mid)/width)**2) for mid,length,width in streaks)
        for y in range(128):
            v = (y+.5)/128
            xx, yy = idx%3*128+x, idx//3*128+y
            surface = grains.getpixel((xx,yy))/255
            if kind in ("rust","damp"):
                density = (.63*math.exp(-abs(v-.18)*5) + .82*run*max(0,1-v/(.18+run*.8)))*edge
            elif kind == "mineral":
                density = (.9*math.exp(-abs(v-ridge)*12) + .36*math.exp(-abs(v-ridge-.13)*24))*edge
            elif kind == "scuff":
                density = max(0,math.sin(v*39+7*u+1.4*math.cos(u*7)))*math.sin(v*math.pi)*edge*.8
            else:
                density = max(0,edge*math.sin(v*math.pi))**1.7*(.7+.3*math.cos(u*9+v*14))
            fade = min(1,x/7,y/7,(127-x)/7,(127-y)/7)
            alpha = max(0,min(230, round(fade*(density + .31*surface + .18*rng.random() - .38)*245)))
            atlas.putpixel((xx,yy), tuple(round(c*(.84+.19*surface)) for c in tint)+(alpha,))
atlas.save(surfaces / "stage-deposits.webp", quality=82, method=6)
