const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

let db;

// Helper para parsear las filas de la base de datos de forma consistente.
function _parseRow(row) {
    if (!row) return null;
    return {
        ...row,
        params: JSON.parse(row.params || '{}'),
        history: JSON.parse(row.history || '[]'),
        isActive: !!row.isActive, // Convertir 0/1 a booleano
        questionsAsked: row.questionsAsked || 0,
    };
}

/**
 * Inicializa la base de datos y crea la tabla de conversaciones si no existe.
 */
function initializeDatabase(dbPath = './archssistant.db') {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('[DB] Error al abrir la base de datos', err.message);
                return reject(err);
            }
            console.log('[DB] Conectado a la base de datos SQLite.');

            const createTableSql = `CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                params TEXT,
                history TEXT,
                state TEXT,
                isActive INTEGER DEFAULT 1,
                questionsAsked INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`

            db.run(createTableSql, (err) => {
                if (err) return reject(err);
                console.log('[DB] Tabla \'conversations\' asegurada.');

                // Migración: Añadir columna 'questionsAsked' si no existe.
                db.all("PRAGMA table_info(conversations)", (err, columns) => {
                    if (err) {
                        console.error('[DB] Error al leer información de la tabla:', err.message);
                        return reject(err);
                    }

                    const columnExists = columns.some(c => c.name === 'questionsAsked');
                    if (!columnExists) {
                        console.log('[DB] Migrando base de datos: añadiendo columna \'questionsAsked\'.');
                        db.run("ALTER TABLE conversations ADD COLUMN questionsAsked INTEGER DEFAULT 0", (alterErr) => {
                            if (alterErr) {
                                console.error('[DB] Error al añadir columna \'questionsAsked\':', alterErr.message);
                                return reject(alterErr);
                            }
                            console.log('[DB] Columna \'questionsAsked\' añadida correctamente.');
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        });
    });
}

/**
 * Crea una nueva conversación para un usuario.
 * @param {string} userId - El ID del usuario.
 * @returns {Promise<Object>} La conversación recién creada.
 */
function createConversation(userId) {
    return new Promise((resolve, reject) => {
        const newConversation = {
            id: uuidv4(),
            userId,
            params: JSON.stringify({}), // Inicia vacío, se llena en el flujo
            history: JSON.stringify([]),
            state: 'initial',
            isActive: 1,
            questionsAsked: 0,
        };

        const sql = `INSERT INTO conversations (id, userId, params, history, state, isActive, questionsAsked) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const sqlParams = [newConversation.id, newConversation.userId, newConversation.params, newConversation.history, newConversation.state, newConversation.isActive, newConversation.questionsAsked];
        
        db.run(sql, sqlParams, function(err) {
            if (err) return reject(err);
            getConversation(newConversation.id).then(resolve).catch(reject);
        });
    });
}

/**
 * Obtiene una conversación por su ID.
 * @param {string} conversationId - El ID de la conversación.
 * @returns {Promise<Object|null>} La conversación encontrada o null.
 */
function getConversation(conversationId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM conversations WHERE id = ?', [conversationId], (err, row) => {
            if (err) return reject(err);
            resolve(_parseRow(row));
        });
    });
}

/**
 * Obtiene todas las conversaciones de un usuario.
 * @param {string} userId - El ID del usuario.
 * @returns {Promise<Array<Object>>} Una lista de conversaciones.
 */
function getConversations(userId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM conversations WHERE userId = ? ORDER BY updatedAt DESC`;
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            // Mapear y parsear cada fila.
            const parsedRows = rows.map(row => _parseRow(row));
            resolve(parsedRows);
        });
    });
}

/**
 * Obtiene la única conversación activa de un usuario.
 * @param {string} userId - El ID del usuario.
 * @returns {Promise<Object|null>} La conversación activa o null.
 */
function getActiveConversation(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM conversations WHERE userId = ? AND isActive = 1 ORDER BY updatedAt DESC LIMIT 1', [userId], (err, row) => {
            if (err) return reject(err);
            resolve(_parseRow(row));
        });
    });
}

/**
 * Guarda el estado de una conversación existente.
 * @param {Object} conversation - El objeto de la conversación a guardar.
 */
function saveConversation(conversation) {
    return new Promise((resolve, reject) => {
        const { id, params, history, state, isActive, questionsAsked } = conversation;
        const sql = `UPDATE conversations SET params = ?, history = ?, state = ?, isActive = ?, questionsAsked = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`;
        const sqlParams = [JSON.stringify(params), JSON.stringify(history), state, isActive ? 1 : 0, questionsAsked || 0, id];
        
        db.run(sql, sqlParams, function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Archiva una conversación específica.
 * @param {string} conversationId - El ID de la conversación a archivar.
 */
function archiveConversation(conversationId) {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE conversations SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
        db.run(sql, [conversationId], function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
}

/**
 * Desarchiva una conversación, convirtiéndola en la única activa para el usuario.
 * @param {string} conversationId - El ID de la conversación a desarchivar.
 * @param {string} userId - El ID del usuario propietario.
 */
async function unarchiveConversation(conversationId, userId) {
    // Inicia una transacción para asegurar la atomicidad de la operación.
    await new Promise((res, rej) => db.run('BEGIN', (e) => e ? rej(e) : res()));
    try {
        // 1. Archiva todas las conversaciones del usuario.
        const archiveSql = 'UPDATE conversations SET isActive = 0 WHERE userId = ?';
        await new Promise((res, rej) => db.run(archiveSql, [userId], (e) => e ? rej(e) : res()));

        // 2. Activa solo la conversación deseada.
        const unarchiveSql = 'UPDATE conversations SET isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?';
        await new Promise((res, rej) => db.run(unarchiveSql, [conversationId, userId], (e) => e ? rej(e) : res()));

        // Confirma la transacción.
        await new Promise((res, rej) => db.run('COMMIT', (e) => e ? rej(e) : res()));
    } catch (error) {
        // Si algo falla, revierte todos los cambios.
        console.error('[DB] Error en la transacción de desarchivado, revirtiendo cambios:', error);
        await new Promise((res, rej) => db.run('ROLLBACK', (e) => e ? rej(e) : res()));
        throw error; // Propaga el error.
    }
}

module.exports = {
    initializeDatabase,
    createConversation,
    getConversation,
    getConversations,
    getActiveConversation,
    saveConversation,
    archiveConversation,
    unarchiveConversation,
};
