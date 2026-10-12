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
from sdf import solid, to_image
import numpy as np
from sdf import rbox, RID
import decor as D
import interiors as I
import props2
import rooms
import rooms_houses as RH
import decor_jobs as J
import rooms_jobs as RJ

T = rooms.T
it = rooms.it


def counterfeit_press():
    """The counterfeit press (Phase 5 M16, docs/09): a squat offset printer on a steel cabinet, two inking rollers
    across the top, a feed stack of blank sheets at the back and printed sheets of notes in the out tray at the front.
    FRONT (+y) faces the operator."""
    def parts(P):
        cab = rbox(P, (0, 0, 7.0), (13.0, 7.0, 7.0), 0.8)
        head = rbox(P, (0, -1.0, 16.5), (11.0, 5.0, 2.6), 0.8)
        rollers = np.minimum(J.cyl_x(P, (0, -1.0, 20.0), 1.8, 10.0, 0.3), J.cyl_x(P, (0, 2.6, 19.4), 1.5, 10.0, 0.3))
        feed = rbox(P, (0, -6.6, 16.8), (7.5, 1.6, 2.4), 0.2)
        out_tray = rbox(P, (0, 8.6, 10.6), (8.0, 2.4, 0.4), 0.2)
        out_sheets = rbox(P, (0, 8.6, 11.4), (7.0, 2.0, 0.5), 0.1)
        panel = rbox(P, (10.4, 6.8, 11.0), (2.0, 0.4, 2.2), 0.2)
        wheel = J.cyl_x(P, (13.6, 0, 12.0), 3.0, 0.5, 0.2)
        return [cab, head, rollers, feed, np.minimum(out_tray, panel), out_sheets, wheel]

    def pm(p, n):
        lit = (n[:, 1] > 0.5) & (np.abs(p[:, 0] - 10.4) < 1.4) & (np.abs(p[:, 2] - 11.4) < 0.6)
        return (np.where(lit, RID['red'], RID['night']), np.where(lit, 4.4, 2.0), np.zeros(len(p)))
    return D.M(parts, [solid('blueg', 2.2, 0.4), solid('stone', 3.0, 0.5), solid('night', 1.6, 0.6),
                       solid('white', 4.4), pm, D._billm(3), solid('stone', 2.4, 0.4)], (-16, 16, -9, 12, 0, 23))


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
    # --- the counterfeit press (M16) by the stash room, with a counting table for the fresh notes
    S.append(it(counterfeit_press(), '+y', 132, 60, ('box', 13, 8, 20), hl='idle', prompt=('E', 'PRESS'),
                needs='press'))
    S.append(it(D.counting_table(), '+y', 196, 66, ('box', 14, 7, 15), needs='press'))
    S.append(it(D.loose_bills(), '+y', 190, 66, None, wz=15.6, z_bias=3, needs='press'))
    S.append(it(D.cardboard_boxes(2, 17), '+y', 128, 62, ('box', 7, 6, 10), needs='!press'))
    # --- the chop bay (M16) on the marked floor below the roll door: a car on a lift, stripped bit by bit
    S.append(it(J.lift_post(), '+x', 241, 60, ('box', 4, 4, 50), needs='chopBay'))
    S.append(it(J.lifted_car(('brick', 2.4)), RJ.CAR_ALONG_Y, 266, 60, None, wz=RJ.LIFT_H, hl='idle',
                prompt=('E', 'CHOP BAY'), needs='chopBay'))
    S.append(it(J.lift_post(), '-x', 291, 60, ('box', 4, 4, 50), needs='chopBay'))
    S.append(it(J.engine_stand(), '+y', 244, 112, ('blob', 7), needs='chopBay'))
    S.append(it(J.tyre_stack(4, 6), '+y', 292, 138, ('blob', 7), needs='chopBay'))
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
        drafts = ({'': {'stashRoom', 'workbench', 'press', 'chopBay'}, '_bare': set()} if name == 'hideout'
                  else {'': None})
        for suffix, have in drafts.items():
            c = globals()[name](have) if name == 'hideout' else globals()[name]()
            to_image(c, 1).save(os.path.join(out, f'interior_{name}{suffix}_1x.png'))
            to_image(c, 3).save(os.path.join(out, f'interior_{name}{suffix}.png'))
            print(name + suffix, c.shape)
