"""Fill missing club logos from ESPN team listings. Writes public/logos/espn/<clubId>.png and
data/overrides/logos.json (club id -> path), which the game applies on top of world.json.
Usage: python3 -I pipeline/08-espn-logos.py <cache-dir>"""
import json, os, re, subprocess, sys, time, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1]
LEAGUES = {'eng-1': 'eng.1', 'eng-2': 'eng.2', 'esp-1': 'esp.1', 'esp-2': 'esp.2', 'ger-1': 'ger.1', 'ger-2': 'ger.2', 'ita-1': 'ita.1', 'fra-1': 'fra.1',
           'ned-1': 'ned.1', 'bel-1': 'bel.1', 'por-1': 'por.1', 'gre-1': 'gre.1', 'rus-1': 'rus.1', 'den-1': 'den.1', 'swe-1': 'swe.1', 'aut-1': 'aut.1',
           'tur-1': 'tur.1', 'ksa-1': 'ksa.1'}
EXTRA = ['afc.champions', 'afc.cup']  # Iranian, Emirati, Qatari, Iraqi and Uzbek clubs appear here
STOP = {'fc', 'cf', 'sc', 'ac', 'afc', 'cd', 'ud', 'sv', 'fk', 'bk', 'if', 'club', 'de', 'the', 'football', 'futbol', 'calcio', 'sk', 'as', 'ss', 'us', 'rc', 'ca', 'sd', 'vfl', 'vfb', 'tsg', 'fsv', '1', 'al'}
def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return [t for t in re.split(r'[^a-z0-9]+', s) if t and t not in STOP]
def fetch(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 200: return True
    r = subprocess.run(['curl', '-sS', '-m', '25', '-A', 'Mozilla/5.0', '-o', out, url])
    time.sleep(0.4)
    return r.returncode == 0 and os.path.exists(out)
def teams(slug):
    f = os.path.join(CACHE, f'espn-{slug}.json')
    if not fetch(f'https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams?limit=200', f): return []
    try: return [t['team'] for t in json.load(open(f))['sports'][0]['leagues'][0]['teams']]
    except Exception: return []
def score(a, b):
    a, b = set(a), set(b)
    if not a or not b: return 0
    return len(a & b) / max(len(a), len(b)) + (0.25 if a <= b or b <= a else 0)
world = json.load(open(os.path.join(ROOT, 'public/data/world.json')))
outdir = os.path.join(ROOT, 'public/logos/espn'); os.makedirs(outdir, exist_ok=True)
mp_path = os.path.join(ROOT, 'data/overrides/logos.json')
mapping = json.load(open(mp_path)) if os.path.exists(mp_path) else {}
extra = [t for s in EXTRA for t in teams(s)]
done = miss = 0
for club in world['clubs']:
    lg = club['league']
    cands = teams(LEAGUES[lg]) if lg in LEAGUES else (extra if club['country'] in ('IRN', 'UAE', 'QAT', 'IRQ', 'UZB', 'KSA') and not lg.startswith('other-') else None)
    if cands is None: continue
    names = [club['name']] + ([club['short']] if club.get('short') else [])
    best, bs = None, 0
    for t in cands:
        for n in names:
            for tn in (t.get('displayName', ''), t.get('shortDisplayName', ''), t.get('name', ''), t.get('location', '')):
                sc = score(norm(n), norm(tn))
                if sc > bs: best, bs = t, sc
    if not best or bs < (0.99 if lg not in LEAGUES else 0.6) or not best.get('logos'):
        miss += 1; continue
    tid = best['id']
    out = os.path.join(outdir, club['id'] + '.png')
    if fetch(f'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{tid}.png&h=128&w=128', out) and open(out, 'rb').read(8)[:4] == b'\x89PNG':
        mapping[club['id']] = 'logos/espn/' + club['id'] + '.png'; done += 1
    else:
        if os.path.exists(out): os.remove(out)
        miss += 1
json.dump(mapping, open(mp_path, 'w'), indent=0, sort_keys=True)
print('logos mapped', done, 'unmatched', miss, 'total in file', len(mapping))
