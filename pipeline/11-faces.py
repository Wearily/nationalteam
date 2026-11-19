"""Slice the generated face sheets in faces-raw/ into cut-out headshots for auto-generated players.

Each sheet is a 3x3 grid named <age set>-<n>.png (u18, 19-24, 25-30, 31-36) on a flat green or grey
background. Output: public/faces/gen/<age set>-<nnn>.webp (256px, transparent) and src/ui/faces.json
with how many faces each age set has. Run:  python3 pipeline/11-faces.py
"""
import glob, json, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'public/faces/gen'
SIZE = 400

def cells(im):
    a = np.asarray(im).astype(int)
    white = a.min(axis=2) > 235
    def bands(frac, n):
        out, s = [], None
        for i, v in enumerate(list(frac < 0.6) + [False]):
            if v and s is None: s = i
            if not v and s is not None:
                if i - s > n * 0.2: out.append((s, i))
                s = None
        return out
    H, W = white.shape
    return [(x0, y0, x1, y1) for (y0, y1) in bands(white.mean(axis=1), H) for (x0, x1) in bands(white.mean(axis=0), W)]

def cut_green(c):
    a = np.asarray(c).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    ex = g - np.maximum(r, b)
    alpha = np.clip(1 - (ex - 18) / 55, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) + 4)  # remove green spill from hair and skin edges
    return np.dstack([r, g2, b, alpha * 255]).astype('uint8')

def cut_grey(c):
    # flat backdrop connected to the edges: flood it from the top corners and sides
    m = c.copy()
    w, h = m.size
    key = (255, 0, 255)
    for seed in [(1, 1), (w - 2, 1), (1, h // 3), (w - 2, h // 3), (w // 2, 1)]:
        if m.getpixel(seed) != key: ImageDraw.floodfill(m, seed, key, thresh=38)
    a = np.asarray(c).astype(float)
    k = np.asarray(m)
    bg = (k[..., 0] == 255) & (k[..., 1] == 0) & (k[..., 2] == 255)
    return np.dstack([a[..., 0], a[..., 1], a[..., 2], np.where(bg, 0, 255)]).astype('uint8')

def finish(rgba):
    im = Image.fromarray(rgba, 'RGBA')
    # pull the edge in by a pixel and soften it so no backdrop fringe is left
    al = im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(al)
    return im.resize((SIZE, SIZE), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.webp'): os.remove(f)
counts = {}
for path in sorted(glob.glob('faces-raw/*.png')):
    m = re.match(r'(u18|19-24|25-30|31-36)-\d+\.png$', os.path.basename(path))
    if not m: print('skipped (name not recognised):', path); continue
    age = m.group(1)
    im = Image.open(path).convert('RGB')
    cs = cells(im)
    if len(cs) != 9: print(f'skipped ({len(cs)} cells found, expected 9):', path); continue
    px = np.asarray(im.crop((cs[0][0] + 6, cs[0][1] + 6, cs[0][0] + 30, cs[0][1] + 30))).astype(int).mean(axis=(0, 1))
    green = px[1] - max(px[0], px[2]) > 60
    for (x0, y0, x1, y1) in cs:
        c = im.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3))
        n = counts.get(age, 0)
        finish(cut_green(c) if green else cut_grey(c)).save(f'{OUT}/{age}-{n:03d}.webp', quality=88, method=6)
        counts[age] = n + 1
json.dump(counts, open('src/ui/faces.json', 'w'))
print(counts)
