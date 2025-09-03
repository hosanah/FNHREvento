const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../config/database');

const upload = multer({ dest: path.join(__dirname, '../uploads') });
const router = express.Router();

// Importar planilha de hóspedes
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const db = getDatabase();
    const inserts = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || r.every(cell => cell === '')) continue;
      const [codigo, apto, nomeCompleto, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, dataNascimento, sexo, entrada, saida] = r;
      inserts.push(db.query(
        `INSERT INTO hospedes (codigo, apto, nome_completo, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, data_nascimento, sexo, entrada, saida, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, apto, nomeCompleto, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, dataNascimento, sexo, entrada, saida, 1]
      ));
    }
    await Promise.all(inserts);
    fs.unlinkSync(filePath);
    res.json({ message: 'Importação concluída', inserted: inserts.length });
  } catch (err) {
    next(err);
  }
});

// Listar hóspedes
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM hospedes');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Excluir hóspede
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const result = await db.query('DELETE FROM hospedes WHERE id = ?', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
