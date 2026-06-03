// scripts/doctor.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🏥 SianAgriTech Backend Doctor\n');
console.log('='.repeat(50));

// Check package.json
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log('📦 Package Info:');
  console.log(`   Name: ${packageJson.name}`);
  console.log(`   Version: ${packageJson.version}`);
  console.log(`   Type: ${packageJson.type}`);
  console.log(`   Node: ${packageJson.engines.node}`);
} catch (error) {
  console.log('❌ Could not read package.json:', error.message);
}

// Check critical files
const criticalFiles = [
  'server.js',
  '.env',
  'package.json'
];

console.log('\n📁 File System Check:');
criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} (MISSING)`);
  }
});

// Check .env for required variables
console.log('\n🔧 Environment Check:');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasMongoDB = envContent.includes('MONGODB_URI');
  const hasPort = envContent.includes('PORT');
  
  console.log(`   ✅ .env file exists`);
  console.log(`   ${hasMongoDB ? '✅' : '⚠️'} MONGODB_URI configured`);
  console.log(`   ${hasPort ? '✅' : '⚠️'} PORT configured`);
} else {
  console.log('   ❌ .env file missing');
}

console.log('\n🎯 Recommendations:');
console.log('1. Run: npm run fix:deps');
console.log('2. For quick test: npm run minimal');
console.log('3. For production: npm run prod');
console.log('\n✅ Doctor check complete.');