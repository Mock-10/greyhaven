"""Player interact / tool animations (docs/11 + docs/13): hand-held tool models and a pose table.

The human of humans.py faces local +x (left side = +y, right side = -y). Each action is a list of pose dicts
for humans.human(pose=..., held=...): arm joints are given in the upright torso frame (the elbows are solved
here with a two-bone arm, so the arm keeps its length), 'lean' bends the torso forward at the hips, 'crouch'
lowers the hips, 'head' nods the head, 'breath' lifts the shoulders. Extra keys used only here: 'axis' (the
tool's direction in the torso frame) and 'tool' (which TOOLS entry the frame holds).

Tools are chunky on purpose (a person is ~40 px tall) and never use the gold ramp (gold = valuables and
interactables only). Rendered by pack_actions.py into ../player_actions.png/.json.
"""
import numpy as np
from sdf import capsule, rbox, ell, RID, L

# ------------------------------------------------------------------ the arm (torso frame)
SH = {'L': np.array([0.0, 3.95, 30.6]), 'R': np.array([0.0, -3.95, 30.6])}
UA, FA = 7.03, 5.86            # upper arm and forearm lengths of humans.human()


def arm(side, wr, pole=None):
    """Elbow for a wrist target (torso frame); the elbow bends toward `pole` (default: out, down and back)."""
    s = 1.0 if side == 'L' else -1.0
    S = SH[side]
    W = np.asarray(wr, float)
    d = W - S
    n = float(L(d))
    reach = UA + FA - 0.05
    if n > reach:
        W = S + d / n * reach
        d = W - S
        n = reach
    u = d / n
    a = (UA * UA - FA * FA + n * n) / (2 * n)
    h = np.sqrt(max(UA * UA - a * a, 0.0))
    p = np.asarray(pole if pole is not None else (-0.35, 0.8 * s, -1.0), float)
    p = p - u * (p @ u)
    p = p / max(float(L(p)), 1e-6)
    return {'el' + side: S + u * a + p * h, 'wr' + side: W}


def pose(L=None, R=None, poleL=None, poleR=None, **kw):
    """A pose dict: L / R are wrist targets (torso frame), the rest are passed through."""
    out = dict(kw)
    if L is not None:
        out.update(arm('L', L, poleL))
    if R is not None:
        out.update(arm('R', R, poleR))
    return out


def unit(v):
    v = np.asarray(v, float)
    return v / float(L(v))


# ------------------------------------------------------------------ tool geometry helpers
def basis(u, hint=(0.0, 0.0, 1.0)):
    """Orthonormal rows (u, v, w) with u first; v lies in the plane of u and `hint` when possible."""
    u = unit(u)
    h = np.asarray(hint, float)
    if abs(float(u @ unit(h))) > 0.95:
        h = np.array([0.0, 1.0, 0.0])
    w = np.cross(u, h); w = w / float(L(w))
    v = np.cross(w, u)
    return np.stack([u, v, w])


def obox(P, c, R, hs, r=0.0):
    """Rounded box with centre c and local axes = rows of R."""
    q = (P - np.asarray(c, float)) @ R.T
    return rbox(q, (0, 0, 0), hs, r)


def local(P, c, R):
    return (P - np.asarray(c, float)) @ R.T


# each tool: f(J) -> list of (dist_fn(P), ramp, base, shine) ; J = joints from humans.human (world, unscaled)
def t_wrench(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    head = hand + ax * 6.2
    R = basis(ax, J['body']((0.0, 0.0, 1.0)))
    def shaft(P): return capsule(P, hand - ax * 1.2, head - ax * 1.0, 0.62)
    def jaw(P):
        q = local(P, head, R)
        d = rbox(q, (0, 0, 0), (1.3, 1.55, 0.6), 0.45)
        notch = rbox(q, (1.1, 0, 0), (0.9, 0.55, 1.0), 0.1)
        return np.maximum(d, -notch)
    return [(shaft, 'blueg', 3.1, 0.7), (jaw, 'white', 2.9, 0.9)]


def t_axe(J):
    base, ax = J['handL'], J['body'](J['pose']['axis'])
    blade = J['body'](J['pose']['blade'])
    tip = base + ax * 13.0
    R = basis(ax, blade)            # rows: handle axis, blade direction, side
    def handle(P): return capsule(P, base - ax * 1.0, tip + ax * 0.6, 0.62, 0.58)
    def head(P):
        q = local(P, tip, R)
        wedge = rbox(q, (0.0, 1.3, 0.0), (1.05, 2.0, 0.55), 0.25)
        flare = rbox(q, (0.0, 2.9, 0.0), (1.75, 0.55, 0.42), 0.2)     # the wider cutting edge
        poll = rbox(q, (0.0, -0.9, 0.0), (0.9, 0.75, 0.62), 0.25)
        return np.minimum.reduce([wedge, flare, poll])
    return [(handle, 'wood', 2.9, 0.0), (head, 'blueg', 3.0, 1.0)]


def t_picks(J):
    ax = J['body'](J['pose']['axis'])
    hr, hl = J['handR'], J['handL']
    dn = J['body']((0.0, 0.0, -1.0))
    def pick(P):
        a = hr + ax * 0.6
        b = hr + ax * 4.6
        return np.minimum(capsule(P, a, b, 0.42, 0.36), capsule(P, b, b + dn * -0.9 + ax * 0.5, 0.36))
    def tension(P):
        a = hl + ax * 0.5
        b = hl + ax * 3.3
        return np.minimum(capsule(P, a, b, 0.42), capsule(P, b, b + dn * 1.3, 0.4))
    return [(pick, 'white', 3.6, 1.0), (tension, 'blueg', 3.4, 0.8)]


def t_phone(J):
    c = (J['handL'] + J['handR']) / 2 + J['body']((0.1, 0.0, 1.15))
    nrm = J['body'](unit((-0.62, 0.0, 0.78)))       # the screen faces the eyes
    lon = J['body'](unit((0.78, 0.0, 0.62)))
    R = np.stack([lon, np.cross(nrm, lon), nrm])
    def case(P): return obox(P, c, R, (2.8, 1.75, 0.5), 0.35)
    def screen(P):
        q = local(P, c, R)
        return np.maximum(rbox(q, (0, 0, 0.25), (2.45, 1.45, 0.35), 0.2), 0.0 - (q[:, 2] - 0.05))
    return [(case, 'night', 1.3, 0.3), (screen, 'glass', 4.8, 1.2)]


def t_box(J):
    c = J['box_c']        # the pose's 'box' centre (torso frame), bent with the torso by held_for()
    R = np.stack([J['body']((1.0, 0, 0)), np.array([0.0, 1.0, 0.0]), J['body']((0, 0, 1.0))])
    hs = (3.0, 3.7, 2.8)
    def box(P): return obox(P, c, R, hs, 0.3)
    def tape(P):
        q = local(P, c, R)
        return np.maximum(obox(P, c, R, (hs[0] + 0.08, 0.65, hs[2] + 0.08), 0.3), 0.0 - (q[:, 0] + q[:, 2] - 0.5))
    return [(box, 'wood', 3.1, 0.0), (tape, 'stone', 3.8, 0.2)]


def t_nozzle(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    R = basis(ax, J['body']((0.0, 0.0, 1.0)))
    up = R[1]
    def body(P): return obox(P, hand + ax * 1.0 + up * 0.4, R, (2.3, 0.85, 1.05), 0.45)
    def guard(P): return capsule(P, hand + ax * 2.0 - up * 0.6, hand - ax * 0.6 - up * 1.4, 0.42)
    def spout(P): return capsule(P, hand + ax * 3.2 + up * 0.5, hand + ax * 6.2 - up * 0.3, 0.5, 0.42)
    def hose(P):
        a = hand - ax * 1.4 + up * 0.4
        return np.minimum(capsule(P, a, a + J['body']((-1.4, 0.0, -2.0)), 0.95),
                          capsule(P, a + J['body']((-1.4, 0.0, -2.0)), a + J['body']((-1.8, 0.4, -5.5)), 0.95))
    return [(body, 'red', 2.5, 0.4), (guard, 'night', 1.6, 0.0), (spout, 'blueg', 3.2, 0.8), (hose, 'night', 1.5, 0.2)]


def t_stamp(J):
    hand = J['handR']
    up = np.array([0.0, 0.0, 1.0])
    def knob(P): return ell(P, hand + up * 0.6, (1.45, 1.45, 1.15))
    def neck(P): return capsule(P, hand, hand - up * 2.4, 0.65)
    def block(P): return rbox(P, hand - up * 3.0, (2.0, 1.55, 0.7), 0.25)
    def rubber(P): return rbox(P, hand - up * 3.85, (1.85, 1.4, 0.28), 0.1)
    return [(knob, 'red', 2.7, 0.5), (neck, 'wood', 2.6, 0.0), (block, 'wood', 2.1, 0.0), (rubber, 'night', 1.2, 0.0)]


def t_screwdriver(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    def grip(P): return capsule(P, hand - ax * 1.1, hand + ax * 1.4, 0.85, 0.75)
    def shaft(P): return capsule(P, hand + ax * 1.4, hand + ax * 5.0, 0.38, 0.33)
    return [(grip, 'red', 2.8, 0.3), (shaft, 'white', 3.4, 1.0)]


# ---- weapons (Phase 4, docs/07): no gold; dark metal and wood, chunky enough to read at 40 px
def t_pistol(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    R = basis(ax, J['body']((0.0, 0.0, 1.0)))
    up = R[1]
    def slide(P): return obox(P, hand + ax * 1.6 + up * 1.0, R, (2.2, 0.55, 0.65), 0.25)
    def grip(P): return obox(P, hand + up * -0.2, R, (0.6, 0.5, 1.1), 0.25)
    return [(slide, 'night', 1.6, 0.6), (grip, 'night', 1.1, 0.2)]


def t_long(J):
    """Rifles, the shotgun, the SMG and the LMG: one long gun along the aim axis, the stock at the right hand.
    pose['gun'] = (barrel length, body half-height, ramp of the furniture)."""
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    length, bh, ramp = J['pose'].get('gun', (9.0, 0.8, 'wood'))
    R = basis(ax, J['body']((0.0, 0.0, 1.0)))
    up = R[1]
    def stock(P): return obox(P, hand - ax * 1.6 + up * 0.2, R, (1.6, 0.5, bh), 0.3)
    def body(P): return obox(P, hand + ax * 2.2 + up * 0.6, R, (2.6, 0.55, bh), 0.25)
    def barrel(P): return capsule(P, hand + ax * 4.4 + up * 0.9, hand + ax * length + up * 0.9, 0.42)
    return [(stock, ramp, 2.4, 0.0), (body, 'night', 1.5, 0.5), (barrel, 'night', 1.3, 0.7)]


def t_bat(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    def bat(P): return capsule(P, hand - ax * 1.4, hand + ax * 11.5, 0.5, 1.05)
    return [(bat, 'wood', 3.4, 0.2)]


def t_knife(J):
    hand, ax = J['handR'], J['body'](J['pose']['axis'])
    def handle(P): return capsule(P, hand - ax * 1.0, hand + ax * 1.0, 0.55)
    def blade(P): return capsule(P, hand + ax * 1.2, hand + ax * 4.2, 0.42, 0.18)
    return [(handle, 'night', 1.3, 0.0), (blade, 'white', 3.8, 1.2)]


TOOLS = {'wrench': t_wrench, 'axe': t_axe, 'picks': t_picks, 'phone': t_phone, 'box': t_box,
         'nozzle': t_nozzle, 'stamp': t_stamp, 'screwdriver': t_screwdriver,
         'pistol': t_pistol, 'long': t_long, 'bat': t_bat, 'knife': t_knife}


def held_for(p):
    """humans.human(held=...) callback for a pose dict, or None when the frame holds nothing."""
    name = p.get('tool')
    if name is None:
        return None
    fn = TOOLS[name]

    def held(P, J):
        J = dict(J)
        if 'box' in p:
            cr = p.get('crouch', 0.0)
            J['box_c'] = J['body'](np.asarray(p['box'], float) - (0, 0, 19.2)) + (0.0, 0.0, 19.2 - cr)
        pieces = fn(J)
        d = np.minimum.reduce([f(P) for f, *_ in pieces])

        def mat(pp, n):
            ds = np.stack([f(pp) for f, *_ in pieces], 0)
            k = ds.argmin(0)
            ramp = np.zeros(len(pp), np.int64); base = np.zeros(len(pp)); shine = np.zeros(len(pp))
            for i, (_, r, b, s) in enumerate(pieces):
                sel = k == i
                ramp[sel] = RID[r]; base[sel] = b; shine[sel] = s
            return ramp, base, shine
        return d, mat
    return held


# ------------------------------------------------------------------ the pose table (torso frame, +x = front)
def _chop(base, axis, blade, **kw):
    """Two hands on the axe: the left at the end of the handle, the right 2.6 up it."""
    base = np.asarray(base, float); a = unit(axis)
    return pose(L=base, R=base + a * 2.6, tool='axe', axis=a, blade=unit(blade), **kw)


def _wrench(phi, **kw):
    bolt = np.array([10.4, -1.0, 23.2])
    hand = bolt + 5.0 * np.array([-0.2, -np.cos(phi), np.sin(phi)])
    return pose(R=hand - np.array([1.2, 0.0, 0.0]), L=(8.2, 3.2, 22.2), tool='wrench', axis=unit(bolt - hand), **kw)


def _carry(walk):
    return pose(L=(4.6, 4.2, 24.4), R=(4.6, -4.2, 24.4), poleL=(-0.6, 1, -0.4), poleR=(-0.6, -1, -0.4),
                tool='box', box=(6.6, 0.0, 26.6), lean=-0.8, walk=walk)


ACTIONS = {
    # generic E: reach toward the thing, then press it
    'use': [pose(R=(7.6, -2.6, 27.2), lean=0.4),
            pose(R=(11.0, -2.0, 27.6), lean=1.6)],
    # bent in at the lock, both hands together, the pick jiggles
    'lockpick': [pose(L=(6.2, 1.2, 25.4), R=(6.6, -1.2, 25.0), lean=3.5, crouch=3.0, head=(0.6, 0, -0.4),
                      tool='picks', axis=unit((1.0, 0.1, 0.05))),
                 pose(L=(6.2, 1.2, 25.0), R=(6.8, -0.6, 26.2), lean=3.5, crouch=3.0, head=(0.6, 0, -0.4),
                      tool='picks', axis=unit((1.0, 0.25, 0.25)))],
    # under the dash: bent forward, hands low, screwdriver twists
    'hotwire': [pose(L=(7.4, 2.4, 21.5), R=(7.8, -1.6, 20.8), lean=6.0, crouch=2.0, head=(0.5, 0, -0.6),
                     tool='screwdriver', axis=unit((1.0, 0.25, -0.15))),
                pose(L=(7.4, 2.4, 22.3), R=(7.6, -0.6, 21.8), lean=6.0, crouch=2.0, head=(0.5, 0, -0.6),
                     tool='screwdriver', axis=unit((1.0, 0.45, 0.2)))],
    # a ratchet stroke on a bolt in front at chest/waist height
    'wrench': [_wrench(np.radians(50), lean=1.0), _wrench(np.radians(5), lean=1.0), _wrench(np.radians(-40), lean=1.4)],
    # two-handed axe: raised over the right shoulder, coming down, strike low in front, recover
    'chop': [_chop((0.4, -2.2, 34.0), (-0.55, -0.25, 0.8), (-0.8, 0.0, -0.55), lean=-1.0),
             _chop((4.6, -1.0, 33.4), (0.45, 0.0, 0.9), (0.9, 0.0, -0.45), lean=0.5),
             _chop((7.4, -0.6, 23.6), (0.82, 0.0, -0.58), (-0.58, 0.0, -0.82), lean=4.5, crouch=1.5),
             _chop((5.6, -1.4, 26.2), (0.55, -0.15, 0.82), (0.82, 0.0, -0.55), lean=1.5)],
    # a parcel at the chest; the legs walk (0 idle, 1 walk1, 2 walk2, 3 step1, 4 step2)
    'carry': [_carry(0.0), _carry(0.6), _carry(-0.6), _carry(0.4), _carry(-0.4)],
    # phone at the chest, looking down; a thumb tap
    'phone': [pose(L=(5.0, 1.0, 25.4), R=(5.2, -1.2, 25.4), head=(0.7, 0, -0.7), tool='phone',
                   poleL=(-0.5, 1, -0.6), poleR=(-0.5, -1, -0.6)),
              pose(L=(5.0, 1.0, 25.4), R=(5.6, -0.9, 26.3), head=(0.8, 0, -0.8), tool='phone',
                   poleL=(-0.5, 1, -0.6), poleR=(-0.5, -1, -0.6))],
    # the fuel nozzle held forward at the waist
    'pump': [pose(R=(7.0, -2.8, 22.6), lean=0.6, tool='nozzle', axis=unit((1.0, 0.1, -0.45)))],
    # bent forward rummaging, hands low and alternating
    'search': [pose(L=(7.4, 2.6, 17.6), R=(7.8, -2.0, 20.6), lean=7.0, crouch=2.5, head=(0.4, 0, -0.5)),
               pose(L=(7.8, 2.0, 20.6), R=(7.4, -2.6, 17.6), lean=7.0, crouch=2.5, head=(0.4, 0, -0.5))],
    # office stamp raised, then slammed onto the desk in front
    'stamp': [pose(R=(7.4, -2.4, 30.0), L=(7.6, 2.6, 22.6), lean=0.8, tool='stamp', poleR=(-0.3, -1, -0.8)),
              pose(R=(8.4, -1.8, 23.6), L=(7.6, 2.6, 22.6), lean=2.4, tool='stamp')],
    # typing: both hands forward at desk height, alternating
    'type': [pose(L=(7.6, 2.2, 22.0), R=(7.6, -2.2, 23.4), lean=1.8, head=(0.3, 0, -0.3)),
             pose(L=(7.6, 2.2, 23.4), R=(7.6, -2.2, 22.0), lean=1.8, head=(0.3, 0, -0.3))],
    # idle breathing: normal, then an in-breath
    'breathe': [pose(), pose(breath=1.0)],
    # weapons (Phase 4, docs/07): aims are held while the weapon is up, swings and stabs play once
    'aim_pistol': [pose(L=(10.2, 0.4, 29.2), R=(10.6, -0.4, 29.4), tool='pistol', axis=(1.0, 0.0, 0.0), lean=0.4)],
    'aim_rifle': [pose(R=(5.4, -2.2, 28.8), L=(10.4, -0.4, 28.6), tool='long', axis=unit((1.0, 0.18, 0.0)),
                       gun=(10.5, 0.75, 'wood'), lean=0.6)],
    'aim_heavy': [pose(R=(5.0, -2.6, 23.4), L=(10.0, -0.8, 23.8), tool='long', axis=unit((1.0, 0.2, 0.05)),
                       gun=(11.5, 1.35, 'night'), lean=-0.6)],
    'swing': [pose(R=(1.4, -3.6, 35.5), L=(2.0, -2.4, 34.8), tool='bat', axis=unit((-0.5, -0.3, 1.0)), lean=-0.6),
              pose(R=(7.4, -1.8, 29.4), L=(6.8, -0.6, 28.8), tool='bat', axis=unit((0.6, 0.7, 0.35)), lean=1.2),
              pose(R=(8.0, 1.6, 25.0), L=(7.2, 3.0, 25.4), tool='bat', axis=unit((0.25, 1.0, -0.25)), lean=1.6)],
    'stab': [pose(R=(4.4, -3.2, 26.0), tool='knife', axis=(1.0, 0.0, 0.1), lean=-0.2),
             pose(R=(11.4, -1.4, 27.2), tool='knife', axis=(1.0, 0.0, 0.0), lean=1.6)],
}

# playback (frames / fps / loop); carry plays its 5 frames like walking: 0,3,1,3,0,4,2,4
PLAYBACK = {
    'use': (6, False), 'lockpick': (4, True), 'hotwire': (6, True), 'wrench': (6, True), 'chop': (6, True),
    'carry': (8, True), 'phone': (2, True), 'pump': (1, True), 'search': (4, True), 'stamp': (4, True),
    'type': (8, True), 'breathe': (1.5, True),
    'aim_pistol': (1, True), 'aim_rifle': (1, True), 'aim_heavy': (1, True), 'swing': (12, False), 'stab': (12, False),
}
CARRY_CYCLE = [0, 3, 1, 3, 0, 4, 2, 4]
