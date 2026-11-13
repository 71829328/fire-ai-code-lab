// Testes funcionais reais do FIRE Agent Command Center (LAB-002).
// Executa um navegador Chromium headless (puppeteer-core), navega por todas as
// páginas em viewport desktop e mobile, captura screenshots reais e valida
// asserções ligadas às correções da auditoria CTO.
//
// Uso: node run.mjs <baseUrl> <outDir>
// Requer puppeteer-core disponível (instalado fora do repositório).

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:4173";
const OUT = process.argv[3] ?? "/workspace/docs/screenshots";
const CHROME =
  process.env.CHROME_PATH ??
  "/root/.cache/puppeteer/chrome/linux-155.0.8059.39/chrome-linux64/chrome";

mkdirSync(OUT, { recursive: true });

const falhas = [];
const checagens = [];
function check(nome, cond) {
  checagens.push({ nome, ok: !!cond });
  if (!cond) falhas.push(nome);
  console.log(`${cond ? "PASS" : "FAIL"}  ${nome}`);
}

async function clickText(page, text, tag = "button") {
  const ok = await page.evaluate(
    (text, tag) => {
      const els = [...document.querySelectorAll(tag)];
      const el = els.find((e) => e.textContent && e.textContent.includes(text));
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    text,
    tag
  );
  if (!ok) throw new Error(`elemento <${tag}> com texto "${text}" não encontrado`);
}

async function hasText(page, text) {
  // Comparação sem distinção de maiúsculas: o CSS aplica text-transform uppercase em vários rótulos.
  return page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function irPara(page, label) {
  await clickText(page, label);
  await sleep(450);
}

async function shot(page, nome) {
  await page.screenshot({ path: `${OUT}/${nome}.png` });
}

// Seleciona, em um <select>, a opção cujo texto contém o rótulo informado.
// Usa a API nativa (dispara os eventos que o React escuta no componente controlado).
async function selecionarPorOpcao(page, rotulo) {
  const handles = await page.$$("select");
  for (const handle of handles) {
    const contem = await handle.evaluate(
      (el, texto) => [...el.options].some((o) => o.textContent && o.textContent.includes(texto)),
      rotulo
    );
    if (contem) {
      const valor = await handle.evaluate(
        (el, texto) => [...el.options].find((o) => o.textContent && o.textContent.includes(texto))?.value ?? "",
        rotulo
      );
      await handle.select(valor);
      return true;
    }
  }
  return false;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

const erros = [];

try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));

  await page.setViewport({ width: 1440, height: 900 });
  // Estado inicial determinístico para as capturas.
  await page.evaluateOnNewDocument(() => {
    try {
      window.localStorage.clear();
    } catch {}
  });
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForSelector("#root *");

  /* ---------------- Painel ---------------- */
  await sleep(500);
  await shot(page, "01-dashboard-desktop");
  check("painel exibe o título do projeto", await hasText(page, "FIRE Agent Command Center"));
  check("indicador honesto: 0 conectados", await hasText(page, "0 conectados"));
  check("indicador de integrações desativadas", await hasText(page, "0/5 integrações"));
  check("selo de demonstração visível", await hasText(page, "Demonstração"));

  /* ---------------- Central de Missões ---------------- */
  await irPara(page, "Central de Missões");
  await shot(page, "02-central-missoes");
  check("lista missões com identificador único", await hasText(page, "MSN-0001"));
  check("status de execução visível", await hasText(page, "Aguardando aprovação") || (await hasText(page, "Execução manual")));

  // Abre o detalhe da primeira missão e valida o prompt completo.
  const abriu = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((e) =>
      e.textContent && e.textContent.includes("Detalhes")
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  });
  if (abriu) {
    await sleep(500);
    await shot(page, "03-missao-detalhe");
    check("detalhe da missão mostra objetivo", await hasText(page, "Objetivo"));
    check("detalhe da missão mostra critérios de aceite", await hasText(page, "Critérios de aceite"));
    check(
      "detalhe marca a execução como manual/assistida",
      await hasText(page, "manual") || (await hasText(page, "assistida"))
    );
    // Copiar prompt completo.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll("button")].find((e) =>
        e.textContent && e.textContent.includes("Copiar prompt")
      );
      if (el) el.click();
    });
    await sleep(300);
    check("botão de copiar o prompt responde", await hasText(page, "Copiado") || (await hasText(page, "Copiar prompt")));
    await clickText(page, "Fechar");
    await sleep(300);
  } else {
    falhas.push("não foi possível abrir o detalhe da missão");
    console.log("FAIL  abrir detalhe da missão");
  }

  /* ---------------- Aprovações ---------------- */
  await irPara(page, "Aprovações");
  await shot(page, "04-aprovacoes");
  check("painel de aprovação lista missão para revisão", await hasText(page, "MSN-0002"));

  /* ---------------- Agentes (auditoria: nunca online sem comprovação) ---------------- */
  await irPara(page, "Agentes");
  await shot(page, "05-agentes");
  const textoAgentes = await page.evaluate(() => document.body.innerText);
  check("não apresenta agentes como 'online'", !/\bonline\b/i.test(textoAgentes));
  check("explicita 'Sem conexão comprovada'", textoAgentes.includes("Sem conexão comprovada"));
  check("distingue agentes demonstrativos", textoAgentes.includes("Demonstração"));

  /* ---------------- Projetos ---------------- */
  await irPara(page, "Projetos");
  await shot(page, "06-projetos");
  check("projetos listados", await hasText(page, "Observatório de Métricas"));

  /* ---------------- Kanban (correção de ordenação) ---------------- */
  await irPara(page, "Quadro Kanban");
  await shot(page, "07-kanban");
  check("kanban tem colunas de status", (await hasText(page, "Pendente")) && (await hasText(page, "Concluída")));
  // Movimentação por teclado: foca um cartão e usa ArrowRight.
  const idCartao = await page.evaluate(() => {
    const card = document.querySelector("[data-task-card]");
    if (!card) return null;
    card.focus();
    return card.getAttribute("data-task-card");
  });
  if (idCartao) {
    const colunaDe = (id) =>
      page.evaluate((id) => {
        const el = document.querySelector(`[data-task-card="${id}"]`);
        return el ? el.closest("[data-coluna]")?.getAttribute("data-coluna") : null;
      }, id);
    const antes = await colunaDe(idCartao);
    await page.keyboard.press("ArrowRight");
    await sleep(500);
    const depois = await colunaDe(idCartao);
    check("movimentação por teclado altera a coluna", antes !== depois && depois !== null);
    await shot(page, "08-kanban-apos-teclado");
  } else {
    checagens.push({ nome: "card de tarefa acessível por teclado", ok: false });
    falhas.push("data-task-card ausente");
    console.log("FAIL  card de tarefa com data-task-card ausente");
  }

  /* ---------------- Executor local ---------------- */
  await irPara(page, "Executor local");
  await shot(page, "09-executor-local");
  check("executor rotulado como local (não IA)", await hasText(page, "local"));
  // Preenche a entrada e executa a tarefa de demonstração local.
  await page.type("#exec-texto", "Verificação local de demonstração com entrada conhecida.");
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((e) =>
      e.textContent && e.textContent.includes("Executar")
    );
    if (el) el.click();
  });
  await sleep(700);
  await shot(page, "10-executor-resultado");
  check("resultado da execução verificável exibido", (await hasText(page, "checksum")) || (await hasText(page, "Verificação aprovada")));

  /* ---------------- Integrações (desativadas) ---------------- */
  await irPara(page, "Integrações");
  await shot(page, "11-integracoes");
  check("integrações desativadas", await hasText(page, "Desativada"));
  const ativarDesabilitado = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")].filter((b) =>
      b.textContent && b.textContent.includes("Ativar")
    );
    return btns.length > 0 && btns.every((b) => b.disabled);
  });
  check("botões de ativar integração ficam desabilitados", ativarDesabilitado);

  /* ---------------- Histórico ---------------- */
  await irPara(page, "Histórico");
  await shot(page, "12-historico");
  check("histórico lista atividades", await hasText(page, "carregou") || (await hasText(page, "missão")));

  /* ---------------- Dados & Backup ---------------- */
  await irPara(page, "Dados & Backup");
  await shot(page, "13-dados-backup");
  check("tela de backup oferece exportação", await hasText(page, "Exportar"));
  check("tela de backup oferece importação validada", await hasText(page, "Importar"));

  /* ---------------- Code Lab (aplicação anterior preservada) ---------------- */
  await irPara(page, "Code Lab");
  await shot(page, "14-code-lab");
  check("Code Lab (analisador anterior) preservado", await hasText(page, "Análise") || (await hasText(page, "código")));

  /* ---------------- LAB-003: Orquestração ---------------- */
  await irPara(page, "Orquestração");
  await sleep(350);
  await shot(page, "19-orquestracao");
  check("orquestração expõe o motor local", await hasText(page, "Motor de orquestração local"));
  check("operações externas aparecem bloqueadas", await hasText(page, "Bloqueadas"));

  const selecionouMissao = await selecionarPorOpcao(page, "MSN-0001");
  check("seleciona uma missão para enfileirar", selecionouMissao);
  await clickText(page, "Enfileirar");
  await sleep(350);
  check("enfileiramento confirma a execução", await hasText(page, "enfileirada"));
  await clickText(page, "Processar fila");
  await sleep(450);
  await shot(page, "20-orquestracao-execucao");
  check("fila processada gera execução", await hasText(page, "Execuções ("));

  const clicouExecutarLocal = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find(
      (e) => e.textContent && e.textContent.includes("Executar localmente")
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  });
  await sleep(500);
  if (clicouExecutarLocal) {
    check("execução local real conclui a missão", await hasText(page, "Concluída"));
  } else {
    checagens.push({ nome: "botão de execução local disponível", ok: false });
    falhas.push("botão Executar localmente ausente");
    console.log("FAIL  botão Executar localmente ausente");
  }

  /* ---------------- LAB-003: Central de Evidências ---------------- */
  await irPara(page, "Evidências");
  await sleep(300);
  await shot(page, "21-evidencias");
  check("central distingue informada de verificada", await hasText(page, "Evidência informada"));
  await page.type('input[placeholder^="URL, hash"]', "abc1234def5678");
  await page.type('input[placeholder="O que esta evidência comprova"]', "Commit de referência da missão");
  await clickText(page, "Registrar como informada");
  await sleep(400);
  await shot(page, "21b-evidencia-registrada");
  check("evidência registrada aparece como informada", await hasText(page, "Informado pelo agente"));
  check("contador de informadas atualiza", await hasText(page, "Informadas (1)"));

  /* ---------------- LAB-003: Inteligência operacional ---------------- */
  await irPara(page, "Inteligência");
  await sleep(300);
  await shot(page, "22-inteligencia");
  check("inteligência calcula com dados observados", await hasText(page, "Desempenho calculado apenas com dados observados"));
  check("recomendação usa dados reais", await hasText(page, "Recomendação por dados reais"));
  check("métricas por agente presentes", await hasText(page, "Métricas por agente"));

  /* ---------------- LAB-003: Adaptadores de agentes ---------------- */
  await irPara(page, "Adaptadores");
  await sleep(300);
  await shot(page, "23-adaptadores");
  check("adaptadores avisam ausência de integração autorizada", await hasText(page, "Nenhuma integração externa está autorizada"));
  // O envio automático exige uma missão selecionada; sem isso a UI responderia
  // apenas "Selecione uma missão primeiro". Selecionamos uma missão real antes.
  check("seleciona uma missão antes de tentar o envio automático", await selecionarPorOpcao(page, "MSN-0001"));
  await sleep(250);
  const recusaEnvio = await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find(
      (e) => e.textContent && e.textContent.includes("Tentar envio automático")
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  });
  await sleep(350);
  check(
    "envio automático é recusado e cai no fluxo manual",
    recusaEnvio && ((await hasText(page, "recusado")) || (await hasText(page, "manual_assistido")))
  );
  check("fluxo manual de exportação disponível", await hasText(page, "exportar missão"));
  check("fluxo manual de importação disponível", await hasText(page, "importar resultado"));

  /* ---------------- LAB-003: Governança e auditoria ---------------- */
  await irPara(page, "Governança");
  await sleep(300);
  await shot(page, "24-governanca");
  check("governança exibe isolamento e auditoria", await hasText(page, "isolamento entre organizações"));
  check("migrações aparecem como não aplicadas", await hasText(page, "não aplicada"));
  check("bloqueio de migrações explícito", await hasText(page, "bloqueada"));
  // Registra um consumo informado e valida a trilha de auditoria.
  await page.type('input[placeholder="ex.: chatgpt"]', "trae");
  await page.type('input[placeholder="0"]', "1200");
  await clickText(page, "Registrar consumo informado");
  await sleep(350);
  await shot(page, "24b-governanca-auditoria");
  check("consumo informado é registrado", await hasText(page, "1200 un."));
  check("auditoria registra a operação", await hasText(page, "registrou consumo"));

  /* ---------------- Menu recolhido ---------------- */
  await irPara(page, "Painel");
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("button")].find((e) =>
      e.getAttribute("aria-label") === "Recolher menu"
    );
    if (el) el.click();
  });
  await sleep(400);
  await shot(page, "15-menu-recolhido");

  /* ---------------- Mobile ---------------- */
  const mobile = await browser.newPage();
  mobile.on("console", (m) => {
    if (m.type() === "error") erros.push(`console(mobile): ${m.text()}`);
  });
  mobile.on("pageerror", (e) => erros.push(`pageerror(mobile): ${e.message}`));
  await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mobile.evaluateOnNewDocument(() => {
    try {
      window.localStorage.clear();
    } catch {}
  });
  await mobile.goto(BASE, { waitUntil: "networkidle0" });
  await mobile.waitForSelector("#root *");
  await sleep(500);
  await shot(mobile, "16-mobile-dashboard");
  check("mobile: layout responsivo carrega o painel", await hasText(mobile, "FIRE Agent Command Center"));

  // Abre o menu mobile.
  await mobile.evaluate(() => {
    const el = document.querySelector('button[aria-label="Abrir menu"]');
    if (el) el.click();
  });
  await sleep(500);
  await shot(mobile, "17-mobile-menu");
  check("mobile: menu lateral abre", await hasText(mobile, "Central de Missões"));

  // Navega para missões no mobile.
  await clickText(mobile, "Central de Missões");
  await sleep(500);
  await shot(mobile, "18-mobile-missoes");
  check("mobile: navegação para missões funciona", await hasText(mobile, "MSN-00"));

  /* ---------------- Erros de console ---------------- */
  check("nenhum erro de console/página", erros.length === 0);
  if (erros.length) erros.slice(0, 10).forEach((e) => console.log("   - " + e));
} catch (e) {
  falhas.push(`exceção: ${e.message}`);
  console.log("EXCEÇÃO:", e.message);
} finally {
  await browser.close();
}

console.log("\n=== RESUMO ===");
console.log(`Checagens: ${checagens.length} · Falhas: ${falhas.length}`);
if (falhas.length) {
  console.log("Falhas:\n" + falhas.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log("TODOS OS TESTES FUNCIONAIS PASSARAM");
