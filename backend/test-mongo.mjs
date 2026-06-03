# Create the test file
echo "import mongoose from 'mongoose';

const uri = 'mongodb+srv://Bnick:F9w8cReIpkvg9zDp@cluster0.tjelwfq.mongodb.net/SianAgriTech?retryWrites=true&w=majority&appName=Cluster0';

console.log('Testing MongoDB connection from local machine...');
console.log('Connection string:', uri.replace(/:[^:]*@/, ':****@'));

try {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  });
  
  console.log('✅ Successfully connected to MongoDB from local!');
  console.log('Host:', mongoose.connection.host);
  console.log('Database:', mongoose.connection.db.databaseName);
  process.exit(0);
} catch (err) {
  console.log('❌ Failed to connect from local:');
  console.log('Error:', err.message);
  console.log('\nPossible issues:');
  console.log('1. MongoDB Atlas Network Access - Add 0.0.0.0/0');
  console.log('2. Password is incorrect');
  console.log('3. Cluster is not running');
  process.exit(1);
}" > test-mongo.mjs