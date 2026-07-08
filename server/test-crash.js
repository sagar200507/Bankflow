const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign(
  { id: 'b0b654c3-cf60-453d-9a2c-fb1f7232e42c' },
  process.env.JWT_ACCESS_SECRET || 'your_jwt_access_secret',
  { expiresIn: '1h' }
);

async function test() {
  try {
    const dashRes = await fetch('http://localhost:5000/api/v1/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dashData = await dashRes.json();
    console.log("DASHBOARD DATA:", dashData);

    const spendRes = await fetch('http://localhost:5000/api/v1/analytics/spending?months=6', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const spendData = await spendRes.json();
    console.log("SPENDING DATA:", spendData);

    // Simulate what the React component does:
    const dashboardData = dashData.data;
    const spendingData = spendData.data.spending;

    const { stats, recentTransactions } = dashboardData || {};
    
    console.log("Stats:", stats);
    console.log("recentTransactions length:", recentTransactions?.length);
    console.log("spendingData length:", spendingData?.length);

  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
