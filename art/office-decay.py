"""Bake Level 0 damage from the project's CC0 material scans. Requires Pillow and NumPy."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / "public" / "surfaces"
out = root / "decay"
out.mkdir(exist_ok=True)
rng = np.random.default_rng(4881)
size = 640
yy, xx = np.mgrid[:size, :size] / size


def noise(cols, rows=None):
    pixels = rng.integers(0, 256, (rows or cols, cols), dtype=np.uint8)
    return np.asarray(Image.fromarray(pixels).resize((size, size), Image.Resampling.BICUBIC)) / 255 - .5


def scan(name):
    return np.asarray(Image.open(root / (name + ".webp")).convert("RGB").resize((size, size)), float) - 128


def mix(a, b, weight):
    return a + (b - a) * np.clip(weight, 0, 1)[..., None]


def bitmap(rgb):
    return Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"))


def save(image, name):
    image.save(out / (name + ".webp"), quality=87, method=6)


plaster, fibre = scan("plaster"), scan("paper")
for variant in range(2):
    rough = noise(11) * .44 + noise(39) * .14 + noise(140) * .07 + noise(460) * .05
    distance = np.sqrt(((xx - .5) / .32) ** 2 + ((yy - .53) / .39) ** 2)
    outline = distance + rough + .11 * np.sin(yy * 10 + variant * 2) + .09 * np.cos(xx * 11)
    # A dark tide mark surrounds the exposed gypsum. Slender runs follow gravity.
    drips = np.clip(noise(94, 4) + .14, 0, .55) * np.clip(yy - .34, 0, 1)
    damp = np.clip((1.43 - outline + drips) * 2.6, 0, 1)
    torn = outline < .91
    kraft = np.array([130, 101, 64]) + fibre * .63
    gypsum = np.array([146, 140, 119]) + plaster * 1.07 + rough[..., None] * 34
    chalk = np.array([212, 199, 160]) + fibre * .82
    rgb = mix(kraft, gypsum, (.85 - outline + noise(80) * .045) * 26)
    rgb = mix(rgb, chalk, np.exp(-((outline - .91) / .023) ** 2))
    stain = np.array([91, 78, 48]) + fibre * .38
    rgb = mix(stain, rgb, (.99 - outline) * 19)
    alpha = np.maximum(torn, damp * (.52 + .3 * np.exp(-((outline - 1.12) / .045) ** 2)))
    border = np.minimum.reduce([xx, 1 - xx, yy, 1 - yy])
    im = bitmap(rgb).convert("RGBA")
    im.putalpha(bitmap(255 * alpha * np.clip(border * 23, 0, 1)))
    save(im, "wall-" + str(variant))

# Bleed rings and perforations on the underside of a saturated mineral-fibre panel.
warp = noise(9) * .17 + noise(42) * .055 + noise(185) * .018
dist = np.sqrt(((xx - .64) / .53) ** 2 + ((yy - .24) / .58) ** 2) + warp
surface = np.array([195, 190, 164]) + scan("plaster") * .38
surface -= np.clip(1 - dist, 0, 1)[..., None] * np.array([48, 65, 67])
for radius, strength in [(.94, 28), (.77, 35), (.52, 17)]:
    surface -= np.exp(-((dist - radius) / .028) ** 2)[..., None] * strength
im = bitmap(surface)
ink = ImageDraw.Draw(im)
for _ in range(9900):
    x,y = rng.integers(0, size, 2)
    v = int(rng.integers(85, 155))
    ink.line((x, y, x + int(rng.integers(1, 4)), y + int(rng.integers(-1, 2))), fill=(v, v-4, v-18))
save(im, "acoustic")

# Photocopied night-shift forms with ink bleed and water damage.
for name, heading, stamp in [('intake', 'RECORDS TRANSFER', 'RETURNED'), ('repair', 'WATER INGRESS REPORT', 'UNRESOLVED')]:
    paper = np.array([202, 195, 161]) + fibre * .32
    tide = np.sqrt(((xx - .89) * 1.3) ** 2 + ((yy - .83) * .95) ** 2) + noise(17) * .034
    paper -= (np.clip(.57-tide, 0, 1)*72 + np.exp(-((tide-.48)/.012)**2)*26)[..., None]
    im = bitmap(paper).resize((470, 620))
    ink = ImageDraw.Draw(im)
    def label(x, y, text, pts, color='#48483e'):
        ink.text((x, y), text, font=ImageFont.load_default(size=pts), fill=color)
    label(31,26,'FACILITIES   /   NIGHT SHIFT',15)
    label(29,52,heading,29)
    ink.line((30,94,435,94),fill='#4d4e43',width=3)
    label(30,106,'RECORD 07-114      FILE COPY  /  B',14)
    for i, line in enumerate(['East exchange', 'Records annex', 'Service access', 'Returns desk', 'Lower stacks']):
        y = 165 + i * 51
        label(31,y,str(i+1).zfill(2)+'     '+line,17)
        ink.line((30,y+28,434,y+28),fill='#8d8870')
        ink.rectangle((393,y+2,405,y+14),outline='#686958',width=2)
    ink.rectangle((46,450,252,500),outline='#91513c',width=4)
    label(58,457,stamp,25,'#91513c')
    label(30,553,'RETAIN UNTIL THE NEXT INSPECTION',13)
    save(im, name)

# A black CRT face with an impact cone, branching fractures and trapped dust.
screen = np.zeros((size,size,3)) + [35,48,45] + noise(8)[...,None]*9 + rng.normal(0,2,(size,size,1))
im = bitmap(screen)
ink = ImageDraw.Draw(im)
impact = np.array([size*.31, size*.61])
paths = []
for i in range(16):
    angle=(i+rng.uniform(-.32,.32))*2*np.pi/16
    points=[tuple(impact)]
    for r in (17,39,72,119,187,288,476):
        a=angle+rng.uniform(-.115,.115)
        points.append(tuple(impact + r*np.array([np.cos(a),np.sin(a)])))
    ink.line(points,fill='#727f74',width=2)
    paths.append(points)
for j in (1,2,3,4):
    for i in range(16):
        if rng.random()<.75:
            ink.line([paths[i][j],paths[(i+1)%16][j]],fill='#556259',width=2)
ink.ellipse((191,379,205,395), fill='#151b19')
save(im,'crt')
