const fs = require('fs');
const { execSync } = require('child_process');

console.log('Running apply_truth.cjs to ensure correct coordinates...');
try {
  execSync('node scripts/apply_truth.cjs', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run apply_truth.cjs:', err);
}

const rawSpaces = JSON.parse(fs.readFileSync('publimex_billboards.json', 'utf8'));
const rawReservations = JSON.parse(fs.readFileSync('publimex_reservations.json', 'utf8'));
const allResolvedBillboards = JSON.parse(fs.readFileSync('final_billboards.json', 'utf8'));

// Identify space numerical IDs that belong to the CDMX zone
const cdmxNumericalIds = new Set([84, 85, 86]);
rawSpaces.forEach(space => {
  if (space.fields && space.fields.Zona === 'CDMX') {
    const numId = space.fields.ID || space.fields['﻿ID'];
    if (numId !== undefined && numId !== null) {
      cdmxNumericalIds.add(numId);
    }
  }
});

// Filter resolved billboards to only include CDMX zone records
const resolvedBillboards = allResolvedBillboards.filter(b => cdmxNumericalIds.has(b.id));


// World Cup 2026 dates in Mexico
const WC_START = new Date('2026-06-11');
const WC_END = new Date('2026-07-19');

console.log(`World Cup 2026: ${WC_START.toISOString().split('T')[0]} to ${WC_END.toISOString().split('T')[0]}`);

// Create a map of Airtable Space ID -> numerical ID
const airtableIdToNumericalId = {};
rawSpaces.forEach(space => {
  const numId = space.fields.ID || space.fields['﻿ID'];
  airtableIdToNumericalId[space.id] = numId;
});

// Analyze reservations
const spaceReservations = {}; // numId -> array of reservations
let totalReservations = 0;

rawReservations.forEach(res => {
  const fields = res.fields;
  const spaceIds = fields['Espacio (Nuevo)'] || [];
  const status = fields.Estado;
  
  if (status !== 'Confirmada') return; // only process confirmed reservations
  
  const startStr = fields.Fecha_Inicio;
  const endStr = fields.Fecha_Fin;
  
  if (!startStr || !endStr) return;
  
  const start = new Date(startStr);
  const end = new Date(endStr);
  
  spaceIds.forEach(spaceId => {
    const numId = airtableIdToNumericalId[spaceId];
    if (!numId) return;
    
    if (!spaceReservations[numId]) {
      spaceReservations[numId] = [];
    }
    
    spaceReservations[numId].push({
      id: fields.ID_Reservacion,
      start,
      end,
      startStr,
      endStr
    });
    totalReservations++;
  });
});

console.log(`Found ${totalReservations} active confirmed reservations mapped to spaces.`);

// Check availability for each resolved billboard
let totalReserved = 0;
let totalAvailable = 0;

const updatedBillboards = resolvedBillboards.map(b => {
  const reservations = spaceReservations[b.id] || [];
  
  // A billboard is occupied completely during the World Cup if there is a reservation that covers the entire World Cup period
  // meaning reservation start <= WC_START and reservation end >= WC_END
  let isOccupiedDuringWC = false;
  
  reservations.forEach(r => {
    if (r.start <= WC_START && r.end >= WC_END) {
      isOccupiedDuringWC = true;
    }
  });
  
  if (isOccupiedDuringWC) {
    b.available = false;
    totalReserved++;
  } else {
    b.available = true;
    totalAvailable++;
  }
  
  return b;
});

console.log(`Summary of WC 2026 occupancy:`);
console.log(`- Occupied/Reserved (WC): ${totalReserved}`);
console.log(`- Available (WC): ${totalAvailable}`);

// Save updated JSON
fs.writeFileSync('final_billboards.json', JSON.stringify(updatedBillboards, null, 2));

// Generate standard GeoJSON
const geojson = {
  type: 'FeatureCollection',
  features: updatedBillboards.map(b => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [b.lng, b.lat]
    },
    properties: {
      id: b.id,
      address: b.address,
      reference: b.reference || '',
      category: b.category,
      size: b.size || '',
      width: b.width || 0,
      height: b.height || 0,
      area_m2: b.area_m2 || 0,
      price: b.price || 0,
      available: b.available,
      images: b.images || []
    }
  }))
};

fs.writeFileSync('public/billboards.geojson', JSON.stringify(geojson, null, 2));
console.log(`Successfully generated public/billboards.geojson with updated availability.`);

// Also update src/data/billboards.geojson to keep in sync
try {
  fs.writeFileSync('src/data/billboards.geojson', JSON.stringify(geojson, null, 2));
  console.log(`Successfully updated src/data/billboards.geojson.`);
} catch (err) {
  console.error('Failed to write to src/data/billboards.geojson:', err);
}
