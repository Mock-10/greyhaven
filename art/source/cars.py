"""Vehicles with realistic, crisp forms: planar greenhouse (one raked windshield, flat roof,
tumblehome sides), a tight-radius lower body with sloped hood, and flat inset lights."""
import numpy as np
from sdf import Model, ell, capsule, rbox, cyl_y, solid, RID, hash3

WB = 27.0          # half wheelbase
WR = 6.6           # wheel radius
WY = 15.0          # wheel centre |y|


def plane(P, pt, nrm):
    n = np.asarray(nrm, float); n = n / np.linalg.norm(n)
    return (P - np.asarray(pt, float)) @ n


def _wheels(P, wb=WB):
    d = np.full(len(P), 1e3)
    for sx in (1, -1):
        for sy in (1, -1):
            d = np.minimum(d, cyl_y(P, (sx * wb, sy * WY, WR), WR, 2.7, 1.4))
    return d


def _arches(P, wb=WB):
    d = np.full(len(P), 1e3)
    for sx in (1, -1):
        for sy in (1, -1):
            d = np.minimum(d, cyl_y(P, (sx * wb, sy * 16.0, WR + 0.2), WR + 1.4, 3.4, 0.3))
    return d


def _tire_mat(wb):
    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        r = np.sqrt((np.abs(x) - wb) ** 2 + (z - WR) ** 2)
        hub = (np.abs(n[:, 1]) > 0.75) & (r < 4.1)
        ramp = np.where(hub, RID['lavlt'], RID['asph'])
        base = np.where(hub, 2.7 + (r < 1.4) * 1.0 - ((r > 2.5) & (r < 3.1)) * 1.0, 0.9)
        return ramp, base, np.where(hub, 0.6, 0.0)
    return m


# ---------------------------------------------------------------- sedan geometry constants
BELT = 19.0       # beltline (top of doors / hood level at the cowl)
ROOF = 29.5
WS_LO, WS_HI = 15.5, 3.5         # windshield base x, top x
RW_LO, RW_HI = -24.0, -15.5      # rear window base x, top x
CAB_Y = 15.2                     # cabin half width at the beltline
TUMBLE = 0.22                    # inward lean of the side glass per unit height
BPIL = -5.0                      # B-pillar x


def _ws_x(z):
    return WS_LO + (WS_HI - WS_LO) * (z - BELT) / (ROOF - BELT)


def _rw_x(z):
    return RW_LO + (RW_HI - RW_LO) * (z - BELT) / (ROOF - BELT)


def _cabin(P):
    y, z = P[:, 1], P[:, 2]
    h = ROOF - BELT
    ws = plane(P, (WS_LO, 0, BELT), (h, 0, WS_LO - WS_HI))
    rw = plane(P, (RW_LO, 0, BELT), (-h, 0, RW_HI - RW_LO))
    side = (np.abs(y) - (CAB_Y - TUMBLE * (z - BELT))) / np.sqrt(1 + TUMBLE ** 2)
    roof = z - ROOF
    bot = (BELT - 1.5) - z
    return np.maximum.reduce([ws, rw, side, roof, bot])


def _body(P, length=43.6, half_w=17.0, top=BELT):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    tub = rbox(P, (0, 0, (top + 5.2) / 2), (length, half_w, (top - 5.2) / 2), 1.8)
    plan = rbox(P, (0, 0, 15), (length, half_w, 40), 4.5)           # rounded corners in plan only
    hood = plane(P, (14.0, 0, top), (0.075, 0, 1))                  # hood falls toward the nose
    nose = plane(P, (length, 0, 9.0), (1, 0, 0.22))                  # nose leans back slightly
    tail = plane(P, (-length, 0, 9.0), (-1, 0, 0.12))
    b = np.maximum.reduce([tub, plan, hood, nose, tail])
    return np.maximum(b, -_arches(P))


def _lights(p, n, ramp, base, shine, length):
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    front = n[:, 0] > 0.6
    rear = n[:, 0] < -0.6
    hl = front & (np.abs(y) > 8.8) & (np.abs(y) < 15.2) & (z > 12.6) & (z < 15.4)
    tl = rear & (np.abs(y) > 9.5) & (np.abs(y) < 15.6) & (z > 13.0) & (z < 16.2)
    # light wrap onto the side corner
    hl |= (np.abs(n[:, 1]) > 0.6) & (x > length - 3.2) & (z > 12.6) & (z < 15.0)
    tl |= (np.abs(n[:, 1]) > 0.6) & (x < -length + 2.2) & (z > 13.0) & (z < 16.0)
    ramp = np.where(hl, RID['white'], ramp); base = np.where(hl, 4.4, base)
    ramp = np.where(tl, RID['red'], ramp); base = np.where(tl, 2.9, base)
    grille = front & (np.abs(y) < 8.0) & (z > 11.0) & (z < 15.0)
    ramp = np.where(grille, RID['asph'], ramp); base = np.where(grille, 0.9 + (np.mod(np.floor(z), 2) == 0) * 0.8, base)
    bump = (np.abs(n[:, 0]) > 0.6) & (z < 10.8)
    ramp = np.where(bump, RID['asph'], ramp); base = np.where(bump, 1.6, base)
    plate = (np.abs(n[:, 0]) > 0.6) & (np.abs(y) < 4.2) & (z > 6.6) & (z < 9.6)
    ramp = np.where(plate, RID['white'], ramp); base = np.where(plate, 3.9, base)
    shine = np.where(hl | tl, 0.9, shine)
    return ramp, base, shine


def sedan(color=('clay', 2.3), police=False, taxi=False):
    cr, cb = color
    L = 43.6

    def parts(P):
        out = [_body(P, L), _cabin(P), _wheels(P)]
        mir = np.minimum(rbox(P, (12.6, 17.4, 20.6), (1.4, 1.1, 0.9), 0.4), rbox(P, (12.6, -17.4, 20.6), (1.4, 1.1, 0.9), 0.4))
        out.append(mir)
        if police:
            out.append(rbox(P, (-6.0, 0, 30.6), (2.6, 10.0, 1.1), 0.5))
        elif taxi:
            out.append(rbox(P, (-6.0, 0, 30.6), (2.4, 5.0, 1.2), 0.5))
        else:
            out.append(np.full(len(P), 1e3))
        return out

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.4)
        side = np.abs(n[:, 1]) > 0.55
        # body side: character line + lower sill
        cl = side & (z > 15.6) & (z < 16.5)
        base = np.where(cl, base + 0.7, base)
        under = side & (z > 9.0) & (z < 15.6)
        base = np.where(under, base - 0.25, base)
        sill = side & (z < 9.0)
        ramp = np.where(sill, RID['asph'], ramp); base = np.where(sill, 1.5, base)
        # door seams + handles
        for xs in (14.2, BPIL, -21.5):
            seam = side & (np.abs(x - xs) < 0.4) & (z > 9.0) & (z < BELT)
            base = np.where(seam, base - 1.0, base)
        for xh in (6.0, -12.5):
            hd = side & (np.abs(x - xh) < 1.6) & (np.abs(z - 17.2) < 0.45)
            base = np.where(hd, base + 1.2, base)
        if police:
            door = side & (z > 9.0) & (x > -21.5) & (x < 14.2)
            ramp = np.where(door, RID['white'], ramp); base = np.where(door, 3.3, base)
            badge = side & (np.abs(x - 3.0) < 2.4) & (z > 12.0) & (z < 15.4)
            ramp = np.where(badge, RID['gold'], ramp); base = np.where(badge, 3.8, base)
        if taxi:
            band = side & (z > 13.0) & (z < 14.3)
            ramp = np.where(band, RID['gold'], ramp); base = np.where(band, 3.0, base)
        # hood/trunk panel gaps on the top surface
        top = n[:, 2] > 0.7
        gap = top & ((np.abs(x - (WS_LO + 1.2)) < 0.35) | (np.abs(x - (RW_LO - 1.2)) < 0.35))
        base = np.where(gap, base - 0.8, base)
        return _lights(p, n, ramp, base, shine, L)

    def cabin_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb) + 0.2); shine = np.full(N, 0.4)
        if police:
            ramp[:] = RID['white']; base[:] = 3.3
        wsf = (n[:, 0] > 0.35) & (n[:, 2] > 0.3)
        rwf = (n[:, 0] < -0.35) & (n[:, 2] > 0.3)
        sidef = np.abs(n[:, 1]) > 0.7
        half = CAB_Y - TUMBLE * (z - BELT)
        zin = (z > BELT + 0.6) & (z < ROOF - 1.0)
        ws_g = wsf & zin & (np.abs(y) < half - 1.3)
        rw_g = rwf & zin & (np.abs(y) < half - 1.6)
        sd_g = sidef & zin & (x < _ws_x(z) - 1.8) & (x > _rw_x(z) + 2.4) & (np.abs(x - BPIL) > 1.0)
        glass = ws_g | rw_g | sd_g
        ramp = np.where(glass, RID['glass'], ramp)
        g = 1.4 + np.clip((z - BELT) / (ROOF - BELT), 0, 1) * 1.3
        # one soft diagonal sky reflection across each pane
        refl = np.abs(np.mod(x * 0.55 + y * 0.35 + z * 0.9, 9.0) - 4.5) < 1.1
        base = np.where(glass, g + refl * 0.7, base)
        shine = np.where(glass, 1.0, shine)
        # thin black trim around the glass on the sides
        trim = sidef & (np.abs(z - (BELT + 0.4)) < 0.4) & (x < _ws_x(z)) & (x > _rw_x(z))
        ramp = np.where(trim, RID['night'], ramp); base = np.where(trim, 1.2, base)
        return ramp, base, shine

    def bar_mat(p, n):
        if taxi:
            return np.full(len(p), RID['gold']), np.full(len(p), 3.4), np.full(len(p), 0.5)
        y = p[:, 1]
        ramp = np.where(y > 0.6, RID['red'], np.where(y < -0.6, RID['navy'], RID['white']))
        return ramp, np.where(np.abs(y) <= 0.6, 3.6, 3.3), np.full(len(p), 0.8)

    mats = [body_mat, cabin_mat, _tire_mat(WB), solid('night', 1.4), bar_mat]
    return Model(parts, mats, (-46, 46, -19, 19, 0, 33))


# ---------------------------------------------------------------- van
VBELT, VROOF = 19.5, 34.0
VWS_LO, VWS_HI = 31.0, 22.5


def van(color=('white', 3.0)):
    cr, cb = color
    L = 44.0

    def parts(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        lower = _body(P, L, 17.0, VBELT)
        upper = rbox(P, (-5.5, 0, (VBELT + VROOF) / 2), (38.5, 16.6, (VROOF - VBELT) / 2), 1.8)
        ws = plane(P, (VWS_LO, 0, VBELT), (VROOF - VBELT, 0, VWS_LO - VWS_HI))
        upper = np.maximum(upper, ws)
        upper = np.maximum(upper, rbox(P, (0, 0, 20), (L, 17, 40), 4.0))
        mir = np.minimum(rbox(P, (24.0, 17.6, 23.0), (1.4, 1.1, 1.6), 0.4), rbox(P, (24.0, -17.6, 23.0), (1.4, 1.1, 1.6), 0.4))
        return [np.minimum(lower, upper), _wheels(P), mir]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.35)
        side = np.abs(n[:, 1]) > 0.55
        sill = side & (z < 9.0)
        ramp = np.where(sill, RID['asph'], ramp); base = np.where(sill, 1.5, base)
        for xs in (17.0, -8.0, -40.5):
            seam = side & (np.abs(x - xs) < 0.4) & (z > 9.0) & (z < VROOF - 1)
            base = np.where(seam, base - 1.0, base)
        stripe = side & (z > 15.0) & (z < 16.6) & (x < 16)
        ramp = np.where(stripe, RID['brick'], ramp); base = np.where(stripe, 3.0, base)
        hd = side & (np.abs(x - 12.0) < 1.6) & (np.abs(z - 18.0) < 0.45)
        base = np.where(hd, base + 1.2, base)
        rd = (n[:, 0] < -0.6) & (np.abs(y) < 0.45) & (z > 9.5) & (z < VROOF - 1)
        base = np.where(rd, base - 1.1, base)
        wsf = (n[:, 0] > 0.35) & (n[:, 2] > 0.25) & (z > VBELT + 0.6) & (z < VROOF - 1.2) & (np.abs(y) < 15.0)
        sdw = side & (z > VBELT + 1.2) & (z < VROOF - 3.0) & (x > 18.5) & (x < VWS_LO - (VWS_LO - VWS_HI) * (z - VBELT) / (VROOF - VBELT) - 1.8)
        glass = wsf | sdw
        ramp = np.where(glass, RID['glass'], ramp)
        refl = np.abs(np.mod(x * 0.55 + y * 0.35 + z * 0.9, 9.0) - 4.5) < 1.1
        base = np.where(glass, 1.5 + np.clip((z - VBELT) / (VROOF - VBELT), 0, 1) * 1.3 + refl * 0.7, base)
        shine = np.where(glass, 1.0, shine)
        return _lights(p, n, ramp, base, shine, L)

    mats = [body_mat, _tire_mat(WB), solid('night', 1.4)]
    return Model(parts, mats, (-46, 46, -19, 19, 0, 36))


# ---------------------------------------------------------------- beater (Phase 2, the dealer's cheapest car)
BWB = 24.0                       # shorter wheelbase
BRW_LO, BRW_HI = -33.5, -14.0    # long, raked hatch glass


def _rwb_x(z):
    return BRW_LO + (BRW_HI - BRW_LO) * (z - BELT) / (ROOF - BELT)


def _cabin_hatch(P):
    y, z = P[:, 1], P[:, 2]
    h = ROOF - BELT
    ws = plane(P, (WS_LO - 2.0, 0, BELT), (h, 0, WS_LO - WS_HI))
    rw = plane(P, (BRW_LO, 0, BELT), (-h, 0, BRW_HI - BRW_LO))
    side = (np.abs(y) - (CAB_Y - 0.6 - TUMBLE * (z - BELT))) / np.sqrt(1 + TUMBLE ** 2)
    return np.maximum.reduce([ws, rw, side, z - (ROOF - 0.8), (BELT - 1.5) - z])


def beater(color=('khaki', 2.2), door=('stone', 2.4)):
    """An old, boxy two-box hatchback: faded paint, one primer-grey door, rust along the sills and a dented
    bumper. Flat glass and visible pillars like the sedan, never a rounded bubble."""
    cr, cb = color
    L = 39.0

    def parts(P):
        body = np.maximum(_body(P, L, 16.4), -_arches_b(P))
        mir = np.minimum(rbox(P, (10.4, 16.8, 20.4), (1.3, 1.0, 0.9), 0.4), rbox(P, (10.4, -16.8, 20.4), (1.3, 1.0, 0.9), 0.4))
        return [body, _cabin_hatch(P), _wheels_b(P), mir]

    def body_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb)); shine = np.full(N, 0.15)
        side = np.abs(n[:, 1]) > 0.55
        under = side & (z > 9.0) & (z < 15.6)
        base = np.where(under, base - 0.25, base)
        sill = side & (z < 9.0)
        ramp = np.where(sill, RID['asph'], ramp); base = np.where(sill, 1.5, base)
        # the primer door (front left only), faded and flat
        pd = side & (y > 0) & (x > -9.0) & (x < 12.4) & (z > 9.0)
        ramp = np.where(pd, RID[door[0]], ramp); base = np.where(pd, door[1], base); shine = np.where(pd, 0.0, shine)
        for xs in (12.4, -9.0, -27.0):
            seam = side & (np.abs(x - xs) < 0.4) & (z > 9.0) & (z < BELT)
            base = np.where(seam, base - 1.0, base)
        for xh in (5.0, -14.0):
            hd = side & (np.abs(x - xh) < 1.5) & (np.abs(z - 17.0) < 0.45)
            base = np.where(hd, base + 1.0, base)
        # rust: blotches along the sills and around the rear arches
        rr = side & (z > 8.2) & (z < 12.5) & (hash3(np.floor(x / 2.2), np.floor(z / 1.6), np.sign(y), 11) > 0.62)
        rr &= (x < -18) | (np.abs(x) < 6) | (x > 26)
        ramp = np.where(rr & ~pd, RID['brick'], ramp); base = np.where(rr & ~pd, 2.2, base)
        # sun-faded roofline and bonnet: one tone lighter in patches
        top = n[:, 2] > 0.7
        fade = top & (hash3(np.floor(x / 4.0), np.floor(y / 4.0), 3, 5) > 0.72)
        base = np.where(fade, base + 0.3, base)
        ramp, base, shine = _lights(p, n, ramp, base, shine, L)
        # a dent in the front bumper
        dent = (n[:, 0] > 0.6) & (z < 10.8) & (y > 6) & (y < 12)
        base = np.where(dent, base - 0.6, base)
        return ramp, base, shine

    def cabin_mat(p, n):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        N = len(p)
        ramp = np.full(N, RID[cr]); base = np.full(N, float(cb) + 0.3); shine = np.full(N, 0.15)
        wsf = (n[:, 0] > 0.35) & (n[:, 2] > 0.3)
        rwf = (n[:, 0] < -0.35) & (n[:, 2] > 0.2)
        sidef = np.abs(n[:, 1]) > 0.7
        half = CAB_Y - 0.6 - TUMBLE * (z - BELT)
        zin = (z > BELT + 0.6) & (z < ROOF - 1.8)
        ws_g = wsf & zin & (np.abs(y) < half - 1.3)
        rw_g = rwf & zin & (np.abs(y) < half - 1.8)
        sd_g = sidef & zin & (x < _ws_x(z) - 3.8) & (x > _rwb_x(z) + 2.6) & (np.abs(x - (-9.0)) > 1.0) & (np.abs(x - (-24.0)) > 1.0)
        glass = ws_g | rw_g | sd_g
        ramp = np.where(glass, RID['glass'], ramp)
        g = 1.2 + np.clip((z - BELT) / (ROOF - BELT), 0, 1) * 1.2
        refl = np.abs(np.mod(x * 0.55 + y * 0.35 + z * 0.9, 9.0) - 4.5) < 1.1
        base = np.where(glass, g + refl * 0.6, base)
        shine = np.where(glass, 0.9, shine)
        trim = sidef & (np.abs(z - (BELT + 0.4)) < 0.4)
        ramp = np.where(trim & ~glass, RID['night'], ramp); base = np.where(trim & ~glass, 1.2, base)
        return ramp, base, shine

    mats = [body_mat, cabin_mat, _tire_mat(BWB), solid('night', 1.4)]
    return Model(parts, mats, (-42, 42, -19, 19, 0, 32))


def _wheels_b(P):
    return _wheels(P, BWB)


def _arches_b(P):
    return _arches(P, BWB)


VEHICLES = {
    'sedan_clay': lambda: sedan(('clay', 2.5)),
    'sedan_teal': lambda: sedan(('teal', 2.6)),
    'sedan_khaki': lambda: sedan(('khaki', 2.6)),
    'sedan_lav': lambda: sedan(('lavlt', 1.9)),
    'taxi': lambda: sedan(('stone', 3.0), taxi=True),
    'police_car': lambda: sedan(('navy', 1.7), police=True),
    'van_white': lambda: van(('white', 3.0)),
    'van_sage': lambda: van(('sage', 2.5)),
    'beater_khaki': lambda: beater(('khaki', 2.1), ('stone', 2.4)),
    'beater_brick': lambda: beater(('brick', 2.6), ('lavlt', 2.2)),
}
