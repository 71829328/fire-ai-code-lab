// =====================================================================
// FIRE Agent Command Center — LAB-004
// Adaptador fino do runtime serverless do Vercel.
//
// Este arquivo é a ÚNICA função serverless. Ele captura qualquer caminho sob
// /api (ex.: /api/auth/login, /api/missoes, /api/execucoes/processar) e delega
// ao roteador interno (src/server/router.ts), onde rate limiting, autenticação,
// autorização e validação são aplicados. Toda a lógica de negócio vive em
// src/server/ — este arquivo apenas liga o runtime ao roteador.
// =====================================================================

import { criarHandler } from "../src/server/vercelAdapter";

export default criarHandler();
