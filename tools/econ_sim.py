# Double Life — expected-value economy pacing sim. Run: python3 tools/econ_sim.py
# Keep these constants in sync with src/config/balance.ts and docs/02_economy.md.
PAY=[180,260,370,510,700]; XPNEED=[40,70,110,160]; BONUS=[250,500,900,1500]
GIG=0.6; GIG_TIPS=0.1                     # weekend odd jobs: 60% of shift pay, tips at a typical 'good'
GIGS_PER_DAY={'civ':2,'mix':1,'crim':0}  # civ works the car wash and the bar shift; mix only the car wash (nights are crime)
RENT_DAY=350/7; UPKEEP_DAY=20
REP_T=[0,400,1800,5000,11000]
NIGHT_DIRTY=[400,750,1500,3000,5500]
DAY_CRIME_MULT=0.5
RISK=[0.12,0.15,0.18,0.22,0.25]
LAUNDER=[0.35,0.35,0.25,0.25,0.25]; LCAP=[1500,1500,3000,3000,3000]
FRONT_CUT=0.12; FRONT_CAP=6000; FRONT_COST=25000
DIRTY_SPEND=0.15                        # share of dirty spent directly (black-market gear, crew wages, supplies)
def tier(rep): return max(i for i,t in enumerate(REP_T) if rep>=t)
def run(mode, days=42, xps=11):
    clean=150; dirty=0; rank=0; xp=0; rep=0; front=False; log={}
    for d in range(1,days+1):
        wk = d%7 in (6,0)
        if mode in('civ','mix'):
            if not wk:
                clean+=PAY[rank]; xp+=xps
                if rank<4 and xp>=XPNEED[rank]: xp-=XPNEED[rank]; clean+=BONUS[rank]; rank+=1
            else: clean+=PAY[rank]*GIG*(1+GIG_TIPS)*GIGS_PER_DAY[mode]
        nights = {'civ':0,'mix':1,'crim':1+DAY_CRIME_MULT}[mode]
        if nights:
            t=tier(rep); g=NIGHT_DIRTY[t]*nights
            rep+=g/6+20*nights
            dirty+=g*(1-RISK[t]-DIRTY_SPEND)
            cap=FRONT_CAP if front else LCAP[t]; cut=FRONT_CUT if front else LAUNDER[t]
            x=min(dirty,cap); dirty-=x; clean+=x*(1-cut)
            if not front and t>=3 and clean>FRONT_COST*1.2: clean-=FRONT_COST; front=True; log.setdefault('front',d)
        if mode=='civ' and d%7==0: clean+=0.15*PAY[rank]*5   # clean-record weekly bonus
        clean-=RENT_DAY+(12 if mode=='civ' else UPKEEP_DAY)
        for m in (1500,5000,12000,18000,45000):
            if clean>=m: log.setdefault(f'${m}',d)
        for i,n in enumerate(['','Hustler','Known','Connected','Boss']):
            if i and rep>=REP_T[i]: log.setdefault(n,d)
        if rank: log.setdefault(f'rank{rank+1}',d)
    return round(clean),round(dirty),rank+1,tier(rep),log
for m in ('civ','mix','crim'):
    c,dd,r,t,log=run(m); print(f'{m:5} day42 clean {c:>7} dirty {dd:>6} rank {r} tier {t}'); print('      ',log)
# per real-hour income at stage (gross)
print('civ rank1 per real hour', round(PAY[0]*5/7*3), ' crime T0 per real hour', round(NIGHT_DIRTY[0]*(1+DAY_CRIME_MULT)*(1-0.35-0.15)*3))
