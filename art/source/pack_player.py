"""Pack the palette-swap player sprites (docs/11 character creator) into ../player.png + ../player.json.

The player is rendered once per hair style (short, long, bun, bald) with marker ramps for the skin, the hair,
the top and the bottom (sdf.py: mk_skin, mk_hair, mk_top, mk_bot). Each marker ramp has six pure, unmistakable
colours that no real sprite uses; the game swaps every marker tone for the same tone of the chosen ramp
(src/ui/playerLook.ts), so one set of sprites covers every skin tone, hair colour and outfit.

Frames are keyed '<style>/<pose>/<DIR>' with the poses idle, walk1, walk2, step1 and step2 (the 8-frame cycle,
like characters.json + characters_steps.json). The JSON lists the marker colours, outline included.

Usage: python3 pack_player.py [procs]
"""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']
STYLES = ('short', 'long', 'bun', 'bald', 'masked')  # masked: the fence's balaclava (Phase 3), any outfit
POSES = (('idle', 0.0), ('walk1', 0.6), ('walk2', -0.6), ('step1', 0.4), ('step2', -0.4))
MARKERS = ('mk_skin', 'mk_hair', 'mk_top', 'mk_bot')


def model(style, walk):
    import humans
    masked = style == 'masked'
    return humans.human(skin_tone=2.6, skin_ramp='mk_skin', upper=('mk_top', 2.3), lower=('mk_bot', 1.8),
                        shoes=('night', 1.3), hair=('mk_hair', 2.2), hair_style='bald' if masked else style,
                        mask=masked, hood=('night', 1.6) if masked else None, walk=walk)


def job(args):
    style, a, w = args
    import warnings; warnings.filterwarnings('ignore')
    from sdf import render
    img, ox, oy = render(model(style, w), ang=a * np.pi / 4)
    return args, img, ox, oy


def main(procs=4):
    from sdf import RAMP_RGB, RID
    jobs = [(s, a, w) for s in STYLES for _, w in POSES for a in range(8)]
    with Pool(procs) as pool:
        done = {args: (img, ox, oy) for args, img, ox, oy in pool.map(job, jobs)}
    cw = max(im.shape[1] for im, _, _ in done.values()) + 2
    ch = max(im.shape[0] for im, _, _ in done.values()) + 2
    rows = [(f'{s}/{pose}', [(DIRS[a], *done[(s, a, w)]) for a in range(8)]) for s in STYLES for pose, w in POSES]
    sheet = np.zeros((ch * len(rows), cw * 8, 4), np.uint8)
    frames = {}
    for ri, (rl, r) in enumerate(rows):
        for ci, (cl, im, ox, oy) in enumerate(r):
            h, w = im.shape[:2]
            x = ci * cw + (cw - w) // 2
            y = ri * ch + (ch - h)
            sheet[y:y + h, x:x + w] = im
            frames[f'{rl}/{cl}'] = {'x': ci * cw, 'y': ri * ch, 'w': cw, 'h': ch, 'anchor': [x - ci * cw + ox, y - ri * ch + oy]}
    markers = {}
    for m in MARKERS:
        tones = [[int(v) for v in RAMP_RGB[RID[m], k]] for k in range(6)]
        outline = [int(v) for v in (RAMP_RGB[RID[m], 0].astype(float) * 0.78).astype(np.uint8)]
        markers[m[3:]] = tones + [outline]
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'player.png'), optimize=True)
    json.dump({'image': 'player.png', 'cell': [cw, ch],
               'note': 'Palette-swap player sprites: frames <style>/<pose>/<DIR>. markers.<part> lists the six marker '
                       'tones dark -> light and then the outline colour; the game recolours them (docs/11).',
               'styles': list(STYLES), 'markers': markers, 'frames': frames},
              open(os.path.join(OUT, 'player.json'), 'w'), indent=1)
    print('packed', len(frames), 'frames', sheet.shape)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)
