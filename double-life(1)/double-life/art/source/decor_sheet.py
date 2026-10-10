import sys, os, warnings; sys.path.insert(0,'.'); warnings.filterwarnings('ignore')
import numpy as np, time
from sdf import render, to_image
from pixfont import draw_text
import decor as D
t=time.time()
ims=[]; bad=[]
for k,f in D.DECOR.items():
    try:
        img,_,_=render(f()); ims.append((k,img))
    except Exception as e:
        bad.append((k,repr(e)[:120]))
print('rendered',len(ims),'in',round(time.time()-t,1),'s'); print('BAD',bad)
cols=9; cw=max(i.shape[1] for _,i in ims)+6; ch=max(i.shape[0] for _,i in ims)+14
rows=(len(ims)+cols-1)//cols
S=np.zeros((rows*ch+8,cols*cw+8,4),np.uint8); S[...]=(146,141,154,255)
for n,(k,im) in enumerate(ims):
    r,c=divmod(n,cols); h,w=im.shape[:2]
    x=8+c*cw+(cw-w)//2; y=8+r*ch+(ch-12-h)
    sub=S[y:y+h,x:x+w]; m=im[...,3:4]>0; sub[:]=np.where(m,im,sub)
    draw_text(S, 8+c*cw+2, 8+r*ch+ch-10, k.replace('_',' ')[:16].upper(), (45,34,46))
to_image(S,3).save('out/decor_library.png'); print(S.shape)
