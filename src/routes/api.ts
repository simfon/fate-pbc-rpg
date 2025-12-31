import { Router } from 'express';
import { getDb } from '../db/database.js';
import type { Character, MessageWithCharacter } from '../types.js';

const router = Router();

// Invia messaggio in chat
router.post('/message', (req, res) => {
  const db = getDb();
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
    const character = db.prepare(`
      SELECT * FROM characters WHERE id = ? AND user_id = ?
    `).get(character_id, req.session.userId) as Character | undefined;
    
    if (!character) {
      return res.status(403).send('Personaggio non valido');
    }
  }
  
  db.prepare(`
    INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(location_id, characterId, req.session.userId, content.trim(), isAction ? 1 : 0, isDestiny ? 1 : 0, isOoc ? 1 : 0);
  
  // Ritorna alla pagina precedente
  res.redirect('back');
});

// Polling messaggi (per HTMX)
router.get('/messages/:locationId', (req, res) => {
  const db = getDb();
  const { after } = req.query;
  
  // Check if we have recent messages (within last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentCount = (db.prepare(`
    SELECT COUNT(*) as count FROM messages 
    WHERE location_id = ? AND created_at > ?
  `).get(req.params.locationId, oneHourAgo) as { count: number }).count;
  
  let query = `
    SELECT m.*, c.name as character_name, c.avatar_url as character_avatar, u.username
    FROM messages m
    LEFT JOIN characters c ON m.character_id = c.id
    LEFT JOIN users u ON m.user_id = u.id
    WHERE m.location_id = ?
  `;
  
  const params: (string | number)[] = [req.params.locationId];
  
  if (after && after !== '0') {
    // Polling for new messages
    query += ` AND m.id > ?`;
    params.push(after as string);
    query += ` ORDER BY m.created_at ASC`;
  } else {
    // Initial load - limit to last 25 if no recent activity
    if (recentCount === 0) {
      query += ` ORDER BY m.created_at DESC LIMIT 25`;
      const messages = db.prepare(query).all(...params) as unknown as MessageWithCharacter[];
      return res.render('partials/messages', { messages: messages.reverse(), layout: false });
    } else {
      // Show all messages from last hour
      query += ` AND m.created_at > ?`;
      params.push(oneHourAgo);
      query += ` ORDER BY m.created_at ASC`;
    }
  }
  
  const messages = db.prepare(query).all(...params) as unknown as MessageWithCharacter[];
  
  res.render('partials/messages', { messages, layout: false });
});

// Personaggi presenti in una locazione
router.get('/present/:locationId', (req, res) => {
  const db = getDb();
  const characters = db.prepare(`
    SELECT c.id, c.name, c.avatar_url, u.username
    FROM characters c
    JOIN users u ON c.user_id = u.id
    WHERE c.current_location_id = ? AND c.is_active = 1
  `).all(req.params.locationId);
  
  res.render('partials/present-characters', { presentCharacters: characters, layout: false });
});

// Aggiorna punti fato (per il proprio personaggio)
router.post('/character/:id/fate', (req, res) => {
  const db = getDb();
  const { action, location_id } = req.body;
  const character = db.prepare(`
    SELECT * FROM characters WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.session.userId) as Character | undefined;
  
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
    db.prepare('UPDATE characters SET fate_points = ? WHERE id = ?').run(newPoints, req.params.id);
    db.prepare(`
      INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
      VALUES (?, ?, ?, ?, 1, 0, 0)
    `).run(location_id, character.id, req.session.userId, message);
  }
  
  res.redirect('back');
});

// Toggle stress
router.post('/character/:id/stress/:box', (req, res) => {
  const db = getDb();
  const { location_id } = req.body;
  const character = db.prepare(`
    SELECT * FROM characters WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.session.userId) as Character | undefined;
  
  if (!character) {
    return res.status(403).send('Non autorizzato');
  }
  
  const boxNum = parseInt(req.params.box);
  const boxField = `stress_${boxNum}` as 'stress_1' | 'stress_2' | 'stress_3';
  const currentValue = character[boxField];
  const newValue = currentValue ? 0 : 1;
  
  db.prepare(`UPDATE characters SET ${boxField} = ? WHERE id = ?`).run(newValue, req.params.id);
  
  if (location_id) {
    const message = newValue 
      ? `💢 ${character.name} subisce stress (box ${boxNum})` 
      : `💚 ${character.name} recupera stress (box ${boxNum})`;
    db.prepare(`
      INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
      VALUES (?, ?, ?, ?, 1, 0, 0)
    `).run(location_id, character.id, req.session.userId, message);
  }
  
  res.redirect('back');
});

// Tiro di dado Fate (4dF)
router.post('/roll', (req, res) => {
  const db = getDb();
  const { character_id, approach, location_id, modifier } = req.body;
  
  const character = db.prepare(`
    SELECT * FROM characters WHERE id = ? AND user_id = ?
  `).get(character_id, req.session.userId) as Character | undefined;
  
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
  
  // Simboli dei dadi Fate più espressivi
  const diceSymbols = dice.map(d => d === -1 ? '⊟' : d === 1 ? '⊞' : '⊡').join('');
  const sign = approachValue >= 0 ? '+' : '';
  const modStr = mod !== 0 ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : '';
  
  // Formato strutturato per parsing nel frontend
  const content = `🎲 ROLL|${approach}|${dice.join(',')}|${diceTotal}|${approachValue}|${mod}|${total}|${approachNames[approach]}`;
  
  db.prepare(`
    INSERT INTO messages (location_id, character_id, user_id, content, is_action, is_destiny, is_ooc)
    VALUES (?, ?, ?, ?, 1, 0, 0)
  `).run(location_id, character_id, req.session.userId, content);
  
  res.redirect('back');
});

export default router;
