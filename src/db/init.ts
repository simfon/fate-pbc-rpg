import { initDatabase } from './database.js';
import { createHash, randomBytes } from 'crypto';

// Funzione per hashare le password (semplice, per questo progetto)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function main() {
  const db = await initDatabase();

  const schema = `
-- Tabella utenti
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'player' CHECK(role IN ('player', 'destiny', 'admin')),
  is_banned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabella locazioni
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  north_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  south_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  east_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  west_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  is_public INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabella personaggi
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  high_concept TEXT NOT NULL,
  trouble TEXT NOT NULL,
  aspect_1 TEXT,
  aspect_2 TEXT,
  aspect_3 TEXT,
  careful INTEGER DEFAULT 1,
  clever INTEGER DEFAULT 1,
  flashy INTEGER DEFAULT 1,
  forceful INTEGER DEFAULT 1,
  quick INTEGER DEFAULT 1,
  sneaky INTEGER DEFAULT 1,
  fate_points INTEGER DEFAULT 3,
  stress_1 INTEGER DEFAULT 0,
  stress_2 INTEGER DEFAULT 0,
  stress_3 INTEGER DEFAULT 0,
  mild_consequence TEXT,
  moderate_consequence TEXT,
  severe_consequence TEXT,
  current_location_id INTEGER DEFAULT 1 REFERENCES locations(id) ON DELETE SET DEFAULT,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabella messaggi
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_action INTEGER DEFAULT 0,
  is_destiny INTEGER DEFAULT 0,
  is_ooc INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabella inviti
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 5,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

  // Esegui lo schema (dividi per statement)
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      db.exec(stmt + ';');
    }
  }

  console.log('✨ Schema database creato!');

  // Migration: aggiungi colonne use_count e max_uses se non esistono
  try {
    db.exec('ALTER TABLE invites ADD COLUMN use_count INTEGER DEFAULT 0');
    console.log('📝 Aggiunta colonna use_count');
  } catch (e) {
    // Colonna già esistente
  }
  try {
    db.exec('ALTER TABLE invites ADD COLUMN max_uses INTEGER DEFAULT 5');
    console.log('📝 Aggiunta colonna max_uses');
  } catch (e) {
    // Colonna già esistente
  }

  // Verifica se esistono già dati
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  if (userCount.count === 0) {
    console.log('📝 Inizializzazione dati di base...');
    
    // Crea admin iniziale (password: admin123)
    const adminHash = hashPassword('admin123');
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)
    `);
    insertUser.run('Narratore', adminHash, 'admin');
    
    // Crea alcune locazioni iniziali
    const insertLocation = db.prepare(`
      INSERT INTO locations (name, description, image_url) VALUES (?, ?, ?)
    `);
    
    const piazza = insertLocation.run(
      'Piazza del Mercato',
      'Il cuore pulsante della città. Bancarelle colorate vendono ogni sorta di merce: spezie esotiche, stoffe pregiate, e misteriosi artefatti. Il brusio della folla si mescola al profumo del pane appena sfornato.',
      'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800'
    );
    
    const taverna = insertLocation.run(
      'La Taverna del Drago Rosso',
      'Un\'accogliente taverna con travi di legno scuro e un grande camino sempre acceso. L\'oste, un uomo corpulento dalla barba grigia, serve birra scura e stufato fumante. Avventurieri e mercanti scambiano storie agli angoli bui.',
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800'
    );
    
    const tempio = insertLocation.run(
      'Il Tempio della Luna',
      'Un antico santuario di marmo bianco, illuminato da candele argentate. L\'aria è densa di incenso e preghiere sussurrate. Sacerdotesse in vesti pallide si muovono silenziose tra le colonne.',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
    );
    
    const foresta = insertLocation.run(
      'La Foresta dei Sussurri',
      'Alberi antichi i cui rami si intrecciano a formare una volta naturale. La luce filtra a malapena, creando giochi d\'ombra misteriosi. Si dice che gli spiriti degli antichi custodi vaghino ancora tra questi sentieri.',
      'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800'
    );
    
    // Collega le locazioni
    const updateLocation = db.prepare(`
      UPDATE locations SET north_id = ?, south_id = ?, east_id = ?, west_id = ? WHERE id = ?
    `);
    
    // Piazza: nord=tempio, est=taverna, ovest=foresta
    updateLocation.run(tempio.lastInsertRowid, null, taverna.lastInsertRowid, foresta.lastInsertRowid, piazza.lastInsertRowid);
    // Taverna: ovest=piazza
    updateLocation.run(null, null, null, piazza.lastInsertRowid, taverna.lastInsertRowid);
    // Tempio: sud=piazza
    updateLocation.run(null, piazza.lastInsertRowid, null, null, tempio.lastInsertRowid);
    // Foresta: est=piazza
    updateLocation.run(null, null, piazza.lastInsertRowid, null, foresta.lastInsertRowid);
    
    // Crea un invito iniziale per registrarsi
    const inviteCode = randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO invites (code, created_by, expires_at) VALUES (?, 1, ?)').run(inviteCode, expiresAt);
    
    console.log('✅ Dati iniziali creati!');
    console.log('');
    console.log('🔐 Credenziali Admin:');
    console.log('   Username: Narratore');
    console.log('   Password: admin123');
    console.log('');
    console.log('🎟️  Codice invito iniziale:', inviteCode);
    console.log('');
  } else {
    console.log('📊 Database già inizializzato, nessuna modifica.');
  }

  db.close();
}

main().catch(console.error);
