"""Interior drafts for the Phase 3 burglary houses (M11), built from the recorded answers in docs/18 (decisions
2026-10-11: 3 layouts, sleeping owners, alarms in about 1 in 3) and the room lists in src/data/burglary.ts:

  house_bungalow   8 x 6: bedroom on the left, kitchen at the back, living room at the front.
  house_family    10 x 7: main bedroom and kids room on the left, kitchen at the back, living room at the front.
  house_townhouse  8 x 7: study and bedroom at the back, a long living room with a dining corner at the front.

Each room has one SEARCH prompt (the order matches LAYOUTS in burglary.ts); the alarm panel sits by the front door.
The owner is an NPC spot the game shows only when someone is home and awake.

Same conventions as rooms.py (W along x with back wall A at y=0, D along y with back wall B at x=0, 32 units = 1 tile,
every model's front is local +y). Usage: python3 rooms_houses.py [room ...]
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from sdf import RID, Model, rbox, solid, to_image
import decor as D
import interiors as I
import props2
import rooms

T = rooms.T
it = rooms.it


def ch(key, idx, walk=0.0):
    return rooms.ch(key, idx, walk)


# Phase 5 (docs/09): the same houses as homes you own (rooms_property.py): no search prompts, no owner, the bed
# sleeps and saves, the wardrobe changes outfits, the alarm panel is just furniture, and a stash and the basement
# door join them.
HOME = {'on': False}


def search(model, facing, x, y, shadow, room):
    if HOME['on']:
        if room in ('BEDROOM', 'MAIN BEDROOM'):
            return it(model, facing, x, y, shadow, hl='idle', prompt=('E', 'CHANGE OUTFIT'))
        return it(model, facing, x, y, shadow)
    return it(model, facing, x, y, shadow, hl='idle', valuable=True, prompt=('E', f'SEARCH {room}'))


def bed(x, y):
    if HOME['on']:
        return it(I.bed(), 0.0, x, y, ('box', 24, 16, 12), hl='idle', prompt=('E', 'SLEEP / SAVE'))
    return it(I.bed(), 0.0, x, y, ('box', 24, 16, 12))


def owner(S, key, x, y):
    if not HOME['on']:
        S.append(it(ch(key, 2, 0.0), 0, x, y, ('blob', 6)))


def home_extras(S, stash_at, door_at, door_facing):
    """The stash under a loose board and the door down to the hideout (docs/09), only in a home you own."""
    if HOME['on']:
        S.append(it(I.floor_stash(), '+y', *stash_at, None, hl='idle', prompt=('E', 'STASH'), z_bias=-200))
        S.append(it(D.door_leaf(True, ('night', 2.2)), door_facing, *door_at, None, hl='idle',
                    prompt=('E', 'BASEMENT'), z_bias=3))


def hall_keypad():
    """The house alarm's keypad on a slim hall stand by the front door (front is local +y). The partitions are cut
    down, so a wall-mounted panel would float; this stands on the floor."""
    def parts(P):
        stand = rbox(P, (0, 0, 9.5), (4.2, 3.0, 9.5), 0.6)
        pad = rbox(P, (0, 0.8, 22.5), (4.6, 1.4, 3.6), 0.4)
        return [stand, pad]

    def m(p, n):
        x, z = p[:, 0], p[:, 2]
        front = n[:, 1] > 0.5
        scr = front & (np.abs(x) < 3.2) & (np.abs(z - 24.6) < 0.9)
        keys = front & (np.abs(x) < 2.8) & (z > 19.6) & (z < 23.2) & (np.mod(x + 10, 1.6) < 0.9) & (np.mod(z, 1.6) < 0.9)
        led = front & (np.abs(x - 3.6) < 0.5) & (np.abs(z - 21) < 0.5)
        r = np.where(scr, RID['sage'], np.where(keys, RID['lavlt'], np.where(led, RID['red'], RID['stone'])))
        b = np.where(scr, 4.2, np.where(keys, 3.8, np.where(led, 4.6, 2.8)))
        return r, b, np.where(scr | led, 1.0, 0.0)
    return Model(parts, [solid('wood', 2.2, 0.3), m], (-5, 5, -3.5, 3.5, 0, 26.5))


def alarm(facing, x, y):
    if HOME['on']:
        return it(hall_keypad(), facing, x, y, ('blob', 4))
    return it(hall_keypad(), facing, x, y, ('blob', 4), hl='idle', prompt=('E', 'ALARM PANEL'))


# ======================================================================= bungalow
def house_bungalow():
    W_t, D_t = 8, 6
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('khaki', 2.8), trim='wood',
                             windows=[('A', 22, 56), ('A', 214, 246), ('B', 120, 150)],
                             decals=[('curtains', 'A', 22, 56, 'sage'), ('curtains', 'B', 120, 150, 'sage'),
                                     ('tiles', 'A', 109, 172, 21, 34), ('clock', 'A', 186, 48, 3.4),
                                     ('painting', 'B', 168, 40, 18, 14, 'landscape'), ('calendar', 'A', 78, 40)])
    floor = lambda i, j: 'linoleum_a' if (i >= 3 and j < 3) else 'woodfloor_x'
    parts_ = [('y', 96, 0, 192, [(120, 142)]), ('x', 96, 96, 256, [(166, 188)])]
    S = []
    # --- bedroom: bed head against wall B, nightstand, wardrobe (the search), armchair corner
    S.append(bed(36, 34))
    S.append(it(I.nightstand(), '+x', 9, 62, ('box', 5, 5, 12)))
    S.append(it(D.table_lamp(), '+x', 9, 62, None, wz=12.0, z_bias=2))
    S.append(it(D.rug(30, 14, ('sage', 2.2), 'stone'), '+y', 40, 66, None, z_bias=-300))
    S.append(search(I.wardrobe(), '+y', 70, 9, ('box', 11, 7, 30), 'BEDROOM'))
    S.append(it(D.laundry_basket(), '+y', 84, 32, ('blob', 4)))
    S.append(it(D.armchair(('plum', 2.4)), '+x', 18, 168, ('box', 8, 8, 12)))
    S.append(it(D.side_table(), '+x', 18, 146, ('blob', 4)))
    S.append(it(D.plant_tall(3), '+y', 10, 100, ('blob', 6)))
    S.append(it(D.floor_lamp(), '+y', 82, 180, ('blob', 3)))
    # --- kitchen along wall A: the run with tiles, the fridge, a small table
    S.append(search(I.kitchen_run(62), '+y', 109, 9, None, 'KITCHEN'))
    S.append(it(D.dish_rack(), '+y', 122, 10, None, wz=20.6, z_bias=2))
    S.append(it(D.kitchen_items(), '+y', 141, 10, None, wz=20.6, z_bias=2))
    S.append(it(I.fridge(), '+y', 196, 10, ('box', 7, 7, 30)))
    S.append(it(I.table_chairs(), '+y', 214, 62, ('box', 11, 8, 10)))
    S.append(it(D.bowl_fruit(), '+y', 211, 60, None, wz=16.8, z_bias=4))
    S.append(it(D.trash_bin(), '+y', 112, 34, ('blob', 3)))
    S.append(it(D.plant_snake(), '+y', 246, 30, ('blob', 4)))
    # --- living room: TV against the bedroom wall, sofa facing it, the alarm panel by the front door
    S.append(it(D.rug(36, 46, ('brick', 2.2)), '+y', 152, 144, None, z_bias=-300))
    S.append(search(D.tv_stand(), '+x', 105, 144, ('box', 5, 15, 12), 'LIVING ROOM'))
    S.append(it(D.coffee_table(), '+x', 148, 144, ('box', 6, 10, 8)))
    S.append(it(D.sofa(('teal', 2.4)), '-x', 192, 144, ('box', 9, 22, 12)))
    S.append(it(D.side_table(), '+y', 226, 112, ('blob', 4)))
    S.append(it(D.floor_lamp(), '+y', 244, 112, ('blob', 3)))
    S.append(alarm('-x', 240, 176))
    S.append(it(D.coat_rack(), '+y', 246, 132, ('blob', 3)))
    S.append(it(D.plant_tall(7), '+y', 120, 180, ('blob', 6)))
    S.append(it(D.entrance_mat(), '+y', 211, 184, None, z_bias=-300))
    # --- the owner (shown when home and awake); a home of yours has the stash and the basement door instead
    owner(S, 'char/civilian_a', 60, 110)
    home_extras(S, (56, 84), (0, 80), '+x')
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 200, 222)])


# ======================================================================= family house
def house_family():
    W_t, D_t = 10, 7
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('stone', 2.7), trim='wood',
                             windows=[('A', 30, 64), ('A', 270, 302), ('B', 150, 180)],
                             decals=[('curtains', 'A', 30, 64, 'teal'), ('curtains', 'B', 150, 180, 'red'),
                                     ('tiles', 'A', 139, 202, 21, 34), ('clock', 'A', 250, 48, 3.4),
                                     ('painting', 'B', 72, 40, 20, 14, 'portrait'), ('poster', 'B', 200, 44, 12, 14, 'teal'),
                                     ('calendar', 'A', 92, 40)])
    floor = lambda i, j: 'linoleum_a' if (i >= 4 and j < 3) else 'woodfloor_x'
    parts_ = [('y', 112, 0, 224, [(60, 82), (150, 172)]), ('x', 112, 0, 112, []), ('x', 96, 112, 320, [(206, 228)])]
    S = []
    # --- main bedroom
    S.append(bed(36, 34))
    S.append(it(I.nightstand(), '+x', 9, 62, ('box', 5, 5, 12)))
    S.append(it(D.table_lamp(), '+x', 9, 62, None, wz=12.0, z_bias=2))
    S.append(it(D.rug(32, 16, ('red', 2.2), 'stone'), '+y', 42, 76, None, z_bias=-300))
    S.append(search(I.wardrobe(), '+y', 84, 9, ('box', 11, 7, 30), 'MAIN BEDROOM'))
    S.append(it(D.laundry_basket(), '+y', 100, 34, ('blob', 4)))
    S.append(it(D.plant_small(4), '+y', 100, 100, ('blob', 4)))
    # --- kids room: a smaller bed, a bookshelf (the search), toys and a desk
    S.append(it(I.bed(), 0.0, 36, 148, ('box', 24, 16, 12)))
    S.append(it(D.rug(30, 20, ('teal', 2.3), 'khaki'), '+y', 54, 192, None, z_bias=-300))
    S.append(search(D.bookshelf(4), '+x', 9, 196, ('box', 6, 14, 32), 'KIDS ROOM'))
    S.append(it(D.cardboard_boxes(2, 3), '+y', 96, 206, ('box', 7, 6, 10)))
    S.append(it(D.wooden_chair(), '-y', 88, 160, ('blob', 4)))
    S.append(it(D.side_table(False), '-y', 88, 140, ('blob', 4)))
    S.append(it(D.laundry_basket(), '+y', 68, 124, ('blob', 4)))
    # --- kitchen along wall A
    S.append(search(I.kitchen_run(62), '+y', 139, 9, None, 'KITCHEN'))
    S.append(it(D.dish_rack(), '+y', 152, 10, None, wz=20.6, z_bias=2))
    S.append(it(D.kitchen_items(), '+y', 171, 10, None, wz=20.6, z_bias=2))
    S.append(it(I.fridge(), '+y', 226, 10, ('box', 7, 7, 30)))
    S.append(it(I.table_chairs(), '+y', 278, 60, ('box', 11, 8, 10)))
    S.append(it(D.bowl_fruit(), '+y', 275, 58, None, wz=16.8, z_bias=4))
    S.append(it(D.vase_flowers('plum'), '+y', 282, 63, None, wz=16.8, z_bias=5))
    S.append(it(D.trash_bin(), '+y', 128, 30, ('blob', 3)))
    S.append(it(D.plant_snake(), '+y', 310, 84, ('blob', 4)))
    # --- living room: TV on the kitchen wall, sofa facing it, armchair, the alarm panel by the door
    S.append(it(D.rug(46, 36, ('plum', 2.2)), '+y', 214, 146, None, z_bias=-300))
    S.append(search(D.tv_stand(), '+y', 214, 105, ('box', 15, 5, 12), 'LIVING ROOM'))
    S.append(it(D.coffee_table(), '+y', 214, 140, ('box', 10, 6, 8)))
    S.append(it(D.sofa(('sage', 2.4)), '-y', 214, 176, ('box', 22, 9, 12)))
    S.append(it(D.armchair(('teal', 2.4)), '+x', 172, 140, ('box', 8, 8, 12)))
    S.append(it(D.side_table(), '+y', 250, 176, ('blob', 4)))
    S.append(it(D.floor_lamp(), '+y', 128, 206, ('blob', 3)))
    S.append(it(D.bookshelf(2), '-x', 311, 130, ('box', 6, 14, 32)))
    S.append(alarm('-x', 300, 208))
    S.append(it(D.coat_rack(), '+y', 296, 150, ('blob', 3)))
    S.append(it(D.plant_tall(5), '+y', 310, 178, ('blob', 6)))
    S.append(it(D.entrance_mat(), '+y', 261, 216, None, z_bias=-300))
    # --- the owner (shown when home and awake); a home of yours has the stash and the basement door instead
    owner(S, 'char/civilian_b', 160, 186)
    home_extras(S, (60, 92), (0, 88), '+x')
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 250, 272)])


# ======================================================================= townhouse
def house_townhouse():
    W_t, D_t = 8, 7
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('lavlt', 2.9), trim='night',
                             windows=[('A', 30, 60), ('A', 206, 240), ('B', 140, 170)],
                             decals=[('curtains', 'A', 206, 240, 'plum'), ('curtains', 'B', 140, 170, 'plum'),
                                     ('painting', 'A', 150, 38, 22, 14, 'abstract'), ('clock', 'A', 84, 50, 3.2),
                                     ('painting', 'B', 196, 40, 14, 18, 'portrait'), ('mirror', 'A', 130, 34, 8, 14)])
    floor = lambda i, j: 'carpet_a' if (i < 4 and j < 4) else 'woodfloor_x'
    parts_ = [('x', 112, 0, 256, [(40, 62), (180, 202)]), ('y', 112, 0, 112, [])]
    S = []
    # --- study: desk with the chair behind it, a visitor chair, shelves and files
    S.append(it(D.rug(36, 26, ('navy', 2.2), 'khaki'), '+y', 56, 52, None, z_bias=-300))
    S.append(search(D.ledger_desk(), '+y', 56, 44, ('box', 10, 6, 12), 'STUDY'))
    S.append(it(D.office_chair(), '+y', 56, 30, ('blob', 5)))
    S.append(it(D.wooden_chair(), '-y', 56, 62, ('blob', 4)))
    S.append(it(D.bookshelf(5), '+y', 98, 8, ('box', 14, 6, 32)))
    S.append(it(props2.filing_cabinet(), '+y', 14, 10, ('box', 6, 6, 24)))
    S.append(it(D.plant_tall(2), '+y', 12, 96, ('blob', 6)))
    S.append(it(D.floor_lamp(), '+y', 96, 96, ('blob', 3)))
    # --- bedroom: bed head against the study wall, wardrobe (the search)
    S.append(it(I.bed(), 0.0, 142, 50, ('box', 24, 16, 12)))
    S.append(it(I.nightstand(), '+y', 128, 9, ('box', 5, 5, 12)))
    S.append(it(D.table_lamp(), '+y', 128, 9, None, wz=12.0, z_bias=2))
    S.append(search(I.wardrobe(), '+y', 196, 9, ('box', 11, 7, 30), 'BEDROOM'))
    S.append(it(D.rug(26, 18, ('plum', 2.3), 'stone'), '+y', 196, 70, None, z_bias=-300))
    S.append(it(D.laundry_basket(), '+y', 238, 34, ('blob', 4)))
    S.append(it(D.plant_snake(), '+y', 244, 96, ('blob', 4)))
    # --- living room: TV on the back wall, sofa facing it, an armchair, the dining corner
    S.append(it(D.rug(46, 36, ('teal', 2.2)), '+y', 130, 156, None, z_bias=-300))
    S.append(search(D.tv_stand(), '+y', 130, 121, ('box', 15, 5, 12), 'LIVING ROOM'))
    S.append(it(D.coffee_table(), '+y', 130, 154, ('box', 10, 6, 8)))
    S.append(it(D.sofa(('plum', 2.4)), '-y', 130, 188, ('box', 22, 9, 12)))
    S.append(it(D.armchair(('sage', 2.4)), '+x', 92, 154, ('box', 8, 8, 12)))
    S.append(it(I.table_chairs(), '+y', 218, 166, ('box', 11, 8, 10)))
    S.append(it(D.vase_flowers('teal'), '+y', 218, 164, None, wz=16.8, z_bias=4))
    S.append(alarm('+x', 30, 208))
    S.append(it(D.coat_rack(), '+y', 102, 212, ('blob', 3)))
    S.append(it(D.plant_tall(8), '+y', 244, 212, ('blob', 6)))
    S.append(it(D.floor_lamp(), '+y', 172, 210, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 71, 216, None, z_bias=-300))
    # --- the owner (shown when home and awake)
    S.append(it(ch('char/office_worker', 2, 0.0), 0, 176, 142, ('blob', 6)))
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 60, 82)])


ROOMS = ['house_bungalow', 'house_family', 'house_townhouse']

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drafts', 'interiors')
    for name in sys.argv[1:] or ROOMS:
        c = globals()[name]()
        to_image(c, 1).save(os.path.join(out, f'interior_{name}_1x.png'))
        to_image(c, 3).save(os.path.join(out, f'interior_{name}.png'))
        print(name, c.shape)
