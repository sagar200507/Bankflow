const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

  await page.goto('http://localhost:3000/login');
  
  await page.type('input[type="email"]', 'admin@bankflow.com');
  await page.type('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation();
  console.log('Navigated to:', page.url());

  // Wait a moment for any render errors to pop up
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
