const fs = require('fs');
const https = require('https');
const path = require('path');

const resolved = JSON.parse(fs.readFileSync('resolved_billboards.json', 'utf8'));

// Load Mapbox Token from .env
let MAPBOX_TOKEN = '';
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key === 'VITE_MAPBOX_ACCESS_TOKEN') {
          MAPBOX_TOKEN = val;
        }
      }
    });
  }
} catch (err) {
  // ignore
}

// Helper to query Mapbox Places API
function geocodeMapbox(addressQuery) {
  return new Promise((resolve) => {
    if (!MAPBOX_TOKEN) {
      console.error('Error: VITE_MAPBOX_ACCESS_TOKEN not found in .env');
      return resolve(null);
    }
    const query = encodeURIComponent(addressQuery);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=mx&limit=1`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const results = JSON.parse(data);
            if (results && results.features && results.features.length > 0) {
              const center = results.features[0].center; // [lng, lat]
              resolve({
                lat: center[1],
                lng: center[0]
              });
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clean address query for better geocoding results
function cleanAddress(address, id) {
  let cleaned = address;
  
  // Specific cleanups for problematic records
  if (id === 15) return "Horacio 604, Polanco, Ciudad de México, México";
  if (id === 58 || id === 59 || id === 60) return "Terminal 1, Aeropuerto Internacional de la Ciudad de México, México";
  if (id === 83) return "Mercado Dalia, Costera Miguel Alemán, Acapulco, Guerrero, México";
  if (id === 82 || id === 81) return "Boulevard de las Naciones, Acapulco, Guerrero, México";
  if (id === 78 || id === 77) return "Blvd. Miguel Alemán, Camino al Cerrillo, Toluca, Estado de México, México";
  if (id === 80 || id === 79) return "Blvd. Adolfo López Mateos 302, San Pedro Totoltepec, Toluca, Estado de México, México";
  if (id === 75 || id === 76) return "Via Morelos 252, Santa María Tulpetlac, Ecatepec, Estado de México, México";
  if (id === 73 || id === 74) return "Vía José López Portillo, San Francisco Coacalco, Estado de México, México";
  if (id === 14) return "Avenida Insurgentes Sur, Popocatépetl, Ciudad de México, México";
  if (id === 52) return "Avenida Insurgentes Sur 586, Benito Juárez, Ciudad de México, México";
  if (id === 50) return "Viaducto Río Becerra 451, Nápoles, Benito Juárez, Ciudad de México, México";
  if (id === 39) return "Jalapa 15, Roma Norte, Cuauhtémoc, Ciudad de México, México";
  
  // Remove numbers and parenthetical info for general cleanup
  cleaned = cleaned.replace(/\(.*\)/g, '');
  cleaned = cleaned.replace(/N°\s*\d+/gi, '');
  cleaned = cleaned.replace(/N°/gi, '');
  
  // Append region
  if (cleaned.toLowerCase().includes('acapulco')) {
    cleaned += ", Guerrero, México";
  } else if (cleaned.toLowerCase().includes('toluca') || cleaned.toLowerCase().includes('ecatepec') || cleaned.toLowerCase().includes('coacalco')) {
    cleaned += ", Estado de México, México";
  } else {
    cleaned += ", Ciudad de México, México";
  }
  
  return cleaned;
}

async function main() {
  const finalRecords = [];
  console.log("Geocoding remaining records...");
  
  for (let i = 0; i < resolved.length; i++) {
    const item = resolved[i];
    if (item.lat && item.lng) {
      finalRecords.push(item);
      continue;
    }
    
    const query = cleanAddress(item.address, item.id);
    console.log(`Geocoding ID ${item.id}: "${item.address}" -> Query: "${query}"`);
    
    // Sleep briefly to respect API guidelines
    await sleep(100);
    
    let coords = await geocodeMapbox(query);
    if (!coords) {
      // Try a simpler query if it fails
      const simplerQuery = item.address.split(',')[0] + ", México";
      console.log(`  Failed. Trying simpler query: "${simplerQuery}"`);
      await sleep(100);
      coords = await geocodeMapbox(simplerQuery);
    }
    
    if (coords) {
      item.lat = coords.lat;
      item.lng = coords.lng;
      console.log(`  [FOUND] ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`  [NOT FOUND] using default CDMX coordinates as fallback`);
      // Fallback near a central point in CDMX if all geocoding fails
      item.lat = 19.4326 + (Math.random() - 0.5) * 0.05;
      item.lng = -99.1332 + (Math.random() - 0.5) * 0.05;
    }
    
    finalRecords.push(item);
  }
  
  fs.writeFileSync('final_billboards.json', JSON.stringify(finalRecords, null, 2));
  console.log(`Saved all ${finalRecords.length} records to final_billboards.json`);
}

main();
