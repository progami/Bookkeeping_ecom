// Paste this in Chrome DevTools Console when on Xero login page
// Or save as a bookmarklet

function autoFillXeroLogin() {
  const email = 'ajarrar@trademanenterprise.com';
  const password = 'gW2r4*8&wFM.#fZ';
  
  // Check if we're on email page
  const emailInput = document.querySelector('input[type="email"]');
  if (emailInput) {
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Click next/login button
    const nextButton = document.querySelector('button[type="submit"], button:contains("Next"), button:contains("Log in")') || 
                      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next') || b.textContent.includes('Log in'));
    if (nextButton) {
      nextButton.click();
    }
  }
  
  // Check if we're on password page (might need a delay)
  setTimeout(() => {
    const passwordInput = document.querySelector('input[type="password"]');
    if (passwordInput) {
      passwordInput.value = password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Click login button
      const loginButton = document.querySelector('button[type="submit"], button:contains("Log in")') || 
                         Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log in'));
      if (loginButton) {
        loginButton.click();
      }
    }
  }, 1000);
  
  // Handle Allow Access button after login
  setTimeout(() => {
    const allowButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Allow access'));
    if (allowButton) {
      allowButton.click();
    }
  }, 5000);
}

// Run the function
autoFillXeroLogin();

console.log('Xero auto-login script running...');
console.log('Email:', 'ajarrar@trademanenterprise.com');
console.log('This will automatically fill and submit the login form.');