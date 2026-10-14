import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from protocol import *
class ProtocolTests(unittest.TestCase):
    def test_deadlines(self):
        self.assertEqual(len(RELEASES),12)
        self.assertEqual(deadline(0).hour,10);self.assertEqual(deadline(0).minute,25)
        self.assertEqual(deadline(11),CUTOFF)
        self.assertLess(CUTOFF,TERMINAL);self.assertLess(TERMINAL,FINAL)
    def test_return(self):
        entry={'NVDA':100,'GOOG':100};exit={'NVDA':110,'GOOG':90}
        p={'stock1':'NVDA','stock2':'GOOG','action':'LS'}
        self.assertAlmostEqual(pair_return(p,entry,exit),.1)
        self.assertAlmostEqual(pair_return({**p,'action':'SL'},entry,exit),-.1)
        self.assertEqual(pair_return({**p,'action':'F'},entry,exit),0)
        self.assertEqual(pair_return(None,entry,exit),0)
        self.assertAlmostEqual((1+.1)*(1-.1)-1,-.01)
    def test_pair(self):
        self.assertFalse(valid_action({'stock1':'NVDA','stock2':'NVDA','action':'LS'}))
        self.assertFalse(valid_action({'stock1':'NVDA','stock2':'BA','action':'LS'}))
