import { WebviewTag } from "./webViewComponent";

export class AdBlocker {
    private filters: {
        domainBlocks: Set<string>;
        patternBlocks: RegExp[];
        elementBlocks: string[];
    } = {
        domainBlocks: new Set(),
        patternBlocks: [],
        elementBlocks: []
    };

    private static instance: AdBlocker | null = null;
    private domainPatterns: string[] = [];
    private combinedPattern: RegExp | null = null
    private initialized = false;
    private blockedDomains: Set<string> = new Set();
    private blockedPatterns: RegExp[] = [];
    private blockedRequest: Set<string> = new Set();

    constructor(private settings: any) {
        if (!AdBlocker.instance) {
            AdBlocker.instance = this;
            this.initializeFilters();
        }
        return AdBlocker.instance;
    }

    public static async perload(): Promise<void>{
        if(!this.instance){
            this.instance = new AdBlocker({});
            await  this.instance.initializeFilters();
        }
    }

    public async initializeFilters(): Promise<void> {
        if (this.initialized) return;
        
        const responses = await Promise.all(
            this.filterUrls.map(async (url) => {
                try {
                    const response = await fetch(url);
                    return response.ok ? response.text() : '';
                } catch {
                    return '';
                }
            })
        );

        const rules = responses
            .join('\n')
            .split('\n')
            .filter(line => line && !line.startsWith('!') && !line.startsWith('['));

            await Promise.all([
                this.processDomainRules(rules),
                this.processPatternRules(rules),
                this.processElementRules(rules)
            ])

        this.domainPatterns = Array.from(this.filters.domainBlocks);
        this.combinedPattern = new RegExp(this.filters.patternBlocks.map(p => p.source).join('|'), 'i');
        this.initialized = true;
    }

    private async processDomainRules(rules: string[]): Promise<void>{
        for (const rule of rules){
            if(rule.startsWith('||')){
                const domain = rule.substring(2).split('^')[0].split('*')[0];
                if(domain) this.filters.domainBlocks.add(domain);
            }
        }
    }

    private async processPatternRules(rules: string[]): Promise<void> {
        for (const rule of rules){
            if (rule.startsWith('/') && rule.endsWith('/')) {
                const pattern = rule.slice(1, -1);
                this.filters.patternBlocks.push(new RegExp(pattern, 'i'));
            }
        }
    }

    private async processElementRules(rules: string[]): Promise<void> {
        for (const rule of rules){
            if (rule.startsWith('##')) {
                const selector = rule.substring(2);
                this.filters.elementBlocks.push(selector);
            }
        }
    }

    private filterUrls = [
        'https://easylist.to/easylist/easylist.txt',
        'https://easylist.to/easylist/easyprivacy.txt',
        'https://easylist.to/easylist/fanboy-annoyance.txt',
        'https://easylist.to/easylist/fanboy-social.txt',
        'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
        'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/badware.txt',
        'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt',
        'https://raw.githubusercontent.com/uBlockOrigin/uAssets/refs/heads/master/filters/privacy.txt'
    ];

    public isAdRequest(url: string): boolean {
        const urlObj = new URL(url);
        if (this.domainPatterns.some(pattern => urlObj.hostname.includes(pattern))) {
            return true;
        }

        if (this.combinedPattern && this.combinedPattern.test(url)) {
            return true;
        }
        return false;
    }

    public getDomainPatterns(): string[] {
        return this.domainPatterns;
    }

    public getDOMFilterScript(): string {
        return `
           (function() {
                const isYouTube = window.location.hostname.includes('youtube.com');
                
                if (isYouTube) {
                    const handleVideoAds = () => {
                        const video = document.querySelector('video');
                        if (video) {
                            const isAd = document.querySelector('.ytp-ad-module, .ad-showing, .ad-interrupting') !== null ||
                                (video.currentSrc && (video.currentSrc.includes('/ad/') || video.currentSrc.includes('/adlog/'))) ||
                                (video.duration > 0 && video.duration <= 30 && video.currentTime === 0) ||
                                document.querySelector('.ytp-ad-player-overlay, .ytp-ad-message-container') !== null ||
                                document.querySelector('.video-ads') !== null;
                            
                            if (isAd) {
                                const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-overlay-close-button');
                                if (skipButton) {
                                    skipButton.click();
                                    return;
                                }
                                
                                if (video.duration <= 30) {
                                    video.currentTime = video.duration;
                                    video.play();
                                }
                                
                                if (video.paused) {
                                    video.play();
                                }
                                
                                const adElements = document.querySelectorAll('.ytp-ad-player-overlay, .ytp-ad-message-container, .video-ads');
                                adElements.forEach(element => element.remove());
                            }
                        }
                    };

                    const videoObserver = new MutationObserver((mutations) => {
                        for (const mutation of mutations) {
                            if (mutation.type === 'childList' && 
                                (mutation.target.nodeName === 'VIDEO' || 
                                 mutation.target.classList.contains('ytp-ad-module') ||
                                 mutation.target.classList.contains('ytp-ad-player-overlay') ||
                                 mutation.target.classList.contains('video-ads'))) {
                                handleVideoAds();
                                break;
                            }
                        }
                    });

                    const containers = document.querySelectorAll('#movie_player, .html5-video-container, .video-ads');
                    containers.forEach(container => {
                        videoObserver.observe(container, {
                            childList: true,
                            subtree: true,
                            attributes: false
                        });
                    });

                    handleVideoAds();

                    const video = document.querySelector('video');
                    if (video) {
                        video.addEventListener('timeupdate', handleVideoAds);
                        video.addEventListener('play', handleVideoAds);
                        video.addEventListener('loadedmetadata', handleVideoAds);
                        video.addEventListener('progress', handleVideoAds);
                    }

                    if (video) {
                        video.addEventListener('play', () => {
                            if (video.paused) {
                                video.play();
                            }
                        });
                    }
                }
            })();
        `;
    }

    public setupRequestInterception(webview: WebviewTag): void{
        const blockedRequests = new Set<number>();

        webview.addEventListener('will-request', (event: any) => {
            const url = event.url;
            const requestId = event.id;

            if (blockedRequests.has(requestId)) {
                event.preventDefault();
                return;
            }

            let hostname: string;
            try {
                hostname = new URL(url).hostname;
            } catch {
                return;
            }

            if (this.blockedDomains.has(hostname)) {
                blockedRequests.add(requestId);
                event.preventDefault();
                return;
            }

            if (this.blockedPatterns.length > 0) {
                for (const pattern of this.blockedPatterns) {
                    if (pattern.test(url)) {
                        blockedRequests.add(requestId);
                        event.preventDefault();
                        return;
                    }
                }
            }
        });

        webview.addEventListener('will-receive-headers', (event: any) => {
            const headers = event.headers;
            if (headers) {
                const contentType = headers['content-type']?.join(' ');
                if (contentType && /(ad|track|analytics)/i.test(contentType)) {
                    blockedRequests.add(event.id);
                    event.preventDefault();
                }
            }
        });
    }

    public applyFilters(webview: WebviewTag): void {
        webview.executeJavaScript(this.getDOMFilterScript())
            .catch(error => {
                console.error('Adblock script error:', error);
            });
        (webview as unknown as Electron.WebviewTag).insertCSS(this.getCSSBlockingRules());
    }

    private getCSSBlockingRules(): string {
        return this.filters.elementBlocks
            .map(selector => `${selector} { display: none !important; }`)
            .join('\n');
    }
}