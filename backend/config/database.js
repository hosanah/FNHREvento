/**
 * Configuração do banco de dados PostgreSQL
 * Inclui inicialização e operações básicas
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

let pool = null;

function getConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'tematico',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  };
}

/**
 * Conectar ao banco de dados PostgreSQL
 */
async function connectDatabase() {
  pool = new Pool(getConfig());
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conectado ao banco de dados PostgreSQL');
  } catch (err) {
    console.error('❌ Erro ao conectar com o banco de dados:', err.message);
    throw err;
  }
}

/**
 * Converter placeholders estilo `?` para `$1, $2, ...`
 */
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Criar tabelas necessárias carregando o schema do projeto
 */
async function createTables() {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('✅ Tabelas criadas/verificadas');
}

/**
 * Criar usuário padrão para testes
 */
async function createDefaultUser() {
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
  if (rows.length > 0) {
    console.log('✅ Usuário admin já existe');
    return;
  }
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await pool.query(
    'INSERT INTO users (username, email, password, full_name) VALUES ($1, $2, $3, $4)',
    ['admin', 'admin@example.com', hashedPassword, 'Administrador']
  );
  console.log('✅ Usuário admin criado com sucesso');
  console.log('📧 Email: admin@example.com');
  console.log('🔑 Senha: admin123');
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
  if (!pool) {
    throw new Error('Banco de dados não inicializado');
  }
  return {
    async query(sql, params) {
      return pool.query(convertPlaceholders(sql), params);
    },
    get(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool
        .query(convertPlaceholders(sql), params)
        .then(res => callback(null, res.rows[0]))
        .catch(err => callback(err));
    },
    all(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool
        .query(convertPlaceholders(sql), params)
        .then(res => callback(null, res.rows))
        .catch(err => callback(err));
    },
    run(sql, params, callback) {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      pool
        .query(convertPlaceholders(sql), params)
        .then(res => {
          const ctx = { lastID: res.rows[0]?.id, changes: res.rowCount };
          if (callback) callback.call(ctx, null);
        })
        .catch(err => callback(err));
    }
  };
}

/**
 * Fechar conexão com banco de dados
 */
function closeDatabase() {
  return pool ? pool.end() : Promise.resolve();
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  connectDatabase,
  createTables,
  createDefaultUser
};
