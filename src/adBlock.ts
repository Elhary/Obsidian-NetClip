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
    private static blockedCount = 0;

    // Add domain pattern cache
    private domainPatterns: string[] = [];

    constructor(private settings: any) {
        if (!AdBlocker.instance) {
            AdBlocker.instance = this;
            this.initializeFilters();
        }
        return AdBlocker.instance;
    }

    public async initializeFilters(): Promise<void> {
        const responses = await Promise.all(
            this.filterUrls.map(async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    return '';
                }
                return response.text();
            })
        );

        const rules = responses
            .join('\n')
            .split('\n')
            .filter(line => line && !line.startsWith('!') && !line.startsWith('['));

        for (const rule of rules) {
            if (rule.startsWith('||')) {
                const domain = rule.substring(2).split('^')[0].split('*')[0];
                if (domain) this.filters.domainBlocks.add(domain);
            } else if (rule.startsWith('/') && rule.endsWith('/')) {
                const pattern = rule.slice(1, -1);
                this.filters.patternBlocks.push(new RegExp(pattern, 'i'));
            } else if (rule.startsWith('##')) {
                const selector = rule.substring(2);
                this.filters.elementBlocks.push(selector);
            }
        }

        this.domainPatterns = Array.from(this.filters.domainBlocks);
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

    // Optimized URL checking
    public isAdRequest(url: string): boolean {
        const urlObj = new URL(url);
        if (this.domainPatterns.some(pattern => urlObj.hostname.includes(pattern))) {
            AdBlocker.blockedCount++;
            return true;
        }

        const combinedPattern = new RegExp(this.filters.patternBlocks.map(p => p.source).join('|'), 'i');
        if (combinedPattern.test(url)) {
            AdBlocker.blockedCount++;
            return true;
        }
        return false;
    }

    // Add method to get domain patterns
    public getDomainPatterns(): string[] {
        return this.domainPatterns;
    }

    public getDOMFilterScript(): string {
        return `
            (function() {
                const selectors = ${JSON.stringify(this.filters.elementBlocks)};
                const domains = new Set(${JSON.stringify(this.domainPatterns)});
                
                const style = document.createElement('style');
                style.textContent = selectors.map(s => \`\${s}{visibility:hidden!important;opacity:0!important;contain:strict!important}\`).join('');
                document.head.prepend(style);
                
                const originalCreateElement = document.createElement;
                document.createElement = function(tagName) {
                    const elem = originalCreateElement.call(this, tagName);
                    if (['iframe','script','img'].includes(tagName.toLowerCase())) {
                        let src = '';
                        Object.defineProperty(elem, 'src', {
                            get: () => src,
                            set: (value) => {
                                try {
                                    const url = new URL(value);
                                    if (domains.has(url.hostname)) {
                                        elem.remove();
                                        return;
                                    }
                                } catch {}
                                src = value;
                                elem.setAttribute('src', value);
                            }
                        });
                    }
                    return elem;
                };

                let processing = false;
                const observer = new MutationObserver(mutations => {
                    if (!processing) {
                        processing = true;
                        requestIdleCallback(() => {
                            const elements = [];
                            mutations.forEach(mutation => {
                                elements.push(...mutation.addedNodes);
                            });
                            
                            elements.forEach(node => {
                                if (node.nodeType === 1) {
                                    // Fast selector match check
                                    if (node.matches(selectors.join(','))) {
                                        node.style.display = 'none';
                                    }
                                    
                                    // Block nested resources
                                    if (node.tagName === 'IFRAME' || node.tagName === 'SCRIPT') {
                                        const src = node.getAttribute('src');
                                        if (src && domains.has(new URL(src).hostname)) {
                                            node.remove();
                                        }
                                    }
                                }
                            });
                            processing = false;
                        });
                    }
                });

                window.addEventListener('load', () => {
                    observer.observe(document.documentElement, {
                        childList: true,
                        subtree: true,
                        attributes: false
                    });
                    
                    style.textContent = selectors.map(s => \`\${s}{display:none!important}\`).join('');
                    
                    const elements = document.querySelectorAll(selectors.join(','));
                    let i = 0;
                    function processChunk() {
                        const chunk = Array.from(elements).slice(i, i+50);
                        chunk.forEach(elem => elem.style.display = 'none');
                        i += 50;
                        if (i < elements.length) requestIdleCallback(processChunk);
                    }
                    processChunk();
                }, { once: true });
            })();
        `;
    }

    public getBlockedCount(): number {
        return AdBlocker.blockedCount;
    }

    public applyFilters(document: Document): void {
        const script = document.createElement('script');
        script.textContent = this.getDOMFilterScript();
        document.head.appendChild(script);

        window.addEventListener('message', (event) => {
            if (event.data?.type === 'adblock-stats') {
                AdBlocker.blockedCount += event.data.count;
            }
        });
    }
}