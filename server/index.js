import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const dbPath = resolve(rootDir, "data", "atendedor-db.json");
const distDir = resolve(rootDir, "dist");
const port = Number(process.env.PORT ?? 3333);
const sessionSecret = process.env.SESSION_SECRET ?? "atendedor-2-local-dev-secret";
const databaseUrl = process.env.DATABASE_URL;
const databaseUrlInfo = getDatabaseUrlInfo(databaseUrl);
const { Pool } = pg;
const pgPool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;
let storageMode = pgPool ? "postgres" : "local-json";
let lastPostgresError = "";
let lastPostgresMessage = "";


function getDatabaseUrlInfo(url) {
  if (!url) return { configured: false };

  try {
    const parsed = new URL(url);
    return {
      configured: true,
      protocol: parsed.protocol.replace(":", ""),
      username: parsed.username ? `${parsed.username.slice(0, 18)}${parsed.username.length > 18 ? "..." : ""}` : "",
      passwordPresent: Boolean(parsed.password),
      host: parsed.hostname,
      port: parsed.port || "default",
      database: parsed.pathname.replace(/^\//, "") || "default",
      looksLikeSupabasePooler: parsed.hostname.includes("pooler.supabase"),
      looksLikeSupabaseDirect: parsed.hostname.includes("supabase.co"),
    };
  } catch {
    return { configured: true, invalidUrl: true };
  }
}

async function probePostgres() {
  if (!pgPool) {
    return { postgresConfigured: false, postgresHealthy: false, error: "DATABASE_URL ausente" };
  }

  try {
    await pgPool.query("SELECT 1");
    storageMode = "postgres";
    lastPostgresError = "";
    lastPostgresMessage = "";
    return { postgresConfigured: true, postgresHealthy: true, error: "", message: "" };
  } catch (error) {
    rememberPostgresError(error);
    return { postgresConfigured: true, postgresHealthy: false, error: lastPostgresError, message: lastPostgresMessage };
  }
}

const SEEDED_USER = {
  id: "usr_rafael",
  name: "Rafael Goedert",
  email: "rafael-goedert@hotmail.com",
  passwordHash: "f2f3585187d6d62f77b9dac07fd2755c72dcb9bee427216982cb605cf9f5a9bf",
  role: "admin",
};

const defaultDatabase = {
  users: [SEEDED_USER],
  stages: ["Novo lead", "Qualificando", "Proposta", "Follow-up", "Fechado"],
  tags: ["imovel", "urgente", "alto potencial", "precisa financiamento"],
  leads: [
    {
      id: 1,
      name: "Mariana Costa",
      state: "SC",
      phone: "+55 48 99912-4455",
      stage: "Qualificando",
      score: 82,
      temperature: "Quente",
      tags: ["alto potencial", "urgente"],
      value: 690000,
      lastContact: "ha 8 min",
      owner: "IA",
      summary: "Procura apartamento ate R$ 700 mil, quer visitar no sabado.",
    },
    {
      id: 2,
      name: "Andre Pereira",
      state: "PR",
      phone: "+55 41 98832-0911",
      stage: "Novo lead",
      score: 38,
      temperature: "Frio",
      tags: ["precisa financiamento"],
      value: 320000,
      lastContact: "ha 1 h",
      owner: "IA",
      summary: "Ainda pesquisando opcoes e nao informou prazo de compra.",
    },
    {
      id: 3,
      name: "Lucas Almeida",
      state: "SP",
      phone: "+55 11 95545-1209",
      stage: "Proposta",
      score: 94,
      temperature: "Quente",
      tags: ["alto potencial", "imovel"],
      value: 940000,
      lastContact: "hoje, 10:42",
      owner: "Humano",
      summary: "Tem orcamento aprovado e comparando duas unidades.",
    },
    {
      id: 4,
      name: "Bianca Martins",
      state: "RS",
      phone: "+55 51 98111-7432",
      stage: "Follow-up",
      score: 61,
      temperature: "Morno",
      tags: ["imovel"],
      value: 510000,
      lastContact: "ontem",
      owner: "IA",
      summary: "Pediu retorno apos conversar com a familia.",
    },
  ],
  conversations: [
    {
      id: 1,
      name: "Mariana Costa",
      phone: "+55 48 99912-4455",
      state: "SC",
      status: "online agora",
      lastMessage: "Quero agendar uma visita no sabado.",
      unread: 3,
      score: 82,
      channel: "WhatsApp",
    },
    {
      id: 2,
      name: "Andre Pereira",
      phone: "+55 41 98832-0911",
      state: "PR",
      status: "visto ha 14 min",
      lastMessage: "Pode me mandar as condicoes?",
      unread: 0,
      score: 38,
      channel: "WhatsApp",
    },
    {
      id: 3,
      name: "Lucas Almeida",
      phone: "+55 11 95545-1209",
      state: "SP",
      status: "digitando...",
      lastMessage: "A proposta ficou dentro do que preciso.",
      unread: 1,
      score: 94,
      channel: "WhatsApp",
    },
  ],
  messages: [
    { id: 1, from: "lead", body: "Oi, vi o anuncio e queria entender melhor.", time: "10:28" },
    {
      id: 2,
      from: "agent",
      body: "Claro, Mariana. Para eu te ajudar melhor, qual e o seu nome completo e de qual estado voce fala?",
      time: "10:29",
    },
    { id: 3, from: "lead", body: "Sou Mariana Costa, de Santa Catarina.", time: "10:30" },
    {
      id: 4,
      from: "system",
      body: "Lead cadastrado automaticamente no CRM com estado SC e score inicial 54%.",
      time: "10:30",
    },
    {
      id: 5,
      from: "agent",
      body: "Perfeito. Voce busca morar ou investir? E qual faixa de valor faz sentido hoje?",
      time: "10:31",
    },
    {
      id: 6,
      from: "lead",
      body: "Morar. Ate uns 700 mil, se tiver boa localizacao.",
      time: "10:34",
    },
    {
      id: 7,
      from: "agent",
      body: "Audio de 32s explicando as melhores opcoes e pedindo disponibilidade para visita.",
      time: "10:35",
      kind: "audio",
    },
    { id: 8, from: "lead", body: "Quero agendar uma visita no sabado.", time: "10:41" },
  ],
  agentSettings: {
    businessHours: "Segunda a sexta, 08:00 as 20:00; sabado, 09:00 as 13:00",
    inactivityMinutes: 25,
    handoffScore: 80,
    followUpCadence: ["1 hora", "24 horas", "3 dias", "7 dias"],
    mainInstruction:
      "Responda de forma humana, consultiva e objetiva. Colete nome, estado, objetivo, orcamento, prazo e objeções. Classifique cada lead de 0% a 100%.",
    missions: [
      "Identificar nome, estado, objetivo e urgencia do lead.",
      "Mapear orcamento, prazo, objeções e decisores.",
      "Enviar conteudo correto da base de conhecimento.",
      "Pontuar interesse de 0% a 100% e acionar humano quando quente.",
      "Executar follow-ups inteligentes sem parecer robo.",
    ],
  },
  evolution: {
    baseUrl: "",
    instance: "atendedor-20",
    apiKey: "",
    connected: false,
    webhookPath: "/api/evolution/webhook",
    lastSavedAt: "",
  },
};

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function ensurePostgresState() {
  if (!pgPool) return null;

  await pgPool.query(
    "CREATE TABLE IF NOT EXISTS app_state (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())",
  );

  const result = await pgPool.query("SELECT data FROM app_state WHERE id = $1", ["default"]);
  if (result.rowCount) return result.rows[0].data;

  const seed = structuredClone(defaultDatabase);
  await pgPool.query("INSERT INTO app_state (id, data) VALUES ($1, $2::jsonb)", [
    "default",
    JSON.stringify(seed),
  ]);
  return seed;
}

async function ensureLocalDatabase() {
  await mkdir(dirname(dbPath), { recursive: true });
  try {
    return JSON.parse(await readFile(dbPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const seed = structuredClone(defaultDatabase);
    await writeLocalDatabase(seed);
    return seed;
  }
}

async function writeLocalDatabase(database) {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(database, null, 2)}\n`);
}

function rememberPostgresError(error) {
  lastPostgresError = error?.code ? String(error.code) : String(error?.message ?? error);
  lastPostgresMessage = String(error?.message ?? error ?? "").slice(0, 300);
  storageMode = "local-json-fallback";
  console.error("Postgres indisponivel; usando fallback local:", lastPostgresError, lastPostgresMessage);
}

async function ensureDatabase() {
  if (pgPool) {
    try {
      const database = await ensurePostgresState();
      storageMode = "postgres";
      lastPostgresError = "";
      lastPostgresMessage = "";
      return database;
    } catch (error) {
      rememberPostgresError(error);
    }
  }

  return ensureLocalDatabase();
}

async function writeDatabase(database) {
  if (pgPool && storageMode === "postgres") {
    try {
      await pgPool.query(
        "INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
        ["default", JSON.stringify(database)],
      );
      return;
    } catch (error) {
      rememberPostgresError(error);
    }
  }

  await writeLocalDatabase(database);
}

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function signToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, email: user.email, role: user.role, issuedAt: Date.now() }),
  ).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return safeEqual(signature, expected);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAuth(request, response) {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (verifyToken(token)) return true;
  jsonResponse(response, 401, { error: "Sessao invalida ou expirada." });
  return false;
}

function sanitizeEvolution(evolution = {}) {
  const apiKey = String(evolution.apiKey ?? "");
  return {
    baseUrl: String(evolution.baseUrl ?? ""),
    instance: String(evolution.instance ?? "atendedor-20"),
    connected: Boolean(evolution.connected),
    webhookPath: String(evolution.webhookPath ?? "/api/evolution/webhook"),
    lastSavedAt: String(evolution.lastSavedAt ?? ""),
    hasApiKey: Boolean(apiKey),
    apiKeyPreview: apiKey ? `termina em ${apiKey.slice(-4)}` : "",
  };
}

function publicDatabase(database) {
  const { users: _users, ...safeDatabase } = database;
  return { ...safeDatabase, evolution: sanitizeEvolution(database.evolution) };
}

function getTemperature(score) {
  if (score >= 75) return "Quente";
  if (score >= 45) return "Morno";
  return "Frio";
}

function getManagedInstanceName(evolution = {}) {
  return String(evolution.instance ?? "").trim() || "atendedor-20";
}

function getEvolutionConfig(database) {
  const evolution = database.evolution ?? defaultDatabase.evolution;
  const baseUrl = String(evolution.baseUrl ?? "").trim().replace(/\/$/, "");
  const instance = getManagedInstanceName(evolution);
  const apiKey = String(evolution.apiKey ?? "").trim();

  if (!baseUrl || !apiKey) {
    throw new Error("Configure URL e API key da Evolution API antes de testar.");
  }

  return { baseUrl, instance, apiKey };
}

async function callEvolutionApi(database, path, options = {}) {
  const { baseUrl, apiKey } = getEvolutionConfig(database);
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        apikey: apiKey,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    const message = error?.cause?.code
      ? `Nao foi possivel conectar a Evolution API (${error.cause.code}). Confira URL e firewall do servidor.`
      : "Nao foi possivel conectar a Evolution API. Confira a URL do servidor.";
    throw new Error(message);
  }

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(`Evolution API retornou ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function ensureEvolutionInstance(database) {
  const { instance } = getEvolutionConfig(database);

  try {
    const payload = await callEvolutionApi(database, `/instance/connectionState/${encodeURIComponent(instance)}`);
    const state = payload?.instance?.state ?? payload?.state ?? payload?.connectionStatus ?? payload?.status ?? "desconhecido";
    return { instance, state, created: false };
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  await callEvolutionApi(database, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instance,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    }),
  });

  database.evolution = {
    ...(database.evolution ?? defaultDatabase.evolution),
    instance,
    instanceManagedByApp: true,
    instanceCreatedAt: new Date().toISOString(),
  };

  return { instance, state: "created", created: true };
}

async function tryEvolutionApi(database, path, options = {}) {
  try {
    return await callEvolutionApi(database, path, options);
  } catch (error) {
    return { ignored: true, status: error?.status, message: error?.message ?? "erro ignorado" };
  }
}

async function resetEvolutionInstance(database) {
  const { instance } = getEvolutionConfig(database);
  const encodedInstance = encodeURIComponent(instance);

  await tryEvolutionApi(database, `/instance/logout/${encodedInstance}`, { method: "DELETE" });
  await tryEvolutionApi(database, `/instance/delete/${encodedInstance}`, { method: "DELETE" });

  const createPayload = await callEvolutionApi(database, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });

  let qrCode = extractQrCode(createPayload);

  if (!qrCode.image && !qrCode.code) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const connectPayload = await callEvolutionApi(database, `/instance/connect/${encodedInstance}`);
    qrCode = extractQrCode(connectPayload);
  }

  database.evolution = {
    ...(database.evolution ?? defaultDatabase.evolution),
    instance,
    instanceManagedByApp: true,
    lastResetAt: new Date().toISOString(),
  };

  return { instance, qrCode };
}

function extractQrCode(payload) {
  const candidates = [
    payload?.base64,
    payload?.qrcode?.base64,
    payload?.qrcode,
    payload?.qr,
    payload?.code,
    payload?.pairingCode,
    payload?.data?.base64,
    payload?.data?.qrcode?.base64,
    payload?.data?.qrcode,
    payload?.data?.qr,
    payload?.data?.code,
    payload?.data?.pairingCode,
  ].filter(Boolean);

  const image = candidates.find((value) => typeof value === "string" && value.startsWith("data:image"));
  const base64 = candidates.find(
    (value) => typeof value === "string" && /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 120,
  );
  const code = candidates.find((value) => typeof value === "string" && value.length <= 120);

  return { image: image ?? (base64 ? `data:image/png;base64,${base64}` : ""), code: code ?? "" };
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

async function serveStatic(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = normalizedPath.replace(/^\/+/, "");
  const filePath = resolve(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    jsonResponse(response, 403, { error: "Acesso negado." });
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    response.end(file);
  } catch {
    try {
      const indexFile = await readFile(join(distDir, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(indexFile);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Build do frontend nao encontrada. Rode npm run build.");
    }
  }
}

async function routeRequest(request, response) {
  if (request.method === "OPTIONS") {
    jsonResponse(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      jsonResponse(response, 200, {
        status: "ok",
        service: "Atendedor 2.0 API",
        storage: {
          mode: storageMode,
          postgresConfigured: Boolean(pgPool),
          postgresHealthy: storageMode === "postgres" && !lastPostgresError,
        },
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/diagnostics/storage") {
      const probe = await probePostgres();
      jsonResponse(response, 200, {
        storageMode,
        postgresConfigured: probe.postgresConfigured,
        postgresHealthy: probe.postgresHealthy,
        lastPostgresError: probe.error,
        lastPostgresMessage: probe.message,
        databaseUrl: databaseUrlInfo,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const email = String(body.email ?? "").trim().toLowerCase();
      const passwordHash = hashPassword(String(body.password ?? ""));
      const user = database.users.find((candidate) => candidate.email === email);

      if (!user || user.passwordHash !== passwordHash) {
        jsonResponse(response, 401, { error: "E-mail ou senha invalidos." });
        return;
      }

      jsonResponse(response, 200, {
        token: signToken(user),
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
      return;
    }

    if (!url.pathname.startsWith("/api")) {
      await serveStatic(url.pathname, response);
      return;
    }

    if (!requireAuth(request, response)) return;

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      const database = await ensureDatabase();
      jsonResponse(response, 200, publicDatabase(database));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/leads") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const name = String(body.name ?? "").trim();
      const state = String(body.state ?? "").trim().toUpperCase();
      const phone = String(body.phone ?? "").trim() || "WhatsApp pendente";

      if (!name || !state) {
        jsonResponse(response, 400, { error: "Nome e estado sao obrigatorios." });
        return;
      }

      const score = 30 + Math.floor(Math.random() * 35);
      const lead = {
        id: Date.now(),
        name,
        state,
        phone,
        stage: database.stages[0],
        score,
        temperature: getTemperature(score),
        tags: ["novo"],
        value: 0,
        lastContact: "agora",
        owner: "IA",
        summary: "Lead criado manualmente. A IA deve completar qualificacao na conversa.",
      };

      database.leads.unshift(lead);
      await writeDatabase(database);
      jsonResponse(response, 201, lead);
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/leads/")) {
      const leadId = Number(url.pathname.split("/").at(-1));
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const lead = database.leads.find((candidate) => candidate.id === leadId);

      if (!lead) {
        jsonResponse(response, 404, { error: "Lead nao encontrado." });
        return;
      }

      Object.assign(lead, body);
      if (typeof lead.score === "number") lead.temperature = getTemperature(lead.score);
      await writeDatabase(database);
      jsonResponse(response, 200, lead);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/stages") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const stage = String(body.name ?? "").trim();

      if (!stage) {
        jsonResponse(response, 400, { error: "Nome da etapa e obrigatorio." });
        return;
      }

      if (!database.stages.includes(stage)) database.stages.push(stage);
      await writeDatabase(database);
      jsonResponse(response, 201, database.stages);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tags") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const tag = String(body.name ?? "").trim().toLowerCase();

      if (!tag) {
        jsonResponse(response, 400, { error: "Nome da etiqueta e obrigatorio." });
        return;
      }

      if (!database.tags.includes(tag)) database.tags.push(tag);
      await writeDatabase(database);
      jsonResponse(response, 201, database.tags);
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/settings/agent") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      database.agentSettings = {
        ...database.agentSettings,
        businessHours: String(body.businessHours ?? database.agentSettings.businessHours),
        inactivityMinutes: Number(body.inactivityMinutes ?? database.agentSettings.inactivityMinutes),
        handoffScore: Number(body.handoffScore ?? database.agentSettings.handoffScore),
        followUpCadence: Array.isArray(body.followUpCadence)
          ? body.followUpCadence.map(String).filter(Boolean)
          : database.agentSettings.followUpCadence,
        mainInstruction: String(body.mainInstruction ?? database.agentSettings.mainInstruction),
        missions: Array.isArray(body.missions) ? body.missions.map(String).filter(Boolean) : database.agentSettings.missions,
      };
      await writeDatabase(database);
      jsonResponse(response, 200, database.agentSettings);
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/settings/evolution") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const currentEvolution = database.evolution ?? defaultDatabase.evolution;
      const baseUrl = String(body.baseUrl ?? currentEvolution.baseUrl).trim().replace(/\/$/, "");
      const instance = getManagedInstanceName(currentEvolution);
      const apiKey = String(body.apiKey ?? "").trim();

      database.evolution = {
        ...currentEvolution,
        baseUrl,
        instance,
        apiKey: apiKey || currentEvolution.apiKey || "",
        connected: Boolean(baseUrl && (apiKey || currentEvolution.apiKey)),
        instanceManagedByApp: true,
        webhookPath: currentEvolution.webhookPath ?? "/api/evolution/webhook",
        lastSavedAt: new Date().toISOString(),
      };
      await writeDatabase(database);
      jsonResponse(response, 200, sanitizeEvolution(database.evolution));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/evolution/test") {
      const database = await ensureDatabase();
      const instanceStatus = await ensureEvolutionInstance(database);
      const { instance, state } = instanceStatus;

      database.evolution = {
        ...(database.evolution ?? defaultDatabase.evolution),
        lastTestAt: new Date().toISOString(),
        instance,
        instanceManagedByApp: true,
        lastConnectionState: state,
      };
      await writeDatabase(database);

      jsonResponse(response, 200, {
        ok: true,
        instance,
        state,
        connected: ["open", "connected", "online"].includes(String(state).toLowerCase()),
        created: instanceStatus.created,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/evolution/qrcode") {
      const database = await ensureDatabase();
      const instanceStatus = await ensureEvolutionInstance(database);
      const { instance } = instanceStatus;
      const payload = await callEvolutionApi(database, `/instance/connect/${encodeURIComponent(instance)}`);
      const qrCode = extractQrCode(payload);

      database.evolution = {
        ...(database.evolution ?? defaultDatabase.evolution),
        instance,
        instanceManagedByApp: true,
        lastQrCodeAt: new Date().toISOString(),
      };
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, instance, created: instanceStatus.created, qrCode });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/evolution/reset") {
      const database = await ensureDatabase();
      const { instance, qrCode } = await resetEvolutionInstance(database);
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, instance, reset: true, qrCode });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/evolution/webhook") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      database.lastWebhook = { receivedAt: new Date().toISOString(), payload: body };
      await writeDatabase(database);
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api")) {
      jsonResponse(response, 404, { error: "Rota nao encontrada." });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Erro interno da API local.";
    const isExpectedIntegrationError =
      message.startsWith("Configure URL") ||
      message.startsWith("Evolution API retornou") ||
      message.startsWith("Nao foi possivel conectar a Evolution API");
    jsonResponse(response, isExpectedIntegrationError ? 400 : 500, {
      error: isExpectedIntegrationError ? message : "Erro interno da API local.",
    });
  }
}

createServer(routeRequest).listen(port, () => {
  console.log(`Atendedor 2.0 rodando em http://localhost:${port}`);
  console.log(pgPool ? "Persistencia online: Postgres com fallback local" : "Persistencia local: data/atendedor-db.json");
});
