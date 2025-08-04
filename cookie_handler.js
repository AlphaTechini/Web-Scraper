async function handleCookieConsent(page, url) {
    try {
        console.log("Checking for cookie consent banner...");

        // A single, combined regular expression for all common consent button texts.
        // This is more efficient than iterating through multiple regexes.
        const consentButtonRegex = /accept all|allow all|reject all|decline|accept|agree|consent|got it|i agree|ok/i;

        // Use Playwright's 'getByRole' locator, which is more robust and user-centric.
        // It finds elements that are presented as buttons to users, regardless of the HTML tag.
        const consentButtonLocator = page.getByRole('button', { name: consentButtonRegex });

        try {
            // Wait for the first matching button to be visible.
            const button = consentButtonLocator.first();
            await button.waitFor({ state: 'visible', timeout: 3000 });
            console.log(`Cookie banner found, attempting to click: "${await button.textContent()}"`);

            // Simulate human-like mouse movement before clicking.
            const box = await button.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
                await page.waitForTimeout(Math.random() * 400 + 300);
            }

            // Click the button. Using force: true can help with elements that are partially obscured.
            await button.click({ force: true });
            console.log('Clicked cookie consent button.');

            // Wait for any potential navigation or content loading to settle.
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        } catch (error) {
            // This is an expected outcome if no banner is found, so we just log it for info.
            console.log('No cookie consent banner found or button was not actionable.');
        }
    } catch (error) {
        console.error('Error handling cookie consent:', error);
     }
 }

 export default handleCookieConsent;