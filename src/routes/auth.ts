import { Router } from 'express';
import { createHash } from 'crypto';
import { queryOne, execute } from '../db/database.js';
import type { User, Invite } from '../types.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Login page
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/game');
  }
  res.render('login', { error: null });
});

// Login action
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.render('login', { error: 'Inserisci username e password.' });
  }
  
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE username = ?',
    [username]
  );
  
  if (!user) {
    return res.render('login', { error: 'Credenziali non valide.' });
  }
  
  if (user.password_hash !== hashPassword(password)) {
    return res.render('login', { error: 'Credenziali non valide.' });
  }
  
  if (user.is_banned) {
    return res.render('login', { error: 'Il tuo account è stato sospeso.' });
  }
  
  // Set session
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  
  res.redirect('/game');
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/game');
  }
  const { code } = req.query;
  res.render('register', { error: null, inviteCode: code || '' });
});

// Register action
router.post('/register', async (req, res) => {
  const { username, password, password_confirm, invite_code } = req.body;
  
  // Validazione
  if (!username || !password || !invite_code) {
    return res.render('register', { 
      error: 'Tutti i campi sono obbligatori.', 
      inviteCode: invite_code 
    });
  }
  
  if (password !== password_confirm) {
    return res.render('register', { 
      error: 'Le password non coincidono.', 
      inviteCode: invite_code 
    });
  }
  
  if (username.length < 3 || username.length > 30) {
    return res.render('register', { 
      error: 'Lo username deve essere tra 3 e 30 caratteri.', 
      inviteCode: invite_code 
    });
  }
  
  if (password.length < 6) {
    return res.render('register', { 
      error: 'La password deve essere di almeno 6 caratteri.', 
      inviteCode: invite_code 
    });
  }
  
  // Verifica invito
  const invite = await queryOne<Invite>(
    "SELECT * FROM invites WHERE code = ? AND use_count < COALESCE(max_uses, 5) AND expires_at > datetime('now')",
    [invite_code]
  );
  
  if (!invite) {
    return res.render('register', { 
      error: 'Codice invito non valido, esaurito o scaduto.', 
      inviteCode: invite_code 
    });
  }
  
  // Verifica username unico
  const existingUser = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );
  if (existingUser) {
    return res.render('register', { 
      error: 'Questo username è già in uso.', 
      inviteCode: invite_code 
    });
  }
  
  // Crea utente
  const result = await execute(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, hashPassword(password)]
  );
  
  // Incrementa contatore uso invito
  await execute(
    'UPDATE invites SET use_count = use_count + 1, used_by = ? WHERE id = ?',
    [result.lastInsertRowid, invite.id]
  );
  
  // Login automatico
  req.session.userId = result.lastInsertRowid;
  req.session.username = username;
  req.session.role = 'player';
  
  res.redirect('/game/character/create');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

export default router;

// Change own password (protected)
router.get('/change-password', requireAuth, (req, res) => {
  res.render('change-password', { error: null, success: null });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password, new_password_confirm } = req.body;
  const userId = req.session.userId;

  if (!current_password || !new_password) {
    return res.render('change-password', { error: 'Compila tutti i campi.', success: null });
  }

  if (new_password !== new_password_confirm) {
    return res.render('change-password', { error: 'Le password non coincidono.', success: null });
  }

  const user = await queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).render('error', { title: 'Utente non trovato', message: 'Utente non trovato' });
  }

  if (user.password_hash !== createHash('sha256').update(current_password).digest('hex')) {
    return res.render('change-password', { error: 'Password corrente non corretta.', success: null });
  }

  // Update with hashed new password
  const newHash = createHash('sha256').update(new_password).digest('hex');
  await execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

  res.render('change-password', { error: null, success: 'Password aggiornata con successo.' });
});
