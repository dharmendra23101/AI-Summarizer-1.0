// Global variables
let apiKey = null;
let currentSummary = null;
let userPrefs = {
  theme: 'light',
  summaryLength: 'medium',
  includeGlossary: true,
  defaultLanguage: 'en',
  popupSize: 'medium'
};

// Initialize extension
document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  setupEventListeners();
  setupTabNavigation();
  populateLanguageDropdowns();
  initPopupSize();
  setupResizeHandlers();
  
  // Check if there's selected area text to process
  chrome.storage.local.get(['selectedAreaText', 'selectedAreaMetadata', 'lastAreaSelectionOptions'], (data) => {
    if (data.selectedAreaText && data.selectedAreaText.length > 0) {
      console.log("Found selected area text, processing...");
      
      // Get options (either from saved options or use defaults)
      const options = data.lastAreaSelectionOptions || {
        lang: document.getElementById('lang').value,
        summaryLength: document.getElementById('summaryLength').value,
        summaryStyle: document.getElementById('summaryStyle').value,
        includeGlossary: document.getElementById('includeGlossary').checked
      };
      
      // Process the selected text
      processSummary(
        data.selectedAreaText,
        data.selectedAreaMetadata,
        options.lang,
        options.summaryLength,
        options.summaryStyle,
        options.includeGlossary
      );
      
      // Clear the stored text to avoid reprocessing
      chrome.storage.local.remove(['selectedAreaText', 'selectedAreaMetadata']);
    }
  });
  
  // Listen for message to process selected area
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "processSelectedArea") {
      console.log("Received request to process selected area");
      
      chrome.storage.local.get(['selectedAreaText', 'selectedAreaMetadata'], (data) => {
        if (data.selectedAreaText && data.selectedAreaText.length > 0) {
          console.log("Processing selected area text from message");
          
          // Use options from the message or defaults
          const options = message.options || {
            lang: document.getElementById('lang').value,
            summaryLength: document.getElementById('summaryLength').value,
            summaryStyle: document.getElementById('summaryStyle').value,
            includeGlossary: document.getElementById('includeGlossary').checked
          };
          
          // Process the selected text
          processSummary(
            data.selectedAreaText,
            data.selectedAreaMetadata,
            options.lang,
            options.summaryLength,
            options.summaryStyle,
            options.includeGlossary
          );
          
          // Clear the stored text to avoid reprocessing
          chrome.storage.local.remove(['selectedAreaText', 'selectedAreaMetadata']);
        } else {
          console.warn("No selected area text found in storage");
        }
      });
      
      return true; // Keep the message channel open
    }
    
    // Listen for area selection messages
    if (message.action === "areaSelected") {
      // Process the selected text
      processSummary(
        message.text,
        message.metadata,
        document.getElementById('lang').value,
        document.getElementById('summaryLength').value,
        document.getElementById('summaryStyle').value,
        document.getElementById('includeGlossary').checked
      );
    }
  });
});

// Load user preferences and API key
function loadPreferences() {
  chrome.storage.local.get(['GEMINI_API_KEY', 'userPrefs'], (data) => {
    apiKey = data.GEMINI_API_KEY || null;

    // Update API key status indicator
    updateApiKeyStatus();

    // Load user preferences
    if (data.userPrefs) {
      userPrefs = data.userPrefs;

      // Apply theme
      if (userPrefs.theme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
      }

      // Set default values
      document.getElementById('lang').value = userPrefs.defaultLanguage || 'en';
      document.getElementById('summaryLength').value = userPrefs.summaryLength || 'medium';
      document.getElementById('includeGlossary').checked = userPrefs.includeGlossary !== false;

      // Update settings form
      document.getElementById('defaultLang').value = userPrefs.defaultLanguage || 'en';
      document.getElementById('defaultLength').value = userPrefs.summaryLength || 'medium';
      document.getElementById('defaultGlossary').checked = userPrefs.includeGlossary !== false;

      if (document.getElementById('defaultSize')) {
        document.getElementById('defaultSize').value = userPrefs.popupSize || 'medium';
      }
    }

    // Load saved summaries in the saved tab
    loadSavedSummaries();
  });
}

// Initialize popup size from preferences
function initPopupSize() {
  chrome.storage.local.get('userPrefs', (data) => {
    if (data.userPrefs) {
      // Apply size class
      if (data.userPrefs.popupSize) {
        const size = data.userPrefs.popupSize;
        document.body.classList.add(`size-${size}`);
        
        if (document.getElementById('defaultSize')) {
          document.getElementById('defaultSize').value = size;
        }
      }
      
      // Apply custom dimensions if available
      if (data.userPrefs.customHeight) {
        document.body.style.height = `${data.userPrefs.customHeight}px`;
      }
      
      if (data.userPrefs.customWidth) {
        document.body.style.width = `${data.userPrefs.customWidth}px`;
      }
    }
  });
}

// Setup resize functionality
function setupResizeHandlers() {
  const resizeHandle = document.getElementById('resizeHandle');
  if (!resizeHandle) {
    console.error('Resize handle not found');
    return;
  }
  
  // Create a corner resize element
  const resizeCorner = document.createElement('div');
  resizeCorner.className = 'resize-corner';
  document.body.appendChild(resizeCorner);
  
  let startY, startX, startHeight, startWidth;
  
  // Vertical resize (bottom edge)
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startHeight = window.innerHeight;
    
    document.addEventListener('mousemove', resizeVertical);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'ns-resize';
  });
  
  // Corner resize (bottom-right corner)
  resizeCorner.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startX = e.clientX;
    startHeight = window.innerHeight;
    startWidth = window.innerWidth;
    
    document.addEventListener('mousemove', resizeBoth);
    document.addEventListener('mouseup', stopResize);
    document.body.style.cursor = 'nwse-resize';
  });
  
  function resizeVertical(e) {
    const deltaY = e.clientY - startY;
    const newHeight = startHeight + deltaY;
    
    // Apply constraints
    const minHeight = 400;
    const maxHeight = 650;
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      document.body.style.height = `${newHeight}px`;
      
      // Store the height in local storage for persistence
      chrome.storage.local.get('userPrefs', (data) => {
        const userPrefs = data.userPrefs || {};
        userPrefs.customHeight = newHeight;
        chrome.storage.local.set({ userPrefs });
      });
    }
  }
  
  function resizeBoth(e) {
    const deltaY = e.clientY - startY;
    const deltaX = e.clientX - startX;
    const newHeight = startHeight + deltaY;
    const newWidth = startWidth + deltaX;
    
    // Apply constraints
    const minHeight = 400;
    const maxHeight = 650;
    const minWidth = 300;
    const maxWidth = 600;
    
    if (newHeight >= minHeight && newHeight <= maxHeight) {
      document.body.style.height = `${newHeight}px`;
    }
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      document.body.style.width = `${newWidth}px`;
      
      // Store the dimensions in local storage
      chrome.storage.local.get('userPrefs', (data) => {
        const userPrefs = data.userPrefs || {};
        userPrefs.customHeight = newHeight;
        userPrefs.customWidth = newWidth;
        chrome.storage.local.set({ userPrefs });
      });
    }
  }
  
  function stopResize() {
    document.removeEventListener('mousemove', resizeVertical);
    document.removeEventListener('mousemove', resizeBoth);
    document.removeEventListener('mouseup', stopResize);
    document.body.style.cursor = '';
  }
  
  // Expand button for quick size adjustments
  const expandBtn = document.getElementById('expandBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      if (document.body.classList.contains('size-small')) {
        // Small → Medium
        document.body.classList.remove('size-small');
        document.body.classList.add('size-medium');
        updatePopupSizePreference('medium');
      } else if (document.body.classList.contains('size-medium')) {
        // Medium → Large
        document.body.classList.remove('size-medium');
        document.body.classList.add('size-large');
        updatePopupSizePreference('large');
      } else if (document.body.classList.contains('size-large')) {
        // Large → Small
        document.body.classList.remove('size-large');
        document.body.classList.add('size-small');
        updatePopupSizePreference('small');
      } else {
        // Default → Medium
        document.body.classList.add('size-medium');
        updatePopupSizePreference('medium');
      }
    });
  }
}

// Update popup size preference
function updatePopupSizePreference(size) {
  chrome.storage.local.get('userPrefs', (data) => {
    const userPrefs = data.userPrefs || {};
    userPrefs.popupSize = size;
    chrome.storage.local.set({ userPrefs });
  });
}

// Setup all event listeners
function setupEventListeners() {
  // Summarize button
  document.getElementById('summarizeBtn').addEventListener('click', generateSummary);
  
  // Select area button
  document.getElementById('selectAreaBtn').addEventListener('click', () => {
    console.log("Select Area button clicked");
    
    // Save current options for use after selection
    const options = {
      lang: document.getElementById('lang').value,
      summaryLength: document.getElementById('summaryLength').value,
      summaryStyle: document.getElementById('summaryStyle').value,
      includeGlossary: document.getElementById('includeGlossary').checked
    };
    
    // Send message to activate area selector
    chrome.runtime.sendMessage({ 
      action: "activateAreaSelector",
      options: options
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
      } else if (response && response.success) {
        console.log("Area selector activated successfully");
        window.close(); // Close the popup
      } else {
        console.error("Failed to activate area selector:", response?.error || "Unknown error");
      }
    });
  });

  // Copy button
  document.getElementById('copyBtn').addEventListener('click', () => {
    const output = document.getElementById('output');
    navigator.clipboard.writeText(output.innerText)
      .then(() => {
        showNotification('Summary copied to clipboard!', 'success');
      })
      .catch(err => {
        showNotification('Failed to copy text: ' + err, 'error');
      });
  });

  // Save button
  document.getElementById('saveBtn').addEventListener('click', saveSummary);

  // Open in new tab button
  const openTabBtn = document.getElementById('openTabBtn');
  if (openTabBtn) {
    openTabBtn.addEventListener('click', openSummaryInNewTab);
  }

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Settings save
  document.getElementById('saveSettings').addEventListener('click', saveSettings);

  // API key update
  document.getElementById('updateApiKey').addEventListener('click', updateApiKey);
}

// Open summary in new tab
function openSummaryInNewTab() {
  if (!currentSummary) {
    showNotification('No summary to display', 'error');
    return;
  }

  // Save current summary to storage if it doesn't have an ID
  if (!currentSummary.id) {
    currentSummary.id = Date.now().toString();

    chrome.storage.local.get('savedSummaries', (data) => {
      const savedSummaries = data.savedSummaries || [];

      // Check if it's already saved
      if (!savedSummaries.some(s => s.url === currentSummary.url && s.content === currentSummary.content)) {
        // Add the current summary to the list
        savedSummaries.unshift(currentSummary);

        // Keep only the latest 50 summaries
        const trimmedSummaries = savedSummaries.slice(0, 50);

        chrome.storage.local.set({ savedSummaries: trimmedSummaries });
      }
    });
  }

  // Open the summary in a new tab - use root path for fullpage.html
  chrome.tabs.create({
    url: chrome.runtime.getURL('fullpage.html?id=' + currentSummary.id)
  });
}

// Setup tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Update active states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load saved summaries when switching to saved tab
      if (tabName === 'saved') {
        loadSavedSummaries();
      }
    });
  });
}

// Populate language dropdowns
function populateLanguageDropdowns() {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' },
    { code: 'nl', name: 'Dutch' },
    { code: 'ko', name: 'Korean' },
    { code: 'tr', name: 'Turkish' }
  ];

  // Clone the main language dropdown to settings
  const defaultLangDropdown = document.getElementById('defaultLang');

  // Clear and populate the settings language dropdown
  defaultLangDropdown.innerHTML = '';
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    defaultLangDropdown.appendChild(option);
  });
}

// Toggle theme between light and dark
function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');

  if (document.body.classList.contains('dark-theme')) {
    document.body.classList.remove('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    userPrefs.theme = 'light';
  } else {
    document.body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    userPrefs.theme = 'dark';
  }

  // Save the theme preference
  chrome.storage.local.set({ userPrefs });
}

// Update API key status indicator
function updateApiKeyStatus() {
  const apiStatus = document.getElementById('apiStatus');

  if (apiKey) {
    apiStatus.textContent = '✓ API key is configured';
    apiStatus.className = 'api-status success';
    document.getElementById('apiKey').value = '••••••••••••••••••••••••••';
  } else {
    apiStatus.textContent = '✗ API key is missing';
    apiStatus.className = 'api-status error';
    document.getElementById('apiKey').value = '';
  }
}

// Update API key
function updateApiKey() {
  const newApiKey = document.getElementById('apiKey').value;

  if (!newApiKey || newApiKey === '••••••••••••••••••••••••••') {
    showNotification('Please enter a valid API key', 'error');
    return;
  }

  chrome.storage.local.set({ GEMINI_API_KEY: newApiKey }, () => {
    apiKey = newApiKey;
    updateApiKeyStatus();
    showNotification('API key updated successfully!', 'success');
  });
}

// Save user settings
function saveSettings() {
  userPrefs = {
    theme: userPrefs.theme, // Keep current theme
    defaultLanguage: document.getElementById('defaultLang').value,
    summaryLength: document.getElementById('defaultLength').value,
    includeGlossary: document.getElementById('defaultGlossary').checked,
    popupSize: document.getElementById('defaultSize').value, // Add this
    customHeight: userPrefs.customHeight, // Preserve custom dimensions
    customWidth: userPrefs.customWidth
  };

  // Apply size immediately
  document.body.className = document.body.className.replace(/size-\w+/g, '');
  document.body.classList.add(`size-${userPrefs.popupSize}`);

  chrome.storage.local.set({ userPrefs }, () => {
    showNotification('Settings saved successfully!', 'success');
  });
}

// Generate summary
async function generateSummary() {
  if (!apiKey) {
    showNotification('API key is required. Please add it in the Settings tab.', 'error');
    document.querySelector('.nav-btn[data-tab="settings"]').click();
    return;
  }

  // Show loader and clear previous output
  document.getElementById('loader').style.display = 'flex';
  document.getElementById('output').innerHTML = '';
  document.getElementById('copyBtn').disabled = true;
  document.getElementById('saveBtn').disabled = true;
  document.getElementById('openTabBtn').disabled = true;

  // Get selected options
  const lang = document.getElementById('lang').value;
  const summaryLength = document.getElementById('summaryLength').value;
  const summaryStyle = document.getElementById('summaryStyle').value;
  const includeGlossary = document.getElementById('includeGlossary').checked;

  // Get text from active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tabs.length) {
      throw new Error('No active tab found');
    }

    // First, try to inject and execute the content script manually
    try {
      // Use executeScript to get the page content directly if the content script isn't responding
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => {
          const getText = () => {
            try {
              // Try to extract text from article or main content first
              const contentSelectors = ['article', 'main', '.content', '.article', '.post', '#content', '#main'];

              for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element && element.innerText.trim().length > 500) {
                  return element.innerText;
                }
              }

              // Get text from body as fallback
              return document.body ? document.body.innerText : "";
            } catch (error) {
              // Final fallback
              return document.body ? document.body.innerText : "";
            }
          };

          const getMetadata = () => {
            return {
              title: document.title || "",
              url: window.location.href,
              description: document.querySelector('meta[name="description"]')?.content || "",
              language: document.documentElement.lang || "en"
            };
          };

          return {
            text: getText(),
            metadata: getMetadata()
          };
        }
      }, async (results) => {
        if (!results || !results[0] || !results[0].result) {
          handleError('Failed to extract text from this page.');
          return;
        }

        const response = results[0].result;

        if (!response.text || response.text.trim().length < 100) {
          handleError('Not enough text found on this page to summarize.');
          return;
        }

        processSummary(response.text, response.metadata, lang, summaryLength, summaryStyle, includeGlossary);
      });
    } catch (executeError) {
      // Fallback to the regular content script method
      console.log("Execution script failed, falling back to content script:", executeError);

      chrome.tabs.sendMessage(tabs[0].id, { action: "getText" }, async (response) => {
        if (!response) {
          handleError('Failed to get text from page. The page might be restricted or is still loading.');
          return;
        }

        if (!response.text || response.text.trim().length < 100) {
          handleError('Not enough text found on this page to summarize.');
          return;
        }

        // Create metadata if it doesn't exist in the response
        const metadata = response.metadata || {
          title: tabs[0].title || 'Unknown Page',
          url: tabs[0].url || ''
        };

        processSummary(response.text, metadata, lang, summaryLength, summaryStyle, includeGlossary);
      });
    }
  } catch (error) {
    handleError(error.message);
  }
}

// Helper function to process summary after getting text
async function processSummary(text, metadata, lang, summaryLength, summaryStyle, includeGlossary) {
  try {
    // Show loader
    document.getElementById('loader').style.display = 'flex';
    document.getElementById('output').innerHTML = '';
    
    const summary = await summarizeText(
      text,
      lang,
      summaryLength,
      summaryStyle,
      includeGlossary,
      metadata
    );

    // Save current summary data for later use
    currentSummary = {
      content: summary,
      url: metadata.url,
      title: metadata.title,
      language: lang,
      timestamp: new Date().toISOString()
    };

    // Display the formatted summary
    const formattedSummary = formatSummaryOutput(summary, includeGlossary);
    document.getElementById('output').innerHTML = formattedSummary;

    // Enable copy and save buttons
    document.getElementById('copyBtn').disabled = false;
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('openTabBtn').disabled = false;
  } catch (error) {
    handleError(error.message);
  }

  // Hide loader
  document.getElementById('loader').style.display = 'none';
}

// Summarize text using Gemini API
async function summarizeText(text, targetLang, length, style, includeGlossary, metadata, retries = 3, model = "gemini-1.5-flash-latest") {
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
      return summarizeText(text, targetLang, length, style, includeGlossary, metadata, retries - 1, model);
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

// Format summary output with HTML
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

// Get full language name from code
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

// Save current summary
function saveSummary() {
  if (!currentSummary) {
    showNotification('No summary to save', 'error');
    return;
  }

  chrome.storage.local.get('savedSummaries', (data) => {
    const savedSummaries = data.savedSummaries || [];

    // Add the current summary to the list
    savedSummaries.unshift({
      ...currentSummary,
      id: Date.now().toString()
    });

    // Keep only the latest 50 summaries
    const trimmedSummaries = savedSummaries.slice(0, 50);

    chrome.storage.local.set({ savedSummaries: trimmedSummaries }, () => {
      showNotification('Summary saved successfully!', 'success');
    });
  });
}

// Load saved summaries
function loadSavedSummaries() {
  const savedSummariesContainer = document.getElementById('savedSummaries');

  chrome.storage.local.get('savedSummaries', (data) => {
    const savedSummaries = data.savedSummaries || [];

    if (savedSummaries.length === 0) {
      savedSummariesContainer.innerHTML = '<p class="empty-msg">No saved summaries yet</p>';
      return;
    }

    savedSummariesContainer.innerHTML = '';

    savedSummaries.forEach(summary => {
      const date = new Date(summary.timestamp);
      const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

      const summaryElement = document.createElement('div');
      summaryElement.className = 'saved-item';
      summaryElement.innerHTML = `
        <div class="saved-header">
          <div class="saved-title">${summary.title || 'Untitled'}</div>
          <div class="saved-actions">
            <button class="view-btn" data-id="${summary.id}" title="View"><i class="fas fa-eye"></i></button>
            <button class="open-tab-btn" data-id="${summary.id}" title="Open in new tab"><i class="fas fa-external-link-alt"></i></button>
            <button class="delete-btn" data-id="${summary.id}" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="saved-meta">
          <span>${getLanguageName(summary.language)}</span>
          <span>${formattedDate}</span>
        </div>
        <div class="saved-content">
          ${summary.content.substring(0, 150).replace(/</g, '&lt;').replace(/>/g, '&gt;')}...
        </div>
      `;

      savedSummariesContainer.appendChild(summaryElement);
    });

    // Add event listeners for view and delete buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => viewSavedSummary(btn.getAttribute('data-id')));
    });

    document.querySelectorAll('.open-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const summaryId = btn.getAttribute('data-id');
        chrome.tabs.create({
          url: chrome.runtime.getURL('fullpage.html?id=' + summaryId)
        });
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteSavedSummary(btn.getAttribute('data-id')));
    });
  });
}

// View a saved summary
function viewSavedSummary(id) {
  chrome.storage.local.get('savedSummaries', (data) => {
    const savedSummaries = data.savedSummaries || [];
    const summary = savedSummaries.find(s => s.id === id);

    if (summary) {
      // Switch to summary tab
      document.querySelector('.nav-btn[data-tab="summary"]').click();

      // Display the summary
      const formattedSummary = formatSummaryOutput(summary.content, true);
      document.getElementById('output').innerHTML = formattedSummary;

      // Enable buttons
      document.getElementById('copyBtn').disabled = false;
      document.getElementById('saveBtn').disabled = true; // Already saved
      document.getElementById('openTabBtn').disabled = false;

      // Set current summary
      currentSummary = summary;
    }
  });
}

// Delete a saved summary
function deleteSavedSummary(id) {
  chrome.storage.local.get('savedSummaries', (data) => {
    const savedSummaries = data.savedSummaries || [];

    const updatedSummaries = savedSummaries.filter(s => s.id !== id);

    chrome.storage.local.set({ savedSummaries: updatedSummaries }, () => {
      loadSavedSummaries();
      showNotification('Summary deleted', 'success');
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