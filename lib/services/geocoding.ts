export interface LocationResult {
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  name?: string;
  address?: string;
}

interface CorridorPlace {
  shortName: string;
  displayName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  keywords: string[];
}

/**
 * Curated Instant Corridor Dictionary for Chennai & Tamil Nadu
 * Delivers sub-millisecond local autocomplete without network latency or municipal ward noise.
 */
const CORRIDOR_DIRECTORY: CorridorPlace[] = [
  // Porur & Mount-Poonamallee Corridor
  {
    shortName: "Porur Junction",
    displayName: "Porur Junction, Mount-Poonamallee Road, Chennai",
    latitude: 13.0382,
    longitude: 80.1565,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["porur", "porur junction", "porur signal", "porur flyover", "mount poonamallee"],
  },
  {
    shortName: "Porur",
    displayName: "Porur, Chennai, Tamil Nadu",
    latitude: 13.0350,
    longitude: 80.1580,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["porur", "porur lake", "porur roundana"],
  },
  {
    shortName: "Porur Toll Gate",
    displayName: "Porur Toll Gate / Bypass, Chennai",
    latitude: 13.0335,
    longitude: 80.1520,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["porur toll", "porur bypass", "porur bridge"],
  },
  {
    shortName: "Mugalivakkam",
    displayName: "Mugalivakkam Junction, Mount-Poonamallee Road, Chennai",
    latitude: 13.0285,
    longitude: 80.1715,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["mugalivakkam", "mugalivakam"],
  },
  {
    shortName: "Ramapuram (DLF IT Park)",
    displayName: "DLF IT Park, Mount-Poonamallee Road, Ramapuram, Chennai",
    latitude: 13.0298,
    longitude: 80.1770,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["dlf", "dlf it park", "ramapuram", "dlf gate"],
  },
  {
    shortName: "Nandambakkam (Trade Centre)",
    displayName: "Chennai Trade Centre, Mount-Poonamallee Road, Nandambakkam",
    latitude: 13.0186,
    longitude: 80.1843,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["nandambakkam", "trade centre", "chennai trade centre"],
  },
  {
    shortName: "Kathipara Junction",
    displayName: "Kathipara Flyover / Junction, Guindy, Chennai",
    latitude: 13.0067,
    longitude: 80.2020,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["kathipara", "kathipara junction", "kathipara cloverleaf", "guindy kathipara"],
  },
  // Poonamallee / West Corridor
  {
    shortName: "Karayanchavadi",
    displayName: "Karayanchavadi, Poonamallee High Road (Old NH4), Chennai",
    latitude: 13.0480,
    longitude: 80.0910,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["karayanchavadi", "karayan", "karayanchavadi metro", "karayanchavadi junction"],
  },
  {
    shortName: "Poonamallee",
    displayName: "Poonamallee Bus Terminus, Chennai, Tamil Nadu",
    latitude: 13.0478,
    longitude: 80.0910,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["poonamallee", "poonamalle", "poonamalle bus stand"],
  },
  {
    shortName: "Kattupakkam",
    displayName: "Kattupakkam, Mount-Poonamallee Road, Chennai",
    latitude: 13.0456,
    longitude: 80.1214,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["kattupakkam", "katupakkam"],
  },
  {
    shortName: "Iyyappanthangal",
    displayName: "Iyyappanthangal Bus Depot, Mount-Poonamallee Road, Chennai",
    latitude: 13.0418,
    longitude: 80.1417,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["iyyappanthangal", "iyapanthangal", "iyappanthangal depot"],
  },
  {
    shortName: "Kumunanchavadi",
    displayName: "Kumunanchavadi Junction, Poonamallee High Road, Chennai",
    latitude: 13.0470,
    longitude: 80.0960,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["kumunanchavadi", "kumananchavadi"],
  },
  {
    shortName: "Maduravoyal",
    displayName: "Maduravoyal Grade Separator / Bypass, Chennai",
    latitude: 13.0645,
    longitude: 80.1627,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["maduravoyal", "maduravoyal bypass", "maduravoyal bridge"],
  },
  {
    shortName: "Koyambedu (CMBT)",
    displayName: "Koyambedu CMBT / Metro Station, Chennai",
    latitude: 13.0694,
    longitude: 80.1948,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["koyambedu", "cmbt", "koyambedu bus stand", "koyambedu market"],
  },
  {
    shortName: "Ambattur",
    displayName: "Ambattur Industrial Estate, Chennai",
    latitude: 13.1147,
    longitude: 80.1548,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["ambattur", "ambattur ot", "ambattur estate"],
  },
  {
    shortName: "Avadi",
    displayName: "Avadi Bus Stand / Railway Station, Chennai",
    latitude: 13.1188,
    longitude: 80.1017,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["avadi", "avadi checkpost", "avadi station"],
  },
  // Tech Park / Taramani / OMR Campus Belt
  {
    shortName: "Tech Park Chennai",
    displayName: "Tech Park Chennai (Taramani Campus), OMR, Chennai",
    latitude: 12.9852,
    longitude: 80.2461,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["tech park", "tech park chennai", "campus", "taramani campus"],
  },
  {
    shortName: "Taramani (Ascendas)",
    displayName: "Ascendas IT Park / International Tech Park, Taramani, Chennai",
    latitude: 12.9852,
    longitude: 80.2461,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["taramani", "ascendas", "itpc", "international tech park"],
  },
  {
    shortName: "TIDEL Park",
    displayName: "TIDEL Park, Rajiv Gandhi Salai (OMR), Taramani, Chennai",
    latitude: 12.9892,
    longitude: 80.2510,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["tidel", "tidel park", "tidel signal"],
  },
  {
    shortName: "Velachery",
    displayName: "Velachery Main Road / MRTS Station, Chennai",
    latitude: 12.9815,
    longitude: 80.2180,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["velachery", "velachery bypass", "vijaya nagar"],
  },
  {
    shortName: "Guindy",
    displayName: "Guindy Metro / Railway Station, Chennai",
    latitude: 13.0080,
    longitude: 80.2130,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["guindy", "guindy race course", "guindy industrial estate", "guindy station"],
  },
  {
    shortName: "Alandur",
    displayName: "Alandur Metro Station, GST Road, Chennai",
    latitude: 13.0035,
    longitude: 80.2005,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["alandur", "alandur metro", "asarkhana"],
  },
  {
    shortName: "Saidapet",
    displayName: "Saidapet Metro / Anna Salai, Chennai",
    latitude: 13.0175,
    longitude: 80.2205,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["saidapet", "saidapet bridge", "anna salai saidapet"],
  },
  {
    shortName: "Little Mount",
    displayName: "Little Mount Metro Station, Anna Salai, Chennai",
    latitude: 13.0140,
    longitude: 80.2220,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["little mount", "little mount metro"],
  },
  {
    shortName: "Perungudi",
    displayName: "Perungudi OMR Toll Gate, Chennai",
    latitude: 12.9654,
    longitude: 80.2443,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["perungudi", "perungudi toll", "kandanchavadi"],
  },
  {
    shortName: "Thoraipakkam",
    displayName: "Thoraipakkam 200ft Radial Road Junction, OMR, Chennai",
    latitude: 12.9430,
    longitude: 80.2370,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["thoraipakkam", "thuraipakkam", "200 feet road omr"],
  },
  {
    shortName: "Sholinganallur",
    displayName: "Sholinganallur Junction, OMR - ECR Link Road, Chennai",
    latitude: 12.8988,
    longitude: 80.2284,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["sholinganallur", "solinganallur", "elcot sez"],
  },
  {
    shortName: "Navalur",
    displayName: "Navalur, OMR (Marina Mall), Chennai",
    latitude: 12.8510,
    longitude: 80.2270,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["navalur", "marina mall navalur"],
  },
  {
    shortName: "Siruseri (SIPCOT)",
    displayName: "SIPCOT IT Park, Siruseri, OMR, Chennai",
    latitude: 12.8310,
    longitude: 80.2225,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["siruseri", "sipcot", "siruseri it park"],
  },
  {
    shortName: "Adyar",
    displayName: "Adyar Depot / Gandhi Nagar, Chennai",
    latitude: 13.0012,
    longitude: 80.2565,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["adyar", "adyar signal", "maler hospital"],
  },
  {
    shortName: "T. Nagar",
    displayName: "T. Nagar (Panagal Park / Usman Road), Chennai",
    latitude: 13.0418,
    longitude: 80.2341,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["t. nagar", "tnagar", "panagal park", "usman road", "pondiy bazaar"],
  },
  {
    shortName: "Anna Nagar",
    displayName: "Anna Nagar Roundtana / Metro, Chennai",
    latitude: 13.0850,
    longitude: 80.2101,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["anna nagar", "anna nagar roundtana", "roundana"],
  },
  {
    shortName: "Vadapalani",
    displayName: "Vadapalani Junction / Forum Mall, Chennai",
    latitude: 13.0500,
    longitude: 80.2121,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["vadapalani", "forum mall", "vadapalani metro"],
  },
  {
    shortName: "Ashok Nagar",
    displayName: "Ashok Pillar, 100 Feet Road, Chennai",
    latitude: 13.0368,
    longitude: 80.2132,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["ashok nagar", "ashok pillar"],
  },
  // GST Road Corridor
  {
    shortName: "Chromepet",
    displayName: "Chromepet, GST Road, Chennai",
    latitude: 12.9516,
    longitude: 80.1413,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["chromepet", "chromepet station", "mit bridge"],
  },
  {
    shortName: "Pallavaram",
    displayName: "Pallavaram Flyover, GST Road, Chennai",
    latitude: 12.9675,
    longitude: 80.1491,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["pallavaram", "pallavaram flyover", "pallavaram station"],
  },
  {
    shortName: "Tambaram",
    displayName: "Tambaram Sanatorium / Bus Terminus, GST Road, Chennai",
    latitude: 12.9249,
    longitude: 80.1332,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["tambaram", "tambaram sanatorium", "tambaram bus stand", "tambaram station"],
  },
  {
    shortName: "Chengalpattu",
    displayName: "Chengalpattu Junction, GST Road, Tamil Nadu",
    latitude: 12.6819,
    longitude: 79.9888,
    city: "Chengalpattu",
    state: "Tamil Nadu",
    keywords: ["chengalpattu", "chengalpet", "chengalpattu station"],
  },
  // Kancheepuram / Western Corridor
  {
    shortName: "Kancheepuram",
    displayName: "Kancheepuram Town Bus Stand, Tamil Nadu",
    latitude: 12.8342,
    longitude: 79.7036,
    city: "Kancheepuram",
    state: "Tamil Nadu",
    keywords: ["kancheepuram", "kanchipuram", "kanchi", "kancheepuram bus stand"],
  },
  {
    shortName: "Sriperumbudur",
    displayName: "Sriperumbudur Toll Plaza, Bangalore Highway (NH48), Tamil Nadu",
    latitude: 12.9698,
    longitude: 79.9412,
    city: "Sriperumbudur",
    state: "Tamil Nadu",
    keywords: ["sriperumbudur", "sriperumbudur toll", "hyundai factory", "sipcot sriperumbudur"],
  },
  // Additional Premier IT Parks & Tech Corridors in Chennai
  {
    shortName: "Ramanujan IT City",
    displayName: "Ramanujan IT City (TRIL Infopark), Rajiv Gandhi Salai, Taramani, Chennai",
    latitude: 12.9880,
    longitude: 80.2450,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["ramanujan", "ramanujan it city", "ramanujan it park", "tril", "tril infopark", "taramani ramanujan", "ramanujam"],
  },
  {
    shortName: "Olympia Tech Park",
    displayName: "Olympia Tech Park, 100 Feet Road, Guindy, Chennai",
    latitude: 13.0135,
    longitude: 80.2050,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["olympia", "olympia tech park", "olympia guindy", "ekkatuthangal", "ekatuthangal", "olympia park"],
  },
  {
    shortName: "Prince Info City",
    displayName: "Prince Info City, Rajiv Gandhi Salai (OMR), Kandanchavadi, Chennai",
    latitude: 12.9640,
    longitude: 80.2460,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["prince info city", "prince infocity", "kandanchavadi prince", "prince park"],
  },
  {
    shortName: "RMZ Millenia",
    displayName: "RMZ Millenia Business Park, MGR Main Road, Perungudi, Chennai",
    latitude: 12.9680,
    longitude: 80.2470,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["rmz", "rmz millenia", "millenia", "rmz perungudi", "millenia business park"],
  },
  {
    shortName: "One Indiabulls Park",
    displayName: "One Indiabulls Park, Ambattur Industrial Estate, Chennai",
    latitude: 13.1020,
    longitude: 80.1620,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["indiabulls", "one indiabulls", "indiabulls park", "ambattur it park"],
  },
  {
    shortName: "MEPZ SEZ",
    displayName: "MEPZ Special Economic Zone, GST Road, Tambaram, Chennai",
    latitude: 12.9360,
    longitude: 80.1380,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["mepz", "mepz sez", "mepz tambaram", "madras export processing zone"],
  },
  {
    shortName: "Chennai International Airport",
    displayName: "Chennai International Airport (MAA), Meenambakkam, GST Road, Chennai",
    latitude: 12.9941,
    longitude: 80.1709,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["chennai airport", "airport", "meenambakkam", "maa airport", "domestic terminal", "international terminal"],
  },
  {
    shortName: "Chennai Central Station",
    displayName: "Puratchi Thalaivar Dr. M.G. Ramachandran Central Railway Station, Chennai",
    latitude: 13.0827,
    longitude: 80.2755,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["chennai central", "central station", "mgr central", "central metro"],
  },
  {
    shortName: "Chennai Egmore Station",
    displayName: "Chennai Egmore Railway Station, Gandhi-Irwin Road, Egmore, Chennai",
    latitude: 13.0780,
    longitude: 80.2610,
    city: "Chennai",
    state: "Tamil Nadu",
    keywords: ["chennai egmore", "egmore station", "egmore metro", "egmore"],
  },
  {
    shortName: "TIDEL Park Coimbatore",
    displayName: "TIDEL Park Coimbatore, Civil Aerodrome Post, Avinashi Road, Coimbatore",
    latitude: 11.0280,
    longitude: 77.0320,
    city: "Coimbatore",
    state: "Tamil Nadu",
    keywords: ["tidel coimbatore", "tidel park coimbatore", "cbe tidel", "avinashi road tidel"],
  },
  // Bangalore Tech Corridors
  {
    shortName: "Electronic City",
    displayName: "Electronic City (Phase 1 & 2), Hosur Road, Bangalore",
    latitude: 12.8452,
    longitude: 77.6602,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["electronic city", "elctronic city", "electronicity", "ecity", "infosys electronic city", "wipro electronic city"],
  },
  {
    shortName: "Whitefield (ITPB)",
    displayName: "International Tech Park Bangalore (ITPB), Whitefield, Bangalore",
    latitude: 12.9860,
    longitude: 77.7340,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["whitefield", "witefield", "itpb", "international tech park bangalore", "white field", "kadugodi"],
  },
  {
    shortName: "Manyata Tech Park",
    displayName: "Manyata Embassy Business Park, Outer Ring Road, Hebbal, Bangalore",
    latitude: 13.0470,
    longitude: 77.6200,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["manyata", "manyata tech park", "maniata", "hebbal tech park", "manyata business park"],
  },
  {
    shortName: "Bagmane Tech Park",
    displayName: "Bagmane Tech Park, CV Raman Nagar, Bangalore",
    latitude: 12.9810,
    longitude: 77.6620,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["bagmane", "bagmane tech park", "cv raman nagar"],
  },
  {
    shortName: "RMZ Ecospace / Ecoworld",
    displayName: "RMZ Ecospace & Ecoworld, Outer Ring Road, Bellandur, Bangalore",
    latitude: 12.9260,
    longitude: 77.6840,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["ecospace", "ecoworld", "rmz ecospace", "rmz ecoworld", "bellandur tech park", "outer ring road"],
  },
  {
    shortName: "Prestige Tech Park",
    displayName: "Prestige Tech Park, Marathahalli - Sarjapur Outer Ring Road, Bangalore",
    latitude: 12.9370,
    longitude: 77.6930,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["prestige tech park", "prestige park", "marathahalli tech park"],
  },
  {
    shortName: "Embassy TechVillage",
    displayName: "Embassy TechVillage (ETV), Outer Ring Road, Devarabisanahalli, Bangalore",
    latitude: 12.9280,
    longitude: 77.6880,
    city: "Bangalore",
    state: "Karnataka",
    keywords: ["embassy tech village", "etv", "embassy techvillage", "devarabisanahalli"],
  },
  // Hyderabad Tech Corridors
  {
    shortName: "HITEC City",
    displayName: "HITEC City / Cyber Towers, Madhapur, Hyderabad",
    latitude: 17.4474,
    longitude: 78.3762,
    city: "Hyderabad",
    state: "Telangana",
    keywords: ["hitec city", "hitech city", "cyber towers", "madhapur", "cyberabad", "hitec"],
  },
  {
    shortName: "Mindspace IT Park",
    displayName: "Mindspace Madhapur IT Park, Hitec City, Hyderabad",
    latitude: 17.4400,
    longitude: 78.3810,
    city: "Hyderabad",
    state: "Telangana",
    keywords: ["mindspace", "mindspace it park", "mindspace hyderabad", "raheja mindspace"],
  },
  {
    shortName: "Financial District",
    displayName: "Financial District, Nanakramguda, Gachibowli, Hyderabad",
    latitude: 17.4160,
    longitude: 78.3440,
    city: "Hyderabad",
    state: "Telangana",
    keywords: ["financial district", "gachibowli", "nanakramguda", "waverock"],
  },
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generic Damerau-Levenshtein distance
 * Measures edit operations: insertions, deletions, substitutions, and adjacent transpositions
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));

  for (let i = 0; i <= al; i++) matrix[i][0] = i;
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1); // transposition
      }
    }
  }

  return matrix[al][bl];
}

/**
 * Generic Jaro-Winkler string similarity (returns score between 0.0 and 1.0)
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;

  const range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let m = 0;

  for (let i = 0; i < s1.length; i++) {
    const low = i >= range ? i - range : 0;
    const high = i + range <= s2.length - 1 ? i + range : s2.length - 1;

    for (let j = low; j <= high; j++) {
      if (!s2Matches[j] && s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        m++;
        break;
      }
    }
  }

  if (m === 0) return 0;

  let k = 0;
  let numTrans = 0;
  for (let i = 0; i < s1.length; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) numTrans++;
      k++;
    }
  }

  const weight = (m / s1.length + m / s2.length + (m - numTrans / 2) / m) / 3;
  let l = 0;
  const maxL = 4;
  while (s1[l] === s2[l] && l < maxL) l++;

  return weight + l * 0.1 * (1 - weight);
}

/**
 * Fast phonetic skeleton / Soundex-like consonant skeleton
 * Strips vowels (except at the start), collapses doubles, maps phonetics:
 * ph->f, th->t, sh/ch->s, ee/ea/y->i, oo/ou->u, w->v, etc.
 */
export function phoneticSkeleton(word: string): string {
  if (!word) return "";
  let s = word.toLowerCase().trim();
  s = s.replace(/ph/g, "f")
       .replace(/th/g, "t")
       .replace(/sh/g, "s")
       .replace(/ch/g, "c")
       .replace(/zh/g, "l")
       .replace(/ee|ea|y/g, "i")
       .replace(/oo|ou/g, "u")
       .replace(/w/g, "v")
       .replace(/ck/g, "k");
  s = s.replace(/([a-z])\1+/g, "$1");
  if (s.length <= 1) return s;
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiou]/g, "");
  return first + rest;
}

/**
 * Generates normalized query variations without hardcoding place names
 * Handles multi-word spaces, common suffixes, and phonetic transliterations
 */
export function getQueryVariations(query: string): string[] {
  const q = query.trim().toLowerCase();
  const variations = new Set<string>([q]);

  // 1. Remove space variations ("karayan chavadi" -> "karayanchavadi", "tidel park" -> "tidelpark")
  if (q.includes(" ")) {
    variations.add(q.replace(/\s+/g, ""));
  }

  // 2. Strip common city/state suffixes ("guindy chennai" -> "guindy", "whitefield bangalore" -> "whitefield")
  const stripped = q.replace(/\b(chennai|tamil\s*nadu|bangalore|bengaluru|karnataka|hyderabad|telangana|india|madras)\b/gi, "").trim();
  if (stripped && stripped !== q) {
    variations.add(stripped);
    if (stripped.includes(" ")) {
      variations.add(stripped.replace(/\s+/g, ""));
    }
  }

  // 3. Common transliteration / typo alternates
  if (q.startsWith("th")) variations.add("t" + q.slice(2));
  if (q.startsWith("t") && !q.startsWith("th")) variations.add("th" + q.slice(1));
  if (q.includes("oo")) variations.add(q.replace(/oo/g, "u"));
  if (q.includes("u") && !q.includes("oo")) variations.add(q.replace(/u/g, "oo"));
  if (q.includes("ee")) variations.add(q.replace(/ee/g, "i"));
  if (q.endsWith("y")) variations.add(q.slice(0, -1) + "ee");
  if (q.endsWith("i")) variations.add(q.slice(0, -1) + "y");
  if (q.includes("sh")) variations.add(q.replace(/sh/g, "s"));
  if (q.includes("s") && !q.includes("sh")) variations.add(q.replace(/s/g, "sh"));
  if (q.includes("tidl")) variations.add(q.replace(/tidl/g, "tidel"));
  if (q.includes("tidal")) variations.add(q.replace(/tidal/g, "tidel"));

  return Array.from(variations).filter((v) => v.length >= 2);
}

export function calculateRelevanceScore(query: string, item: LocationResult): number {
  const q = query.toLowerCase().trim();
  const name = (item.shortName || "").toLowerCase().trim();
  const display = (item.displayName || "").toLowerCase().trim();
  const lat = item.latitude;
  const lon = item.longitude;

  let textScore = 0;
  const qTokens = q.split(/\s+/).filter(Boolean);
  const nameTokens = name.split(/[\s,()/-]+/).filter(Boolean);
  const qSkel = phoneticSkeleton(q);
  const nameSkel = phoneticSkeleton(name);

  // Exact full match
  if (name === q) {
    textScore += 160;
  } else if (nameSkel === qSkel && q.length >= 3) {
    textScore += 140; // Full phonetic match (e.g. "tidl park" === "tidel park")
  } else if (name.startsWith(q)) {
    textScore += 120;
  } else if (display.startsWith(q)) {
    textScore += 95;
  } else if (new RegExp("(^|\\s)" + escapeRegex(q), "i").test(name)) {
    textScore += 90;
  } else if (name.includes(q)) {
    textScore += 60;
  } else if (display.includes(q)) {
    textScore += 25;
  }

  // Token-level matching (multi-word queries)
  if (qTokens.length > 0) {
    let tokenMatches = 0;
    for (const qTok of qTokens) {
      const qTokSkel = phoneticSkeleton(qTok);
      let matchedThisToken = false;

      for (const nTok of nameTokens) {
        if (nTok === qTok) {
          tokenMatches += 1.5;
          matchedThisToken = true;
          break;
        }
        if (nTok.startsWith(qTok)) {
          tokenMatches += 1.2;
          matchedThisToken = true;
          break;
        }
        if (qTokSkel.length >= 2 && phoneticSkeleton(nTok) === qTokSkel) {
          tokenMatches += 1.2;
          matchedThisToken = true;
          break;
        }
        if (qTok.length >= 4 && damerauLevenshtein(qTok, nTok) <= 1) {
          tokenMatches += 1.0;
          matchedThisToken = true;
          break;
        }
        if (jaroWinkler(qTok, nTok) >= 0.85) {
          tokenMatches += 0.9;
          matchedThisToken = true;
          break;
        }
      }

      if (!matchedThisToken && qTok.length >= 3 && display.includes(qTok)) {
        tokenMatches += 0.5;
      }
    }

    textScore += tokenMatches * 25;
  }

  // Typo & Fuzzy Similarity Check
  const jaroName = jaroWinkler(q, name);
  const distName = damerauLevenshtein(q, name);
  let bestJaro = jaroName;
  let bestDist = distName;

  const variations = getQueryVariations(q);
  for (const v of variations) {
    const vJaro = jaroWinkler(v, name);
    const vDist = damerauLevenshtein(v, name);
    if (vJaro > bestJaro) bestJaro = vJaro;
    if (vDist < bestDist) bestDist = vDist;
  }

  if (bestJaro >= 0.90 || (q.length >= 4 && bestDist <= 1)) {
    textScore = Math.max(textScore, 95);
  } else if (bestJaro >= 0.84 || (q.length >= 5 && bestDist <= 2)) {
    textScore = Math.max(textScore, 75);
  } else if (bestJaro >= 0.78) {
    textScore = Math.max(textScore, 55);
  }

  // Geographic Relevance Bias (soft bias so local corridor ranks high, but other cities still match)
  let geoScore = 0;
  const isChennaiCore = lat >= 12.80 && lat <= 13.35 && lon >= 79.80 && lon <= 80.40;
  const isGreaterChennai = lat >= 12.50 && lat <= 13.55 && lon >= 79.50 && lon <= 80.45;
  const isTamilNadu = lat >= 8.0 && lat <= 13.6 && lon >= 76.2 && lon <= 80.5;
  const isSouthIndia = lat >= 8.0 && lat <= 18.0 && lon >= 74.0 && lon <= 82.0;

  if (isChennaiCore) {
    geoScore += 45;
  } else if (isGreaterChennai) {
    geoScore += 30;
  } else if (isTamilNadu) {
    geoScore += 20;
  } else if (isSouthIndia) {
    geoScore += 10;
  }

  let qualityScore = 0;
  if (/junction|metro|bus terminus|depot|station|park|campus|tech|it city|tower|bypass/i.test(name)) qualityScore += 15;
  if (/shop|briyani|biriyani|hotel|mess|store|tiffin|bakery/i.test(name)) qualityScore -= 20;
  if (/^(ward|zone)\s*\d+/i.test(name)) qualityScore -= 40;

  return textScore + geoScore + qualityScore;
}

/**
 * High-Performance Geocoding Service
 * Combines an Instant Local Corridor Index with OpenStreetMap Nominatim.
 * Eliminates external timeout bottlenecks and filters municipal ward numbering.
 */
class GeocodingService {
  private nominatimUrl = "https://nominatim.openstreetmap.org";

  // High-Speed In-Memory LRU Caches for zero-latency lookups
  private searchCache = new Map<string, LocationResult[]>();
  private reverseCache = new Map<string, LocationResult | null>();

  /**
   * Synchronous Zero-Latency Local Prediction (Public)
   * Delivers sub-millisecond local autocomplete with typo tolerance and phonetic matching.
   */
  public searchLocalSync(query: string, limit: number = 6): LocationResult[] {
    const q = query.toLowerCase().trim();
    if (q.length < 1) return [];

    const qTokens = q.split(/\s+/).filter(Boolean);
    const qSkel = phoneticSkeleton(q);
    const variations = getQueryVariations(q);
    const matchedItems: { item: LocationResult; score: number }[] = [];

    for (const place of CORRIDOR_DIRECTORY) {
      const placeName = place.shortName.toLowerCase();
      const placeTokens = placeName.split(/[\s,()/-]+/).filter(Boolean);
      const placeSkel = phoneticSkeleton(placeName);

      let isMatch = false;
      let matchScore = 0;

      // 1. Exact match on placeName or keywords
      if (placeName === q || place.keywords.some((k) => k === q)) {
        isMatch = true;
        matchScore = 200;
      }
      // 2. Prefix match
      else if (placeName.startsWith(q) || place.keywords.some((k) => k.startsWith(q))) {
        isMatch = true;
        matchScore = 160;
      }
      // 3. Substring match
      else if (placeName.includes(q) || place.keywords.some((k) => k.includes(q))) {
        isMatch = true;
        matchScore = 120;
      }
      // 4. Phonetic skeleton match (e.g. "tidl" -> "tdl" matches "tidel" -> "tdl")
      else if (
        q.length >= 3 &&
        (placeSkel === qSkel ||
          placeSkel.startsWith(qSkel) ||
          place.keywords.some((k) => phoneticSkeleton(k) === qSkel))
      ) {
        isMatch = true;
        matchScore = 140;
      }
      // 5. Token-level fuzzy match (e.g., "tidl park" vs "tidel park")
      else {
        let tokenHits = 0;
        for (const qTok of qTokens) {
          const qTokSkel = phoneticSkeleton(qTok);
          const matchedToken =
            placeTokens.some((pTok) => {
              if (pTok === qTok || pTok.startsWith(qTok)) return true;
              if (qTokSkel.length >= 2 && phoneticSkeleton(pTok) === qTokSkel) return true;
              if (qTok.length >= 4 && damerauLevenshtein(qTok, pTok) <= 1) return true;
              if (jaroWinkler(qTok, pTok) >= 0.85) return true;
              return false;
            }) ||
            place.keywords.some((k) => {
              if (k === qTok || k.startsWith(qTok)) return true;
              if (qTokSkel.length >= 2 && phoneticSkeleton(k) === qTokSkel) return true;
              if (qTok.length >= 4 && damerauLevenshtein(qTok, k) <= 1) return true;
              if (jaroWinkler(qTok, k) >= 0.85) return true;
              return false;
            });

          if (matchedToken) tokenHits++;
        }

        if (tokenHits > 0 && tokenHits >= Math.ceil(qTokens.length / 2)) {
          isMatch = true;
          matchScore = 100 + (tokenHits / qTokens.length) * 40;
        } else {
          // 6. Typo & variation match via Jaro-Winkler or Damerau-Levenshtein
          const maxJaro = Math.max(
            jaroWinkler(q, placeName),
            ...place.keywords.map((k) => jaroWinkler(q, k)),
            ...variations.map((v) => jaroWinkler(v, placeName))
          );
          const minLev = Math.min(
            damerauLevenshtein(q, placeName),
            ...place.keywords.map((k) => damerauLevenshtein(q, k)),
            ...variations.map((v) => damerauLevenshtein(v, placeName))
          );

          if (maxJaro >= 0.82 || (q.length >= 4 && minLev <= 2)) {
            isMatch = true;
            matchScore = 80 + maxJaro * 30;
          }
        }
      }

      if (isMatch) {
        matchedItems.push({
          item: {
            shortName: place.shortName,
            displayName: place.displayName,
            name: place.shortName,
            address: place.displayName,
            latitude: place.latitude,
            longitude: place.longitude,
            city: place.city,
            state: place.state,
          },
          score: matchScore,
        });
      }
    }

    matchedItems.sort((a, b) => b.score - a.score);
    return matchedItems.slice(0, limit).map((m) => m.item);
  }

  /**
   * Autocomplete & Search for locations matching a query string
   * Employs multi-factor scoring (text match + regional geographic bias + landmark quality + typo similarity)
   * Targets 5–8 useful suggestions.
   */
  async search(query: string, limit: number = 8): Promise<LocationResult[]> {
    if (!query || query.trim().length < 1) return [];

    const cleanQuery = query.trim().toLowerCase();
    const cacheKey = `${cleanQuery}_${limit}`;

    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    const candidatePool: LocationResult[] = [];

    // 1. Gather local corridor directory matches (instant <1ms)
    const localMatches = this.searchLocalSync(cleanQuery, limit * 2);
    candidatePool.push(...localMatches);

    // 2. Query Photon Forward Geocoding API with primary query and normalized variations
    const queriesToFetch = [cleanQuery];
    const variations = getQueryVariations(cleanQuery);
    for (const v of variations) {
      if (v !== cleanQuery && !queriesToFetch.includes(v)) {
        queriesToFetch.push(v);
        if (queriesToFetch.length >= 2) break;
      }
    }

    try {
      await Promise.allSettled(
        queriesToFetch.map(async (qStr) => {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
            qStr
          )}&lat=12.98&lon=80.24&limit=${Math.max(limit * 2, 16)}`;

          const res = await fetch(photonUrl, {
            headers: { "User-Agent": "CommuteX-Corporate-App/1.0 (contact@commutex.com)" },
            signal: AbortSignal.timeout(2000),
          });

          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.features)) {
              for (const f of data.features) {
                const p = f.properties || {};
                const coords = f.geometry?.coordinates;
                if (!coords || coords.length < 2) continue;
                const lat = coords[1];
                const lon = coords[0];
                const rawName = p.name || p.street || p.city || p.district || "";
                if (!rawName) continue;

                // Filter out pure ward boundaries
                if (/^(ward|zone)\s*\d+$/i.test(rawName)) continue;

                const shortName = cleanLocalityText(rawName);
                const parts = [
                  shortName,
                  p.street && p.street !== rawName ? cleanLocalityText(p.street) : null,
                  p.district && p.district !== rawName ? cleanLocalityText(p.district) : null,
                  p.city && p.city !== rawName ? cleanLocalityText(p.city) : null,
                  p.state,
                ].filter(Boolean);

                candidatePool.push({
                  shortName,
                  displayName: parts.join(", "),
                  latitude: lat,
                  longitude: lon,
                  city: cleanLocalityText(p.city || p.district),
                  state: p.state,
                });
              }
            }
          }
        })
      );
    } catch (e) {
      console.warn("Photon autocomplete warning:", e);
    }

    // 3. Fallback / supplement: Query Nominatim Search API if candidatePool has fewer than 5 items
    if (candidatePool.length < 5) {
      try {
        const url = `${this.nominatimUrl}/search?format=json&q=${encodeURIComponent(
          cleanQuery
        )}&limit=${Math.max(limit * 2, 12)}&addressdetails=1&countrycodes=in&viewbox=77.0,13.8,80.5,12.5`;

        const headers: Record<string, string> = { "Accept-Language": "en" };
        if (typeof window === "undefined") {
          headers["User-Agent"] = "CommuteX-Corporate-App/1.0 (contact@commutex.com)";
        }

        const res = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
          const text = await res.text();
          let data: any = [];
          try {
            data = JSON.parse(text);
          } catch {}

          if (Array.isArray(data)) {
            const apiResults: LocationResult[] = data
              .filter((item: any) => {
                const name = (item.name || "").trim();
                const displayName = (item.display_name || "").trim();
                const isPureWard = /^(ward|zone)\s*\d+$/i.test(name) || /^(ward|zone)\s*\d+,/i.test(displayName);
                return !isPureWard;
              })
              .map((item: any) => {
                const address = item.address || {};
                const shortName = extractLocalityName(address, item.name || item.display_name);
                const cleanedDisplay = cleanLocalityText(item.display_name);

                return {
                  displayName: cleanedDisplay || item.display_name,
                  shortName,
                  latitude: parseFloat(item.lat),
                  longitude: parseFloat(item.lon),
                  city: cleanLocalityText(address.city || address.town || address.state_district),
                  state: address.state,
                };
              })
              .filter(
                (r: LocationResult) =>
                  !isNaN(r.latitude) &&
                  !isNaN(r.longitude) &&
                  Math.abs(r.latitude) > 0.01 &&
                  Math.abs(r.longitude) > 0.01 &&
                  !/^(ward|zone)\s*\d+/i.test(r.shortName)
              );

            candidatePool.push(...apiResults);
          }
        }
      } catch (error) {
        console.warn("Nominatim search warning:", error);
      }
    }

    if (candidatePool.length === 0) {
      return [];
    }

    // 4. Multi-Factor Relevance Scoring & Ranking
    const scoredCandidates = candidatePool
      .map((item) => ({
        item,
        score: calculateRelevanceScore(cleanQuery, item),
      }))
      .filter(({ score }) => score > 0) // Keep positive relevance items
      .sort((a, b) => b.score - a.score);

    // 5. Deduplicate by geographic proximity (within 350 meters) and matching clean short names
    const deduplicated: LocationResult[] = [];
    for (const { item } of scoredCandidates) {
      const isDuplicate = deduplicated.some(
        (existing) =>
          (Math.hypot(existing.latitude - item.latitude, existing.longitude - item.longitude) < 0.0035 &&
            existing.shortName.toLowerCase() === item.shortName.toLowerCase()) ||
          existing.displayName.toLowerCase() === item.displayName.toLowerCase()
      );

      if (!isDuplicate) {
        deduplicated.push(item);
      }

      if (deduplicated.length >= limit) break;
    }

    this.searchCache.set(cacheKey, deduplicated);
    return deduplicated;
  }

  /**
   * Reverse geocode coordinates to a human-readable address
   */
  async reverse(latitude: number, longitude: number): Promise<LocationResult | null> {
    if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) < 0.01 || Math.abs(longitude) < 0.01) {
      return null;
    }

    const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
    if (this.reverseCache.has(cacheKey)) {
      return this.reverseCache.get(cacheKey)!;
    }

    // 1. Check local corridor directory first (within 350 meters)
    for (const place of CORRIDOR_DIRECTORY) {
      const dist = Math.hypot(place.latitude - latitude, place.longitude - longitude);
      if (dist < 0.0035) {
        // ~350m radius
        const localResult: LocationResult = {
          displayName: place.displayName,
          shortName: place.shortName,
          latitude,
          longitude,
          city: place.city,
          state: place.state,
        };
        this.reverseCache.set(cacheKey, localResult);
        return localResult;
      }
    }

    // 2. Direct Nominatim Reverse API (Fast 2000ms timeout)
    try {
      const url = `${this.nominatimUrl}/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

      const headers: Record<string, string> = { "Accept-Language": "en" };
      if (typeof window === "undefined") {
        headers["User-Agent"] = "CommuteX-Corporate-App/1.0 (contact@commutex.com)";
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const text = await res.text();
        let item: any = null;
        try {
          item = JSON.parse(text);
        } catch {
          // not JSON
        }

        if (item && item.display_name) {
          const address = item.address || {};
          const shortName = extractLocalityName(address, item.name || item.display_name);
          const cleanedDisplay = cleanLocalityText(item.display_name);

          const result: LocationResult = {
            displayName: cleanedDisplay || item.display_name,
            shortName,
            latitude: parseFloat(item.lat) || latitude,
            longitude: parseFloat(item.lon) || longitude,
            city: cleanLocalityText(address.city || address.town || address.state_district),
            state: address.state,
          };

          this.reverseCache.set(cacheKey, result);
          return result;
        }
      }
    } catch (error) {
      console.warn("Reverse geocoding failed:", error);
    }

    // 3. Fallback: Exact coordinates format so map-picking NEVER fails
    const fallback: LocationResult = {
      displayName: `Selected Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      shortName: "Selected Point",
      latitude,
      longitude,
    };
    this.reverseCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Strip municipal ward / zone administrative labels (e.g., "Ward 153", "Zone 11 Valasaravakkam")
 */
export function cleanLocalityText(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/\b(Ward|Zone)\s*\d+\b/gi, "")
    .replace(/\bChennai Corporation\b/gi, "Chennai")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

/**
 * Helper to extract recognizable human-friendly locality / place name
 * Prioritizes suburb, neighbourhood, town, village, amenity, building over raw road or ward names.
 */
function extractLocalityName(propsOrAddress: any, fallbackDisplayName?: string): string {
  if (!propsOrAddress) {
    const fb = fallbackDisplayName ? cleanLocalityText(fallbackDisplayName.split(",")[0]) : "Location";
    return fb || "Location";
  }

  const p = propsOrAddress;

  // 1. Check specific suburb, neighbourhood, town, village, locality (skipping any raw "Ward \d+" or "Zone \d+")
  const candidates = [
    p.suburb,
    p.neighbourhood,
    p.town,
    p.village,
    p.residential,
    p.locality,
    p.quarter,
    p.city,
    p.district,
    p.city_district,
  ];

  for (const cand of candidates) {
    if (cand && typeof cand === "string") {
      const cleaned = cleanLocalityText(cand);
      if (cleaned.length > 0 && !/^(ward|zone)\s*\d+/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  // 2. Specific landmark / amenity / station / building
  const landmark = p.amenity || p.building || p.station || p.bus_stop || p.railway;
  if (landmark && typeof landmark === "string") {
    const cleaned = cleanLocalityText(landmark);
    if (cleaned.length > 0 && !/^(ward|zone)\s*\d+/i.test(cleaned)) {
      return cleaned;
    }
  }

  // 3. Check name (if it's not a highway or ward)
  const name = p.name;
  if (name && typeof name === "string") {
    const cleanName = cleanLocalityText(name);
    const isHighway = /highway|expressway|bypass|national highway|nh\s*\d|sh\s*\d|road|salai/i.test(cleanName);
    const isWard = /^(ward|zone)\s*\d+/i.test(cleanName);
    if (!isHighway && !isWard && cleanName.length > 0) {
      return cleanName;
    }
  }

  // 4. Check street
  const street = p.street || p.road;
  if (street && typeof street === "string") {
    const cleaned = cleanLocalityText(street);
    if (cleaned.length > 0 && !/^(ward|zone)\s*\d+/i.test(cleaned)) {
      return cleaned;
    }
  }

  if (fallbackDisplayName) {
    const parts = fallbackDisplayName.split(",");
    for (const part of parts) {
      const cleaned = cleanLocalityText(part);
      if (cleaned.length > 0 && !/^(ward|zone)\s*\d+/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return "Location";
}

/**
 * Smart Dynamic Place-to-Coordinate Resolver
 * Ensures origin/destination coordinates match the place string (e.g. Karayanchavadi -> 13.048, Tech Park -> 12.8988)
 */
export function resolvePlaceCoordinates(
  placeName: string | undefined,
  existingLat?: number,
  existingLng?: number,
  isOrigin: boolean = true,
  preferMainRoad: boolean = true
): { latitude: number; longitude: number } {
  const name = (placeName || "").toLowerCase().trim();

  // Helper with authoritative main highway/arterial road coordinates
  const lookupMainRoadPlace = (str: string): { latitude: number; longitude: number } | null => {
    if (
      str.includes("karayanchavadi") ||
      str.includes("karayan") ||
      str.includes("poonamallee") ||
      str.includes("kumunanchavadi")
    ) {
      return { latitude: 13.048, longitude: 80.091 }; // Poonamallee High Road / Bus Terminus
    }

    if (str.includes("porur bypass") || str.includes("porur")) {
      return { latitude: 13.0382, longitude: 80.1565 }; // Mount-Poonamallee / Porur Junction
    }

    if (str.includes("mugalivakkam")) {
      return { latitude: 13.0285, longitude: 80.1715 }; // Mount-Poonamallee High Road at Mugalivakkam Main Junction
    }

    if (str.includes("ramapuram") || str.includes("dlf")) {
      return { latitude: 13.0298, longitude: 80.1770 }; // Mount-Poonamallee High Road (DLF IT Park Gate)
    }

    if (str.includes("nandambakkam")) {
      return { latitude: 13.0186, longitude: 80.1843 }; // Mount-Poonamallee High Road (Trade Centre)
    }

    if (str.includes("kathipara") || str.includes("guindy")) {
      return { latitude: 13.0067, longitude: 80.202 }; // Kathipara / GST Main Road / Guindy Metro
    }

    if (str.includes("alandur")) {
      return { latitude: 13.0035, longitude: 80.2005 }; // GST Main Road / Alandur Metro
    }

    if (str.includes("saidapet") || str.includes("little mount")) {
      return { latitude: 13.0175, longitude: 80.2205 }; // Anna Salai Main Road
    }

    if (str.includes("vadapalani")) {
      return { latitude: 13.0500, longitude: 80.2121 }; // 100 Feet Road / Vadapalani Junction
    }

    if (str.includes("ashok nagar")) {
      return { latitude: 13.0368, longitude: 80.2132 }; // 100 Feet Road (Ashok Pillar)
    }

    if (str.includes("koyambedu")) {
      return { latitude: 13.0694, longitude: 80.1948 }; // Poonamallee High Road / CMBT Main Road
    }

    if (str.includes("maduravoyal")) {
      return { latitude: 13.0645, longitude: 80.1627 }; // Maduravoyal Bypass / Grade Separator
    }

    if (str.includes("kattupakkam")) {
      return { latitude: 13.0456, longitude: 80.1214 }; // Mount-Poonamallee High Road
    }

    if (str.includes("iyyappanthangal") || str.includes("iyapanthangal")) {
      return { latitude: 13.0418, longitude: 80.1417 }; // Mount-Poonamallee High Road Bus Depot
    }

    if (str.includes("ambattur")) {
      return { latitude: 13.1147, longitude: 80.1548 }; // Ambattur Industrial Estate Main Road
    }

    if (str.includes("avadi")) {
      return { latitude: 13.1188, longitude: 80.1017 }; // Avadi Main Road / Railway Station
    }

    if (str.includes("chromepet")) {
      return { latitude: 12.9516, longitude: 80.1413 }; // GST Road / Chromepet Main Road
    }

    if (str.includes("pallavaram")) {
      return { latitude: 12.9675, longitude: 80.1491 }; // GST Road / Pallavaram Flyover
    }

    if (str.includes("tambaram")) {
      return { latitude: 12.9249, longitude: 80.1332 }; // GST Road / Tambaram Sanatorium Main Road
    }

    if (str.includes("tidel")) {
      return { latitude: 12.9892, longitude: 80.2510 }; // TIDEL Park / OMR Taramani
    }

    if (str.includes("ramanujan")) {
      return { latitude: 12.9880, longitude: 80.2450 }; // Ramanujan IT City / Taramani
    }

    if (str.includes("olympia")) {
      return { latitude: 13.0135, longitude: 80.2050 }; // Olympia Tech Park / Guindy
    }

    if (
      str.includes("taramani") ||
      str.includes("tech park") ||
      str.includes("campus") ||
      str.includes("ascendas")
    ) {
      return { latitude: 12.9852, longitude: 80.2461 }; // OMR / Taramani Main Road
    }

    if (str.includes("velachery")) {
      return { latitude: 12.9815, longitude: 80.218 }; // Velachery Main Road / Bypass
    }

    if (str.includes("electronic city") || str.includes("electronicity") || str.includes("ecity")) {
      return { latitude: 12.8452, longitude: 77.6602 }; // Electronic City Hosur Road
    }

    if (str.includes("whitefield") || str.includes("itpb")) {
      return { latitude: 12.9860, longitude: 77.7340 }; // Whitefield ITPB
    }

    if (str.includes("manyata")) {
      return { latitude: 13.0470, longitude: 77.6200 }; // Manyata Tech Park Hebbal
    }

    if (str.includes("hitec") || str.includes("cyber towers") || str.includes("mindspace")) {
      return { latitude: 17.4474, longitude: 78.3762 }; // HITEC City Madhapur
    }

    if (str.includes("t. nagar") || str.includes("tnagar")) {
      return { latitude: 13.0418, longitude: 80.2341 }; // Usman Road / Panagal Park Main Road
    }

    if (str.includes("sholinganallur") || str.includes("siruseri")) {
      return { latitude: 12.8988, longitude: 80.2284 }; // Rajiv Gandhi Salai / OMR Main Road
    }

    if (str.includes("anna nagar")) {
      return { latitude: 13.0850, longitude: 80.2101 }; // 2nd Avenue / Anna Nagar Roundtana
    }

    return null;
  };

  // 1. If preferMainRoad is enabled (default true for corridors), check known arterial hubs first
  if (preferMainRoad && name) {
    const mainRoadMatch = lookupMainRoadPlace(name);
    if (mainRoadMatch) {
      return mainRoadMatch;
    }
  }

  // 2. If valid numeric coordinates are explicitly passed, use them
  if (
    typeof existingLat === "number" &&
    !isNaN(existingLat) &&
    existingLat > 8 &&
    existingLat < 38 &&
    typeof existingLng === "number" &&
    !isNaN(existingLng) &&
    existingLng > 68 &&
    existingLng < 98
  ) {
    return { latitude: existingLat, longitude: existingLng };
  }

  // 3. Fallback check name
  if (name) {
    const mainRoadMatch = lookupMainRoadPlace(name);
    if (mainRoadMatch) {
      return mainRoadMatch;
    }
  }

  // 4. Fallback defaults (Poonamallee -> Tech Park Taramani Chennai)
  return isOrigin ? { latitude: 13.048, longitude: 80.091 } : { latitude: 12.9852, longitude: 80.2461 };
}

export const geocodingService = new GeocodingService();
