# 🎯 Arrows — Telegram Bot & Mini App (TMA)

Yeh project aapke **Arrows Logic Maze Puzzle Game** ko ek complete **Telegram Mini App Bot** me badalta hai. Players Telegram app ke andar hi bina kisi install ke game khel sakte hain, smooth haptics aur sound ke saath!

---

## 📂 Project Structure

```text
arrows-telegram-bot/
├── webapp/
│   └── index.html      # Game UI + Telegram WebApp SDK + Haptics + Sound
├── bot.py              # Telegram Bot backend (python-telegram-bot)
├── server.py           # Local web server for testing (port 8080)
├── config.py           # Configuration loader (.env reader)
├── requirements.txt    # Python dependencies
├── .env                # Bot Token aur WebApp URL config
└── README.md           # Guide
```

---

## 🚀 Setup Guide (Step-by-Step)

### Step 1: Telegram Bot Token Create Karein (@BotFather)

1. Telegram app kholein aur search karein: **`@BotFather`**
2. `/newbot` command bhejein.
3. Apne bot ka naam rakhein (jaise: `Arrows Maze Game`).
4. Bot ka username rakhein jo `bot` se end ho (jaise: `arrows_puzzle_game_bot`).
5. **BotFather aapko ek API Token dega**, jaise:  
   `7123456789:ABCdefGhIJKlmNoPQRstuVWXyz`
6. Is token ko copy karke `.env` file me paste karein:
   ```env
   BOT_TOKEN=7123456789:ABCdefGhIJKlmNoPQRstuVWXyz
   ```

---

### Step 2: Game ko HTTPS URL Par Host Karein

Telegram WebApps ko open karne ke liye **HTTPS URL** zaroori hota hai. Aapke paas 2 easy options hain:

#### 🟢 Option A: GitHub Pages (Permanent & 100% Free - Recommended)
1. GitHub par ek naya public repository banayein (jaise: `arrows-game`).
2. `webapp/index.html` file ko us repo me upload kar dein.
3. Repo ke **Settings** > **Pages** me jayein.
4. **Source** me `main` branch aur `/ (root)` select karke **Save** karein.
5. 1 minute me aapko aapka permanent HTTPS URL mil jayega:  
   `https://<username>.github.io/<repo-name>/`
6. Is URL ko `.env` me daal dein:
   ```env
   WEBAPP_URL=https://your-username.github.io/arrows-game/
   ```

#### 🟡 Option B: Local Testing via Cloudflare / Ngrok / Localtunnel
Agar turant bina GitHub ke apne PC se test karna chahte hain:
1. Terminal 1 me game server run karein:
   ```powershell
   python server.py
   ```
2. Terminal 2 me localtunnel ya ngrok chalayein:
   ```powershell
   npx localtunnel --port 8080
   ```
3. Jo `https://....loca.lt` URL mile, usko `.env` me `WEBAPP_URL` me daalein.

---

### Step 3: Bot Ko Run Karein

1. Terminal me commands run karein:
   ```powershell
   cd C:\Users\anshm\.gemini\antigravity\scratch\arrows-telegram-bot
   python bot.py
   ```
2. Console par aayega:
   ```text
   🚀 Starting Arrows Telegram Bot...
   🔗 WebApp URL configured: https://...
   ✅ Bot is now polling Telegram for messages...
   ```
3. Telegram par apne bot ke username par jayein aur **`/start`** dabayein!
4. Aapko **"🎮 Play Arrows Game"** ka inline button dikhega. Click karte hi game Telegram ke andar full screen open ho jayega!

---

### Step 4: BotFather par Menu Button Configure Karna (Optional)
Agar aap chahte hain ki chat input box ke baayein (left) side hamesha ek "🎮 Play" button rahe:
1. `@BotFather` par jayein aur type karein: `/mybots`
2. Apna bot select karein > **Bot Settings** > **Menu Button** > **Configure menu button**.
3. Apna WebApp HTTPS URL send karein aur button ka naam `🎮 Play Game` rakh dein.

---

## ✨ Features Added for Telegram

1. **Telegram WebApp SDK Integration**:
   - `Telegram.WebApp.ready()` & `Telegram.WebApp.expand()` se game screen par automatically fit ho jata hai.
   - `disableVerticalSwipes()` se accidental dragging par game close nahi hota.
2. **Native Mobile Haptic Feedback**:
   - Arrows shoot hone par haptic impact vibration.
   - Collision/Heart lose hone par error vibration pattern.
   - Level clear karne par victory vibration.
3. **Player Name Recognition**:
   - Game header aur victory screen par Telegram user ka pehla naam display hota hai (`tg.initDataUnsafe.user.first_name`).
4. **One-Click Share to Chat**:
   - Victory screen par "Share to Telegram" button se player apne score ko kisi bhi group ya dost ke saath share kar sakta hai.
