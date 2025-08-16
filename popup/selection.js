// Load selected area text and process it
document.addEventListener('DOMContentLoaded', () => {
  // Load theme preference
  chrome.storage.local.get('userPrefs', (data) => {
    if (data.userPrefs && data.userPrefs.theme === 'dark') {
      document.body.classList.add('dark-theme');
      document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
  });
  
  // Load the selected text
  chrome.storage.local.get(['selectedAreaText', 'selectedAreaMetadata', 'lastAreaSelectionOptions', 'GEMINI_API_KEY'], (data) => {
    if (data.selectedAreaText && data.selectedAreaText.length > 0) {
      const apiKey = data.GEMINI_API_KEY;
      
      if (!apiKey) {
        handleError('API key is missing. Please add it in the Settings tab of the main popup.');
        return;
      }
      
      // Get options for summarization
      const options = data.lastAreaSelectionOptions || {
        lang: 'en',
        summaryLength: 'medium',
        summaryStyle: 'standard',
        includeGlossary: true
      };
      
      // Generate summary
      summarizeText(
        data.selectedAreaText,
        options.lang,
        options.summaryLength,
        options.summaryStyle,
        options.includeGlossary,
        data.selectedAreaMetadata,
        apiKey
      )
      .then(summary => {
        // Display summary
        const formattedSummary = formatSummaryOutput(summary, options.includeGlossary);
        document.getElementById('output').innerHTML = formattedSummary;
        document.getElementById('copyBtn').disabled = false;
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('loader').style.display = 'none';
        
        // Save current summary
        window.currentSummary = {
          content: summary,
          url: data.selectedAreaMetadata.url,
          title: data.selectedAreaMetadata.title,
          language: options.lang,
          timestamp: new Date().toISOString()
        };
      })
      .catch(error => {
        handleError(error.message);
      });
      
      // Clear the stored text
      chrome.storage.local.remove(['selectedAreaText', 'selectedAreaMetadata']);
    } else {
      handleError('No selected text found. Please try selecting an area again.');
    }
  });
  
  // Set up event listeners
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('copyBtn').addEventListener('click', copyText);
  document.getElementById('saveBtn').addEventListener('click', saveSummary);
  document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
  });
});

// Toggle theme
function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  
  if (document.body.classList.contains('dark-theme')) {
    document.body.classList.remove('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    
    chrome.storage.local.get('userPrefs', (data) => {
      if (data.userPrefs) {
        data.userPrefs.theme = 'light';
        chrome.storage.local.set({ userPrefs: data.userPrefs });
      }
    });
  } else {
    document.body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    
    chrome.storage.local.get('userPrefs', (data) => {
      if (data.userPrefs) {
        data.userPrefs.theme = 'dark';
        chrome.storage.local.set({ userPrefs: data.userPrefs });
      }
    });
  }
}

// Copy text to clipboard
function copyText() {
  const output = document.getElementById('output');
  navigator.clipboard.writeText(output.innerText)
    .then(() => {
      showNotification('Summary copied to clipboard!', 'success');
    })
    .catch(err => {
      showNotification('Failed to copy text: ' + err, 'error');
    });
}

// Save summary
function saveSummary() {
  if (!window.currentSummary) {
    showNotification('No summary to save', 'error');
    return;
  }
  
  chrome.storage.local.get('savedSummaries', (data) => {
    const savedSummaries = data.savedSummaries || [];
    
    // Add the current summary to the list
    savedSummaries.unshift({
      ...window.currentSummary,
      id: Date.now().toString()
    });
    
    // Keep only the latest 50 summaries
    const trimmedSummaries = savedSummaries.slice(0, 50);
    
    chrome.storage.local.set({ savedSummaries: trimmedSummaries }, () => {
      showNotification('Summary saved successfully!', 'success');
    });
  });
}

// Handle errors
function handleError(message) {
  document.getElementById('loader').style.display = 'none';
  document.getElementById('output').innerHTML = `<div class="error-message">${message}</div>`;
  console.error(message);
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Show notification with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Summarize text using Gemini API
async function summarizeText(text, targetLang, length, style, includeGlossary, metadata, apiKey, retries = 3, model = "gemini-1.5-flash-latest") {
  if (!apiKey) return "❌ API key not found. Please add it in Settings.";

  // Trim text if it's too long (Gemini API has token limits)
  const maxChars = 15000;
  const trimmedText = text.length > maxChars ? text.substring(0, maxChars) + "..." : text;

  // Build prompt based on options
  let lengthInstruction = "";
  switch (length) {
    case "brief": lengthInstruction = "very concise and brief"; break;
    case "medium": lengthInstruction = "moderately detailed"; break;
    case "detailed": lengthInstruction = "comprehensive and detailed"; break;
  }

  let styleInstruction = "";
  switch (style) {
    case "bullet": styleInstruction = "Use bullet points for the main points."; break;
    case "academic": styleInstruction = "Use an academic tone with proper citations if applicable."; break;
    case "simple": styleInstruction = "Use simple language suitable for a general audience."; break;
    default: styleInstruction = "Use a standard professional tone.";
  }

  const glossaryInstruction = includeGlossary ?
    "Also, provide a glossary of 5-10 key terms with brief definitions." :
    "Do not include a glossary.";

  // Special handling for area selection
  const selectionNote = metadata.selectionArea ? 
    `Note: This is from a user-selected area of the page, so focus only on summarizing this specific content.` : 
    '';

  const prompt = `
  You are a professional content summarizer. Create a ${lengthInstruction} summary of the following text in ${getLanguageName(targetLang)}.
  
  ${styleInstruction}
  
  ${glossaryInstruction}
  
  ${selectionNote}
  
  Page Title: ${metadata?.title || 'Unknown'}
  Page URL: ${metadata?.url || 'Unknown'}
  
  Text to summarize:
  "${trimmedText}"
  
  Format your response with clear sections and proper formatting. Use Markdown formatting for better readability:
  1. Use **bold** for important terms or concepts
  2. Use # headings for main sections and ## for subsections
  3. Use proper bullet points with - for lists
  4. Use numbered lists (1., 2., etc.) for sequential items
  5. If including a glossary, format each term as "Term: Definition" on a new line
  `;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      }
    );

    const data = await res.json();

    // Handle API overload with retries
    if (res.status === 503 && retries > 0) {
      document.getElementById('output').innerHTML = `
        <div class="retry-message">
          <p>⚠️ AI model is currently overloaded. Retrying (${4 - retries}/3)...</p>
        </div>
      `;
      await new Promise(r => setTimeout(r, 2000));
      return summarizeText(text, targetLang, length, style, includeGlossary, metadata, apiKey, retries - 1, model);
    }

    // Handle API errors
    if (data.error) {
      throw new Error(data.error.message || "Unknown API error");
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("No summary generated. Please try again.");
    }

    return data.candidates[0].content.parts[0].text;

  } catch (err) {
    console.error("Error summarizing:", err);
    throw new Error(`Error: ${err.message}`);
  }
}

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

function formatSummaryOutput(summary, includeGlossary) {
  // Basic sanitization
  const sanitized = summary
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Format glossary section if it exists
  let formattedSummary = sanitized;
   
  // Try to detect headings (lines ending with a colon that aren't part of a glossary)
  formattedSummary = formattedSummary.replace(/^([^:\n]+):\s*$/gm, '<h2>$1</h2>');

  if (includeGlossary) {
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
  } else {
    // No glossary, just format the main content
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