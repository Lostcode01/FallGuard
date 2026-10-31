# FallGuard website

A responsive, browser-based demonstration dashboard for the FallGuard fall-detection prototype.

## Included features

- Dashboard and demonstration status
- User profile and demonstration emergency contact forms
- Browser GPS using the phone's location services
- OpenStreetMap display
- Simulated fall detection with a 15-second cancellation countdown
- SOS demonstration and optional `tel:` dialer handoff
- Event history saved in browser local storage
- Browser audio previews for different system states
- Responsive layout for desktop and Android phone browsers

## Run locally

1. Extract the ZIP file.
2. Open the `FallGuard` folder in VS Code.
3. Install the VS Code extension **Live Server**, if you do not already have it.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Open the local address shown by Live Server.

GPS permissions work on HTTPS websites and on localhost. They generally do not work when opening the HTML file directly with `file://`.

## Publish with GitHub Pages

1. Sign in to GitHub and create a new **public** repository named `fallguard`.
2. Upload `index.html`, `style.css`, `app.js`, and this README to the repository's root.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site. The URL will look like:
   `https://YOUR-USERNAME.github.io/fallguard/`

Open the HTTPS URL on your Android phone and allow location access when prompted.

## Important limitations

- This is a website-only demonstration. It does not yet connect to the ESP32, MPU6050, or physical buzzer.
- Fall detection and SOS activation are simulated from the website.
- The website can request GPS permission while it is open.
- A website can open the Android dialer with a `tel:` link, but the user must confirm any call. This project must use non-emergency demonstration numbers only.
- Browser local storage is local to the browser/device. It is not a secure cloud database and does not synchronize automatically between devices.
- Do not enter real medical records or rely on this prototype for real emergency response.
- The map uses OpenStreetMap tiles and Leaflet from public CDNs, so those map assets require an internet connection.
