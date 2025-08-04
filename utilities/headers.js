import UserAgent from "user-agents";

export const getHeaders = () => {
    const userAgent = new UserAgent();
    return {
        'User-Agent': userAgent.toString(),
        'Accept': 'text/html,application/xhtml+xml,applcation/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US, en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
    }
};