import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../cronache.db');

// Wrapper per compatibilità con l'API better-sqlite3
export class DatabaseWrapper {
  private db: SqlJsDatabase;
  private dbPath: string;
  
  constructor(database: SqlJsDatabase, dbPath: string) {
    this.db = database;
    this.dbPath = dbPath;
  }
  
  prepare(sql: string) {
    const db = this.db;
    const saveFn = () => this.save();
    
    return {
      run(...params: unknown[]) {
        db.run(sql, params as (string | number | null | Uint8Array)[]);
        const lastIdResult = db.exec('SELECT last_insert_rowid()');
        const lastId = lastIdResult[0]?.values[0]?.[0] as number || 0;
        const changes = db.getRowsModified();
        saveFn();
        return { lastInsertRowid: lastId, changes };
      },
      get(...params: unknown[]) {
        const stmt = db.prepare(sql);
        stmt.bind(params as (string | number | null | Uint8Array)[]);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params: unknown[]) {
        const stmt = db.prepare(sql);
        stmt.bind(params as (string | number | null | Uint8Array)[]);
        const results: Record<string, unknown>[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
  
  exec(sql: string) {
    this.db.exec(sql);
    this.save();
  }
  
  save() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
  }
  
  pragma(pragma: string) {
    try {
      this.db.exec(`PRAGMA ${pragma}`);
    } catch {
      // Ignora errori pragma
    }
  }
  
  close() {
    this.db.close();
  }
}

// Variabile globale per il database
let dbInstance: DatabaseWrapper | null = null;

// Funzione async per inizializzare il database
export async function initDatabase(): Promise<DatabaseWrapper> {
  if (dbInstance) return dbInstance;
  
  const SQL = await initSqlJs();
  
  let database: SqlJsDatabase;
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    database = new SQL.Database(buffer);
  } else {
    database = new SQL.Database();
  }
  
  dbInstance = new DatabaseWrapper(database, dbPath);
  return dbInstance;
}

// Getter sincrono per uso dopo l'inizializzazione
export function getDb(): DatabaseWrapper {
  if (!dbInstance) {
    throw new Error('Database non inizializzato. Chiama initDatabase() prima.');
  }
  return dbInstance;
}
