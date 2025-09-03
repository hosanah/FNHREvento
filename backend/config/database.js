/**
 * Configuração do banco de dados SQLite
 * Inclui inicialização e operações básicas
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

let db = null;

function getConfig() {
  return {
    filename: process.env.DB_FILE || path.join(__dirname, '../database/database.sqlite')
  };
}

/**
 * Conectar ao banco de dados SQLite
 */
async function connectDatabase() {
  const config = getConfig();
  await new Promise((resolve, reject) => {
    db = new sqlite3.Database(config.filename, err => {
      if (err) {
        console.error('❌ Erro ao conectar com o banco de dados:', err.message);
        reject(err);
      } else {
        db.run('PRAGMA foreign_keys = ON');
        console.log('✅ Conectado ao banco de dados SQLite');
        resolve();
      }
    });
  });
}

/**
 * Criar tabelas necessárias carregando o schema do projeto
 */
async function createTables() {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await new Promise((resolve, reject) => {
    db.exec(schema, err => {
      if (err) return reject(err);
      resolve();
    });
  });
  console.log('✅ Tabelas criadas/verificadas');
}

/**
 * Criar usuário padrão para testes
 */
async function createDefaultUser() {
  await new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], async (err, row) => {
      if (err) {
        console.error('❌ Erro ao verificar usuário padrão:', err.message);
        return reject(err);
      }
      if (row) {
        console.log('✅ Usuário admin já existe');
        return resolve();
      }
      const hashedPassword = await bcrypt.hash('admin123', 12);
      db.run(
        'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@example.com', hashedPassword, 'Administrador'],
        function(err) {
          if (err) return reject(err);
          console.log('✅ Usuário admin criado com sucesso');
          console.log('📧 Email: admin@example.com');
          console.log('🔑 Senha: admin123');
          resolve();
        }
      );
    });
  });
}

/**
 * Inicializar banco de dados
 */
async function initDatabase() {
  await connectDatabase();
  await createTables();
  await createDefaultUser();
  console.log('🎉 Banco de dados inicializado completamente');
}

/**
 * Obter objeto de acesso ao banco
 */
function getDatabase() {
  if (!db) {
    throw new Error('Banco de dados não inicializado');
  }
  return {
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        const isSelect = /^\s*SELECT/i.test(sql);
        if (isSelect) {
          db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve({ rows, rowCount: rows.length });
          });
        } else {
          db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
          });
        }
      });
    },
    get(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      db.get(sql, params, (err, row) => callback(err, row));
    },
    all(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      db.all(sql, params, (err, rows) => callback(err, rows));
    },
    run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      db.run(sql, params, function(err) {
        if (callback) callback.call(this, err);
      });
    }
  };
}

/**
 * Fechar conexão com banco de dados
 */
function closeDatabase() {
  return db
    ? new Promise((resolve, reject) => {
        db.close(err => {
          if (err) return reject(err);
          resolve();
        });
      })
    : Promise.resolve();
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  connectDatabase,
  createTables,
  createDefaultUser
};

