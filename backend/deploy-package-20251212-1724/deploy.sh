#!/bin/bash
# SianAgriTech Deployment Script

echo "🚀 Deploying SianAgriTech Backend..."
echo "====================================="

# 1. Install dependencies
npm install

# 2. Set up environment
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Using template."
    cp .env.production.example .env
    echo "⚠️  IMPORTANT: Edit .env with your production credentials"
fi

# 3. Start server (development mode)
echo "Starting server in development mode..."
npm start

# 4. For production, use:
# pm2 start server.js --name sianagritech
# pm2 save
# pm2 startup
