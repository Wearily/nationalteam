"""Real player records from FotMob: Iranian club squads, Iran national teams and Iranians abroad.
Writes public/data/fotmob.json {players, patches, clubs, leagues} which the game merges over world.json,
and extends data/overrides/photos.json and logos.json.
Usage: python3 -I pipeline/10-fotmob-players.py <cache-dir>"""
import difflib, glob, json, os, re, subprocess, sys, time, unicodedata, urllib.parse, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(sys.argv[1], 'fm'); os.makedirs(CACHE, exist_ok=True)
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
def get(url, out, binary=False):
    if os.path.exists(out) and os.path.getsize(out) > (500 if binary else 20): return True
    r = subprocess.run(['curl', '-sS', '-m', '25', '-A', UA, '-o', out, '-w', '%{http_code}', url], capture_output=True, text=True)
    time.sleep(0.3)
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
    s = re.sub(r'(.)\1', r'\1', s)
    s = s.replace('ou', 'u').replace('oo', 'u').replace('ee', 'i').replace('y', 'i').replace('gh', 'q').replace('kh', 'k')
    return ' '.join(s.split())
squash = lambda s: norm(s).replace(' ', '')
def sim(a, b): return max(difflib.SequenceMatcher(None, a, b).ratio(), difflib.SequenceMatcher(None, a.replace(' ', ''), b.replace(' ', '')).ratio())
def search(term):
    key = re.sub(r'[^a-z0-9]+', '-', term.lower())
    return js('https://www.fotmob.com/api/data/search/suggest?term=' + urllib.parse.quote(term) + '&lang=en', f'search-p-{key}.json') or []
POS = {'GK': 'GK', 'CB': 'CB', 'RB': 'RB', 'RWB': 'RB', 'LB': 'LB', 'LWB': 'LB', 'CDM': 'DM', 'DM': 'DM', 'CM': 'CM', 'CAM': 'AM', 'AM': 'AM', 'RM': 'RW', 'RW': 'RW', 'LM': 'LW', 'LW': 'LW', 'ST': 'ST', 'CF': 'ST'}
ROLE = {'keeper_long': 'GK', 'defender_long': 'CB', 'midfielder_long': 'CM', 'attacker_long': 'ST'}
def positions(descs, role=None):
    out = []
    for d in descs:
        p = POS.get(d.strip().upper())
        if p and p not in out: out.append(p)
    if not out and role in ROLE: out = [ROLE[role]]
    return out[:4]

world = json.load(open(os.path.join(ROOT, 'public/data/world.json')))
nations = {n['code'] for n in world['nations']}
ALIAS = {'SGP': 'SGP', 'SIN': 'SGP', 'IRI': 'IRN', 'UAE': 'UAE', 'ARE': 'UAE', 'SAU': 'KSA', 'DEU': 'GER', 'NLD': 'NED', 'PRT': 'POR', 'HRV': 'CRO', 'CHE': 'SUI', 'DNK': 'DEN', 'GRC': 'GRE', 'INT': None}
def nat_code(c):
    if not c: return None
    c = str(c).upper()
    if c in nations: return c
    a = ALIAS.get(c)
    return a if a in nations else None
leagues = {l['id']: l for l in world['leagues']}
clubs = list(world['clubs'])
by_country = collections.defaultdict(list)
for c in clubs: by_country[c['country']].append(c)
wplayers = world['players']
by_club = collections.defaultdict(list)
for p in wplayers:
    if p.get('club'): by_club[p['club']].append(p)
iranians = [p for p in wplayers if 'IRN' in p['nat']]

new_clubs, new_leagues, club_of_fm = [], [], {}
# FotMob names that differ too much from the base data to match automatically
CLUB_ALIAS = {'Sanat Naft Abadan': 'irn-sanat-naft', 'Naft Masjed Soleyman FC': 'irn-naft-m-i-s'}
def map_club(tid, tname, country, league_hint=None, create=True):
    """FotMob team -> game club id (existing by name within country, else a new club)."""
    if tid in club_of_fm: return club_of_fm[tid]
    known = CLUB_ALIAS.get(tname)
    if known and any(c['id'] == known for c in clubs): club_of_fm[tid] = known; return known
    best, bs = None, 0
    for c in by_country.get(country, []):
        s_ = max(sim(norm(c['name']), norm(tname)), sim(norm(c.get('short') or c['name']), norm(tname)))
        if c['league'].startswith('other-'): s_ -= 0.03
        if s_ > bs: best, bs = c, s_
    if best and bs >= 0.8: club_of_fm[tid] = best['id']; return best['id']
    # "Foolad Khuzestan" / "Foolad", "Shabab Al-Ahli Dubai FC" / "Shabab Al Ahli": one name contained in the other
    STOP = {'fc', 'sc', 'club', 'cf', 'fk', 'ac'}
    ft = [t for t in norm(tname).split() if t not in STOP]
    sub = []
    for c in by_country.get(country, []):
        ct = [t for t in norm(c.get('short') or c['name']).split() if t not in STOP] or norm(c['name']).split()
        if ct and ft and (set(ct) <= set(ft) or set(ft) <= set(ct)) and ft[0] == ct[0]: sub.append((len(set(ct) & set(ft)), not c['league'].startswith('other-'), c))
    if sub:
        sub.sort(key=lambda x: (-x[0], -x[1]))
        club_of_fm[tid] = sub[0][2]['id']; return sub[0][2]['id']
    if not create: return None
    lid = league_hint or f'other-{country.lower()}'
    if lid not in leagues:
        leagues[lid] = {'id': lid, 'name': f'{country} — other clubs', 'country': country, 'tier': 1, 'strength': 50, 'startMonth': 8}
        new_leagues.append(leagues[lid])
    c = {'id': f'fm-{tid}', 'name': tname, 'country': country, 'league': lid, 'rep': leagues[lid]['strength']}
    clubs.append(c); by_country[country].append(c); new_clubs.append(c)
    club_of_fm[tid] = c['id']
    return c['id']

fm = {}  # fotmob id -> dict(name, dob, pos, height, value, num, nat, club, natteam)
def team(tid, league_hint=None, national=False):
    d = js(f'https://www.fotmob.com/api/data/teams?id={tid}', f'team-{tid}.json')
    if not d: return None
    det = d.get('details') or {}
    country = nat_code(det.get('country'))
    members = sum(len(g.get('members') or []) for g in ((d.get('squad') or {}).get('squad') or []) if g.get('title') != 'coach')
    # a club absent from the base data is only added when FotMob actually has a squad for it
    cid = None if national else (map_club(tid, det.get('name', ''), country, league_hint, create=members >= 11) if country else None)
    if not national and cid is None: return det
    for g in ((d.get('squad') or {}).get('squad') or []):
        if g.get('title') == 'coach': continue
        for m in (g.get('members') or []):
            e = fm.setdefault(m['id'], {'id': m['id'], 'name': m['name']})
            e.update({k: v for k, v in {'dob': m.get('dateOfBirth'), 'height': m.get('height'), 'value': m.get('transferValue'), 'num': m.get('shirtNumber')}.items() if v})
            pos = positions((m.get('positionIdsDesc') or '').split(','), (m.get('role') or {}).get('key'))
            if pos: e['pos'] = pos
            if national: e['nat'] = 'IRN'
            else:
                e['club'] = cid
                n = nat_code(m.get('ccode'))
                if n: e.setdefault('nat', n)
    return det

def teams_in(obj, out):
    if isinstance(obj, dict):
        if 'id' in obj and 'name' in obj and ('shortName' in obj or 'pageUrl' in obj) and str(obj['id']).isdigit(): out[int(obj['id'])] = obj['name']
        for v in obj.values(): teams_in(v, out)
    elif isinstance(obj, list):
        for v in obj: teams_in(v, out)
# 1. Iranian leagues
league_ids = {523: 'irn-1'}
for grp in (js('https://www.fotmob.com/api/data/search/suggest?term=Azadegan&lang=en', 'search-azadegan.json') or []):
    for it in grp.get('suggestions', []):
        if it.get('type') == 'league': league_ids[int(it['id'])] = 'irn-2'
iran_team_ids = set(); moved = {}
for lid, ours in league_ids.items():
    d = js(f'https://www.fotmob.com/api/data/leagues?id={lid}', f'league-{lid}.json')
    if not d: continue
    t = {}; teams_in(d.get('table'), t)
    for tid in t: iran_team_ids.add(tid); team(tid, ours)
    for tr in ((d.get('transfers') or {}).get('data') or []):
        if tr.get('fromClubId') in t and tr.get('toClubId') not in t and tr.get('playerId'): moved[tr['playerId']] = tr.get('name')
# 2. national teams
nts = {6711}
for grp in (js('https://www.fotmob.com/api/data/search/suggest?term=Iran&lang=en', 'search-iran.json') or []):
    for it in grp.get('suggestions', []):
        if it.get('type') == 'team' and re.match(r'Iran( U\d+)?$', it.get('name', '')): nts.add(int(it['id']))
for tid in nts: team(tid, national=True)
print('squads read:', len(fm), 'players;', len(iran_team_ids), 'Iranian clubs;', len(nts), 'national teams')

# 3. Iranians abroad: seed names, existing Iranians without an Iranian club, and players transferred out
lookups = {}
for line in open(os.path.join(ROOT, 'pipeline/iranians-abroad.seed.txt')):
    line = line.strip()
    if line and not line.startswith('#'): lookups[line] = None
duals = {}
dual_seed = {}
for line in open(os.path.join(ROOT, 'pipeline/dual-nationals.seed.txt')):
    line = line.strip()
    if line and not line.startswith('#') and '|' in line:
        parts = [x.strip() for x in line.split('|')]
        nm, code = parts[0], parts[1]
        if code in nations:
            duals[nm] = code; lookups[nm] = None
            if len(parts) >= 6: dual_seed[nm] = dict(zip(['dob', 'pos', 'club', 'clubCountry', 'value', 'height'], parts[2:] + [''] * 6))
dual_ids = {}
iran_club_ids = {c['id'] for c in world['clubs'] if c['country'] == 'IRN'}
for p in iranians:
    if p.get('club') not in iran_club_ids: lookups.setdefault(p['name'], p)
want = set(moved)
for name in lookups:
    cand = [it for grp in search(name) for it in grp.get('suggestions', []) if it.get('type') == 'player']
    for it in cand[:3]:
        if sim(norm(it.get('name', '')), norm(name)) >= 0.86:
            want.add(int(it['id']))
            if name in duals: dual_ids[int(it['id'])] = duals[name]
            break
have_nt_abroad = [i for i, e in fm.items() if e.get('nat') == 'IRN' and 'club' not in e]
want |= set(have_nt_abroad)
def player(pid):
    d = js(f'https://www.fotmob.com/api/data/playerData?id={pid}', f'player-{pid}.json')
    if not d or d.get('isCoach'): return
    info = {i.get('title'): i for i in (d.get('playerInformation') or [])}
    country = nat_code((info.get('Country') or {}).get('countryCode'))
    e = fm.setdefault(pid, {'id': pid, 'name': d.get('name', '')})
    if (d.get('birthDate') or {}).get('utcTime'): e['dob'] = d['birthDate']['utcTime'][:10]
    hv = ((info.get('Height') or {}).get('value') or {}).get('numberValue')
    if hv: e['height'] = hv
    mv = ((info.get('Market value') or {}).get('value') or {}).get('numberValue')
    if mv: e['value'] = mv
    sh = ((info.get('Shirt') or {}).get('value') or {}).get('numberValue')
    if sh: e['num'] = sh
    ft = ((info.get('Preferred foot') or {}).get('value') or {}).get('key')
    if ft in ('left', 'right', 'both'): e['foot'] = ft[0].upper()
    ps = sorted((d.get('positionDescription') or {}).get('positions') or [], key=lambda x: (-int(bool(x.get('isMainPosition'))), -(x.get('occurences') or 0)))
    pos = positions([(x.get('strPosShort') or {}).get('label', '') for x in ps])
    if pos: e['pos'] = pos
    if country: e['nat'] = country
    pt = d.get('primaryTeam') or {}
    if not pt.get('teamId') and 'club' not in e: e['noclub'] = True
    if pt.get('teamId') and 'club' not in e:
        tid = pt['teamId']
        if tid in club_of_fm: e['club'] = club_of_fm[tid]
        else:
            td = js(f'https://www.fotmob.com/api/data/teams?id={tid}', f'team-{tid}.json') or {}
            tc = nat_code((td.get('details') or {}).get('country'))
            if tc and not (td.get('details') or {}).get('type') == 'national': e['club'] = map_club(tid, pt.get('teamName', ''), tc)
for pid in sorted(want): player(pid)
for pid, code in dual_ids.items():
    if pid in fm: fm[pid]['nat'] = code; fm[pid]['dual'] = True
# dual nationals FotMob does not have (or has a namesake of): use the details given in the seed file
def seed_club(name, country):
    if not name: return None
    for grp in search(name):
        for it in grp.get('suggestions', []):
            if it.get('type') == 'team' and sim(norm(it.get('name', '')), norm(name)) >= 0.8: return map_club(int(it['id']), it['name'], country)
    for c in by_country.get(country, []):
        if sim(norm(c['name']), norm(name)) >= 0.85: return c['id']
    lid = f'other-{country.lower()}'
    if lid not in leagues:
        leagues[lid] = {'id': lid, 'name': f'{country} — other clubs', 'country': country, 'tier': 1, 'strength': 50, 'startMonth': 8}; new_leagues.append(leagues[lid])
    c = {'id': 'tm-' + re.sub(r'[^a-z0-9]+', '-', norm(name)).strip('-'), 'name': name, 'country': country, 'league': lid, 'rep': leagues[lid]['strength']}
    clubs.append(c); by_country[country].append(c); new_clubs.append(c)
    return c['id']
found = {}
for pid, e in list(fm.items()):
    if e.get('dual'): found[norm(e['name'])] = pid
seeded = []
for nm, sd in dual_seed.items():
    pid = next((v for k, v in found.items() if sim(k, norm(nm)) >= 0.86), None)
    if pid is not None and sd['dob'] and fm[pid].get('dob') and fm[pid]['dob'] != sd['dob']:
        del fm[pid]; pid = None  # a namesake
    if pid is not None:
        if sd['value'] and not fm[pid].get('value'): fm[pid]['value'] = int(sd['value'])
        continue
    if not sd['dob'] or not sd['pos'] or sd['clubCountry'] not in nations: continue
    key = 'seed-' + re.sub(r'[^a-z0-9]+', '-', norm(nm))
    e = {'id': key, 'name': nm, 'dob': sd['dob'], 'pos': [x for x in sd['pos'].split(',') if x], 'nat': duals[nm], 'dual': True, 'club': seed_club(sd['club'], sd['clubCountry'])}
    if sd['value']: e['value'] = int(sd['value'])
    if sd['height']: e['height'] = int(sd['height'])
    fm[key] = e; seeded.append(nm)
print('dual nationals taken from the seed file (not on FotMob):', seeded)
print('looked up individually:', len(want))

# 4. match to existing records -> patches, else new players
def find_existing(e):
    n = norm(e['name']); best, bs = None, 0
    pool = iranians if e.get('nat') == 'IRN' else by_club.get(e.get('club') or '', []) + [p for p in wplayers if p['nat'][0] == e.get('nat')][:0]
    for p in pool:
        s_ = sim(n, norm(p['name']))
        if e.get('dob') and p.get('dob') == e['dob']: s_ += 0.25
        elif e.get('dob') and p.get('dob') and p['dob'][:4] != e['dob'][:4] and not p['dob'].endswith('-07-01'): s_ -= 0.2
        if s_ > bs: best, bs = p, s_
    if best is not None and bs >= 0.9: return best
    if e.get('club'):
        for p in iranians:
            if p.get('club') == e['club'] and squash(p['name']) == squash(e['name']): return p
    # same birth date at the same club, with a surname in common under a different spelling or a longer
    # form of the name ("Hossein Kanaani" / "Mohammad Hossein Kanaanizadegan"): one man, not two
    if e.get('dob') and e.get('club'):
        et = [t for t in n.split() if len(t) >= 4]
        for p in iranians:
            if p.get('dob') != e['dob'] or p.get('club') != e['club']: continue
            pt_ = [t for t in norm(p['name']).split() if len(t) >= 4]
            if any(x.startswith(y) or y.startswith(x) or sim(x, y) >= 0.85 for x in et[-2:] for y in pt_[-2:]): return p
    # FotMob often files an Iran-eligible player under his other country (born and raised abroad). He is
    # still the same man as the record we hold: same birth date and the same name.
    if e.get('nat') != 'IRN' and e.get('dob'):
        for p in iranians:
            if p.get('dob') == e['dob'] and sim(n, norm(p['name'])) >= 0.82: return p
    return None
patches, players, skipped = {}, [], collections.Counter()
photos_path = os.path.join(ROOT, 'data/overrides/photos.json'); photos = json.load(open(photos_path))
os.makedirs(os.path.join(ROOT, 'public/faces/fm'), exist_ok=True)
def face(pid_game, fid):
    if pid_game in photos: return
    out = os.path.join(ROOT, 'public/faces/fm', pid_game.replace(':', '_') + '.png')
    if get(f'https://images.fotmob.com/image_resources/playerimages/{fid}.png', out, True) and open(out, 'rb').read(4) == b'\x89PNG' and os.path.getsize(out) > 2500: photos[pid_game] = 'faces/fm/' + os.path.basename(out)
    elif os.path.exists(out): os.remove(out)
seen = set()
for e in fm.values():
    if not e.get('nat'): skipped['no nationality'] += 1; continue
    ex = find_existing(e)
    if ex and e.get('dual') and ex['nat'][0] == 'IRN' and (ex.get('caps') or 0) > 0: e.pop('dual')  # already plays for Iran
    if ex:
        if ex['id'] in seen: continue
        seen.add(ex['id'])
        patch = {}
        if e.get('dob') and e['dob'] != ex.get('dob'): patch['dob'] = e['dob']
        if e.get('pos'): patch['pos'] = e['pos']
        if e.get('height'): patch['heightCm'] = e['height']
        if e.get('foot'): patch['foot'] = e['foot']
        if e.get('club') and e['club'] != ex.get('club'): patch['club'] = e['club']
        elif e.get('noclub') and ex.get('club') and e.get('dob') and e['dob'] == ex.get('dob'): patch['club'] = None  # FotMob has him without a club: a free agent
        if e.get('value'): patch['valueEur'] = int(e['value'])
        if e.get('num'): patch['num'] = e['num']
        if e.get('dual'): patch['nat'] = [e['nat'], 'IRN']; patch['born'] = e['nat']
        if patch: patches[ex['id']] = patch
        face(ex['id'], e['id'])
        continue
    if not e.get('dob'): skipped['no birth date'] += 1; continue
    if not e.get('pos'): skipped['no position'] += 1; continue
    rec = {'id': f"fm:{e['id']}", 'name': e['name'], 'dob': e['dob'], 'nat': [e['nat'], 'IRN'] if e.get('dual') else [e['nat']], 'pos': e['pos'], 'club': e.get('club'), 'src': 'fotmob'}
    if e.get('dual'): rec['born'] = e['nat']
    if e.get('height'): rec['heightCm'] = e['height']
    if e.get('foot'): rec['foot'] = e['foot']
    if e.get('value'): rec['valueEur'] = int(e['value'])
    if e.get('num'): rec['num'] = e['num']
    players.append(rec); face(rec['id'], e['id'])
json.dump(photos, open(photos_path, 'w'), indent=0, sort_keys=True)
# reference list (Transfermarkt, supplied by hand): value, club, main position, birth date and caps
tm_rows, tm_log = [], collections.Counter()
tm_path = os.path.join(ROOT, 'data/overrides/transfermarkt.txt')
if os.path.exists(tm_path):
    for line in open(tm_path):
        line = line.strip()
        if not line or line.startswith('#'): continue
        f_ = [x.strip() for x in line.split('|')] + [''] * 7
        tm_rows.append(dict(name=f_[0], dob=f_[1], pos=f_[2], club=f_[3], country=f_[4] or 'IRN', value=f_[5], caps=f_[6]))
def tm_find(row):
    n = norm(row['name']); cands = []
    for kind, pool in (('w', iranians), ('f', [q for q in players if 'IRN' in q['nat']])):
        for q in pool:
            dob = (patches.get(q['id'], {}).get('dob') if kind == 'w' else None) or q.get('dob')
            s_ = sim(n, norm(q['name']))
            toks = set(t for t in n.split() if len(t) >= 4); qt = set(t for t in norm(q['name']).split() if len(t) >= 4)
            share = any(x.startswith(y) or y.startswith(x) or sim(x, y) >= 0.8 for x in toks for y in qt)
            first = n.split()[0]; qall = norm(q['name']).split()
            given = any(sim(first, y) >= 0.75 or first in y or y in first for y in qall if len(y) >= 3)  # twins share a birth date and a surname
            if dob == row['dob'] and (s_ >= 0.55 or share) and (given or s_ >= 0.92): cands.append((s_ + 1, kind, q))
            elif s_ >= 0.93 and (not dob or dob[:4] == row['dob'][:4] or dob.endswith('-07-01')): cands.append((s_, kind, q))
            elif squash(q['name']) == squash(row['name']) and row['club'] not in ('', '-') and norm(row['club']).split()[0] in norm(q.get('club') or ''): cands.append((0.95, kind, q))
    cands.sort(key=lambda x: -x[0])
    return cands[0][1:] if cands else (None, None)
def tm_club(row):
    if row['club'] in ('', '-'): return None
    best, bs = None, 0
    for c in by_country.get(row['country'], []):
        s_ = max(sim(norm(c['name']), norm(row['club'])), sim(norm(c.get('short') or c['name']), norm(row['club'])))
        if norm(row['club']) in norm(c['name']) or norm(c['name']) in norm(row['club']): s_ = max(s_, 0.9)
        if c['league'].startswith('other-'): s_ -= 0.03
        if s_ > bs: best, bs = c, s_
    return best['id'] if best and bs >= 0.8 else seed_club(row['club'], row['country'])
for row in tm_rows:
    kind, q = tm_find(row)
    club = tm_club(row)
    if q is None:
        rec = {'id': 'tm:' + re.sub(r'[^a-z0-9]+', '-', norm(row['name'])), 'name': row['name'], 'dob': row['dob'], 'nat': ['IRN'], 'pos': [row['pos']], 'club': club, 'src': 'transfermarkt', 'valueEur': int(row['value'])}
        if row['caps']: rec['caps'] = int(row['caps'])
        players.append(rec); tm_log['added'] += 1; print('  reference list: added', row['name'])
        continue
    tgt = patches.setdefault(q['id'], {}) if kind == 'w' else q
    cur = {**q, **tgt} if kind == 'w' else q
    tgt['valueEur'] = int(row['value'])
    if cur.get('dob') != row['dob']: tgt['dob'] = row['dob']; tm_log['birth date corrected'] += 1
    pos = [row['pos']] + [x for x in (cur.get('pos') or []) if x != row['pos']]
    if pos != cur.get('pos'): tgt['pos'] = pos[:4]; tm_log['main position changed'] += 1
    if club != cur.get('club'): tgt['club'] = club; tm_log['club changed'] += 1; print('  reference list: club', q['name'], cur.get('club'), '->', club)
    if row['caps'] and int(row['caps']) > int(cur.get('caps') or 0): tgt['caps'] = int(row['caps'])
    tm_log['matched'] += 1
print('reference list:', dict(tm_log))

# real league names for clubs the game files under a country's catch-all bucket
club_by_id = {c['id']: c for c in clubs}
used = {p.get('club') for p in players} | {pt.get('club') for pt in patches.values()} | {p.get('club') for p in iranians}
club_league = {}
for tid, cid in club_of_fm.items():
    c = club_by_id.get(cid)
    if not c or cid not in used or not str(c.get('league', '')).startswith('other-'): continue
    td = js(f'https://www.fotmob.com/api/data/teams?id={tid}', f'team-{tid}.json') or {}
    ln = (td.get('details') or {}).get('primaryLeagueName')
    if ln: club_league[cid] = ln
print('league names found for', len(club_league), 'clubs in catch-all buckets')
# the base data sometimes lists one man twice (a stale record with no club or a slightly different birth date):
# keep the fuller record and drop the other
drop = []
groups = collections.defaultdict(list)
for q in iranians: groups[squash(q['name'])].append({**q, **patches.get(q['id'], {})})
for g_ in groups.values():
    if len(g_) < 2: continue
    g_.sort(key=lambda q: (-(q.get('caps') or 0), q.get('club') is None, not q['id'].startswith('x:')))
    keep = g_[0]
    for q in g_[1:]:
        if q.get('club') == keep.get('club') or (q.get('club') is None and not q.get('caps')): drop.append(q['id']); patches.pop(q['id'], None)
print('duplicate base records dropped:', len(drop))
json.dump({'version': 1, 'players': players, 'patches': patches, 'clubs': new_clubs, 'leagues': new_leagues, 'clubLeague': club_league, 'drop': drop}, open(os.path.join(ROOT, 'public/data/fotmob.json'), 'w'), separators=(',', ':'))
ir_new = [p for p in players if p['nat'][0] == 'IRN']
abroad = collections.Counter()
cc = {c['id']: c['country'] for c in clubs}
for p in ir_new + [x for x in iranians if x['id'] in patches and patches[x['id']].get('club')]:
    cl = p.get('club') if p in ir_new else patches[p['id']]['club']
    if cl and cc.get(cl) != 'IRN': abroad[cc.get(cl)] += 1
print('new players', len(players), '(Iranian', len(ir_new), ') patched', len(patches), 'new clubs', len(new_clubs), 'new leagues', len(new_leagues), 'photos now', len(photos))
print('club moves abroad (new or corrected):', dict(abroad.most_common(15)))
print('skipped:', dict(skipped))
print('dual nationals:', [(p['name'], p['nat'], p.get('club'), p['dob'], p['pos']) for p in players if len(p['nat']) > 1])
for q in ('hoseinejad', 'saiadmanesh'):
    hit = [(p['name'], p.get('club')) for p in players if q in squash(p['name'])] + [(x['name'], patches[x['id']].get('club', x.get('club'))) for x in wplayers if x['id'] in patches and q in squash(x['name'])]
    print(q, hit)
