# Data report — world.json

Snapshot `asOf` 2026-11-18, generated 2026-11-18 by `pipeline/`. All bulk data comes from en.wikipedia raw wikitext (league season pages, club pages, national-team pages, ~300 individual player/coach articles) and Wikidata (SPARQL + entity JSON). Nothing in the player/staff lists is invented; records lacking a date of birth or a position were dropped, not estimated.

## Headline counts

| Item | Count |
|---|---|
| Players | 4975 |
| …with Iran as first nationality | 492 |
| …Iran-eligible in any slot (`nat` contains IRN) | 498 |
| …dual-national / diaspora candidates (IRN plus another nationality, or born outside Iran) | 11 |
| …of which Iran is *not* the first nationality | 6 |
| Players with a club | 4844 |
| Players with `club: null` (unknown / free agent) | 131 |
| Clubs | 1331 (426 from covered leagues, 905 generic "other-<country>" clubs) |
| Leagues | 141 (25 covered + 116 catch-all) |
| Nations | 211 (FIFA ranking of 7 October 2026) |
| National teams with a real squad | 92 of 92 attempted |
| Staff | 171 (32 with a current job) |
| Club logos | 23 of 426 covered-league clubs (Iranian clubs: 23 of 34) |
| Photos | 95 downloaded (of 218 Iran-eligible players with a Wikidata image) |

### Iranian players abroad (first nationality IRN, by country of club)

| Country | Players |
|---|---|
| UAE | 7 |
| BEL | 2 |
| TUR | 1 |
| ESP | 1 |
| SWE | 1 |
| UZB | 1 |
| POL | 1 |
| ENG | 1 |
| AZE | 1 |
| POR | 1 |
| QAT | 1 |
| CRO | 1 |
| IRQ | 1 |
| ARM | 1 |
| RUS | 1 |

Iran-first players at Iranian clubs: 367; without a known club: 103.

### How Iran-eligible players were identified

| Link | Players |
|---|---|
| citizen | 406 |
| born-in-iran-no-citizenship-data | 54 |
| nt-squad | 20 |
| wp-squad | 7 |
| dual-iran-first | 4 |
| dual-other-first | 3 |
| born-in-iran-foreign | 2 |
| born-abroad | 1 |
| persian-speaking | 1 |

Legend: `citizen` = Wikidata citizenship/sporting country Iran only; `dual-iran-first` = Iranian plus other citizenship and has represented Iran (or born in Iran); `dual-other-first` = several citizenships, no Iran appearance recorded, other country listed first; `born-abroad` = Iranian citizenship only but born outside Iran; `born-in-iran-foreign` = born in Iran, Wikidata citizenship is another country (eligibility **unverified**); `born-in-iran-no-citizenship-data` = born in Iran, no citizenship recorded, treated as Iranian; `persian-speaking` = Persian listed as language, non-Iranian citizenship (eligibility **unverified**); `seed` = hand-kept list in `pipeline/diaspora.seed.ts`; `wp-squad` = Iranian found only through a club squad page + own article; `fa-squad` = found through the Persian club page; `foreign`/`nt-squad`/`other` = reached through squad pages.

### Clubs per league (and players attached)

| League | Clubs | Players | Source page |
|---|---|---|---|
| irn-1 Persian Gulf Pro League | 18 | 274 | 2026–27 Persian Gulf Pro League |
| irn-2 Azadegan League | 16 | 90 | 2026–27 Azadegan League |
| uae-1 UAE Pro League | 14 | 68 | 2026–27 UAE Pro League |
| ksa-1 Saudi Pro League | 18 | 119 | 2026–27 Saudi Pro League |
| qat-1 Qatar Stars League | 12 | 81 | 2026–27 Qatar Stars League |
| irq-1 Iraq Stars League | 20 | 62 | 2026–27 Iraq Stars League |
| tur-1 Süper Lig | 18 | 94 | 2026–27 Süper Lig |
| uzb-1 Uzbekistan Super League | 16 | 42 | 2026 Uzbekistan Super League |
| eng-1 Premier League | 20 | 294 | 2026–27 Premier League |
| eng-2 EFL Championship | 24 | 108 | 2026–27 EFL Championship |
| esp-1 La Liga | 20 | 145 | 2026–27 La Liga |
| esp-2 Segunda División | 22 | 15 | 2026–27 Segunda División |
| ger-1 Bundesliga | 18 | 165 | 2026–27 Bundesliga |
| ger-2 2. Bundesliga | 18 | 25 | 2026–27 2. Bundesliga |
| ita-1 Serie A | 20 | 220 | 2026–27 Serie A |
| fra-1 Ligue 1 | 18 | 138 | 2026–27 Ligue 1 |
| ned-1 Eredivisie | 18 | 56 | 2026–27 Eredivisie |
| bel-1 Belgian Pro League | 18 | 67 | 2026–27 Belgian Pro League |
| por-1 Primeira Liga | 18 | 61 | 2026–27 Primeira Liga |
| gre-1 Super League Greece | 14 | 48 | 2026–27 Super League Greece |
| rus-1 Russian Premier League | 16 | 70 | 2026–27 Russian Premier League |
| den-1 Danish Superliga | 12 | 25 | 2026–27 Danish Superliga |
| swe-1 Allsvenskan | 16 | 15 | 2026 Allsvenskan |
| aut-1 Austrian Bundesliga | 12 | 26 | 2026–27 Austrian Football Bundesliga |
| cro-1 HNL | 10 | 12 | 2026–27 Croatian Football League |

Catch-all leagues (`other-<country>`): 116 leagues, 905 clubs, 2524 players.

### Player record sources

| src | Players |
|---|---|
| wp:nt-squad | 4479 |
| wikidata+wp:club-squad | 289 |
| wikidata | 139 |
| wikidata+wp:club-squad+wp:nt-squad | 50 |
| wikidata+wp:nt-squad | 11 |
| wp:club-squad | 5 |
| wp:club-squad+wp:nt-squad | 2 |

Where each player's **club** came from:

| Club source | Players |
|---|---|
| wp:nt-squad | 4463 |
| wp:club-squad | 346 |
| wikidata-stale | 82 |
| unknown | 49 |
| wikidata:single-undated | 15 |
| wikidata:statement-order | 11 |
| wikidata:dated | 9 |

### Iranian club squads (en.wikipedia club articles)

875 squad entries read from 29 of 34 Iranian club pages; 361 had a date of birth (from the player's own article infobox or a matched Wikidata item) and were kept, **514 skipped** — almost all are red links (no English article), so no DOB is obtainable and `dob` is mandatory. Player articles requested: 300, of which 172 do not exist.

- club irn-aluminium: 32 squad players (updated 15 August 2026), manager Pirouz Ghorbani
- club irn-chadormalou: 31 squad players (updated 27 September 2026), manager Mohammad Saeid Akhbari
- club irn-esteghlal: 26 squad players (updated 25 August 2026), manager Sohrab Bakhtiarizadeh
- club irn-esteghlal-khuzestan: 30 squad players (updated 1 September 2026), manager Amir Khalifeh-Asl
- club irn-fajr-sepasi: 30 squad players (updated 27 August 2026), manager Mehdi Rajabzadeh
- club irn-foolad: 29 squad players (updated 18 August 2026), manager Hamid Motahari
- club irn-gol-gohar: 29 squad players (updated 27 August 2026), manager Mehdi Rahmati
- club irn-kheybar: 31 squad players, manager Faraz Kamalvand
- club irn-malavan: 33 squad players (updated 3 September 2026), manager Maziar Zare
- club irn-mes-shahr-e-babak: 26 squad players, manager Mojtaba Hosseini
- club irn-nassaji: 36 squad players (updated 8 October 2026), manager Saeid Daghighi
- club irn-paykan: 30 squad players (updated 1 September 2026), manager Saket Elhami
- club irn-persepolis: 25 squad players (updated 26 August 2026), manager Mehdi Tartar
- club irn-sanat-naft: 31 squad players, manager Sirous Pourmousavi
- club irn-sepahan: 23 squad players (updated 17 August 2026), manager Moharram Navidkia
- club irn-shams-azar: 30 squad players
- club irn-tractor: 22 squad players (updated 27 August 2026), manager Javad Nekounam
- club irn-zob-ahan: 36 squad players (updated 1 September 2026), manager Mohammad Rabiei
- club page missing: Ario Eslamshahr F.C.
- club irn-be-sat: 29 squad players (updated 27 August 2026), manager Mohammad Mir Torabi
- club page missing: Fard Alborz F.C.
- club irn-foolad-b: 28 squad players, manager Ayoub Vali
- club irn-havadar: 33 squad players, manager Mehrdad Tahmasebi
- club page missing: Kara Gostar Shabestar F.C.
- club irn-mes-kerman: 28 squad players, manager Farzad Hosseinkhani
- club irn-mes-rafsanjan: 38 squad players, manager Farshad Pious
- club irn-naft-gachsaran: 33 squad players, manager Dariush Yazdi
- club irn-naft-m-i-s: 36 squad players (updated 28 January 2025), manager Mehdi Pashazadeh
- club irn-niroye-zamini: 0 squad players, manager Dariush Yazdi
- club irn-palayesh-naft: 24 squad players, manager Reza Enayati
- club irn-pars-jonoubi: 30 squad players (updated 1 March 2025), manager Mehdi Rajabzadeh
- club irn-qeshm-island: 34 squad players (updated 27 October 2026), manager Mojtaba Jabbari
- club irn-saipa: 32 squad players (updated 27 January 2025), manager Mohammad Hassan Rajabzadeh
- club page missing: Shahin Bandar Ameri F.C.

### fa.wikipedia squads (coverage booster)

Not run.

### National squads

Senior squads parsed (current squad + recent call-ups; players without DOB skipped):

ESP 28+28 · ARG 28+40 · FRA 23+20 · ENG 26+26 · POR 24+18 · BRA 25+52 · MAR 26+57 · BEL 26+15 · NED 23+19 · MEX 28+49 · COL 25+40 · SUI 28+14 · GER 24+33 · CRO 25+13 · ITA 27+47 · USA 24+28 · JPN 27+21 · SEN 23+29 · NOR 23+11 · URU 28+27 · DEN 24+25 · AUT 24+19 · IRN 29+30 · ECU 26+25 · EGY 25+45 · AUS 23+33 · CAN 23+33 · ALG 26+40 · CIV 25+25 · NGA 23+65 · TUR 26+27 · KOR 26+22 · PAR 27+38 · SWE 23+22 · RUS 27+19 · UKR 26+34 · POL 24+22 · HUN 26+17 · WAL 24+18 · COD 26+25 · GRE 27+12 · CMR 28+29 · SCO 26+22 · SRB 24+30 · SVK 31+21 · PAN 25+40 · MLI 24+30 (−1 no DOB) · RSA 27+47 · VEN 25+73 · CHI 25+29 · KSA 30+28 · UZB 30+28 · QAT 29+17 · IRQ 27+34 · UAE 26+15 · JOR 25+23 · OMA 16+11 · SYR 23+32 · PLE 23+43 (−1 no DOB) · THA 23+31 · CHN 26+33 · BHR 26+6 · VIE 24+32 · TJK 25+22 · KGZ 26+10 · LBN 21+26 · IDN 23+45 · PRK 23+0 · MAS 33+40 · KUW 24+5 · PHI 23+19 · IND 23+24 · TKM 17+0 · YEM 23+16 (−1 no DOB) · SGP 25+14 · HKG 23+33 · MYA 23+13 (−1 no DOB) · AFG 23+0 (−2 no DOB) · MDV 23+1 (−1 no DOB) · TPE 24+17 · CAM 23+20 · NEP 23+0 · BAN 28+22 · SRI 28+1 · LAO 23+37 · MNG 21+0 · BHU 23+0 · MAC 22+0 · BRU 18+28 (−1 no DOB) · PAK 28+30 (−7 no DOB) · TLS 23+14 (−1 no DOB) · GUM 32+0 · IRN:u23 23+0 · IRN:u20 23+0 (−23 no DOB) · IRN:u17 23+0 (−11 no DOB)

Every attempted national team page yielded a squad.

Positions: 2046 squad players had no Wikidata position; their GK/DF/MF/FW label was expanded deterministically (DF→CB/RB/LB, MF→CM/DM/AM, FW→ST/RW/LW, weighted towards the central role). These are placeholders, not facts.

### Staff

- Iran national-team staff and Iranian club head coaches come from Wikipedia tables/infoboxes; DOB and nationality from the person's article infobox or Wikidata.
- Iranian club head coaches placed: 28 of 34 clubs.
- 139 further Iranian managers from Wikidata (occupation football manager, born 1955+, alive) are included with `job: null`.
- Skipped for lack of a DOB (no article / no Wikidata item) (21): Alin Dincă (gk, nation:IRN:senior); Pepe Losada (fitness, nation:IRN:senior); Alireza Shahab (physio, nation:IRN:senior); Parhan Khanlari (physio, nation:IRN:senior); Amir Esmaeili (physio, nation:IRN:senior); Mustafa Sadaqat (assistant, nation:IRN:u23); Emad Mohajeri (fitness, nation:IRN:u23); Mohammad Asgari (scout, nation:IRN:u23); _ (physio, nation:IRN:u23); _ (physio, nation:IRN:u23); Armaghan Ahmadi (coach, nation:IRN:u17); Erfan Ardestani (assistant, nation:IRN:u17); Mohammadjavad Paksima (gk, nation:IRN:u17); Ali Salehnia (fitness, nation:IRN:u17); Freydoon Hardani (assistant, nation:IRN:u17); Rahman Jahanshahloo (scout, nation:IRN:u17); Mohammad Jafari (physio, nation:IRN:u17); Vahid Rezaei (coach, club:irn-shams-azar); Vahid Bayatloo (coach, club:irn-ario); Mohammad Mir Torabi (coach, club:irn-be-sat); Reza Rabiei (coach, club:irn-shahin).

## Fallbacks and assumptions

- **FIFA ranking**: parsed from en.wikipedia `Module:SportsRankings/data/FIFA World Rankings` (edition of 7 October 2026); confederations and AFC sub-regions from the same module. Kit colours are hand-entered for ~65 nations only.
- **League strengths** are the hand-set values in `pipeline/leagues.config.ts`. **Club `rep`** is hand-set for well-known clubs (`pipeline/rep.config.ts`); other clubs get league strength − 2, nudged by current points-per-game on the few season pages that expose a results table inline. Clubs in catch-all leagues have no `rep`.
- **Catch-all leagues**: any club outside the 25 covered leagues is created as `<country>-<slug>` inside `other-<country>` (tier 1 for uncovered countries, tier 3 for lower divisions of covered countries). Their strength is a hand-set/FIFA-points-derived guess. Lower-division and top-division clubs of an uncovered country share one bucket.
- **Season pages**: irn-1: 18 clubs (expected 18) from "2026–27 Persian Gulf Pro League"; irn-2: 16 clubs (expected 18) from "2026–27 Azadegan League"; uae-1: 14 clubs (expected 14) from "2026–27 UAE Pro League"; ksa-1: 18 clubs (expected 18) from "2026–27 Saudi Pro League"; qat-1: 12 clubs (expected 12) from "2026–27 Qatar Stars League"; irq-1: 20 clubs (expected 20) from "2026–27 Iraq Stars League"; tur-1: 18 clubs (expected 18) from "2026–27 Süper Lig"; uzb-1: 16 clubs (expected 16) from "2026 Uzbekistan Super League"; eng-1: 20 clubs (expected 20) from "2026–27 Premier League"; eng-2: 24 clubs (expected 24) from "2026–27 EFL Championship"; esp-1: 20 clubs (expected 20) from "2026–27 La Liga"; esp-2: 22 clubs (expected 22) from "2026–27 Segunda División"; ger-1: 18 clubs (expected 18) from "2026–27 Bundesliga"; ger-2: 18 clubs (expected 18) from "2026–27 2. Bundesliga"; ita-1: 20 clubs (expected 20) from "2026–27 Serie A"; fra-1: 18 clubs (expected 18) from "2026–27 Ligue 1"; ned-1: 18 clubs (expected 18) from "2026–27 Eredivisie"; bel-1: 18 clubs (expected 18) from "2026–27 Belgian Pro League"; por-1: 18 clubs (expected 18) from "2026–27 Primeira Liga"; gre-1: 14 clubs (expected 14) from "2026–27 Super League Greece"; rus-1: 16 clubs (expected 16) from "2026–27 Russian Premier League"; den-1: 12 clubs (expected 12) from "2026–27 Danish Superliga"; swe-1: 16 clubs (expected 16) from "2026 Allsvenskan"; aut-1: 12 clubs (expected 12) from "2026–27 Austrian Football Bundesliga"; cro-1: 10 clubs (expected 10) from "2026–27 Croatian Football League".
- **Current club from Wikidata** = the P54 statement without an end date that has the latest start date. Undated statements are only trusted when unambiguous or (via statement order) last in the list. Wikidata club data for Iranian players is frequently years out of date, so: players aged 36+ without a spell starting 2023+, players aged 31+ with undatable clubs, and "current" spells that began 7+ years ago are dropped; players Wikidata places at an Iranian top-two-tier club whose current Wikipedia squad list does not contain them (98) are set to `club: null` (born 1996+) or dropped.
- Wikidata-only players with no determinable club are kept with `club: null` only when born 1996 or later.
- **Club precedence**: Iranian club squad page > national-team squad page > the player's own article infobox (`currentclub`, or the last career row with an open-ended year range) > Wikidata. 0 players got their club from their article. An article club outside the covered leagues is only usable when Wikidata gives the club a country.
- **Year-only birth dates** become YYYY-07-01. WDQS returns year-precision dates as 1 January, so a genuine 1 January birthday is also rewritten to 1 July.
- **`capTied`** is set when senior caps ≥ 5 (proxy for having played a competitive match); it is omitted otherwise. Caps/goals come from national-team pages where available, else from Wikidata qualifiers (often stale).
- **Nationality from Wikidata** maps "United Kingdom" to ENG. Squad-page flags override Wikidata ordering.
- **Diaspora detection is weak**: Wikipedia categories ("… of Iranian descent") cannot be read without the API, and Wikidata has no ethnic-group data for footballers (0 hits). Candidates come only from multi-citizenship, birthplace, language statements and a 4-name seed list. Many real dual nationals are therefore missing, and the `born-in-iran-foreign` / `persian-speaking` groups are unverified.
- **Photos**: 250px-wide thumbnails (Wikimedia only serves fixed thumbnail widths; 256 is refused, and `Special:FilePath` redirects to thumb.wikimedia.org which is unreachable here, so upload.wikimedia.org thumbnail URLs are built directly). Source is Wikidata P18, else the image in the player's en.wikipedia infobox. Saved as `public/faces/<id>.jpg|png`. Credit lines are parsed from the Commons file page (author + licence) and fall back to "Wikimedia Commons: <file>". 0 wanted photos could not be downloaded.
- **Club logos**: the infobox image of the club's en.wikipedia article, as a 120px-wide thumbnail (closest served step to 128) in `public/logos/<clubId>.png|jpg`; tried on en.wikipedia first (non-free crests), then Commons. Not attempted for `other-*` clubs. No Wikidata P154 fallback was needed/used. Most crests are non-free images used on Wikipedia under fair use — fine for a private hobby build, but they are **not** freely licensed. Clubs without a logo (403): irn-ario (no article); irn-fard (no article); irn-foolad-b (no infobox image); irn-kara-gostar (no article); irn-mes-kerman (no infobox image); irn-naft-gachsaran (not a PNG/JPEG: Naftgachsaranlogo.gif); irn-naft-m-i-s (HTTP 429: Naft_Masjed_Soleyman.png); irn-niroye-zamini (no infobox image); irn-palayesh-naft (no infobox image); irn-qeshm-island (no infobox image); irn-shahin (no article); uae-ajman (not attempted); uae-al-ain (not attempted); uae-al-dhafra (not attempted); uae-al-jazira (not attempted); uae-al-nasr (not attempted); uae-al-wahda (not attempted); uae-al-wasl (not attempted); uae-baniyas (not attempted); uae-hatta (not attempted); uae-kalba (not attempted); uae-khor-fakkan (not attempted); uae-shabab-al-ahli (not attempted); uae-sharjah (not attempted); uae-united (not attempted); ksa-abha (not attempted); ksa-al-ahli (not attempted); ksa-al-diriyah (not attempted); ksa-al-ettifaq (not attempted); ksa-al-faisaly (not attempted); ksa-al-fateh (not attempted); ksa-al-fayha (not attempted); ksa-al-hazem (not attempted); ksa-al-hilal (not attempted); ksa-al-ittihad (not attempted); ksa-al-khaleej (not attempted); ksa-al-kholood (not attempted); ksa-al-nassr (not attempted); ksa-al-qadsiah (not attempted); ksa-al-riyadh (not attempted); ksa-al-shabab (not attempted); ksa-al-taawoun (not attempted); ksa-neom (not attempted); qat-al-ahli (not attempted); qat-al-arabi (not attempted); qat-al-duhail (not attempted); qat-al-gharafa (not attempted); qat-al-rayyan (not attempted); qat-al-sadd (not attempted); qat-al-sailiya (not attempted); qat-al-shahaniya (not attempted); qat-al-shamal (not attempted); qat-al-wakrah (not attempted); qat-qatar-sc (not attempted); qat-lusail (not attempted); irq-al-gharraf (not attempted); irq-al-jolan (not attempted); irq-al-kahrabaa (not attempted); irq-al-karkh (not attempted); irq-al-karma (not attempted); irq-al-minaa (not attempted); irq-al-mosul (not attempted); irq-al-naft (not attempted); irq-al-quwa-al-jawiya (not attempted); irq-al-shorta (not attempted); irq-al-talaba (not attempted); irq-al-zawraa (not attempted); irq-diyala (not attempted); irq-duhok (not attempted); irq-erbil (not attempted); irq-ghaz-al-shamal (not attempted); irq-karbala (not attempted); irq-naft-maysan (not attempted); irq-newroz (not attempted); irq-zakho (not attempted); tur-alanyaspor (not attempted); tur-amed (not attempted); tur-basaksehir (not attempted); tur-besiktas (not attempted); tur-corum (not attempted); tur-erzurumspor (not attempted); tur-eyupspor (not attempted); tur-fenerbahce (not attempted); tur-galatasaray (not attempted); tur-gaziantep (not attempted); tur-genclerbirligi (not attempted); tur-goztepe (not attempted); tur-kasimpasa (not attempted); tur-kocaelispor (not attempted); tur-konyaspor (not attempted); tur-rizespor (not attempted); tur-samsunspor (not attempted); tur-trabzonspor (not attempted); uzb-fc-andijon (not attempted); uzb-fc-bunyodkor (not attempted); uzb-fc-bukhara (not attempted); uzb-fc-dinamo-samarqand (not attempted); uzb-fc-mash-al (not attempted); uzb-fc-nasaf (not attempted); uzb-pfc-navbahor-namangan (not attempted); uzb-fc-neftchi-fergana (not attempted); uzb-fc-okmk (not attempted); uzb-pakhtakor-fc (not attempted); uzb-qizilqum-fc (not attempted); uzb-fc-kokand-1912 (not attempted); uzb-fc-sogdiana (not attempted); uzb-fc-surkhon (not attempted); uzb-pfc-lokomotiv-tashkent (not attempted); uzb-fc-khorazm (not attempted); eng-arsenal (not attempted); eng-aston-villa (not attempted); eng-bournemouth (not attempted); eng-brentford (not attempted); eng-brighton-hove-albion (not attempted); eng-chelsea (not attempted); eng-coventry-city (not attempted); eng-crystal-palace (not attempted); eng-everton (not attempted); eng-fulham (not attempted); eng-hull-city (not attempted); eng-ipswich-town (not attempted); eng-leeds-united (not attempted); eng-liverpool (not attempted); eng-manchester-city (not attempted); eng-manchester-united (not attempted); eng-newcastle-united (not attempted); eng-nottingham-forest (not attempted); eng-sunderland (not attempted); eng-tottenham-hotspur (not attempted); eng-birmingham-city (not attempted); eng-blackburn-rovers (not attempted); eng-bolton-wanderers (not attempted); eng-bristol-city (not attempted); eng-burnley (not attempted); eng-cardiff-city (not attempted); eng-charlton-athletic (not attempted); eng-derby-county (not attempted); eng-lincoln-city (not attempted); eng-middlesbrough (not attempted); eng-millwall (not attempted); eng-norwich-city (not attempted); eng-portsmouth (not attempted); eng-preston-north-end (not attempted); eng-queens-park-rangers (not attempted); eng-sheffield-united (not attempted); eng-southampton (not attempted); eng-stoke-city (not attempted); eng-swansea-city (not attempted); eng-watford (not attempted); eng-west-bromwich-albion (not attempted); eng-west-ham-united (not attempted); eng-wolverhampton-wanderers (not attempted); eng-wrexham (not attempted); esp-alaves (not attempted); esp-athletic-bilbao (not attempted); esp-atletico-madrid (not attempted); esp-barcelona (not attempted); esp-celta-vigo (not attempted); esp-deportivo-a-coruna (not attempted); esp-elche (not attempted); esp-espanyol (not attempted); esp-getafe (not attempted); esp-levante (not attempted); esp-malaga (not attempted); esp-osasuna (not attempted); esp-racing-santander (not attempted); esp-rayo-vallecano (not attempted); esp-real-betis (not attempted); esp-real-madrid (not attempted); esp-real-sociedad (not attempted); esp-sevilla (not attempted); esp-valencia (not attempted); esp-villarreal (not attempted); esp-albacete (not attempted); esp-almeria (not attempted); esp-andorra (not attempted); esp-burgos (not attempted); esp-cadiz (not attempted); esp-castellon (not attempted); esp-celta-fortuna (not attempted); esp-ceuta (not attempted); esp-cordoba (not attempted); esp-eibar (not attempted); esp-eldense (not attempted); esp-girona (not attempted); esp-granada (not attempted); esp-las-palmas (not attempted); esp-leganes (not attempted); esp-mallorca (not attempted); esp-oviedo (not attempted); esp-real-sociedad-b (not attempted); esp-sabadell (not attempted); esp-sporting-gijon (not attempted); esp-tenerife (not attempted); esp-valladolid (not attempted); ger-fc-augsburg (not attempted); ger-union-berlin (not attempted); ger-werder-bremen (not attempted); ger-borussia-dortmund (not attempted); ger-sv-elversberg (not attempted); ger-eintracht-frankfurt (not attempted); ger-sc-freiburg (not attempted); ger-hamburger-sv (not attempted); ger-tsg-hoffenheim (not attempted); ger-1-fc-koln (not attempted); ger-rb-leipzig (not attempted); ger-bayer-leverkusen (not attempted); ger-mainz-05 (not attempted); ger-borussia-monchengladbach (not attempted); ger-bayern-munich (not attempted); ger-sc-paderborn (not attempted); ger-schalke-04 (not attempted); ger-vfb-stuttgart (not attempted); ger-hertha-bsc (not attempted); ger-arminia-bielefeld (not attempted); ger-vfl-bochum (not attempted); ger-eintracht-braunschweig (not attempted); ger-energie-cottbus (not attempted); ger-darmstadt-98 (not attempted); ger-dynamo-dresden (not attempted); ger-greuther-furth (not attempted); ger-hannover-96 (not attempted); ger-1-fc-heidenheim (not attempted); ger-1-fc-kaiserslautern (not attempted); ger-karlsruher-sc (not attempted); ger-holstein-kiel (not attempted); ger-1-fc-magdeburg (not attempted); ger-1-fc-nurnberg (not attempted); ger-vfl-osnabruck (not attempted); ger-fc-st-pauli (not attempted); ger-vfl-wolfsburg (not attempted); ita-atalanta (not attempted); ita-bologna (not attempted); ita-cagliari (not attempted); ita-como (not attempted); ita-fiorentina (not attempted); ita-frosinone (not attempted); ita-genoa (not attempted); ita-inter-milan (not attempted); ita-juventus (not attempted); ita-lazio (not attempted); ita-lecce (not attempted); ita-ac-milan (not attempted); ita-monza (not attempted); ita-napoli (not attempted); ita-parma (not attempted); ita-roma (not attempted); ita-sassuolo (not attempted); ita-torino (not attempted); ita-udinese (not attempted); ita-venezia (not attempted); fra-angers (not attempted); fra-auxerre (not attempted); fra-brest (not attempted); fra-le-havre (not attempted); fra-le-mans (not attempted); fra-lens (not attempted); fra-lille (not attempted); fra-lorient (not attempted); fra-lyon (not attempted); fra-marseille (not attempted); fra-monaco (not attempted); fra-nice (not attempted); fra-paris-fc (not attempted); fra-paris-saint-germain (not attempted); fra-rennes (not attempted); fra-strasbourg (not attempted); fra-toulouse (not attempted); fra-troyes (not attempted); ned-ado-den-haag (not attempted); ned-ajax (not attempted); ned-az (not attempted); ned-cambuur (not attempted); ned-excelsior (not attempted); ned-feyenoord (not attempted); ned-fortuna-sittard (not attempted); ned-go-ahead-eagles (not attempted); ned-groningen (not attempted); ned-heerenveen (not attempted); ned-n-e-c (not attempted); ned-pec-zwolle (not attempted); ned-psv (not attempted); ned-sparta-rotterdam (not attempted); ned-telstar (not attempted); ned-twente (not attempted); ned-utrecht (not attempted); ned-willem-ii (not attempted); bel-anderlecht (not attempted); bel-antwerp (not attempted); bel-beveren (not attempted); bel-cercle-brugge (not attempted); bel-charleroi (not attempted); bel-club-brugge (not attempted); bel-genk (not attempted); bel-gent (not attempted); bel-kortrijk (not attempted); bel-la-louviere (not attempted); bel-lommel-sk (not attempted); bel-mechelen (not attempted); bel-oh-leuven (not attempted); bel-sint-truiden (not attempted); bel-standard-liege (not attempted); bel-union-sg (not attempted); bel-westerlo (not attempted); bel-zulte-waregem (not attempted); por-academico-de-viseu (not attempted); por-alverca (not attempted); por-arouca (not attempted); por-benfica (not attempted); por-braga (not attempted); por-casa-pia (not attempted); por-estoril-praia (not attempted); por-estrela-da-amadora (not attempted); por-famalicao (not attempted); por-gil-vicente (not attempted); por-maritimo (not attempted); por-moreirense (not attempted); por-nacional (not attempted); por-porto (not attempted); por-rio-ave (not attempted); por-santa-clara (not attempted); por-sporting-cp (not attempted); por-vitoria-de-guimaraes (not attempted); gre-aek-athens (not attempted); gre-a-e-kifisia (not attempted); gre-aris (not attempted); gre-asteras-tripolis (not attempted); gre-atromitos (not attempted); gre-iraklis (not attempted); gre-kalamata (not attempted); gre-levadiakos (not attempted); gre-ofi (not attempted); gre-olympiacos (not attempted); gre-panathinaikos (not attempted); gre-panetolikos (not attempted); gre-paok (not attempted); gre-volos (not attempted); rus-akhmat (not attempted); rus-akron (not attempted); rus-baltika (not attempted); rus-cska (not attempted); rus-dynamo-makhachkala (not attempted); rus-dynamo-moscow (not attempted); rus-fakel (not attempted); rus-krasnodar (not attempted); rus-krylia-sovetov (not attempted); rus-lokomotiv (not attempted); rus-orenburg (not attempted); rus-rodina (not attempted); rus-rostov (not attempted); rus-rubin (not attempted); rus-spartak (not attempted); rus-zenit (not attempted); den-agf (not attempted); den-brondby (not attempted); den-copenhagen (not attempted); den-horsens (not attempted); den-lyngby (not attempted); den-midtjylland (not attempted); den-nordsjaelland (not attempted); den-ob (not attempted); den-randers (not attempted); den-silkeborg (not attempted); den-sonderjyske (not attempted); den-viborg (not attempted); swe-aik (not attempted); swe-bk-hacken (not attempted); swe-degerfors-if (not attempted); swe-djurgardens-if (not attempted); swe-gais (not attempted); swe-halmstads-bk (not attempted); swe-hammarby-if (not attempted); swe-if-brommapojkarna (not attempted); swe-if-elfsborg (not attempted); swe-ifk-goteborg (not attempted); swe-ik-sirius (not attempted); swe-kalmar-ff (not attempted); swe-malmo-ff (not attempted); swe-mjallby-aif (not attempted); swe-orgryte-is (not attempted); swe-vasteras-sk (not attempted); aut-austria-lustenau (not attempted); aut-austria-wien (not attempted); aut-grazer-ak (not attempted); aut-lask (not attempted); aut-sk-rapid (not attempted); aut-red-bull-salzburg (not attempted); aut-rheindorf-altach (not attempted); aut-sv-ried (not attempted); aut-sturm-graz (not attempted); aut-tsv-hartberg (not attempted); aut-wolfsberger-ac (not attempted); aut-wsg-tirol (not attempted); cro-dinamo-zagreb (not attempted); cro-gorica (not attempted); cro-hajduk-split (not attempted); cro-istra-1961 (not attempted); cro-lokomotiva (not attempted); cro-osijek (not attempted); cro-rijeka (not attempted); cro-rudes (not attempted); cro-slaven-belupo (not attempted); cro-varazdin (not attempted).
- **Nation codes** are the ones used by Wikipedia's ranking module. Checked against FIFA's list: the only non-FIFA code is **SGP** (FIFA: SIN) for Singapore.
- `foot` and `valueEur` are never set (no source reachable).

## Dropped records

| Reason | Count |
|---|---|
| wikidata-only: aged 36+ with no club spell starting 2023 or later (likely retired) | 197 |
| wikidata-only: "current" club spell started 7+ years ago with no later data (stale) | 149 |
| wikidata-only: no determinable current club, born before 1996 (likely retired) | 128 |
| no position known (Wikidata P413 empty, not in any squad list) | 100 |
| wikidata: not a living male human with label+DOB | 38 |
| wikidata-only: aged 31+ and current club not datable (likely stale) | 38 |
| wikidata-only: listed at an Iranian club but absent from its current squad page, born before 1996 | 7 |
| wikidata: born before 1986 | 1 |
| wikidata: born in Iran / Persian-speaking but citizenship suggests no Iran eligibility (AFG/IRQ/… only) | 1 |

## Things that failed or are incomplete

- club page missing: Ario Eslamshahr F.C.
- club page missing: Fard Alborz F.C.
- club page missing: Kara Gostar Shabestar F.C.
- club page missing: Shahin Bandar Ameri F.C.
- Wikipedia `api.php`/REST and Wikidata `wbgetentities` return 429 from this network; WDQS was limited to roughly one query per minute. The pipeline therefore uses raw wikitext, a handful of large SPARQL queries, and `Special:EntityData` for the few entities where statement order matters.
- Wikipedia links that are redirects are not resolved to Wikidata items (no API), so some squad players/clubs fail to match by title and fall back to name matching.
- 514 Iranian-club squad entries without DOB (first 60): Abolfazl Sokhtanlou (irn-aluminium), Abolfazl Ghanbari (irn-aluminium), Shervin Bozorg (irn-aluminium), Ali Vatandoust (irn-aluminium), Mehdi Tayefeh (irn-aluminium), Ali Rezaei (irn-aluminium), Amir Hossein Amini (irn-aluminium), Erfan Khodadadian (irn-aluminium), Omid Gharechomaghlou (irn-aluminium), Ali Latifi (irn-aluminium), Taha Mohebipour (irn-aluminium), Sasan Jafarikia (irn-aluminium), Mehdi Khodayari (irn-aluminium), Sobhan Kamalvand (irn-aluminium), Reza Zolfipour (irn-aluminium), Abbas Kahrizi (irn-aluminium), Amir Hossein Amanipour (irn-aluminium), Seyed Mohammadreza Hosseini (irn-chadormalou), Alireza Safari (irn-chadormalou), Renny Boboy (irn-chadormalou), Reza Mahmoudabadi (irn-chadormalou), Mobin Ghojoghi (irn-chadormalou), Mohammad Taha Tabatabaei (irn-chadormalou), Ali Kamali (irn-chadormalou), Aghil Anafjeh (irn-chadormalou), Alireza Bayat (irn-chadormalou), Arsham Mohammadzadeh (irn-chadormalou), Pouria Bali Lashak (irn-chadormalou), Mohammad Zarei (irn-chadormalou), Mohammadtaha Farahani (irn-chadormalou), Abolfazl Isalou (irn-chadormalou), Reza Bahan (irn-chadormalou), Mohammad Hossein Khosravi (irn-chadormalou), Amir Hossein Kalbasi (irn-chadormalou), Amirreza Shokri (irn-chadormalou), Sajjad Mashhadi (irn-chadormalou), Abolfazl Zoleykhaei (irn-esteghlal), Mehdi Ghayedi Heydari (irn-esteghlal), Alireza Mohebali (irn-esteghlal), Ehsan Kheradpishe (irn-esteghlal), Ahoora Nabizadeh (irn-esteghlal), Iliya Ebrahimi (irn-esteghlal), Hossein Gharloghi (irn-esteghlal), Seyed Arya Hosseinifard (irn-esteghlal), Nima Andarz (irn-esteghlal-khuzestan), Amir Savaed (irn-esteghlal-khuzestan), Arman Mardani (irn-esteghlal-khuzestan), Erfan Sazegari (irn-esteghlal-khuzestan), Mehdi Mousavi (irn-esteghlal-khuzestan), Alireza Karami (irn-esteghlal-khuzestan), Wesam Saki (irn-esteghlal-khuzestan), Sepehr Simanpour (irn-esteghlal-khuzestan), Amir Mombeini (irn-esteghlal-khuzestan), Amir Hossein Farhadi (irn-esteghlal-khuzestan), Javad Zergani (irn-esteghlal-khuzestan), Omid Mohammadi (irn-esteghlal-khuzestan), Abolfazl Jamei Qamsari (irn-esteghlal-khuzestan), Morteza Fazeli (irn-esteghlal-khuzestan), Arshia Vosoughifard (irn-fajr-sepasi), Meysam Moradi (irn-fajr-sepasi), …
- Iran youth squads: U23 23 kept / 0 skipped (no DOB); U20 0 kept / 23 skipped (no DOB); U17 12 kept / 11 skipped (no DOB).

## Rerun

```
npx tsx pipeline/run.ts          # everything (cached responses in pipeline/.cache are reused)
npx tsx pipeline/07-validate.ts  # validate public/data/world.json
```
