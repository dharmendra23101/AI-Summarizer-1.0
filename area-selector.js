// Area selection tool for AI Summarizer
console.log("Area selector script loaded");

function createSelectionTool() {
  console.log("Creating area selection tool");
  
  // Remove any existing selection tool elements
  const existingElements = document.querySelectorAll(
    '#ai-summarizer-overlay, #ai-summarizer-tooltip, #ai-summarizer-close, #ai-summarizer-selection'
  );
  
  existingElements.forEach(el => {
    if (el) el.remove();
  });
  
  // Create an overlay over the entire page
  const overlay = document.createElement('div');
  overlay.id = 'ai-summarizer-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    z-index: 2147483645;
    cursor: crosshair;
  `;
  
  // Create a tooltip to instruct the user
  const tooltip = document.createElement('div');
  tooltip.id = 'ai-summarizer-tooltip';
  tooltip.textContent = 'Click and drag to select an area to summarize';
  tooltip.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #4285f4;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 2147483646;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  // Add a close button to cancel selection
  const closeButton = document.createElement('div');
  closeButton.id = 'ai-summarizer-close';
  closeButton.textContent = '✕';
  closeButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 30px;
    height: 30px;
    background: #4285f4;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 16px;
    z-index: 2147483646;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  // Selection rectangle
  const selection = document.createElement('div');
  selection.id = 'ai-summarizer-selection';
  selection.style.cssText = `
    position: absolute;
    border: 2px dashed #4285f4;
    background: rgba(66, 133, 244, 0.1);
    display: none;
    z-index: 2147483646;
    pointer-events: none;
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(tooltip);
  document.body.appendChild(closeButton);
  document.body.appendChild(selection);
  
  // Close button event
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
  });
  
  // Handle escape key to cancel
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  
  document.addEventListener('keydown', escHandler);
  
  // Implement the mouse events for drawing the selection rectangle
  let isSelecting = false;
  let startX, startY;
  
  overlay.addEventListener('mousedown', (e) => {
    console.log("Mouse down detected at", e.clientX, e.clientY);
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Set initial position of the selection rectangle
    selection.style.left = `${startX}px`;
    selection.style.top = `${startY}px`;
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';
    
    e.preventDefault(); // Prevent text selection
  });
  
  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    // Calculate dimensions and position
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    
    // Update selection rectangle
    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
    
    e.preventDefault(); // Prevent text selection
  });
  
  // Use window for mouseup to ensure we catch the event even if the mouse moves outside the overlay
  window.addEventListener('mouseup', handleMouseUp);
  
  function handleMouseUp(e) {
    if (!isSelecting) return;
    
    console.log("Mouse up detected - finishing selection");
    isSelecting = false;
    
    // Get the final rectangle dimensions
    const rect = selection.getBoundingClientRect();
    
    // Only process if the selection has a meaningful size
    if (rect.width > 10 && rect.height > 10) {
      // Extract text from the selected area
      const selectedText = getTextFromArea(rect);
      
      if (selectedText && selectedText.trim().length > 0) {
        console.log("Selected text length:", selectedText.length);
        
        // Send the selected text back to the extension
        chrome.runtime.sendMessage({
          action: "areaSelected", 
          text: selectedText,
          metadata: {
            title: document.title,
            url: window.location.href,
            selectionArea: "Custom area selection"
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError);
            alert("Error sending selected text. Please try again.");
          } else {
            console.log("Message sent successfully", response);
          }
        });
      } else {
        alert("No text was found in the selected area. Please try selecting a different area.");
      }
    } else {
      console.log("Selection too small, ignoring");
    }
    
    // Clean up
    cleanup();
    
    e.preventDefault(); // Prevent default behavior
  }
  
  function cleanup() {
    console.log("Cleaning up selection tool");
    
    // Remove event listeners
    window.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', escHandler);
    
    // Remove elements
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    if (closeButton.parentNode) closeButton.parentNode.removeChild(closeButton);
    if (selection.parentNode) selection.parentNode.removeChild(selection);
  }
}

// Function to extract text from elements within the selected area
function getTextFromArea(rect) {
  console.log("Getting text from area:", rect);
  
  // Find all text elements
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, li, td, th, label, caption');
  let selectedText = '';
  let elementCount = 0;
  
  textElements.forEach(el => {
    // Skip invisible elements or those with no content
    if (isElementVisible(el) && el.innerText.trim().length > 0) {
      const elRect = el.getBoundingClientRect();
      
      // Check if the element overlaps with the selection
      if (isOverlapping(rect, elRect)) {
        // Calculate how much of the element is within the selection
        const overlap = getOverlapPercentage(rect, elRect);
        
        // If at least 30% of the element is within the selection, include its text
        if (overlap > 0.3) {
          const text = el.innerText.trim();
          if (text && !isTextAlreadyIncluded(selectedText, text)) {
            selectedText += text + '\n\n';
            elementCount++;
          }
        }
      }
    }
  });
  
  console.log(`Selected text extracted from ${elementCount} elements, total length:`, selectedText.length);
  return selectedText.trim();
}

// Check if an element is visible
function isElementVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetWidth > 0 && 
         el.offsetHeight > 0;
}

// Check if text is already included (to avoid duplicates)
function isTextAlreadyIncluded(existingText, newText) {
  return existingText.includes(newText);
}

// Check if two rectangles overlap
function isOverlapping(rect1, rect2) {
  return !(
    rect1.right < rect2.left || 
    rect1.left > rect2.right || 
    rect1.bottom < rect2.top || 
    rect1.top > rect2.bottom
  );
}

// Calculate what percentage of rect2 is contained within rect1
function getOverlapPercentage(rect1, rect2) {
  // Calculate intersection area
  const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
  const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
  const overlapArea = xOverlap * yOverlap;
  
  // Calculate the area of rect2
  const rect2Area = rect2.width * rect2.height;
  
  // Return 0 if rect2 has no area to avoid division by zero
  if (rect2Area === 0) return 0;
  
  // Return the percentage of rect2 that is overlapped
  return overlapArea / rect2Area;
}

// Make the function available globally
window.createSelectionTool = createSelectionTool;

// Auto-execute when loaded directly (for testing)
if (typeof chrome === 'object' && chrome.runtime && chrome.runtime.onMessage) {
  console.log("Area selector script ready");
} else {
  console.warn("Chrome runtime not available, this might be running in a test environment");
}