export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Car finder backend is running',
    timestamp: new Date().toISOString()
  });
}
