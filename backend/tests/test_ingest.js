const http = require('http');
const { app, server } = require('./server');

const testPayload = {
  read: {
    plc_device_B09F3AB1A8CE0558B8BCB92E4B72AD5C: [
      {
        ts: 1795441232454,
        values: {
          bottle_count: 18332,
          bottle_count1: 57,
          bottle_count_2: 18638,
          chiller: 164,
          comp: 0,
          counter_reset: 0,
          fan: 0,
          fsw_trip: 1,
          kp1_trip: 1,
          plc_status: 0,
          pulse: 1,
          pump: 1,
          stop_plc: 0,
        },
      },
    ],
  },
};

const runTest = async () => {
  const PORT = 5055;
  server.listen(PORT, async () => {
    console.log(`🧪 Test server started on port ${PORT}`);

    const data = JSON.stringify(testPayload);

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/machines/SAFC_M33/read',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          console.log(`✅ Ingestion Response Status: ${res.statusCode}`);
          console.log(`📦 Ingestion Response Body: ${body}`);

          const parsed = JSON.parse(body);
          if (parsed.status === 'success' && parsed.registersCount === 13) {
            console.log('🎉 TEST PASSED! All 13 PLC registers extracted successfully for SAFC_M33!');
            process.exit(0);
          } else {
            console.error('❌ Test validation failed:', parsed);
            process.exit(1);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('❌ Request error:', err);
      process.exit(1);
    });

    req.write(data);
    req.end();
  });
};

runTest();
