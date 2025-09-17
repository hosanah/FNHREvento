'use strict';

/**
 * Utilitários de configuração do banco SQLite
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

let sqliteDb = null;

function getSqliteConfig() {
  return {
    filename: process.env.DB_FILE || path.join(__dirname, '../database/database.sqlite')
  };
}

async function connectSqliteDatabase() {
  if (sqliteDb) {
    return sqliteDb;
  }

  const config = getSqliteConfig();
  await new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(config.filename, err => {
      if (err) {
        console.error('❌ Erro ao conectar com o banco de dados SQLite:', err.message);
        reject(err);
      } else {
        sqliteDb.run('PRAGMA foreign_keys = ON');
        console.log('✅ Conectado ao banco de dados SQLite');
        resolve(sqliteDb);
      }
    });
  });

  return sqliteDb;
}

async function createSqliteTables() {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  await new Promise((resolve, reject) => {
    sqliteDb.exec(schema, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  console.log('✅ Tabelas SQLite criadas/verificadas');
}

async function createSqliteDefaultUser() {
  await new Promise((resolve, reject) => {
    sqliteDb.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
      if (err) {
        console.error('❌ Erro ao verificar usuário padrão:', err.message);
        return reject(err);
      }

      if (row) {
        console.log('✅ Usuário admin já existe');
        return resolve();
      }

      try {
        const hashedPassword = await bcrypt.hash('admin123', 12);
        sqliteDb.run(
          'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
          ['admin', 'admin@example.com', hashedPassword, 'Administrador'],
          function(err) {
            if (err) {
              reject(err);
            } else {
              console.log('✅ Usuário admin criado com sucesso');
              console.log('📧 Email: admin@example.com');
              console.log('🔑 Senha: admin123');
              resolve();
            }
          }
        );
      } catch (hashError) {
        reject(hashError);
      }
    });
  });
}

async function initSqliteDatabase() {
  await connectSqliteDatabase();
  await createSqliteTables();
  await createSqliteDefaultUser();
  console.log('🎉 Banco de dados SQLite inicializado completamente');
}

function createQueryHelpers(database) {
  return {
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        const isSelect = /^\s*SELECT/i.test(sql);
        if (isSelect) {
          database.all(sql, params, (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve({ rows, rowCount: rows.length });
            }
          });
        } else {
          database.run(sql, params, function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
            }
          });
        }
      });
    },
    get(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      database.get(sql, params, (err, row) => callback(err, row));
    },
    all(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      database.all(sql, params, (err, rows) => callback(err, rows));
    },
    run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      database.run(sql, params, function(err) {
        if (callback) {
          callback.call(this, err);
        }
      });
    }
  };
}

function getSqliteDb() {
  if (!sqliteDb) {
    throw new Error('Banco de dados SQLite não inicializado');
  }
  return createQueryHelpers(sqliteDb);
}

async function closeSqliteDatabase() {
  if (!sqliteDb) {
    return;
  }

  await new Promise((resolve, reject) => {
    sqliteDb.close(err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  sqliteDb = null;
  console.log('✅ Conexão com SQLite encerrada');
}

module.exports = {
  initSqliteDatabase,
  getSqliteDb,
  closeSqliteDatabase,
  connectSqliteDatabase,
  createSqliteTables,
  createSqliteDefaultUser,
  // aliases legacy
  initDatabase: initSqliteDatabase,
  getDatabase: getSqliteDb,
  closeDatabase: closeSqliteDatabase,
  connectDatabase: connectSqliteDatabase,
  createTables: createSqliteTables,
  createDefaultUser: createSqliteDefaultUser
};
