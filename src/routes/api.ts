import { Router } from 'express';
import { queryOne, queryAll, execute } from '../db/database.js';
import type { Character, MessageWithCharacter } from '../types.js';

const router = Router();

// Invia messaggio in chat
router.post('/message', async (req, res) => {
  const { character_id, location_id, content, is_action, is_ooc, is_destiny: destinyMsg } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).send('Messaggio vuoto');
  }
  
  // Verifica che il personaggio appartenga all'utente (o sia admin/destiny per messaggi del destino)
  let characterId = character_id;
  let isDestiny = false;
  let isAction = is_action === 'on';
  let isOoc = is_ooc === 'on';
  
  if (destinyMsg === 'on') {
    if (req.session.role !== 'admin' && req.session.role !== 'destiny') {
      return res.status(403).send('Non autorizzato');
    }
    isDestiny = true;
    characterId = null;
    isAction = false;
    isOoc = false;
  } else {
    const character = await queryOne<Character>(
      'SELECT * FROM characters WHERE id = ? AND user_id = ?',
      [character_id, req.session.userId]
    );
    
    if (!character) {
      return res.status(403).send('Personaggio non valido');
    }
  }
  
  await execute(
    `INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [location_id, characterId, req.session.userId, content.trim(), isAction ? 1 : 0, isDestiny ? 1 : 0, isOoc ? 1 : 0]
  );
  
  // Ritorna alla pagina precedente
  res.redirect('back');
});

// Polling messaggi (per HTMX)
router.get('/messages/:locationId', async (req, res) => {
  const { after } = req.query;
  
  // Only show messages from the last hour, max 25
  // Format date to match SQLite's CURRENT_TIMESTAMP format (YYYY-MM-DD HH:MM:SS)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
  
  let query = `
    SELECT m.*, c.name as character_name, c.avatar_url as character_avatar, u.username
    FROM messages m
    LEFT JOIN characters c ON m.character_id = c.id
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.location_id = ? AND m.created_at > ?
  `;
  
  const params: (string | number)[] = [req.params.locationId, oneHourAgo];
  
  if (after && after !== '0') {
    // Polling for new messages after a specific ID
    query += ` AND m.id > ?`;
    params.push(after as string);
  }
  
  // Order by time descending and limit to 25, then reverse for chronological display
  query += ` ORDER BY m.created_at DESC LIMIT 25`;
  
  const messages = await queryAll<MessageWithCharacter>(query, params);
  
  res.render('partials/messages', { messages: messages.reverse(), layout: false });
});

// Personaggi presenti in una locazione (solo utenti online negli ultimi 5 minuti)
router.get('/present/:locationId', async (req, res) => {
  // Considera online gli utenti attivi negli ultimi 5 minuti
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '');
  
  const characters = await queryAll<{ id: number; name: string; avatar_url: string | null; username: string }>(
    `SELECT c.id, c.name, c.avatar_url, u.username
     FROM characters c
     JOIN users u ON c.user_id = u.id
     WHERE c.current_location_id = ? 
       AND c.is_active = 1
       AND u.last_seen > ?`,
    [req.params.locationId, fiveMinutesAgo]
  );
  
  res.render('partials/present-characters', { presentCharacters: characters, layout: false });
});

// Aggiorna punti fato (per il proprio personaggio)
router.post('/character/:id/fate', async (req, res) => {
  const { action, location_id } = req.body;
  const character = await queryOne<Character>(
    'SELECT * FROM characters WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId]
  );
  
  if (!character) {
    return res.status(403).send('Non autorizzato');
  }
  
  let newPoints = character.fate_points;
  let message = '';
  
  if (action === 'spend' && newPoints > 0) {
    newPoints--;
    message = `✨ ${character.name} spende un Punto Fato (${newPoints} rimasti)`;
  } else if (action === 'gain') {
    newPoints++;
    message = `✨ ${character.name} guadagna un Punto Fato (${newPoints} totali)`;
  }
  
  if (message && location_id) {
    await execute('UPDATE characters SET fate_points = ? WHERE id = ?', [newPoints, req.params.id]);
    await execute(
      `INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
       VALUES (?, ?, ?, ?, 1, 0, 0)`,
      [location_id, character.id, req.session.userId, message]
    );
  }
  
  res.redirect('back');
});

// Toggle stress
router.post('/character/:id/stress/:box', async (req, res) => {
  const { location_id } = req.body;
  const character = await queryOne<Character>(
    'SELECT * FROM characters WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.userId]
  );
  
  if (!character) {
    return res.status(403).send('Non autorizzato');
  }
  
  const boxNum = parseInt(req.params.box);
  const boxField = `stress_${boxNum}` as 'stress_1' | 'stress_2' | 'stress_3';
  const currentValue = character[boxField];
  const newValue = currentValue ? 0 : 1;
  
  await execute(`UPDATE characters SET ${boxField} = ? WHERE id = ?`, [newValue, req.params.id]);
  
  if (location_id) {
    const message = newValue 
      ? `💢 ${character.name} subisce stress (box ${boxNum})` 
      : `💚 ${character.name} recupera stress (box ${boxNum})`;
    await execute(
      `INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
       VALUES (?, ?, ?, ?, 1, 0, 0)`,
      [location_id, character.id, req.session.userId, message]
    );
  }
  
  res.redirect('back');
});

// Tiro di dado Fate (4dF)
router.post('/roll', async (req, res) => {
  const { character_id, approach, location_id, modifier } = req.body;
  
  const character = await queryOne<Character>(
    'SELECT * FROM characters WHERE id = ? AND user_id = ?',
    [character_id, req.session.userId]
  );
  
  if (!character) {
    return res.status(403).send('Non autorizzato');
  }
  
  // 4dF: ogni dado è -1, 0, o +1
  const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 3) - 1);
  const diceTotal = dice.reduce((a, b) => a + b, 0);
  const approachValue = character[approach as keyof Character] as number;
  const mod = parseInt(modifier) || 0;
  const total = diceTotal + approachValue + mod;
  
  const approachNames: Record<string, string> = {
    careful: 'Cauto',
    clever: 'Ingegnoso',
    flashy: 'Appariscente',
    forceful: 'Vigoroso',
    quick: 'Rapido',
    sneaky: 'Furtivo'
  };
  
  // Formato strutturato per parsing nel frontend
  const content = `🎲 ROLL|${approach}|${dice.join(',')}|${diceTotal}|${approachValue}|${mod}|${total}|${approachNames[approach]}`;
  
  await execute(
    `INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
     VALUES (?, ?, ?, ?, 1, 0, 0)`,
    [location_id, character_id, req.session.userId, content]
  );
  
  res.redirect('back');
});

export default router;
