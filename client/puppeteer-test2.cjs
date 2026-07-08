const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000/login');
  
  await page.type('input[type="email"]', 'sagarraj121219@gmail.com');
  await page.type('input[type="password"]', 'password123'); // or whatever the seed password is
  await page.click('button[type="submit"]');

  await page.waitForNavigation();
  console.log('Navigated to:', page.url());

  // Wait a moment for any render errors to pop up
  await new Promise(r => setTimeout(r, 2000));
  
  // Also dump the DOM to see if RecentTransactions is there!
  const html = await page.evaluate(() => {
    const el = document.querySelector('.recent-transactions');
    return el ? el.outerHTML.substring(0, 500) + '...' : 'NOT FOUND';
  });
  console.log('RecentTransactions HTML:', html);

  await browser.close();
})();
