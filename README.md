# 🏃 Strava Personal Dashboard — PWA

A fully offline-capable personal Strava analytics dashboard. Built with **React + Vite + Recharts**, powered by the **Strava OAuth API**, with all data cached locally in **IndexedDB**. Auto-deploys to **GitHub Pages** via GitHub Actions.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **Strava OAuth** | Secure login, auto token refresh |
| 📦 **IndexedDB Cache** | All activities stored locally — works offline |
| 🔄 **Incremental Sync** | Only fetches new activities after first load |
| 📊 **4 Dashboard Tabs** | Overview · Running · Best Runs · Insights |
| 📱 **Installable PWA** | Add to home screen on iOS/Android |
| 🚀 **GitHub Pages** | Auto-deploy via GitHub Actions on every push |

---

## 🚀 Deploy to GitHub Pages (5 steps)

### 1. Create a Strava API App
1. Go to https://www.strava.com/settings/api
2. Create an app — set **"Authorization Callback Domain"** to `yourusername.github.io`
3. Note your **Client ID** and **Client Secret**

### 2. Push to GitHub
```bash
git init && git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOURUSERNAME/strava-pwa.git
git push -u origin main
```

### 3. Add GitHub Secrets
Repo → Settings → Secrets and variables → Actions → add:
- `VITE_STRAVA_CLIENT_ID`
- `VITE_STRAVA_CLIENT_SECRET`

### 4. Enable GitHub Pages
Repo → Settings → Pages → Source: **GitHub Actions**

### 5. Update base path in vite.config.js
```js
base: '/YOUR-REPO-NAME/',
```

Push to main → auto-deploys to `https://YOURUSERNAME.github.io/strava-pwa/` ✅

---

## 💻 Local Development

```bash
npm install
cp .env.example .env.local   # fill in your Strava credentials
npm run dev
```

> Add `localhost` to your Strava app's Callback Domain for local OAuth.

---

## 📁 Project Structure

```
strava-pwa/
├── src/
│   ├── App.jsx          # Dashboard UI — 4 tabs
│   ├── strava.js        # OAuth + Strava API calls
│   ├── db.js            # IndexedDB cache + analytics helpers
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── .github/workflows/
│   └── deploy.yml       # Auto-deploy to GitHub Pages
├── .env.example         # Env variable template
├── vite.config.js       # Vite + PWA config
└── index.html
```

---

## 🔄 Sync Flow

```
First visit → OAuth → Fetch ALL activities → IndexedDB
Next visits → Load cache instantly → Background sync (new only)
Offline     → Full dashboard from IndexedDB cache
```

---

## 🔮 Planned Enhancements
- GitHub-style heatmap calendar
- Heart rate zone breakdown
- Claude AI chat (ask questions about your data)
- Shareable stat cards (PNG export)
- Race time predictor
- Push notifications for streaks

MIT License
