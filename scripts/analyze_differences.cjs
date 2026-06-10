const fs = require('fs');

// Haversine formula to compute distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180; // φ, λ in radians
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

function cleanStr(s) {
  if (!s) return '';
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ' ') // alphanumeric only
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
  
  const report = {
    total_fidedignas: fidedignas.length,
    total_db_items: dbItems.length,
    matched: [],
    unmatched_fidedigna: [],
    unmatched_db: []
  };
  
  const matchedDbIds = new Set();
  
  for (const f of fidedignas) {
    // 1. Try to find direct URL match first
    let bestMatch = null;
    let maxSim = 0;
    
    const matchByUrl = dbItems.find(db => {
      if (!db.original_maps_url && !db.resolved_maps_url) return false;
      return db.original_maps_url === f.url || 
             db.resolved_maps_url === f.url || 
             db.original_maps_url === f.resolved_url ||
             db.resolved_maps_url === f.resolved_url;
    });
    
    if (matchByUrl) {
      bestMatch = matchByUrl;
      maxSim = 1.0; // Perfect match by URL
    } else {
      // 2. Find the best match by address similarity
      for (const db of dbItems) {
        const sim = jaccardSimilarity(f.address, db.address);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = db;
        }
      }
    }
    
    if (bestMatch && maxSim >= 0.3) {
      matchedDbIds.add(bestMatch.id);
      
      const distance = getDistance(f.lat, f.lng, bestMatch.lat, bestMatch.lng);
      
      report.matched.push({
        fidedigna: {
          address: f.address,
          category: f.category,
          url: f.url,
          lat: f.lat,
          lng: f.lng
        },
        db: {
          id: bestMatch.id,
          address: bestMatch.address,
          category: bestMatch.category,
          lat: bestMatch.lat,
          lng: bestMatch.lng,
          original_url: bestMatch.original_maps_url
        },
        similarity: maxSim,
        distance_meters: distance,
        is_coord_diff: distance > 100 // different if > 100 meters
      });
    } else {
      report.unmatched_fidedigna.push(f);
    }
  }
  
  // Unmatched DB items
  dbItems.forEach(db => {
    if (!matchedDbIds.has(db.id)) {
      report.unmatched_db.push(db);
    }
  });
  
  fs.writeFileSync('differences_report.json', JSON.stringify(report, null, 2));
  
  // Output a quick text summary
  console.log('--- ANALYSIS SUMMARY ---');
  console.log(`Fidedignas in list: ${fidedignas.length}`);
  console.log(`Database items: ${dbItems.length}`);
  console.log(`Matched items: ${report.matched.length}`);
  console.log(`Unmatched list items (Missing in DB or poor similarity): ${report.unmatched_fidedigna.length}`);
  console.log(`Unmatched database items (Extra or not in list): ${report.unmatched_db.length}`);
  
  const coordDiffs = report.matched.filter(m => m.is_coord_diff);
  console.log(`Matched items with coordinate differences > 100m: ${coordDiffs.length}`);
  
  console.log('\n--- DETAILED COORD DIFFERENCES (> 100m) ---');
  coordDiffs.forEach(c => {
    console.log(`ID ${c.db.id}: "${c.fidedigna.address}"`);
    console.log(`  List:  ${c.fidedigna.lat}, ${c.fidedigna.lng}`);
    console.log(`  DB:    ${c.db.lat}, ${c.db.lng}`);
    console.log(`  Diff:  ${c.distance_meters ? c.distance_meters.toFixed(0) : 'N/A'} meters`);
  });
  
  console.log('\n--- MISSING IN DB (Unmatched List Items) ---');
  report.unmatched_fidedigna.forEach(u => {
    console.log(`Address: "${u.address}" | URL: ${u.url} | Coords: ${u.lat}, ${u.lng}`);
  });
  
  console.log('\n--- EXTRA IN DB (Unmatched DB Items) ---');
  report.unmatched_db.forEach(u => {
    console.log(`ID ${u.id}: "${u.address}" | Coords: ${u.lat}, ${u.lng}`);
  });
}

main();
