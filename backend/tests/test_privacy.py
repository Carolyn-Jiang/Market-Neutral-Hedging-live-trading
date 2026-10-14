import os,sys,json,asyncio,unittest,copy
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('STORE_REPO','test/private');os.environ.setdefault('PUBLIC_ORIGIN','https://carolyn-jiang.github.io')
import server
from fastapi import HTTPException
from protocol import RELEASES,deadline,round_id

class Request:
    def __init__(self,p):self.p=p
    async def body(self):return json.dumps(self.p).encode()

class PrivacyTests(unittest.TestCase):
    def setUp(self):
        self.state={'published':{round_id(0):{}},'teams':{},'submissions':{},'audit':[],'settled':[],'frozen':{},'baseline_actions':{}}
        self.instant=RELEASES[0]
        self.read=patch.object(server,'read_state',lambda:copy.deepcopy(self.state));self.read.start()
        def save(s,files=None):self.state=s
        self.save=patch.object(server,'save_state',save);self.save.start()
        self.clock=patch.object(server,'now',lambda:self.instant);self.clock.start()
    def tearDown(self):patch.stopall()
    def test_receipt_and_identity(self):
        p={'team_name':'Team Test','stock1':'NVDA','stock2':'GOOG','action':'LS','round_id':round_id(0)}
        receipt=asyncio.run(server.submit(Request(p),None))
        self.assertTrue(receipt['accepted']);self.assertIn('team_token',receipt)
        self.assertNotIn('stock1',receipt);self.assertNotIn('action',receipt)
        with self.assertRaises(HTTPException) as e:asyncio.run(server.submit(Request(p),None))
        self.assertEqual(e.exception.status_code,403)
        self.instant=RELEASES[0].replace(minute=31)
        with self.assertRaises(HTTPException) as duplicate:
            asyncio.run(server.submit(Request({**p,'action':'F'}),receipt['team_token']))
        self.assertEqual(duplicate.exception.status_code,409)
        self.assertEqual(len(self.state['audit']),1)
        public=json.dumps(server.board(self.state))
        for secret in ['stock1','stock2','receipt_id','token_hash',receipt['team_token']]:self.assertNotIn(secret,public)
    def test_cutoff_enforced(self):
        self.instant=deadline(0).replace(second=1)
        with self.assertRaises(HTTPException) as e:asyncio.run(server.submit(Request({'team_name':'Team Test','stock1':'NVDA','stock2':'GOOG','action':'LS','round_id':round_id(0)}),None))
        self.assertEqual(e.exception.status_code,409)
    def test_no_admin_access(self):
        with patch.dict(os.environ,{'ADMIN_KEY':'fixture-admin'}):
            with self.assertRaises(HTTPException):server.admin_state('incorrect')
            self.assertIn('audit',server.admin_state('fixture-admin'))
