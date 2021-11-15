const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/v2/usage?auth_key=smoke_test',
  method: 'GET',
  headers: { 'User-Agent': 'smoke_test' },
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    console.log(`Unexpected status code: ${res.statusCode}`);
  }
  process.exit(1);
});

req.on('error', (e) => {
  console.log(`problem with request: ${e.message}`);
  process.exit(1);
});

// write data to request body
req.end();
