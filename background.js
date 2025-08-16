// Load API key from .env.json
fetch(chrome.runtime.getURL('.env.json'))
  .then(res => res.json())
  .then(config => {
    if (config.GEMINI_API_KEY) {
      chrome.storage.local.set({ GEMINI_API_KEY: config.GEMINI_API_KEY }, () => {
        console.log("✅ API key saved to storage");
      });
    } else {
      console.error("❌ GEMINI_API_KEY missing in .env.json");
    }
    
    // Save user preferences with defaults if available
    const userPrefs = {
      theme: config.DEFAULT_THEME || 'light',
      summaryLength: config.DEFAULT_SUMMARY_LENGTH || 'medium',
      includeGlossary: config.INCLUDE_GLOSSARY !== false,
      defaultLanguage: config.DEFAULT_LANGUAGE || 'en',
      popupSize: config.POPUP_SIZE || 'medium'
    };
    
    chrome.storage.local.set({ userPrefs }, () => {
      console.log("✅ User preferences initialized");
    });
  })
  .catch(err => console.error("❌ Failed to load .env.json", err));

// Initialize saved summaries storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('savedSummaries', (data) => {
    if (!data.savedSummaries) {
      chrome.storage.local.set({ savedSummaries: [] });
    }
  });
});

// Store the last options for area selection
let lastOptions = {
  lang: 'en',
  summaryLength: 'medium',
  summaryStyle: 'standard',
  includeGlossary: true
};

// Track area selection state
let areaSelectionActive = false;

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  // Handle area selection activation from popup
  if (message && message.action === "activateAreaSelector") {
    console.log("Activating area selector");
    
    // Save the current options for later use
    if (message.options) {
      lastOptions = message.options;
      console.log("Saved options for later:", lastOptions);
      chrome.storage.local.set({ lastAreaSelectionOptions: lastOptions });
    }
    
    // Check if area selection is already active
    if (areaSelectionActive) {
      console.log("Area selection already active, ignoring request");
      sendResponse({ success: false, error: "Area selection already active" });
      return true;
    }
    
    areaSelectionActive = true;
    
    // Get active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error("No active tabs found");
        areaSelectionActive = false;
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }
      
      const tabId = tabs[0].id;
      
      // Inject the area selector script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['area-selector.js']
      }, (injectionResults) => {
        if (chrome.runtime.lastError) {
          console.error("Script injection error:", chrome.runtime.lastError);
          areaSelectionActive = false;
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        
        console.log("Area selector script injected", injectionResults);
        
        // Execute the createSelectionTool function
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            console.log("Executing createSelectionTool");
            // This will call the createSelectionTool function from the injected script
            if (typeof createSelectionTool === 'function') {
              createSelectionTool();
            } else {
              console.error("createSelectionTool function not found");
              alert("Error: Selection tool not available. Please try again.");
            }
          }
        }, (execResults) => {
          if (chrome.runtime.lastError) {
            console.error("Function execution error:", chrome.runtime.lastError);
            areaSelectionActive = false;
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          
          console.log("Area selection tool activated", execResults);
          sendResponse({ success: true });
        });
      });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  // Handle area selection results from content script
  if (message && message.action === "areaSelected") {
    console.log("Received selected area text, length:", message.text.length);
    
    // Reset area selection state
    areaSelectionActive = false;
    
    // Store the selected text and metadata temporarily
    chrome.storage.local.set({
      selectedAreaText: message.text,
      selectedAreaMetadata: message.metadata
    }, () => {
      console.log("Stored selected text in storage");
      
      // Open the popup to show the summary
      chrome.action.openPopup()
        .then(() => {
          console.log("Popup opened successfully");
          
          // Notify the popup that it should process the selected text
          setTimeout(() => {
            chrome.runtime.sendMessage({ 
              action: "processSelectedArea",
              options: lastOptions
            });
          }, 500); // Give the popup a moment to initialize
        })
        .catch(err => {
          console.error("Failed to open popup:", err);
          
          // Alternative: Open as a separate page if popup fails
          chrome.tabs.create({
            url: chrome.runtime.getURL('popup/selection.html')
          });
        });
    });
    
    sendResponse({ success: true, message: "Text received and stored" });
    return true;
  }
  
  return true; // Keep message channel open
});