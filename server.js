// C:\Web Scraper\server.js
import 'dotenv/config';
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import playwrightExtra from 'playwright-extra';
import { scrapeSingleUrl, scrapeMultiplePages, scrapePageLogic, scrapePaginatedLogic } from './scraper.js';
import { searchUrlsByKeyword } from './search.js';

// Since we are using ES modules, we need to get __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * A helper function to race a promise against a timeout.
 * @param {Promise<any>} promise The promise to execute.
 * @param {number} ms The timeout in milliseconds.
 * @returns {Promise<any>}
 */
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms / 1000} seconds`)), ms))]);

// Common launch options to make the browser behave more consistently, even when not in focus or minimized.
const browserLaunchOptions = {
    headless: false,
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
    ]
};

// This function will set up and start the web server.
const startServer = async () => {
  // Initialize our Fastify server
  const fastify = Fastify({
    logger: true // It's good practice to have logging
  });

  // --- CORS ---
  // This allows your frontend (e.g., Svelte app on localhost:5173) to talk to this server
  await fastify.register(fastifyCors, {
    origin: false // Reflects the request origin. For production, you might want to be more specific.
  });

  // --- Static File Serving ---
  // This will serve the Svelte app's files (e.g., index.html, CSS, JS)
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'Frontend'),
  });

  // --- API Endpoint ---
  // This is the endpoint the Svelte app will call
  fastify.get('/api/scrape', async (request, reply) => {
    // I'll get the URL and an optional number of pages to scrape from the query string.
    const { url, pagesToScrape = 1 } = request.query;
    const numPages = parseInt(pagesToScrape, 10);

    try {
      // Log whether we're using a provided URL or the default from the .env file.
      if (url) {
        fastify.log.info(`Scraping request received for: ${url}, pages: ${numPages}`);
      } else {
        fastify.log.info(`Scraping request received. No URL provided, using default. pages: ${numPages}`);
      }

      let data;
      const TIMEOUT_PER_PAGE = 200000; // 200 seconds, consistent with the search endpoint
      // I'll use the existing logic to decide which function to call.
      if (numPages > 1) {
        // If more than one page is requested, I'll use the function built for that.
        data = await withTimeout(scrapeMultiplePages(url, numPages), TIMEOUT_PER_PAGE * numPages);
      } else {
        // Otherwise, I'll use the original single URL scraper.
        data = await withTimeout(scrapeSingleUrl(url), TIMEOUT_PER_PAGE);
      }
      // Send the scraped data back to the Svelte app as JSON
      reply.send(data);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'An error occurred while scraping the website.' });
    }
  });

  // --- Search and Scrape Endpoint ---
  fastify.post('/api/search', async (request, reply) => {
    // Now accepts `pagesToScrape` from the request body, defaulting to 1.
    const { keyword, pagesToScrape = 1 } = request.body || {};
    if (!keyword || typeof keyword !== 'string') {
      return reply.status(400).send({ error: 'A keyword is required.' });
    }
    const numPages = parseInt(pagesToScrape, 10);

    let chromiumBrowser = null;
    let webkitBrowser = null;
    try {
      const urls = await searchUrlsByKeyword(keyword, 4); // Find the top 4 URLs

      if (!urls || urls.length === 0) {
        return reply.send({ message: 'No URLs found for that keyword.', results: [] });
      }

      fastify.log.info(`Found ${urls.length} URLs. Starting concurrent scrape of ${numPages} page(s) each with Chromium and WebKit.`);

      // --- ADVANCED BROWSER MANAGEMENT ---
      // Launch BOTH browser types to run in parallel.
      // We run them in headless mode and with arguments to prevent throttling when the window isn't focused.
      [chromiumBrowser, webkitBrowser] = await Promise.all([
        playwrightExtra.chromium.launch(browserLaunchOptions),
        playwrightExtra.webkit.launch({ ...browserLaunchOptions, headless: false }) // WebKit doesn't support all args, but headless is key.
      ]);

      const defaultViewport = { width: 1920, height: 1080 };
      const chromiumContext = await chromiumBrowser.newContext({ viewport: defaultViewport });
      const webkitContext = await webkitBrowser.newContext({ viewport: defaultViewport });

      // Create an array of scraping promises to run them all concurrently.
      const scrapePromises = urls.map(async (url, index) => {
        // Distribute the URLs between the two browsers (even/odd)
        const isChromiumJob = index % 2 === 0;
        const context = isChromiumJob ? chromiumContext : webkitContext;
        const browserName = isChromiumJob ? 'Chromium' : 'WebKit';

        let page = null;
        try {
          // Each promise gets its own page (like a tab) in the assigned browser.
          page = await context.newPage();
          fastify.log.info(`[${browserName}] Starting job for base URL: ${url}`);
          
          // If scraping multiple pages, use the paginated logic. Otherwise, use the single page logic.
          if (numPages > 1) {
            // The timeout should wrap the entire paginated scrape for one base URL.
            // Adjust timeout based on number of pages.
            return await withTimeout(scrapePaginatedLogic(page, url, numPages), 200000 * numPages);
          } else {
            // Just scraping the single landing page.
            const result = await withTimeout(scrapePageLogic(page, url), 200000);
            // To keep the data structure consistent with the paginated results, wrap it.
            return { baseUrl: url, results: [result] };
          }
        } catch (error) {
          // On failure, we log it and create a standard error object, then continue.
          fastify.log.warn(`[${browserName}] Could not scrape ${url}: ${error.message}`);
          return { baseUrl: url, results: [], error: error.message };
        } finally {
          // IMPORTANT: Close the page to free up resources for the next task.
          if (page) {
            await page.close();
          }
          fastify.log.info(`[${browserName}] Finished job for base URL: ${url}`);
        }
      });

      // Promise.all waits for all scraping jobs to complete.
      const results = await Promise.all(scrapePromises);
      reply.send({ results });
    } catch (err) {
      fastify.log.error({ msg: 'Search and scrape failed for keyword', keyword, error: err.message });
      reply.status(500).send({ error: 'An internal error occurred during the search and scrape process.' });
    } finally {
      // After all scrapes are done, close all browser instances.
      if (chromiumBrowser || webkitBrowser) {
        fastify.log.info('Closing browser instances...');
        await Promise.all([
          chromiumBrowser?.close(),
          webkitBrowser?.close()
        ]);
        fastify.log.info('Batch scrape finished. All browsers closed.');
      }
    }
});

  // --- Start the Server ---
  try {
    const port = parseInt(process.env.PORT, 10) || 3000;
    await fastify.listen({ port, host: '127.0.0.1' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const runSingleScrape = async () => {
  console.log('Running in single-scrape mode...');
  try {
    const result = await scrapeSingleUrl(); // Uses default URL from .env
    if (result) {
      console.dir(result, { depth: null });
    }
  } catch (err) {
    console.error('Scraping failed:', err.message);
    process.exit(1);
  }
};

// Check for a '--server' flag to determine which mode to run in.
if (process.argv.includes('--server')) {
  
  startServer();
} else {
  runSingleScrape();
}
