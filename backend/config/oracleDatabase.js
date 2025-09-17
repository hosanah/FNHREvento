'use strict';

/**
 * Configuração de conexão com Oracle Database usando pools
 */

const oracledb = require('oracledb');

let oraclePool = null;

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
  const connection = await getOracleConnection();

  try {
    const result = await connection.execute(
      `SELECT RF.IDRESERVASFRONT,
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
          AND RF.DATACHEGPREVISTA = :dataChegadaPrevista
          AND RF.DATAPARTPREVISTA = :dataPartidaPrevista
          AND H.NOME = :nomeHospede
          AND H.SOBRENOME = :sobrenomeHospede`,
      {
        dataChegadaPrevista,
        dataPartidaPrevista,
        nomeHospede,
        sobrenomeHospede
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      }
    );

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
  buscarReservaOracle
};
