# Guia de publicação no IIS

Este documento descreve como publicar o frontend Angular e a API Node.js do projeto **FNRHEvento** em um servidor Windows utilizando o Internet Information Services (IIS). Os passos abaixo consideram um ambiente Windows Server 2019 ou superior, com privilégios de administrador.

## 📋 Pré-requisitos gerais

1. **Atualizações do Windows** instaladas e servidor reiniciado recentemente.
2. **Node.js LTS** instalado em `C:\\Program Files\\nodejs` e adicionado ao `PATH`.
3. **Git** instalado (opcional, mas útil para obter o código).
4. **Visual C++ Redistributable** (recomendado para evitar erros em dependências nativas).
5. A feature **IIS** habilitada com os seguintes componentes:
   - `Serviços Web > Ferramentas de gerenciamento > Console do IIS`;
   - `Serviços Web > Desenvolvimento de Aplicativos > Extensibilidade .NET`, `ASP`, `CGI` (necessário para o módulo iisnode);
   - `Serviços Web > Ferramentas de gerenciamento > Ferramentas de Compatibilidade` (para facilitar a configuração).
6. **Módulo URL Rewrite** e **Application Request Routing (ARR)** instalados para viabilizar o uso do IIS como proxy reverso.
7. (Opcional) **NSSM** ou **PM2 Windows Service** para executar o backend como serviço do Windows.

> 💡 Se o servidor estiver atrás de um firewall corporativo, verifique as portas necessárias (por padrão 80/443 para o IIS e 3000 para o Node.js se for acessado diretamente).

## 🌐 Publicação do frontend (Angular)

### 1. Preparar o build

1. Abra um **PowerShell** ou **Prompt de Comando** como administrador.
2. Navegue até a pasta `frontend` e instale as dependências:
   ```powershell
   cd C:\\caminho\\para\\o\\repositorio\\frontend
   npm install
   ```
3. Defina a URL da API que o frontend deve consumir. No Windows, você pode exportar antes do build:
   ```powershell
   setx NG_APP_API_URL "https://api.exemplo.com"
   ```
   > Use a URL pública que o backend terá no IIS (por exemplo, `https://api.meudominio.com`).
4. Gere os artefatos de produção:
   ```powershell
   npm run build
   ```
   O resultado ficará em `frontend\\dist\\frontend`.

### 2. Publicar os arquivos estáticos no IIS

1. Copie o conteúdo de `dist\\frontend` para a pasta onde o site será hospedado, por exemplo `C:\\inetpub\\wwwroot\\fnhrevento-frontend`.
2. No **Gerenciador do IIS**, crie um **Novo Site**:
   - Nome do site: `FNHREvento Frontend`.
   - Caminho físico: `C:\\inetpub\\wwwroot\\fnhrevento-frontend`.
   - Porta: `80` (ou outra disponível). Configure um hostname se for necessário.
3. Para garantir que o Angular trate as rotas corretamente, adicione um arquivo `web.config` na raiz do site (mesma pasta do `index.html`) com o conteúdo abaixo:

   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="Angular Routes" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
             </conditions>
             <action type="Rewrite" url="/index.html" />
           </rule>
         </rules>
       </rewrite>
       <staticContent>
         <mimeMap fileExtension=".json" mimeType="application/json" />
         <mimeMap fileExtension=".webp" mimeType="image/webp" />
       </staticContent>
     </system.webServer>
   </configuration>
   ```
4. Recicle o pool de aplicativos ou reinicie o site para aplicar as alterações.
5. Acesse `http://seu-dominio/` e verifique se a aplicação carrega corretamente.

## ⚙️ Publicação do backend (API Node.js)

Você pode optar por duas abordagens: hospedar o Node.js dentro do IIS com **iisnode** ou manter o Node rodando como serviço e usar o IIS apenas como proxy reverso. A segunda abordagem costuma ser mais simples de manter.

### Opção A — Node.js como serviço + proxy reverso no IIS (recomendado)

1. **Instalar dependências do projeto**
   ```powershell
   cd C:\\caminho\\para\\o\\repositorio\\backend
   npm install
   ```
2. **Configurar variáveis de ambiente** (PostgreSQL, Oracle, CORS, etc.). Crie um arquivo `.env` ou utilize as variáveis do sistema. Exemplo no PowerShell:
   ```powershell
   setx DB_HOST "localhost"
   setx DB_PORT "5432"
   setx DB_NAME "fnhrevento"
   setx DB_USER "postgres"
   setx DB_PASSWORD "postgres"
   setx CORS_ORIGIN "https://app.meudominio.com"
   ```
3. **Registrar o serviço** que executará a API:
   - Com o **NSSM**: `nssm install FNHREventoApi "C:\\Program Files\\nodejs\\node.exe" "C:\\caminho\\para\\o\\repositorio\\backend\\server.js"`
   - Configure o diretório de trabalho para `...\\backend` e o `Startup directory` para a mesma pasta.
   - Ajuste o modo de inicialização para **Automático** e inicie o serviço.
4. **Configurar o proxy no IIS**:
   - Crie um site ou use um site existente (por exemplo `https://api.meudominio.com`).
   - Nas **Regras de Reescrita (URL Rewrite)**, adicione uma regra de proxy reverso:
     - Padrão: `.*`
     - Destino: `http://localhost:3000/{R:0}`
     - Habilite `Proxy` em **ARR**.
   - Adicione cabeçalhos `X-Forwarded-For` e `X-Forwarded-Proto` se desejar preservar informações de origem.
5. **Testar**: acesse `https://api.meudominio.com/health` e confirme que o status HTTP 200 é retornado.

### Opção B — iisnode (executar Node dentro do IIS)

> Use esta abordagem apenas se já tiver familiaridade com o módulo iisnode, pois o suporte oficial é limitado.

1. Instale o [iisnode](https://github.com/tjanczuk/iisnode) compatível com sua versão do IIS.
2. Copie a pasta `backend` para `C:\\inetpub\\wwwroot\\fnhrevento-backend`.
3. Crie um arquivo `web.config` nessa pasta com o conteúdo:

   ```xml
   <?xml version="1.0"?>
   <configuration>
     <system.webServer>
       <handlers>
         <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
       </handlers>
       <rewrite>
         <rules>
           <rule name="API" patternSyntax="ECMAScript" stopProcessing="true">
             <match url=".*" />
             <action type="Rewrite" url="server.js" />
           </rule>
         </rules>
       </rewrite>
       <security>
         <requestFiltering>
           <hiddenSegments>
             <add segment="node_modules" />
           </hiddenSegments>
         </requestFiltering>
       </security>
     </system.webServer>
   </configuration>
   ```
4. No IIS, crie um novo site apontando para essa pasta e configure o pool de aplicativos para usar **No Managed Code**.
5. Configure as variáveis de ambiente necessárias diretamente no pool de aplicativos ou via arquivo `.env`.
6. Reinicie o site e teste `https://api.meudominio.com/health`.

## 🔍 Pós-publicação e monitoramento

- **Logs**: mantenha logs de acesso e de aplicação (pode usar o módulo `winston` no backend). Para o Node em serviço, redirecione a saída para um arquivo.
- **Reciclagem**: agende reciclagem do pool do frontend fora do horário comercial para liberar memória.
- **Backups**: faça backup periódico das pastas `dist` (frontend) e do código da API.
- **Segurança**: habilite HTTPS com certificados válidos (Let's Encrypt ou AC empresarial) e restrinja o acesso ao console do IIS.
- **Monitoramento**: utilize o `IIS Manager` ou ferramentas como o `Performance Monitor` para verificar consumo de CPU e memória.

## ✅ Checklist rápido

- [ ] Dependências instaladas (`npm install` em `frontend` e `backend`).
- [ ] Variáveis de ambiente configuradas.
- [ ] Build Angular copiado para o diretório do site.
- [ ] `web.config` do frontend com regra SPA aplicado.
- [ ] Backend em execução como serviço ou via iisnode.
- [ ] Regra de proxy reverso direcionando para a API.
- [ ] Teste de `https://api.meudominio.com/health` aprovado.
- [ ] Teste completo no navegador.

Seguindo este guia você terá o frontend Angular e a API Node.js publicados no IIS, com rotas amigáveis e proxy reverso configurado.
