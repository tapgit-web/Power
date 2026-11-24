const http = require('http');
const { server } = require('./server');
const { generateToken } = require('./middleware/auth');
const { ROLES } = require('./config/constants');

const adminUser = {
  _id: 'admin_test_id',
  email: 'tapcloud10@gmail.com',
  role: ROLES.ADMIN,
  allMachines: true,
  assignedMachines: [],
};

const adminToken = generateToken(adminUser);

const runTest = async () => {
  const PORT = 5056;
  server.listen(PORT, async () => {
    console.log(`🧪 Write test server started on port ${PORT}`);

    const writePayload = JSON.stringify({
      startingRegAddr: 520,
      data: '1',
      requestType: 5, // Write Single Coil
    });

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/machines/SAFC_M33/write',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(writePayload),
          Authorization: `Bearer ${adminToken}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log(`✅ Write Response Status: ${res.statusCode}`);
          console.log(`📦 Write Response Body: ${body}`);

          const parsed = JSON.parse(body);
          if (res.statusCode === 201 && parsed.command) {
            console.log('🎉 TEST PASSED! Modbus write command queued and broadcasted successfully!');
            process.exit(0);
          } else {
            console.error('❌ Write test failed:', parsed);
            process.exit(1);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('❌ Request error:', err);
      process.exit(1);
    });

    req.write(writePayload);
    req.end();
  });
};

runTest();
