async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sagarraj121219@gmail.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.accessToken;
    console.log("Logged in!");

    const spendRes = await fetch('http://localhost:5000/api/v1/analytics/spending?months=6', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const spendData = await spendRes.json();
    console.log(JSON.stringify(spendData, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
