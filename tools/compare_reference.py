"""Compare a game screenshot with the reference scene, pixel by pixel.

Usage: python3 -I tools/compare_reference.py [shot.png] [reference.png]
Defaults: shots/reference_1x.png against art/scene_overcast_day_1x.png.

The screenshot (taken with ?scene=reference at 1x zoom) is aligned to the reference by the bounding box
of everything that is not background, refined by a small search. Prints how many pixels match exactly
and within a small tolerance, and writes shots/reference_diff.png (differences in red).
"""
import sys
import numpy as np
from PIL import Image

BG = np.array([83, 72, 89])


def content_box(rgb):
    diff = np.abs(rgb.astype(int) - BG).sum(-1) > 6
    ys, xs = np.nonzero(diff)
    return ys.min(), xs.min(), ys.max(), xs.max()


def main():
    shot_path = sys.argv[1] if len(sys.argv) > 1 else 'shots/reference_1x.png'
    ref_path = sys.argv[2] if len(sys.argv) > 2 else 'art/scene_overcast_day_1x.png'
    shot = np.array(Image.open(shot_path).convert('RGB')).astype(int)
    ref = np.array(Image.open(ref_path).convert('RGB')).astype(int)
    ry0, rx0, _, _ = content_box(ref)
    sy0, sx0, _, _ = content_box(shot)
    H, W = ref.shape[:2]
    best = None
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            oy, ox = sy0 - ry0 + dy, sx0 - rx0 + dx
            if oy < 0 or ox < 0 or oy + H > shot.shape[0] or ox + W > shot.shape[1]:
                continue
            crop = shot[oy:oy + H, ox:ox + W]
            score = (np.abs(crop - ref).sum(-1) == 0).mean()
            if best is None or score > best[0]:
                best = (score, oy, ox)
    if best is None:
        sys.exit('screenshot too small to hold the reference; use a bigger viewport')
    _, oy, ox = best
    crop = shot[oy:oy + H, ox:ox + W]
    d = np.abs(crop - ref).max(-1)
    content = np.abs(ref - BG).sum(-1) > 6
    exact = (d == 0).mean()
    near = (d <= 3).mean()
    exact_c = (d[content] == 0).mean()
    near_c = (d[content] <= 3).mean()
    out = (ref * 0.35).astype(np.uint8)
    out[d > 3] = (255, 40, 40)
    out[(d > 0) & (d <= 3)] = (255, 200, 60)
    Image.fromarray(out).save('shots/reference_diff.png')
    print(f'aligned at offset ({ox}, {oy}) in the screenshot')
    print(f'all pixels:     exact {exact:.4%}   within ±3 {near:.4%}')
    print(f'content pixels: exact {exact_c:.4%}   within ±3 {near_c:.4%}')
    print(f'pixels off by more than 3: {(d > 3).sum()} of {d.size}')
    print('diff image: shots/reference_diff.png (red: >3 off, yellow: 1-3 off)')


if __name__ == '__main__':
    main()
