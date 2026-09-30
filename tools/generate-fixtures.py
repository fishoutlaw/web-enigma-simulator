"""One-time reference generation only; neither app nor JS tests needs Python."""
import sys, json, itertools, random, gzip
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from engine import process, DEFAULT
from enigma.machine import EnigmaMachine
rng=random.Random(19)
cases=[]
for order in itertools.permutations(['I','II','III']):
    for j in range(8):
        cfg={**DEFAULT,'rotors':list(order),
             'rings':''.join(rng.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ',k=3)),
             'start':''.join(rng.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ',k=3)),
             'plugs':['AZ','BY','CX','DW','EV','FU','GT','HS','IR','JQ']}
        text=''.join(rng.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ',k=60))
        payload=dict(config=cfg,text=text,experiment=f'reference-{len(cases)}')
        expected=process(payload)
        stock=EnigmaMachine.from_key_sheet(rotors=cfg['rotors'],ring_settings=' '.join(cfg['rings']),reflector='B',plugboard_settings=' '.join(cfg['plugs']))
        stock.set_display(cfg['start'])
        assert stock.process_text(text)==expected['cipher']
        cases.append(dict(payload=payload,expected=expected))
for cfg,text in [(DEFAULT,'AAAAA'),({**DEFAULT,'start':'ADU'},'AAA'),({**DEFAULT,'start':'ZZZ'},'ABC'),(DEFAULT,'a ß 한글123!z')]:
    payload=dict(config=cfg,text=text,experiment=f'reference-{len(cases)}')
    cases.append(dict(payload=payload,expected=process(payload)))
out=ROOT/'web-only/tests/fixtures/py-enigma-1.0.2.json.gz'
out.write_bytes(gzip.compress(json.dumps({'source':'Py-Enigma 1.0.2 + original engine.py','cases':cases},ensure_ascii=False,separators=(',',':')).encode('utf8'),mtime=0))
print(f'{len(cases)} reference cases written; {out.stat().st_size:,} bytes')
