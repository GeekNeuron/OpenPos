# OpenPos 📊

A modern, multi-language, themed web application to display open positions from an exchange API. Designed for GitHub Pages.

**Live Demo (Example):** `https://GeekNeuron.github.io/OpenPos/` (Once deployed)

## ✨ Features

* **Modern UI:** Card-based layout for displaying positions.
* **Dual Language:**
    * English (Default)
    * Persian (Farsi) with Vazirmatn font and RTL support.
* **Dual Theme:**
    * Light Theme (Default)
    * Dark Theme
* **API Integration:** Fetches and displays data from a configurable API endpoint.
* **Responsive Design:** Adapts to different screen sizes.
* **Professional Structure:** Clear separation of concerns for HTML, CSS, and JavaScript modules (API, UI, i18n, Theme).

## 🛠️ Setup & Configuration

1.  **Clone the repository (Optional):**
    ```bash
    git clone [https://github.com/GeekNeuron/OpenPos.git](https://github.com/GeekNeuron/OpenPos.git)
    cd OpenPos
    ```

2.  **Configure API Endpoint:**
    * Open the `js/app.js` file.
    * **Crucial:** Modify the `API_URL` constant to point to your actual API endpoint that returns open positions.
        ```javascript
        const API_URL = 'YOUR_ACTUAL_API_ENDPOINT_HERE';
        ```
    * If your API requires an API key:
        * Uncomment the `API_KEY` constant and set its value.
        * In `js/api.js`, uncomment the `fetchOpenPositionsWithApiKey` function.
        * In `js/app.js`, change the `fetchOpenPositions(API_URL)` call to `fetchOpenPositionsWithApiKey(API_URL, API_KEY)`.

3.  **API Data Structure:**
    The `js/ui.js` file (`displayPositions` function) expects an array of position objects with a specific structure. Please review the comments in `js/ui.js` and adapt the data mapping if your API returns data in a different format. An example of the expected structure:
    ```json
    [
      {
        "symbol": "BTCUSDT",
        "type": "long", // or "short"
        "entryPrice": 50000,
        "amount": 0.5,
        "baseAsset": "BTC",    // Optional
        "quoteAsset": "USDT",  // Optional
        "leverage": 10,        // Optional
        "pnl": 150.50,         // Optional
        "user": "TraderX",     // Optional
        "timestamp": 1678886400000 // Optional (Unix ms)
      }
    ]
    ```

4.  **Icons:**
    This project uses SVG icons for theme and language toggles. Ensure you have `sun.svg`, `moon.svg`, and `translate.svg` in the `assets/images/` folder or update the paths in `index.html`. You can source these from sites like [Feather Icons](https://feathericons.com/) or [Tabler Icons](https://tabler-icons.io/).

5.  **Local Testing:**
    Open `index.html` in your browser.
    * **CORS Issue Note:** If you are fetching from a live API on a different domain, you might encounter CORS (Cross-Origin Resource Sharing) errors when running `index.html` directly from your local file system (`file:///...`). The API server must be configured to send `Access-Control-Allow-Origin` headers that permit requests from your origin (or `*` for public APIs). For local development, using a simple local server (e.g., VS Code Live Server extension, Python's `http.server`) can help, as it serves files over `http://localhost`.

## 🚀 Deployment to GitHub Pages

1.  Ensure your GitHub repository is named `OpenPos` and your username is `GeekNeuron`.
2.  Push your code to the `main` (or `master`) branch of your GitHub repository.
3.  Go to your repository settings on GitHub (`https://github.com/GeekNeuron/OpenPos/settings`).
4.  Navigate to the "Pages" section from the sidebar.
5.  Under "Build and deployment", select "Deploy from a branch" as the source.
6.  Choose the `main` branch (or your default branch) and the `/ (root)` folder. Click "Save".
7.  GitHub Pages will build and deploy your site. It might take a few minutes. The URL will be shown in the Pages settings (usually `https://GeekNeuron.github.io/OpenPos/`).

## 📁 Project Structure

* `index.html`: Main HTML structure.
* `css/style.css`: Styles for themes, layout, and components.
* `js/`: JavaScript files.
    * `app.js`: Main application logic, API calls.
    * `api.js`: Functions for API communication.
    * `ui.js`: Functions for DOM manipulation and rendering data.
    * `i18n.js`: Internationalization logic (language switching).
    * `theme.js`: Theme switching logic (light/dark).
* `locales/`: JSON files for translations.
    * `en.json`: English strings.
    * `fa.json`: Persian (Farsi) strings.
* `assets/`: Static assets like fonts (if self-hosted) and images.
* `README.md`: This file.
* `.gitignore`: Specifies intentionally untracked files that Git should ignore.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

[MIT](./LICENSE) (Consider adding a LICENSE file if you wish)
