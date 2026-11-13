# FIRE Agent Command Center

Central operacional demonstrativa para **gerenciamento de missões de inteligência artificial**,
com agentes, projetos, tarefas, executor local, camada de integrações e backup, em interface
premium (fundo escuro, glassmorphism e acentos FIRE: laranja, azul-ciano e roxo).

> ⚠️ **Aviso de escopo:** todos os agentes, projetos, tarefas e missões exibidos já na primeira
> execução são **dados demonstrativos**. Nenhum agente está conectado a um serviço real, API
> paga ou modelo externo, e **nenhuma integração externa está ativa**. Os registros de exemplo
> carregam o selo **“Demonstração”**.

## Histórico de missões

- **LAB-001** — FIRE Agent Command Center: painel de agentes, projetos, tarefas e Kanban.
- **LAB-002** (esta entrega) — evolução para **central de missões**, correções da auditoria CTO,
  camada operacional e endurecimento de segurança/qualidade. Não houve reconstrução: a base do
  LAB-001 foi preservada e ampliada.

## Funcionalidades

### Central de Missões
- Cadastro de missões com **identificador único** (`MSN-0001`, `MSN-0002`, …).
- Objetivo, instruções, prioridade e **critérios de aceite**.
- Agente responsável e projeto vinculado.
- **Dependências entre missões** (com verificação de dependências satisfeitas).
- **Histórico de execução** por missão e **registro de evidências, commits, resultados e relatórios**.
- Status de execução: **pendente, execução manual, aguardando aprovação, concluída e bloqueada**.
- Botão para **copiar o prompt completo** da missão.
- **Importação manual de relatórios** de execução (marcados como importados).
- **Painel de aprovação e revisão técnica** (aprovar, solicitar ajustes, bloquear).

### Camada operacional
- Interfaces de integração preparadas para **ChatGPT, Codex, Work, TRAE e Manus**, sempre
  **desativadas** enquanto não houver acesso real autorizado e validado. O botão de ativação
  permanece desabilitado por padrão; a maior transição permitida é “aguardando autorização”.
- **Executor local de demonstração** verificável: processa o texto inteiramente no navegador
  (métricas + checksum FNV-1a reconferido por caminho independente), sem APIs externas, e
  **distingue explicitamente execução local de execução por IA**.

### Correções da auditoria CTO
- **Cadastrado × demonstrativo × conectado**: distinção explícita; agentes nunca aparecem como
  “conectados” sem comprovação real (a conexão só é “verificada” com data de verificação válida).
- **Ordenação do Kanban** calculada sobre **todas** as tarefas da coluna, inclusive com filtros ativos.
- **Movimentação acessível** por arrastar-e-soltar, por botões **← / →** e por **teclado** (setas).
- **Confirmação de exclusões** e **restauração** dos dados demonstrativos.
- **Validação integral** dos dados armazenados/importados, com migração do formato anterior (v1 → v2)
  e descarte de registros irrecuperáveis.
- **Falhas de persistência** comunicadas ao usuário (banner dedicado).
- **Exportação e importação segura de backup** (envelope versionado, validado antes de aplicar).

### Recursos herdados (LAB-001) e preservados
- Painel, Agentes, Projetos, Quadro Kanban e Histórico.
- **Dados & Backup**: exportar/importar o estado como JSON.
- **Code Lab**: aplicação anterior de análise de código, mantida em **módulo separado**
  (`src/analyzer.ts` + `src/analyzer.test.ts`), consumida por uma página própria.

## Tecnologias

- [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) 8
- [Tailwind CSS](https://tailwindcss.com/) 3
- [lucide-react](https://lucide.dev/) para ícones
- [Vitest](https://vitest.dev/) 5 para testes automatizados

Sem serviços pagos, credenciais externas ou APIs comerciais. Gráficos são SVG próprios.

## Como executar

Requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev        # ambiente de desenvolvimento
npm test           # testes automatizados (Vitest)
npm run typecheck  # verificação de tipos (tsc --noEmit)
npm run build      # build de produção (tsc -b && vite build)
npm run preview    # prévia do build de produção
```

### Testes funcionais (desktop + mobile)

O script `scripts/functional-tests.mjs` executa um Chromium headless (via `puppeteer-core`),
navega por todas as páginas, valida as correções da auditoria e gera as capturas em
`docs/screenshots/`. Ele requer `puppeteer-core` disponível no ambiente de execução:

```bash
npm run preview -- --port 4173 &
node scripts/functional-tests.mjs http://localhost:4173 docs/screenshots
```

## Estrutura

```
src/
  App.tsx                     # roteamento simples entre as páginas
  main.tsx                    # bootstrap React
  style.css                   # Tailwind + camadas de estilo (glass, glow, animações)
  types.ts                    # modelo de domínio (v2)
  data/seed.ts                # dados demonstrativos iniciais
  domain/
    ordering.ts               # ordenação do Kanban (correção da auditoria)
    validation.ts             # validação/migração dos dados armazenados
    backup.ts                 # exportação/importação segura de backup
    localExecutor.ts          # executor local determinístico (não é IA)
    missionPrompt.ts          # geração do prompt completo da missão
  store/
    reducer.ts                # lógica pura de estado (ações + atividades)
    StoreContext.tsx          # contexto React + persistência em localStorage
    selectors.ts              # estatísticas e séries para gráficos
  components/
    layout/AppShell.tsx       # menu lateral recolhível + barra superior
    ui/                       # Modal, badges, ConfirmDialog, CopyButton, PersistenceBanner
    charts/Charts.tsx         # gráficos de rosca, barras e progresso em SVG
  pages/                      # Dashboard, Missions, Approvals, Agents, Projects, Kanban,
                              # LocalExecutor, Integrations, History, DataBackup, CodeLab
scripts/
  functional-tests.mjs        # testes funcionais reais + capturas (desktop/mobile)
docs/screenshots/             # evidências visuais (desktop e mobile)
```

## Dados e privacidade

- Nenhuma chamada de rede é realizada pela aplicação em tempo de execução.
- O estado fica apenas no navegador do usuário (`localStorage`, chave
  `fire-agent-command-center:state:v2`). **Dados & Backup** permite exportar/importar um JSON
  validado, e **Restaurar demo** recompõe o conjunto demonstrativo inicial.
- O módulo legado `src/analyzer.ts` (com `src/analyzer.test.ts`) foi **preservado**, é um
  analisador heurístico puro coberto por testes e é exposto na página **Code Lab**.

## Segurança

- Nenhuma credencial real é utilizada; nenhum gasto é gerado e nenhum deploy/merge é realizado.
- Backup passa por validação integral antes de ser aplicado; integrações nunca são ativadas
  sem comprovação de acesso real.
- `npm audit` sem vulnerabilidades conhecidas após atualização das dependências de
  desenvolvimento (Vite 8 / Vitest 5).

## Limitações

- Os dados são **demonstrativos** e não representam agentes realmente conectados.
- Não há autenticação, multiusuário, sincronização em nuvem ou backend.
- As integrações externas permanecem **desativadas** por design (faltam acesso autorizado e validado).
- O arrastar e soltar usa a API nativa de *drag and drop* do HTML5, sem bibliotecas externas.
- O arquivo `package-lock.json` foi regenerado com o registry oficial do npm para a auditoria de
  dependências; em ambientes com mirror próprio, reinstale com o registry local se necessário.
- Esta aplicação não contém código-fonte privado da FIRE Intelligence nem dados de clientes.
