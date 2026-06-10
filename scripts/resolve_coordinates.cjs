const fs = require('fs');
const https = require('https');
const url = require('url');

const rawRecords = JSON.parse(fs.readFileSync('publimex_billboards.json', 'utf8'));
const records = rawRecords.filter(r => r.fields && r.fields.Zona === 'CDMX');


// Helper to follow redirects and get final location
function getRedirectUrl(targetUrl) {
  return new Promise((resolve) => {
    if (!targetUrl) return resolve(null);
    
    // Parse URL
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
  
  // Pattern 1: @lat,lng
  let match = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  
  // Pattern 2: !3dlat!4dlng
  match = mapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  
  // Pattern 3: q=lat,lng
  match = mapsUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Pattern 4: /search/lat,lng (sometimes with + sign)
  match = mapsUrl.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Pattern 5: /place/lat,lng
  match = mapsUrl.match(/\/place\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Pattern 6: Any lat,lng pattern inside path like /19.1234,-99.1234
  match = mapsUrl.match(/\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    // Ensure coordinates are within reasonable Mexico bounds
    if (lat > 14 && lat < 33 && lng > -122 && lng < -86) {
      return { lat, lng };
    }
  }
  
  return null;
}

async function main() {
  const resolvedRecords = [];
  console.log(`Processing ${records.length} records...`);
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const fields = record.fields;
    const mapsUrl = fields.URL_Maps;
    
    let lat = null;
    let lng = null;
    let resolvedUrl = mapsUrl;
    
    if (mapsUrl) {
      if (mapsUrl.includes('maps.app.goo.gl')) {
        resolvedUrl = await getRedirectUrl(mapsUrl);
        // Sometimes google redirects twice, let's try to extract from resolved url
        let coords = extractCoords(resolvedUrl);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        } else if (resolvedUrl) {
          // try redirect again if it's still a short URL or intermediate
          const secondResolved = await getRedirectUrl(resolvedUrl);
          coords = extractCoords(secondResolved);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            resolvedUrl = secondResolved;
          }
        }
      } else {
        const coords = extractCoords(mapsUrl);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
    }
    
    resolvedRecords.push({
      id: fields.ID || fields['﻿ID'],
      address: fields.Direccion,
      reference: fields.Referencia,
      category: fields.Categoria,
      size: fields.Medida,
      width: fields.Ancho_m,
      height: fields.Alto_m,
      area_m2: fields.M2,
      price: fields.Precio_MXN,
      available: fields.Disponible === 'Sí',
      images: fields.Imagenes ? fields.Imagenes.map(img => img.url) : [],
      original_maps_url: mapsUrl,
      resolved_maps_url: resolvedUrl,
      lat,
      lng
    });
    
    if (lat && lng) {
      console.log(`[OK] ID ${fields.ID || fields['﻿ID']}: ${lat}, ${lng}`);
    } else {
      console.log(`[PENDING] ID ${fields.ID || fields['﻿ID']}: ${fields.Direccion}`);
    }
  }
  
  fs.writeFileSync('resolved_billboards.json', JSON.stringify(resolvedRecords, null, 2));
  const successCount = resolvedRecords.filter(r => r.lat && r.lng).length;
  console.log(`Done! Resolved ${successCount}/${records.length} records.`);
}

main();
