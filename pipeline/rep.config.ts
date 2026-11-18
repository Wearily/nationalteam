// Club reputation (0–100). Hand-entered from general football knowledge for clubs of clear stature; every other
// club falls back to its league strength (adjusted by current points-per-game where the season page exposes it).
export const REP: Record<string, number> = {
  // Iran
  'irn-persepolis': 70, 'irn-esteghlal': 69, 'irn-sepahan': 68, 'irn-tractor': 68, 'irn-foolad': 62, 'irn-gol-gohar': 60, 'irn-zob-ahan': 59, 'irn-malavan': 57, 'irn-aluminium': 56, 'irn-chadormalou': 55, 'irn-paykan': 54, 'irn-sanat-naft': 54, 'irn-nassaji': 54,
  'irn-shams-azar': 53, 'irn-kheybar': 53, 'irn-esteghlal-khuzestan': 53, 'irn-fajr-sepasi': 52, 'irn-mes-shahr-e-babak': 50, 'irn-saipa': 46, 'irn-mes-rafsanjan': 47, 'irn-havadar': 44, 'irn-mes-kerman': 44, 'irn-naft-m-i-s': 43, 'irn-pars-jonoubi': 42,
  // Gulf / Asia
  'ksa-al-hilal': 82, 'ksa-al-nassr': 80, 'ksa-al-ittihad': 80, 'ksa-al-ahli': 80, 'ksa-al-qadsiah': 75, 'ksa-al-shabab': 73, 'ksa-al-ettifaq': 72, 'ksa-neom': 72, 'ksa-al-taawoun': 70,
  'uae-al-ain': 72, 'uae-shabab-al-ahli': 71, 'uae-sharjah': 69, 'uae-al-wasl': 68, 'uae-al-wahda': 68, 'uae-al-jazira': 67, 'uae-al-nasr': 65,
  'qat-al-sadd': 72, 'qat-al-duhail': 70, 'qat-al-rayyan': 68, 'qat-al-gharafa': 68, 'qat-al-arabi': 65, 'qat-al-wakrah': 64,
  'irq-al-shorta': 60, 'irq-al-quwa-al-jawiya': 59, 'irq-al-zawraa': 59, 'irq-al-talaba': 55, 'irq-erbil': 54, 'irq-duhok': 54, 'irq-zakho': 54,
  'uzb-pakhtakor-fc': 62, 'uzb-fc-nasaf': 61, 'uzb-pfc-navbahor-namangan': 58, 'uzb-fc-okmk': 56,
  // Turkey
  'tur-galatasaray': 82, 'tur-fenerbahce': 81, 'tur-besiktas': 77, 'tur-trabzonspor': 75, 'tur-basaksehir': 73, 'tur-samsunspor': 72,
  // England
  'eng-manchester-city': 96, 'eng-liverpool': 96, 'eng-arsenal': 96, 'eng-chelsea': 93, 'eng-manchester-united': 91, 'eng-tottenham-hotspur': 90, 'eng-newcastle-united': 90, 'eng-aston-villa': 90, 'eng-brighton-hove-albion': 87, 'eng-nottingham-forest': 86, 'eng-crystal-palace': 86, 'eng-bournemouth': 86, 'eng-brentford': 85, 'eng-fulham': 85, 'eng-everton': 85, 'eng-leeds-united': 83, 'eng-sunderland': 83, 'eng-ipswich-town': 80, 'eng-coventry-city': 80, 'eng-hull-city': 78,
  'eng-west-ham-united': 82, 'eng-wolverhampton-wanderers': 80, 'eng-burnley': 78, 'eng-southampton': 77, 'eng-sheffield-united': 76, 'eng-middlesbrough': 75, 'eng-norwich-city': 74, 'eng-west-bromwich-albion': 74,
  // Spain
  'esp-real-madrid': 97, 'esp-barcelona': 97, 'esp-atletico-madrid': 92, 'esp-athletic-bilbao': 88, 'esp-villarreal': 88, 'esp-real-betis': 87, 'esp-real-sociedad': 86, 'esp-sevilla': 85, 'esp-valencia': 84, 'esp-celta-vigo': 84, 'esp-osasuna': 82, 'esp-rayo-vallecano': 82, 'esp-getafe': 81, 'esp-espanyol': 81,
  'esp-girona': 78, 'esp-mallorca': 77, 'esp-las-palmas': 72, 'esp-valladolid': 71, 'esp-leganes': 71, 'esp-almeria': 72, 'esp-oviedo': 72,
  // Germany
  'ger-bayern-munich': 96, 'ger-bayer-leverkusen': 90, 'ger-borussia-dortmund': 90, 'ger-rb-leipzig': 88, 'ger-eintracht-frankfurt': 87, 'ger-vfb-stuttgart': 86, 'ger-sc-freiburg': 84, 'ger-mainz-05': 82, 'ger-borussia-monchengladbach': 82, 'ger-werder-bremen': 81, 'ger-tsg-hoffenheim': 81, 'ger-union-berlin': 80, 'ger-fc-augsburg': 79, 'ger-hamburger-sv': 79, 'ger-1-fc-koln': 79, 'ger-schalke-04': 77,
  'ger-vfl-wolfsburg': 78, 'ger-hertha-bsc': 72, 'ger-fc-st-pauli': 73, 'ger-1-fc-heidenheim': 72, 'ger-hannover-96': 70,
  // Italy
  'ita-inter-milan': 94, 'ita-napoli': 91, 'ita-juventus': 90, 'ita-ac-milan': 90, 'ita-atalanta': 89, 'ita-roma': 88, 'ita-lazio': 86, 'ita-bologna': 86, 'ita-fiorentina': 85, 'ita-como': 83, 'ita-torino': 81, 'ita-udinese': 80, 'ita-genoa': 80, 'ita-sassuolo': 79, 'ita-cagliari': 78, 'ita-parma': 78, 'ita-lecce': 77,
  // France
  'fra-paris-saint-germain': 96, 'fra-marseille': 87, 'fra-monaco': 87, 'fra-lille': 86, 'fra-lyon': 85, 'fra-nice': 84, 'fra-lens': 84, 'fra-strasbourg': 83, 'fra-rennes': 83, 'fra-toulouse': 79, 'fra-brest': 79,
  // Netherlands / Belgium / Portugal
  'ned-psv': 85, 'ned-ajax': 84, 'ned-feyenoord': 84, 'ned-az': 79, 'ned-twente': 78, 'ned-utrecht': 77,
  'bel-club-brugge': 82, 'bel-union-sg': 80, 'bel-anderlecht': 78, 'bel-genk': 78, 'bel-gent': 76, 'bel-antwerp': 76, 'bel-standard-liege': 73,
  'por-benfica': 87, 'por-sporting-cp': 87, 'por-porto': 86, 'por-braga': 81, 'por-vitoria-de-guimaraes': 77,
  // Others
  'gre-olympiacos': 79, 'gre-paok': 76, 'gre-aek-athens': 76, 'gre-panathinaikos': 76, 'gre-aris': 69,
  'rus-zenit': 79, 'rus-krasnodar': 77, 'rus-spartak': 76, 'rus-cska': 76, 'rus-dynamo-moscow': 75, 'rus-lokomotiv': 75, 'rus-rostov': 71, 'rus-rubin': 70,
  'den-copenhagen': 76, 'den-midtjylland': 75, 'den-brondby': 71, 'den-nordsjaelland': 70, 'den-agf': 69,
  'swe-malmo-ff': 71, 'swe-hammarby-if': 67, 'swe-aik': 66, 'swe-djurgardens-if': 67, 'swe-bk-hacken': 66, 'swe-if-elfsborg': 66, 'swe-mjallby-aif': 67, 'swe-ifk-goteborg': 65,
  'aut-red-bull-salzburg': 77, 'aut-sturm-graz': 75, 'aut-sk-rapid': 72, 'aut-lask': 70, 'aut-austria-wien': 70, 'aut-wolfsberger-ac': 68,
  'cro-dinamo-zagreb': 75, 'cro-hajduk-split': 70, 'cro-rijeka': 70, 'cro-osijek': 65,
}
// Strength of the catch-all "other clubs" league per nation (top flight not individually covered). Anything absent is derived from FIFA points.
export const OTHER_STRENGTH: Record<string, number> = {
  BRA: 80, ARG: 76, USA: 68, MEX: 72, JPN: 70, KOR: 66, SCO: 62, SUI: 67, UKR: 64, CZE: 66, POL: 65, NOR: 64, AUS: 56, CHN: 55, SRB: 60, ROU: 60, HUN: 58, BUL: 56, CYP: 58, ISR: 58, COL: 64, URU: 62, CHI: 60, PAR: 58, ECU: 62, PER: 56,
  EGY: 60, MAR: 58, TUN: 55, ALG: 55, RSA: 56, NGA: 42, GHA: 40, SEN: 40, CIV: 40, CMR: 38, KUW: 45, BHR: 44, OMA: 44, JOR: 45, SYR: 38, LBN: 36, THA: 50, MAS: 48, IDN: 46, VIE: 46, IND: 44, KAZ: 54, AZE: 56, ARM: 50, GEO: 50, TJK: 40, KGZ: 36, TKM: 36, AFG: 20, CAN: 55, CRC: 50, SVK: 58, SVN: 56, FIN: 54, ISL: 50, IRL: 52, WAL: 40, NIR: 44, BIH: 54, ALB: 50, KOS: 48, MKD: 48, MNE: 46, BLR: 52, MDA: 48, LVA: 46, LTU: 46, EST: 44, LUX: 44, MLT: 42,
}
