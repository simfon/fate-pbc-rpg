import { Router } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../db/database.js';
import { requireAdmin } from '../middleware/auth.js';
import type { User, Character } from '../types.js';

const router = Router();

// Dashboard admin
router.get('/', requireAdmin, (req, res) => {
  const db = getDb();
  const stats = {
    users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count,
    characters: (db.prepare('SELECT COUNT(*) as count FROM characters').get() as { count: number }).count,
    locations: (db.prepare('SELECT COUNT(*) as count FROM locations').get() as { count: number }).count,
    messages: (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count,
  };
  
  res.render('admin/dashboard', { stats });
});

// Gestione utenti
router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM characters WHERE user_id = u.id) as character_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all();
  
  res.render('admin/users', { users });
});

router.post('/users/:id/role', requireAdmin, (req, res) => {
  const db = getDb();
  const { role } = req.body;
  if (!['player', 'destiny', 'admin'].includes(role)) {
    return res.status(400).send('Ruolo non valido');
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.redirect('/admin/users');
});

// Assegna ruolo Destino
router.post('/users/:id/destiny', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('destiny', req.params.id);
  res.redirect('/admin/users');
});

// Rimuovi ruolo Destino
router.post('/users/:id/remove-destiny', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run('player', req.params.id);
  res.redirect('/admin/users');
});

router.post('/users/:id/ban', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/users');
});

// Sbanna utente
router.post('/users/:id/unban', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/users');
});

router.post('/users/:id/unban', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/users');
});

router.post('/users/:id/destiny', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET role = 'destiny' WHERE id = ?").run(req.params.id);
  res.redirect('/admin/users');
});

router.post('/users/:id/remove-destiny', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare("UPDATE users SET role = 'player' WHERE id = ?").run(req.params.id);
  res.redirect('/admin/users');
});

// Gestione locazioni
router.get('/locations', requireAdmin, (req, res) => {
  const db = getDb();
  const locations = db.prepare('SELECT * FROM locations ORDER BY name').all();
  res.render('admin/locations', { locations });
});

router.get('/locations/new', requireAdmin, (req, res) => {
  const db = getDb();
  const allLocations = db.prepare('SELECT id, name FROM locations ORDER BY name').all();
  res.render('admin/location-edit', { location: null, allLocations, error: null });
});

router.get('/locations/:id/edit', requireAdmin, (req, res) => {
  const db = getDb();
  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  const allLocations = db.prepare('SELECT id, name FROM locations WHERE id != ? ORDER BY name').all(req.params.id);
  res.render('admin/location-edit', { location, allLocations, error: null });
});

router.post('/locations', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, description, image_url, north_id, south_id, east_id, west_id } = req.body;
  
  if (!name || !description) {
    const allLocations = db.prepare('SELECT id, name FROM locations ORDER BY name').all();
    return res.render('admin/location-edit', { 
      location: req.body, 
      allLocations, 
      error: 'Nome e descrizione sono obbligatori.' 
    });
  }
  
  // Insert new location
  const result = db.prepare(`
    INSERT INTO locations (name, description, image_url, north_id, south_id, east_id, west_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, description, image_url || null,
    north_id || null, south_id || null, east_id || null, west_id || null
  );
  
  const newId = result.lastInsertRowid;
  
  // Create bidirectional connections
  if (north_id) db.prepare('UPDATE locations SET south_id = ? WHERE id = ?').run(newId, north_id);
  if (south_id) db.prepare('UPDATE locations SET north_id = ? WHERE id = ?').run(newId, south_id);
  if (east_id) db.prepare('UPDATE locations SET west_id = ? WHERE id = ?').run(newId, east_id);
  if (west_id) db.prepare('UPDATE locations SET east_id = ? WHERE id = ?').run(newId, west_id);
  
  res.redirect('/admin/locations');
});

// Update existing location
router.post('/locations/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const locationId = parseInt(req.params.id);
  const { name, description, image_url, north_id, south_id, east_id, west_id } = req.body;
  
  if (!name || !description) {
    const allLocations = db.prepare('SELECT id, name FROM locations WHERE id != ? ORDER BY name').all(locationId);
    return res.render('admin/location-edit', { 
      location: { id: locationId, ...req.body }, 
      allLocations, 
      error: 'Nome e descrizione sono obbligatori.' 
    });
  }
  
  // Get old connections to remove bidirectional links
  const oldLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId) as any;
  
  // Remove old bidirectional connections
  if (oldLocation.north_id) db.prepare('UPDATE locations SET south_id = NULL WHERE id = ? AND south_id = ?').run(oldLocation.north_id, locationId);
  if (oldLocation.south_id) db.prepare('UPDATE locations SET north_id = NULL WHERE id = ? AND north_id = ?').run(oldLocation.south_id, locationId);
  if (oldLocation.east_id) db.prepare('UPDATE locations SET west_id = NULL WHERE id = ? AND west_id = ?').run(oldLocation.east_id, locationId);
  if (oldLocation.west_id) db.prepare('UPDATE locations SET east_id = NULL WHERE id = ? AND east_id = ?').run(oldLocation.west_id, locationId);
  
  // Update location
  db.prepare(`
    UPDATE locations SET 
      name = ?, description = ?, image_url = ?,
      north_id = ?, south_id = ?, east_id = ?, west_id = ?
    WHERE id = ?
  `).run(
    name, description, image_url || null,
    north_id || null, south_id || null, east_id || null, west_id || null,
    locationId
  );
  
  // Create new bidirectional connections
  if (north_id) db.prepare('UPDATE locations SET south_id = ? WHERE id = ?').run(locationId, north_id);
  if (south_id) db.prepare('UPDATE locations SET north_id = ? WHERE id = ?').run(locationId, south_id);
  if (east_id) db.prepare('UPDATE locations SET west_id = ? WHERE id = ?').run(locationId, east_id);
  if (west_id) db.prepare('UPDATE locations SET east_id = ? WHERE id = ?').run(locationId, west_id);
  
  res.redirect('/admin/locations');
});

router.post('/locations/:id/delete', requireAdmin, (req, res) => {
  const db = getDb();
  // Sposta tutti i personaggi alla locazione 1
  db.prepare('UPDATE characters SET current_location_id = 1 WHERE current_location_id = ?').run(req.params.id);
  // Rimuovi riferimenti
  db.prepare('UPDATE locations SET north_id = NULL WHERE north_id = ?').run(req.params.id);
  db.prepare('UPDATE locations SET south_id = NULL WHERE south_id = ?').run(req.params.id);
  db.prepare('UPDATE locations SET east_id = NULL WHERE east_id = ?').run(req.params.id);
  db.prepare('UPDATE locations SET west_id = NULL WHERE west_id = ?').run(req.params.id);
  // Elimina
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.redirect('/admin/locations');
});

// Gestione inviti
router.get('/invites', requireAdmin, (req, res) => {
  const db = getDb();
  const invites = db.prepare(`
    SELECT i.*, 
      creator.username as creator_name,
      used.username as used_by_name
    FROM invites i
    JOIN users creator ON i.created_by = creator.id
    LEFT JOIN users used ON i.used_by = used.id
    ORDER BY i.created_at DESC
  `).all();
  
  res.render('admin/invites', { invites });
});

router.post('/invites/create', requireAdmin, (req, res) => {
  const db = getDb();
  const code = randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare('INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, ?)').run(
    code, req.session.userId, expiresAt
  );
  
  res.redirect('/admin/invites');
});

router.post('/invites/:id/delete', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM invites WHERE id = ? AND use_count < COALESCE(max_uses, 5)').run(req.params.id);
  res.redirect('/admin/invites');
});

// Lista tutti i personaggi
router.get('/characters', requireAdmin, (req, res) => {
  const db = getDb();
  const characters = db.prepare(`
    SELECT c.*, u.username as owner_username, l.name as location_name
    FROM characters c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN locations l ON c.current_location_id = l.id
    ORDER BY c.created_at DESC
  `).all();
  
  res.render('admin/characters', { characters });
});

// Modifica personaggio (admin)
router.get('/characters/:id/edit', requireAdmin, (req, res) => {
  const db = getDb();
  const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as unknown as Character;
  if (!character) {
    return res.status(404).render('error', { title: 'Non trovato', message: 'Personaggio non trovato' });
  }
  const owner = db.prepare('SELECT * FROM users WHERE id = ?').get(character.user_id) as unknown as User;
  const locations = db.prepare('SELECT id, name FROM locations ORDER BY name').all();
  res.render('admin/character-edit', { character, owner, locations, error: null });
});

router.post('/characters/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const { fate_points, stress_1, stress_2, stress_3, mild_consequence, moderate_consequence, severe_consequence } = req.body;
  
  db.prepare(`
    UPDATE characters SET 
      fate_points = ?,
      stress_1 = ?,
      stress_2 = ?,
      stress_3 = ?,
      mild_consequence = ?,
      moderate_consequence = ?,
      severe_consequence = ?
    WHERE id = ?
  `).run(
    parseInt(fate_points) || 0,
    stress_1 ? 1 : 0,
    stress_2 ? 1 : 0,
    stress_3 ? 1 : 0,
    mild_consequence || null,
    moderate_consequence || null,
    severe_consequence || null,
    req.params.id
  );
  
  res.redirect(`/game/character/${req.params.id}`);
});

// Storico messaggi per location
router.get('/messages', requireAdmin, (req, res) => {
  const db = getDb();
  const { location_id } = req.query;
  
  const locations = db.prepare('SELECT id, name FROM locations ORDER BY name').all();
  
  let messages: any[] = [];
  let selectedLocation = null;
  
  if (location_id) {
    selectedLocation = db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id);
    messages = db.prepare(`
      SELECT m.*, c.name as character_name, c.avatar_url as character_avatar, u.username
      FROM messages m
      LEFT JOIN characters c ON m.character_id = c.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.location_id = ?
      ORDER BY m.created_at DESC
      LIMIT 500
    `).all(location_id);
  }
  
  res.render('admin/messages', { locations, messages, selectedLocation });
});

// Cancella messaggio
router.post('/messages/:id/delete', requireAdmin, (req, res) => {
  const db = getDb();
  const message = db.prepare('SELECT location_id FROM messages WHERE id = ?').get(req.params.id) as { location_id: number } | undefined;
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.redirect(`/admin/messages${message ? `?location_id=${message.location_id}` : ''}`);
});

export default router;
