const fs = require('fs');
const records = JSON.parse(fs.readFileSync('publimex_billboards.json', 'utf8'));

console.log(`Total records: ${records.length}`);

let withMapsUrl = 0;
let withCoors = 0;
let formatCounts = {};

records.forEach(r => {
  const fields = r.fields;
  if (fields.URL_Maps) {
    withMapsUrl++;
  }
  
  // check if there are explicit Lat/Lng fields
  const latField = Object.keys(fields).find(k => k.toLowerCase().includes('lat') || k.toLowerCase().includes('coor') || k.toLowerCase().includes('gps'));
  const lngField = Object.keys(fields).find(k => k.toLowerCase().includes('lon') || k.toLowerCase().includes('lng'));
  
  if (latField && lngField) {
    withCoors++;
  }
  
  const cat = fields.Categoria || 'Uncategorized';
  formatCounts[cat] = (formatCounts[cat] || 0) + 1;
});

console.log(`Records with URL_Maps: ${withMapsUrl}`);
console.log(`Records with explicit coordinate fields: ${withCoors}`);
console.log('Category breakdown:', formatCounts);

// Let's inspect the first 5 records with URL_Maps
console.log('\nSample URL_Maps values:');
records.slice(0, 10).forEach(r => {
  console.log(`ID: ${r.fields.ID || r.fields['﻿ID']}, Address: ${r.fields.Direccion}, URL: ${r.fields.URL_Maps}`);
});
