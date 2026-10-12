"""Pack the palette-swap player action sprites (interact / tool animations) into ../player_actions.png + .json.

Same conventions as pack_player.py / player.json: the marker ramps mk_skin, mk_hair, mk_top and mk_bot, the
four hair styles, eight directions (SE, S, SW, W, NW, N, NE, E) and an anchor per frame on the feet. The poses
and the tools are in actions.py. Frames are keyed '<style>/<action><k>/<DIR>' (e.g. 'short/chop2/NE'); every
frame carries its own rect and anchor. 'actions' lists each action's frame count, fps and loop flag.

The render box of a posed model is bigger than the plain walker's (raised arms, tools), so for every direction
it is grown until the sub-pixel and dither phase of the feet match player.png: the still parts of a pose then
draw exactly like the walk sprites and nothing shimmers when the game swaps atlases.

Usage: python3 pack_actions.py [procs]          the atlas + previews
       python3 pack_actions.py preview [procs]  only the previews (style 'short')
"""
import os, sys, json, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')
DRAFTS = os.path.join(OUT, 'drafts', 'actions')
DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E']
STYLES = ('short', 'long', 'bun', 'bald')
MARKERS = ('mk_skin', 'mk_hair', 'mk_top', 'mk_bot')
WALK_BBOX = (-6, 8, -10, 10, 0, 40)          # humans.human()'s default box (player.png)


def frame_list():
    import actions
    return [(a, k) for a in actions.ACTIONS for k in range(len(actions.ACTIONS[a]))]


def _mins(bb, ang):
    ca, sa = np.cos(ang), np.sin(ang)
    x0, x1, y0, y1, z0, z1 = bb
    cs = np.array([[x, y, z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], float)
    wx = cs[:, 0] * ca - cs[:, 1] * sa
    wy = cs[:, 0] * sa + cs[:, 1] * ca
    return (wx - wy).min(), ((wx + wy) / 2 - cs[:, 2]).min()


def phase_bbox(bb, ang):
    """Grow bb so that its screen x/y minimum equals the walker's modulo 4 (sampling + Bayer phase)."""
    ca, sa = np.cos(ang), np.sin(ang)
    x0, x1, y0, y1, z0, z1 = bb
    xo, yo = _mins(WALK_BBOX, ang)
    xn, _ = _mins(bb, ang)
    dx = xn - (xo - 4 * np.ceil((xo - xn) / 4 - 1e-9))       # >= 0: how far the x minimum must drop
    cx, cy = ca - sa, -(sa + ca)                            # screen x = cx * x + cy * y
    if dx > 1e-9:
        if abs(cx) >= abs(cy):
            if cx > 0: x0 -= dx / cx
            else: x1 += dx / -cx
        else:
            if cy > 0: y0 -= dx / cy
            else: y1 += dx / -cy
    bb = (x0, x1, y0, y1, z0, z1)
    _, yn = _mins(bb, ang)
    dy = yn - (yo - 4 * np.ceil((yo - yn) / 4 - 1e-9))
    return (x0, x1, y0, y1, z0, z1 + dy)


def model(style, action, k):
    import humans, actions
    from sdf import Model
    p = actions.ACTIONS[action][k]
    m = humans.human(skin_tone=2.6, skin_ramp='mk_skin', upper=('mk_top', 2.3), lower=('mk_bot', 1.8),
                     shoes=('night', 1.3), hair=('mk_hair', 2.2), hair_style=style, walk=p.get('walk', 0.0),
                     pose=p, held=actions.held_for(p))
    return m


def job(args):
    style, action, k, a = args
    import warnings; warnings.filterwarnings('ignore')
    from sdf import render, Model
    m = model(style, action, k)
    ang = a * np.pi / 4
    img, ox, oy = render(Model(m.parts, m.mats, phase_bbox(m.bbox, ang)), ang=ang)
    ys, xs = np.nonzero(img[..., 3])
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return args, img[y0:y1, x0:x1], ox - x0, oy - y0


def render_all(styles, procs):
    jobs = [(s, act, k, a) for s in styles for act, k in frame_list() for a in range(8)]
    with Pool(procs) as pool:
        return {args: (img, ox, oy) for args, img, ox, oy in pool.map(job, jobs, chunksize=4)}


# ------------------------------------------------------------------ previews
def recolour(img, looks):
    """Swap marker tones for real ramps, like src/systems/lookSwap.ts (outline = darkest tone x 0.78)."""
    from sdf import RAMP_RGB, RID
    out = img.copy()
    rgb = out[..., :3].astype(np.int64)
    key = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
    for mk, ramp in looks.items():
        tones = [RAMP_RGB[RID[mk], t] for t in range(6)] + [(RAMP_RGB[RID[mk], 0].astype(float) * 0.78).astype(np.uint8)]
        dst = [RAMP_RGB[RID[ramp], t] for t in range(6)] + [np.floor(RAMP_RGB[RID[ramp], 0].astype(float) * 0.78).astype(np.uint8)]
        for s, d in zip(tones, dst):
            sel = (key == ((int(s[0]) << 16) | (int(s[1]) << 8) | int(s[2]))) & (out[..., 3] > 0)
            out[sel, :3] = d
    return out


def previews(done, style='short', dirs=DIRS, scale=3):
    from pixfont import draw_text, text_width
    os.makedirs(DRAFTS, exist_ok=True)
    fl = frame_list()
    cells = {(act, k, a): done[(style, act, k, a)] for act, k in fl for a in range(8)}
    cw = max(im.shape[1] for im, _, _ in cells.values()) + 4
    ch = max(im.shape[0] for im, _, _ in cells.values()) + 4
    axs = max(ox for _, ox, _ in cells.values()); ays = max(oy for _, _, oy in cells.values())
    cw = max(cw, axs + max(im.shape[1] - ox for im, ox, _ in cells.values()) + 4)
    ch = max(ch, ays + max(im.shape[0] - oy for im, _, oy in cells.values()) + 4)
    lab = 34
    half = (len(fl) + 1) // 2
    groups = [fl[:half], fl[half:]]
    gw = lab + cw * len(dirs)
    W = gw * 2 + 6
    Hh = 9 + ch * half
    looks = {'mk_skin': 'skin', 'mk_hair': 'wood', 'mk_top': 'teal', 'mk_bot': 'blueg'}
    for name, rc in (('actions_sheet_3x.png', None), ('actions_recoloured_3x.png', looks)):
        sheet = np.zeros((Hh, W, 4), np.uint8)
        sheet[..., :3] = (128, 124, 132); sheet[..., 3] = 255
        for gi, grp in enumerate(groups):
            gx = gi * (gw + 6)
            for ci, d in enumerate(dirs):
                draw_text(sheet, gx + lab + ci * cw + cw // 2 - text_width(d) // 2, 2, d, (40, 34, 44))
            for ri, (act, k) in enumerate(grp):
                y = 9 + ri * ch
                draw_text(sheet, gx + 2, y + ch // 2 - 2, f'{act}{k}', (40, 34, 44))
                for ci, d in enumerate(dirs):
                    a = DIRS.index(d)
                    im, ox, oy = cells[(act, k, a)]
                    if rc:
                        im = recolour(im, rc)
                    x = gx + lab + ci * cw + axs - ox + 2
                    yy = y + ays - oy + 2
                    h, w = im.shape[:2]
                    region = sheet[yy:yy + h, x:x + w]
                    al = im[..., 3:4] > 0
                    region[...] = np.where(al, im, region)
        Image.fromarray(sheet, 'RGBA').resize((W * scale, Hh * scale), Image.NEAREST).save(os.path.join(DRAFTS, name), optimize=True)
    print('previews ->', DRAFTS)


# ------------------------------------------------------------------ atlas
def main(procs=4):
    import actions
    from sdf import RAMP_RGB, RID
    done = render_all(STYLES, procs)
    fl = frame_list()
    cw = max(im.shape[1] for im, _, _ in done.values()) + 2
    ch = max(im.shape[0] for im, _, _ in done.values()) + 2
    # one row per action frame; columns = style x direction (keeps the sheet under 2048 px both ways)
    sheet = np.zeros((ch * len(fl), cw * 8 * len(STYLES), 4), np.uint8)
    frames = {}
    for ri, (act, k) in enumerate(fl):
        for si, s in enumerate(STYLES):
            for a in range(8):
                ci = si * 8 + a
                im, ox, oy = done[(s, act, k, a)]
                h, w = im.shape[:2]
                x = ci * cw + (cw - w) // 2
                y = ri * ch + (ch - h) - 1
                sheet[y:y + h, x:x + w] = im
                frames[f'{s}/{act}{k}/{DIRS[a]}'] = {'x': ci * cw, 'y': ri * ch, 'w': cw, 'h': ch,
                                                     'anchor': [int(x - ci * cw + ox), int(y - ri * ch + oy)]}
    markers = {}
    for m in MARKERS:
        tones = [[int(v) for v in RAMP_RGB[RID[m], k]] for k in range(6)]
        outline = [int(v) for v in (RAMP_RGB[RID[m], 0].astype(float) * 0.78).astype(np.uint8)]
        markers[m[3:]] = tones + [outline]
    acts = {a: {'frames': len(actions.ACTIONS[a]), 'fps': actions.PLAYBACK[a][0], 'loop': actions.PLAYBACK[a][1]}
            for a in actions.ACTIONS}
    acts['carry']['cycle'] = actions.CARRY_CYCLE
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'player_actions.png'), optimize=True)
    json.dump({'image': 'player_actions.png', 'cell': [cw, ch],
               'note': 'Palette-swap player action sprites (interact / tool animations): frames '
                       '<style>/<action><k>/<DIR>, each with its own rect and anchor (the feet). markers.<part> '
                       'lists the six marker tones dark -> light and then the outline colour, exactly as in '
                       'player.json; the game recolours them (docs/11). actions.<name> gives frames, fps and '
                       'loop; carry plays like walking, cycle 0,3,1,3,0,4,2,4 (0 idle, 1 walk1, 2 walk2, '
                       '3 step1, 4 step2). Tools use fixed (non-marker) ramps and never gold.',
               'styles': list(STYLES), 'markers': markers, 'actions': acts, 'frames': frames},
              open(os.path.join(OUT, 'player_actions.json'), 'w'), indent=1)
    print('packed', len(frames), 'frames', sheet.shape, 'cell', cw, ch)
    previews(done)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'preview':
        procs = int(args[1]) if len(args) > 1 else 4
        previews(render_all(('short',), procs))
    else:
        main(int(args[0]) if args else 4)
