const { checkArrearsAndGenerateWarnings } = require('./src/jobs/contractMonitor');

async function test() {
  console.log('Testing arrears check...');
  await checkArrearsAndGenerateWarnings();
  console.log('Done.');
  process.exit(0);
}

test();
