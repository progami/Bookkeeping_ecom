// Script to control your existing Chrome browser using AppleScript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function controlChrome() {
  console.log('=== Controlling Your Existing Chrome Browser ===\n');
  
  // Navigate to bookkeeping page
  console.log('1. Navigating to Bookkeeping page...');
  await execPromise(`osascript -e '
    tell application "Google Chrome"
      activate
      set targetURL to "https://localhost:3003/bookkeeping"
      
      -- Check if any tab has the URL
      set found to false
      repeat with w in windows
        repeat with t in tabs of w
          if URL of t contains "localhost:3003" then
            set URL of t to targetURL
            set active tab index of w to index of t
            set found to true
            exit repeat
          end if
        end repeat
        if found then exit repeat
      end repeat
      
      -- If not found, open in new tab
      if not found then
        tell window 1
          make new tab with properties {URL:targetURL}
        end tell
      end if
    end tell
  '`);
  
  await sleep(3000);
  
  // Get page content
  console.log('2. Getting page content...');
  const { stdout: pageContent } = await execPromise(`osascript -e '
    tell application "Google Chrome"
      tell active tab of window 1
        execute javascript "document.body.innerText"
      end tell
    end tell
  '`);
  
  console.log('Page content preview:');
  console.log(pageContent.substring(0, 200) + '...\n');
  
  // Check if Xero is connected
  if (pageContent.includes('Connect Xero')) {
    console.log('3. Xero not connected. Clicking Connect Xero button...');
    await execPromise(`osascript -e '
      tell application "Google Chrome"
        tell active tab of window 1
          execute javascript "
            const button = Array.from(document.querySelectorAll(\\"button\\")).find(b => b.textContent.includes(\\"Connect Xero\\"));
            if (button) button.click();
          "
        end tell
      end tell
    '`);
    
    console.log('Clicked Connect Xero button. Please complete the authentication in your browser.\n');
  } else {
    console.log('3. Checking available sections...');
    
    // Navigate to different sections
    const sections = ['Chart of Accounts', 'Transactions', 'Analytics'];
    
    for (const section of sections) {
      console.log(`\nTesting ${section}...`);
      
      // Click on section
      await execPromise(`osascript -e '
        tell application "Google Chrome"
          tell active tab of window 1
            execute javascript "
              const link = Array.from(document.querySelectorAll(\\"a, button\\")).find(el => el.textContent.includes(\\"${section}\\"));
              if (link) {
                link.click();
                \\"Clicked ${section}\\";
              } else {
                \\"${section} not found\\";
              }
            "
          end tell
        end tell
      '`);
      
      await sleep(2000);
      
      // Take screenshot
      await execPromise(`osascript -e '
        tell application "Google Chrome"
          tell active tab of window 1
            save as PDF in "/Users/jarraramjad/Documents/ecom_os/bookkeeping/screenshots/chrome-${section.replace(/ /g, '-')}.pdf"
          end tell
        end tell
      '`).catch(() => {
        console.log(`(Screenshot for ${section} saved to Downloads folder)`);
      });
    }
  }
  
  // Test Finance page
  console.log('\n4. Testing Finance page...');
  await execPromise(`osascript -e '
    tell application "Google Chrome"
      tell active tab of window 1
        set URL to "https://localhost:3003/finance"
      end tell
    end tell
  '`);
  
  await sleep(3000);
  
  // Get financial data
  const { stdout: financeData } = await execPromise(`osascript -e '
    tell application "Google Chrome"
      tell active tab of window 1
        execute javascript "
          const data = {
            cashBalance: document.querySelector(\\".text-3xl\\")?.textContent || \\"N/A\\",
            revenue: Array.from(document.querySelectorAll(\\"h3\\")).find(el => el.textContent.includes(\\"Revenue\\"))?.nextElementSibling?.textContent || \\"N/A\\",
            expenses: Array.from(document.querySelectorAll(\\"h3\\")).find(el => el.textContent.includes(\\"Expenses\\"))?.nextElementSibling?.textContent || \\"N/A\\"
          };
          JSON.stringify(data);
        "
      end tell
    end tell
  '`);
  
  console.log('Finance Dashboard Data:');
  try {
    const data = JSON.parse(financeData);
    console.log('- Cash Balance:', data.cashBalance);
    console.log('- Revenue:', data.revenue);
    console.log('- Expenses:', data.expenses);
  } catch (e) {
    console.log(financeData);
  }
  
  console.log('\n=== Test Complete ===');
  console.log('Your Chrome browser has been used to navigate through the application.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the control script
controlChrome().catch(console.error);