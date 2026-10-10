import sys, time; sys.path.insert(0,'.')
import warnings; warnings.filterwarnings('ignore')
import cache
f=cache.factories()
jobs=[]
for k in f:
    if k.startswith('char/'):
        for a in range(8):
            for w in (0.0, 0.6, -0.6):
                jobs.append((k,a,w))
    elif k.startswith('veh/'):
        for a in range(8): jobs.append((k,a,0.0))
    elif k in ('bld/house_brick','bld/house_slate','bld/container_brick','bld/container_teal','bld/container_khaki'):
        for a in (0,2): jobs.append((k,a,0.0))
    else:
        jobs.append((k,0,0.0))
t=time.time()
cache.warm(jobs, 2)
print(len(jobs),'sprites in',round(time.time()-t),'s')
