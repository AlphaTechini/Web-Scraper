 // I'm bringing in all the tools I need here.
import 'dotenv/config'; // To manage my environment variables, like the target URL.
import * as cheerio from 'cheerio'; // Like jQuery for the server-side, great for parsing HTML.
// import axios from 'axios'; // Not using axios right now, so I'll keep it commented out.
import { getHeaders } from './utilities/headers.js'; // My custom function to get realistic browser headers.
import handleCookieConsent from './cookie_handler.js'; // My helper for dealing with those annoying cookie popups.
import handleCaptcha from './captcha_handler.js'; // My helper for CAPTCHAs.
import playwrightExtra from 'playwright-extra'; // An extension for playwright to make it more powerful.

// I'm pulling the target URL from my .env file. Makes it easy to change targets without touching the code.
const TARGET_URL = process.env.TARGET_URL; // I can add a fallback like || 'https://www.example.com' if I want.

// Common launch options to make the browser behave more consistently, even when not in focus or minimized.
const browserLaunchOptions = {
    headless: true,
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
    ]
};

/**
 * This function contains the core logic for scraping a single page.
 * It assumes a Playwright page object is already created and passed to it.
 * It does NOT manage the browser lifecycle (launching/closing).
 */
export async function scrapePageLogic(page, url) {
    // Get a fresh set of realistic headers for this request.
    const headers = getHeaders();
    // Set the extra headers for all subsequent requests on this page.
    await page.setExtraHTTPHeaders(headers);

    // Go to the target URL. I'm setting a longer timeout and waiting for the DOM to be ready,
    // as some sites have long loading times or JS challenges.
    // I'm switching to 'networkidle' which is more robust for pages with JS challenges like Cloudflare.
    await page.goto(url, { timeout: 200000, waitUntil: 'networkidle' });

    // This is a crucial step to wait for Cloudflare's "Just a moment..." page to pass.
    // After waiting for network idle, this should pass quickly. I'll keep it as a safeguard with a shorter timeout.
    try {
        await page.waitForFunction(() => !document.title.includes('Just a moment...'), { timeout: 15000 });
    } catch (e) {
        console.log(`Page title did not change from "Just a moment..." for ${url}, but continuing anyway.`);
    }

    // Run my cookie handler to try and click "accept" on any banners.
    await handleCookieConsent(page, url);
    // Now, let's try to handle any simple "I am human" captchas.
    await handleCaptcha(page);

    // Once the page is loaded (and cookies/captchas handled), get the full HTML content.
    const html = await page.content();

    // Now, I'll use Cheerio to parse the HTML I just got.
    const $ = cheerio.load(html);
    // Grab the page title.
    const pageTitle = $('title').text();
    // Find all h1, h2, and h3 tags and store their text.
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
        headings.push($(el).text().trim());
    });
    // Do the same for paragraphs, but I'll only keep ones that are reasonably long.
    const paragraphs = [];
    $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 30) paragraphs.push(text);
    });

    // Assemble all the scraped data into a neat object.
    return {
        url,
        title: pageTitle,
        headings,
        paragraphs,
    };
}

// This is a wrapper function for scraping a single URL. It handles launching and closing the browser.
// It's perfect for one-off scrapes.
export const scrapeSingleUrl = async (url = TARGET_URL) => {
    let browser = null;

    try {
        // I'm launching the browser in headless mode now, so it runs in the background without a UI.
        browser = await playwrightExtra.chromium.launch(browserLaunchOptions);
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        return await scrapePageLogic(page, url);

    } catch (err) {
        // If anything goes wrong during the try block, I'll log the error.
        console.error(`Error in scrapeWebsite for ${url}:`, err);
        // Re-throw the error so the caller (our server) can handle it properly.
        throw err;
    } finally {
        // This block will run whether the scrape succeeded or failed.
        // It's crucial for making sure the browser instance always gets closed.
        if (browser) await browser.close();
    }
};

/**
 * This function contains the core logic for scraping multiple paginated pages.
 * It assumes a Playwright page object is already created and passed to it.
 * It does NOT manage the browser lifecycle (launching/closing).
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {string} baseUrl The base URL to scrape (without pagination query).
 * @param {number} numberOfPages The number of pages to scrape.
 * @returns {Promise<{baseUrl: string, results: any[]}>}
 */
export async function scrapePaginatedLogic(page, baseUrl, numberOfPages) {
    const allResults = []; // I'll store results from all pages here.

    // Loop through the number of pages I want to scrape.
    for (let i = 1; i <= numberOfPages; i++) {
        // This creates the URL for the current page. I might need to change `?page=${i}` depending on the site's URL structure.
        const url = `${baseUrl}?page=${i}`;
        console.log(`Scraping page ${i} of ${numberOfPages}: ${url}`);
        try {
            // Scrape the page using our reusable logic.
            const result = await scrapePageLogic(page, url);
            allResults.push(result);
            // I'm waiting for a random amount of time here to be nice to the server and avoid getting blocked.
            await delay(1000 + Math.random() * 1000);
        } catch (error) {
            // If one page fails, I'll log it and continue to the next.
            // This is important for batch jobs so one failure doesn't stop everything.
            console.error(`Failed to scrape page ${i} (${url}):`, error.message);
            // We could push an error object here if we wanted to report partial failures.
        }
    }

    return { baseUrl, results: allResults };
}

// I built this function to handle websites with multiple pages (pagination).
// This is a wrapper that manages the browser lifecycle for one-off multi-page scrapes.
export async function scrapeMultiplePages(baseUrl, numberOfPages) {
    let browser = null;
    try {
        browser = await playwrightExtra.chromium.launch(browserLaunchOptions);
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        const paginatedResult = await scrapePaginatedLogic(page, baseUrl, numberOfPages);
        return paginatedResult.results; // Maintain original return type (array of results)
    } catch (err) {
        console.error(`Error in scrapeMultiplePages for ${baseUrl}:`, err);
        throw err;
    } finally {
        // Ensure the single browser instance is closed when we're all done.
        if (browser) await browser.close();
    }
}

// A simple helper function to pause execution for a given number of milliseconds.
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
