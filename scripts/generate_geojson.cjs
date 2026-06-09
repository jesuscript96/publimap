const fs = require('fs');

const billboards = JSON.parse(fs.readFileSync('final_billboards.json', 'utf8'));

const geojson = {
  type: 'FeatureCollection',
  features: billboards.map(b => ({
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

fs.writeFileSync('billboards.geojson', JSON.stringify(geojson, null, 2));
console.log(`Successfully generated billboards.geojson with ${geojson.features.length} features.`);
