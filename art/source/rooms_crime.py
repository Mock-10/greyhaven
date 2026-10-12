"""Interior drafts for the Phase 3 crime places (M12), built from the recorded answers (docs/04 "Fence": the pawn
shop becomes enterable, run by a new minor character; docs/18 decisions: the police station gets a walkable front
desk in Phase 3):

  pawn       The pawn shop on Overcast Avenue (7 x 5): a glass counter with the fence behind it, display cases of
             watches and rings, shelves of second-hand electronics, guitars and tools, a back door and a safe.
  precinct   Greyhaven PD Precinct 1 lobby (8 x 6): the front desk with the desk sergeant, waiting chairs, the
             notice board of wanted posters, a barred gate to the cells, a camera over the door.

Same conventions as rooms.py. Usage: python3 rooms_crime.py [room ...]
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
from sdf import to_image
import decor as D
import interiors as I
import decor_shops as S2
import props2
import rooms

T = rooms.T
it = rooms.it


def ch(key, idx, walk=0.0):
    return rooms.ch(key, idx, walk)


# ======================================================================= the pawn shop
def pawn():
    W_t, D_t = 7, 5
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('khaki', 2.4), trim='night',
                             windows=[('A', 168, 204)],
                             decals=[('poster', 'A', 30, 46, 14, 10, 'red'), ('clock', 'A', 140, 50, 3.2),
                                     ('poster', 'B', 40, 44, 12, 12, 'gold'), ('warning', 'B', 120, 50),
                                     ('calendar', 'A', 112, 40)])
    floor = lambda i, j: 'linoleum_a'
    S = []
    # --- behind the counter: the stock shelves, the safe, the back door
    S.append(it(D.storage_shelf(3), '+y', 22, 8, ('box', 15, 6, 30)))
    S.append(it(D.storage_shelf(7), '+y', 62, 8, ('box', 15, 6, 30)))
    S.append(it(S2.tool_pegboard(4), '+y', 104, 0))
    S.append(it(D.door_leaf(True, ('wood', 1.8)), '+x', 0, 40, None))
    S.append(it(props2.filing_cabinet(), '+x', 8, 62, ('box', 6, 6, 24)))
    S.append(it(D.cardboard_boxes(3, 4), '+y', 132, 18, ('box', 7, 6, 10)))
    # --- the glass counter with the fence behind it (THE FENCE)
    S.append(it(I.counter_run(96, glass_top=True), '+y', 96, 74, ('box', 48, 7, 14), hl='idle', prompt=('E', 'THE FENCE')))
    S.append(it(D.money_counter(), '+y', 74, 72, None, wz=20.4, z_bias=3))
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 96, 58, ('blob', 6)))
    # --- the shop floor: display cases, second-hand electronics, a guitar corner
    S.append(it(I.counter_run(40, glass_top=True), '-x', 206, 66, ('box', 7, 20, 14)))
    S.append(it(D.tv_stand(), '+x', 9, 118, ('box', 5, 15, 12)))
    S.append(it(D.bookshelf(6), '+x', 8, 146, ('box', 6, 14, 32)))
    S.append(it(S2.display_table(9, 26, 14), '+y', 96, 124, ('box', 13, 7, 13)))
    S.append(it(D.floor_lamp(), '+y', 60, 122, ('blob', 3)))
    # second-hand furniture for sale and a box of odds and ends
    S.append(it(D.armchair(('brick', 2.3)), '-x', 136, 140, ('box', 8, 8, 12)))
    S.append(it(D.side_table(), '-x', 162, 116, ('blob', 4)))
    S.append(it(D.cardboard_boxes(2, 7), '+y', 40, 146, ('box', 7, 6, 10)))
    S.append(it(D.rug(30, 18, ('red', 2.2), 'khaki'), '+y', 120, 140, None, z_bias=-300))
    S.append(it(I.wall_camera(), '+y', 196, 8))
    S.append(it(D.plant_snake(), '+y', 214, 100, ('blob', 4)))
    S.append(it(D.entrance_mat(), '+y', 161, 152, None, z_bias=-300))
    return rooms.compose(W_t, D_t, floor, walls, S, stub_gaps=[('A', 150, 172)])


# ======================================================================= Precinct 1 lobby
def precinct():
    W_t, D_t = 8, 6
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('navy', 2.6), trim='night',
                             windows=[('B', 120, 150)],
                             decals=[('poster', 'A', 124, 48, 24, 10, 'navy'), ('clock', 'A', 200, 52, 3.4),
                                     ('poster', 'A', 36, 44, 10, 12, 'red'), ('poster', 'A', 60, 44, 10, 12, 'red'),
                                     ('exit', 'B', 60, 54), ('calendar', 'A', 236, 40)])
    floor = lambda i, j: 'linoleum_a' if j < 3 else 'marble_a'
    S = []
    # --- the cells beyond the barred gate, filing behind the desk
    S.append(it(D.security_gate(34), '+y', 40, 2, None, z_bias=3))
    S.append(it(props2.filing_cabinet(), '+y', 176, 10, ('box', 6, 6, 24)))
    S.append(it(props2.filing_cabinet(), '+y', 192, 10, ('box', 6, 6, 24)))
    S.append(it(D.server_rack(), '+y', 230, 9, ('box', 7, 6, 30)))
    S.append(it(D.corkboard(), '+y', 96, 0))
    # --- the front desk and the sergeant behind it (FRONT DESK)
    S.append(it(D.reception_desk(56), '+y', 140, 66, ('box', 28, 8, 22), hl='idle', prompt=('E', 'FRONT DESK')))
    S.append(it(D.office_chair(), '+y', 140, 50, ('blob', 5)))
    S.append(it(ch('char/police_officer', 2, 0.0), 0, 140, 50, ('blob', 6)))
    S.append(it(D.desk_clutter(3), '+y', 126, 66, None, wz=22.0, z_bias=3))
    # --- the waiting area
    S.append(it(D.waiting_chairs(3), '+x', 12, 150, ('box', 6, 16, 12)))
    S.append(it(I.water_cooler(), '+x', 10, 108, ('blob', 5)))
    S.append(it(D.plant_tall(4), '+y', 244, 100, ('blob', 6)))
    S.append(it(D.plant_tall(6), '+y', 12, 182, ('blob', 6)))
    S.append(it(D.fire_extinguisher(), '+x', 0, 90))
    S.append(it(D.trash_bin(), '+y', 60, 182, ('blob', 3)))
    S.append(it(D.vending_machine('drinks'), '+x', 12, 52, ('box', 8, 7, 30)))
    S.append(it(D.rug(60, 40, ('navy', 2.2), 'stone'), '+y', 96, 146, None, z_bias=-300))
    S.append(it(D.waiting_chairs(2), '-y', 104, 176, ('box', 12, 6, 12)))
    S.append(it(D.side_table(False), '+x', 12, 120, ('blob', 4)))
    S.append(it(D.news_rack(), '-x', 244, 150, ('box', 6, 10, 18)))
    S.append(it(I.wall_camera(), '+y', 236, 8))
    S.append(it(D.entrance_mat(), '+y', 197, 184, None, z_bias=-300))
    return rooms.compose(W_t, D_t, floor, walls, S, stub_gaps=[('A', 186, 208)])


ROOMS = ['pawn', 'precinct']

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drafts', 'interiors')
    for name in sys.argv[1:] or ROOMS:
        c = globals()[name]()
        to_image(c, 1).save(os.path.join(out, f'interior_{name}_1x.png'))
        to_image(c, 3).save(os.path.join(out, f'interior_{name}.png'))
        print(name, c.shape)
