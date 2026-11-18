"""Player headshots and Iranian club logos from FotMob.
Writes public/faces/fm/<playerId>.png, public/logos/fm/<clubId>.png and merges
data/overrides/photos.json / logos.json (id -> path), which the interface resolves.
Usage: python3 -I pipeline/09-fotmob.py <cache-dir>"""
import difflib, json, os, re, subprocess, sys, time, unicodedata, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(sys.argv[1], 'fm'); os.makedirs(CACHE, exist_ok=True)
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
def get(url, out, binary=False):
    if os.path.exists(out) and os.path.getsize(out) > (500 if binary else 20): return True
    r = subprocess.run(['curl', '-sS', '-m', '25', '-A', UA, '-o', out, '-w', '%{http_code}', url], capture_output=True, text=True)
    time.sleep(0.35)
    ok = r.stdout.strip() == '200' and os.path.exists(out)
    if not ok and os.path.exists(out): os.remove(out)
    return ok
def js(url, name):
    f = os.path.join(CACHE, name)
    if not get(url, f): return None
    try: return json.load(open(f))
    except Exception: return None
def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z ]', ' ', s)
    s = s.replace('mohammed', 'mohammad').replace('hossain', 'hossein').replace('hussein', 'hossein').replace('seyed ', '').replace('seyyed ', '').replace('sayed ', '')
    s = re.sub(r'(.)\1', r'\1', s)  # collapse doubled letters (Ezzatollahi / Ezatolahi)
    s = s.replace('ou', 'u').replace('oo', 'u').replace('ee', 'i').replace('y', 'i').replace('gh', 'q').replace('kh', 'k')
    return ' '.join(s.split())
def sim(a, b): return difflib.SequenceMatcher(None, a, b).ratio()
def teams_in(obj, out):
    if isinstance(obj, dict):
        if 'id' in obj and 'name' in obj and ('shortName' in obj or 'pageUrl' in obj) and str(obj['id']).isdigit(): out[int(obj['id'])] = obj['name']
        for v in obj.values(): teams_in(v, out)
    elif isinstance(obj, list):
        for v in obj: teams_in(v, out)

world = json.load(open(os.path.join(ROOT, 'public/data/world.json')))
clubs = {c['id']: c for c in world['clubs']}
iranians = [p for p in world['players'] if 'IRN' in p['nat']]
others = [p for p in world['players'] if 'IRN' not in p['nat']]
by_norm = {}
for p in world['players']: by_norm.setdefault(norm(p['name']), []).append(p)

fm_players = {}  # fotmob id -> (name, dob, team name)
fm_teams = {}
def add_team(tid):
    d = js(f'https://www.fotmob.com/api/data/teams?id={tid}', f'team-{tid}.json')
    if not d: return
    for g in ((d.get('squad') or {}).get('squad') or []):
        if g.get('title') == 'coach': continue
        for m in (g.get('members') or []): fm_players[m['id']] = (m['name'], m.get('dateOfBirth'), (d.get('details') or {}).get('name', ''))

# Iranian leagues: find league ids through search, then every club squad
league_ids = {523}
s = js('https://www.fotmob.com/api/data/search/suggest?term=' + urllib.parse.quote('Azadegan') + '&lang=en', 'search-azadegan.json') or []
for grp in s:
    for it in grp.get('suggestions', []):
        if it.get('type') == 'league': league_ids.add(int(it['id']))
for lid in league_ids:
    d = js(f'https://www.fotmob.com/api/data/leagues?id={lid}', f'league-{lid}.json')
    if not d: continue
    t = {}; teams_in(d.get('table'), t); fm_teams.update(t)
    for tid in t: add_team(tid)
# national teams (senior + youth) via search
nts = {6711}
s = js('https://www.fotmob.com/api/data/search/suggest?term=Iran&lang=en', 'search-iran.json') or []
for grp in s:
    for it in grp.get('suggestions', []):
        if it.get('type') == 'team' and it.get('name', '').startswith('Iran'): nts.add(int(it['id']))
for tid in nts: add_team(tid)
print('fotmob teams', len(fm_teams), 'players listed', len(fm_players))

def match(name, dob, pool):
    n = norm(name)
    c = [p for p in by_norm.get(n, []) if p in pool or True]
    if len(c) == 1: return c[0]
    best, bs = None, 0
    for p in pool:
        s_ = sim(n, norm(p['name']))
        if dob and p.get('dob') == dob[:10]: s_ += 0.3
        if s_ > bs: best, bs = p, s_
    return best if bs >= 0.9 else None

photos_path = os.path.join(ROOT, 'data/overrides/photos.json')
photos = json.load(open(photos_path)) if os.path.exists(photos_path) else {}
os.makedirs(os.path.join(ROOT, 'public/faces/fm'), exist_ok=True)
def save_face(p, fid):
    out = os.path.join(ROOT, 'public/faces/fm', p['id'].replace(':', '_') + '.png')
    if get(f'https://images.fotmob.com/image_resources/playerimages/{fid}.png', out, True) and open(out, 'rb').read(4) == b'\x89PNG' and os.path.getsize(out) > 2500:
        photos[p['id']] = 'faces/fm/' + os.path.basename(out); return True
    if os.path.exists(out): os.remove(out)
    return False
got = 0; matched = set()
for fid, (name, dob, team) in fm_players.items():
    p = match(name, dob, iranians) or (match(name, dob, others) if dob else None)
    if p and p['id'] not in matched:
        matched.add(p['id'])
        if save_face(p, fid): got += 1
print('squad-list headshots', got)
# Iranians not covered by those squads (abroad, free agents): look each one up by name
rest = [p for p in iranians if p['id'] not in matched and p['id'] not in photos]
rest.sort(key=lambda p: -(p.get('caps') or 0))
found = 0
for p in rest[:260]:
    key = re.sub(r'[^a-z0-9]+', '-', p['name'].lower())
    s = js('https://www.fotmob.com/api/data/search/suggest?term=' + urllib.parse.quote(p['name']) + '&lang=en', f'search-p-{key}.json') or []
    cand = [it for grp in s for it in grp.get('suggestions', []) if it.get('type') == 'player']
    for it in cand[:3]:
        if sim(norm(it.get('name', '')), norm(p['name'])) >= 0.88:
            if save_face(p, it['id']): found += 1
            break
print('search headshots', found, 'total photos', len(photos))
json.dump(photos, open(photos_path, 'w'), indent=0, sort_keys=True)

# Iranian club logos
logos_path = os.path.join(ROOT, 'data/overrides/logos.json')
logos = json.load(open(logos_path)) if os.path.exists(logos_path) else {}
os.makedirs(os.path.join(ROOT, 'public/logos/fm'), exist_ok=True)
n = 0
for c in world['clubs']:
    if c['country'] != 'IRN' or c['league'].startswith('other-'): continue
    best, bs = None, 0
    for tid, tname in fm_teams.items():
        s_ = max(sim(norm(c['name']), norm(tname)), sim(norm(c.get('short') or c['name']), norm(tname)))
        if s_ > bs: best, bs = tid, s_
    if best and bs >= 0.8:
        out = os.path.join(ROOT, 'public/logos/fm', c['id'] + '.png')
        if get(f'https://images.fotmob.com/image_resources/logo/teamlogo/{best}.png', out, True) and open(out, 'rb').read(4) == b'\x89PNG':
            logos[c['id']] = 'logos/fm/' + c['id'] + '.png'; n += 1
json.dump(logos, open(logos_path, 'w'), indent=0, sort_keys=True)
print('iranian club logos', n)
