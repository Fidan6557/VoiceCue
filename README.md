# VoiceCue (Neurobridge Core)

> **B2B In-Game Contextual Ad Recommendation Platform for Open-World Games**

VoiceCue is a privacy-first, on-device contextual advertising platform designed for open-world games (demonstrated with a 3D Minecraft sandbox). Players opt-in to voice recommendations, speech is processed entirely on the client into coarse interest tags (raw audio never touches servers), and dynamic sponsored paintings/billboards update in the game world via real-time second-price auctions.

---

## 🚀 Key Features

- **🎮 3D Minecraft Open World Sandbox**: Interactive WebGL/Three.js 3D world with walkable environments, dynamic painting slots, and proximity interactions.
- **🎙️ Privacy-First On-Device Speech NLP**: Client-side speech recognition with instant raw transcript purging into coarse intent categories (`food.pizza`, `gaming.gear`, `beverages.energy`, `clothing.footwear`).
- **🛡️ Privacy Gateway**: Enforces strict opt-in consent, 10-minute TTL per anonymous session, and zero PII storage.
- **⚡ Second-Price Auction Engine**: Vickrey auction matching verified advertiser campaigns with server inventory, ensuring revenue split (70% game studio / 30% platform).
- **💼 B2B Partner Portal**: Campaign builder with custom bidding, slot aspect ratio verification, and live Minecraft banner preview.
- **🏰 B2B Studio Console**: Inventory management, COPPA/brand safety category filtering, and Layer 3 human moderation review.
- **📡 Real-Time Telemetry & Inspector**: Visual flow pipeline and live event monitoring.

---

## 🛠️ Tech Stack

- **Frontend**: Vite, Vanilla JavaScript, Three.js, CSS3
- **Backend API**: Node.js, Express, In-memory DB with TTL & Vickrey Auction
- **ML / Edge Classifier**: Python (Regex & Multi-modal heuristic brand safety)
- **Containerization**: Docker, Docker Compose

---

## 🏃 Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### 1. Start Backend API
```bash
cd backend
npm install
node src/server.js
```
The backend API runs at `http://localhost:4000`.

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## ☁️ Deploy to Render

VoiceCue is pre-configured for one-click deployment on [Render](https://render.com):

1. Link this repository in Render Dashboard (**New +** -> **Web Service** or **Blueprints**).
2. Render will automatically read `render.yaml` or use:
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Click **Deploy**. The platform, 3D Minecraft world, and B2B consoles will be live on your `.onrender.com` domain.

---

## 📜 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Detailed data flow, component breakdown, and privacy guarantees.
- [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — Marketplace economics, unit metrics, and platform take-rate.
- [PITCH_DECK.md](./PITCH_DECK.md) — 10-slide pitch deck presentation.
