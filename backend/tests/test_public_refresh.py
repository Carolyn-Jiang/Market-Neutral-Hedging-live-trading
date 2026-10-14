import sys,unittest
from pathlib import Path
from datetime import datetime
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from local_refresh import build_public
class PublicRefreshTests(unittest.TestCase):
    def test_private_fields_removed(self):
        s={'settled':['r1'],'teams':{'private-id':{'name':'A','equity':1.03,'stock1':'NVDA','action':'LS','token_hash':'secret','history':[{'round':1,'cumulative_return':.03,'action':'LS'}]}},'audit':[{'secret':'private'}]}
        b=build_public(s,datetime.fromisoformat('2026-10-15T12:00:00-04:00'))
        self.assertEqual(set(b['rows'][0]),{'team_name','cumulative_return','is_baseline'})
        self.assertFalse(b['final'])
    def test_final_requires_time_and_all_rounds(self):
        s={'settled':list(range(12)),'teams':{'id':{'name':'A','equity':1.01,'history':[{'round':12,'cumulative_return':.01,'stock1':'private'}]}}}
        self.assertFalse(build_public(s,datetime.fromisoformat('2026-10-16T09:59:00-04:00'))['final'])
        b=build_public(s,datetime.fromisoformat('2026-10-16T10:00:00-04:00'))
        self.assertTrue(b['final']);self.assertNotIn('stock1',b['rows'][0]['history'][-1])
