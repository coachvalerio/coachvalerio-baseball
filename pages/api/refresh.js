// pages/api/refresh.js
export default async function handler(req, res) {
  // Vercel calls this automatically every day at 8am UTC
  // Add database caching logic here later if needed
  console.log('Daily refresh ran at:', new Date().toISOString());
  res.status(200).json({ success: true, timestamp: new Date().toISOString() });
}