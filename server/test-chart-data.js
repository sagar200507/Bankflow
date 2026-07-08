const pool = require('./src/config/database');
const AnalyticsService = require('./src/services/analytics.service');

async function test() {
  const userId = 'b0b654c3-cf60-453d-9a2c-fb1f7232e42c';
  
  const dashboardData = await AnalyticsService.getDashboardData(userId);
  console.log("Dashboard Data Keys:", Object.keys(dashboardData));
  if (dashboardData.recentTransactions) {
      console.log("Recent Transactions Length:", dashboardData.recentTransactions.length);
  } else {
      console.log("Recent Transactions is MISSING/FALSY!");
  }

  const rawSpending = await AnalyticsService.getMonthlySpending(userId, 6);
  console.log("Raw Spending Length:", rawSpending.length);
  console.log("Raw Spending Data:", rawSpending);

  // Replicate React logic
  const formattedSpending = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = d.toLocaleString('default', { month: 'short' });
    
    const found = rawSpending.find(item => {
      const itemDate = new Date(item.month);
      return itemDate.getFullYear() === d.getFullYear() && itemDate.getMonth() === d.getMonth();
    });

    formattedSpending.push({
      month: monthStr,
      spending: found ? parseFloat(found.total_spent) : 0
    });
  }

  console.log("Formatted Chart Data:", formattedSpending);

  process.exit(0);
}
test();
