// Tipi per il database e l'applicazione

export type UserRole = 'player' | 'destiny' | 'admin';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  is_banned: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface Character {
  id: number;
  user_id: number;
  name: string;
  high_concept: string;      // Concetto Chiave
  trouble: string;           // Problema
  aspect_1: string | null;   // Aspetto aggiuntivo
  aspect_2: string | null;
  aspect_3: string | null;
  
  // I 6 Approcci di Fate Accelerated (valori da +0 a +3)
  careful: number;    // Cauto
  clever: number;     // Ingegnoso  
  flashy: number;     // Appariscente
  forceful: number;   // Vigoroso
  quick: number;      // Rapido
  sneaky: number;     // Furtivo
  
  fate_points: number;
  stress_1: boolean;
  stress_2: boolean;
  stress_3: boolean;
  
  mild_consequence: string | null;      // Conseguenza Lieve (-2)
  moderate_consequence: string | null;  // Conseguenza Moderata (-4)
  severe_consequence: string | null;    // Conseguenza Grave (-6)
  
  current_location_id: number;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  north_id: number | null;
  south_id: number | null;
  east_id: number | null;
  west_id: number | null;
  is_public: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  location_id: number;
  character_id: number | null;  // null = messaggio del Destino
  user_id: number;
  content: string;
  is_action: boolean;           // *azione* vs dialogo
  is_destiny: boolean;          // Messaggio del Destino (anonimo)
  is_ooc: boolean;              // Out of Character
  created_at: string;
}

export interface Invite {
  id: number;
  code: string;
  created_by: number;
  used_by: number | null;  // Manteniamo per compatibilità
  use_count: number;
  max_uses: number;
  expires_at: string;
  created_at: string;
}

// View types con join
export interface MessageWithCharacter extends Message {
  character_name: string | null;
  character_avatar: string | null;
  username: string;
}

export interface CharacterWithLocation extends Character {
  location_name: string;
}

// Session type
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: UserRole;
  }
}
