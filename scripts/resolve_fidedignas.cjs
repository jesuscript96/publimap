const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// Helper to follow redirects and get final location & optionally content
function fetchUrl(targetUrl, maxRedirects = 5) {
  return new Promise((resolve) => {
    if (!targetUrl) return resolve({ finalUrl: null, html: null });
    
    let currentUrl = targetUrl;
    let redirectCount = 0;
    
    function performRequest(requestUrl) {
      if (redirectCount >= maxRedirects) {
        return resolve({ finalUrl: requestUrl, html: null });
      }
      
      const parsed = url.parse(requestUrl);
      const options = {
        method: 'GET',
        host: parsed.host,
        path: parsed.path,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8'
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
          }
          performRequest(nextUrl);
        } else if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve({ finalUrl: requestUrl, html: data });
          });
        } else {
          resolve({ finalUrl: requestUrl, html: null });
        }
      });
      
      req.on('error', () => {
        resolve({ finalUrl: requestUrl, html: null });
      });
      
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ finalUrl: requestUrl, html: null });
      });
      
      req.end();
    }
    
    performRequest(currentUrl);
  });
}

// Extract lat/lng from Google Maps URLs
function extractCoordsFromUrl(mapsUrl) {
  if (!mapsUrl) return null;
  
  // Pattern 1: @lat,lng
  let match = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'URL_@' };
  }
  
  // Pattern 2: !3dlat!4dlng
  match = mapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'URL_!3d' };
  }
  
  // Pattern 3: q=lat,lng
  match = mapsUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'URL_q=' };
  }

  // Pattern 4: /search/lat,lng
  match = mapsUrl.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'URL_search' };
  }

  // Pattern 5: /place/lat,lng
  match = mapsUrl.match(/\/place\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'URL_place' };
  }
  
  return null;
}

// Extract coordinates from HTML staticmap URLs
function extractCoordsFromHtml(html) {
  if (!html) return null;
  
  // Search for staticmap center parameter
  // e.g. staticmap?center=19.3975894%2C-99.1789056
  // Or escaped: staticmap?center\\u003d19.3975894%2C-99.1789056
  let match = html.match(/staticmap\?center(?:=|\\u003d)(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'HTML_staticmap' };
  }
  
  // Search for og:image staticmap
  match = html.match(/google\.com\/maps\/api\/staticmap\?center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), method: 'HTML_og_staticmap' };
  }
  
  // Search for coordinate arrays inside script tags
  // e.g. [null,null,19.3975894,-99.1789056]
  // Let's be careful and only return if it looks like CDMX area
  const coords = [];
  const re = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (lat > 19.1 && lat < 19.6 && lng > -99.4 && lng < -98.9) {
      coords.push({ lat, lng, method: 'HTML_bracket_match' });
    }
  }
  
  if (coords.length > 0) {
    return coords[0]; // Return first matching CDMX coords
  }
  
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Parsing URLsMaps.md...');
  const mdContent = fs.readFileSync('URLsMaps.md', 'utf8');
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
  
  console.log(`Found ${mdItems.length} items to resolve.`);
  const resolvedItems = [];
  
  for (let i = 0; i < mdItems.length; i++) {
    const item = mdItems[i];
    console.log(`[${i+1}/${mdItems.length}] Resolving: "${item.address}"`);
    
    let lat = null;
    let lng = null;
    let method = null;
    let finalUrl = item.url;
    
    // 1. Try to extract directly from URL string first
    let coords = extractCoordsFromUrl(item.url);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      method = coords.method;
    } else {
      // 2. Fetch the URL (follow redirects)
      const res = await fetchUrl(item.url);
      finalUrl = res.finalUrl || item.url;
      
      // Try extracting from final redirected URL
      coords = extractCoordsFromUrl(finalUrl);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        method = coords.method;
      } else if (res.html) {
        // Try extracting from the HTML content
        coords = extractCoordsFromHtml(res.html);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          method = coords.method;
        }
      }
    }
    
    if (lat && lng) {
      console.log(`  -> RESOLVED: ${lat}, ${lng} (via ${method})`);
    } else {
      console.log(`  -> FAILED to resolve coordinates!`);
    }
    
    resolvedItems.push({
      ...item,
      resolved_url: finalUrl,
      lat,
      lng,
      resolution_method: method
    });
    
    // Sleep a bit to avoid hitting Google Maps too hard
    await sleep(250);
  }
  
  fs.writeFileSync('fidedignas_coords.json', JSON.stringify(resolvedItems, null, 2));
  console.log(`Saved ${resolvedItems.length} resolved records to fidedignas_coords.json`);
}

main().catch(console.error);
