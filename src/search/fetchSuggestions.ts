import { requestUrl } from 'obsidian';

export const fetchSuggestions = (
    query: string,
    suggestionContainer: HTMLElement,
    suggestionsBox: HTMLElement,
    selectSuggestion: (suggestion: string) => void
): void => {
    suggestionsBox.innerHTML = '';

    if (!query || query.trim() === '') {
        suggestionContainer.style.display = 'none';
        return;
    }

    requestUrl({
        url: `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        },
    }).then(response => {
        if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        try {
            const data = JSON.parse(response.text);
            const suggestions = data[1] || [];

            suggestionContainer.style.display = suggestions.length > 0 ? 'block' : 'none';

            suggestions.forEach((suggestion: string) => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('netClip-suggestion-item');

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('search_icon');
                iconSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
     
                const textSpan = document.createElement('span');
                textSpan.textContent = suggestion;

                suggestionDiv.appendChild(iconSpan);
                suggestionDiv.appendChild(textSpan);
                suggestionDiv.onclick = () => selectSuggestion(suggestion);
                suggestionsBox.appendChild(suggestionDiv);
            });
        } catch (parseError) {
            console.error('Error parsing suggestions:', parseError);
            suggestionContainer.style.display = 'none';
        }
    }).catch(error => {
        console.error('Error fetching suggestions:', error);
        suggestionContainer.style.display = 'none';
    });
};
