import { createClient, Client, Row } from '@libsql/client';

let client: Client | null = null;

export async function initDatabase(): Promise<Client> {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    // Fallback to local file for development
    client = createClient({
      url: 'file:cronache.db',
    });
    console.log('📁 Using local SQLite database: cronache.db');
  } else {
    client = createClient({
      url,
      authToken,
    });
    console.log('☁️  Connected to Turso database');
  }

  return client;
}

export function getDb(): Client {
  if (!client) {
    throw new Error('Database non inizializzato. Chiama initDatabase() prima.');
  }
  return client;
}

// Helper: convert Row to plain object
function rowToObject<T>(row: Row): T {
  const obj: Record<string, unknown> = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      obj[key] = row[key];
    }
  }
  return obj as T;
}

// Query single row
export async function queryOne<T>(sql: string, args: unknown[] = []): Promise<T | undefined> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  if (result.rows.length === 0) return undefined;
  return rowToObject<T>(result.rows[0]);
}

// Query multiple rows
export async function queryAll<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return result.rows.map(row => rowToObject<T>(row));
}

// Execute INSERT/UPDATE/DELETE
export async function execute(sql: string, args: unknown[] = []): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const db = getDb();
  const result = await db.execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    rowsAffected: result.rowsAffected,
  };
}

// Execute raw SQL (for schema/migrations)
export async function execRaw(sql: string): Promise<void> {
  const db = getDb();
  await db.execute(sql);
}

// Execute multiple statements in a batch
export async function execBatch(statements: string[]): Promise<void> {
  const db = getDb();
  await db.batch(statements.map(sql => ({ sql, args: [] })));
}
