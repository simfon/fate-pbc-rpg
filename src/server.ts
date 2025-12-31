import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase, execRaw, execute } from './db/database.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import adminRoutes from './routes/admin.js';
import apiRoutes from './routes/api.js';
import { requireAuth } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Migration per aggiungere colonne mancanti
async function runMigrations() {
  // Migrations are handled gracefully - SQLite will error if column exists, we catch it
  const migrations = [
    'ALTER TABLE invites ADD COLUMN use_count INTEGER DEFAULT 0',
    'ALTER TABLE invites ADD COLUMN max_uses INTEGER DEFAULT 5',
    'ALTER TABLE users ADD COLUMN last_seen TEXT',
  ];
  
  for (const migration of migrations) {
    try {
      await execRaw(migration);
      console.log(`📝 Migration applied: ${migration.substring(0, 50)}...`);
    } catch {
      // Column already exists, ignore
    }
  }
}

async function startServer() {
  // Inizializza il database
  await initDatabase();
  
  // Esegui migrations
  await runMigrations();
  
  const app = express();
  const PORT = process.env.PORT || 3000;

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Middleware
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fate-pbc-rpg-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true only if behind HTTPS proxy
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 giorni
    }
  }));

  // Passa variabili di sessione ai template e aggiorna last_seen
  app.use((req, res, next) => {
    res.locals.user = req.session.userId ? {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role
    } : null;
    
    // Aggiorna last_seen per utenti autenticati (fire and forget)
    if (req.session.userId) {
      const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      execute('UPDATE users SET last_seen = ? WHERE id = ?', [now, req.session.userId]).catch(() => {});
    }
    
    next();
  });

  // Routes
  app.use('/', authRoutes);
  app.use('/game', requireAuth, gameRoutes);
  app.use('/admin', requireAuth, adminRoutes);
  app.use('/api', requireAuth, apiRoutes);

  // Homepage
  app.get('/', (req, res) => {
    if (req.session.userId) {
      return res.redirect('/game');
    }
    res.render('home');
  });

  // 404
  app.use((req, res) => {
    res.status(404).render('error', { 
      title: 'Pagina non trovata',
      message: 'La pagina che cerchi si è persa nelle nebbie del tempo...'
    });
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).render('error', {
      title: 'Errore',
      message: 'Qualcosa è andato storto nei reami mistici...'
    });
  });

  app.listen(PORT, () => {
    console.log(`
  ⚔️  Cronache del Destino ⚔️
  ========================
  Server avviato su http://localhost:${PORT}
    `);
  });
}

startServer().catch(console.error);
