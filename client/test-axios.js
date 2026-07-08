import axios from 'axios';

async function test() {
  try {
    const api = axios.create({ baseURL: 'http://localhost:5000/api/v1' });
    const loginRes = await api.post('/auth/login', {
      email: 'admin@bankflow.com', 
      password: 'admin123' 
    });
    const token = loginRes.data.data.accessToken;
    console.log("Logged in!");

    const [dashRes, spendRes] = await Promise.all([
      api.get('/analytics/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
      api.get('/analytics/spending?months=6', { headers: { Authorization: `Bearer ${token}` } })
    ]);

    console.log("DASHBOARD DATA KEYS:", Object.keys(dashRes.data.data));
    console.log("SPENDING DATA KEYS:", Object.keys(spendRes.data.data));
    console.log("SPENDING DATA:", JSON.stringify(spendRes.data.data, null, 2));

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}
test();
