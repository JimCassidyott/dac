const Crawler = require('crawler');
const URL = require('url');

class WebCrawler {
    constructor(options = {}) {
        this.visitedUrls = new Set();
        this.baseUrl = '';
        this.results = [];
        
        this.crawler = new Crawler({
            maxConnections: 10,
            rateLimit: 1000, // 1 sec delay between requests
            ...options,
            callback: (error, res, done) => {
                if (error) {
                    console.error('Error crawling:', error);
                    done();
                    return;
                }
                this.processPage(res);
                done();
            }
        });
    }

    processPage(res) {
        const $ = res.$;
        if (!$) return;

        // Get all links on the page
        $('a').each((i, link) => {
            const href = $(link).attr('href');
            if (!href) return;

            const parsedUrl = URL.parse(href);
            const absoluteUrl = parsedUrl.protocol
                ? href
                : URL.resolve(this.baseUrl, href);

            // Only process URLs from the same domain
            if (absoluteUrl.startsWith(this.baseUrl) && !this.visitedUrls.has(absoluteUrl)) {
                this.visitedUrls.add(absoluteUrl);
                this.results.push(absoluteUrl);
                this.crawler.queue(absoluteUrl);
            }
        });
    }

    async crawl(startUrl) {
        return new Promise((resolve) => {
            this.baseUrl = startUrl;
            this.visitedUrls.clear();
            this.results = [];
            
            this.visitedUrls.add(startUrl);
            this.results.push(startUrl);

            this.crawler.queue(startUrl);

            // When queue is empty, crawling is complete
            this.crawler.on('drain', () => {
                resolve(this.results);
            });
        });
    }
}

module.exports = WebCrawler;