// Quick test to check if the page is working
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3003/bookkeeping/sop-generator');
  
  // Wait for the page to load
  await page.waitForSelector('h1', { timeout: 5000 });
  
  // Try to select an account
  const accountSelect = await page.$('select');
  if (accountSelect) {
    console.log('Found account select');
    await accountSelect.select('321 - Contract Salaries');
    await page.waitForTimeout(1000);
    
    // Check if service type select appears
    const selects = await page.$$('select');
    console.log('Number of select elements:', selects.length);
    
    // Get the page content to debug
    const content = await page.content();
    if (content.includes('Select Service Type')) {
      console.log('Service type dropdown is in the HTML');
    } else {
      console.log('Service type dropdown NOT found in HTML');
    }
  }
  
  await page.waitForTimeout(3000);
  await browser.close();
})();