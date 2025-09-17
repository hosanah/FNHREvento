-- Schema for SQLite database
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar hóspedes importados de planilhas
CREATE TABLE IF NOT EXISTS hospedes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT,
  apto TEXT,
  nome_completo TEXT,
  endereco TEXT,
  estado TEXT,
  email TEXT,
  profissao TEXT,
  cidade TEXT,
  identidade TEXT,
  cpf TEXT,
  telefone TEXT,
  pais TEXT,
  cep TEXT,
  data_nascimento TEXT,
  sexo TEXT,
  entrada TEXT,
  saida TEXT,
  status TEXT,
  idhospede TEXT,
  idreservasfront TEXT
);
