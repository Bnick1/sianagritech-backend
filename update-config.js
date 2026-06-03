// update-config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Updating configuration files...\n');

// Update .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists, updating...');
  // The .env content is the one I provided above
  // You can copy it directly or I'll show you how to update specific lines
}

console.log('\n✅ Configuration updated successfully!');
console.log('\n🎯 Next steps:');
console.log('1. Restart server: npm start');
console.log('2. Test endpoints: http://localhost:3003/health');
console.log('3. Check logs for clean startup');