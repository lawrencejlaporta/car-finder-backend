import axios from 'axios';
import * as cheerio from 'cheerio';

// In-memory cache (persists during function lifetime)
let cachedListings = [];
let lastUpdated = null;

async function scrapeCraigslist(location = 'newyork') {
  const listings = [];
  try {
    const url = `https://${location}.craigslist.org/search/cta?query=cars+trucks`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(data);
    
    $('.result-row').slice(0, 20).each((i, elem) => {
      const title = $(elem).find('.result-title').text().trim();
      const price = $(elem).find('.result-price').text().replace('$', '').replace(',', '');
      const location = $(elem).find('.result-hood').text().trim();
      const url = $(elem).find('.result-title').attr('href');
      const imageData = $(elem).find('.result-image').attr('data-ids');
      
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? parseInt(yearMatch[0]) : null;
      
      if (year && price) {
        const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes', 'Tesla', 'Nissan', 'Hyundai', 'Jeep', 'Mazda', 'Subaru', 'Volkswagen', 'Audi', 'Lexus'];
        let make = 'Unknown';
        let model = 'Unknown';
        
        for (const m of makes) {
          if (title.toLowerCase().includes(m.toLowerCase())) {
            make = m;
            const parts = title.split(new RegExp(m, 'i'));
            if (parts[1]) {
              model = parts[1].trim().split(' ')[0];
            }
            break;
          }
        }
        
        const bodyTypes = ['sedan', 'suv', 'truck', 'coupe', 'wagon', 'van', 'hatchback'];
        const bodyType = bodyTypes.find(type => title.toLowerCase().includes(type)) || 'Sedan';
        
        listings.push({
          id: `cl_${location}_${i}_${Date.now()}`,
          title,
          year,
          make,
          model,
          price: parseInt(price) || 0,
          mileage: 0,
          location: location.replace('(', '').replace(')', '') || `${location}, NY`,
          url,
          source: 'Craigslist',
          image: imageData ? `https://images.craigslist.org/${imageData.split(',')[0].split(':')[1]}_300x300.jpg` : null,
          bodyType: bodyType.charAt(0).toUpperCase() + bodyType.slice(1),
          transmission: 'Automatic',
          fuelType: title.toLowerCase().includes('hybrid') ? 'Hybrid' : 
                    title.toLowerCase().includes('electric') ? 'Electric' : 'Gasoline',
          dealer: 'Private Seller',
          distance: Math.floor(Math.random() * 30) + 5,
          warranty: 'As-Is',
          scrapedAt: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    console.error(`Scraping error for ${location}:`, error.message);
  }
  return listings;
}

export default async function handler(req, res) {
  try {
    // Check cache (24 hours)
    if (cachedListings.length > 0 && lastUpdated) {
      const hoursSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        return res.status(200).json({
          listings: cachedListings,
          cached: true,
          lastUpdated,
          count: cachedListings.length
        });
      }
    }
    
    // Scrape fresh data
    console.log('Fetching fresh listings...');
    const [nyListings, ctListings] = await Promise.all([
      scrapeCraigslist('newyork'),
      scrapeCraigslist('newlondon')
    ]);
    
    const allListings = [...nyListings, ...ctListings];
    
    cachedListings = allListings;
    lastUpdated = Date.now();
    
    res.status(200).json({
      listings: allListings,
      cached: false,
      lastUpdated,
      count: allListings.length
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      error: error.message,
      listings: cachedListings.length > 0 ? cachedListings : []
    });
  }
}
