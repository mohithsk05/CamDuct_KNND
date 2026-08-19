const http = require('http');

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  try {
    // Login to get token
    const loginRes = await request('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: '123' });

    console.log('Login status:', loginRes.status);
    const token = loginRes.data.token;
    if (!token) {
      console.log('No token returned:', loginRes.data);
      return;
    }

    // Get materials
    const matRes = await request('http://localhost:5001/api/purchase/materials', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Materials GET status:', matRes.status);
    console.log('Categories:', Object.keys(matRes.data));
    console.log('Consumables count:', matRes.data.consumable_items ? matRes.data.consumable_items.length : 0);

    if (matRes.data.consumable_items && matRes.data.consumable_items.length > 0) {
      const item = matRes.data.consumable_items[0];
      console.log('Testing update on item:', item.id, item.name);

      const updateRes = await request(`http://localhost:5001/api/purchase/materials/consumable_items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, { qty: 99, uom: 'Box' });

      console.log('Update status:', updateRes.status);
      console.log('Update response:', updateRes.data);
    }
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTest();
