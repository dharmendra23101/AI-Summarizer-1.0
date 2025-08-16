// Log when content script is injected
console.log("✅ MultiLangSummarizer content script loaded on", window.location.href);

// Get main content text from the page with improved content extraction
function getPageText() {
  try {
    // Try to extract text from article or main content first
    const contentSelectors = [
      'article', 
      'main', 
      '.content', 
      '.article', 
      '.post', 
      '#content', 
      '#main'
    ];
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.trim().length > 500) {
        return element.innerText;
      }
    }
    
    // Get text from body but exclude navigation, footer, and sidebar elements
    const excludeSelectors = [
      'nav', 
      'header', 
      'footer', 
      '.nav', 
      '.sidebar', 
      '.menu', 
      '.footer', 
      '.comments',
      '.advertisement',
      'script',
      'style'
    ];
    
    // Get all elements to exclude
    const excludeElements = document.querySelectorAll(excludeSelectors.join(','));
    
    // Get full body text
    let bodyText = document.body ? document.body.innerText : "";
    
    // Try to remove text from excluded elements
    excludeElements.forEach(el => {
      if (el && el.innerText) {
        const textToRemove = el.innerText;
        bodyText = bodyText.replace(textToRemove, '');
      }
    });
    
    return bodyText;
  } catch (error) {
    console.error("Error extracting page text:", error);
    // Fallback to basic body text if there's an error
    return document.body ? document.body.innerText : "";
  }
}

// Get page metadata
function getPageMetadata() {
  return {
    title: document.title || "",
    url: window.location.href,
    description: document.querySelector('meta[name="description"]')?.content || "",
    language: document.documentElement.lang || "en"
  };
}

// Listen for messages from popup and respond immediately
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  
  if (request && request.action === "getText") {
    try {
      const text = getPageText();
      const metadata = getPageMetadata();
      
      console.log("Sending response from content script with text length:", text.length);
      sendResponse({ 
        text: text,
        metadata: metadata
      });
    } catch (error) {
      console.error("Error in content script:", error);
      sendResponse({ 
        text: "Error extracting text: " + error.message,
        metadata: getPageMetadata()
      });
    }
    return true; // Keep the message channel open for async response
  }
  
  return true; // Keep the message channel open for other possible async operations
});

// Notify that the content script is ready
console.log("✅ MultiLangSummarizer content script ready"); 