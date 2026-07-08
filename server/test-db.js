const pool = require('./src/config/database');
const AnalyticsModel = require('./src/models/analytics.model');

async function test() {
  try {
    const data = await AnalyticsModel.getMonthlySpending('b0b654c3-cf60-453d-9a2c-fb1f7232e42c', 6);
    console.log("SPENDING DATA:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
test();
