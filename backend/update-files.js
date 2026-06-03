// update-files.js - Script to update all files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Updating SianAgriTech files...');

// 1. Update package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add express-validator if missing
if (!packageJson.dependencies['express-validator']) {
  packageJson.dependencies['express-validator'] = '^7.0.1';
  console.log('✅ Added express-validator to dependencies');
}

// Add cross-env if missing
if (!packageJson.dependencies['cross-env']) {
  packageJson.dependencies['cross-env'] = '^7.0.3';
  console.log('✅ Added cross-env to dependencies');
}

// Update scripts
packageJson.scripts = {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "minimal": "node server-minimal.js",
  "build": "npm install",
  "prod": "cross-env NODE_ENV=production node server.js",
  "prod:win": "cross-env NODE_ENV=production node server.js",
  "test": "node test-health.js",
  "test:health": "node test-health.js",
  "test:sync": "node test-sync.js",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "clean": "rm -rf node_modules package-lock.json",
  "clean:win": "rmdir /s /q node_modules && del package-lock.json",
  "reinstall": "npm run clean && npm install",
  "reinstall:win": "npm run clean:win && npm install",
  "health": "node -e \"console.log('Node Version:', process.version); console.log('Platform:', process.platform); console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');\"",
  "fix:deps": "node scripts/fix-deps.js",
  "reset": "npm run clean && npm cache clean --force && npm install",
  "doctor": "node scripts/doctor.js"
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json');

// 2. Create server-minimal.js
const serverMinimal = `// server-minimal.js - Minimal working version
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3003;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      server: 'running'
    }
  });
});

// Main route
app.get('/', (req, res) => {
  res.json({
    message: 'SianAgriTech API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/docs (coming soon)'
    }
  });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sianagritech');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
    console.log(\`📡 Health check: http://localhost:\${PORT}/health\`);
  });
};

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

startServer();`;

fs.writeFileSync(path.join(__dirname, 'server-minimal.js'), serverMinimal);
console.log('✅ Created server-minimal.js');

// 3. Create scripts directory if it doesn't exist
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir);
}

// 4. Create doctor.js
const doctorScript = `// scripts/doctor.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🏥 SianAgriTech Backend Doctor\\n');
console.log('='.repeat(50));

// Check package.json
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log('📦 Package Info:');
  console.log(\`   Name: \${packageJson.name}\`);
  console.log(\`   Version: \${packageJson.version}\`);
  console.log(\`   Type: \${packageJson.type}\`);
  console.log(\`   Node: \${packageJson.engines.node}\`);
} catch (error) {
  console.log('❌ Could not read package.json:', error.message);
}

// Check critical files
const criticalFiles = [
  'server.js',
  '.env',
  'package.json'
];

console.log('\\n📁 File System Check:');
criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(\`   ✅ \${file}\`);
  } else {
    console.log(\`   ❌ \${file} (MISSING)\`);
  }
});

// Check .env for required variables
console.log('\\n🔧 Environment Check:');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasMongoDB = envContent.includes('MONGODB_URI');
  const hasPort = envContent.includes('PORT');
  
  console.log(\`   ✅ .env file exists\`);
  console.log(\`   \${hasMongoDB ? '✅' : '⚠️'} MONGODB_URI configured\`);
  console.log(\`   \${hasPort ? '✅' : '⚠️'} PORT configured\`);
} else {
  console.log('   ❌ .env file missing');
}

console.log('\\n🎯 Recommendations:');
console.log('1. Run: npm run fix:deps');
console.log('2. For quick test: npm run minimal');
console.log('3. For production: npm run prod');
console.log('\\n✅ Doctor check complete.');`;

fs.writeFileSync(path.join(scriptsDir, 'doctor.js'), doctorScript);
console.log('✅ Created scripts/doctor.js');

// 5. Create fix-deps.js
const fixDepsScript = `// scripts/fix-deps.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing dependencies...\\n');

// Check for missing express-validator in middleware
const validationPath = path.join(__dirname, '..', 'middleware', 'validation.js');
if (fs.existsSync(validationPath)) {
  let content = fs.readFileSync(validationPath, 'utf8');
  
  // Fix sanitize-html import
  if (content.includes("import sanitizeHtml from 'sanitize-html'")) {
    content = content.replace(
      "import sanitizeHtml from 'sanitize-html';",
      \`// Simple HTML sanitizer (no external dependencies)
const sanitizeHtml = (input, options = {}) => {
  if (!input || typeof input !== 'string') return input || '';
  
  let output = input;
  const config = {
    allowedTags: options.allowedTags || [],
    allowedAttributes: options.allowedAttributes || {},
    disallowedTagsMode: options.disallowedTagsMode || 'escape'
  };
  
  // Basic XSS prevention
  const dangerousPatterns = [
    /<script\\\\b[^>]*>(.*?)<\\\\/script>/gi,
    /javascript:[^'"]*/gi,
    /on\\\\w+\\\\s*=/gi
  ];
  
  dangerousPatterns.forEach(pattern => {
    output = output.replace(pattern, '');
  });
  
  if (config.disallowedTagsMode === 'escape') {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    output = output.replace(/[&<>\"'/]/g, match => escapeMap[match]);
  }
  
  return output.trim();
};\`
    );
    
    fs.writeFileSync(validationPath, content);
    console.log('✅ Fixed validation.js sanitize-html dependency');
  }
}

console.log('\\n✅ Dependency fixes applied. Run: npm install\');`;

fs.writeFileSync(path.join(scriptsDir, 'fix-deps.js'), fixDepsScript);
console.log('✅ Created scripts/fix-deps.js');

console.log('\\n🎯 All files updated successfully!');
console.log('\\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Run: npm start');
console.log('3. Test: http://localhost:3003/health');