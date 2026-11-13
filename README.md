# FIRE Agent Command Center

Aplicação web demonstrativa para **gerenciamento de agentes de IA, projetos e tarefas**, com
interface premium em português brasileiro (fundo escuro, glassmorphism e acentos nas cores
FIRE: laranja, azul-ciano e roxo).

> ⚠️ **Aviso de escopo:** todos os agentes, projetos e tarefas exibidos já na primeira
> execução são **dados demonstrativos**. Nenhum agente está conectado a um serviço real,
> API paga ou modelo externo. Os registros de exemplo carregam o selo **“Demonstração”**.

## Funcionalidades

- **Painel (Dashboard):** indicadores de agentes, projetos e tarefas, gráfico de rosca da
  distribuição de tarefas, carga por agente, progresso dos projetos e atividades recentes.
- **Agentes:** cadastro, edição e exclusão com busca por nome/papel/modelo e filtro por status.
- **Projetos:** cadastro e gerenciamento com responsável, prioridade, prazo e progresso.
- **Quadro Kanban:** tarefas em *Pendente*, *Em execução* e *Concluída*, com **arrastar e soltar**
  entre colunas, além de filtro por projeto e busca.
- **Histórico:** linha do tempo das ações com busca e filtro por tipo.
- **Persistência local:** todo o estado é salvo no `localStorage` do navegador (sem backend).
- **Interface responsiva:** layout adaptado para computador e celular, com menu lateral
  recolhível no desktop e em gaveta no mobile.
- **Acessibilidade básica:** rótulos ARIA, foco visível e navegação por teclado nos modais.

## Tecnologias

- [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) 5
- [Tailwind CSS](https://tailwindcss.com/) 3
- [lucide-react](https://lucide.dev/) para ícones
- [Vitest](https://vitest.dev/) para testes automatizados

Sem serviços pagos, credenciais externas ou APIs comerciais. Gráficos são SVG próprios, sem
bibliotecas de terceiros.

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

## Estrutura

```
src/
  App.tsx                     # roteamento simples entre as páginas
  main.tsx                    # bootstrap React
  style.css                   # Tailwind + camadas de estilo (glass, glow, animações)
  types.ts                    # modelo de domínio
  data/seed.ts                # dados demonstrativos iniciais
  store/
    reducer.ts                # lógica pura de estado (ações + atividades)
    StoreContext.tsx          # contexto React + persistência em localStorage
    selectors.ts              # estatísticas e séries para gráficos
  components/
    layout/AppShell.tsx       # menu lateral recolhível + barra superior
    ui/                       # Modal, cartões de indicadores, badges, estado vazio
    charts/Charts.tsx         # gráficos de rosca, barras e progresso em SVG
  pages/                      # Dashboard, Agents, Projects, Kanban, History
```

## Dados e privacidade

- Nenhuma chamada de rede é realizada pela aplicação em tempo de execução.
- O estado fica apenas no navegador do usuário (`localStorage`). O botão **“Restaurar demo”**
  recompõe o conjunto demonstrativo inicial.
- O módulo legado `src/analyzer.ts` (com `src/analyzer.test.ts`) foi **preservado** do
  protótipo anterior; ele é um analisador heurístico puro, coberto por testes, e não é usado
  pela interface do Command Center.

## Limitações

- Os dados são **demonstrativos** e não representam agentes realmente conectados.
- Não há autenticação, multiusuário, sincronização em nuvem ou backend.
- O arrastar e soltar usa a API nativa de *drag and drop* do HTML5, sem bibliotecas externas.
- Esta aplicação não contém código-fonte privado da FIRE Intelligence nem dados de clientes.
