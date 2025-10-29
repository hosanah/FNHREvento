const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { getSqliteDb } = require('../config/database');
const { buscarReservaOracle, atualizarDadosHospedeOracle } = require('../config/oracleDatabase');

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

/**
 * Extrai o número do endereço
 * Exemplos:
 * "Av Presidente Castelo Branco, 5365" -> { logradouro: "Av Presidente Castelo Branco", numero: "5365" }
 * "Rua das Flores 123" -> { logradouro: "Rua das Flores", numero: "123" }
 * "Avenida Central" -> { logradouro: "Avenida Central", numero: null }
 */
function extrairNumeroDoEndereco(endereco) {
  if (!endereco || typeof endereco !== 'string') {
    return { logradouro: endereco || '', numero: null };
  }

  const enderecoTrim = endereco.trim();

  // Padrão 1: "Endereço, 123" ou "Endereço , 123"
  const pattern1 = /^(.+?)\s*,\s*(\d+[\w-]*)$/;
  const match1 = enderecoTrim.match(pattern1);
  if (match1) {
    return {
      logradouro: match1[1].trim(),
      numero: match1[2].trim()
    };
  }

  // Padrão 2: "Endereço 123" (número no final, sem vírgula)
  const pattern2 = /^(.+?)\s+(\d+[\w-]*)$/;
  const match2 = enderecoTrim.match(pattern2);
  if (match2) {
    return {
      logradouro: match2[1].trim(),
      numero: match2[2].trim()
    };
  }

  // Sem número encontrado
  return { logradouro: enderecoTrim, numero: null };
}

/**
 * Converte valor de data do Excel para formato DD/MM/YYYY
 * A biblioteca xlsx pode retornar datas como Date objects ou números seriais
 */
function converterDataExcel(valor) {
  if (!valor) return null;

  // Se for um objeto Date (xlsx já converteu)
  if (valor instanceof Date) {
    const day = String(valor.getDate()).padStart(2, '0');
    const month = String(valor.getMonth() + 1).padStart(2, '0');
    const year = valor.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Se já for uma string de data válida (DD/MM/YYYY), retornar
  if (typeof valor === 'string') {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    if (datePattern.test(valor.trim())) {
      return valor.trim();
    }

    const cleaned = valor.trim();

    // Tentar formato ISO (YYYY-MM-DD)
    const isoPattern = /^(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = cleaned.match(isoPattern);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
  }

  // Se for número serial do Excel (caso xlsx não converta automaticamente)
  if (typeof valor === 'number') {
    // Excel data serial: dias desde 30/12/1899
    const excelEpoch = new Date(1899, 11, 30);
    const days = Math.floor(valor);
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  console.warn(`⚠️ Não foi possível converter data: ${valor} (tipo: ${typeof valor})`);
  return null;
}

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

function converterParaData(isoString) {
  if (typeof isoString !== 'string') return null;

  const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const ano = Number(match[1]);
  const mes = Number(match[2]) - 1; // Mês no JS começa em 0
  const dia = Number(match[3]);

  return new Date(Date.UTC(ano, mes, dia));
}

function separarNomeSobrenome(nomeCompleto) {
  if (!nomeCompleto) return { nome: null, sobrenome: null };

  const partes = String(nomeCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nome: null, sobrenome: null };

  const nome = partes.shift();
  const sobrenome = partes.length > 0 ? partes.join(' ') : nome;
  return { nome, sobrenome };
}

/**
 * Salvar log de compatibilidade
 */
async function salvarLogCompatibilidade(db, logData) {
  try {
    await db.query(
      `INSERT INTO logs_compatibilidade
       (hospede_id, nome_completo, data_chegada, data_partida, tipo_acao, mensagem, reserva_encontrada, erro_detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logData.hospedeId || null,
        logData.nomeCompleto,
        logData.dataChegada || null,
        logData.dataPartida || null,
        logData.tipoAcao, // 'sucesso', 'nao_encontrado', 'erro'
        logData.mensagem,
        logData.reservaEncontrada ? JSON.stringify(logData.reservaEncontrada) : null,
        logData.erroDetalhes || null
      ]
    );
  } catch (err) {
    console.error('❌ Erro ao salvar log de compatibilidade:', err.message);
  }
}

/**
 * Converte string de data (ISO, brasileiro ou texto) para objeto Date
 */
function converterStringParaDate(dateString) {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;

  // Tenta parsear formato brasileiro DD/MM/YYYY
  const brMatch = String(dateString).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1; // Mês começa em 0
    const year = parseInt(brMatch[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Tenta parsear string ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
  const date = new Date(dateString);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Converte data ISO para formato brasileiro DD/MM/YYYY
 */
function isoToBr(isoString) {
  if (!isoString) return null;

  const date = converterStringParaDate(isoString);
  if (!date) return null;

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

async function garantirColunasExtras(db) {
  if (colunasExtrasVerificadas) return;

  const info = await db.query('PRAGMA table_info(hospedes)');
  const nomesColunas = (info.rows || []).map(coluna => normalizarNomeColuna(coluna.name || coluna.NAME));

  await adicionarColunaSeNecessario(db, nomesColunas, 'idhospede', 'TEXT');
  await adicionarColunaSeNecessario(db, nomesColunas, 'idreservasfront', 'TEXT');
  await adicionarColunaSeNecessario(db, nomesColunas, 'numero', 'TEXT');
  await adicionarColunaSeNecessario(db, nomesColunas, 'complemento', 'TEXT');
  await adicionarColunaSeNecessario(db, nomesColunas, 'bairro', 'TEXT');

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

  // Status 2: Compatível (reserva vinculada, mas não integrado)
  await db.query('UPDATE hospedes SET idhospede = ?, idreservasfront = ?, status = 2 WHERE id = ?', [
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
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

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

      // Extrair número do endereço
      const enderecoParseado = extrairNumeroDoEndereco(endereco);
      const logradouro = enderecoParseado.logradouro;
      const numero = enderecoParseado.numero;

      // Converter datas do Excel para formato DD/MM/YYYY
      const dataNascimentoFormatada = converterDataExcel(dataNascimento);
      const entradaFormatada = converterDataExcel(entrada);
      const saidaFormatada = converterDataExcel(saida);

      console.log(`📍 Importando: "${endereco}" -> Logradouro: "${logradouro}", Número: "${numero}"`);
      console.log(`📅 Datas convertidas - Nascimento: ${dataNascimentoFormatada}, Entrada: ${entradaFormatada}, Saída: ${saidaFormatada}`);

      inserts.push(db.query(
        `INSERT INTO hospedes (codigo, apto, nome_completo, endereco, numero, estado, email, profissao, cidade, identidade, cpf, telefone, pais, cep, data_nascimento, sexo, entrada, saida, status, idhospede, idreservasfront)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          codigo,
          apto,
          nomeCompleto,
          logradouro,
          numero,
          estado,
          email,
          profissao,
          cidade,
          identidade,
          cpf,
          telefone,
          pais,
          cep,
          dataNascimentoFormatada,
          sexo,
          entradaFormatada,
          saidaFormatada,
          1, // Status 1: Importado (sem reserva vinculada)
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

    const dataChegadaPrevista = converterStringParaDate(hospede.entrada);
    const dataPartidaPrevista = converterStringParaDate(hospede.saida);
    if (!dataChegadaPrevista || !dataPartidaPrevista) {
      return res.status(400).json({ error: 'Datas de entrada/saída inválidas para buscar no Oracle' });
    }

    try {
      const resultado = await executarCompatibilidadeValida(db, hospede, {
        nome,
        sobrenome,
        dataChegadaPrevista,
        dataPartidaPrevista
      });

      // Salvar log
      await salvarLogCompatibilidade(db, {
        hospedeId: hospede.id,
        nomeCompleto: hospede.nome_completo,
        dataChegada: hospede.entrada,
        dataPartida: hospede.saida,
        tipoAcao: resultado.compatibilidadeEncontrada ? 'sucesso' : 'nao_encontrado',
        mensagem: resultado.message,
        reservaEncontrada: resultado.reserva || null
      });

      res.json(resultado);
    } catch (searchErr) {
      // Salvar log de erro
      await salvarLogCompatibilidade(db, {
        hospedeId: hospede.id,
        nomeCompleto: hospede.nome_completo,
        dataChegada: hospede.entrada,
        dataPartida: hospede.saida,
        tipoAcao: 'erro',
        mensagem: 'Erro ao buscar compatibilidade',
        erroDetalhes: searchErr.message
      });
      throw searchErr;
    }
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

    // Buscar apenas hóspedes que NÃO estão com status 3 (integrados/finalizados)
    const hospedesResult = await db.query('SELECT * FROM hospedes WHERE status != 3');
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
        await salvarLogCompatibilidade(db, {
          hospedeId: hospede.id,
          nomeCompleto: hospede.nome_completo,
          dataChegada: hospede.entrada,
          dataPartida: hospede.saida,
          tipoAcao: 'erro',
          mensagem: 'Nome do hóspede inválido para buscar no Oracle',
          erroDetalhes: 'Nome ou sobrenome ausente após separação'
        });
        resultados.push({
          id: hospede.id,
          status: 'inelegivel',
          message: 'Nome do hóspede inválido para buscar no Oracle',
          hospede
        });
        continue;
      }

      const dataChegadaPrevista = converterStringParaDate(hospede.entrada);
      const dataPartidaPrevista = converterStringParaDate(hospede.saida);

      if (!dataChegadaPrevista || !dataPartidaPrevista) {
        inelegiveis += 1;
        await salvarLogCompatibilidade(db, {
          hospedeId: hospede.id,
          nomeCompleto: hospede.nome_completo,
          dataChegada: hospede.entrada,
          dataPartida: hospede.saida,
          tipoAcao: 'erro',
          mensagem: 'Datas de entrada/saída inválidas para buscar no Oracle',
          erroDetalhes: 'Não foi possível converter as datas para o formato Date'
        });
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
          await salvarLogCompatibilidade(db, {
            hospedeId: hospede.id,
            nomeCompleto: hospede.nome_completo,
            dataChegada: isoToBr(dataChegadaPrevista),
            dataPartida: isoToBr(dataPartidaPrevista),
            tipoAcao: 'sucesso',
            mensagem: 'Reserva compatível encontrada no Oracle',
            reservaEncontrada: resultado.reserva
          });
          resultados.push({
            id: hospede.id,
            status: 'compatibilidade-encontrada',
            ...resultado
          });
        } else {
          semCompatibilidade += 1;
          await salvarLogCompatibilidade(db, {
            hospedeId: hospede.id,
            nomeCompleto: hospede.nome_completo,
            dataChegada: isoToBr(dataChegadaPrevista),
            dataPartida: isoToBr(dataPartidaPrevista),
            tipoAcao: 'nao_encontrado',
            mensagem: 'Nenhuma reserva compatível encontrada no Oracle'
          });
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
        await salvarLogCompatibilidade(db, {
          hospedeId: hospede.id,
          nomeCompleto: hospede.nome_completo,
          dataChegada: isoToBr(dataChegadaPrevista),
          dataPartida: isoToBr(dataPartidaPrevista),
          tipoAcao: 'erro',
          mensagem: 'Erro ao buscar compatibilidade da reserva no Oracle',
          erroDetalhes: err && err.message ? err.message : 'Erro desconhecido'
        });
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
 * Listar logs de compatibilidade
 */
router.get('/logs', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;

    const logsResult = await db.query(
      `SELECT * FROM logs_compatibilidade
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) as total FROM logs_compatibilidade');
    const total = countResult.rows?.[0]?.total || 0;

    res.json({
      logs: logsResult.rows || [],
      total,
      limit,
      offset
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Listar logs de um hóspede específico
 */
router.get('/:id/logs', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    const hospedeId = parseInt(req.params.id, 10);

    const logsResult = await db.query(
      `SELECT * FROM logs_compatibilidade
       WHERE hospede_id = ?
       ORDER BY created_at DESC`,
      [hospedeId]
    );

    res.json(logsResult.rows || []);
  } catch (err) {
    next(err);
  }
});

/**
 * Atualizar dados do hóspede no Oracle
 */
router.post('/:id/atualizar-oracle', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    await garantirColunasExtras(db);

    const hospedeResult = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);
    const hospede =
      (hospedeResult.rows && hospedeResult.rows[0]) ? hospedeResult.rows[0] : null;

    if (!hospede) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    if (!hospede.idhospede) {
      return res.status(400).json({ error: 'Hóspede não possui IDHOSPEDE no Oracle. Execute a busca de compatibilidade primeiro.' });
    }

    // Preparar dados para atualização
    const dadosAtualizacao = {
      idHospede: hospede.idhospede,
      email: hospede.email,
      cpf: hospede.cpf,
      telefone: hospede.telefone,
      cep: hospede.cep,
      dataNascimento: hospede.data_nascimento,
      sexo: hospede.sexo,
      endereco: hospede.endereco,
      cidade: hospede.cidade,
      estado: hospede.estado,
      bairro: hospede.bairro,
      numero: hospede.numero,
      complemento: hospede.complemento,
      dataCheckin: hospede.entrada,
      dataCheckout: hospede.saida
    };

    // Atualizar no Oracle
    const resultado = await atualizarDadosHospedeOracle(dadosAtualizacao);

    // Status 3: Integrado (reserva vinculada e dados atualizados no Oracle)
    await db.query('UPDATE hospedes SET status = 3 WHERE id = ?', [req.params.id]);

    // Buscar hóspede atualizado
    const hospedeAtualizado = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);
    const hospedeAtual = hospedeAtualizado.rows?.[0] || hospede;

    // Registrar log
    await salvarLogCompatibilidade(db, {
      hospedeId: hospede.id,
      nomeCompleto: hospede.nome_completo,
      dataChegada: hospede.entrada,
      dataPartida: hospede.saida,
      tipoAcao: 'sucesso',
      mensagem: `Dados atualizados no Oracle: ${resultado.updatedFields.join(', ')}`,
      reservaEncontrada: resultado
    });

    res.json({
      message: resultado.message,
      updatedFields: resultado.updatedFields,
      hospede: hospedeAtual
    });
  } catch (err) {
    if (err && err.message && err.message.includes('Oracle Database indisponível')) {
      return res.status(503).json({ error: err.message });
    }

    // Registrar erro no log
    try {
      const db = getSqliteDb();
      const hospedeResult = await db.query('SELECT * FROM hospedes WHERE id = ?', [req.params.id]);
      const hospede = hospedeResult.rows?.[0];

      if (hospede) {
        await salvarLogCompatibilidade(db, {
          hospedeId: hospede.id,
          nomeCompleto: hospede.nome_completo,
          dataChegada: hospede.entrada,
          dataPartida: hospede.saida,
          tipoAcao: 'erro',
          mensagem: 'Erro ao atualizar dados no Oracle',
          erroDetalhes: err.message
        });
      }
    } catch (logErr) {
      console.error('Erro ao salvar log de erro:', logErr.message);
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
router.put('/:id', async (req, res, next) => {
  try {
    const db = getSqliteDb();
    const id = parseInt(req.params.id, 10);

    // Verificar se o hóspede existe
    const hospedeExistente = await db.query('SELECT * FROM hospedes WHERE id = ?', [id]);
    if (!hospedeExistente.rows || hospedeExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Hóspede não encontrado' });
    }

    const hospede = hospedeExistente.rows[0];

    // Bloquear edição de registros integrados (status 3)
    if (hospede.status == 3) {
      return res.status(403).json({ error: 'Não é possível editar um hóspede já integrado ao sistema FNRH.' });
    }

    // Extrair dados do body
    const {
      nome_completo, codigo, email, telefone, cpf, identidade, profissao,
      data_nascimento, sexo, apto, endereco, numero, complemento, bairro,
      cidade, estado, pais, cep, entrada, saida
    } = req.body;

    // Atualizar no banco de dados
    const updateQuery = `
      UPDATE hospedes SET
        nome_completo = ?, codigo = ?, email = ?, telefone = ?, cpf = ?,
        identidade = ?, profissao = ?, data_nascimento = ?, sexo = ?, apto = ?,
        endereco = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?,
        estado = ?, pais = ?, cep = ?, entrada = ?, saida = ?
      WHERE id = ?
    `;

    await db.query(updateQuery, [
      nome_completo, codigo, email, telefone, cpf,
      identidade, profissao, data_nascimento, sexo, apto,
      endereco, numero, complemento, bairro, cidade,
      estado, pais, cep, entrada, saida,
      id
    ]);

    // Buscar o hóspede atualizado
    const hospedeAtualizado = await db.query('SELECT * FROM hospedes WHERE id = ?', [id]);
    res.json(hospedeAtualizado.rows[0]);
  } catch (err) {
    next(err);
  }
});

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
