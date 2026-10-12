"""Interior drafts for the property you own (Phase 5, docs/09), built from the recorded answers in docs/18 (decisions
2026-10-11: "Hideouts: one big space with stations, plus buyable locked rooms"; homes have a bed, a wardrobe, a stash
and the add-on rooms):

  home_small   the bungalow (rooms_houses.py) as your home: the bed sleeps and saves, the wardrobe changes outfits,
               a loose floorboard is the stash, and a door in the bedroom leads down to the hideout.
  home_family  the family house the same way.
  hideout      the basement garage under either house (10 x 7, concrete): the stairs up, the plans table where
               add-ons are bought, a lounge corner, the roll door to the driveway ramp, and the stations, each shown
               only once its add-on is bought (`needs`): the stash room behind a locked door, the workbench. The
               operations (press, chop bay, lab) and the crew room come in later milestones.

Items carry needs='<addon>' (shown only with it) or needs='!<addon>' (shown only without it); the game filters them
when you walk in. Same conventions as rooms.py. Usage: python3 rooms_property.py [room ...]
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
from sdf import to_image
import decor as D
import interiors as I
import props2
import rooms
import rooms_houses as RH
import decor_jobs as J

T = rooms.T
it = rooms.it


def home_small():
    RH.HOME['on'] = True
    try:
        return RH.house_bungalow()
    finally:
        RH.HOME['on'] = False


def home_family():
    RH.HOME['on'] = True
    try:
        return RH.house_family()
    finally:
        RH.HOME['on'] = False


def built(S, have):
    """Drop the items a draft with these add-ons wouldn't show (None keeps everything, for the export)."""
    if have is None:
        return S
    out = []
    for item in S:
        need = item[5].get('needs')
        if need and (need[1:] in have if need.startswith('!') else need not in have):
            continue
        out.append(item)
    return out


def hideout(have=None):
    W_t, D_t = 10, 7
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('stone', 2.2), trim='night',
                             decals=[('poster', 'A', 226, 46, 12, 12, 'red'), ('calendar', 'A', 124, 40),
                                     ('warning', 'B', 140, 50), ('fusebox', 'B', 116, 36)])
    floor = lambda i, j: 'concrete_a'
    # the stash room: a locked room in the back-left corner, its door in the front wall
    parts_ = [('y', 112, 0, 96, []), ('x', 96, 0, 112, [(42, 64)])]
    S = []
    # --- the stash room (the add-on opens the door; its shelves fill with the stash)
    S.append(it(D.door_leaf(True, ('night', 2.4)), '+y', 53, 96, None, z_bias=3))
    S.append(it(D.storage_shelf(3), '+y', 24, 8, ('box', 15, 6, 30)))
    S.append(it(D.storage_shelf(8), '+y', 64, 8, ('box', 15, 6, 30)))
    S.append(it(D.cardboard_boxes(3, 5), '+x', 12, 52, ('box', 7, 6, 10), needs='!stashRoom'))
    S.append(it(props2.safe(), '+x', 12, 56, ('box', 8, 8, 14), hl='idle', prompt=('E', 'STASH ROOM'), needs='stashRoom'))
    S.append(it(D.cash_duffel(), '+y', 84, 40, ('box', 8, 5, 6), needs='stashRoom'))
    S.append(it(D.cardboard_boxes(2, 9), '+y', 92, 70, ('box', 7, 6, 10)))
    # --- the stairs up to the house, the fuse box, the heater
    S.append(it(D.door_leaf(True, ('wood', 2.0)), '+x', 0, 176, None, hl='idle', prompt=('E', 'UPSTAIRS'), z_bias=3))
    S.append(it(D.fire_extinguisher(), '+x', 0, 150))
    S.append(it(J.space_heater(), '+x', 12, 206, ('blob', 5)))
    S.append(it(D.trash_bin(), '+x', 12, 128, ('blob', 3)))
    # --- the workbench along wall A (the add-on); junk there before it's bought
    S.append(it(J.pegboard(34, 18), '+y', 150, 0, needs='workbench'))
    S.append(it(J.workbench(44), '+y', 150, 9, ('box', 22, 7, 17), hl='idle', prompt=('E', 'WORKBENCH'), needs='workbench'))
    S.append(it(J.tool_chest('red'), '+y', 190, 10, ('box', 10, 6, 28), needs='workbench'))
    S.append(it(D.storage_shelf(6), '+y', 146, 8, ('box', 15, 6, 30), needs='!workbench'))
    S.append(it(D.cardboard_boxes(3, 11), '+y', 182, 16, ('box', 7, 6, 10), needs='!workbench'))
    S.append(it(J.tyre_stack(3, 4), '+y', 210, 16, ('blob', 7)))
    # --- the roll door up the ramp to the driveway, oil on the floor
    S.append(it(J.roll_door(48, 44, 0), '+y', 266, 0, None))
    S.append(it(J.floor_lines(56, 70, 'white'), '+y', 266, 60, None, z_bias=-300))
    S.append(it(J.oil_stain(3, 9), '+y', 262, 70, None, z_bias=-300))
    S.append(it(J.oil_stain(8, 6), '+y', 230, 120, None, z_bias=-300))
    S.append(it(J.drain_pan(), '+y', 296, 110, ('blob', 5)))
    S.append(it(props2.crate(5), '+y', 236, 200, ('box', 8, 8, 14)))
    S.append(it(D.cardboard_boxes(3, 15), '+y', 208, 212, ('box', 7, 6, 10)))
    # --- the plans table: buy add-ons here
    S.append(it(J.plan_table(), '+y', 176, 126, ('box', 14, 9, 14), hl='idle', prompt=('E', 'PLANS')))
    S.append(it(D.wooden_chair(), '-y', 176, 150, ('blob', 4)))
    # --- a lounge corner at the front: an old sofa, a TV on crates, a rug
    S.append(it(D.rug(36, 24, ('plum', 2.0), 'stone'), '+y', 84, 184, None, z_bias=-300))
    S.append(it(D.sofa(('brick', 2.0)), '+y', 84, 164, ('box', 22, 9, 12)))
    S.append(it(D.coffee_table(), '+y', 84, 186, ('box', 10, 6, 8)))
    S.append(it(D.floor_lamp(), '+y', 50, 160, ('blob', 3)))
    S.append(it(D.cardboard_boxes(2, 13), '+y', 128, 208, ('box', 7, 6, 10)))
    S.append(it(D.storage_shelf(9), '-x', 311, 178, ('box', 6, 15, 30)))
    S.append(it(props2.barrel('teal'), '+y', 304, 214, ('blob', 6)))
    return rooms.compose(W_t, D_t, floor, walls, built(S, have), partitions=parts_)


ROOMS = ['home_small', 'home_family', 'hideout']

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drafts', 'interiors')
    for name in sys.argv[1:] or ROOMS:
        drafts = {'': {'stashRoom', 'workbench'}, '_bare': set()} if name == 'hideout' else {'': None}
        for suffix, have in drafts.items():
            c = globals()[name](have) if name == 'hideout' else globals()[name]()
            to_image(c, 1).save(os.path.join(out, f'interior_{name}{suffix}_1x.png'))
            to_image(c, 3).save(os.path.join(out, f'interior_{name}{suffix}.png'))
            print(name + suffix, c.shape)
