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

function extractArray(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;

  for (const key of preferredKeys) {
    const value = key.split(".").reduce((current, part) => current?.[part], payload);
    if (Array.isArray(value)) return value;
  }

  const candidates = [
    payload?.data,
    payload?.response,
    payload?.result,
    payload?.chats,
    payload?.contacts,
    payload?.messages,
    payload?.records,
    payload?.messages?.records,
    payload?.data?.records,
    payload?.data?.messages,
    payload?.data?.chats,
    payload?.data?.contacts,
  ];

  return candidates.find(Array.isArray) ?? [];
}

async function callEvolutionApiOptional(database, path, options = {}, preferredKeys = []) {
  try {
    const payload = await callEvolutionApi(database, path, options);
    return { payload, items: extractArray(payload, preferredKeys), ok: true };
  } catch (error) {
    if (error?.status === 404) return { payload: {}, items: [], ok: false };
    throw error;
  }
}

function normalizeRemoteJid(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : raw;
}

function phoneFromJid(jid) {
  const digits = String(jid ?? "").split("@")[0].replace(/\D/g, "");
  return digits ? `+${digits}` : "WhatsApp";
}

function extractPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

function formatPhone(value) {
  const digits = extractPhone(value);
  return digits ? `+${digits}` : "WhatsApp";
}

function getContactRemoteJids(contact) {
  return [
    contact?.remoteJid,
    contact?.id,
    contact?.jid,
    contact?.lid,
    contact?.contact?.remoteJid,
    contact?.key?.remoteJid,
  ]
    .map(normalizeRemoteJid)
    .filter(Boolean);
}

function getContactPhone(contact) {
  return (
    extractPhone(contact?.number) ||
    extractPhone(contact?.phone) ||
    extractPhone(contact?.waId) ||
    extractPhone(contact?.id?.includes("@s.whatsapp.net") ? contact.id : "") ||
    extractPhone(contact?.remoteJid?.includes("@s.whatsapp.net") ? contact.remoteJid : "") ||
    extractPhone(contact?.jid?.includes("@s.whatsapp.net") ? contact.jid : "")
  );
}

function createContactMap(contacts) {
  const map = new Map();
  for (const contact of contacts ?? []) {
    const phone = getContactPhone(contact);
    const name = contact?.pushName || contact?.name || contact?.notify || contact?.verifiedName || "";
    const profilePicUrl = getProfilePicUrl(contact);
    const info = { phone: phone ? `+${phone}` : "", number: phone, name, profilePicUrl };

    for (const jid of getContactRemoteJids(contact)) {
      map.set(jid, { ...(map.get(jid) ?? {}), ...info });
    }

    if (phone) {
      map.set(`${phone}@s.whatsapp.net`, { ...(map.get(`${phone}@s.whatsapp.net`) ?? {}), ...info });
    }
  }
  return map;
}

function getConversationName(chat, remoteJid) {
  return (
    chat?.pushName ||
    chat?.name ||
    chat?.contact?.pushName ||
    chat?.contact?.name ||
    chat?.notify ||
    phoneFromJid(remoteJid)
  );
}

function getLastMessageText(source) {
  const message = source?.message ?? source?.lastMessage?.message ?? source?.lastMessage ?? source;
  return (
    source?.lastMessage?.message?.conversation ||
    source?.lastMessage?.message?.extendedTextMessage?.text ||
    source?.lastMessage?.text ||
    source?.lastMessageText ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.audioMessage?.caption ||
    source?.messageTimestamp?.toString?.() ||
    "Conversa sincronizada"
  );
}

function getTimestampMillis(value) {
  if (!value) return Date.now();
  if (typeof value === "object" && "low" in value) return Number(value.low) * 1000;
  const number = Number(value);
  if (!Number.isFinite(number)) return Date.now();
  return number > 10_000_000_000 ? number : number * 1000;
}

function formatMessageTime(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getMessageBody(message) {
  const content = message?.message ?? message;
  return (
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    content?.documentMessage?.caption ||
    content?.buttonsResponseMessage?.selectedDisplayText ||
    content?.listResponseMessage?.title ||
    content?.templateButtonReplyMessage?.selectedDisplayText ||
    content?.interactiveMessage?.body?.text ||
    content?.interactiveMessage?.nativeFlowMessage?.buttons?.[0]?.name ||
    content?.documentMessage?.fileName ||
    content?.audioMessage?.caption ||
    (content?.audioMessage ? "Audio" : "") ||
    (content?.imageMessage ? "Imagem" : "") ||
    (content?.videoMessage ? "Video" : "") ||
    (content?.documentMessage ? "Documento" : "") ||
    "Mensagem sem texto"
  );
}

function getMessageKind(message) {
  const content = message?.message ?? message;
  if (content?.audioMessage) return "audio";
  if (content?.videoMessage) return "video";
  if (content?.imageMessage || content?.documentMessage) return "file";
  return "text";
}

function getMessageMediaInfo(message) {
  const content = message?.message ?? message;
  const media = content?.imageMessage || content?.videoMessage || content?.audioMessage || content?.documentMessage || {};
  const thumbnail = media.jpegThumbnail
    ? `data:image/jpeg;base64,${Buffer.isBuffer(media.jpegThumbnail) ? media.jpegThumbnail.toString("base64") : media.jpegThumbnail}`
    : "";

  return {
    mediaUrl: media.url || media.directPath || "",
    thumbnail,
    fileName: media.fileName || media.title || "",
    mimeType: media.mimetype || media.mimeType || "",
  };
}

function stripDataUrl(value) {
  const text = String(value ?? "");
  return text.includes(",") && text.startsWith("data:") ? text.split(",").slice(1).join(",") : text;
}

function parseDataUrl(value, fallbackMimeType = "application/octet-stream") {
  const text = String(value ?? "");
  const match = text.match(/^data:([^;,]+)?;base64,(.*)$/s);
  if (match) return { mimeType: match[1] || fallbackMimeType, base64: match[2] };
  return { mimeType: fallbackMimeType, base64: text };
}

function safeFileName(value, fallback = "arquivo") {
  return String(value || fallback).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 180) || fallback;
}

function asciiFileName(value, fallback = "arquivo") {
  return safeFileName(value, fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_");
}

function contentDispositionFileName(fileName) {
  const safe = safeFileName(fileName);
  const ascii = asciiFileName(safe);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function binaryResponse(response, { base64, mimeType, fileName }) {
  const buffer = Buffer.from(stripDataUrl(base64), "base64");
  response.writeHead(200, {
    "Content-Type": mimeType || "application/octet-stream",
    "Content-Length": buffer.length,
    "Content-Disposition": contentDispositionFileName(fileName),
    "Cache-Control": "private, max-age=300",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(buffer);
}

function getBase64FromPayload(payload) {
  return (
    payload?.base64 ||
    payload?.data?.base64 ||
    payload?.file?.base64 ||
    payload?.media ||
    payload?.data ||
    ""
  );
}

async function getEvolutionMediaPayload(database, instance, message) {
  const key = message.rawMessage?.key || {
    id: message.evolutionMessageId || message.id,
    remoteJid: message.remoteJid || message.conversationId,
    fromMe: message.from === "agent",
  };
  const requestBodies = [
    { message: { key }, convertToMp4: message.kind === "video" },
    { message: { key: { id: key.id } }, convertToMp4: message.kind === "video" },
    { message: message.rawMessage, convertToMp4: message.kind === "video" },
  ];

  let lastError;
  for (const body of requestBodies) {
    try {
      const payload = await callEvolutionApi(database, `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const rawBase64 = getBase64FromPayload(payload);
      if (rawBase64) return { payload, rawBase64 };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { payload: {}, rawBase64: "" };
}

async function resolveMediaPayload(database, instance, message) {
  if (message.mediaUrl?.startsWith("data:")) {
    const parsed = parseDataUrl(message.mediaUrl, message.mimeType || "application/octet-stream");
    return {
      base64: parsed.base64,
      mimeType: parsed.mimeType,
      fileName: message.fileName || "arquivo",
      dataUrl: message.mediaUrl,
    };
  }

  // WhatsApp CDN URLs usually point to encrypted media. Prefer Evolution decryption whenever possible.
  if (message.rawMessage || message.evolutionMessageId || message.id) {
    const { payload, rawBase64 } = await getEvolutionMediaPayload(database, instance, message);
    const parsed = parseDataUrl(
      rawBase64,
      payload?.mimetype || payload?.mimeType || payload?.data?.mimetype || message.mimeType || "application/octet-stream",
    );
    const fileName = payload?.fileName || payload?.filename || message.fileName || `arquivo-${message.evolutionMessageId || message.id}`;
    if (parsed.base64) {
      return { base64: parsed.base64, mimeType: parsed.mimeType, fileName, dataUrl: `data:${parsed.mimeType};base64,${parsed.base64}` };
    }
  }

  if (message.mediaUrl?.startsWith("http")) {
    const mediaResponse = await fetch(message.mediaUrl);
    if (!mediaResponse.ok) throw new Error(`Download HTTP retornou ${mediaResponse.status}`);
    const arrayBuffer = await mediaResponse.arrayBuffer();
    const mimeType = mediaResponse.headers.get("content-type") || message.mimeType || "application/octet-stream";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, mimeType, fileName: message.fileName || "arquivo", dataUrl: `data:${mimeType};base64,${base64}` };
  }

  throw new Error("A Evolution nao retornou dados suficientes para baixar este arquivo. Sincronize novamente.");
}

function getProfilePicUrl(source, contactInfo = {}) {
  return (
    contactInfo.profilePicUrl ||
    source?.profilePicUrl ||
    source?.profilePictureUrl ||
    source?.picture ||
    source?.imgUrl ||
    source?.contact?.profilePicUrl ||
    ""
  );
}

function normalizeConversation(chat, index = 0, contactMap = new Map()) {
  const remoteJid = normalizeRemoteJid(
    chat?.remoteJid || chat?.id || chat?.jid || chat?.key?.remoteJid || chat?.contact?.remoteJid || chat?.number,
  );
  const timestamp = getTimestampMillis(chat?.updatedAt || chat?.messageTimestamp || chat?.lastMessage?.messageTimestamp);
  const contactInfo = contactMap.get(remoteJid) ?? {};
  const phone = contactInfo.phone || formatPhone(chat?.number || chat?.phone || remoteJid);
  const name = contactInfo.name || getConversationName(chat, remoteJid);
  const profilePicUrl = getProfilePicUrl(chat, contactInfo);

  return {
    id: remoteJid || `chat-${Date.now()}-${index}`,
    remoteJid,
    name: name === phoneFromJid(remoteJid) && phone !== "WhatsApp" ? phone : name,
    phone,
    number: contactInfo.number || extractPhone(phone),
    profilePicUrl,
    state: "--",
    status: chat?.presence || chat?.status || "sincronizado",
    lastMessage: getLastMessageText(chat),
    unread: Number(chat?.unreadMessages ?? chat?.unreadCount ?? 0),
    score: 50,
    channel: "WhatsApp",
    lastMessageAt: new Date(timestamp).toISOString(),
    source: "evolution",
  };
}

function normalizeMessage(message, remoteJid, index = 0) {
  const key = message?.key ?? message?.message?.key ?? {};
  const messageRemoteJid = normalizeRemoteJid(remoteJid || key.remoteJid || message?.remoteJid);
  const timestamp = getTimestampMillis(message?.messageTimestamp || message?.timestamp || message?.createdAt);
  const fromMe = Boolean(key.fromMe ?? message?.fromMe);
  const mediaInfo = getMessageMediaInfo(message);
  const senderName = message?.pushName || message?.participant?.pushName || message?.sender?.pushName || message?.contact?.pushName || "";

  return {
    id: key.id || message?.id || `msg-${messageRemoteJid}-${timestamp}-${index}`,
    evolutionMessageId: key.id || message?.id || "",
    conversationId: messageRemoteJid,
    remoteJid: messageRemoteJid,
    from: fromMe ? "agent" : "lead",
    body: getMessageBody(message),
    senderName,
    time: formatMessageTime(timestamp),
    timestamp,
    kind: getMessageKind(message),
    mediaUrl: mediaInfo.mediaUrl,
    thumbnail: mediaInfo.thumbnail,
    fileName: mediaInfo.fileName,
    mimeType: mediaInfo.mimeType,
    source: "evolution",
    rawType: Object.keys(message?.message ?? message ?? {})[0] ?? "unknown",
    rawMessage: message,
  };
}

function mergeByKey(existing, incoming, getKey) {
  const map = new Map();
  for (const item of existing ?? []) map.set(getKey(item), item);
  for (const item of incoming ?? []) {
    const key = getKey(item);
    const previous = map.get(key) ?? {};
    map.set(key, {
      ...previous,
      ...item,
      mediaUrl: item.mediaUrl || previous.mediaUrl || "",
      thumbnail: item.thumbnail || previous.thumbnail || "",
      fileName: item.fileName || previous.fileName || "",
      mimeType: item.mimeType || previous.mimeType || "",
      rawMessage: item.rawMessage || previous.rawMessage,
    });
  }
  return Array.from(map.values());
}

function getRecipientCandidates(remoteJid, phone) {
  const candidates = [];
  const normalizedJid = normalizeRemoteJid(remoteJid);
  const phoneDigits = extractPhone(phone);
  const jidDigits = extractPhone(normalizedJid?.includes("@s.whatsapp.net") ? normalizedJid : "");

  if (phoneDigits) candidates.push(phoneDigits);
  if (jidDigits) candidates.push(jidDigits);
  if (normalizedJid?.endsWith("@lid")) candidates.push(normalizedJid);
  if (normalizedJid && !normalizedJid.endsWith("@s.whatsapp.net")) candidates.push(normalizedJid.split("@")[0]);

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getLastMessageForChat(database, remoteJid) {
  const aliases = new Set([remoteJid]);
  const conversation = (database.conversations ?? []).find(
    (item) => (item.remoteJid || item.id) === remoteJid || (item.aliases ?? []).includes(remoteJid),
  );
  for (const alias of conversation?.aliases ?? []) aliases.add(alias);
  if (conversation?.remoteJid) aliases.add(conversation.remoteJid);
  if (conversation?.id) aliases.add(conversation.id);

  return [...(database.messages ?? [])]
    .filter((message) => aliases.has(message.remoteJid) || aliases.has(message.conversationId))
    .sort((a, b) => Number(b.timestamp ?? 0) - Number(a.timestamp ?? 0))[0];
}

async function archiveEvolutionChat(database, instance, remoteJid, archive) {
  const lastMessage = getLastMessageForChat(database, remoteJid);
  const key = lastMessage?.rawMessage?.key || {
    remoteJid,
    fromMe: Boolean(lastMessage?.from === "agent"),
    id: lastMessage?.evolutionMessageId || lastMessage?.id || `archive-${Date.now()}`,
  };

  return callEvolutionApi(database, `/chat/archiveChat/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify({ chat: remoteJid, archive, lastMessage: { key } }),
  });
}

function buildQuotedPayload(message) {
  if (!message) return undefined;
  return {
    key: {
      id: message.evolutionMessageId || message.id,
      remoteJid: message.remoteJid || message.conversationId,
      fromMe: message.from === "agent",
    },
    message: {
      conversation: message.body || message.fileName || "Mensagem",
    },
  };
}

async function sendEvolutionText(database, instance, remoteJid, phone, text, quotedMessage) {
  const candidates = getRecipientCandidates(remoteJid, phone);
  const errors = [];

  for (const number of candidates) {
    try {
      const payload = await callEvolutionApi(database, `/message/sendText/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({
          number,
          text,
          ...(quotedMessage ? { quoted: buildQuotedPayload(quotedMessage) } : {}),
        }),
      });
      return { payload, number };
    } catch (error) {
      errors.push(`${number}: ${error.message}`);
    }
  }

  throw new Error(`Nao foi possivel enviar pela Evolution. Tentativas: ${errors.join(" | ")}`);
}

async function sendEvolutionMedia(database, instance, remoteJid, phone, media, quotedMessage) {
  const candidates = getRecipientCandidates(remoteJid, phone);
  const errors = [];
  const mediatype = media.mediaType || "document";

  for (const number of candidates) {
    try {
      const payload = await callEvolutionApi(database, `/message/sendMedia/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({
          number,
          mediatype,
          mimetype: media.mimeType,
          caption: media.caption || "",
          media: stripDataUrl(media.data),
          fileName: media.fileName || "arquivo",
          ...(quotedMessage ? { quoted: buildQuotedPayload(quotedMessage) } : {}),
        }),
      });
      return { payload, number };
    } catch (error) {
      errors.push(`${number}: ${error.message}`);
    }
  }

  throw new Error(`Nao foi possivel enviar midia pela Evolution. Tentativas: ${errors.join(" | ")}`);
}

function getConversationDedupeKey(conversation) {
  const number = extractPhone(conversation.number || conversation.phone);
  if (number && !String(conversation.remoteJid || "").endsWith("@lid")) return `phone:${number}`;
  if (number && String(conversation.phone || "").length >= 13) return `phone:${number}`;
  return `jid:${conversation.remoteJid || conversation.id}`;
}

function dedupeConversations(conversations) {
  const map = new Map();
  for (const conversation of conversations ?? []) {
    const key = getConversationDedupeKey(conversation);
    const current = map.get(key);
    if (!current) {
      map.set(key, conversation);
      continue;
    }

    const currentTime = new Date(current.lastMessageAt ?? 0).getTime();
    const nextTime = new Date(conversation.lastMessageAt ?? 0).getTime();
    map.set(key, {
      ...current,
      ...conversation,
      name: current.name && !current.name.startsWith("+") ? current.name : conversation.name,
      phone: current.phone !== "WhatsApp" ? current.phone : conversation.phone,
      profilePicUrl: current.profilePicUrl || conversation.profilePicUrl,
      unread: Math.max(Number(current.unread ?? 0), Number(conversation.unread ?? 0)),
      lastMessage: nextTime >= currentTime ? conversation.lastMessage : current.lastMessage,
      lastMessageAt: nextTime >= currentTime ? conversation.lastMessageAt : current.lastMessageAt,
    });
  }
  return Array.from(map.values());
}

async function sendEvolutionAudio(database, instance, remoteJid, phone, media, quotedMessage) {
  const candidates = getRecipientCandidates(remoteJid, phone);
  const errors = [];

  for (const number of candidates) {
    try {
      const payload = await callEvolutionApi(database, `/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({
          number,
          audio: stripDataUrl(media.data),
          delay: 800,
          encoding: true,
          ...(quotedMessage ? { quoted: buildQuotedPayload(quotedMessage) } : {}),
        }),
      });
      return { payload, number };
    } catch (error) {
      errors.push(`${number}: ${error.message}`);
    }
  }

  return sendEvolutionMedia(database, instance, remoteJid, phone, { ...media, mediaType: "audio" }, quotedMessage);
}

function normalizeDisplayName(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text || text.startsWith("+") || /^\d+$/.test(text.replace(/\D/g, ""))) return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function conversationQualityScore(conversation) {
  const number = extractPhone(conversation.number || conversation.phone);
  let score = 0;
  if (number) score += 10;
  if (number.startsWith("55")) score += 20;
  if (!String(conversation.remoteJid || "").endsWith("@lid")) score += 8;
  if (conversation.profilePicUrl) score += 5;
  if (normalizeDisplayName(conversation.name)) score += 4;
  score += Math.min(Number(conversation.unread ?? 0), 5);
  return score;
}

function chooseCanonicalConversation(items) {
  return [...items].sort((a, b) => {
    const quality = conversationQualityScore(b) - conversationQualityScore(a);
    if (quality !== 0) return quality;
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  })[0];
}

function buildConversationAliasResolution(conversations) {
  const groups = new Map();

  for (const conversation of conversations ?? []) {
    const number = extractPhone(conversation.number || conversation.phone);
    const displayName = normalizeDisplayName(conversation.name);
    const keys = [];

    if (number && !String(conversation.remoteJid || "").endsWith("@lid")) keys.push(`phone:${number}`);
    if (displayName) keys.push(`name:${displayName}`);
    if (!keys.length) keys.push(`jid:${conversation.remoteJid || conversation.id}`);

    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(conversation);
    }
  }

  // Merge overlapping groups until stable.
  let changed = true;
  while (changed) {
    changed = false;
    const entries = Array.from(groups.entries());
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [keyA, groupA] = entries[i];
        const [keyB, groupB] = entries[j];
        if (!groups.has(keyA) || !groups.has(keyB)) continue;
        const idsA = new Set(groupA.map((item) => item.remoteJid || item.id));
        const intersects = groupB.some((item) => idsA.has(item.remoteJid || item.id));
        if (intersects) {
          groups.set(keyA, dedupeConversations([...groupA, ...groupB]));
          groups.delete(keyB);
          changed = true;
        }
      }
    }
  }

  const aliasToCanonical = new Map();
  const canonicalItems = [];

  for (const group of groups.values()) {
    const canonical = chooseCanonicalConversation(group);
    const latest = [...group].sort(
      (a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
    )[0];
    const maxReadAt = group
      .map((item) => new Date(item.lastReadAt ?? 0).getTime())
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0);
    const aliases = Array.from(new Set(group.flatMap((item) => [item.remoteJid, item.id, ...(item.aliases ?? [])]).filter(Boolean)));
    const bestNumber = group
      .map((item) => extractPhone(item.number || item.phone))
      .filter(Boolean)
      .sort((a, b) => (b.startsWith("55") ? 1 : 0) - (a.startsWith("55") ? 1 : 0) || b.length - a.length)[0];
    const bestName = group.find((item) => normalizeDisplayName(item.name))?.name || canonical.name;

    const merged = {
      ...canonical,
      ...latest,
      id: canonical.remoteJid || canonical.id,
      remoteJid: canonical.remoteJid || canonical.id,
      aliases,
      name: bestName,
      phone: bestNumber ? `+${bestNumber}` : canonical.phone,
      number: bestNumber || canonical.number,
      profilePicUrl: canonical.profilePicUrl || group.find((item) => item.profilePicUrl)?.profilePicUrl || "",
      lastReadAt: maxReadAt ? new Date(maxReadAt).toISOString() : canonical.lastReadAt,
    };

    for (const alias of aliases) aliasToCanonical.set(alias, merged.remoteJid);
    canonicalItems.push(merged);
  }

  return { conversations: dedupeConversations(canonicalItems), aliasToCanonical };
}

function remapMessagesToCanonical(messages, aliasToCanonical) {
  return (messages ?? []).map((message) => {
    const current = message.remoteJid || message.conversationId;
    const canonical = aliasToCanonical.get(current) || current;
    return { ...message, remoteJid: canonical, conversationId: canonical };
  });
}

function applyUnreadCounts(conversations, messages) {
  return (conversations ?? []).map((conversation) => {
    const remoteJid = conversation.remoteJid || conversation.id;
    const lastReadTime = new Date(conversation.lastReadAt ?? 0).getTime();
    const conversationMessages = (messages ?? []).filter((message) => (message.remoteJid || message.conversationId) === remoteJid);
    const incomingUnread = lastReadTime
      ? conversationMessages.filter((message) => message.from === "lead" && Number(message.timestamp ?? 0) > lastReadTime).length
      : Number(conversation.unread ?? 0);
    const latest = conversationMessages[conversationMessages.length - 1];
    return {
      ...conversation,
      unread: incomingUnread,
      lastMessage: latest?.body || conversation.lastMessage,
      lastMessageAt: latest?.timestamp ? new Date(latest.timestamp).toISOString() : conversation.lastMessageAt,
    };
  });
}

function enrichConversationsFromMessages(conversations, messages) {
  const nameByJid = new Map();
  for (const message of messages ?? []) {
    const jid = message.remoteJid || message.conversationId;
    const name = normalizeDisplayName(message.senderName) ? message.senderName : "";
    if (jid && name && message.from === "lead") nameByJid.set(jid, name);
  }

  return (conversations ?? []).map((conversation) => {
    const name = nameByJid.get(conversation.remoteJid || conversation.id);
    return name && (!conversation.name || conversation.name.startsWith("+")) ? { ...conversation, name } : conversation;
  });
}

async function syncWhatsAppHistory(database, options = {}) {
  const { instance } = getEvolutionConfig(database);
  await ensureEvolutionInstance(database);

  const chatsResult = await callEvolutionApiOptional(
    database,
    `/chat/findChats/${encodeURIComponent(instance)}`,
    { method: "POST", body: JSON.stringify({}) },
    ["chats", "data", "records"],
  );

  const contactsResult = await callEvolutionApiOptional(
    database,
    `/chat/findContacts/${encodeURIComponent(instance)}`,
    { method: "POST", body: JSON.stringify({}) },
    ["contacts", "data", "records"],
  );

  let chatItems = chatsResult.items.length ? chatsResult.items : contactsResult.items;
  const contactMap = createContactMap(contactsResult.items);

  const conversations = chatItems
    .map((chat, index) => normalizeConversation(chat, index, contactMap))
    .filter((conversation) => conversation.remoteJid && !conversation.remoteJid.includes("status@broadcast"));

  const importedMessages = [];
  const conversationLimit = options.quick ? 20 : 50;
  const messageLimit = options.quick ? 30 : 100;
  for (const conversation of conversations.slice(0, conversationLimit)) {
    const messagesResult = await callEvolutionApiOptional(
      database,
      `/chat/findMessages/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        body: JSON.stringify({
          where: { key: { remoteJid: conversation.remoteJid } },
          limit: messageLimit,
        }),
      },
      ["messages.records", "messages", "data", "records"],
    );

    importedMessages.push(
      ...messagesResult.items.map((message, index) => normalizeMessage(message, conversation.remoteJid, index)),
    );
  }

  const existingEvolutionConversations = (database.conversations ?? []).filter(
    (conversation) => conversation.source === "evolution" || conversation.remoteJid,
  );
  const existingEvolutionMessages = (database.messages ?? []).filter(
    (message) => message.source === "evolution" || message.remoteJid || message.conversationId,
  );

  const preMergedConversations = mergeByKey(existingEvolutionConversations, conversations, (item) => item.remoteJid || item.id);
  const { conversations: canonicalConversations, aliasToCanonical } = buildConversationAliasResolution(preMergedConversations);
  const remappedExistingMessages = remapMessagesToCanonical(existingEvolutionMessages, aliasToCanonical);
  const remappedImportedMessages = remapMessagesToCanonical(importedMessages, aliasToCanonical);
  const mergedMessages = mergeByKey(remappedExistingMessages, remappedImportedMessages, (item) => item.evolutionMessageId || item.id);

  mergedMessages.sort((a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0));
  const mergedConversations = enrichConversationsFromMessages(applyUnreadCounts(canonicalConversations, mergedMessages), mergedMessages);
  mergedConversations.sort(
    (a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
  );

  database.conversations = mergedConversations;
  database.messages = mergedMessages;
  database.whatsappSync = {
    lastSyncAt: new Date().toISOString(),
    importedConversations: conversations.length,
    importedMessages: importedMessages.length,
  };

  return database.whatsappSync;
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

    if (request.method === "GET" && url.pathname === "/api/evolution/status") {
      const database = await ensureDatabase();
      const evolution = database.evolution ?? defaultDatabase.evolution;
      const instance = getManagedInstanceName(evolution);

      if (!evolution.baseUrl || !evolution.apiKey) {
        jsonResponse(response, 200, {
          ok: false,
          instance,
          state: "not_configured",
          connected: false,
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      let state = "unknown";
      try {
        const payload = await callEvolutionApi(database, `/instance/connectionState/${encodeURIComponent(instance)}`);
        state = payload?.instance?.state ?? payload?.state ?? payload?.connectionStatus ?? payload?.status ?? "desconhecido";
      } catch (error) {
        if (error?.status === 404) {
          state = "not_created";
        } else {
          throw error;
        }
      }

      database.evolution = {
        ...evolution,
        instance,
        lastStatusAt: new Date().toISOString(),
        lastConnectionState: state,
      };
      await writeDatabase(database);

      jsonResponse(response, 200, {
        ok: true,
        instance,
        state,
        connected: ["open", "connected", "online"].includes(String(state).toLowerCase()),
        checkedAt: database.evolution.lastStatusAt,
      });
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

    if (request.method === "POST" && url.pathname === "/api/whatsapp/sync") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const sync = await syncWhatsAppHistory(database, { quick: Boolean(body.quick) });
      await writeDatabase(database);

      jsonResponse(response, 200, {
        ok: true,
        sync,
        conversations: database.conversations,
        messages: database.messages,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/read") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const remoteJid = normalizeRemoteJid(body.remoteJid || body.conversationId);
      const now = new Date().toISOString();

      database.conversations = (database.conversations ?? []).map((conversation) => {
        const matches = (conversation.remoteJid || conversation.id) === remoteJid || (conversation.aliases ?? []).includes(remoteJid);
        return matches ? { ...conversation, unread: 0, lastReadAt: now } : conversation;
      });
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, remoteJid, lastReadAt: now });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/whatsapp/media/")) {
      const parts = url.pathname.split("/");
      const isDownload = parts.at(-1) === "download";
      const messageId = decodeURIComponent(isDownload ? (parts.at(-2) ?? "") : (parts.at(-1) ?? ""));
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const message = (database.messages ?? []).find(
        (item) => String(item.id) === messageId || String(item.evolutionMessageId) === messageId,
      );

      if (!message) {
        jsonResponse(response, 404, { error: "Arquivo nao encontrado no historico." });
        return;
      }

      try {
        const media = await resolveMediaPayload(database, instance, message);
        database.messages = (database.messages ?? []).map((item) =>
          String(item.id) === messageId || String(item.evolutionMessageId) === messageId
            ? { ...item, mediaUrl: media.dataUrl, mimeType: media.mimeType, fileName: media.fileName }
            : item,
        );
        await writeDatabase(database);

        if (isDownload || url.searchParams.get("download") === "1") {
          binaryResponse(response, media);
          return;
        }

        jsonResponse(response, 200, { ok: true, dataUrl: media.dataUrl, fileName: media.fileName, mimeType: media.mimeType });
      } catch (error) {
        jsonResponse(response, 400, { error: error instanceof Error ? error.message : "Nao foi possivel baixar o arquivo." });
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/send-text") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const remoteJid = normalizeRemoteJid(body.remoteJid);
      const text = String(body.text ?? "").trim();

      if (!remoteJid || !text) {
        jsonResponse(response, 400, { error: "Conversa e mensagem sao obrigatorias." });
        return;
      }

      const conversation = (database.conversations ?? []).find(
        (item) => (item.remoteJid || item.id) === remoteJid || String(item.id) === String(body.conversationId ?? ""),
      );
      const quotedMessage = body.replyTo?.id
        ? (database.messages ?? []).find((item) => String(item.id) === String(body.replyTo.id) || String(item.evolutionMessageId) === String(body.replyTo.id))
        : undefined;
      const { payload } = await sendEvolutionText(database, instance, remoteJid, conversation?.phone, text, quotedMessage);

      const timestamp = Date.now();
      const message = {
        id: payload?.key?.id || payload?.messageId || `local-${remoteJid}-${timestamp}`,
        evolutionMessageId: payload?.key?.id || payload?.messageId || "",
        conversationId: remoteJid,
        remoteJid,
        from: "agent",
        body: text,
        time: formatMessageTime(timestamp),
        timestamp,
        kind: "text",
        source: "evolution",
        replyTo: quotedMessage ? { id: quotedMessage.id, body: quotedMessage.body, from: quotedMessage.from } : undefined,
      };

      database.messages = mergeByKey(database.messages ?? [], [message], (item) => item.evolutionMessageId || item.id);
      database.conversations = (database.conversations ?? []).map((conversation) =>
        (conversation.remoteJid || conversation.id) === remoteJid
          ? { ...conversation, lastMessage: text, lastMessageAt: new Date(timestamp).toISOString() }
          : conversation,
      );
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, message });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/forward") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const messageId = String(body.messageId ?? "");
      const targetRemoteJid = normalizeRemoteJid(body.targetRemoteJid);
      const targetConversation = (database.conversations ?? []).find(
        (item) => (item.remoteJid || item.id) === targetRemoteJid || (item.aliases ?? []).includes(targetRemoteJid),
      );
      const sourceMessage = (database.messages ?? []).find(
        (item) => String(item.id) === messageId || String(item.evolutionMessageId) === messageId,
      );

      if (!sourceMessage || !targetRemoteJid) {
        jsonResponse(response, 400, { error: "Mensagem e conversa de destino sao obrigatorias." });
        return;
      }

      let sent;
      if (sourceMessage.mediaUrl || sourceMessage.fileName) {
        const media = await resolveMediaPayload(database, instance, sourceMessage);
        sent = await sendEvolutionMedia(database, instance, targetRemoteJid, targetConversation?.phone, {
          data: media.dataUrl,
          mimeType: media.mimeType,
          fileName: media.fileName,
          caption: sourceMessage.body,
          mediaType: sourceMessage.kind === "video" ? "video" : sourceMessage.kind === "audio" ? "audio" : sourceMessage.mimeType?.startsWith("image/") ? "image" : "document",
        });
      } else {
        sent = await sendEvolutionText(database, instance, targetRemoteJid, targetConversation?.phone, sourceMessage.body);
      }

      jsonResponse(response, 200, { ok: true, payload: sent.payload });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/reaction") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const messageId = String(body.messageId ?? "");
      const emoji = String(body.emoji ?? "").trim();
      const message = (database.messages ?? []).find(
        (item) => String(item.id) === messageId || String(item.evolutionMessageId) === messageId,
      );

      if (!message || !emoji) {
        jsonResponse(response, 400, { error: "Mensagem e emoji sao obrigatorios." });
        return;
      }

      const key = message.rawMessage?.key || {
        id: message.evolutionMessageId || message.id,
        remoteJid: message.remoteJid || message.conversationId,
        fromMe: message.from === "agent",
      };

      await tryEvolutionApi(database, `/message/sendReaction/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({ key, reaction: emoji }),
      });

      database.messages = (database.messages ?? []).map((item) =>
        String(item.id) === messageId || String(item.evolutionMessageId) === messageId
          ? { ...item, reactions: [{ emoji, fromMe: true, at: new Date().toISOString() }] }
          : item,
      );
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, emoji });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/delete-message") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const messageIds = Array.isArray(body.messageIds) ? body.messageIds.map(String) : [String(body.messageId ?? "")];
      const messagesToDelete = (database.messages ?? []).filter((item) =>
        messageIds.includes(String(item.id)) || messageIds.includes(String(item.evolutionMessageId)),
      );

      const deleteResults = [];
      for (const message of messagesToDelete) {
        const key = message.rawMessage?.key || {
          id: message.evolutionMessageId || message.id,
          remoteJid: message.remoteJid || message.conversationId,
          fromMe: message.from === "agent",
          participant: message.rawMessage?.key?.participant,
        };
        const result = await tryEvolutionApi(database, `/chat/deleteMessageForEveryone/${encodeURIComponent(instance)}`, {
          method: "DELETE",
          body: JSON.stringify({
            id: key.id,
            remoteJid: key.remoteJid,
            fromMe: key.fromMe,
            participant: key.participant,
          }),
        });
        deleteResults.push({ id: key.id, result });
      }

      database.messages = (database.messages ?? []).filter(
        (item) => !messageIds.includes(String(item.id)) && !messageIds.includes(String(item.evolutionMessageId)),
      );
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, deleted: messagesToDelete.length, deleteResults });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/archive-conversation") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const remoteJid = normalizeRemoteJid(body.remoteJid || body.conversationId);
      const archive = body.archive !== false;

      if (!remoteJid) {
        jsonResponse(response, 400, { error: "Conversa obrigatoria." });
        return;
      }

      const archiveResult = await tryEvolutionApi(database, `/chat/archiveChat/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({
          chat: remoteJid,
          archive,
          lastMessage: { key: (getLastMessageForChat(database, remoteJid)?.rawMessage?.key || { remoteJid, fromMe: true, id: `archive-${Date.now()}` }) },
        }),
      });

      database.conversations = (database.conversations ?? []).map((conversation) =>
        (conversation.remoteJid || conversation.id) === remoteJid || (conversation.aliases ?? []).includes(remoteJid)
          ? { ...conversation, archived: archive }
          : conversation,
      );
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, archived: archive, archiveResult });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/delete-conversation") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const remoteJid = normalizeRemoteJid(body.remoteJid || body.conversationId);
      const conversation = (database.conversations ?? []).find(
        (item) => (item.remoteJid || item.id) === remoteJid || (item.aliases ?? []).includes(remoteJid),
      );
      const aliases = [remoteJid, conversation?.remoteJid, conversation?.id, ...(conversation?.aliases ?? [])].filter(Boolean);

      const archiveResult = await tryEvolutionApi(database, `/chat/archiveChat/${encodeURIComponent(instance)}`, {
        method: "POST",
        body: JSON.stringify({
          chat: remoteJid,
          archive: true,
          lastMessage: { key: (getLastMessageForChat(database, remoteJid)?.rawMessage?.key || { remoteJid, fromMe: true, id: `archive-${Date.now()}` }) },
        }),
      });

      database.conversations = (database.conversations ?? []).filter(
        (item) => !aliases.includes(item.remoteJid) && !aliases.includes(item.id),
      );
      database.messages = (database.messages ?? []).filter(
        (item) => !aliases.includes(item.remoteJid) && !aliases.includes(item.conversationId),
      );
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, archiveResult });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/whatsapp/send-media") {
      const body = await readJsonBody(request);
      const database = await ensureDatabase();
      const { instance } = getEvolutionConfig(database);
      const remoteJid = normalizeRemoteJid(body.remoteJid);
      const conversation = (database.conversations ?? []).find(
        (item) => (item.remoteJid || item.id) === remoteJid || String(item.id) === String(body.conversationId ?? ""),
      );

      if (!remoteJid || !body.data || !body.mimeType) {
        jsonResponse(response, 400, { error: "Conversa e arquivo sao obrigatorios." });
        return;
      }

      const mediaPayload = {
        data: body.data,
        mimeType: body.mimeType,
        fileName: body.fileName,
        caption: body.caption,
        mediaType: body.mediaType,
      };
      const quotedMessage = body.replyTo?.id
        ? (database.messages ?? []).find((item) => String(item.id) === String(body.replyTo.id) || String(item.evolutionMessageId) === String(body.replyTo.id))
        : undefined;
      const { payload } = body.mediaType === "audio"
        ? await sendEvolutionAudio(database, instance, remoteJid, conversation?.phone, mediaPayload, quotedMessage)
        : await sendEvolutionMedia(database, instance, remoteJid, conversation?.phone, mediaPayload, quotedMessage);

      const timestamp = Date.now();
      const message = {
        id: payload?.key?.id || payload?.messageId || `local-media-${remoteJid}-${timestamp}`,
        evolutionMessageId: payload?.key?.id || payload?.messageId || "",
        conversationId: remoteJid,
        remoteJid,
        from: "agent",
        body: body.caption || body.fileName || "Arquivo enviado",
        time: formatMessageTime(timestamp),
        timestamp,
        kind: body.mediaType === "audio" ? "audio" : body.mediaType === "video" ? "video" : "file",
        mediaUrl: body.data,
        fileName: body.fileName || "arquivo",
        mimeType: body.mimeType || "application/octet-stream",
        source: "evolution",
      };

      database.messages = mergeByKey(database.messages ?? [], [message], (item) => item.evolutionMessageId || item.id);
      await writeDatabase(database);

      jsonResponse(response, 200, { ok: true, message });
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
