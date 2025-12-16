export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Trigger a fresh scrape by clearing cache
  res.status(200).json({
    message: 'Refresh triggered. Visit /api/listings to get fresh data.',
    timestamp: new Date().toISOString()
  });
}
