const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// Helper to follow redirects and get final location
function getRedirectUrl(targetUrl) {
  return new Promise((resolve) => {
    if (!targetUrl) return resolve(null);
    if (!targetUrl.includes('maps.app.goo.gl')) return resolve(targetUrl);
    
    const parsed = url.parse(targetUrl);
    const options = {
      method: 'HEAD',
      host: parsed.host,
      path: parsed.path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(targetUrl);
      }
    });
    
    req.on('error', () => {
      resolve(null);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });
    
    req.end();
  });
}

// Extract lat/lng from Google Maps URLs
function extractCoords(mapsUrl) {
  if (!mapsUrl) return null;
  
  let match = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  
  match = mapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  
  match = mapsUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  match = mapsUrl.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  match = mapsUrl.match(/\/place\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  match = mapsUrl.match(/\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat > 14 && lat < 33 && lng > -122 && lng < -86) {
      return { lat, lng };
    }
  }
  
  return null;
}

// String similarity helper (Levenshtein distance or token match)
function cleanStr(s) {
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

async function main() {
  console.log('Reading files...');
  const mdContent = fs.readFileSync('URLsMaps.md', 'utf8');
  const finalBillboards = JSON.parse(fs.readFileSync('final_billboards.json', 'utf8'));
  const rawBillboards = JSON.parse(fs.readFileSync('publimex_billboards.json', 'utf8'));
  
  // Parse mdContent
  const lines = mdContent.split(/\r?\n/);
  const mdItems = [];
  let currentCategory = '';
  
  for (const line of lines) {
    if (line.includes('**MUROS**')) {
      currentCategory = 'Muro';
    } else if (line.includes('**PANTALLAS DIGITALES**')) {
      currentCategory = 'Pantalla Digital';
    } else if (line.includes('**VALLAS**')) {
      currentCategory = 'Valla';
    }
    
    if (line.trim().startsWith('- ')) {
      const parts = line.replace('- ', '').split(/→|->/);
      if (parts.length >= 2) {
        const address = parts[0].trim();
        const urlStr = parts.slice(1).join('→').trim();
        mdItems.push({
          category: currentCategory,
          address,
          url: urlStr
        });
      }
    }
  }
  
  console.log(`Parsed ${mdItems.length} items from URLsMaps.md.`);
  console.log(`Found ${finalBillboards.length} items in final_billboards.json.`);
  console.log(`Found ${rawBillboards.length} items in publimex_billboards.json.`);
  
  const comparison = [];
  
  for (const mdItem of mdItems) {
    // Try to find the best match in final_billboards
    let bestMatch = null;
    let maxSim = 0;
    
    for (const b of finalBillboards) {
      // Compare addresses
      const sim = jaccardSimilarity(mdItem.address, b.address);
      if (sim > maxSim) {
        maxSim = sim;
        bestMatch = b;
      }
    }
    
    // Also try matching by URL if similarity is low but URL matches
    if (maxSim < 0.5) {
      const matchByUrl = finalBillboards.find(b => {
        return b.original_maps_url === mdItem.url || b.resolved_maps_url === mdItem.url;
      });
      if (matchByUrl) {
        bestMatch = matchByUrl;
        maxSim = 1.0; // Perfect match by URL
      }
    }
    
    comparison.push({
      mdItem,
      bestMatch,
      similarity: maxSim
    });
  }
  
  // Output matches and unmatched items
  const matches = comparison.filter(c => c.similarity >= 0.3);
  const lowMatches = comparison.filter(c => c.similarity < 0.3);
  
  console.log(`\n--- HIGH SIMILARITY MATCHES (${matches.length}) ---`);
  matches.forEach(m => {
    console.log(`MD Address: "${m.mdItem.address}"`);
    console.log(`DB Address: "${m.bestMatch.address}" (ID: ${m.bestMatch.id}, Sim: ${m.similarity.toFixed(2)})`);
    console.log(`MD URL: ${m.mdItem.url}`);
    console.log(`DB URL: ${m.bestMatch.original_maps_url}`);
    console.log(`DB Lat/Lng: ${m.bestMatch.lat}, ${m.bestMatch.lng}`);
    console.log('------------------');
  });
  
  console.log(`\n--- LOW SIMILARITY / UNMATCHED (${lowMatches.length}) ---`);
  lowMatches.forEach(m => {
    console.log(`MD Address: "${m.mdItem.address}"`);
    console.log(`MD URL: ${m.mdItem.url}`);
    if (m.bestMatch) {
      console.log(`Best DB candidate: "${m.bestMatch.address}" (ID: ${m.bestMatch.id}, Sim: ${m.similarity.toFixed(2)})`);
    } else {
      console.log(`No DB candidate found.`);
    }
    console.log('------------------');
  });

  // Let's also check if there are DB items that didn't match any MD item
  const matchedDbIds = new Set(matches.map(m => m.bestMatch.id));
  const unmatchedDbItems = finalBillboards.filter(b => !matchedDbIds.has(b.id));
  console.log(`\n--- UNMATCHED DATABASE ITEMS (${unmatchedDbItems.length}) ---`);
  unmatchedDbItems.forEach(b => {
    console.log(`DB ID: ${b.id}, Address: "${b.address}", URL: ${b.original_maps_url}, Lat/Lng: ${b.lat}, ${b.lng}`);
  });
}

main().catch(console.error);
