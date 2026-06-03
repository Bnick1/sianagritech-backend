#!/bin/bash
echo "?? Starting SianAgriTech Development Environment..."

# 1. Ensure MongoDB is running
if ! nc -z localhost 27017; then
    echo "Starting MongoDB..."
    mongod --dbpath C:/mongodb_data --port 27017 --fork --logpath mongodb.log
fi

# 2. Install missing dependencies
echo "Checking dependencies..."
npm install

# 3. Clean start
echo "Starting application..."
NODE_ENV=development node server.js
