const fs = require('fs');

function cleanStr(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTokens(s) {
  return new Set(cleanStr(s).split(' ').filter(x => x.length > 1));
}

function jaccardSimilarity(s1, s2) {
  const t1 = getTokens(s1);
  const t2 = getTokens(s2);
  if (t1.size === 0 || t2.size === 0) return 0;
  
  const intersection = new Set([...t1].filter(x => t2.has(x)));
  const union = new Set([...t1, ...t2]);
  return intersection.size / union.size;
}

function main() {
  const fidedignas = JSON.parse(fs.readFileSync('fidedignas_coords.json', 'utf8'));
  const dbItems = JSON.parse(fs.readFileSync('final_billboards.json', 'utf8'));
  
  console.log(`Original DB items count: ${dbItems.length}`);
  
  // 1. Pre-insert missing items so they can be matched properly in the loop
  const missingItems = [
    {
      id: 84,
      address: "ALTATA Nº22, CONDESA",
      reference: "Muro en Altata 22, Condesa",
      category: "Muro",
      size: "Por confirmar",
      width: 0,
      height: 0,
      area_m2: 0,
      price: 0,
      available: true,
      images: [],
      original_maps_url: "https://maps.app.goo.gl/NnZmX5cH1p7EKxTU9",
      resolved_maps_url: "https://maps.app.goo.gl/NnZmX5cH1p7EKxTU9",
      lat: 19.4063034,
      lng: -99.1751637
    },
    {
      id: 85,
      address: "PERIFÉRICO NORTE, ESQ. CALLE 5 Nº39",
      reference: "Muro en Periférico Norte y Calle 5, Naucalpan (Edomex)",
      category: "Muro",
      size: "Por confirmar",
      width: 0,
      height: 0,
      area_m2: 0,
      price: 0,
      available: true,
      images: [],
      original_maps_url: "https://maps.app.goo.gl/5S1Z3hrJbcxKMkgs7",
      resolved_maps_url: "https://maps.app.goo.gl/5S1Z3hrJbcxKMkgs7",
      lat: 19.4674309,
      lng: -99.2282593
    },
    {
      id: 86,
      address: "PERIFÉRICO SUR N°4192",
      reference: "Muro en Periférico Sur 4192 near TV Azteca",
      category: "Muro",
      size: "Por confirmar",
      width: 0,
      height: 0,
      area_m2: 0,
      price: 0,
      available: true,
      images: [],
      original_maps_url: "https://maps.app.goo.gl/SnryWkrBnBhLa7sP6",
      resolved_maps_url: "https://maps.app.goo.gl/SnryWkrBnBhLa7sP6",
      lat: 19.3062178,
      lng: -99.2094741
    }
  ];
  
  missingItems.forEach(item => {
    if (!dbItems.some(db => db.id === item.id || db.address === item.address)) {
      dbItems.push(item);
      console.log(`[PRE-INSERTED MISSING ITEM] ID ${item.id}: "${item.address}"`);
    }
  });

  // Explicit overrides: key is cleanAddress representation or URL of list item, val is DB ID
  const explicitMappings = {
    // Jalapa N°18 in list corresponds to DB ID 39 (Jalapa 15)
    'https://www.google.com/maps?q=place_id:ChIJZaTK1DD_0YURunXeAVL0eZk': 39,
    // Periferico Sur N°4192 in list corresponds to DB ID 86
    'https://maps.app.goo.gl/SnryWkrBnBhLa7sP6': 86,
    // Altata Nº22 in list corresponds to DB ID 84
    'https://maps.app.goo.gl/NnZmX5cH1p7EKxTU9': 84,
    // Periferico Norte Calle 5 in list corresponds to DB ID 85
    'https://maps.app.goo.gl/5S1Z3hrJbcxKMkgs7': 85
  };
  
  // 2. Map each fidedigna item to a DB item and update DB item's coordinates
  const matchedDbIds = new Set();
  
  for (const f of fidedignas) {
    let bestMatch = null;
    let maxSim = 0;
    
    // Check explicit mapping first
    if (explicitMappings[f.url]) {
      const explicitId = explicitMappings[f.url];
      bestMatch = dbItems.find(db => db.id === explicitId);
      if (bestMatch) {
        maxSim = 1.0;
        console.log(`[EXPLICIT MAP] List item "${f.address}" mapped to DB ID ${bestMatch.id}`);
      }
    }
    
    // Check URL next
    if (!bestMatch) {
      const matchByUrl = dbItems.find(db => {
        if (!db.original_maps_url && !db.resolved_maps_url) return false;
        return db.original_maps_url === f.url || 
               db.resolved_maps_url === f.url || 
               db.original_maps_url === f.resolved_url ||
               db.resolved_maps_url === f.resolved_url;
      });
      
      if (matchByUrl) {
        bestMatch = matchByUrl;
        maxSim = 1.0;
      }
    }
    
    // Find by address similarity next
    if (!bestMatch) {
      for (const db of dbItems) {
        // Skip already matched IDs if we have another choice
        if (matchedDbIds.has(db.id)) continue;
        
        const sim = jaccardSimilarity(f.address, db.address);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = db;
        }
      }
    }
    
    // Update matched item
    if (bestMatch && maxSim >= 0.3) {
      bestMatch.lat = f.lat;
      bestMatch.lng = f.lng;
      if (f.url) bestMatch.original_maps_url = f.url;
      if (f.resolved_url) bestMatch.resolved_maps_url = f.resolved_url;
      matchedDbIds.add(bestMatch.id);
      console.log(`[UPDATED COORDS] ID ${bestMatch.id}: "${bestMatch.address}" set to ${f.lat}, ${f.lng}`);
    } else {
      console.log(`[NO DB MATCH FOUND FOR LIST ITEM] Address: "${f.address}"`);
    }
  }

  // 3. Update duplicate/extra database items at the same address
  dbItems.forEach(db => {
    // Patriotismo 483 (ID 48 -> copy ID 47 coordinates)
    if (db.id === 48) {
      const parent = dbItems.find(x => x.id === 47);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Insurgentes Sur 568 Muro Viaducto (ID 8 -> copy ID 7 coordinates)
    if (db.id === 8) {
      const parent = dbItems.find(x => x.id === 7);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Torre Neo (ID 33 -> copy ID 32 coordinates)
    if (db.id === 33) {
      const parent = dbItems.find(x => x.id === 32);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Periferico Sur 5185 (ID 35 -> copy ID 34 coordinates)
    if (db.id === 35) {
      const parent = dbItems.find(x => x.id === 34);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Periferico Sur 3380 (ID 23 -> copy ID 24 coordinates)
    if (db.id === 23) {
      const parent = dbItems.find(x => x.id === 24);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Periferico 131 variations (ID 26, 28 -> copy ID 25 coordinates)
    if (db.id === 26 || db.id === 28) {
      const parent = dbItems.find(x => x.id === 25 || x.id === 27);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Viaducto 35 (ID 37 -> copy ID 36 coordinates)
    if (db.id === 37) {
      const parent = dbItems.find(x => x.id === 36);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Perisur Estepa (ID 57 -> copy ID 56 coordinates)
    if (db.id === 57) {
      const parent = dbItems.find(x => x.id === 56);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Periferico Sur 5550 El Caracol (ID 54 -> copy ID 55 coordinates)
    if (db.id === 54) {
      const parent = dbItems.find(x => x.id === 55);
      if (parent) { db.lat = parent.lat; db.lng = parent.lng; }
    }
    // Aeropuerto T1 (ID 58, 59, 61 -> T1 coordinates)
    if (db.id === 58 || db.id === 59 || db.id === 61) {
      db.lat = 19.4361;
      db.lng = -99.0719;
    }
    // Aeropuerto T2 (ID 60 -> T2 coordinates)
    if (db.id === 60) {
      db.lat = 19.4302;
      db.lng = -99.0854;
    }
    // Periferico Sur 1795 (ID 66, 67 -> correct coordinates)
    if (db.id === 66 || db.id === 67) {
      db.lat = 19.3585;
      db.lng = -99.1985;
    }
  });
  
  fs.writeFileSync('final_billboards.json', JSON.stringify(dbItems, null, 2));
  console.log(`Saved ${dbItems.length} records back to final_billboards.json.`);
}

main();
