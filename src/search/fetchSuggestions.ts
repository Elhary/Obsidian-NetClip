import { requestUrl } from 'obsidian';

export const fetchSuggestions = (
    query: string,
    suggestionContainer: HTMLElement,
    suggestionsBox: HTMLElement,
    selectSuggestion: (suggestion: string) => void
): void => {
   
    while (suggestionsBox.firstChild) {
        suggestionsBox.removeChild(suggestionsBox.firstChild);
    }

    if (!query || query.trim() === '') {
        suggestionContainer.classList.add('netclip_search_hidden');
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

            suggestions.forEach((suggestion: string) => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('netClip-suggestion-item');

      
                const textSpan = document.createElement('span');
                textSpan.textContent = suggestion;

        
                suggestionDiv.appendChild(textSpan);
                suggestionDiv.addEventListener('click', () => selectSuggestion(suggestion));
                suggestionsBox.appendChild(suggestionDiv);
            });


            if(suggestions.length > 0){
                suggestionContainer.classList.remove('netclip_search_hidden');
            }else{
                suggestionContainer.classList.add('netclip_search_hidden');
            }

        } catch (parseError) {
            console.error('Error parsing suggestions:', parseError);
            suggestionContainer.classList.add('netclip_search_hidden');
        }
    }).catch(error => {
        console.error('Error fetching suggestions:', error);
        suggestionContainer.classList.add('netclip_search_hidden');
    });
};
