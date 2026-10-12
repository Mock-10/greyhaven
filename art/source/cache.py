"""Render-once sprite cache shared by the atlas builder and the scene composer."""
import os, json
import numpy as np
from PIL import Image
from sdf import render

CACHE = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(CACHE, exist_ok=True)


# characters and vehicles are the scale reference (person ~1.75 m = 40 units)
BLD_SCALE = 2.6
PROP_SCALE = {'tree_a': 2.0, 'tree_b': 2.0, 'pine': 2.0, 'lamp': 2.2, 'traffic_light': 2.0, 'street_sign': 1.6,
              'planter': 1.5, 'bench': 1.3, 'bush': 1.4, 'fir': 1.6, 'birch': 1.5}
INT_SCALE = {'desk_paperwork': 1.4, 'cash_register': 1.6, 'safe': 1.2}


def factories():
    import humans, cars, env, props2
    f = {}
    for k, v in humans.COSTUMES.items():
        f['char/' + k] = v
    for k, v in cars.VEHICLES.items():
        f['veh/' + k] = v
    from sdf import scaled
    for k, v in env.BUILDINGS.items():
        f['bld/' + k] = (lambda v: (lambda: scaled(v(), BLD_SCALE)))(v)
    for k, v in props2.PROPS.items():
        s = PROP_SCALE.get(k, 1.0)
        f['prop/' + k] = (lambda v, s: (lambda: scaled(v(), s)))(v, s)
    import street, infill, decor
    for k, v in street.PROPS.items():
        f['prop/' + k] = v
    for k in ('news_box', 'bike_rack', 'street_planter', 'bus_stop_sign'):
        f['prop/' + k] = decor.DECOR[k]
    f['prop/news_box_blue'] = lambda: decor.news_box('navy')
    for k, v in street.DECALS.items():
        f['dec/' + k] = v
    for k, v in street.SEGMENTS.items():
        f['seg/' + k] = v
    import suburb
    for k, v in suburb.PROPS.items():
        f['prop/' + k] = (lambda v, s: (lambda: scaled(v(), s)))(v, PROP_SCALE.get(k, 1.0))
    for k, v in suburb.SEGMENTS.items():
        f['seg/' + k] = v
    for k, v in infill.BUILDINGS.items():
        f['bld/' + k] = (lambda v: (lambda: scaled(v(), BLD_SCALE)))(v)
    for k, v in props2.INTERACT.items():
        s = INT_SCALE.get(k, 1.0)
        f['int/' + k] = (lambda v, s: (lambda: scaled(v(), s)))(v, s)
    return f


def key_name(key, ang_idx, walk=0.0):
    return f"{key.replace('/', '__')}__a{ang_idx}__w{walk:+.1f}"


def get(key, ang_idx=0, walk=0.0, ang=None):
    """Return (rgba, ox, oy). ang_idx counts 45-degree steps unless ang (radians) is given."""
    name = key_name(key, ang_idx if ang is None else int(round(ang * 1000)), walk)
    png = os.path.join(CACHE, name + '.png'); meta = os.path.join(CACHE, name + '.json')
    if os.path.exists(png) and os.path.exists(meta):
        m = json.load(open(meta))
        return np.array(Image.open(png).convert('RGBA')), m['ox'], m['oy']
    fac = factories()[key]
    model = fac(walk) if key.startswith('char/') else fac()
    a = ang if ang is not None else ang_idx * np.pi / 4
    img, ox, oy = render(model, ang=a, outline=not key.startswith('dec/'))   # ground decals have no outline
    Image.fromarray(img, 'RGBA').save(png)
    json.dump({'ox': ox, 'oy': oy}, open(meta, 'w'))
    return img, ox, oy


def _job(args):
    key, ai, w = args
    import warnings; warnings.filterwarnings('ignore')
    get(key, ai, w)
    return key, ai, w


def warm(jobs, procs=2):
    from multiprocessing import Pool
    todo = [j for j in jobs if not os.path.exists(os.path.join(CACHE, key_name(*j) + '.png'))]
    if not todo:
        return
    with Pool(procs) as p:
        for _ in p.imap_unordered(_job, todo):
            pass
