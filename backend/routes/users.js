const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getSqliteDb } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Função para validar senha forte
function validateStrongPassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('A senha deve ter no mínimo 8 caracteres');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiúscula');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minúscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter pelo menos um número');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial (!@#$%^&*()_+-=[]{};\':"|,.<>/?)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Middleware para verificar se o usuário é administrador
async function requireAdmin(req, res, next) {
  try {
    const db = getSqliteDb();
    const result = await db.query(
      'SELECT role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!result.rows.length || result.rows[0].role !== 'administrador') {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem realizar esta ação.'
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar permissões:', error);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
}

// GET /users - Listar todos os usuários (apenas administradores)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getSqliteDb();
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// GET /users/:id - Buscar usuário por ID
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = getSqliteDb();
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// POST /users - Criar novo usuário (apenas administradores)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;

    // Validações
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email e senha são obrigatórios'
      });
    }

    // Validar senha forte
    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Senha não atende aos requisitos de segurança',
        details: passwordValidation.errors
      });
    }

    // Validar role
    const userRole = role || 'usuario';
    if (!['administrador', 'usuario'].includes(userRole)) {
      return res.status(400).json({
        error: 'Role inválida. Use "administrador" ou "usuario"'
      });
    }

    const db = getSqliteDb();

    // Verificar se username ou email já existem
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.rows.length) {
      return res.status(409).json({
        error: 'Username ou email já cadastrado'
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar usuário
    const result = await db.query(
      'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name || '', userRole]
    );

    // Buscar usuário criado
    const newUser = await db.query(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// PUT /users/:id - Atualizar usuário (apenas administradores)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, full_name, role, is_active } = req.body;
    const userId = req.params.id;
    const db = getSqliteDb();

    // Buscar usuário atual
    const currentUser = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentUser.rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Preparar campos para atualização
    const updates = [];
    const params = [];

    if (username) {
      updates.push('username = ?');
      params.push(username);
    }

    if (email) {
      updates.push('email = ?');
      params.push(email);
    }

    if (password) {
      // Validar senha forte
      const passwordValidation = validateStrongPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Senha não atende aos requisitos de segurança',
          details: passwordValidation.errors
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(full_name);
    }

    if (role) {
      if (!['administrador', 'usuario'].includes(role)) {
        return res.status(400).json({
          error: 'Role inválida. Use "administrador" ou "usuario"'
        });
      }
      updates.push('role = ?');
      params.push(role);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Buscar usuário atualizado
    const updatedUser = await db.query(
      'SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: updatedUser.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// DELETE /users/:id - Deletar usuário (apenas administradores)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const db = getSqliteDb();

    // Não permitir deletar a si mesmo
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        error: 'Você não pode deletar sua própria conta'
      });
    }

    // Verificar se usuário existe
    const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user.rows.length) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Deletar usuário
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
});

module.exports = router;
