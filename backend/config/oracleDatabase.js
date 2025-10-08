'use strict';

/**
 * Configuração de conexão com Oracle Database usando pools
 */

const oracledb = require('oracledb');

let oraclePool = null;
let oracleClientInitAttempted = false;

function validarDataParametro(nomeParametro, valor) {
  if (!(valor instanceof Date) || Number.isNaN(valor.getTime())) {
    throw new Error(`${nomeParametro} deve ser uma data válida (Date)`);
  }

  return new Date(valor.getTime());
}

function initOracleClientIfNeeded() {
  if (oracleClientInitAttempted) {
    return;
  }

  oracleClientInitAttempted = true;

  const driverMode = (process.env.ORACLE_DRIVER_MODE || '').trim().toLowerCase();
  if (driverMode === 'thin') {
    console.log('ℹ️  Oracle Database configurado para utilizar o driver Thin.');
    return;
  }

  const libDir = (process.env.ORACLE_CLIENT_LIB_DIR || '').trim();

  try {
    if (libDir) {
      oracledb.initOracleClient({ libDir });
    } else {
      oracledb.initOracleClient();
    }
    console.log('✅ Oracle Client nativo inicializado (modo Thick habilitado)');
  } catch (error) {
    const contextMessage = libDir
      ? `usando ORACLE_CLIENT_LIB_DIR="${libDir}"`
      : 'automaticamente';
    console.warn(
      `⚠️  Não foi possível inicializar o Oracle Client nativo ${contextMessage}. O driver permanecerá em modo Thin. ` +
        'Configure o Oracle Instant Client e defina ORACLE_CLIENT_LIB_DIR caso necessário.',
      error.message
    );
  }
}

function getOracleConfig() {
  const host = process.env.ORACLE_HOST;
  const port = (process.env.ORACLE_PORT || '1521').toString().trim();
  const serviceName = process.env.ORACLE_SERVICE_NAME;
  const connectString = host && port && serviceName ? `${host}:${port}/${serviceName}` : null;

  return {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    host,
    port,
    serviceName,
    connectString,
    poolMin: parseInt(process.env.ORACLE_POOL_MIN || '0', 10),
    poolMax: parseInt(process.env.ORACLE_POOL_MAX || '4', 10),
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT || '1', 10),
    poolTimeout: parseInt(process.env.ORACLE_POOL_TIMEOUT || '60', 10)
  };
}

function isOracleConfigured(config) {
  return Boolean(
    config.user &&
    config.password &&
    config.host &&
    config.port &&
    config.serviceName &&
    config.connectString
  );
}

async function initOraclePool() {
  if (oraclePool) {
    return oraclePool;
  }

  const config = getOracleConfig();
  if (!isOracleConfigured(config)) {
    console.warn(
      '⚠️  Oracle Database não configurado. Defina ORACLE_HOST, ORACLE_PORT, ORACLE_SERVICE_NAME, ORACLE_USER e ORACLE_PASSWORD para habilitar.'
    );
    return null;
  }

  try {
    initOracleClientIfNeeded();
    oraclePool = await oracledb.createPool({
      user: config.user,
      password: config.password,
      connectString: config.connectString,
      poolMin: config.poolMin,
      poolMax: config.poolMax,
      poolIncrement: config.poolIncrement,
      poolTimeout: config.poolTimeout,
      homogeneous: true
    });
    console.log('✅ Pool de conexões Oracle inicializado');
    return oraclePool;
  } catch (error) {
    oraclePool = null;
    console.warn('⚠️  Falha ao inicializar pool Oracle. Recursos dependentes do Oracle ficarão indisponíveis. Detalhes:', error.message);
    if (error.message && error.message.includes('NJS-116')) {
      console.warn(
        '💡  Dica: Esse erro ocorre quando o modo Thin não suporta o password verifier do usuário. ' +
          'Instale o Oracle Instant Client 19c (ou superior) e defina a variável ORACLE_CLIENT_LIB_DIR, ou configure ORACLE_DRIVER_MODE=thin '
          + 'para forçar o modo Thin após ajustar o usuário no banco.'
      );
    }
    return null;
  }
}

async function getOracleConnection() {
  if (!oraclePool) {
    await initOraclePool();
  }

  if (!oraclePool) {
    throw new Error('Oracle Database indisponível. Verifique a configuração e o status do pool.');
  }

  try {
    return await oraclePool.getConnection();
  } catch (error) {
    console.error('❌ Erro ao obter conexão Oracle:', error.message);
    throw error;
  }
}

async function buscarReservaOracle({
  dataChegadaPrevista,
  dataPartidaPrevista,
  nomeHospede,
  sobrenomeHospede
}) {
  const chegada = validarDataParametro('dataChegadaPrevista', dataChegadaPrevista);
  const partida = validarDataParametro('dataPartidaPrevista', dataPartidaPrevista);
  const connection = await getOracleConnection();

  try {
    // Formatar datas para DD/MM/YYYY
    const dataChegadaFormatada = `${String(chegada.getUTCDate()).padStart(2, '0')}/${String(chegada.getUTCMonth() + 1).padStart(2, '0')}/${chegada.getUTCFullYear()}`;
    const dataPartidaFormatada = `${String(partida.getUTCDate()).padStart(2, '0')}/${String(partida.getUTCMonth() + 1).padStart(2, '0')}/${partida.getUTCFullYear()}`;

    const query = `SELECT RF.IDRESERVASFRONT,
              RF.NUMRESERVA,
              H.IDHOSPEDE,
              RF.STATUSRESERVA,
              RF.DATACHEGPREVISTA,
              RF.DATAPARTPREVISTA
         FROM RESERVASFRONT RF,
              MOVIMENTOHOSPEDES MH,
              HOSPEDE H
        WHERE RF.IDRESERVASFRONT = MH.IDRESERVASFRONT
          AND MH.IDHOSPEDE = H.IDHOSPEDE
          AND RF.STATUSRESERVA IN (1, 2)
          AND TRUNC(RF.DATACHEGPREVISTA) = TO_DATE(:dataChegadaPrevista, 'DD/MM/YYYY')
          AND TRUNC(RF.DATAPARTPREVISTA) = TO_DATE(:dataPartidaPrevista, 'DD/MM/YYYY')
          AND UPPER(H.NOME) LIKE UPPER(:nomeHospede)
          AND UPPER(H.SOBRENOME) LIKE UPPER(:sobrenomeHospede)`;

    const params = {
      dataChegadaPrevista: dataChegadaFormatada,
      dataPartidaPrevista: dataPartidaFormatada,
      nomeHospede: `%${nomeHospede}%`,
      sobrenomeHospede: `%${sobrenomeHospede}%`
    };

    console.log('🔍 Executando query Oracle:');
    console.log('Query:', query);
    console.log('Parâmetros:', params);

    const result = await connection.execute(query, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });

    console.log(`✅ Query Oracle executada. Resultados encontrados: ${result.rows.length}`);
    return result.rows;
  } catch (error) {
    console.error('❌ Erro ao buscar reserva no Oracle:', error.message);
    throw error;
  } finally {
    try {
      await connection.close();
    } catch (closeError) {
      console.error('⚠️  Erro ao fechar conexão Oracle após buscar reserva:', closeError.message);
    }
  }
}

/**
 * Atualiza dados do hóspede no Oracle Database
 *
 * Esta função realiza atualizações em múltiplas tabelas do Oracle em uma única transação:
 * 1. PESSOA - Email e documento
 * 2. PESSOAFISICA - Data de nascimento
 * 3. DOCPESSOA - CPF (insere ou atualiza)
 * 4. ENDPESS - Endereço completo com busca de IDCIDADES
 * 5. TELENDPESS - Telefone (insere ou atualiza)
 * 6. CONTATOPESS - Registro de contato (apenas insere se não existir)
 *
 * @param {Object} params - Parâmetros de atualização
 * @param {number} params.idHospede - ID do hóspede no Oracle (IDPESSOA)
 * @param {string} [params.email] - Email do hóspede
 * @param {string} [params.cpf] - CPF do hóspede (pode conter máscara)
 * @param {string} [params.telefone] - Telefone do hóspede (pode conter máscara)
 * @param {string} [params.cep] - CEP do hóspede (pode conter máscara)
 * @param {string|Date} [params.dataNascimento] - Data de nascimento (DD/MM/YYYY, YYYY-MM-DD ou Date)
 * @param {string} [params.endereco] - Logradouro completo
 * @param {string} [params.cidade] - Nome da cidade (busca IDCIDADES na tabela CIDADES)
 * @param {string} [params.estado] - UF do estado
 * @param {string} [params.bairro] - Bairro
 * @param {string} [params.numero] - Número do endereço
 * @param {string} [params.complemento] - Complemento do endereço
 * @returns {Promise<Object>} Resultado da operação com campos atualizados
 * @throws {Error} Se houver erro na atualização (com rollback automático)
 */
async function atualizarDadosHospedeOracle({
  idHospede,
  email,
  cpf,
  telefone,
  cep,
  dataNascimento,
  endereco,
  cidade,
  estado,
  bairro,
  numero,
  complemento
}) {
  // Validação básica
  if (!idHospede) {
    throw new Error('IDHOSPEDE é obrigatório para atualização');
  }

  const connection = await getOracleConnection();

  try {
    const updates = [];

    // 1. Atualizar EMAIL na tabela PESSOA
    if (email) {
      const updatePessoa = `UPDATE PESSOA SET EMAIL = :email WHERE IDPESSOA = :idHospede`;
      await connection.execute(updatePessoa, { email, idHospede }, { autoCommit: false });
      updates.push('EMAIL na tabela PESSOA');
    }

    // 2. Atualizar DATA DE NASCIMENTO na tabela PESSOAFISICA
    if (dataNascimento) {
      console.log('🔍 Data de nascimento recebida:', dataNascimento, 'Tipo:', typeof dataNascimento);

      // A data já vem no formato DD/MM/YYYY do SQLite
      let dataFormatada = dataNascimento;

      // Se for um objeto Date, converter para DD/MM/YYYY
      if (dataNascimento instanceof Date) {
        dataFormatada = `${String(dataNascimento.getDate()).padStart(2, '0')}/${String(dataNascimento.getMonth() + 1).padStart(2, '0')}/${dataNascimento.getFullYear()}`;
      }
      // Se for string ISO (YYYY-MM-DD), converter para DD/MM/YYYY
      else if (typeof dataNascimento === 'string' && dataNascimento.match(/^\d{4}-\d{2}-\d{2}/)) {
        const date = new Date(dataNascimento);
        dataFormatada = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      }

      console.log('📅 Data formatada para Oracle:', dataFormatada);

      const updatePessoaFisica = `UPDATE PESSOAFISICA SET DATANASC = TO_DATE(:dataNascimento, 'DD/MM/YYYY') WHERE IDPESSOA = :idHospede`;
      await connection.execute(updatePessoaFisica, { dataNascimento: dataFormatada, idHospede }, { autoCommit: false });
      updates.push('DATA DE NASCIMENTO na tabela PESSOAFISICA');
    }

    // 3. Inserir ou Atualizar CPF na tabela DOCPESSOA e PESSOA
    // IDDOCUMENTO = -2 representa CPF no sistema Oracle
    if (cpf) {
      // Remover caracteres especiais do CPF (manter apenas números)
      // Exemplo: "123.456.789-01" -> "12345678901"
      const cpfLimpo = cpf.replace(/\D/g, '');

      // Validação básica: CPF deve ter exatamente 11 dígitos
      if (cpfLimpo.length !== 11) {
        console.warn(`⚠️  CPF inválido (deve ter 11 dígitos): ${cpfLimpo}`);
      } else {
        // Verificar se já existe CPF para este hóspede
        const checkDocPessoa = `SELECT COUNT(*) as COUNT FROM DOCPESSOA WHERE IDPESSOA = :idHospede AND IDDOCUMENTO = -2`;
        const checkResult = await connection.execute(checkDocPessoa, { idHospede }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const count = checkResult.rows[0].COUNT;

        if (count > 0) {
          // Atualizar CPF existente na DOCPESSOA
          const updateDocPessoa = `UPDATE DOCPESSOA SET NUMDOCUMENTO = :cpf WHERE IDPESSOA = :idHospede AND IDDOCUMENTO = -2`;
          await connection.execute(updateDocPessoa, { cpf: cpfLimpo, idHospede }, { autoCommit: false });
          updates.push('CPF atualizado na tabela DOCPESSOA');
        } else {
          // Inserir novo CPF na DOCPESSOA
          // Todos os campos opcionais são enviados como null conforme padrão do sistema
          const insertDocPessoa = `INSERT INTO DOCPESSOA
            (UF, ORGAO, NUMDOCUMENTO, IDPESSOA, IDPAIS, IDIMAGEM, IDIMAGEMVERSO, IDESTADO, IDDOCUMENTO, DATAVALIDADE, DATAEMISSAO)
            VALUES (null, null, :cpf, :idHospede, null, null, null, null, -2, null, null)`;
          await connection.execute(insertDocPessoa, { cpf: cpfLimpo, idHospede }, { autoCommit: false });
          updates.push('CPF inserido na tabela DOCPESSOA');
        }

        // Sempre atualizar NUMDOCUMENTO e IDDOCUMENTO na tabela PESSOA para manter sincronizado
        const updatePessoaDoc = `UPDATE PESSOA SET NUMDOCUMENTO = :cpf, IDDOCUMENTO = -2 WHERE IDPESSOA = :idHospede`;
        await connection.execute(updatePessoaDoc, { cpf: cpfLimpo, idHospede }, { autoCommit: false });
        updates.push('NUMDOCUMENTO e IDDOCUMENTO atualizados na tabela PESSOA');
      }
    }

    // 4. Atualizar ENDPESS (CEP, LOGRADOURO, NUMERO, COMPLEMENTO, BAIRRO, CIDADE/IDCIDADES)
    // Busca o IDENDRESIDENCIAL da PESSOA para vincular endereço e telefone
    const getIdEndereco = `SELECT IDENDRESIDENCIAL FROM PESSOA WHERE IDPESSOA = :idHospede`;
    const enderecoResult = await connection.execute(getIdEndereco, { idHospede }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (enderecoResult.rows.length > 0 && enderecoResult.rows[0].IDENDRESIDENCIAL) {
      const idEndereco = enderecoResult.rows[0].IDENDRESIDENCIAL;
      const enderecoUpdates = [];
      const enderecoParams = { idEndereco };

      // Buscar IDCIDADES na tabela CIDADES se o nome da cidade foi fornecido
      // Usa UPPER para busca case-insensitive
      let idCidades = null;
      if (cidade) {
        const getCidadeQuery = `SELECT IDCIDADES FROM CIDADES WHERE UPPER(NOME) = UPPER(:cidade)`;
        const cidadeResult = await connection.execute(getCidadeQuery, { cidade }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        if (cidadeResult.rows.length > 0) {
          idCidades = cidadeResult.rows[0].IDCIDADES;
          console.log(`✅ Cidade '${cidade}' encontrada com IDCIDADES: ${idCidades}`);
        } else {
          console.warn(`⚠️  Cidade '${cidade}' não encontrada na tabela CIDADES`);
        }
      }

      // Construir UPDATE dinâmico baseado nos campos disponíveis
      // Apenas campos com valor são incluídos no UPDATE
      if (cep) {
        const cepLimpo = cep.replace(/\D/g, '');
        // Validação básica: CEP deve ter exatamente 8 dígitos
        if (cepLimpo.length === 8) {
          enderecoUpdates.push('CEP = :cep');
          enderecoParams.cep = cepLimpo;
        } else {
          console.warn(`⚠️  CEP inválido (deve ter 8 dígitos): ${cepLimpo}`);
        }
      }

      if (endereco) {
        enderecoUpdates.push('LOGRADOURO = :logradouro');
        enderecoUpdates.push('NOME = :nome');
        enderecoParams.logradouro = endereco;
        enderecoParams.nome = endereco;
      }

      if (numero) {
        enderecoUpdates.push('NUMERO = :numero');
        enderecoParams.numero = numero;
      }

      if (complemento) {
        enderecoUpdates.push('COMPLEMENTO = :complemento');
        enderecoParams.complemento = complemento;
      }

      if (bairro) {
        enderecoUpdates.push('BAIRRO = :bairro');
        enderecoParams.bairro = bairro;
      }

      if (idCidades) {
        enderecoUpdates.push('IDCIDADES = :idCidades');
        enderecoParams.idCidades = idCidades;
      }

      // Executar UPDATE se houver campos para atualizar
      if (enderecoUpdates.length > 0) {
        const updateEndPess = `UPDATE ENDPESS SET ${enderecoUpdates.join(', ')} WHERE IDENDERECO = :idEndereco`;
        await connection.execute(updateEndPess, enderecoParams, { autoCommit: false });
        updates.push(`Endereço na tabela ENDPESS: ${enderecoUpdates.join(', ')}`);
      }
    }

    // 5. Inserir ou Atualizar TELEFONE na tabela TELENDPESS
    // TIPO = 'L' representa telefone residencial/local
    if (telefone && enderecoResult.rows.length > 0 && enderecoResult.rows[0].IDENDRESIDENCIAL) {
      const idEndereco = enderecoResult.rows[0].IDENDRESIDENCIAL;

      // Extrair apenas números do telefone e separar DDD do número
      // Exemplo: "(81) 99999-9999" -> DDD: "81", NUMERO: "999999999"
      const telefoneNumeros = telefone.replace(/\D/g, '');
      let ddd = null;
      let numero = telefoneNumeros;

      // Se tiver 10+ dígitos, separa DDD (2 primeiros) do resto
      if (telefoneNumeros.length >= 10) {
        ddd = telefoneNumeros.substring(0, 2);
        numero = telefoneNumeros.substring(2);
      }

      // Verificar se já existe telefone para este endereço
      const checkTelefone = `SELECT COUNT(*) as COUNT FROM TELENDPESS WHERE IDENDERECO = :idEndereco`;
      const checkTelResult = await connection.execute(checkTelefone, { idEndereco }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const telCount = checkTelResult.rows[0].COUNT;

      if (telCount > 0) {
        // Atualizar telefone existente (UPDATE)
        const updateTelefone = `UPDATE TELENDPESS SET NUMERO = :numero, DDD = :ddd, TIPO = 'L' WHERE IDENDERECO = :idEndereco`;
        await connection.execute(updateTelefone, { numero, ddd, idEndereco }, { autoCommit: false });
        updates.push('TELEFONE atualizado na tabela TELENDPESS');
      } else {
        // Inserir novo telefone (INSERT)
        // Buscar próximo IDTELEFONE da sequence Oracle
        const getNextIdQuery = `SELECT CM.SEQTELENDPESS.NEXTVAL AS NEXT FROM DUAL`;
        const nextIdResult = await connection.execute(getNextIdQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const idTelefone = nextIdResult.rows[0].NEXT;

        console.log(`📞 Obtido IDTELEFONE da sequence: ${idTelefone}`);

        // Inserir novo registro na TELENDPESS
        const insertTelefone = `INSERT INTO TELENDPESS
          (TIPO, NUMERO, IDTELEFONE, IDENDERECO, DDI, DDD)
          VALUES (:tipo, :numero, :idTelefone, :idEndereco, :ddi, :ddd)`;

        await connection.execute(insertTelefone, {
          tipo: 'L',        // Tipo: Local/Residencial
          numero,           // Número sem DDD
          idTelefone,       // ID gerado pela sequence
          idEndereco,       // FK para ENDPESS
          ddi: null,        // DDI (código internacional) - não utilizado
          ddd               // DDD (código de área)
        }, { autoCommit: false });

        updates.push('TELEFONE inserido na tabela TELENDPESS');
      }
    }

    // 6. Inserir registro na tabela CONTATOPESS se não existir
    // CONTATOPESS é uma tabela de contatos vinculada ao endereço
    // Apenas insere se não existir (não faz UPDATE para evitar sobrescrever dados existentes)
    if (enderecoResult.rows.length > 0 && enderecoResult.rows[0].IDENDRESIDENCIAL) {
      const idEndereco = enderecoResult.rows[0].IDENDRESIDENCIAL;

      // Verificar se já existe contato para este endereço para evitar duplicação
      const checkContato = `SELECT COUNT(*) as COUNT FROM CONTATOPESS WHERE IDENDERECO = :idEndereco`;
      const checkContatoResult = await connection.execute(checkContato, { idEndereco }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const contatoCount = checkContatoResult.rows[0].COUNT;

      if (contatoCount === 0) {
        // Buscar próximo IDCONTATO da sequence Oracle
        const getNextContatoQuery = `SELECT CM.SEQCONTATOPESS.NEXTVAL AS NEXT FROM DUAL`;
        const nextContatoResult = await connection.execute(getNextContatoQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const idContato = nextContatoResult.rows[0].NEXT;

        console.log(`📇 Obtido IDCONTATO da sequence: ${idContato}`);

        // Inserir novo registro na CONTATOPESS com campos vazios
        // Conforme padrão do sistema Oracle, todos os campos opcionais são null
        const insertContato = `INSERT INTO CONTATOPESS
          (SETOR, OBS, NOME, NASCIMENTO, IDENDERECO, IDCONTATO, EMAIL, CARGO, IDTIPOCONTATOPESS, FLGBLOQUEADO, FLGVISITA, FLGBOLETOPOREMAIL)
          VALUES (:setor, :obs, :nome, :nascimento, :idEndereco, :idContato, :email, :cargo, :idTipoContatoPess, :flgBloqueado, :flgVisita, :flgBoletoPorEmail)`;

        await connection.execute(insertContato, {
          setor: null,              // Setor do contato
          obs: null,                // Observações
          nome: null,               // Nome do contato
          nascimento: null,         // Data de nascimento
          idEndereco,               // FK para ENDPESS
          idContato,                // ID gerado pela sequence
          email: null,              // Email do contato
          cargo: null,              // Cargo do contato
          idTipoContatoPess: null,  // Tipo de contato
          flgBloqueado: null,       // Flag de bloqueio
          flgVisita: null,          // Flag de visita
          flgBoletoPorEmail: null   // Flag de envio de boleto por email
        }, { autoCommit: false });

        updates.push('Registro inserido na tabela CONTATOPESS');
      } else {
        console.log(`ℹ️  Registro já existe na CONTATOPESS para IDENDERECO ${idEndereco}, pulando inserção`);
      }
    }

    // Commit de todas as alterações
    await connection.commit();

    console.log(`✅ Dados atualizados no Oracle para IDHOSPEDE ${idHospede}: ${updates.join(', ')}`);

    return {
      success: true,
      updatedFields: updates,
      message: `Dados atualizados com sucesso: ${updates.join(', ')}`
    };
  } catch (error) {
    // Rollback em caso de erro
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('⚠️  Erro ao fazer rollback:', rollbackError.message);
    }

    console.error('❌ Erro ao atualizar dados do hóspede no Oracle:', error.message);
    throw error;
  } finally {
    try {
      await connection.close();
    } catch (closeError) {
      console.error('⚠️  Erro ao fechar conexão Oracle após atualizar dados:', closeError.message);
    }
  }
}

async function closeOraclePool() {
  if (!oraclePool) {
    return;
  }

  try {
    await oraclePool.close(10);
    oraclePool = null;
    console.log('✅ Pool de conexões Oracle encerrado');
  } catch (error) {
    console.error('❌ Erro ao encerrar pool Oracle:', error.message);
    throw error;
  }
}

module.exports = {
  initOraclePool,
  getOracleConnection,
  closeOraclePool,
  buscarReservaOracle,
  atualizarDadosHospedeOracle
};
