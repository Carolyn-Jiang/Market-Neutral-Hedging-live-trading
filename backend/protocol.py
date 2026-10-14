from datetime import datetime,timedelta,timezone
from zoneinfo import ZoneInfo
NY=ZoneInfo('America/New_York')
TICKERS=['NVDA','GOOG','META','MSFT','JPM','AMZN','AAPL','AMD','WMT','TSLA']
TIMES=[(9,30),(10,30),(11,30),(12,30),(14,30),(15,30)]
RELEASES=[datetime(2026,10,day,h,m,tzinfo=NY) for day in (14,15) for h,m in TIMES]
CUTOFF=datetime(2026,10,16,8,tzinfo=NY)
TERMINAL=datetime(2026,10,16,9,30,tzinfo=NY)
FINAL=datetime(2026,10,16,10,tzinfo=NY)
def round_id(i):return RELEASES[i].strftime('%Y-%m-%d_%H:%M')
def deadline(i):return RELEASES[i+1]-timedelta(minutes=5) if i<11 else CUTOFF
def news_start(i):return (RELEASES[i]-timedelta(days=1)).replace(hour=15,minute=30) if i%6==0 else RELEASES[i-1]
def valid_action(p):return p.get('stock1') in TICKERS and p.get('stock2') in TICKERS and p['stock1']!=p['stock2'] and p.get('action') in ('LS','SL','F')
def pair_return(action,entry,exit_prices):
    if not action or action['action']=='F':return 0.0
    a,b=action['stock1'],action['stock2']
    direction=1 if action['action']=='LS' else -1
    return direction*0.5*((exit_prices[a]/entry[a]-1)-(exit_prices[b]/entry[b]-1))
