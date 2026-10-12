"""Interior drafts for the Phase 2 job sites (M7), built from the recorded answers in docs/03 and docs/18:

  garage        Torque & Sons Garage: one bay with a two-post lift and a toolbench, a spray booth,
                a small office to clock in, staff lockers, a tyre corner. 08:00-18:00, 1-2 coworkers.
  depot         Swiftish Couriers depot: customer counter, sorting floor (racks, conveyor, sorting tables,
                roll cages), the van bay door, a staff room with lockers and the clock.
  site_trailer  Ashby Timber site trailer: crew room (lockers, hard hats and vests, plan table, felling map,
                chainsaws, boots) and the foreman's end with the clock-in desk.

Same conventions as rooms.py (W along x with back wall A at y=0, D along y with back wall B at x=0, 32 units = 1 tile,
every model's front is local +y). The drafts go through rooms.compose / rooms.ch by attribute so check_layout.py and
export_interiors.py can intercept them exactly like the Phase 1 rooms.

Usage: python3 rooms_jobs.py [room ...]   (default: all three; writes ../drafts/interiors/interior_<room>[_1x].png)
"""
import os, sys, warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings('ignore')
import numpy as np
from sdf import to_image
import decor as D
import interiors as I
import props2
import rooms
import decor_jobs as J

T = rooms.T
it = rooms.it
CAR_ALONG_Y = np.pi / 2          # cars.sedan's nose is local +x; this points it at +y (toward the bay door)
LIFT_H = 12.0                    # how high the lift holds the car


def ch(key, idx, walk=0.0):
    return rooms.ch(key, idx, walk)


# ======================================================================= Torque & Sons Garage
def garage():
    W_t, D_t = 11, 8
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('stone', 2.5), trim='night',
                             windows=[('B', 26, 66)],
                             decals=[('calendar', 'A', 50, 40), ('clock', 'A', 76, 50, 3.4),
                                     ('calendar', 'A', 166, 40), ('clock', 'A', 206, 54, 3.4),
                                     ('exit', 'B', 236, 54), ('calendar', 'B', 176, 42)])
    # office and spray booth have a clean floor, the rest is shop concrete
    floor = lambda i, j: ('linoleum_a' if (i < 3 and j < 3) or (i >= 8 and j < 4) else 'concrete_a')
    parts_ = [('x', 96, 0, 96, [(58, 80)]), ('y', 96, 0, 96, []),
              ('y', 256, 0, 128, []), ('x', 128, 256, 352, [(270, 340)])]
    S = []
    # --- office: clock on the wall, the owner's desk with a visitor chair facing it
    S.append(it(J.time_clock(), '+y', 22, 0, None, hl='idle', prompt=('E', 'CLOCK IN')))
    S.append(it(D.rug(36, 26, ('red', 2.0), 'khaki'), '+y', 54, 46, None, z_bias=-300))
    S.append(it(D.ledger_desk(), '+y', 54, 40, ('box', 10, 6, 12)))
    S.append(it(D.office_chair(), '+y', 54, 27, ('blob', 5)))
    S.append(it(D.wooden_chair(), '-y', 54, 57, ('blob', 4)))
    S.append(it(props2.filing_cabinet(), '+y', 84, 10, ('box', 6, 6, 24)))
    S.append(it(I.water_cooler(), '+x', 10, 84, ('blob', 5)))
    S.append(it(D.side_table(False), '-x', 86, 54, ('blob', 4)))
    S.append(it(D.coffee_machine(), '-x', 86, 54, None, wz=12.1, z_bias=2))
    S.append(it(D.plant_snake(), '+y', 86, 84, ('blob', 4)))
    S.append(it(D.trash_bin(), '+y', 22, 30, ('blob', 3)))
    # --- staff corner: lockers, bench, coats, vending
    S.append(it(J.lockers(4, ('teal', 2.3)), '+x', 6, 132, ('box', 6, 18, 40), hl='idle', prompt=('E', 'LOCKER')))
    S.append(it(J.locker_bench(30), '+x', 28, 132, ('box', 4, 15, 8)))
    S.append(it(D.coat_rack(), '+y', 12, 166, ('blob', 3)))
    S.append(it(J.wall_poster('teal', 10, 14, 3), '+x', 0, 104))
    S.append(it(D.fire_extinguisher(), '+x', 0, 186))
    S.append(it(J.first_aid(), '+x', 0, 206))
    S.append(it(D.vending_machine('snacks'), '+x', 12, 224, ('box', 8, 7, 30)))
    S.append(it(D.trash_bin(), '+y', 84, 108, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 32, 248, None, z_bias=-300))
    # --- the bay: lift with a customer car, toolbench and pegboard, tool chest, parts shelf
    S.append(it(J.sign_board(44, 'navy', 54), '+y', 126, 0))
    S.append(it(J.pegboard(34, 18), '+y', 126, 0))
    S.append(it(J.workbench(44), '+y', 126, 9, ('box', 22, 7, 17)))
    S.append(it(J.tool_chest('red'), '+y', 166, 10, ('box', 10, 6, 28)))
    S.append(it(D.storage_shelf(5), '+y', 206, 8, ('box', 15, 6, 30)))
    S.append(it(J.hose_reel(), '+y', 240, 0))
    S.append(it(J.oil_stain(1, 10), '+y', 178, 112, None, z_bias=-300))
    S.append(it(J.oil_stain(4, 8), '+y', 122, 206, None, z_bias=-300))
    S.append(it(J.oil_stain(7, 7), '+y', 214, 186, None, z_bias=-300))
    S.append(it(J.lift_post(), '+x', 151, 100, ('box', 4, 4, 50)))
    S.append(it(J.drain_pan(), '+y', 176, 136, ('blob', 5), z_bias=-40))
    S.append(it(J.lifted_car(('teal', 2.6)), CAR_ALONG_Y, 176, 100, None, wz=LIFT_H, hl='idle', prompt=('E', 'TORQUE BOLTS')))
    S.append(it(J.lift_post(), '-x', 201, 100, ('box', 4, 4, 50)))
    S.append(it(J.diag_cart(), '-x', 226, 88, ('box', 6, 5, 22), hl='idle', prompt=('E', 'DIAGNOSE')))
    S.append(it(J.floor_jack(), '-x', 228, 136, ('blob', 4)))
    S.append(it(J.creeper(), '+y', 128, 150, None))
    S.append(it(J.tyre_stack(3, 2), '+y', 116, 214, ('blob', 7)))
    S.append(it(J.engine_stand(), '+y', 70, 196, ('blob', 7)))
    S.append(it(J.oil_stain(9, 6), '+y', 72, 210, None, z_bias=-300))
    S.append(it(J.drain_pan(), '+y', 96, 176, ('blob', 5)))
    S.append(it(D.cardboard_boxes(2, 6), '+y', 114, 240, ('box', 7, 6, 10)))
    # --- spray booth: a car being masked, the paint station, extractor fan
    S.append(it(J.booth_fan(), '+y', 304, 0))
    S.append(it(J.wall_poster('navy', 10, 12, 5, 36), '+y', 336, 0))
    S.append(it(J.masked_car(('sage', 2.4)), CAR_ALONG_Y, 306, 64, ('box', 18, 44, 14)))
    S.append(it(J.paint_station(), '+x', 270, 58, ('box', 6, 11, 14), hl='idle', prompt=('E', 'RESPRAY')))
    S.append(it(J.masking_stand(), '+x', 268, 104, ('blob', 4)))
    # --- tyre corner
    S.append(it(J.tyre_changer(), '-x', 300, 180, ('box', 8, 8, 20), hl='idle', prompt=('E', 'CHANGE TYRE')))
    S.append(it(J.tyre_rack(4), '-x', 340, 212, ('box', 7, 14, 16)))
    S.append(it(J.tyre_stack(4, 1), '+y', 338, 152, ('blob', 7)))
    S.append(it(J.air_compressor(), '-y', 280, 238, ('blob', 6)))
    S.append(it(props2.barrel('red'), '+y', 340, 242, ('blob', 6)))
    S.append(it(props2.barrel('teal'), '+y', 322, 244, ('blob', 6)))
    # --- people: the owner at the desk, a mechanic at the diagnostic cart
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 54, 25, ('blob', 6)))
    S.append(it(ch('char/road_worker', 4, 0.0), 0, 214, 116, ('blob', 6)))
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 20, 44), ('A', 140, 220)])


# ======================================================================= Swiftish Couriers depot
def depot():
    W_t, D_t = 10, 8
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('white', 2.4), trim='night',
                             windows=[('B', 60, 78), ('B', 222, 252)],
                             decals=[('clock', 'A', 100, 50, 3.4), ('calendar', 'A', 102, 36),
                                     ('exit', 'A', 300, 52), ('clock', 'B', 170, 52, 3.2)])
    floor = lambda i, j: ('linoleum_a' if i * T < 112 else 'concrete_a')
    parts_ = [('y', 112, 0, 256, [(40, 62), (120, 142)]), ('x', 112, 0, 112, [(70, 92)])]
    S = []
    # --- staff room: lockers and bench, the clock, a route map, the break table
    S.append(it(J.lockers(5, ('navy', 2.5)), '+y', 34, 7, ('box', 22, 6, 40), hl='idle', prompt=('E', 'LOCKER')))
    S.append(it(J.locker_bench(30), '+y', 34, 26, ('box', 15, 4, 8)))
    S.append(it(J.time_clock(), '+y', 74, 0, None, hl='idle', prompt=('E', 'CLOCK IN')))
    S.append(it(J.wall_map('route', 28, 18), '+x', 0, 34))
    S.append(it(I.table_chairs(), '+y', 64, 76, ('box', 11, 8, 10)))
    S.append(it(D.bowl_fruit(), '+y', 62, 74, None, wz=16.8, z_bias=4))
    S.append(it(D.vending_machine('soda'), '+x', 10, 92, ('box', 8, 7, 30)))
    S.append(it(D.side_table(False), '-x', 100, 26, ('blob', 4)))
    S.append(it(D.coffee_machine(), '-x', 100, 26, None, wz=12.1, z_bias=2))
    S.append(it(D.plant_snake(), '+y', 100, 100, ('blob', 4)))
    # --- front counter: the counter faces the customers, parcels for pickup behind it
    S.append(it(J.parcel_rack(32, 4), '+x', 8, 136, ('box', 7, 16, 40)))
    S.append(it(D.reception_desk(56), '+y', 60, 168, ('box', 28, 8, 22)))
    S.append(it(J.parcel_scale(), '+y', 42, 166, None, wz=17.8, z_bias=4))
    S.append(it(J.parcels(3, 9, 4), '+y', 86, 132, ('blob', 6)))
    S.append(it(J.wall_poster('red', 12, 14, 2), '+x', 0, 176))
    S.append(it(J.drop_box(), '+x', 10, 198, ('box', 6, 5, 20)))
    S.append(it(D.waiting_chairs(2), '-x', 102, 220, ('box', 6, 12, 12)))
    S.append(it(D.plant_tall(4), '+y', 100, 188, ('blob', 6)))
    S.append(it(D.plant_tall(8), '+y', 12, 240, ('blob', 6)))
    S.append(it(D.trash_bin(), '+y', 86, 244, ('blob', 3)))
    S.append(it(D.entrance_mat(), '+y', 52, 248, None, z_bias=-300))
    S.append(it(D.door_leaf(False, ('lavlt', 2.4)), '-x', 112, 131, None, z_bias=3))
    # --- sorting floor: racks, the van bay, conveyor and sorting tables, cages and pallets
    S.append(it(J.parcel_rack(40, 2), '+y', 140, 9, ('box', 20, 7, 40)))
    S.append(it(J.parcel_rack(40, 6), '+y', 186, 9, ('box', 20, 7, 40)))
    S.append(it(D.fire_extinguisher(), '+y', 218, 0))
    S.append(it(J.sign_board(44, 'teal', 56), '+y', 256, 0))
    S.append(it(J.floor_lines(48, 40, 'white'), '+y', 256, 32, None, z_bias=-300))
    S.append(it(J.roll_door(48, 44, 30), '+y', 256, 0, None, hl='idle', prompt=('E', 'LOAD VAN')))
    S.append(it(J.hand_truck(), '+y', 304, 12, ('blob', 5)))
    S.append(it(J.roll_cage(3, 3), '+y', 218, 70, ('box', 8, 6, 30)))
    S.append(it(J.roll_cage(8, 2), '+y', 296, 70, ('box', 8, 6, 30)))
    S.append(it(J.conveyor(96, 6), '+y', 190, 120, ('box', 48, 6, 13)))
    S.append(it(J.sort_table(40), '+y', 168, 158, ('box', 20, 7, 16)))
    S.append(it(J.sort_table(40), '+y', 248, 158, ('box', 20, 7, 16)))
    S.append(it(J.pallet_load(4), '+y', 300, 134, ('box', 10, 8, 22)))
    S.append(it(J.pallet_load(9), '+y', 300, 200, ('box', 10, 8, 22)))
    S.append(it(J.roll_cage(5, 4), '-y', 180, 222, ('box', 8, 6, 30)))
    S.append(it(J.parcels(7, 3, 10), '+y', 142, 206, ('blob', 10)))
    S.append(it(J.pallet_load(12), '+y', 232, 230, ('box', 10, 8, 22)))
    S.append(it(J.parcels(6, 11, 9), '+y', 266, 236, ('blob', 9)))
    S.append(it(J.hand_truck(), '-x', 216, 196, ('blob', 5)))
    S.append(it(D.trash_bin('teal'), '+y', 128, 98, ('blob', 3)))
    # --- people: the clerk, a customer, a courier at the sorting table, one loading at the bay, one on break
    S.append(it(ch('char/civilian_b', 2, 0.0), 0, 60, 150, ('blob', 6)))
    S.append(it(ch('char/civilian_a', 6, 0.0), 0, 56, 204, ('blob', 6)))
    S.append(it(ch('char/road_worker', 6, 0.0), 0, 172, 176, ('blob', 6)))
    S.append(it(ch('char/office_worker', 6, 0.6), 0, 256, 76, ('blob', 6)))
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 40, 64)])


# ======================================================================= Ashby Timber site trailer
def site_trailer():
    W_t, D_t = 9, 4
    W, D_ = W_t * T, D_t * T
    walls = rooms.back_walls(W, D_, paper=('wood', 2.9), trim='night',
                             windows=[('A', 104, 140), ('A', 226, 244), ('B', 14, 46)],
                             decals=[('calendar', 'A', 256, 40), ('clock', 'A', 276, 52, 3.2), ('exit', 'B', 110, 54)])
    floor = lambda i, j: 'linoleum_a'
    parts_ = [('y', 208, 0, 128, [(70, 92)])]
    S = []
    # --- crew room: lockers and bench, hard hats and vests, the felling map, plan table, saws and boots
    S.append(it(J.lockers(4, ('sage', 2.4)), '+y', 30, 7, ('box', 18, 6, 40), hl='idle', prompt=('E', 'LOCKER')))
    S.append(it(J.locker_bench(30), '+y', 30, 26, ('box', 15, 4, 8)))
    S.append(it(J.gear_wall(4), '+y', 78, 0))
    S.append(it(J.wall_map('forest', 32, 18), '+y', 172, 0))
    S.append(it(J.first_aid(), '+x', 0, 72))
    S.append(it(D.fire_extinguisher(), '+x', 0, 58))
    S.append(it(J.wall_poster('teal', 10, 12, 4, 40), '+x', 0, 116))
    S.append(it(D.armchair(('brick', 2.2)), '+x', 34, 78, ('box', 8, 8, 12)))
    S.append(it(J.chainsaw_rack(), '+x', 8, 94, ('box', 8, 11, 16)))
    S.append(it(J.plan_table(), '+y', 128, 66, ('box', 14, 8, 16)))
    S.append(it(D.wooden_chair(), '+y', 128, 48, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 118, 84, ('blob', 4)))
    S.append(it(D.wooden_chair(), '-y', 138, 84, ('blob', 4)))
    S.append(it(J.space_heater(), '-x', 66, 74, ('blob', 4)))
    S.append(it(J.boot_tray(), '+y', 70, 116, None))
    S.append(it(D.entrance_mat(), '+y', 112, 122, None, z_bias=-300))
    S.append(it(D.trash_bin(), '+y', 90, 118, ('blob', 3)))
    S.append(it(D.coat_rack(), '+y', 160, 112, ('blob', 3)))
    S.append(it(I.water_cooler(), '+y', 196, 14, ('blob', 5)))
    S.append(it(D.side_table(False), '-x', 196, 112, ('blob', 4)))
    S.append(it(D.coffee_machine(), '-x', 196, 112, None, wz=12.1, z_bias=2))
    # --- the foreman's end: clock-in desk facing the door, visitor chair, files, radio
    S.append(it(D.ledger_desk(), '-x', 258, 64, ('box', 6, 10, 12), hl='idle', prompt=('E', 'CLOCK IN')))
    S.append(it(J.site_radio(), '-x', 256, 56, None, wz=15.8, z_bias=4))
    S.append(it(D.office_chair(), '-x', 274, 64, ('blob', 5)))
    S.append(it(D.wooden_chair(), '+x', 238, 64, ('blob', 4)))
    S.append(it(props2.filing_cabinet(), '+y', 276, 10, ('box', 6, 6, 24)))
    S.append(it(J.wall_poster('sage', 10, 14, 7), '+y', 214, 0))
    S.append(it(D.plant_snake(), '+y', 278, 116, ('blob', 4)))
    # --- people: the foreman behind the desk, a crew hand at the plan table
    S.append(it(ch('char/civilian_b', 4, 0.0), 0, 276, 64, ('blob', 6)))
    S.append(it(ch('char/road_worker', 6, 0.0), 0, 150, 92, ('blob', 6)))
    return rooms.compose(W_t, D_t, floor, walls, S, partitions=parts_, stub_gaps=[('A', 100, 124)])


ROOMS = ['garage', 'depot', 'site_trailer']

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'drafts', 'interiors')
    for name in sys.argv[1:] or ROOMS:
        c = globals()[name]()
        to_image(c, 1).save(os.path.join(out, f'interior_{name}_1x.png'))
        to_image(c, 3).save(os.path.join(out, f'interior_{name}.png'))
        print(name, c.shape)
