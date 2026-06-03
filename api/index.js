// api/index.js - For Vercel Serverless Functions
export default function handler(req, res) {
  res.json({ 
    message: "SianAgriTech API", 
    status: "redirecting to backend",
    backend: "https://sianagritech-backend.vercel.app/backend" 
  });
}
