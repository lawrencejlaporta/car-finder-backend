const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

let cachedListings = [];
let lastUpdated = null;

async function scrapeCraigslist(location = 'newyork', query = 'cars+trucks') {
  const listings = [];
  try {
    const url = `https://${location}.craigslist.org/search/cta?query=${query}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    $('.result-row').each((i, elem) => {
      const title = $(elem).find('.result-title').text().trim();
      const price = $(elem).find('.result-price').text().replace('$', '').replace(',', '');
      const location = $(elem).find('.result-hood').text().trim();
      const url = $(elem).find('.result-title').attr('href');
      const image = $(elem).find('.result-image').attr('data-ids');
      
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;
      
      if (year && price) {
        listings.push({
          id: `cl_${i}_${Date.now()}`,
          title,
          year,
          price: parseInt(price) || 0,
          location: location.replace('(', '').replace(')', ''),
          url,
          source: 'Craigslist',
          image: image ? `https://images.craigslist.org/${image.split(',')[0].split(':')[1]}_300x300.jpg` : null,
          scrapedAt: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    console.error('Scraping error:', error.message);
  }
  return listings;
}

function normalizeCarData(rawListing) {
  const title = rawListing.title || '';
  const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes', 'Tesla', 'Nissan', 'Hyundai', 'Jeep'];
  let make = '';
  let model = '';
  
  for (const m of makes) {
    if (title.toLowerCase().includes(m.toLowerCase())) {
      make = m;
      const parts = title.split(m);
      if (parts[1]) {
        model = parts[1].trim().split(' ')[0];
      }
      break;
    }
  }
  
  const bodyTypes = ['sedan', 'suv', 'truck', 'coupe', 'wagon', 'van', 'hatchback'];
  const bodyType = bodyTypes.find(type => title.toLowerCase().includes(type)) || 'Sedan';
  
  return {
    ...rawListing,
    make: make || 'Unknown',
    model: model || 'Unknown',
    bodyType: bodyType.charAt(0).toUpperCase() + bodyType.slice(1),
    transmission: 'Automatic',
    fuelType: title.toLowerCase().includes('hybrid') ? 'Hybrid' : 
              title.toLowerCase().includes('electric') ? 'Electric' : 'Gasoline',
    features: [],
    dealer: rawListing.source || 'Private Seller',
    distance: Math.floor(Math.random() * 30) + 5,
    warranty: 'As-Is',
    mileage: 0
  };
}

app.get('/api/listings', async (req, res) => {
  try {
    if (cachedListings.length > 0 && lastUpdated) {
      const hoursSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        return res.json({
          listings: cachedListings,
          cached: true,
          lastUpdated,
          count: cachedListings.length
        });
      }
    }
    
    console.log('Fetching fresh listings...');
    const clListings = await scrapeCraigslist('newyork');
    const ctListings = await scrapeCraigslist('newlondon');
    
    const allListings = [...clListings, ...ctListings].map(normalizeCarData);
    
    cachedListings = allListings;
    lastUpdated = Date.now();
    
    res.json({
      listings: allListings,
      cached: false,
      lastUpdated,
      count: allListings.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const clListings = await scrapeCraigslist('newyork');
    const ctListings = await scrapeCraigslist('newlondon');
    
    const allListings = [...clListings, ...ctListings].map(normalizeCarData);
    
    cachedListings = allListings;
    lastUpdated = Date.now();
    
    res.json({
      message: 'Listings refreshed successfully',
      count: allListings.length,
      lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    listingsCount: cachedListings.length,
    lastUpdated 
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Car scraper service running on port ${PORT}`);
});

module.exports = app;
