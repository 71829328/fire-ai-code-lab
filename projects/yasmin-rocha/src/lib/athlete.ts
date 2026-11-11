export const IG_HANDLE = "yasmin_karate_";
export const IG_URL = "https://www.instagram.com/yasmin_karate_/";
export const IG_DM = "https://ig.me/m/yasmin_karate_";
export const SNAPSHOT_DATE = "2026-11-11";
export const BASELINE = { date: SNAPSHOT_DATE, followers: 6090, posts: 200, following: 1428 };

export const ACHIEVEMENTS = [
  {"title":"Seleção Brasileira","detail":"Convocação para o Sul-Americano de 2024","note":"SESI-SP • notícia de 06/06/2024","tag":"Brasil · 2024","sourceUrl":"https://cubatao.sesisp.org.br/noticia/atletas-do-sesi-cubatao-sao-convocadas-para-a-selecao-brasileira-de-karate"},
  {"title":"Seleção Brasileira","detail":"Convocação confirmada em maio de 2025","note":"SESI-SP • Seletiva Nacional 2","tag":"Brasil · 2025","sourceUrl":"https://cubatao.sesisp.org.br/noticia/sesi-karate-conquista-vaga-na-selecao-brasileira-e-fica-em-2o-lugar-geral-no-campeonato-paulista"},
  {"title":"1º lugar","detail":"Ranking estadual FPK 2025 · Sênior -68 kg","note":"Federação Paulista de Karatê • 1.260 pontos","tag":"Ranking · 2025","sourceUrl":"https://fpk.com.br/ranking-2025/211"},
  {"title":"Dois ouros","detail":"Campeonato Paulista 2025 · Sub-21 e Sênior","note":"SESI-SP • finais de maio de 2025","tag":"Paulista · 2025","sourceUrl":"https://cubatao.sesisp.org.br/noticia/sesi-karate-conquista-vaga-na-selecao-brasileira-e-fica-em-2o-lugar-geral-no-campeonato-paulista"},
  {"title":"Duas pratas","detail":"Campeonato Brasileiro 2025 · Sênior e Sub-21 -68 kg","note":"SESI-SP • Divisão Especial, novembro de 2025","tag":"Brasileiro · 2025","sourceUrl":"https://www.sesisp.org.br/esporte/noticia/caratecas-do-sesi-sp-conquistam-o-1o-lugar-na-divisao-especial-do-brasileiro"},
  {"title":"Ouro","detail":"Campeonato Paulista Universitário 2026","note":"SESI-SP • julho de 2026","tag":"Universitário · 2026","sourceUrl":"https://leopoldina.sesisp.org.br/noticia/sesi-sp-karate-conquista-medalhas-e-classificacoes-em-importantes-competicoes-nacionais-e-estaduais"},
  {"title":"5º lugar","detail":"Karate One Série A · México","note":"Resultado apresentado na bio do Instagram; data a confirmar","tag":"Internacional","sourceUrl":null},
  {"title":"Prata","detail":"Open de Portugal","note":"Resultado apresentado na bio do Instagram; ano a confirmar","tag":"Internacional","sourceUrl":null},
  {"title":"Bronze","detail":"Pan-Americano","note":"Resultado apresentado na bio do Instagram; ano a confirmar","tag":"Continental","sourceUrl":null},
  {"title":"Prata","detail":"Pan-Americano por equipes","note":"Resultado apresentado na bio do Instagram; ano a confirmar","tag":"Continental","sourceUrl":null},
];

// O ranking nacional CBK 2025 consta do mídia kit preliminar, porém ainda requer
// confirmação em fonte primária antes de ser usado como prova comercial pública.

export const PILLARS = [
  { id: "tecnica", label: "Técnica e evolução" },
  { id: "bastidor", label: "Bastidor real" },
  { id: "rotina", label: "Rotina e mentalidade" },
  { id: "conquista", label: "Conquista e prova" },
  { id: "comunidade", label: "Conexão com comunidade" },
] as const;
export type PillarId = (typeof PILLARS)[number]["id"];
export const FORMATS = ["Reel", "Carrossel", "Foto", "Stories", "Collab"] as const;
export const STATUSES = ["ideia", "roteiro", "gravado", "publicado"] as const;

export const IDEAS: { title: string; pillar: PillarId; format: string; hook: string; script: string; cta: string }[] = [
  { title: "Um golpe em câmera lenta", pillar: "tecnica", format: "Reel", hook: "Isso dura menos de meio segundo.", script: "Golpe em velocidade real → mesmo golpe em 0.25x → 3 detalhes na tela (base, quadril, retorno).", cta: "Qual golpe você quer ver depois?" },
  { title: "Antes da luta: os 10 minutos", pillar: "bastidor", format: "Reel", hook: "O que ninguém vê antes de eu entrar no tatame.", script: "Aquecimento, fone, respiração, última conversa com o técnico. Sem narração, só texto curto.", cta: "Salve para lembrar no seu próximo desafio." },
  { title: "Kumite −68 kg explicado", pillar: "tecnica", format: "Carrossel", hook: "Você sabe como se ganha ponto no kumite?", script: "6 slides: categoria, área, pontuação (yuko/waza-ari/ippon), tempo, penalidades, um lance real.", cta: "Mande para quem acha que karatê é só faixa." },
  { title: "Um dia de treino no SESI", pillar: "rotina", format: "Reel", hook: "Meu dia em 30 segundos.", script: "Cortes rápidos: acordar, estudo/rotina, treino técnico, físico, recuperação. Relógio na tela.", cta: "Conta nos comentários como é sua rotina." },
  { title: "A medalha e a história dela", pillar: "conquista", format: "Carrossel", hook: "Essa medalha tem uma história.", script: "Foto da medalha → contexto da competição → o que deu errado → o que aprendi → agradecimento.", cta: "Siga para acompanhar a próxima." },
  { title: "Mala de competição internacional", pillar: "bastidor", format: "Reel", hook: "O que vai na mala de uma atleta da Seleção.", script: "Montar a mala item por item: quimono, protetores, faixa, itens pessoais. Final: portão de embarque.", cta: "Qual item você nunca esqueceria?" },
  { title: "O que eu diria pra mim aos 12", pillar: "rotina", format: "Reel", hook: "Se eu pudesse falar com a Yasmin de 12 anos…", script: "Fala direta para a câmera, 3 frases, foto antiga como fundo (se autorizado).", cta: "Marca alguém que está começando." },
  { title: "Treino com alunos/crianças", pillar: "comunidade", format: "Collab", hook: "Elas me ensinaram mais do que eu ensinei.", script: "Collab com academia/projeto local: exercício simples, reações, mensagem final. Só com autorização de imagem.", cta: "Conhece um projeto de esporte na sua cidade?" },
  { title: "Errei aqui (análise de luta)", pillar: "tecnica", format: "Reel", hook: "Perdi esse ponto. Vou te mostrar por quê.", script: "Trecho da luta, pausa, círculo no erro, versão corrigida no treino.", cta: "Quer mais análises assim?" },
  { title: "Perguntas da comunidade", pillar: "comunidade", format: "Stories", hook: "Caixinha: me pergunte qualquer coisa sobre karatê.", script: "Caixinha nos stories → responder 5 em vídeo curto → reunir no destaque 'Minha história'.", cta: "Manda sua pergunta!" },
];