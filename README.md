# ⚔️ Fate Play-by-Chat RPG

A server-side rendered play-by-chat role-playing game powered by the **Fate Accelerated Edition** system.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

## ✨ Features

- 🏰 **Interconnected Locations** — Navigable map with N/S/E/W directional connections
- 💬 **Real-time Chat** — HTMX polling for smooth message updates
- 🎭 **Character Sheets** — Full Fate Accelerated system with 6 Approaches
- 🎲 **Integrated Dice Rolls** — 4dF (Fate Dice) rolls displayed in chat
- 🌙 **The Destiny** — Anonymous Game Master messages with special styling
- 👥 **Admin Panel** — Complete management of users, locations, characters, and invites
- 🔐 **Invite-only Registration** — No email required, code-based access control
- ⚡ **Stress & Consequences** — Track damage with stress boxes and consequence slots
- ✨ **Fate Points** — Spend and gain Fate Points with in-chat notifications

## 🎮 Game System

Based on **Fate Accelerated Edition** (FAE):

### Approaches
| Approach | Description |
|----------|-------------|
| 🛡️ **Careful** | Acting with caution and attention to detail |
| 🧠 **Clever** | Using wit, intelligence, and cunning |
| ✨ **Flashy** | Doing things with style and flair |
| 💪 **Forceful** | Using brute strength and direct action |
| ⚡ **Quick** | Acting with speed and agility |
| 🗡️ **Sneaky** | Moving stealthily and acting covertly |

### Starting Distribution
Characters are created with approaches rated: **+3, +2, +2, +1, +1, +0**

### Character Sheet
- **High Concept** — Your character's core identity
- **Trouble** — A recurring complication
- **3 Additional Aspects** — Optional narrative hooks
- **3 Stress Boxes** — Absorb harm before taking consequences
- **Consequences** — Mild (-2), Moderate (-4), Severe (-6)
- **Fate Points** — Starting pool of 3

### Message Types
| Type | Description |
|------|-------------|
| 💬 **Dialogue** | Character speech |
| ⚔️ **Action** | Narrative descriptions displayed in *italics* |
| 🌙 **Destiny** | Anonymous GM messages (golden styling) |

### Dice Rolls
The integrated 4dF dice roller:
- Rolls 4 Fate dice (each showing ⊟ -1, ⊡ 0, or ⊞ +1)
- Adds selected Approach bonus
- Supports optional modifiers
- Results posted directly to location chat

## 🚀 Installation

```bash
# Clone or download the project
cd fate-pbc-rpg

# Install dependencies
npm install

# Initialize the database
npm run db:init

# Start in development mode
npm run dev

# Or build and start for production
npm run build
npm start
```

## 🔐 First Access

After running `npm run db:init`, you'll see:

```
🔐 Admin Credentials:
   Username: Narratore
   Password: admin123

🎟️  Initial invite code: [generated-code]
```

### Getting Started
1. Navigate to http://localhost:3000
2. Log in as **Narratore** to access the admin panel
3. Use the invite code to register additional players
4. Generate new invite codes from Admin → Invites

## 👑 User Roles

| Role | Permissions |
|------|-------------|
| **Player** | Create characters, play in locations, send messages |
| **Destiny** | Player abilities + send anonymous Destiny messages |
| **Admin** | Full access: manage users, locations, characters, invites |

## 🛠️ Admin Panel

Accessible at `/admin` for admin users:

- **Dashboard** — Overview statistics (users, characters, locations, messages)
- **Users** — View all users, change roles, ban/unban accounts
- **Locations** — Create, edit, delete locations with bidirectional connections
- **Characters** — View and edit all characters in the system
- **Invites** — Generate multi-use invite codes (default: 5 uses, 7-day expiry)

## 📁 Project Structure

```
src/
├── server.ts           # Express entry point with session config
├── types.ts            # TypeScript interfaces and types
├── db/
│   ├── database.ts     # SQL.js database connection
│   └── init.ts         # Schema creation and seed data
├── middleware/
│   └── auth.ts         # Authentication and authorization middleware
├── routes/
│   ├── auth.ts         # Login, registration, logout
│   ├── game.ts         # Dashboard, character creation, play interface
│   ├── admin.ts        # Admin panel routes
│   └── api.ts          # Chat messages, dice rolls, fate points, stress
└── views/
    ├── home.ejs        # Landing page
    ├── login.ejs       # Login form
    ├── register.ejs    # Registration with invite code
    ├── error.ejs       # Error display
    ├── game/
    │   ├── dashboard.ejs       # Character selection
    │   ├── character-create.ejs
    │   ├── character-view.ejs
    │   └── play.ejs            # Main chat interface
    ├── admin/
    │   ├── dashboard.ejs
    │   ├── users.ejs
    │   ├── locations.ejs
    │   ├── location-edit.ejs
    │   ├── characters.ejs
    │   ├── character-edit.ejs
    │   ├── invites.ejs
    │   └── messages.ejs
    └── partials/
        ├── head.ejs
        ├── admin-nav.ejs
        ├── messages.ejs
        └── present-characters.ejs
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Express.js** | Web server and routing |
| **EJS** | Server-side rendering templates |
| **HTMX** | Reactive updates without a SPA framework |
| **Tailwind CSS** (CDN) | Utility-first styling |
| **SQL.js** | In-memory SQLite database |
| **TypeScript** | Type safety and better DX |
| **express-session** | Session management (7-day cookie) |

## 🗄️ Database Schema

### Tables
- **users** — Authentication and roles
- **characters** — Full FAE character sheets linked to users
- **locations** — Game areas with N/S/E/W connections
- **messages** — Chat history per location
- **invites** — Multi-use registration codes with expiration

## 📜 License

fate-rpg-pbc © 2025 by Simone Fontana is licensed under CC BY-NC-SA 4.0. To view a copy of this license, visit https://creativecommons.org/licenses/by-nc-sa/4.0/

---

*Let the chronicles begin!* ⚔️
