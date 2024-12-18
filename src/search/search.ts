import { baseSearchUrls } from './searchUrls';  
import { requestUrl } from 'obsidian';
import { fetchSuggestions } from './fetchSuggestions'; 

export interface WebSearchSettings {
    searchEngine?: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
}

export class WebSearch {

    private searchInput: HTMLInputElement;
    private suggestionsBox: HTMLElement;
    private suggestionContainer: HTMLElement;
    private currentSuggestionIndex: number = -1;
    private settings: WebSearchSettings;


    private baseSearchUrls: Record<string, string> = baseSearchUrls;

    constructor(
        searchInput: HTMLInputElement,
        suggestionContainer: HTMLElement,
        suggestionsBox: HTMLElement,
        settings: WebSearchSettings = {}
    ) {
        this.searchInput = searchInput;
        this.suggestionContainer = suggestionContainer;
        this.suggestionsBox = suggestionsBox;
        this.settings = {
            searchEngine: 'google',
            ...settings
        };

        this.setupEventListeners();
    }

    private setupEventListeners(): void {

        this.searchInput.addEventListener('input', () => {
            const query = this.searchInput.value.trim();
            if (query === '') {
                this.hideSuggestions();
            } else {
                fetchSuggestions(
                    query,
                    this.suggestionContainer,
                    this.suggestionsBox,
                    this.selectSuggestion.bind(this)
                );
            }
        });


        this.searchInput.addEventListener("keydown", (event) => {
            const suggestions = this.suggestionsBox.children;
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateSuggestions('down', suggestions);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateSuggestions('up', suggestions);
                    break;
                case 'Enter':
                    event.preventDefault();
                    this.handleEnterKey(suggestions);
                    break;
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        });

        document.addEventListener('click', (event) => {
            if (!this.searchInput.contains(event.target as Node) &&
                !this.suggestionContainer.contains(event.target as Node)) {
                this.hideSuggestions();
            }
        });
    }

    private isValidUrl(str: string): boolean {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    }

    private constructSearchUrl(query: string): string {
        const selectedEngine = this.settings.searchEngine || 'google';
        const baseSearchUrl = this.baseSearchUrls[selectedEngine];
        const encodedQuery = encodeURIComponent(query.trim());
        return `${baseSearchUrl}${encodedQuery}`;
    }

    private navigateToQuery(query: string): string {
        const searchUrl = this.isValidUrl(query)
            ? query
            : this.constructSearchUrl(query);
            
        const event = new CustomEvent('search-query', {
            detail: { url: searchUrl, query: query }
        });
        this.searchInput.dispatchEvent(event);

        return searchUrl;
    }

    private selectSuggestion(suggestion: string): void {
        this.searchInput.value = suggestion;
        this.navigateToQuery(suggestion);
        this.hideSuggestions();
    }

    private navigateSuggestions(direction: 'up' | 'down', suggestions: HTMLCollection): void {
        if (suggestions.length === 0) return;

        if (this.currentSuggestionIndex !== -1) {
            suggestions[this.currentSuggestionIndex].classList.remove('selected');
        }

        if (direction === 'down') {
            this.currentSuggestionIndex = this.currentSuggestionIndex < suggestions.length - 1
                ? this.currentSuggestionIndex + 1
                : -1;
        } else {
            this.currentSuggestionIndex = this.currentSuggestionIndex > -1
                ? this.currentSuggestionIndex - 1
                : suggestions.length - 1;
        }
        if (this.currentSuggestionIndex === -1) {
            this.searchInput.value = this.searchInput.getAttribute('data-original-value') || '';
        } else {
            const selectedSuggestion = suggestions[this.currentSuggestionIndex] as HTMLElement;
            selectedSuggestion.classList.add('selected');
            this.searchInput.value = selectedSuggestion.textContent || '';
        }
    }

    private handleEnterKey(suggestions: HTMLCollection): void {
        if (this.currentSuggestionIndex !== -1 && suggestions[this.currentSuggestionIndex]) {
            (suggestions[this.currentSuggestionIndex] as HTMLElement).click();
        } else {
            const query = this.searchInput.value;
            if (query) {
                this.navigateToQuery(query);
            }
        }
        this.hideSuggestions();
    }

    private hideSuggestions(): void {
        this.suggestionContainer.style.display = 'none';
        this.suggestionsBox.innerHTML = '';
        this.currentSuggestionIndex = -1;
    }
}
