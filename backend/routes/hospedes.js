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

function normalizarNomeColuna(coluna) {
  if (!coluna) return '';
  return String(coluna).trim().toLowerCase();
}

async function adicionarColunaSeNecessario(db, nomesExistentes, coluna, definicao) {
  if (nomesExistentes.includes(coluna)) return;

  try {
    await db.query(`ALTER TABLE hospedes ADD COLUMN ${coluna} ${definicao}`);
  } catch (err) {
    if (!err || !err.message || !/duplicate column name/i.test(err.message)) {
      throw err;
    }
    // Outro processo ou inicialização já pode ter criado a coluna.
  }

  nomesExistentes.push(coluna);
}

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

function criarDataUtc(year, month, day) {
  const data = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

function converterNumeroExcelParaData(numero) {
  if (!Number.isFinite(numero)) return null;

  const baseExcel = Date.UTC(1899, 11, 30);
  const diasInteiros = Math.trunc(numero);
  const fracaoDia = numero - diasInteiros;
  const dataCalculada = new Date(
    baseExcel + diasInteiros * UM_DIA_EM_MS + Math.round(fracaoDia * UM_DIA_EM_MS)
  );

  if (Number.isNaN(dataCalculada.getTime())) return null;

  return criarDataUtc(
    dataCalculada.getUTCFullYear(),
    dataCalculada.getUTCMonth() + 1,
    dataCalculada.getUTCDate()
  );
}

function isoToBr(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
  if (!m) return null; // ou lance um erro, se preferir
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function separarNomeSobrenome(nomeCompleto) {
  if (!nomeCompleto) return { nome: null, sobrenome: null };

  const partes = String(nomeCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nome: null, sobrenome: null };

  const nome = partes.shift();
  const sobrenome = partes.length > 0 ? partes.join(' ') : nome;
  return { nome, sobrenome };
}

async function garantirColunasExtras(db) {
  if (colunasExtrasVerificadas) return;

  const info = await db.query('PRAGMA table_info(hospedes)');
  const nomesColunas = (info.rows || []).map(coluna => normalizarNomeColuna(coluna.name || coluna.NAME));

  await adicionarColunaSeNecessario(db, nomesColunas, 'idhospede', 'TEXT');
  await adicionarColunaSeNecessario(db, nomesColunas, 'idreservasfront', 'TEXT');

  colunasExtrasVerificadas = true;
}

async function executarCompatibilidadeValida(db, hospede, { nome, sobrenome, dataChegadaPrevista, dataPartidaPrevista }) {
  const reservas = await buscarReservaOracle({
    dataChegadaPrevista,
    dataPartidaPrevista,
    nomeHospede: nome,
    sobrenomeHospede: sobrenome
  });

  if (!reservas || reservas.length === 0) {
    return {
      message: 'Nenhuma reserva compatível encontrada no Oracle',
      hospede,
      reserva: null,
      compatibilidadeEncontrada: false
    };
  }

  const reserva = reservas[0];
  const idHospedeOracle =
    reserva.IDHOSPEDE ?? reserva.idhospede ?? reserva.IdHospede ?? reserva.idHospede ?? null;
  const idReservasFrontOracle =
    reserva.IDRESERVASFRONT ??
    reserva.idreservasfront ??
    reserva.IdReservasFront ??
    reserva.idReservasFront ??
    null;

  await db.query('UPDATE hospedes SET idhospede = ?, idreservasfront = ? WHERE id = ?', [
    idHospedeOracle,
    idReservasFrontOracle,
    hospede.id
  ]);

  const atualizado = await db.query('SELECT * FROM hospedes WHERE id = ?', [hospede.id]);

  return {
    message: 'Reserva compatível encontrada e ficha atualizada',
    hospede: (atualizado.rows && atualizado.rows[0]) || hospede,
    reserva,
    compatibilidadeEncontrada: true
  };
}

/**
 * Importar planilha de hóspedes
 */
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

      const [
        codigo, apto, nomeCompleto, endereco, estado, email, profissao, cidade,
        identidade, cpf, telefone, pais, cep, dataNascimento, sexo, entrada, saida
      ] = r;

      inserts.push(db.query(
        `INSERT INTO hospedes (codigo, apto, nome_completo, endereco, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, data_nascimento, sexo, entrada, saida, status, idhospede, idreservasfront)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          codigo,
          apto,
          nomeCompleto,
          endereco,
          estado,
          email,
          profissao,
          cidade,
          identidade,
          cpf,
          telefone,
          pais,
          cep,
          dataNascimento,
          sexo,
          entrada,
          saida,
          'importado',
          null,
          null
        ]
      ));
    }

    await Promise.all(inserts);
    fs.unlinkSync(filePath);

    res.json({ message: 'Importação concluída', inserted: inserts.length });
  } catch (err) {
    next(err);
  }
});

/**
 * Listar hóspedes
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const result = await db.query('SELECT * FROM hospedes');
    res.json(result.rows || []);
  } catch (err) {
    next(err);
  }
});

/**
 * Buscar compatibilidade de reserva no Oracle por ID e atualizar ficha
 */
router.post('/:id/compatibilidade', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const hospedeResult = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);
    const hospede =
      (hospedeResult.rows && hospedeResult.rows[0]) ? hospedeResult.rows[0] : null;

    if (!hospede) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const { nome, sobrenome } = separarNomeSobrenome(hospede.nome_completo);
    if (!nome || !sobrenome) {
      return res.status(400).json({ error: 'Nome do hóspede inválido para buscar no Oracle' });
    }

    const dataChegadaPrevista = isoToBr(hospede.entrada);
    const dataPartidaPrevista = isoToBr(hospede.saida);
    if (!dataChegadaPrevista || !dataPartidaPrevista) {
      return res.status(400).json({ error: 'Datas de entrada/saída inválidas para buscar no Oracle' });
    }

    const resultado = await executarCompatibilidadeValida(db, hospede, {
      nome,
      sobrenome,
      dataChegadaPrevista,
      dataPartidaPrevista
    });

    res.json(resultado);
  } catch (err) {
    if (err && err.message && err.message.includes('Oracle Database indisponível')) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * Buscar compatibilidade de reserva no Oracle em lote (todos os hóspedes)
 */
router.post('/compatibilidade', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const hospedesResult = await db.query('SELECT * FROM hospedes');
    const hospedes = hospedesResult.rows || [];

    const resultados = [];
    let totalElegiveis = 0;
    let totalProcessados = 0;
    let compatibilidadesEncontradas = 0;
    let semCompatibilidade = 0;
    let inelegiveis = 0;
    let errosProcessamento = 0;

    for (const hospede of hospedes) {
      const { nome, sobrenome } = separarNomeSobrenome(hospede.nome_completo);

      if (!nome || !sobrenome) {
        inelegiveis += 1;
        resultados.push({
          id: hospede.id,
          status: 'inelegivel',
          message: 'Nome do hóspede inválido para buscar no Oracle',
          hospede
        });
        continue;
      }

      const dataChegadaPrevista = isoToBr(hospede.entrada);
      const dataPartidaPrevista = isoToBr(hospede.saida);

      if (!dataChegadaPrevista || !dataPartidaPrevista) {
        inelegiveis += 1;
        resultados.push({
          id: hospede.id,
          status: 'inelegivel',
          message: 'Datas de entrada/saída inválidas para buscar no Oracle',
          hospede
        });
        continue;
      }

      totalElegiveis += 1;

      try {
        const resultado = await executarCompatibilidadeValida(db, hospede, {
          nome,
          sobrenome,
          dataChegadaPrevista,
          dataPartidaPrevista
        });

        totalProcessados += 1;

        if (resultado.compatibilidadeEncontrada) {
          compatibilidadesEncontradas += 1;
          resultados.push({
            id: hospede.id,
            status: 'compatibilidade-encontrada',
            ...resultado
          });
        } else {
          semCompatibilidade += 1;
          resultados.push({
            id: hospede.id,
            status: 'nenhuma-compatibilidade',
            ...resultado
          });
        }
      } catch (err) {
        if (err && err.message && err.message.includes('Oracle Database indisponível')) {
          throw err;
        }

        errosProcessamento += 1;
        resultados.push({
          id: hospede.id,
          status: 'erro',
          error: err && err.message ? err.message : 'Erro ao buscar compatibilidade da reserva',
          hospede
        });
      }
    }

    res.json({
      totalHospedes: hospedes.length,
      totalElegiveis,
      totalProcessados,
      compatibilidadesEncontradas,
      semCompatibilidade,
      inelegiveis,
      errosProcessamento,
      resultados
    });
  } catch (err) {
    if (err && err.message && err.message.includes('Oracle Database indisponível')) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * Marcar hóspede como integrado ao PMS
 */
router.post('/:id/integrar', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const hospedeResult = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);
    const hospede =
      (hospedeResult.rows && hospedeResult.rows[0]) ? hospedeResult.rows[0] : null;

    if (!hospede) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const atualizacoes = ['status = ?'];
    const parametros = ['integrado'];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'idhospede')) {
      atualizacoes.push('idhospede = ?');
      parametros.push(req.body.idhospede);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'idreservasfront')) {
      atualizacoes.push('idreservasfront = ?');
      parametros.push(req.body.idreservasfront);
    }

    parametros.push(req.params.id);

    await db.query(`UPDATE hospedes SET ${atualizacoes.join(', ')} WHERE id = ?`, parametros);

    const atualizado = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);

    res.json({
      message: 'Hóspede marcado como integrado ao PMS',
      hospede: (atualizado.rows && atualizado.rows[0]) || null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Excluir hóspede
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    const result = await db.query('DELETE FROM hospedes WHERE id = ?', [req.params.id]);
    const changesOrRowCount = (result && (result.rowCount ?? result.changes)) || 0;

    if (changesOrRowCount === 0) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
