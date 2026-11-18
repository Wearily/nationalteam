import type { Rng } from '../core/rng'

/** Name pools for generated (non-real) players, keyed by a broad naming culture. */
const POOLS: Record<string, { first: string[]; last: string[] }> = {
  iran: {
    first: 'Ali Mohammad Mehdi Reza Hossein Amir Saeid Omid Milad Saman Arman Aria Kian Sina Navid Payam Peyman Pouya Farshad Farhad Behnam Shahab Shayan Soheil Siavash Morteza Mostafa Masoud Majid Hamid Vahid Yasin Younes Danial Erfan Ehsan Arash Ashkan Kaveh Kamran Kasra Babak Bardia Mahan Matin Nima Parsa Ramin Rouzbeh Sajjad Sadegh Taha Abolfazl Alireza Amirhossein Mohammadreza Amirali Hamidreza Aref Iman Javad Mojtaba Meysam Shahin Sepehr Hadi Mobin Benyamin Yousef Davoud Esmaeil Jalal Kamal Saber Sobhan Arsalan Aidin'.split(' '),
    last: 'Hosseini Ahmadi Mohammadi Rezaei Karimi Moradi Jafari Kazemi Ghasemi Rahimi Akbari Ebrahimi Sadeghi Heidari Mousavi Hashemi Salehi Bagheri Najafi Rostami Asadi Norouzi Soleimani Yousefi Zamani Abbasi Azizi Amiri Shams Farahani Tehrani Shirazi Tabrizi Esfahani Kermani Golzar Nazari Safari Mahdavi Tavakoli Alavi Parsa Daneshvar Khodadadi Fallah Ghorbani Habibi Jamshidi Khalili Lotfi Maleki Naderi Omidi Pourali Rahmani Sharifi Taheri Vaziri Yazdani Zarei Ansari Bakhtiari Dehghan Eskandari Fathi Ghanbari Hajizadeh Izadi Kamali Latifi Mirzaei Nikbakht Ostovar Pakdel Ranjbar Sohrabi Torabi Valizadeh Shojaei Mokhtari Hatami Davoudi Shahbazi Kiani Babaei Ghaderi Aghaei Mansouri Rezvani Alipour Hosseinzadeh Mohammadzadeh'.split(' '),
  },
  arab: {
    first: 'Ahmed Mohammed Abdullah Khalid Omar Yousef Ali Hassan Hussein Salem Saleh Fahad Faisal Nasser Sultan Majed Hamad Tariq Ziad Karim Mahmoud Mustafa Ibrahim Ismail Bilal Walid Rashid Saud Turki Abdulrahman Abdulaziz Mansour Nawaf Bader Jassim Hamza Amjad Bassam Ayman'.split(' '),
    last: 'Al-Harbi Al-Otaibi Al-Ghamdi Al-Shehri Al-Dosari Al-Qahtani Al-Mutairi Al-Zahrani Al-Enezi Al-Maliki Hassan Ali Ibrahim Mahmoud Saleh Khalil Mansour Nasser Yousef Al-Hamdan Al-Shamrani Al-Buraikan Al-Najjar Abdulkarim Jassim Hussein Al-Ammari Resan Al-Rawi Khoury Haddad Al-Taamari Al-Naimat Mubarak Al-Hammadi Al-Balushi Al-Haydos Afif Al-Rashidi Salman'.split(' '),
  },
  east: {
    first: 'Takumi Daichi Kaoru Ritsu Wataru Hiroki Ko Yuto Keito Ayase Min-jae Heung-min Kang-in In-beom Woo-young Hee-chan Gue-sung Seung-ho Lei Wei Hao Jun Yu Peng Xin Ming Tao'.split(' '),
    last: 'Tanaka Sato Suzuki Ito Nakamura Kubo Endo Mitoma Doan Kamada Minamino Ueda Kim Lee Park Hwang Son Cho Jung Hong Wu Zhang Wang Li Liu Chen Yang Xu'.split(' '),
  },
  central: {
    first: 'Eldor Abbos Jaloliddin Otabek Khojimat Oston Abdukodir Rustam Farrukh Jasur Sherzod Bobur Azamat Aleksandr Islam Bakhtiyar Manuchekhr Ehson Shahrom Parvizdzhon Amir Elaman Nuraly Ruslan'.split(' '),
    last: 'Shomurodov Fayzullaev Masharipov Shukurov Erkinov Urunov Khusanov Ashurmatov Sayfiev Yakhshiboev Alijonov Khamrobekov Dzhalilov Panjshanbe Samiev Umarbaev Annadurdyev Amanov Alykulov Kichin Murzaev Abdurakhmanov Zainutdinov Vorogovskiy'.split(' '),
  },
  euro: {
    first: 'Lucas Mateo Hugo Leon Noah Luca Finn Jonas Max Felix Tom Jack Harry James Oliver Pablo Alvaro Sergio Diego Marco Matteo Lorenzo Federico Antoine Theo Jules Rafael Joao Tiago Bruno Lars Jesper Mikkel Erik Emil Milan Luka Ivan Nikola Petar Marek Jakub Piotr Dmitri Sergei Andrei Giorgos Kostas'.split(' '),
    last: 'Garcia Martinez Lopez Fernandez Rossi Bianchi Ferrari Muller Schmidt Schneider Fischer Weber Martin Bernard Dubois Laurent Silva Santos Ferreira Costa Smith Jones Taylor Brown Wilson de Jong Jansen de Vries Peeters Janssens Hansen Nielsen Andersson Johansson Kovac Horvat Novak Petrovic Jovanovic Nowak Kowalski Ivanov Popov Papadopoulos Georgiou'.split(' '),
  },
  latin: {
    first: 'Juan Carlos Luis Diego Santiago Matias Nicolas Facundo Gonzalo Rodrigo Gabriel Rafael Lucas Thiago Vinicius Joao Pedro Bruno Felipe Andres Sebastian Cristian Emiliano Lautaro Julian'.split(' '),
    last: 'Gonzalez Rodriguez Fernandez Gomez Diaz Alvarez Romero Torres Suarez Silva Souza Oliveira Pereira Lima Costa Martinez Lopez Perez Sanchez Ramirez Vargas Castillo Rojas Medina'.split(' '),
  },
  africa: {
    first: 'Mohamed Ibrahim Youssef Achraf Sadio Ismaila Kalidou Wilfried Franck Victor Samuel Kelechi Thomas Mohammed Jordan Andre Riyad Islam Ramy Hakim Sofiane Naby Amadou Cheikh Moussa Seko Yves Eric'.split(' '),
    last: 'Diallo Traore Kone Toure Mensah Boateng Osei Okafor Eze Ndidi Iwobi Salah Hegazi Ziyech Hakimi Mahrez Bennacer Slimani Mane Sarr Koulibaly Gueye Keita Camara Bissouma Fofana Aubameyang Onana Ngadeu'.split(' '),
  },
}

const CULTURE: Record<string, string> = {
  IRN: 'iran', AFG: 'iran', TJK: 'central', UZB: 'central', KGZ: 'central', TKM: 'central', KAZ: 'central',
  JPN: 'east', KOR: 'east', PRK: 'east', CHN: 'east', TPE: 'east', HKG: 'east', MAC: 'east',
  KSA: 'arab', UAE: 'arab', QAT: 'arab', IRQ: 'arab', JOR: 'arab', OMA: 'arab', BHR: 'arab', KUW: 'arab', SYR: 'arab',
  LBN: 'arab', PLE: 'arab', YEM: 'arab', EGY: 'arab', MAR: 'arab', ALG: 'arab', TUN: 'arab', LBY: 'arab', SDN: 'arab',
}
export function cultureOf(code: string, confed?: string): string {
  if (CULTURE[code]) return CULTURE[code]
  if (confed === 'UEFA' || confed === 'OFC') return 'euro'
  if (confed === 'CONMEBOL' || confed === 'CONCACAF') return code === 'USA' || code === 'CAN' ? 'euro' : 'latin'
  if (confed === 'CAF') return 'africa'
  if (confed === 'AFC') return code === 'AUS' ? 'euro' : 'east'
  return 'euro'
}
export function genName(rng: Rng, code: string, confed?: string): string {
  const p = POOLS[cultureOf(code, confed)] ?? POOLS.euro
  return `${rng.pick(p.first)} ${rng.pick(p.last)}`
}
