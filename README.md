A Web scraper made with Node.js, Playwright, Cheerio, and Fastify that can auto accept/reject cookies and solve basic click captchas.

# Web Scraper

## Overview

This project is a web scraper built with Node.js. It uses Playwright for powerful browser automation to handle dynamic websites, Cheerio for efficient HTML parsing, and Fastify to expose the scraping functionality through a simple API. The scraper is designed to be robust, with built-in capabilities to automatically handle cookie consent banners and solve basic click-based CAPTCHAs, making it easier to access content on modern websites.

## Key Features

*   **Dynamic Content Scraping:** Leverages Playwright to control a real browser, enabling it to scrape single-page applications (SPAs) and sites that rely heavily on JavaScript.
*   **Cookie Consent Handling:** Automatically detects and clicks "accept" or "reject" on common cookie consent pop-ups to proceed with scraping.
*   **Basic CAPTCHA Solving:** Identifies and attempts to solve simple "I'm not a robot" checkbox CAPTCHAs.
*   **Fast API Endpoint:** Uses Fastify to provide a lightweight and high-performance server to trigger scraping jobs.
*   **Efficient HTML Parsing:** Utilizes Cheerio for fast, jQuery-like traversal and manipulation of the downloaded HTML.

## Technologies Used

*   **Backend:** Node.js, Fastify
*   **Scraping & Automation:** Playwright
*   **HTML Parsing:** Cheerio
*   **Frontend:** A basic HTML placeholder is provided. The complete frontend will be made soon.

## Project Structure

The project is organized into several key files to separate concerns:

| File/Folder          | Description                                                                                                                                     |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.js`          | **(Entry Point)** Initializes the Fastify server and defines the API endpoints for scraping.                                                      |
| `scraper.js`         | Contains the core scraping logic. It orchestrates Playwright, `cookie_handler.js`, and `captcha_handler.js` to fetch and process a web page.      |
| `cookie_handler.js`  | A module responsible for detecting and interacting with cookie consent banners using robust selectors and human-like interactions.               |
| `captcha_handler.js` | A module that detects and attempts to solve simple checkbox-based CAPTCHAs to get past basic bot-detection measures.                              |
| `Frontend/`          | Contains the static assets for a simple frontend interface. The `index.html` file is a placeholder for a future Svelte control panel.             |
| `.gitignore`         | Specifies which files and directories (like `node_modules` and `.env`) to exclude from version control.                                           |
| `package.json`       | Lists project dependencies and defines scripts for running the application.                                                                     |

*Note: `server.js` and `scraper.js` are representative names for the main application and scraping logic files.*

## Purpose

The primary goal of this project is to provide a tool for systematically gathering large amounts of text and data from websites. This data can then be used as a corpus for training Artificial Intelligence and Machine Learning models, particularly in the field of Natural Language Processing (NLP). By automating the tedious parts of web scraping, such as handling pop-ups and simple bot checks, it enables a more efficient data collection pipeline.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```sh
    git clone <repository-url>
    cd "Web Scraper"
    ```

2.  Install the dependencies. This will also download the necessary browser binaries for Playwright.
    ```sh
    npm install
    ```

### Configuration

Create a `.env` file in the root of the project to store any environment-specific variables, such as the server port.

```
PORT=3000
```

### Running the Scraper

Start the Fastify server:
```sh
npm start
```
The server will be running on the port specified in your `.env` file, or a default port.

## API Usage

This server exposes two main endpoints for scraping.

### Single URL Scraping

To scrape a single website, send a `GET` request to the `/api/scrape` endpoint with a `url` query parameter.

**Example Request:**
```
GET http://localhost:3000/scrape?url=https://example.com
```

The API will return the scraped content from the specified URL in a JSON format.

### Search Keywords to Scrape

To scrape a website or multiple websites/webpages by searchng for keywords and specifying the number of pages to scrape, send a `GET` request to the `/api/search` endpoint with a `url` query parameter.
*Note: The code defaults to first 4 urls when scraping using this route to change this go to "./server.js" and edit the number at line 90. Also the default number of pages to scrape is one to change that just specify in the request body if using Postman or Thunder client.*
**Example Request:**
```
GET http://localhost:3000/api/search?url=https://example.com
```

The API will return the scraped content from the specified URL in a JSON format.
