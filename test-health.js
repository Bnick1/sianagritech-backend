// test-health.js (ROOT LEVEL)
import axios from 'axios';

const BASE_URL = 'http://localhost:3003';

async function runHealthTests() {
  console.log('🧪 Testing SianAgriTech Health Monitoring System\n');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Root Endpoint', endpoint: '/' },
    { name: 'Basic Health Check', endpoint: '/health' },
    { name: 'Health API - Comprehensive', endpoint: '/api/health' },
    { name: 'Health API - Liveness', endpoint: '/api/health/liveness' },
    { name: 'Health API - Readiness', endpoint: '/api/health/readiness' },
    { name: 'Health API - External APIs', endpoint: '/api/health/apis' },
    { name: 'Health API - System Metrics', endpoint: '/api/health/system' },
    { name: 'Health API - Connections', endpoint: '/api/health/connections' },
    { name: 'Health API - Configuration', endpoint: '/api/health/config' },
    { name: 'Gateway Test', endpoint: '/gateway/test' },
    { name: 'Farmers Test', endpoint: '/farmers/test' },
    { name: 'IoT Test', endpoint: '/iot/test' },
    { name: 'Readiness Probe', endpoint: '/ready' },
    { name: 'System Metrics', endpoint: '/metrics' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`);
      console.log(`   URL: ${BASE_URL}${test.endpoint}`);
      
      const response = await axios.get(`${BASE_URL}${test.endpoint}`, {
        timeout: 10000
      });
      
      const status = response.status;
      const statusText = status >= 200 && status < 300 ? '✅' : '⚠️';
      
      console.log(`   Status: ${statusText} ${status}`);
      
      if (response.data?.status || response.data?.success !== false) {
        console.log(`   Result: PASS`);
        passed++;
        
        // Show useful data
        if (response.data.service) {
          console.log(`   Service: ${response.data.service}`);
        }
        if (response.data.version) {
          console.log(`   Version: ${response.data.version}`);
        }
      } else {
        console.log(`   Result: FAIL - ${response.data?.message || 'Unknown error'}`);
        failed++;
      }
      
    } catch (error) {
      const errorType = error.code || error.response?.status || 'Connection failed';
      console.log(`   Status: ❌ ${errorType}`);
      console.log(`   Result: FAIL - ${error.message}`);
      failed++;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Total: ${passed + failed}`);
  console.log(`   🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n✨ All tests passed! System is healthy.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above.');
    process.exit(1);
  }
}

// Run tests
runHealthTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});