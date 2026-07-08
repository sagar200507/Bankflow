const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/login');
  
  await page.type('input[type="email"]', 'sagarraj121219@gmail.com');
  await page.type('input[type="password"]', 'anything'); 
  await page.click('button[type="submit"]');

  await page.waitForNavigation();

  // Wait a moment for data to fetch and render
  await new Promise(r => setTimeout(r, 2000));
  
  // Measure the containers
  const measurements = await page.evaluate(() => {
    function getRect(selector) {
      const el = document.querySelector(selector);
      if (!el) return 'NOT FOUND';
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        display: window.getComputedStyle(el).display,
        flexDirection: window.getComputedStyle(el).flexDirection
      };
    }

    return {
      dashboardLeft: getRect('.dashboard-body__left'),
      spendingChart: getRect('.spending-chart'),
      spendingChartContainer: getRect('.spending-chart__container'),
      rechartsContainer: getRect('.recharts-responsive-container'),
    };
  });

  console.log('MEASUREMENTS:', JSON.stringify(measurements, null, 2));

  await browser.close();
})();
