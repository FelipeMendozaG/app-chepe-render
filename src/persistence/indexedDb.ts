import {
  isPrimitiveEntity,
  validateProjectName,
  type DisplayUnit,
  type ProjectDocument,
} from '../domain';

export interface StoredProjectSummary {
  id: string;
  name: string;
  description: string;
  displayUnit: DisplayUnit;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRepository {
  saveProject(doc: ProjectDocument): Promise<ProjectDocument>;
  listProjects(): Promise<StoredProjectSummary[]>;
  loadProject(id: string): Promise<ProjectDocument | null>;
  renameProject(id: string, newName: string): Promise<boolean>;
  deleteProject(id: string): Promise<void>;
}

const DB_NAME = 'app-render-chepita-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

interface StoredProjectRecord {
  id: string;
  updatedAt: string;
  document: ProjectDocument;
}

export function summarizeDocument(doc: ProjectDocument): StoredProjectSummary {
  return {
    id: doc.project.id,
    name: doc.project.name,
    description: doc.project.description,
    displayUnit: doc.project.displayUnit,
    entityCount: doc.entities.filter(isPrimitiveEntity).length,
    createdAt: doc.project.createdAt,
    updatedAt: doc.project.updatedAt,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este entorno.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ??
          new Error('No se pudo abrir la base de datos local IndexedDB.'),
      );
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = operation(store);

        let resultValue: T;
        req.onsuccess = () => {
          resultValue = req.result;
        };
        req.onerror = () => {
          reject(req.error ?? new Error('Error en operación de IndexedDB.'));
        };

        tx.oncomplete = () => {
          db.close();
          resolve(resultValue);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Error en transacción de IndexedDB.'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('Transacción de IndexedDB cancelada.'));
        };
      }),
  );
}

export const indexedDbProjectRepository: ProjectRepository = {
  async saveProject(doc: ProjectDocument): Promise<ProjectDocument> {
    const nameError = validateProjectName(doc.project.name);
    if (nameError) {
      throw new Error(nameError.message);
    }

    const now = new Date().toISOString();
    const cloned = structuredClone(doc);
    cloned.project.name = cloned.project.name.trim();
    cloned.project.updatedAt = now;

    const record: StoredProjectRecord = {
      id: cloned.project.id,
      updatedAt: now,
      document: cloned,
    };

    await runTransaction('readwrite', (store) => store.put(record));
    return cloned;
  },

  async listProjects(): Promise<StoredProjectSummary[]> {
    const records = await runTransaction<StoredProjectRecord[]>(
      'readonly',
      (store) => store.getAll(),
    );
    return records
      .map((rec) => summarizeDocument(rec.document))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async loadProject(id: string): Promise<ProjectDocument | null> {
    const record = await runTransaction<StoredProjectRecord | undefined>(
      'readonly',
      (store) => store.get(id),
    );
    return record ? structuredClone(record.document) : null;
  },

  async renameProject(id: string, newName: string): Promise<boolean> {
    if (validateProjectName(newName)) return false;
    const existing = await this.loadProject(id);
    if (!existing) return false;

    existing.project.name = newName.trim();
    await this.saveProject(existing);
    return true;
  },

  async deleteProject(id: string): Promise<void> {
    await runTransaction('readwrite', (store) => store.delete(id));
  },
};

export function createMemoryProjectRepository(): ProjectRepository {
  const map = new Map<string, StoredProjectRecord>();

  return {
    async saveProject(doc: ProjectDocument): Promise<ProjectDocument> {
      const nameError = validateProjectName(doc.project.name);
      if (nameError) {
        throw new Error(nameError.message);
      }
      const now = new Date().toISOString();
      const cloned = structuredClone(doc);
      cloned.project.name = cloned.project.name.trim();
      cloned.project.updatedAt = now;
      map.set(cloned.project.id, {
        id: cloned.project.id,
        updatedAt: now,
        document: cloned,
      });
      return structuredClone(cloned);
    },

    async listProjects(): Promise<StoredProjectSummary[]> {
      return [...map.values()]
        .map((rec) => summarizeDocument(rec.document))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async loadProject(id: string): Promise<ProjectDocument | null> {
      const rec = map.get(id);
      return rec ? structuredClone(rec.document) : null;
    },

    async renameProject(id: string, newName: string): Promise<boolean> {
      if (validateProjectName(newName)) return false;
      const existing = map.get(id);
      if (!existing) return false;
      const updated = structuredClone(existing.document);
      updated.project.name = newName.trim();
      await this.saveProject(updated);
      return true;
    },

    async deleteProject(id: string): Promise<void> {
      map.delete(id);
    },
  };
}
