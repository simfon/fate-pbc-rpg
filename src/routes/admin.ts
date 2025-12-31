import { Router } from 'express';
import { randomBytes } from 'crypto';
import { queryOne, queryAll, execute } from '../db/database.js';
import { requireAdmin } from '../middleware/auth.js';
import type { User, Character, Location } from '../types.js';

const router = Router();

// Dashboard admin
router.get('/', requireAdmin, async (req, res) => {
  const users = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const characters = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM characters');
  const locations = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM locations');
  const messages = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM messages');
  
  const stats = {
    users: users?.count || 0,
    characters: characters?.count || 0,
    locations: locations?.count || 0,
    messages: messages?.count || 0,
  };
  
  res.render('admin/dashboard', { stats });
});

// Gestione utenti
router.get('/users', requireAdmin, async (req, res) => {
  const users = await queryAll<User & { character_count: number }>(
    `SELECT u.*, 
      (SELECT COUNT(*) FROM characters WHERE user_id = u.id) as character_count
     FROM users u
     ORDER BY u.created_at DESC`
  );
  
  res.render('admin/users', { users });
});

router.post('/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!['player', 'destiny', 'admin'].includes(role)) {
    return res.status(400).send('Ruolo non valido');
  }
  await execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  res.redirect('/admin/users');
});

// Assegna ruolo Destino
router.post('/users/:id/destiny', requireAdmin, async (req, res) => {
  await execute('UPDATE users SET role = ? WHERE id = ?', ['destiny', req.params.id]);
  res.redirect('/admin/users');
});

// Rimuovi ruolo Destino
router.post('/users/:id/remove-destiny', requireAdmin, async (req, res) => {
  await execute('UPDATE users SET role = ? WHERE id = ?', ['player', req.params.id]);
  res.redirect('/admin/users');
});

router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  await execute('UPDATE users SET is_banned = 1 WHERE id = ?', [req.params.id]);
  res.redirect('/admin/users');
});

// Sbanna utente
router.post('/users/:id/unban', requireAdmin, async (req, res) => {
  await execute('UPDATE users SET is_banned = 0 WHERE id = ?', [req.params.id]);
  res.redirect('/admin/users');
});

// Gestione locazioni
router.get('/locations', requireAdmin, async (req, res) => {
  const locations = await queryAll<Location>('SELECT * FROM locations ORDER BY name');
  res.render('admin/locations', { locations });
});

router.get('/locations/new', requireAdmin, async (req, res) => {
  const allLocations = await queryAll<{ id: number; name: string }>('SELECT id, name FROM locations ORDER BY name');
  res.render('admin/location-edit', { location: null, allLocations, error: null });
});

router.get('/locations/:id/edit', requireAdmin, async (req, res) => {
  const location = await queryOne<Location>('SELECT * FROM locations WHERE id = ?', [req.params.id]);
  const allLocations = await queryAll<{ id: number; name: string }>(
    'SELECT id, name FROM locations WHERE id != ? ORDER BY name',
    [req.params.id]
  );
  res.render('admin/location-edit', { location, allLocations, error: null });
});

router.post('/locations', requireAdmin, async (req, res) => {
  const { name, description, image_url, north_id, south_id, east_id, west_id } = req.body;
  
  if (!name || !description) {
    const allLocations = await queryAll<{ id: number; name: string }>('SELECT id, name FROM locations ORDER BY name');
    return res.render('admin/location-edit', { 
      location: req.body, 
      allLocations, 
      error: 'Nome e descrizione sono obbligatori.' 
    });
  }
  
  // Insert new location
  const result = await execute(
    `INSERT INTO locations (name, description, image_url, north_id, south_id, east_id, west_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, description, image_url || null, north_id || null, south_id || null, east_id || null, west_id || null]
  );
  
  const newId = result.lastInsertRowid;
  
  // Create bidirectional connections
  if (north_id) await execute('UPDATE locations SET south_id = ? WHERE id = ?', [newId, north_id]);
  if (south_id) await execute('UPDATE locations SET north_id = ? WHERE id = ?', [newId, south_id]);
  if (east_id) await execute('UPDATE locations SET west_id = ? WHERE id = ?', [newId, east_id]);
  if (west_id) await execute('UPDATE locations SET east_id = ? WHERE id = ?', [newId, west_id]);
  
  res.redirect('/admin/locations');
});

// Update existing location
router.post('/locations/:id', requireAdmin, async (req, res) => {
  const locationId = parseInt(req.params.id);
  const { name, description, image_url, north_id, south_id, east_id, west_id } = req.body;
  
  if (!name || !description) {
    const allLocations = await queryAll<{ id: number; name: string }>(
      'SELECT id, name FROM locations WHERE id != ? ORDER BY name',
      [locationId]
    );
    return res.render('admin/location-edit', { 
      location: { id: locationId, ...req.body }, 
      allLocations, 
      error: 'Nome e descrizione sono obbligatori.' 
    });
  }
  
  // Get old connections to remove bidirectional links
  const oldLocation = await queryOne<Location>('SELECT * FROM locations WHERE id = ?', [locationId]);
  
  if (oldLocation) {
    // Remove old bidirectional connections
    if (oldLocation.north_id) await execute('UPDATE locations SET south_id = NULL WHERE id = ? AND south_id = ?', [oldLocation.north_id, locationId]);
    if (oldLocation.south_id) await execute('UPDATE locations SET north_id = NULL WHERE id = ? AND north_id = ?', [oldLocation.south_id, locationId]);
    if (oldLocation.east_id) await execute('UPDATE locations SET west_id = NULL WHERE id = ? AND west_id = ?', [oldLocation.east_id, locationId]);
    if (oldLocation.west_id) await execute('UPDATE locations SET east_id = NULL WHERE id = ? AND east_id = ?', [oldLocation.west_id, locationId]);
  }
  
  // Update location
  await execute(
    `UPDATE locations SET 
      name = ?, description = ?, image_url = ?,
      north_id = ?, south_id = ?, east_id = ?, west_id = ?
     WHERE id = ?`,
    [name, description, image_url || null, north_id || null, south_id || null, east_id || null, west_id || null, locationId]
  );
  
  // Create new bidirectional connections
  if (north_id) await execute('UPDATE locations SET south_id = ? WHERE id = ?', [locationId, north_id]);
  if (south_id) await execute('UPDATE locations SET north_id = ? WHERE id = ?', [locationId, south_id]);
  if (east_id) await execute('UPDATE locations SET west_id = ? WHERE id = ?', [locationId, east_id]);
  if (west_id) await execute('UPDATE locations SET east_id = ? WHERE id = ?', [locationId, west_id]);
  
  res.redirect('/admin/locations');
});

router.post('/locations/:id/delete', requireAdmin, async (req, res) => {
  // Sposta tutti i personaggi alla locazione 1
  await execute('UPDATE characters SET current_location_id = 1 WHERE current_location_id = ?', [req.params.id]);
  // Rimuovi riferimenti
  await execute('UPDATE locations SET north_id = NULL WHERE north_id = ?', [req.params.id]);
  await execute('UPDATE locations SET south_id = NULL WHERE south_id = ?', [req.params.id]);
  await execute('UPDATE locations SET east_id = NULL WHERE east_id = ?', [req.params.id]);
  await execute('UPDATE locations SET west_id = NULL WHERE west_id = ?', [req.params.id]);
  // Elimina
  await execute('DELETE FROM locations WHERE id = ?', [req.params.id]);
  res.redirect('/admin/locations');
});

// Gestione inviti
router.get('/invites', requireAdmin, async (req, res) => {
  const invites = await queryAll<any>(
    `SELECT i.*, 
      creator.username as creator_name,
      used.username as used_by_name
     FROM invites i
     JOIN users creator ON i.created_by = creator.id
     LEFT JOIN users used ON i.used_by = used.id
     ORDER BY i.created_at DESC`
  );
  
  res.render('admin/invites', { invites });
});

router.post('/invites/create', requireAdmin, async (req, res) => {
  const code = randomBytes(8).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  await execute(
    'INSERT INTO invites (code, created_by, expires_at) VALUES (?, ?, ?)',
    [code, req.session.userId, expiresAt]
  );
  
  res.redirect('/admin/invites');
});

router.post('/invites/:id/delete', requireAdmin, async (req, res) => {
  await execute('DELETE FROM invites WHERE id = ? AND use_count < COALESCE(max_uses, 5)', [req.params.id]);
  res.redirect('/admin/invites');
});

// Lista tutti i personaggi
router.get('/characters', requireAdmin, async (req, res) => {
  const characters = await queryAll<Character & { owner_username: string; location_name: string }>(
    `SELECT c.*, u.username as owner_username, l.name as location_name
     FROM characters c
     JOIN users u ON c.user_id = u.id
     LEFT JOIN locations l ON c.current_location_id = l.id
     ORDER BY c.created_at DESC`
  );
  
  res.render('admin/characters', { characters });
});

// Modifica personaggio (admin)
router.get('/characters/:id/edit', requireAdmin, async (req, res) => {
  const character = await queryOne<Character>('SELECT * FROM characters WHERE id = ?', [req.params.id]);
  if (!character) {
    return res.status(404).render('error', { title: 'Non trovato', message: 'Personaggio non trovato' });
  }
  const owner = await queryOne<User>('SELECT * FROM users WHERE id = ?', [character.user_id]);
  const locations = await queryAll<{ id: number; name: string }>('SELECT id, name FROM locations ORDER BY name');
  res.render('admin/character-edit', { character, owner, locations, error: null });
});

router.post('/characters/:id', requireAdmin, async (req, res) => {
  const { 
    name, high_concept, trouble, avatar_url,
    careful, clever, flashy, forceful, quick, sneaky,
    fate_points, stress_1, stress_2, stress_3, 
    mild_consequence, moderate_consequence, severe_consequence,
    current_location_id
  } = req.body;
  
  await execute(
    `UPDATE characters SET 
      name = ?,
      high_concept = ?,
      trouble = ?,
      avatar_url = ?,
      careful = ?,
      clever = ?,
      flashy = ?,
      forceful = ?,
      quick = ?,
      sneaky = ?,
      fate_points = ?,
      stress_1 = ?,
      stress_2 = ?,
      stress_3 = ?,
      mild_consequence = ?,
      moderate_consequence = ?,
      severe_consequence = ?,
      current_location_id = ?
     WHERE id = ?`,
    [
      name,
      high_concept || null,
      trouble || null,
      avatar_url || null,
      parseInt(careful) || 0,
      parseInt(clever) || 0,
      parseInt(flashy) || 0,
      parseInt(forceful) || 0,
      parseInt(quick) || 0,
      parseInt(sneaky) || 0,
      parseInt(fate_points) || 0,
      stress_1 ? 1 : 0,
      stress_2 ? 1 : 0,
      stress_3 ? 1 : 0,
      mild_consequence || null,
      moderate_consequence || null,
      severe_consequence || null,
      parseInt(current_location_id) || 1,
      req.params.id
    ]
  );
  
  res.redirect(`/game/character/${req.params.id}`);
});

// Elimina personaggio
router.post('/characters/:id/delete', requireAdmin, async (req, res) => {
  await execute('DELETE FROM characters WHERE id = ?', [req.params.id]);
  res.redirect('/admin/characters');
});

// Storico messaggi per location
router.get('/messages', requireAdmin, async (req, res) => {
  const { location_id } = req.query;
  
  const locations = await queryAll<{ id: number; name: string }>('SELECT id, name FROM locations ORDER BY name');
  
  let messages: any[] = [];
  let selectedLocation = null;
  
  if (location_id) {
    selectedLocation = await queryOne<Location>('SELECT * FROM locations WHERE id = ?', [location_id]);
    messages = await queryAll<any>(
      `SELECT m.*, c.name as character_name, c.avatar_url as character_avatar, u.username
       FROM messages m
       LEFT JOIN characters c ON m.character_id = c.id
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.location_id = ?
       ORDER BY m.created_at DESC
       LIMIT 500`,
      [location_id]
    );
  }
  
  res.render('admin/messages', { locations, messages, selectedLocation });
});

// Cancella messaggio
router.post('/messages/:id/delete', requireAdmin, async (req, res) => {
  const message = await queryOne<{ location_id: number }>('SELECT location_id FROM messages WHERE id = ?', [req.params.id]);
  await execute('DELETE FROM messages WHERE id = ?', [req.params.id]);
  res.redirect(`/admin/messages${message ? `?location_id=${message.location_id}` : ''}`);
});

export default router;
