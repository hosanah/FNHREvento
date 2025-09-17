const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { getSqliteDb } = require('../config/database');
const { buscarReservaOracle } = require('../config/oracleDatabase');

const upload = multer({ dest: path.join(__dirname, '../uploads') });
const router = express.Router();

let colunasExtrasVerificadas = false;

function normalizarDataOracle(valor) {
  if (!valor && valor !== 0) {
    return null;
  }

  const texto = String(valor).trim();
  if (!texto) {
    return null;
  }

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function separarNomeSobrenome(nomeCompleto) {
  if (!nomeCompleto) {
    return { nome: null, sobrenome: null };
  }

  const partes = String(nomeCompleto)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length === 0) {
    return { nome: null, sobrenome: null };
  }

  const nome = partes.shift();
  const sobrenome = partes.length > 0 ? partes.join(' ') : nome;
  return { nome, sobrenome };
}

async function garantirColunasExtras(db) {
  if (colunasExtrasVerificadas) {
    return;
  }

  const info = await db.query('PRAGMA table_info(hospedes)');
  const nomesColunas = info.rows.map(coluna => coluna.name || coluna.NAME);

  if (!nomesColunas.includes('idhospede')) {
    await db.query('ALTER TABLE hospedes ADD COLUMN idhospede TEXT');
  }

  if (!nomesColunas.includes('idreservasfront')) {
    await db.query('ALTER TABLE hospedes ADD COLUMN idreservasfront TEXT');
  }

  colunasExtrasVerificadas = true;
}

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

    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const inserts = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0 || r.every(cell => cell === '')) continue;
      const [codigo, apto, nomeCompleto, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, dataNascimento, sexo, entrada, saida] = r;
      inserts.push(db.query(
        `INSERT INTO hospedes (codigo, apto, nome_completo, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, data_nascimento, sexo, entrada, saida, status, idhospede, idreservasfront)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, apto, nomeCompleto, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, dataNascimento, sexo, entrada, saida, 1, null, null]
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
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const result = await db.query('SELECT * FROM hospedes');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Buscar compatibilidade de reserva no Oracle e atualizar ficha
router.post('/:id/compatibilidade', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const hospedeResult = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);

    if (hospedeResult.rowCount === 0) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const hospede = hospedeResult.rows[0];
    const { nome, sobrenome } = separarNomeSobrenome(hospede.nome_completo);

    if (!nome || !sobrenome) {
      return res.status(400).json({ error: 'Nome do hóspede inválido para buscar no Oracle' });
    }

    const dataChegadaPrevista = normalizarDataOracle(hospede.entrada);
    const dataPartidaPrevista = normalizarDataOracle(hospede.saida);

    if (!dataChegadaPrevista || !dataPartidaPrevista) {
      return res.status(400).json({ error: 'Datas de entrada/saída inválidas para buscar no Oracle' });
    }

    const reservas = await buscarReservaOracle({
      dataChegadaPrevista,
      dataPartidaPrevista,
      nomeHospede: nome,
      sobrenomeHospede: sobrenome
    });

    if (!reservas || reservas.length === 0) {
      return res.json({
        message: 'Nenhuma reserva compatível encontrada no Oracle',
        hospede,
        reserva: null,
        compatibilidadeEncontrada: false
      });
    }

    const reserva = reservas[0];
    const idHospedeOracle =
      reserva.IDHOSPEDE ?? reserva.idhospede ?? reserva.IdHospede ?? reserva.idHospede ?? null;
    const idReservasFrontOracle =
      reserva.IDRESERVASFRONT ?? reserva.idreservasfront ?? reserva.IdReservasFront ?? reserva.idReservasFront ?? null;

    await db.query('UPDATE hospedes SET idhospede = ?, idreservasfront = ? WHERE id = ?', [
      idHospedeOracle,
      idReservasFrontOracle,
      req.params.id
    ]);

    const atualizado = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);

    res.json({
      message: 'Reserva compatível encontrada e ficha atualizada',
      hospede: atualizado.rows[0],
      reserva,
      compatibilidadeEncontrada: true
    });
  } catch (err) {
    if (err && err.message && err.message.includes('Oracle Database indisponível')) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

// Excluir hóspede
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getSqliteDb();
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
