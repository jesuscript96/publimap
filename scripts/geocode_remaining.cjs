const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

const resolved = JSON.parse(fs.readFileSync('resolved_billboards.json', 'utf8'));

// Helper to query Nominatim
function geocodeNominatim(addressQuery) {
  return new Promise((resolve) => {
    const query = querystring.stringify({
      q: addressQuery,
      format: 'json',
      limit: 1
    });
    
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/search?${query}`,
      headers: {
        'User-Agent': 'PublimapGeocodingScript/1.0 (contact: test@example.com)'
      }
    };
    
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const results = JSON.parse(data);
            if (results && results.length > 0) {
              resolve({
                lat: parseFloat(results[0].lat),
                lng: parseFloat(results[0].lon)
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
    
    // Respect Nominatim usage policy (1 request/second)
    await sleep(1000);
    
    let coords = await geocodeNominatim(query);
    if (!coords) {
      // Try a simpler query if it fails
      const simplerQuery = item.address.split(',')[0] + ", México";
      console.log(`  Failed. Trying simpler query: "${simplerQuery}"`);
      await sleep(1000);
      coords = await geocodeNominatim(simplerQuery);
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
