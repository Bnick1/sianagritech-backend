# Create local-test.mjs
Set-Content -Path "local-test.mjs" -Value "
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Local MongoDB Connection Test');
console.log('================================');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.log('❌ No MONGODB_URI in .env file');
  process.exit(1);
}

console.log('URI present:', !!uri);
console.log('Masked URI:', uri.replace(/:\/\/[^@]+@/, '://***@'));

try {
  console.log('\\n🔗 Attempting connection...');
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000
  });
  
  console.log('✅ LOCAL CONNECTION SUCCESS!');
  console.log('Host:', mongoose.connection.host);
  console.log('Database:', mongoose.connection.db.databaseName);
  console.log('Ready State:', mongoose.connection.readyState);
  
  // Test a simple operation
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections found:', collections.length);
  
  await mongoose.disconnect();
  console.log('✅ Disconnected successfully');
  
} catch (error) {
  console.log('❌ LOCAL CONNECTION FAILED:');
  console.log('Error Name:', error.name);
  console.log('Error Message:', error.message);
  
  if (error.name === 'MongoServerSelectionError') {
    console.log('\\n🔧 Diagnosis:');
    console.log('1. Check MongoDB Atlas Network Access (must have 0.0.0.0/0)');
    console.log('2. Verify username/password in connection string');
    console.log('3. Check if cluster is paused/stopped');
  }
}
"

# Run the test
node local-test.mjs