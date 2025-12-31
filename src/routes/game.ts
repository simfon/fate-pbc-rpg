import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db/database.js';
import type { Character, Location, MessageWithCharacter, CharacterWithLocation } from '../types.js';

const router = Router();

// Dashboard principale - selezione personaggio o creazione
router.get('/', async (req, res) => {
  const characters = await queryAll<CharacterWithLocation>(
    `SELECT c.*, l.name as location_name 
     FROM characters c 
     LEFT JOIN locations l ON c.current_location_id = l.id
     WHERE c.user_id = ? AND c.is_active = 1`,
    [req.session.userId!]
  );
  
  if (characters.length === 0) {
    return res.redirect('/game/character/create');
  }
  
  res.render('game/dashboard', { characters });
});

// Creazione personaggio
router.get('/character/create', (req, res) => {
  res.render('game/character-create', { error: null });
});

router.post('/character/create', async (req, res) => {
  const { name, high_concept, trouble, avatar_url, careful, clever, flashy, forceful, quick, sneaky } = req.body;
  
  if (!name || !high_concept || !trouble) {
    return res.render('game/character-create', { 
      error: 'Nome, Concetto Chiave e Problema sono obbligatori.' 
    });
  }
  
  // Valida distribuzione approcci (in FAE: +3, +2, +2, +1, +1, +0)
  const approaches = [
    parseInt(careful) || 0,
    parseInt(clever) || 0,
    parseInt(flashy) || 0,
    parseInt(forceful) || 0,
    parseInt(quick) || 0,
    parseInt(sneaky) || 0
  ].sort((a, b) => b - a);
  
  const validDistribution = [3, 2, 2, 1, 1, 0];
  const isValid = approaches.every((v, i) => v === validDistribution[i]);
  
  if (!isValid) {
    return res.render('game/character-create', { 
      error: 'Distribuzione approcci non valida. Usa: +3, +2, +2, +1, +1, +0' 
    });
  }
  
  // Get the first location as default
  const firstLocation = await queryOne<{ id: number }>('SELECT id FROM locations LIMIT 1');
  const locationId = firstLocation ? firstLocation.id : 1;
  
  await execute(
    `INSERT INTO characters (user_id, name, high_concept, trouble, avatar_url, careful, clever, flashy, forceful, quick, sneaky, current_location_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.session.userId,
      name,
      high_concept,
      trouble,
      avatar_url || null,
      parseInt(careful) || 0,
      parseInt(clever) || 0,
      parseInt(flashy) || 0,
      parseInt(forceful) || 0,
      parseInt(quick) || 0,
      parseInt(sneaky) || 0,
      locationId
    ]
  );
  
  res.redirect('/game');
});

// Vista scheda personaggio
router.get('/character/:id', async (req, res) => {
  const character = await queryOne<CharacterWithLocation>(
    `SELECT c.*, l.name as location_name 
     FROM characters c 
     LEFT JOIN locations l ON c.current_location_id = l.id
     WHERE c.id = ?`,
    [req.params.id]
  );
  
  if (!character) {
    return res.status(404).render('error', {
      title: 'Personaggio non trovato',
      message: 'Questo personaggio non esiste nei registri.'
    });
  }
  
  const isOwner = character.user_id === req.session.userId;
  const canEdit = isOwner || req.session.role === 'admin';
  
  res.render('game/character-view', { character, isOwner, canEdit });
});

// Play - la chat della locazione
router.get('/play/:characterId', async (req, res) => {
  const character = await queryOne<Character>(
    'SELECT * FROM characters WHERE id = ? AND user_id = ?',
    [req.params.characterId, req.session.userId!]
  );
  
  if (!character) {
    return res.redirect('/game');
  }
  
  const location = await queryOne<Location>(
    'SELECT * FROM locations WHERE id = ?',
    [character.current_location_id]
  );
  
  if (!location) {
    return res.redirect('/game');
  }
  
  // Connessioni
  const connections = {
    north: location.north_id ? await queryOne<{ id: number; name: string }>('SELECT id, name FROM locations WHERE id = ?', [location.north_id]) : null,
    south: location.south_id ? await queryOne<{ id: number; name: string }>('SELECT id, name FROM locations WHERE id = ?', [location.south_id]) : null,
    east: location.east_id ? await queryOne<{ id: number; name: string }>('SELECT id, name FROM locations WHERE id = ?', [location.east_id]) : null,
    west: location.west_id ? await queryOne<{ id: number; name: string }>('SELECT id, name FROM locations WHERE id = ?', [location.west_id]) : null,
  };
  
  // Personaggi presenti (solo utenti online negli ultimi 5 minuti)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
  
  const presentCharacters = await queryAll<{ id: number; name: string; avatar_url: string | null; username: string }>(
    `SELECT c.id, c.name, c.avatar_url, u.username
     FROM characters c
     JOIN users u ON c.user_id = u.id
     WHERE c.current_location_id = ? 
       AND c.is_active = 1
       AND u.last_seen > ?`,
    [location.id, fiveMinutesAgo]
  );
  
  // Ultimi messaggi
  const messages = await queryAll<MessageWithCharacter>(
    `SELECT m.*, c.name as character_name, c.avatar_url as character_avatar, u.username
     FROM messages m
     LEFT JOIN characters c ON m.character_id = c.id
     LEFT JOIN users u ON m.user_id = u.id
     WHERE m.location_id = ?
     ORDER BY m.created_at DESC
     LIMIT 50`,
    [location.id]
  );
  
  res.render('game/play', { 
    character, 
    location, 
    connections,
    presentCharacters,
    messages: messages.reverse(),
    isDestiny: req.session.role === 'destiny' || req.session.role === 'admin'
  });
});

// Spostamento
router.post('/move/:characterId/:direction', async (req, res) => {
  const { characterId, direction } = req.params;
  
  const character = await queryOne<Character>(
    'SELECT * FROM characters WHERE id = ? AND user_id = ?',
    [characterId, req.session.userId!]
  );
  
  if (!character) {
    return res.status(403).send('Non autorizzato');
  }
  
  const location = await queryOne<Location>(
    'SELECT * FROM locations WHERE id = ?',
    [character.current_location_id]
  );
  
  if (!location) {
    return res.status(400).send('Locazione non trovata');
  }
  
  let newLocationId: number | null = null;
  switch (direction) {
    case 'north': newLocationId = location.north_id; break;
    case 'south': newLocationId = location.south_id; break;
    case 'east': newLocationId = location.east_id; break;
    case 'west': newLocationId = location.west_id; break;
  }
  
  if (!newLocationId) {
    return res.status(400).send('Direzione non valida');
  }
  
  await execute(
    'UPDATE characters SET current_location_id = ? WHERE id = ?',
    [newLocationId, characterId]
  );
  
  res.redirect(`/game/play/${characterId}`);
});

export default router;
