# AI Summarizer Pro - Chrome Extension

## Overview

AI Summarizer Pro is a powerful Chrome extension that uses Google's Gemini AI to generate concise, high-quality summaries of web content. The extension offers customizable summaries with multiple language support, adjustable length and style options, and the ability to save summaries for later reference.

## Features
- **Multi-language Support**: Generate summaries in 14+ languages including English, Hindi, Spanish, French, and more
- **Customizable Summaries**: Adjust summary length (Brief, Medium, Detailed) and style (Standard, Bullet Points, Academic, Simple)
- **Area Selection Tool**: Select specific areas of a webpage to summarize instead of the entire page
- **Glossary Generation**: Automatically create a glossary of key terms with definitions
- **Save & Export**: Save summaries for later reference, copy to clipboard, or open in a dedicated view
- **Dark Mode Support**: Toggle between light and dark themes
- **Responsive Design**: Resize the popup window to your preferred dimensions


## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your Chrome toolbar

## API Key Setup

This extension requires a Google Gemini API key to function:

1. Visit [Google AI Studio](https://ai.google.dev/) to obtain an API key
2. Click the extension icon and go to the Settings tab
3. Enter your API key in the provided field and click "Update"

## Usage

1. Navigate to any webpage you want to summarize
2. Click the AI Summarizer Pro icon in your toolbar
3. Select your preferred language, length, style, and whether to include a glossary
4. Click "Summarize" to generate a summary of the entire page or "Select Area" to choose a specific section
5. View, copy, save, or open the summary in a new tab

## Files Structure

- `manifest.json`: Extension configuration and permissions
- `background.js`: Background service worker script
- `content.js`: Content script for text extraction
- `area-selector.js`: Script for the area selection tool
- `popup/popup.html`: Main popup interface
- `popup/popup.js`: Main functionality for the popup
- `popup/popup.css`: Styling for the popup
- `fullpage.html`: Full page view for summaries
- `fullpage.js`: Script for the full page view
- `fullpage.css`: Styling for the full page view
- `.env.json`: Configuration file for API key and defaults

## Development

### Prerequisites

- Google Chrome browser
- Basic knowledge of HTML, CSS, and JavaScript
- Google Gemini API key

### Testing

1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test the changes by using the extension

## License

This project is for educational purposes only.

## Author

Developed by Dharmendra Dhruw (dkbob3337@gmail.com)
