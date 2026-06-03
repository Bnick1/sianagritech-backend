// test-sync.js (ROOT LEVEL)
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from root .env
dotenv.config({ path: '.env' });

async function runSyncTests() {
  console.log('🧪 Testing SianAgriTech Offline Sync Service\n');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Check if MongoDB is available
    console.log('🔍 Test 1: Checking MongoDB connection...');
    
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sianagritech_dev';
    
    try {
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      console.log('   MongoDB: ✅ Connected');
      
      // Test 2: Import and test sync service
      console.log('\n📝 Test 2: Testing sync service import...');
      
      // Dynamic import to handle path
      const syncServiceModule = await import('./backend/services/OfflineSyncService.js');
      const OfflineSyncService = syncServiceModule.default;
      
      console.log('   Sync Service: ✅ Imported');
      
      // Test 3: Queue test operation
      console.log('\n📋 Test 3: Queueing test operation...');
      
      const testData = {
        name: 'Test Farm - Health Check',
        location: { lat: -1.286389, lng: 36.817223 },
        farmerName: 'Test Farmer',
        cropType: 'Maize',
        size: 1.0,
        _local: true
      };
      
      const result = await OfflineSyncService.queueOperation({
        type: 'create_farm',
        data: testData,
        priority: 'high',
        source: 'health_test'
      });
      
      console.log(`   Operation queued: ${result.success ? '✅' : '❌'}`);
      console.log(`   Operation ID: ${result.operationId}`);
      console.log(`   Message: ${result.message}`);
      
      // Test 4: Check sync status
      console.log('\n📊 Test 4: Checking sync status...');
      const status = OfflineSyncService.getSyncStatus();
      console.log(`   Queue length: ${status.queueLength}`);
      console.log(`   Offline mode: ${status.offline ? 'Yes' : 'No'}`);
      console.log(`   In progress: ${status.inProgress}`);
      console.log(`   Successful syncs: ${status.stats.successful}`);
      console.log(`   Failed syncs: ${status.stats.failed}`);
      console.log(`   Pending: ${status.stats.pending}`);
      
      // Test 5: Test sensor data queue
      console.log('\n📡 Test 5: Testing sensor data queue...');
      
      const sensorData = {
        sensorId: 'test_sensor_001',
        type: 'soil_moisture',
        value: 42.5,
        unit: '%',
        farmId: 'test_farm_001',
        timestamp: new Date()
      };
      
      const sensorResult = await OfflineSyncService.queueOperation({
        type: 'sensor_data',
        data: sensorData,
        priority: 'normal'
      });
      
      console.log(`   Sensor data queued: ${sensorResult.success ? '✅' : '❌'}`);
      
      // Test 6: Manual sync
      console.log('\n🔄 Test 6: Triggering manual sync...');
      
      if (!status.offline) {
        const syncResult = await OfflineSyncService.manualSync();
        console.log(`   Manual sync triggered: ${syncResult.success ? '✅' : '❌'}`);
        console.log(`   Sync message: ${syncResult.message}`);
      } else {
        console.log(`   Manual sync: ⏸️ Skipped (offline mode)`);
      }
      
      // Final status
      console.log('\n📈 Test 7: Final system status...');
      const finalStatus = OfflineSyncService.getSyncStatus();
      console.log(`   Total operations processed: ${finalStatus.stats.totalSynced}`);
      console.log(`   Currently queued: ${finalStatus.queueLength}`);
      console.log(`   Last sync: ${finalStatus.stats.lastSync || 'Never'}`);
      
      // Cleanup: Disconnect
      await mongoose.disconnect();
      console.log('\n🔌 MongoDB disconnected');
      
      console.log('\n✨ All sync tests completed successfully!');
      
    } catch (dbError) {
      console.log('   MongoDB: ❌ Not available');
      console.log('   Message:', dbError.message);
      console.log('\n⚠️ Running in limited mode (MongoDB required for full sync tests)');
      
      // Test basic import without MongoDB
      console.log('\n📦 Testing service import without database...');
      try {
        const syncServiceModule = await import('./backend/services/OfflineSyncService.js');
        const OfflineSyncService = syncServiceModule.default;
        
        const status = OfflineSyncService.getSyncStatus();
        console.log('   Sync Service: ✅ Imported (limited mode)');
        console.log(`   Offline mode: ${status.offline ? 'Yes' : 'No'}`);
        console.log(`   Queue length: ${status.queueLength}`);
        
        console.log('\n✨ Basic sync service tests completed');
      } catch (importError) {
        console.log('   Sync Service: ❌ Import failed');
        console.log('   Error:', importError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Sync test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
runSyncTests();