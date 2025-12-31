# ⚔️ Cronache del Destino

Un gioco di ruolo play-by-chat in italiano, server-side rendered, ispirato al sistema **Fate Accelerated**.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

## ✨ Caratteristiche

- 🏰 **Locazioni interconnesse** - Mappa navigabile con direzioni N/S/E/O
- 💬 **Chat in tempo reale** - Polling HTMX per aggiornamenti fluidi
- 🎭 **Schede personaggio** - Sistema Fate Accelerated con 6 Approcci
- 🎲 **Tiri di dado** - 4dF integrati nella chat
- 🌙 **Il Destino** - Game Master anonimi con messaggi speciali
- 👥 **Pannello Admin** - Gestione utenti, locazioni e inviti
- 🔐 **Sistema ad invito** - Registrazione solo con codice, niente email

## 🎮 Sistema di Gioco

Basato su **Fate Accelerated Edition**:

### Approcci
- 🛡️ **Cauto** - Agire con prudenza e attenzione
- 🧠 **Ingegnoso** - Usare astuzia e intelligenza
- ✨ **Appariscente** - Fare le cose con stile
- 💪 **Vigoroso** - Usare la forza bruta
- ⚡ **Rapido** - Agire in velocità
- 🗡️ **Furtivo** - Muoversi di nascosto

### Distribuzione iniziale
+3, +2, +2, +1, +1, +0

### Tipi di messaggio
- 💬 **Dialogo** - Il personaggio parla
- ⚔️ **Azione** - Descrizione narrativa *in corsivo*
- 💭 **OOC** - Fuori personaggio
- 🌙 **Destino** - Solo per GM, messaggi anonimi dorati

## 🚀 Installazione

```bash
# Clona o scarica il progetto
cd cronache-di-avalon

# Installa dipendenze
npm install

# Inizializza il database
npm run db:init

# Avvia in sviluppo
npm run dev

# Oppure build + start per produzione
npm run build
npm start
```

## 🔐 Primo Accesso

Dopo `npm run db:init`, vedrai:

```
🔐 Credenziali Admin:
   Username: Narratore
   Password: admin123

🎟️  Codice invito iniziale: [codice]
```

1. Vai su http://localhost:3000
2. Accedi come **Narratore** per amministrare
3. Usa il codice invito per registrare altri utenti
4. Genera nuovi codici dal pannello Admin

## 📁 Struttura Progetto

```
src/
├── server.ts           # Entry point Express
├── types.ts            # Tipi TypeScript
├── db/
│   ├── database.ts     # Connessione SQLite
│   └── init.ts         # Schema e dati iniziali
├── middleware/
│   └── auth.ts         # Middleware autenticazione
├── routes/
│   ├── auth.ts         # Login, registrazione, logout
│   ├── game.ts         # Dashboard, personaggi, gioco
│   ├── admin.ts        # Pannello amministrazione
│   └── api.ts          # API per chat e azioni
└── views/
    ├── layout.ejs      # Layout base
    ├── home.ejs        # Homepage
    ├── login.ejs       # Form login
    ├── register.ejs    # Form registrazione
    ├── error.ejs       # Pagina errore
    ├── game/
    │   ├── dashboard.ejs      # Lista personaggi
    │   ├── character-create.ejs
    │   ├── character-view.ejs
    │   └── play.ejs           # Chat di gioco
    ├── admin/
    │   ├── dashboard.ejs
    │   ├── users.ejs
    │   ├── locations.ejs
    │   ├── location-edit.ejs
    │   ├── invites.ejs
    │   └── character-edit.ejs
    └── partials/
        ├── messages.ejs
        └── present-characters.ejs
```

## 🛠️ Stack Tecnologico

- **Express.js** - Server web
- **EJS** - Template engine SSR
- **HTMX** - Interattività senza SPA
- **Tailwind CSS** (CDN) - Styling
- **Better-sqlite3** - Database SQLite
- **TypeScript** - Type safety

## 🎨 Personalizzazione

### Aggiungere locazioni
Dal pannello Admin → Gestione Locazioni → Nuova Locazione

### Modificare lo stile
Modifica le variabili Tailwind in `layout.ejs`:
```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        parchment: '#f4e4bc',
        ink: '#2c1810',
        gold: '#c9a227',
        // ...
      }
    }
  }
}
```

## 📜 Licenza

MIT - Libero per uso personale e commerciale.

---

*Che le Cronache abbiano inizio!* ⚔️
