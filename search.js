// c:\Web Scraper\search.js
import playwrightExtra from 'playwright-extra';
import UserAgent from 'user-agents';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { getHeaders } from './utilities/headers.js'; // Import our custom headers utility
import handleCaptcha from './captcha_handler.js'; // Import the CAPTCHA handler utility.

// Since we are using ES modules, we need to get __dirname manually for screenshots
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common launch options to make the browser behave more consistently, even when not in focus or minimized.
const browserLaunchOptions = {
    headless: false,
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
    ]
};

/**
 * Searches DuckDuckGo for a given keyword and returns a list of result URLs.
 * @param {string} keyword The search term.
 * @param {number} limit The maximum number of URLs to return.
 * @returns {Promise<string[]>} A promise that resolves to an array of URLs.
 */
export async function searchUrlsByKeyword(keyword, limit = 5) {
    if (!keyword) {
        console.error("[Search] Keyword cannot be empty.");
        return [];
    }

    console.log(`[Search] Starting search for keyword: "${keyword}"`);
    let browser = null;
    let page = null; // Define page here to use it in the catch block
    try {
        browser = await playwrightExtra.chromium.launch(browserLaunchOptions);
        const context = await browser.newContext({
            userAgent: new UserAgent({ deviceCategory: 'desktop' }).toString(),
            viewport: { width: 1920, height: 1080 },
        });
        page = await context.newPage();

        // **CRITICAL FIX**: Set the same realistic headers we use in the main scraper.
        await page.setExtraHTTPHeaders(getHeaders());

        // DuckDuckGo's HTML version is much simpler and more stable to scrape than Google.
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
        console.log(`[Search] Navigating to: ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // **FIX**: First, check for and handle any CAPTCHA that might have appeared on page load.
        await handleCaptcha(page);

        // --- Using Cheerio for Extraction ---
        console.log('[Search] Getting page content for Cheerio to parse...');
        const html = await page.content(); // 1. Get the entire rendered HTML from the browser.
        const $ = cheerio.load(html);     // 2. Load it into Cheerio.

        const resultsSelector = 'div.result h2.result__title a.result__a';
        const urls = [];

        // 3. Use Cheerio's familiar syntax to find and process the links.
        $(resultsSelector).each((i, element) => {
            const redirectUrl = $(element).attr('href');
            if (redirectUrl && redirectUrl.includes('uddg=') && urls.length < limit) {
                // The real URL is in the 'uddg' query parameter. Let's extract it.
                const urlObject = new URL(redirectUrl, 'https://duckduckgo.com');
                const actualUrl = urlObject.searchParams.get('uddg');
                if (actualUrl) {
                    urls.push(actualUrl);
                }
            }
        });

        if (urls.length === 0) {
            console.warn('[Search] Selectors found, but no URLs could be extracted. The page structure might have changed.');
            const screenshotPath = path.resolve(__dirname, 'search_failure_screenshot.png');
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`[Search] A screenshot has been saved to ${screenshotPath} for debugging.`);
        } else {
            console.log(`[Search] Found ${urls.length} URLs.`);
        }

        return urls;

    } catch (error) {
        console.error(`[Search] An error occurred while searching for "${keyword}":`, error.message);
        if (browser && page) {
            const screenshotPath = path.resolve(__dirname, 'search_error_screenshot.png');
            try {
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`[Search] A screenshot of the error page has been saved to ${screenshotPath}`);
            } catch (ssError) {
                console.error('[Search] Could not take a screenshot.', ssError);
            }
        }
        return []; // Return empty array on failure to prevent crashing the caller.
    } finally {
        if (browser) await browser.close();
    }
}