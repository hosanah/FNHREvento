# Guia de Publicação no IIS - FNRHEvento

Este guia detalha os passos para publicar o FNRHEvento no IIS.

## 📋 Pré-requisitos

- IIS instalado com módulo de rewrite
- Node.js instalado no servidor
- Oracle Instant Client configurado (veja `backend/scripts/ORACLE_INSTANT_CLIENT_SETUP.md`)
- iisnode instalado

## 🔨 Preparação dos Arquivos

### 1. Build do Frontend

```bash
cd frontend
ng build --configuration production
```

Saída: `frontend/dist/frontend/browser/`

### 2. Preparação do Backend

O backend já está pronto na pasta `backend/`.

## 📁 Estrutura de Pastas no IIS

Crie a seguinte estrutura em `C:\inetpub\wwwroot\`:

```
C:\inetpub\wwwroot\fnrhevento\
├── frontend\          # Conteúdo de frontend/dist/frontend/browser/
│   ├── index.html
│   ├── web.config
│   ├── *.js
│   ├── *.css
│   └── assets\
└── backend\           # Cópia completa da pasta backend/
    ├── server.js
    ├── web.config
    ├── package.json
    ├── config\
    ├── routes\
    └── node_modules\
```

## 📦 Passos de Publicação

### Passo 1: Copiar Frontend

```powershell
# Criar diretório se não existir
New-Item -ItemType Directory -Force -Path C:\inetpub\wwwroot\fnrhevento\frontend

# Copiar arquivos do build
xcopy /E /Y .\frontend\dist\frontend\browser\* C:\inetpub\wwwroot\fnrhevento\frontend\
```

### Passo 2: Copiar Backend

```powershell
# Criar diretório se não existir
New-Item -ItemType Directory -Force -Path C:\inetpub\wwwroot\fnrhevento\backend

# Copiar arquivos do backend (exceto node_modules)
xcopy /E /Y /EXCLUDE:exclude.txt .\backend\* C:\inetpub\wwwroot\fnrhevento\backend\
```

**Crie o arquivo `exclude.txt` com:**
```
node_modules
uploads
*.db
*.log
.env.development
```

### Passo 3: Instalar Dependências do Backend

```powershell
cd C:\inetpub\wwwroot\fnrhevento\backend
npm install --production
```

### Passo 4: Configurar Variáveis de Ambiente

Edite `C:\inetpub\wwwroot\fnrhevento\backend\web.config` e ajuste as variáveis:

```xml
<iisnode node_env="production" ...>
  <environmentVariables>
    <add name="NODE_ENV" value="production" />
    <add name="ORACLE_CLIENT_LIB_DIR" value="C:\oracle\instantclient_19_11" />
    <!-- Adicione outras variáveis conforme necessário -->
  </environmentVariables>
</iisnode>
```

## 🌐 Configuração do IIS

### 1. Criar Aplicação no IIS

1. Abra o **Gerenciador do IIS**
2. Expanda **Sites** → **Default Web Site**
3. Clique com botão direito → **Add Application**
   - **Alias**: `fnrhevento`
   - **Physical path**: `C:\inetpub\wwwroot\fnrhevento\frontend`
   - Clique **OK**

### 2. Configurar Backend como Aplicação

1. Clique com botão direito em **fnrhevento**
2. **Add Application**
   - **Alias**: `backend`
   - **Physical path**: `C:\inetpub\wwwroot\fnrhevento\backend`
   - Clique **OK**

### 3. Verificar URL Rewrite

1. Selecione a aplicação **fnrhevento**
2. Duplo clique em **URL Rewrite**
3. Verifique se a regra "Angular Routes" está presente
4. Se não estiver, o web.config não foi copiado corretamente

### 4. Configurar Permissões

```powershell
# Dar permissão de leitura para IIS_IUSRS
icacls "C:\inetpub\wwwroot\fnrhevento" /grant "IIS_IUSRS:(OI)(CI)R" /T

# Dar permissão de escrita para uploads (backend)
icacls "C:\inetpub\wwwroot\fnrhevento\backend\uploads" /grant "IIS_IUSRS:(OI)(CI)M" /T
```

## 🔍 Verificação

### URLs para Testar

1. **Frontend**: `http://localhost/fnrhevento/`
2. **Backend**: `http://localhost/fnrhevento/backend/`
3. **API Health**: `http://localhost/fnrhevento/backend/health`
4. **Swagger**: `http://localhost/fnrhevento/backend/api-docs`

### Comandos de Verificação

```powershell
# Verificar se o IIS está rodando
Get-Service W3SVC

# Testar backend
Invoke-WebRequest -Uri "http://localhost/fnrhevento/backend/health"

# Verificar logs do iisnode
Get-Content "C:\inetpub\wwwroot\fnrhevento\backend\iisnode\*.log" -Tail 50
```

## 🐛 Troubleshooting

### Erro 500.19 - Invalid Configuration

**Causa**: Problema no web.config

**Solução**:
1. Verifique se o módulo URL Rewrite está instalado
2. Valide o XML do web.config
3. Remova seções duplicadas (MIME types, etc.)

### Erro 502.2 - Bad Gateway (Backend)

**Causa**: Node.js não está respondendo

**Solução**:
1. Verifique se o iisnode está instalado
2. Verifique logs em `backend\iisnode\`
3. Verifique variáveis de ambiente no web.config

### Erro 404 nas Rotas do Angular

**Causa**: URL Rewrite não está funcionando

**Solução**:
1. Instale o módulo URL Rewrite
2. Verifique se web.config está na pasta browser/
3. Verifique permissões de leitura

### Oracle Connection Error

**Causa**: Oracle Instant Client não configurado

**Solução**:
1. Siga `backend/scripts/ORACLE_INSTANT_CLIENT_SETUP.md`
2. Verifique variável `ORACLE_CLIENT_LIB_DIR` no web.config
3. Reinicie o IIS: `iisreset`

## 📝 Checklist de Publicação

- [ ] Build do frontend executado
- [ ] Arquivos copiados para `C:\inetpub\wwwroot\fnrhevento\`
- [ ] `npm install --production` executado no backend
- [ ] Aplicações criadas no IIS (frontend e backend)
- [ ] Permissões configuradas
- [ ] Variáveis de ambiente ajustadas
- [ ] Oracle Instant Client configurado
- [ ] URLs testadas e funcionando
- [ ] Logs verificados sem erros

## 🔄 Atualização (Re-deploy)

Para atualizar a aplicação:

```powershell
# Parar o app pool (opcional, mas recomendado)
Stop-WebAppPool -Name "DefaultAppPool"

# Atualizar frontend
xcopy /E /Y .\frontend\dist\frontend\browser\* C:\inetpub\wwwroot\fnrhevento\frontend\

# Atualizar backend (cuidado com node_modules!)
xcopy /E /Y /EXCLUDE:exclude.txt .\backend\* C:\inetpub\wwwroot\fnrhevento\backend\

# Reiniciar IIS
iisreset

# Ou apenas reiniciar o app pool
Start-WebAppPool -Name "DefaultAppPool"
```

## 📞 Suporte

- Documentação oficial do IIS: https://docs.microsoft.com/iis
- Documentação do iisnode: https://github.com/tjanczuk/iisnode
- Oracle Instant Client: `backend/scripts/ORACLE_INSTANT_CLIENT_SETUP.md`
