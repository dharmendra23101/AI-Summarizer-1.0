// Get summary data from URL params
function getSummaryFromStorage() {
    const summaryId = new URLSearchParams(window.location.search).get('id');
    
    if (!summaryId) {
        document.getElementById('summaryContent').innerHTML = '<p class="error-message">No summary ID provided</p>';
        return;
    }
    
    chrome.storage.local.get('savedSummaries', (data) => {
        const savedSummaries = data.savedSummaries || [];
        const summary = savedSummaries.find(s => s.id === summaryId);
        
        if (summary) {
            displaySummary(summary);
        } else {
            document.getElementById('summaryContent').innerHTML = '<p class="error-message">Summary not found</p>';
        }
    });
}

// Display summary on the page
function displaySummary(summary) {
    document.getElementById('pageUrl').textContent = summary.url || 'Unknown';
    document.getElementById('pageTitle').textContent = summary.title || 'Unknown';
    document.getElementById('summaryLanguage').textContent = getLanguageName(summary.language) || summary.language;
    
    const date = new Date(summary.timestamp);
    document.getElementById('summaryDate').textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    document.getElementById('summaryContent').innerHTML = formatSummaryOutput(summary.content);
    document.title = `Summary: ${summary.title || 'Unknown'}`;
}

// Format summary with HTML
function formatSummaryOutput(summary) {
    if (!summary) return '';
    
    // Basic sanitization
    const sanitized = summary
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Format glossary section if it exists
    let formattedSummary = sanitized;
    
    // Try to detect headings (lines ending with a colon that aren't part of a glossary)
    formattedSummary = formattedSummary.replace(/^([^:\n]+):\s*$/gm, '<h2>$1</h2>');
    
    // Try to detect and format the glossary section
    const glossaryPatterns = [
        /glossary:/i,
        /key terms:/i,
        /important terms:/i,
        /terminology:/i
    ];
    
    let hasGlossary = false;
    
    for (const pattern of glossaryPatterns) {
        if (pattern.test(formattedSummary)) {
            const parts = formattedSummary.split(pattern);
            if (parts.length > 1) {
                const mainContent = parts[0];
                const glossaryContent = parts[1];
                
                // Process the glossary content to format terms and definitions
                const processedGlossary = processGlossaryContent(glossaryContent);
                
                formattedSummary = `
                    <div class="summary-content">${formatMainContent(mainContent)}</div>
                    <div class="glossary">
                        <div class="glossary-title">Glossary</div>
                        <div class="glossary-content">${processedGlossary}</div>
                    </div>
                `;
                hasGlossary = true;
                break;
            }
        }
    }
    
    // If no glossary was found, format the entire content
    if (!hasGlossary) {
        formattedSummary = `<div class="summary-content">${formatMainContent(formattedSummary)}</div>`;
    }
    
    return formattedSummary;
}

// Process main content with improved formatting
function formatMainContent(content) {
    // Format strong/bold text (replace ** or __ with <strong>)
    let formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Convert markdown headings to HTML headings
    formatted = formatted
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    
    // Better bullet point formatting
    // First, identify bullet point lists and wrap them in <ul> tags
    let bulletListPattern = /(\n- .*?)+/g;
    formatted = formatted.replace(bulletListPattern, match => {
        const listItems = match.trim().split('\n- ');
        // Remove first empty item
        listItems.shift();
        
        return '<ul>' + 
            listItems.map(item => `<li>${item}</li>`).join('') + 
            '</ul>';
    });
    
    // Format numbered lists
    let numberedListPattern = /(\n\d+\. .*?)+/g;
    formatted = formatted.replace(numberedListPattern, match => {
        const listItems = match.trim().split('\n')
            .filter(line => /^\d+\. /.test(line))
            .map(line => line.replace(/^\d+\. /, ''));
        
        return '<ol>' + 
            listItems.map(item => `<li>${item}</li>`).join('') + 
            '</ol>';
    });
    
    // Convert double line breaks to paragraph breaks
    formatted = formatted
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n(?![<\/])/g, '<br>'); // Replace single line breaks with <br> but not if followed by HTML tags
    
    // Wrap in paragraphs if not already done
    if (!formatted.startsWith('<h') && !formatted.startsWith('<ul') && !formatted.startsWith('<ol')) {
        formatted = `<p>${formatted}</p>`;
    }
    
    return formatted;
}

// Process glossary content with improved formatting
function processGlossaryContent(content) {
    // Check if the glossary has a pattern like "Term: Definition"
    if (/^[^:]+:\s.*$/m.test(content)) {
        // Split by lines
        const lines = content.trim().split('\n');
        let dl = '<dl>';
        
        let currentTerm = null;
        let currentDefinition = '';
        
        lines.forEach(line => {
            // Check if this line is a new term
            const termMatch = line.match(/^([^:]+):\s(.*)$/);
            
            if (termMatch) {
                // If we have a previous term, add it to the list
                if (currentTerm) {
                    dl += `<dt>${currentTerm}</dt><dd>${currentDefinition}</dd>`;
                }
                
                // Start a new term
                currentTerm = termMatch[1].trim();
                currentDefinition = termMatch[2].trim();
            } else if (line.trim() && currentTerm) {
                // This is a continuation of the current definition
                currentDefinition += ' ' + line.trim();
            }
        });
        
        // Add the last term
        if (currentTerm) {
            dl += `<dt>${currentTerm}</dt><dd>${currentDefinition}</dd>`;
        }
        
        dl += '</dl>';
        return dl;
    }
    
    // If the format is not recognized, just format it as regular paragraphs
    return formatMainContent(content);
}

// Get language name from code
function getLanguageName(code) {
    const languages = {
        'en': 'English',
        'hi': 'Hindi',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ru': 'Russian',
        'ar': 'Arabic',
        'pt': 'Portuguese',
        'it': 'Italian',
        'nl': 'Dutch',
        'ko': 'Korean',
        'tr': 'Turkish',
        'pl': 'Polish',
        'sv': 'Swedish',
        'no': 'Norwegian',
        'fi': 'Finnish',
        'da': 'Danish',
        'el': 'Greek'
    };
    
    return languages[code] || code;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log("Fullpage script loaded");
    
    // Set theme based on stored preference
    chrome.storage.local.get('userPrefs', (data) => {
        if (data.userPrefs && data.userPrefs.theme === 'dark') {
            document.body.classList.add('dark-theme');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
        }
    });
    
    // Load summary
    getSummaryFromStorage();
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.classList.remove('dark-theme');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
            
            // Update preference if possible
            chrome.storage.local.get('userPrefs', (data) => {
                if (data.userPrefs) {
                    data.userPrefs.theme = 'light';
                    chrome.storage.local.set({ userPrefs: data.userPrefs });
                }
            });
        } else {
            document.body.classList.add('dark-theme');
            document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
            
            // Update preference if possible
            chrome.storage.local.get('userPrefs', (data) => {
                if (data.userPrefs) {
                    data.userPrefs.theme = 'dark';
                    chrome.storage.local.set({ userPrefs: data.userPrefs });
                }
            });
        }
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
        const content = document.getElementById('summaryContent').innerText;
        navigator.clipboard.writeText(content)
            .then(() => {
                alert('Summary copied to clipboard!');
            })
            .catch(err => {
                alert('Failed to copy: ' + err);
            });
    });
    
    // Print button
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });
});