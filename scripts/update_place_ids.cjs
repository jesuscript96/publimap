const fs = require('fs');

const resolved = JSON.parse(fs.readFileSync('fidedignas_coords.json', 'utf8'));

const updates = {
  'https://www.google.com/maps?q=place_id:ChIJ44cEtSAA0oURBd42ZpJHnPI': { lat: 19.3655268, lng: -99.1911672, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJlWOMRicA0oURyShcQ8HudYg': { lat: 19.3660022, lng: -99.1911649, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJg_7qGiX50YURrlKhBb_V7gE': { lat: 19.4470441, lng: -99.1364935, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJWbbjOAAC0oURlc1XU2YJhoI': { lat: 19.4333176, lng: -99.1911802, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJw7SpoOcB0oURk4RQVOnmyMo': { lat: 19.4081772, lng: -99.1981674, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJvSfNwDj_0YURDOUCCq251mU': { lat: 19.4151819, lng: -99.1662538, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJZaTK1DD_0YURunXeAVL0eZk': { lat: 19.42285, lng: -99.1622036, method: 'BROWSER_PlaceID' },
  'https://www.google.com/maps?q=place_id:ChIJZRjy3cAB0oURLpwpX-0DQaI': { lat: 19.4013868, lng: -99.2097117, method: 'BROWSER_PlaceID' }
};

let updatedCount = 0;
resolved.forEach(item => {
  if (updates[item.url]) {
    item.lat = updates[item.url].lat;
    item.lng = updates[item.url].lng;
    item.resolution_method = updates[item.url].method;
    updatedCount++;
  }
});

fs.writeFileSync('fidedignas_coords.json', JSON.stringify(resolved, null, 2));
console.log(`Updated ${updatedCount} Place ID items in fidedignas_coords.json.`);
