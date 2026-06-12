# Utrecht Ultimates Cricket Scorecard

Welcome to **Utrecht Ultimates Cricket Scorecard** — a sunlight-optimized, high-contrast, fully offline-first cricket scoring application with real-time Firestore synchronization. Whether you are scoring under bright sunlight or at dusk, this application provides high accessibility, haptic feedback on key taps, and seamless team management.

---

## 🌟 Key Features

- ☀️ **Dual High-Contrast Modes**: Quickly switch between ultra-bright **Sunlight Mode** and battery-saving **Night Mode**.
- 🔄 **Real-Time Synchronizer**: Live multi-device tracking powered by Google Firestore (remains robustly offline-first via local storage backups).
- 🏆 **Squads & Lineup Editor**: Fully customize player rosters and batting order for both Teams.
- 🪙 **Interactive Toss Simulator**: Select tails/heads, choose to bat/bowl first, and immediately set up the match.
- 🏏 **Ball-by-Ball Live Scoring Engine**:
  - Auto-calculated runs, wickets, extras (wides, no-balls, leg-byes, byes), overs state, and run rates.
  - Interactive bowler wizard for changing bowlers.
  - Multi-level undo (Undo Last Delivery) to correct mistakes.
- 🛑 **Custom Confirmation Modal**: Advanced warning dialog before deletion or major state resets to prevent losing match progress.
- 📊 **Detailed Team Scorecard**: Expandable full detailed batsman stats (runs, balls faced, boundaries, strike rates) and bowler telemetry (overs, maidens, runs conceded, wickets, economy).

---

## 📖 How to Use the App

### 1. Match Creation
* Enter the **Match Name** and customize the **Team Names** (Default: Utrecht Ultimates vs. Utrecht Challengers).
* Choose the **Number of Overs** (from 1 to 100) and **Players Per Team** (from 1 to 30).
* Click **Create Match** to begin setup.

### 2. Squad Setup
* Customize the actual player names for both **Team A** and **Team B**.
* Change the order of players. The top two batsman will automatically starting as openers, and the rest can be selected during wickets.

### 3. Coin Toss
* Pick Heads or Tails, and choose whether the winning team decides to first **Bat** or **Bowl**.
* The application automatically configures Innings 1 and Innings 2 structures based on the selection.

### 4. Active Scoring Screen
* **Record Runs**: Tap 0, 1, 2, 3, 4, or 6 to add to the score.
* **Extras**: Tap Wd (Wide), NB (No-ball), Lb (Leg-Bye), or By (Bye) to log extras.
* **Wickets**: Log out/dismissed batsman. You will be prompted to select the type of dismissals (Bowled, Caught, Run Out, etc.) and who the next batsman coming to the crease is.
* **Change Bowler**: At the completion of each over, select who the next active bowler is.
* **Undo & Manual Finish**: Use the **Undo** button to revert the last ball, or **Declare Winner** to end the match early if needed.

### 5. Detailed Stats
* Scroll down or tap **Show Detailed Team Scorecards** to expand detailed stats for all batsman and bowlers. This updates live as you click score buttons.

---

## 🛠️ Technical Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (Version 18 or above recommended)
* [npm](https://www.npmjs.com/) (bundled with Node.js)

### Installation

1. Clone or download the project workspace repository.
2. Install the necessary node modules inside the project directory:
   ```bash
   npm install
   ```

### Development Server

Run the development server locally:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Production Build

Create a production build of the static application:
```bash
npm run build
```
The compiled files will compile inside the `./dist` folder which can be hosted on any static hosting provider.

---

## 🚀 Exporting / Pushing to GitHub

Since this application is developed within the **Google AI Studio Build** environment, pushing directly to a GitHub repository is simple:

1. Look at the top-right or sidebar settings menu in the **AI Studio** editor.
2. Select **Export to GitHub** or **Download ZIP**.
3. If exporting to GitHub, authenticate with your GitHub account, select your target repository details, and complete the connection.
4. Alternatively, you can download the project as a ZIP and push it to your own remote repository using command-line Git:
   ```bash
   git init
   git add .
   git commit -m "Initial Utrecht Ultimates Cricket Scorecard commit"
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```
