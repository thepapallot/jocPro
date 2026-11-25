#!/usr/bin/env python3
"""Offline asset preparation, explicitly approved by the user. Requires Pillow.

No game/backend imports. Reads the image_gen originals recorded in the manifest.
Pass --source-dir to locate those original basenames on another machine.
The finished PNGs are versioned directly; regeneration is optional.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'static/images/redesign-v2/memory-3d'
COLORS = {'white': (255, 255, 255), 'black': (0, 0, 0),
          'red': (255, 0, 0), 'yellow': (255, 255, 0),
          'green': (0, 170, 0), 'blue': (0, 102, 255)}
NAMES = 'alpha beta gamma delta epsilon lambda mu omega pi sigma'.split()
GEN = Path('/home/agusti/.codex/generated_images/01a20e83-d6e0-71d3-ad45-bbd70ab254bc')
ALPHA = GEN / 'exec-d8079eb5-b33a-47e6-9062-869b1c5b0eab.png'
PEDESTAL = GEN / 'exec-b0674be5-0a2d-498c-af3f-6f54603b48b3.png'


def largest_component(mask):
    """Keep the connected glyph, removing isolated generated speckles."""
    w, h = mask.size
    data = bytearray(mask.tobytes())
    best = []
    components = 0
    for start in range(len(data)):
        if not data[start]:
            continue
        components += 1
        stack, component = [start], []
        data[start] = 0
        while stack:
            i = stack.pop()
            component.append(i)
            x = i % w
            for j in ((i - 1 if x else -1), (i + 1 if x < w - 1 else -1), i - w, i + w):
                if 0 <= j < w * h and data[j]:
                    data[j] = 0
                    stack.append(j)
        if len(component) > len(best):
            best = component
    clean = bytearray(w * h)
    for i in best:
        clean[i] = 255
    return Image.frombytes('L', (w, h), bytes(clean)), components


def prepare(source):
    im = Image.open(source).convert('RGBA')
    # Only a few source pixels are smoothed; holes and recognisable strokes stay.
    binary = im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    binary = binary.filter(ImageFilter.MedianFilter(5))
    clean, _ = largest_component(binary)
    alpha = clean.filter(ImageFilter.GaussianBlur(0.65))
    im.putalpha(alpha)
    box = alpha.getbbox()
    im = im.crop(box)
    im.thumbnail((840, 840), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (1024, 1024))
    canvas.paste(im, ((1024 - im.width) // 2, (1024 - im.height) // 2))
    # Ensure RGB is zero in fully transparent pixels, without premultiplying edges.
    channels = list(canvas.split())
    visible = channels[3].point(lambda a: 255 if a else 0)
    channels[:3] = [ImageChops.multiply(c, visible) for c in channels[:3]]
    return Image.merge('RGBA', channels)


def recolor(im, name):
    if name == 'red':
        return im.copy()
    r, g, b, a = im.split()
    specular = ImageChops.darker(g, b)
    diffuse = ImageChops.subtract(r, specular)
    if name == 'white':
        gray = ImageChops.add(r.point(lambda x: round(x * .94)),
                              specular.point(lambda x: round(x * .12)))
        channels = [gray] * 3
    elif name == 'black':
        gray = ImageChops.add(r.point(lambda x: round(x * .065)),
                              specular.point(lambda x: round(x * .65)))
        # Narrow interior rim for a black clue on the dark board. No outer halo.
        rim = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(5)))
        gray = ImageChops.lighter(gray, rim.point(lambda x: round(x * .32)))
        channels = [gray] * 3
    else:
        channels = [ImageChops.add(diffuse.point(lambda x, c=c: round(x * c / 255)), specular)
                    for c in COLORS[name]]
    visible = a.point(lambda x: 255 if x else 0)
    return Image.merge('RGBA', [ImageChops.multiply(c, visible) for c in channels] + [a])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path)
    args = parser.parse_args()
    manifest = json.loads((OUT / 'generation-manifest.json').read_text())
    sources = {r['file'].removesuffix('-red.png'): Path(r['source']) for r in manifest['redMasters']}
    sources['alpha'] = ALPHA
    resolve = lambda p: args.source_dir / p.name if args.source_dir else p
    report = {'method': 'image_gen red originals; deterministic Pillow cleanup and color transfer',
              'size': [1024, 1024], 'colors': COLORS, 'assets': [], 'masters': []}
    for name in NAMES:
        source = resolve(sources[name])
        master = prepare(source)
        alpha_hash = hashlib.sha256(master.getchannel('A').tobytes()).hexdigest()
        report['masters'].append({'name': name, 'source': str(source), 'sourceSha256': sha(source)})
        for color in COLORS:
            path = OUT / f'{name}-{color}.png'
            recolor(master, color).save(path, optimize=True)
            report['assets'].append({'file': path.name, 'sha256': sha(path), 'alphaSha256': alpha_hash})
        print(f'{name}: six colors saved', flush=True)
    pedestal_source = resolve(PEDESTAL)
    pedestal_path = OUT / 'alpha-red-pedestal.png'
    prepare(pedestal_source).save(pedestal_path, optimize=True)
    report['pedestal'] = {'file': pedestal_path.name, 'source': str(pedestal_source),
                          'sourceSha256': sha(pedestal_source), 'sha256': sha(pedestal_path)}
    (OUT / 'preparation-report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
