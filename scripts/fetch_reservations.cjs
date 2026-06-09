const fs = require('fs');
const https = require('https');
const path = require('path');

// Load environment variables from .env file
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        process.env[key] = val;
      }
    });
  }
} catch (err) {
  // ignore
}

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const BASE_ID = 'appW4QjUOV9nXQkx9';
const TABLE_ID = 'tbluUAzNFSuaqMrYX'; // Reservations table

function fetchAllRecords(offset = '') {
  return new Promise((resolve, reject) => {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
    if (offset) {
      url += `?offset=${offset}`;
    }

    const options = {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Status Code: ${res.statusCode}. Body: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  let allRecords = [];
  let offset = '';
  console.log('Fetching reservations from Airtable...');
  
  do {
    try {
      const response = await fetchAllRecords(offset);
      allRecords = allRecords.concat(response.records);
      offset = response.offset || '';
      console.log(`Fetched ${response.records.length} records. Total so far: ${allRecords.length}`);
    } catch (err) {
      console.error('Error fetching records:', err);
      process.exit(1);
    }
  } while (offset);

  const outputPath = 'publimex_reservations.json';
  fs.writeFileSync(outputPath, JSON.stringify(allRecords, null, 2));
  console.log(`Successfully saved ${allRecords.length} reservations to ${outputPath}`);
}

main();
