/**
 * A more robust CAPTCHA and bot-challenge handler.
 * It first detects if a challenge is present and then attempts to solve simple ones.
 * @param {import('playwright').Page} page The Playwright page object.
 */
async function handleCaptcha(page) {
    try {
        console.log("Checking for CAPTCHA or bot challenge pages...");

        const isChallengePresent = await page.evaluate(() => {
            // We get the body's text content and keep its original casing for regex matching.
            const bodyText = document.body.innerText;
            const iframes = Array.from(document.querySelectorAll('iframe')).map(i => i.src.toLowerCase());

            // Using regular expressions with the 'i' flag for case-insensitive matching.
            // This is more robust and handles variations like "Verify" or "verifying".
            const textChecksRegex = [
                /verify(ing)? you are human/i,
                /captcha/i,
                /just a moment/i,
                /i'm not a robot/i
            ];

            const iframeChecks = [
                'recaptcha',
                'hcaptcha',
                'turnstile',
                'challenges.cloudflare.com'
            ];

            const hasTextChallenge = textChecksRegex.some(regex => regex.test(bodyText));
            const hasIframeChallenge = iframes.some(src => iframeChecks.some(check => src.includes(check)));

            return hasTextChallenge || hasIframeChallenge;
        });

        if (!isChallengePresent) {
            console.log("No CAPTCHA or challenge detected. Continuing.");
            return;
        }

        console.log("CAPTCHA or challenge page detected. Attempting to solve simple checkbox...");

        // Now, try to solve the simple checkbox if it exists
        const captchaFrameLocator = page.locator('iframe[title="reCAPTCHA"], iframe[title*="hCaptcha"]');
        
        try {
            await captchaFrameLocator.waitFor({ state: 'visible', timeout: 5000 });
            const frame = captchaFrameLocator.frameLocator(':scope');
            const checkbox = frame.locator('#recaptcha-anchor, #checkbox');
            
            // --- Human-like Interaction ---
            // Move the mouse to the checkbox before clicking to better simulate a real user.
            const box = await checkbox.boundingBox();
            if (box) {
                // Move mouse over a few steps
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                // Pause for a brief, random interval
                await page.waitForTimeout(Math.random() * 500 + 500);
            }

            await checkbox.click({ timeout: 5000 });
            console.log("Clicked the CAPTCHA checkbox. Waiting for it to be solved and the page to load...");

            await captchaFrameLocator.waitFor({ state: 'hidden', timeout: 20000 });
            console.log("CAPTCHA seems to be solved. Waiting for network to be idle.");
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            console.log("Page seems to have loaded after CAPTCHA.");
            return;
        } catch (error) {
            // Instead of throwing an error, we just warn and return.
            // This allows the main scraper to continue and extract whatever text is on the CAPTCHA page.
            console.warn("CAPTCHA checkbox not found or could not be solved. Scraping will continue on the current page.");
            return;
        }

    } catch (error) {
        // The main goal is to not crash. If anything goes wrong, log it and let the scraper proceed.
        console.error(`An error occurred in handleCaptcha, but scraping will continue. Error: ${error.message}`);
    }
}

export default handleCaptcha;