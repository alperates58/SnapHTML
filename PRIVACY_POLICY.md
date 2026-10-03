# Privacy Policy for SnapHTML — Web Cloner & AI Mirror

**Effective Date:** October 3, 2026  
**Last Updated:** October 3, 2026  
**Contact & Repository:** https://github.com/alperates58/SnapHTML

---

## 1. Introduction & Core Philosophy
SnapHTML ("we", "our", or "the extension") is a developer and AI productivity tool designed to freeze and clone web pages and web applications into standalone offline `.html` files and `.zip` website packages.

**We believe that privacy is a fundamental human right.** SnapHTML operates on a strict **Local-First, Zero-Data-Collection** architecture:
- We do **NOT** collect, transmit, store, or sell any personal data, web browsing history, IP addresses, credentials, or session cookies.
- All DOM serialization, CSS bundling, font conversion, and ZIP archiving occur **100% locally** within your browser on your device.

---

## 2. Information Handled by the Extension

### A. Web Page Content (Client-Side Only)
When you actively choose to click "Klonla & İndir" or "Önizleme", SnapHTML reads the DOM elements, style rules, web fonts, and images of the specific web tab you selected:
- This content is processed purely in your browser's memory and temporary IndexedDB storage on your local machine.
- It is **NEVER** transmitted over the internet to any external server, third-party analytics provider, or advertising network.

### B. Extension Settings
User configuration choices (such as whether to inline images, inline fonts, freeze scripts, or selected crawl depth) are stored locally in your browser using the `chrome.storage.local` API. This data never leaves your device.

### C. Temporary Snapshots in IndexedDB
When you use the "Önizleme & Test" (Preview) workspace, the snapshot is saved into your local browser's IndexedDB (`SnapHTML_DB`). Snapshots older than 24 hours are automatically purged by our local cleanup routine.

---

## 3. Chrome Permissions Explanation

In compliance with Google Chrome Web Store policies, here is why each permission is required:

- **`activeTab`**: Allows the extension to interact with the web page in your currently active tab to serialize its DOM and discover internal links when you trigger a clone action.
- **`scripting`**: Injects the local content script into the target page to read computed CSS rules, convert `<canvas>` elements to PNG, and capture interactive form states.
- **`storage`**: Saves your toggle preferences locally on your computer.
- **`unlimitedStorage`**: Permits IndexedDB to store snapshots with large Base64 images without encountering browser storage quota rejections.
- **`downloads`**: Saves the generated `.html` or `.zip` files directly to your default Downloads folder.
- **`clipboardWrite`**: Allows the "Copy AI Prompt" button to copy markdown architecture summaries directly to your operating system clipboard.
- **`<all_urls>` (Host Permissions)**: Required to fetch cross-origin stylesheets (CSS) and font files referenced in web pages so they can be embedded offline, bypassing browser cross-origin restrictions.

---

## 4. Third-Party Services & Analytics
SnapHTML uses **ZERO** third-party trackers, analytics scripts (such as Google Analytics or Mixpanel), remote ads, or external APIs.

---

## 5. Security & Data Protection
Since no data is ever transmitted across external networks, your proprietary code, internal dashboard mockups, and confidential web pages remain strictly on your local machine.

---

## 6. Children's Online Privacy Protection (COPPA)
SnapHTML does not knowingly collect or solicit any personal information from children under the age of 13.

---

## 7. Changes to This Privacy Policy
If we update this Privacy Policy in future versions, the revised policy will be posted with an updated "Last Updated" date.

---

## 8. Contact Us
If you have any questions or feedback regarding this Privacy Policy or SnapHTML's security practices, please submit an issue on our project repository or contact us via email.
