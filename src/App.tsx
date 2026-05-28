import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  FileText,
  Forward,
  Headphones,
  KanbanSquare,
  LayoutDashboard,
  List,
  Lock,
  LogOut,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  PlayCircle,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

type View = "dashboard" | "whatsapp" | "leads" | "automation" | "settings";
type LeadTemperature = "Frio" | "Morno" | "Quente";

type Lead = {
  id: number;
  name: string;
  state: string;
  phone: string;
  stage: string;
  score: number;
  temperature: LeadTemperature;
  tags: string[];
  value: number;
  lastContact: string;
  owner: "IA" | "Humano";
  summary: string;
};

type Conversation = {
  id: number | string;
  remoteJid?: string;
  aliases?: string[];
  lastReadAt?: string;
  archived?: boolean;
  name: string;
  phone: string;
  number?: string;
  profilePicUrl?: string;
  state: string;
  status: string;
  lastMessage: string;
  unread: number;
  score: number;
  channel: "WhatsApp";
};

type Message = {
  id: number | string;
  conversationId?: number | string;
  remoteJid?: string;
  timestamp?: number;
  evolutionMessageId?: string;
  from: "lead" | "agent" | "system";
  body: string;
  time: string;
  kind?: "text" | "audio" | "video" | "file";
  mediaUrl?: string;
  thumbnail?: string;
  fileName?: string;
  mimeType?: string;
  status?: "pending" | "sent" | "failed";
  rawType?: string;
  reactions?: Array<{ emoji: string; fromMe?: boolean; at?: string }>;
  replyTo?: { id: string | number; body: string; from: "lead" | "agent" | "system" };
};

type AgentSettings = {
  businessHours: string;
  inactivityMinutes: number;
  handoffScore: number;
  followUpCadence: string[];
  mainInstruction: string;
  missions: string[];
};

type EvolutionSettings = {
  baseUrl: string;
  instance: string;
  apiKey: string;
  connected: boolean;
  hasApiKey?: boolean;
  apiKeyPreview?: string;
  webhookPath: string;
  lastSavedAt?: string;
};

type EvolutionTestResult = {
  ok: boolean;
  instance: string;
  state: string;
  connected: boolean;
  created?: boolean;
};

type EvolutionQrCodeResult = {
  ok: boolean;
  instance: string;
  created?: boolean;
  qrCode: {
    image: string;
    code: string;
  };
};

type WhatsAppStatus = {
  ok: boolean;
  instance: string;
  state: string;
  connected: boolean;
  checkedAt?: string;
};

type SendQueueItem = {
  localId: string;
  endpoint: "/api/whatsapp/send-text" | "/api/whatsapp/send-media";
  body: Record<string, unknown>;
};

type BootstrapData = {
  stages: string[];
  tags: string[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  agentSettings: AgentSettings;
  evolution: Omit<EvolutionSettings, "apiKey">;
};

type ApiStatus = "offline" | "online" | "local";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://localhost:3333");
const SEEDED_USER_EMAIL = "rafael-goedert@hotmail.com";
const SEEDED_PASSWORD_HASH =
  "f2f3585187d6d62f77b9dac07fd2755c72dcb9bee427216982cb605cf9f5a9bf";

const initialStages = ["Novo lead", "Qualificando", "Proposta", "Follow-up", "Fechado"];
const initialTags = ["imovel", "urgente", "alto potencial", "precisa financiamento"];

const initialLeads: Lead[] = [
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
];

const conversations: Conversation[] = [
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
];

const messages: Message[] = [
  {
    id: 1,
    from: "lead",
    body: "Oi, vi o anuncio e queria entender melhor.",
    time: "10:28",
  },
  {
    id: 2,
    from: "agent",
    body: "Claro, Mariana. Para eu te ajudar melhor, qual e o seu nome completo e de qual estado voce fala?",
    time: "10:29",
  },
  {
    id: 3,
    from: "lead",
    body: "Sou Mariana Costa, de Santa Catarina.",
    time: "10:30",
  },
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
  {
    id: 8,
    from: "lead",
    body: "Quero agendar uma visita no sabado.",
    time: "10:41",
  },
];

const missions = [
  "Identificar nome, estado, objetivo e urgencia do lead.",
  "Mapear orcamento, prazo, objeções e decisores.",
  "Enviar conteudo correto da base de conhecimento.",
  "Pontuar interesse de 0% a 100% e acionar humano quando quente.",
  "Executar follow-ups inteligentes sem parecer robo.",
];

const initialAgentSettings: AgentSettings = {
  businessHours: "Segunda a sexta, 08:00 as 20:00; sabado, 09:00 as 13:00",
  inactivityMinutes: 25,
  handoffScore: 80,
  followUpCadence: ["1 hora", "24 horas", "3 dias", "7 dias"],
  mainInstruction:
    "Responda de forma humana, consultiva e objetiva. Colete nome, estado, objetivo, orcamento, prazo e objeções. Classifique cada lead de 0% a 100%.",
  missions,
};

const initialEvolutionSettings: EvolutionSettings = {
  baseUrl: "",
  instance: "atendedor-20",
  apiKey: "",
  connected: false,
  hasApiKey: false,
  webhookPath: "/api/evolution/webhook",
};

const automationRules = [
  {
    title: "Horario de funcionamento",
    value: "Segunda a sexta, 08:00 as 20:00; sabado, 09:00 as 13:00",
  },
  {
    title: "Tempo de inatividade",
    value: "Se o lead ficar 25 minutos sem resposta, iniciar follow-up leve.",
  },
  {
    title: "Passagem para humano",
    value: "Score acima de 80%, pedido de proposta ou reclamacao critica.",
  },
  {
    title: "Recuperacao de leads",
    value: "Sequencia de 1h, 24h, 3 dias e 7 dias com contexto da conversa.",
  },
];

const navigation: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "leads", label: "Leads CRM", icon: KanbanSquare },
  { id: "automation", label: "Agente IA", icon: Bot },
  { id: "settings", label: "Configuracoes", icon: Settings },
];

async function apiRequest<T>(path: string, options: RequestInit & { token?: string } = {}) {
  const { token, headers, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Erro de comunicacao com a API local.");
  }

  return payload as T;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function conversationMatches(a: Conversation, b: Conversation) {
  const aIds = new Set([a.id, a.remoteJid, ...(a.aliases ?? [])].filter(Boolean));
  return [b.id, b.remoteJid, ...(b.aliases ?? [])].filter(Boolean).some((id) => aIds.has(id));
}

function mergeClientMessages(serverMessages: Message[], currentMessages: Message[]) {
  const map = new Map<string | number, Message>();

  for (const message of serverMessages) {
    map.set(message.evolutionMessageId || message.id, message);
  }

  for (const message of currentMessages) {
    const key = message.evolutionMessageId || message.id;
    if (!map.has(key) || message.status === "pending" || message.status === "failed") {
      map.set(key, message);
    }
  }

  return Array.from(map.values()).sort((a, b) => Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0));
}

function getTemperature(score: number): LeadTemperature {
  if (score >= 75) return "Quente";
  if (score >= 45) return "Morno";
  return "Frio";
}

function App() {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem("atendedor-2-token") ?? "");
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem("atendedor-2-token")) || localStorage.getItem("atendedor-2-session") === "true",
  );
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [email, setEmail] = useState(SEEDED_USER_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [apiStatus, setApiStatus] = useState<ApiStatus>(sessionToken ? "online" : "local");
  const [conversationList, setConversationList] = useState(conversations);
  const [chatMessages, setChatMessages] = useState(messages);
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [leadMode, setLeadMode] = useState<"kanban" | "list">("kanban");
  const [leads, setLeads] = useState(initialLeads);
  const [stages, setStages] = useState(initialStages);
  const [tags, setTags] = useState(initialTags);
  const [newStage, setNewStage] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newLead, setNewLead] = useState({ name: "", state: "", phone: "" });
  const [messageDraft, setMessageDraft] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState<Array<string | number>>([]);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const selectedConversationRef = useRef<Conversation>(conversations[0]);
  const readAliasesRef = useRef<Set<string | number>>(new Set());
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const sendQueueRef = useRef<SendQueueItem[]>([]);
  const isProcessingQueueRef = useRef(false);
  const [whatsAppSyncStatus, setWhatsAppSyncStatus] = useState("");
  const [whatsAppBusy, setWhatsAppBusy] = useState<"" | "sync" | "send">("");
  const [hasAutoSyncedWhatsApp, setHasAutoSyncedWhatsApp] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(initialAgentSettings);
  const [evolutionSettings, setEvolutionSettings] = useState<EvolutionSettings>(initialEvolutionSettings);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [evolutionActionStatus, setEvolutionActionStatus] = useState("");
  const [evolutionQrCode, setEvolutionQrCode] = useState<EvolutionQrCodeResult["qrCode"] | null>(null);
  const [evolutionBusy, setEvolutionBusy] = useState<"" | "test" | "qrcode" | "reset">("");
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus>({
    ok: false,
    instance: "atendedor-20",
    state: "checking",
    connected: false,
  });

  useEffect(() => {
    if (!isAuthenticated || !sessionToken) return;

    let isCancelled = false;

    apiRequest<BootstrapData>("/api/bootstrap", { token: sessionToken })
      .then((data) => {
        if (isCancelled) return;
        setLeads(data.leads);
        setStages(data.stages);
        setTags(data.tags);
        setConversationList(data.conversations);
        setChatMessages(data.messages);
        setAgentSettings(data.agentSettings);
        setEvolutionSettings({ ...initialEvolutionSettings, ...data.evolution, apiKey: "" });
        setSelectedConversation((current) =>
          data.conversations.find((conversation) => conversation.id === current.id) ?? data.conversations[0],
        );
        setApiStatus("online");
      })
      .catch(() => setApiStatus("offline"));

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionToken]);

  useEffect(() => {
    if (!isAuthenticated || !sessionToken) return;

    let isCancelled = false;

    async function refreshWhatsAppStatus() {
      try {
        const status = await apiRequest<WhatsAppStatus>("/api/evolution/status", { token: sessionToken });
        if (!isCancelled) setWhatsAppStatus(status);
      } catch {
        if (!isCancelled) {
          setWhatsAppStatus((current) => ({
            ...current,
            ok: false,
            connected: false,
            state: "unreachable",
          }));
        }
      }
    }

    refreshWhatsAppStatus();
    const intervalId = window.setInterval(refreshWhatsAppStatus, 15000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, sessionToken]);

  const metrics = useMemo(() => {
    const hotLeads = leads.filter((lead) => lead.temperature === "Quente").length;
    const pipeline = leads.reduce((sum, lead) => sum + lead.value, 0);
    const averageScore = Math.round(
      leads.reduce((sum, lead) => sum + lead.score, 0) / Math.max(leads.length, 1),
    );

    return {
      total: leads.length,
      hotLeads,
      pipeline,
      averageScore,
      aiHandled: leads.filter((lead) => lead.owner === "IA").length,
    };
  }, [leads]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? email).trim().toLowerCase();
    const submittedPassword = String(formData.get("password") ?? password);
    setEmail(submittedEmail);
    setPassword(submittedPassword);
    let apiError = "";

    try {
      const result = await apiRequest<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      });
      localStorage.setItem("atendedor-2-token", result.token);
      localStorage.setItem("atendedor-2-session", "true");
      setSessionToken(result.token);
      setApiStatus("online");
      setIsAuthenticated(true);
      return;
    } catch (error) {
      apiError = error instanceof Error ? error.message : "Erro ao chamar a API online.";
      setApiStatus("offline");
    }

    const normalizedEmail = submittedEmail;
    const passwordHash = await sha256(submittedPassword);

    if (normalizedEmail === SEEDED_USER_EMAIL && passwordHash === SEEDED_PASSWORD_HASH) {
      localStorage.setItem("atendedor-2-session", "true");
      setIsAuthenticated(true);
      setApiStatus("local");
      return;
    }

    setLoginError(
      apiError
        ? `Nao foi possivel entrar. Resposta da API: ${apiError}`
        : "E-mail ou senha invalidos. Confira maiusculas, minusculas e caracteres especiais.",
    );
  }

  function handleLogout() {
    localStorage.removeItem("atendedor-2-token");
    localStorage.removeItem("atendedor-2-session");
    setSessionToken("");
    setIsAuthenticated(false);
    setPassword("");
  }

  async function addLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newLead.name.trim() || !newLead.state.trim()) return;

    if (sessionToken) {
      try {
        const createdLead = await apiRequest<Lead>("/api/leads", {
          method: "POST",
          token: sessionToken,
          body: JSON.stringify(newLead),
        });
        setLeads((current) => [createdLead, ...current]);
        setApiStatus("online");
        setNewLead({ name: "", state: "", phone: "" });
        return;
      } catch {
        setApiStatus("offline");
      }
    }

    const score = 30 + Math.floor(Math.random() * 35);
    setLeads((current) => [
      {
        id: Date.now(),
        name: newLead.name.trim(),
        state: newLead.state.trim().toUpperCase(),
        phone: newLead.phone.trim() || "WhatsApp pendente",
        stage: stages[0],
        score,
        temperature: getTemperature(score),
        tags: ["novo"],
        value: 0,
        lastContact: "agora",
        owner: "IA",
        summary: "Lead criado manualmente. A IA deve completar qualificacao na conversa.",
      },
      ...current,
    ]);
    setNewLead({ name: "", state: "", phone: "" });
  }

  function moveLead(leadId: number, direction: 1 | -1) {
    let updatedLead: Lead | undefined;

    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== leadId) return lead;
        const currentIndex = stages.indexOf(lead.stage);
        const nextStage = stages[Math.min(Math.max(currentIndex + direction, 0), stages.length - 1)];
        updatedLead = { ...lead, stage: nextStage };
        return updatedLead;
      }),
    );

    if (sessionToken && updatedLead) {
      apiRequest<Lead>(`/api/leads/${leadId}`, {
        method: "PATCH",
        token: sessionToken,
        body: JSON.stringify({ stage: updatedLead.stage }),
      }).catch(() => setApiStatus("offline"));
    }
  }

  async function addStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newStage.trim();
    if (!value || stages.includes(value)) return;

    if (sessionToken) {
      try {
        const nextStages = await apiRequest<string[]>("/api/stages", {
          method: "POST",
          token: sessionToken,
          body: JSON.stringify({ name: value }),
        });
        setStages(nextStages);
        setApiStatus("online");
        setNewStage("");
        return;
      } catch {
        setApiStatus("offline");
      }
    }

    setStages((current) => [...current, value]);
    setNewStage("");
  }

  async function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newTag.trim().toLowerCase();
    if (!value || tags.includes(value)) return;

    if (sessionToken) {
      try {
        const nextTags = await apiRequest<string[]>("/api/tags", {
          method: "POST",
          token: sessionToken,
          body: JSON.stringify({ name: value }),
        });
        setTags(nextTags);
        setApiStatus("online");
        setNewTag("");
        return;
      } catch {
        setApiStatus("offline");
      }
    }

    setTags((current) => [...current, value]);
    setNewTag("");
  }

  async function processSendQueue() {
    if (isProcessingQueueRef.current || !sessionToken) return;
    const next = sendQueueRef.current.shift();
    if (!next) return;

    isProcessingQueueRef.current = true;
    setWhatsAppBusy("send");

    try {
      const result = await apiRequest<{ ok: boolean; message: Message }>(next.endpoint, {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify(next.body),
      });
      setChatMessages((current) =>
        current.map((message) => (message.id === next.localId ? { ...result.message, status: "sent" } : message)),
      );
    } catch (error) {
      setChatMessages((current) =>
        current.map((message) => (message.id === next.localId ? { ...message, status: "failed" } : message)),
      );
      setWhatsAppSyncStatus(error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem.");
    } finally {
      isProcessingQueueRef.current = false;
      setWhatsAppBusy(sendQueueRef.current.length ? "send" : "");
      if (sendQueueRef.current.length) processSendQueue();
    }
  }

  function enqueueSend(item: SendQueueItem) {
    sendQueueRef.current.push(item);
    processSendQueue();
  }

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  function applyLocalReadState(conversationsToUpdate: Conversation[]) {
    return conversationsToUpdate.map((conversation) => {
      const ids = [conversation.id, conversation.remoteJid, ...(conversation.aliases ?? [])].filter((id): id is string | number => id !== undefined && id !== "");
      return ids.some((id) => readAliasesRef.current.has(id)) ? { ...conversation, unread: 0 } : conversation;
    });
  }

  function startNewConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = newConversationPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setWhatsAppSyncStatus("Informe um telefone valido com DDD.");
      return;
    }

    const remoteJid = `${digits}@s.whatsapp.net`;
    const existing = conversationList.find(
      (conversation) => conversation.remoteJid === remoteJid || conversation.number === digits || conversation.phone.replace(/\D/g, "") === digits,
    );

    if (existing) {
      setSelectedConversation(existing);
    } else {
      const conversation: Conversation = {
        id: remoteJid,
        remoteJid,
        name: `+${digits}`,
        phone: `+${digits}`,
        number: digits,
        state: "--",
        status: "nova conversa",
        lastMessage: "Nova conversa",
        unread: 0,
        score: 50,
        channel: "WhatsApp",
      };
      setConversationList((current) => [conversation, ...current]);
      setSelectedConversation(conversation);
    }

    setNewConversationPhone("");
    setIsNewConversationOpen(false);
  }

  async function markConversationRead(conversation: Conversation) {
    const remoteJid = conversation.remoteJid ?? String(conversation.id);
    [conversation.id, conversation.remoteJid, ...(conversation.aliases ?? [])].filter((id): id is string | number => id !== undefined && id !== "").forEach((id) =>
      readAliasesRef.current.add(id),
    );
    setConversationList((current) =>
      current.map((item) => {
        const ids = [item.id, item.remoteJid, ...(item.aliases ?? [])].filter((id): id is string | number => id !== undefined && id !== "");
        return ids.some((id) => readAliasesRef.current.has(id)) ? { ...item, unread: 0 } : item;
      }),
    );
    setSelectedConversation({ ...conversation, unread: 0 });

    if (!sessionToken) return;
    try {
      await apiRequest<{ ok: boolean }>("/api/whatsapp/read", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ remoteJid, conversationId: conversation.id }),
      });
    } catch {
      // Reading state is best-effort; syncing will reconcile later.
    }
  }

  function archiveConversationLocal(conversation: Conversation, archive: boolean) {
    const aliases = new Set([conversation.id, conversation.remoteJid, ...(conversation.aliases ?? [])].filter(Boolean));
    setConversationList((current) =>
      current.map((item) =>
        [item.id, item.remoteJid, ...(item.aliases ?? [])].some((id) => aliases.has(id))
          ? { ...item, archived: archive }
          : item,
      ),
    );
    setSelectedConversation((current) =>
      [current.id, current.remoteJid, ...(current.aliases ?? [])].some((id) => aliases.has(id))
        ? { ...current, archived: archive }
        : current,
    );
  }

  function deleteConversationLocal(conversation: Conversation) {
    const aliases = new Set([conversation.id, conversation.remoteJid, ...(conversation.aliases ?? [])].filter(Boolean));
    setConversationList((current) => {
      const next = current.filter((item) => ![item.id, item.remoteJid, ...(item.aliases ?? [])].some((id) => aliases.has(id)));
      setSelectedConversation((selected) =>
        [selected.id, selected.remoteJid, ...(selected.aliases ?? [])].some((id) => aliases.has(id))
          ? (next[0] ?? selected)
          : selected,
      );
      return next;
    });
    setChatMessages((current) =>
      current.filter((message) => !aliases.has(message.remoteJid) && !aliases.has(message.conversationId)),
    );
  }

  async function syncWhatsApp(silent = false) {
    if (!silent) {
      setWhatsAppSyncStatus("Sincronizando conversas e mensagens...");
      setWhatsAppBusy("sync");
    }

    if (!sessionToken) {
      setWhatsAppSyncStatus("Entre novamente para sincronizar o WhatsApp.");
      setWhatsAppBusy("");
      return;
    }

    try {
      const result = await apiRequest<{
        ok: boolean;
        sync: { importedConversations: number; importedMessages: number; lastSyncAt: string };
        conversations: Conversation[];
        messages: Message[];
      }>("/api/whatsapp/sync", {
        method: "POST",
        token: sessionToken,
        body: JSON.stringify({ quick: silent }),
      });
      setConversationList(applyLocalReadState(result.conversations));
      setChatMessages((current) => mergeClientMessages(result.messages, current));
      const selectedNow = selectedConversationRef.current;
      const updatedSelected = result.conversations.find((conversation) => conversationMatches(conversation, selectedNow));
      if (updatedSelected) {
        setSelectedConversation({ ...updatedSelected, unread: 0 });
        markConversationRead(updatedSelected);
      }

      if (!silent) {
        setWhatsAppSyncStatus(
          `Sincronizacao concluida: ${result.sync.importedConversations} conversas e ${result.sync.importedMessages} mensagens importadas.`,
        );
      }
    } catch (error) {
      if (!silent) setWhatsAppSyncStatus(error instanceof Error ? error.message : "Nao foi possivel sincronizar o WhatsApp.");
    } finally {
      if (!silent) setWhatsAppBusy("");
    }
  }

  async function sendWhatsAppText() {
    const text = messageDraft.trim();
    const remoteJid = selectedConversation.remoteJid ?? String(selectedConversation.id);
    if (!text || !remoteJid || !sessionToken) return;

    const localId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: Message = {
      id: localId,
      conversationId: remoteJid,
      remoteJid,
      from: "agent",
      body: text,
      time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      timestamp: Date.now(),
      kind: "text",
      status: "pending",
      replyTo: replyToMessage ? { id: replyToMessage.id, body: replyToMessage.body, from: replyToMessage.from } : undefined,
    };

    setChatMessages((current) => [...current, optimisticMessage]);
    setConversationList((current) =>
      current.map((conversation) =>
        conversationMatches(conversation, selectedConversation)
          ? { ...conversation, lastMessage: text, lastMessageAt: new Date().toISOString() }
          : conversation,
      ),
    );
    setMessageDraft("");
    setReplyToMessage(null);
    enqueueSend({
      localId,
      endpoint: "/api/whatsapp/send-text",
      body: {
        remoteJid,
        conversationId: selectedConversation.id,
        text,
        replyTo: replyToMessage ? { id: replyToMessage.evolutionMessageId || replyToMessage.id } : undefined,
      },
    });
  }

  async function sendWhatsAppMedia(file: File, mediaType: "audio" | "video" | "image" | "document") {
    const remoteJid = selectedConversation.remoteJid ?? String(selectedConversation.id);
    if (!file || !remoteJid || !sessionToken) return;

    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const localId = `pending-media-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: Message = {
      id: localId,
      conversationId: remoteJid,
      remoteJid,
      from: "agent",
      body: messageDraft.trim() || file.name || "Arquivo enviado",
      time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      timestamp: Date.now(),
      kind: mediaType === "audio" ? "audio" : mediaType === "video" ? "video" : "file",
      mediaUrl: data,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      status: "pending",
    };

    setChatMessages((current) => [...current, optimisticMessage]);
    setConversationList((current) =>
      current.map((conversation) =>
        conversationMatches(conversation, selectedConversation)
          ? { ...conversation, lastMessage: optimisticMessage.body, lastMessageAt: new Date().toISOString() }
          : conversation,
      ),
    );
    setMessageDraft("");
    enqueueSend({
      localId,
      endpoint: "/api/whatsapp/send-media",
      body: {
        remoteJid,
        conversationId: selectedConversation.id,
        data,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        mediaType,
        caption: optimisticMessage.body,
      },
    });
  }

  async function toggleAudioRecording() {
    if (isRecordingAudio) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingAudio(false);
        sendWhatsAppMedia(file, "audio");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
      setWhatsAppSyncStatus("Gravando audio... clique no microfone novamente para enviar.");
    } catch {
      setWhatsAppSyncStatus("Nao foi possivel acessar o microfone do navegador.");
    }
  }

  useEffect(() => {
    if (activeView !== "whatsapp" || !sessionToken) return;

    if (!hasAutoSyncedWhatsApp) {
      setHasAutoSyncedWhatsApp(true);
      syncWhatsApp();
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") syncWhatsApp(true);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [activeView, sessionToken, hasAutoSyncedWhatsApp]);

  async function saveAgentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus("");

    if (!sessionToken) {
      setSettingsStatus("Configuracoes alteradas apenas nesta tela. Rode a API local para salvar no arquivo.");
      return;
    }

    try {
      const savedSettings = await apiRequest<AgentSettings>("/api/settings/agent", {
        method: "PATCH",
        token: sessionToken,
        body: JSON.stringify(agentSettings),
      });
      setAgentSettings(savedSettings);
      setApiStatus("online");
      setSettingsStatus("Configuracoes do agente salvas com sucesso.");
    } catch (error) {
      setApiStatus("offline");
      setSettingsStatus(error instanceof Error ? error.message : "Nao foi possivel salvar o agente.");
    }
  }

  async function saveEvolutionSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus("");

    if (!sessionToken) {
      setSettingsStatus("Rode a API local para salvar a conexao da Evolution API.");
      return;
    }

    try {
      const savedSettings = await apiRequest<Omit<EvolutionSettings, "apiKey">>("/api/settings/evolution", {
        method: "PATCH",
        token: sessionToken,
        body: JSON.stringify({
          baseUrl: evolutionSettings.baseUrl,
          apiKey: evolutionSettings.apiKey,
        }),
      });
      setEvolutionSettings({ ...initialEvolutionSettings, ...savedSettings, apiKey: "" });
      setApiStatus("online");
      setSettingsStatus("Conexao da Evolution API salva. A chave ficou guardada somente no backend local.");
    } catch (error) {
      setApiStatus("offline");
      setSettingsStatus(error instanceof Error ? error.message : "Nao foi possivel salvar a Evolution API.");
    }
  }

  async function testEvolutionConnection() {
    setEvolutionActionStatus("");
    setEvolutionQrCode(null);

    if (!sessionToken) {
      setEvolutionActionStatus("Entre novamente para testar a Evolution API.");
      return;
    }

    setEvolutionBusy("test");
    try {
      const result = await apiRequest<EvolutionTestResult>("/api/evolution/test", {
        method: "POST",
        token: sessionToken,
      });
      setApiStatus("online");
      setEvolutionActionStatus(
        result.connected
          ? `Conexao OK. Instancia ${result.instance} esta conectada (${result.state}).`
          : result.created
            ? `Instancia ${result.instance} criada automaticamente. Agora clique em Gerar QR Code.`
            : `API respondeu. Estado atual da instancia ${result.instance}: ${result.state}.`,
      );
    } catch (error) {
      setEvolutionActionStatus(error instanceof Error ? error.message : "Nao foi possivel testar a Evolution API.");
    } finally {
      setEvolutionBusy("");
    }
  }

  async function generateEvolutionQrCode() {
    setEvolutionActionStatus("");
    setEvolutionQrCode(null);

    if (!sessionToken) {
      setEvolutionActionStatus("Entre novamente para gerar o QR Code.");
      return;
    }

    setEvolutionBusy("qrcode");
    try {
      const result = await apiRequest<EvolutionQrCodeResult>("/api/evolution/qrcode", {
        method: "POST",
        token: sessionToken,
      });
      setApiStatus("online");
      setEvolutionQrCode(result.qrCode);
      setEvolutionActionStatus(
        result.qrCode.image || result.qrCode.code
          ? `QR Code gerado para a instancia ${result.instance}. Escaneie com o WhatsApp no celular.`
          : `Instancia ${result.instance} pronta, mas a Evolution nao retornou um QR Code reconhecido.`,
      );
    } catch (error) {
      setEvolutionActionStatus(error instanceof Error ? error.message : "Nao foi possivel gerar o QR Code.");
    } finally {
      setEvolutionBusy("");
    }
  }

  async function resetEvolutionConnection() {
    setEvolutionActionStatus("");
    setEvolutionQrCode(null);

    if (!sessionToken) {
      setEvolutionActionStatus("Entre novamente para reiniciar a conexao.");
      return;
    }

    setEvolutionBusy("reset");
    try {
      const result = await apiRequest<EvolutionQrCodeResult>("/api/evolution/reset", {
        method: "POST",
        token: sessionToken,
      });
      setApiStatus("online");
      setEvolutionQrCode(result.qrCode);
      setEvolutionActionStatus(
        result.qrCode.image || result.qrCode.code
          ? `Conexao reiniciada e QR Code novo gerado para ${result.instance}.`
          : `Conexao reiniciada, mas a Evolution nao retornou um QR Code reconhecido.`,
      );
    } catch (error) {
      setEvolutionActionStatus(error instanceof Error ? error.message : "Nao foi possivel reiniciar a conexao.");
    } finally {
      setEvolutionBusy("");
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-badge">
            <Bot size={28} />
            <span>Atendedor 2.0</span>
          </div>
          <h1>Seu robo de IA para WhatsApp, CRM e vendas.</h1>
          <p>
            MVP local com usuario inicial, pronto para conectar a Evolution API,
            banco de dados e automacoes 24/7.
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <label>
              E-mail
              <input
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
              />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite a senha inicial"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>
            {loginError && <strong className="error-message">{loginError}</strong>}
            <button type="submit">
              <Lock size={18} />
              Entrar no painel
            </button>
          </form>
        </section>

        <section className="login-preview">
          <div className="glass-panel">
            <div className="ai-orbit">
              <Sparkles />
            </div>
            <h2>IA treinavel por cultura, conhecimento e metodologia.</h2>
            <ul>
              <li>Capta nome e estado e cria lead automaticamente.</li>
              <li>Qualifica de 0% a 100% com missoes configuraveis.</li>
              <li>Executa follow-up e transfere para humano quando necessario.</li>
            </ul>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Bot size={28} />
          </div>
          <div>
            <strong>Atendedor 2.0</strong>
            <span>IA + WhatsApp + CRM</span>
          </div>
        </div>

        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={19} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <span>Instancia WhatsApp</span>
          <strong>Evolution API pronta</strong>
          <small>Webhook, QR Code e filas planejados.</small>
        </div>

        <button className="logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Painel operacional</span>
            <h1>{getPageTitle(activeView)}</h1>
          </div>
          <div className="topbar-actions">
            <WhatsAppStatusBadge status={whatsAppStatus} />
            <span className={`api-badge ${apiStatus}`}>
              {apiStatus === "online" ? "API online" : apiStatus === "offline" ? "Modo local/offline" : "Dados de demo"}
            </span>
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Buscar conversa, lead ou etiqueta" />
            </div>
            <button className="primary-action">
              <Zap size={17} />
              Nova automacao
            </button>
          </div>
        </header>

        {activeView === "dashboard" && <Dashboard metrics={metrics} leads={leads} />}
        {activeView === "whatsapp" && (
          <WhatsAppView
            conversations={conversationList}
            messages={chatMessages}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            markConversationRead={markConversationRead}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            syncWhatsApp={syncWhatsApp}
            sendWhatsAppText={sendWhatsAppText}
            sendWhatsAppMedia={sendWhatsAppMedia}
            replyToMessage={replyToMessage}
            setReplyToMessage={setReplyToMessage}
            isRecordingAudio={isRecordingAudio}
            toggleAudioRecording={toggleAudioRecording}
            whatsAppSyncStatus={whatsAppSyncStatus}
            setWhatsAppSyncStatus={setWhatsAppSyncStatus}
            whatsAppBusy={whatsAppBusy}
            isNewConversationOpen={isNewConversationOpen}
            setIsNewConversationOpen={setIsNewConversationOpen}
            newConversationPhone={newConversationPhone}
            setNewConversationPhone={setNewConversationPhone}
            startNewConversation={startNewConversation}
            archiveConversationLocal={archiveConversationLocal}
            deleteConversationLocal={deleteConversationLocal}
          />
        )}
        {activeView === "leads" && (
          <LeadsView
            leads={leads}
            stages={stages}
            leadMode={leadMode}
            setLeadMode={setLeadMode}
            newLead={newLead}
            setNewLead={setNewLead}
            addLead={addLead}
            moveLead={moveLead}
          />
        )}
        {activeView === "automation" && <AutomationView tags={tags} />}
        {activeView === "settings" && (
          <SettingsView
            stages={stages}
            tags={tags}
            newStage={newStage}
            setNewStage={setNewStage}
            addStage={addStage}
            newTag={newTag}
            setNewTag={setNewTag}
            addTag={addTag}
            agentSettings={agentSettings}
            setAgentSettings={setAgentSettings}
            saveAgentSettings={saveAgentSettings}
            evolutionSettings={evolutionSettings}
            setEvolutionSettings={setEvolutionSettings}
            saveEvolutionSettings={saveEvolutionSettings}
            settingsStatus={settingsStatus}
            evolutionActionStatus={evolutionActionStatus}
            evolutionQrCode={evolutionQrCode}
            evolutionBusy={evolutionBusy}
            testEvolutionConnection={testEvolutionConnection}
            generateEvolutionQrCode={generateEvolutionQrCode}
            resetEvolutionConnection={resetEvolutionConnection}
          />
        )}
      </main>
    </div>
  );
}


function getWhatsAppStatusLabel(status: WhatsAppStatus) {
  const normalizedState = String(status.state || "unknown").toLowerCase();

  if (status.connected || ["open", "connected", "online"].includes(normalizedState)) {
    return { label: "WhatsApp conectado", className: "online" };
  }

  if (["connecting", "created", "qr", "pairing"].includes(normalizedState)) {
    return { label: "WhatsApp conectando", className: "pending" };
  }

  if (["not_configured", "not_created"].includes(normalizedState)) {
    return { label: "WhatsApp nao configurado", className: "offline" };
  }

  if (normalizedState === "unreachable") {
    return { label: "WhatsApp sem resposta", className: "offline" };
  }

  if (normalizedState === "checking") {
    return { label: "Verificando WhatsApp", className: "pending" };
  }

  return { label: `WhatsApp: ${status.state || "desconhecido"}`, className: "offline" };
}

function WhatsAppStatusBadge({ status }: { status: WhatsAppStatus }) {
  const statusInfo = getWhatsAppStatusLabel(status);

  return (
    <div className={`whatsapp-status ${statusInfo.className}`} title={`Instancia: ${status.instance || "atendedor-20"}`}>
      <span />
      <strong>{statusInfo.label}</strong>
    </div>
  );
}

function getPageTitle(view: View) {
  const titles: Record<View, string> = {
    dashboard: "Dashboard",
    whatsapp: "Central de WhatsApp",
    leads: "Leads e CRM",
    automation: "Configuracao do agente de IA",
    settings: "Configuracoes da conta",
  };

  return titles[view];
}

function Dashboard({ metrics, leads }: { metrics: ReturnType<typeof useDashboardMetrics>; leads: Lead[] }) {
  const cards = [
    {
      label: "Leads cadastrados",
      value: metrics.total,
      icon: Users,
      detail: `${metrics.hotLeads} leads quentes`,
    },
    {
      label: "Pipeline estimado",
      value: formatCurrency(metrics.pipeline),
      icon: BarChart3,
      detail: "Soma das oportunidades",
    },
    {
      label: "Score medio",
      value: `${metrics.averageScore}%`,
      icon: Activity,
      detail: "Regua frio a quente",
    },
    {
      label: "Atendidos pela IA",
      value: metrics.aiHandled,
      icon: Bot,
      detail: "Conversas em acompanhamento",
    },
  ];

  return (
    <section className="dashboard-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article className="metric-card" key={card.label}>
            <span>
              <Icon size={19} />
              {card.label}
            </span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        );
      })}

      <article className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Qualificacao</span>
            <h2>Mapa de temperatura dos leads</h2>
          </div>
          <ShieldCheck />
        </div>
        <div className="heat-list">
          {leads.map((lead) => (
            <div className="heat-row" key={lead.id}>
              <div>
                <strong>{lead.name}</strong>
                <span>{lead.stage} - {lead.state}</span>
              </div>
              <div className="score-bar">
                <span style={{ width: `${lead.score}%` }} />
              </div>
              <b className={`temperature ${lead.temperature.toLowerCase()}`}>{lead.score}%</b>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Proximas acoes</span>
            <h2>Follow-up inteligente</h2>
          </div>
          <CalendarClock />
        </div>
        <div className="timeline">
          <span>Agora - responder mensagens novas</span>
          <span>25 min - recuperar inativos</span>
          <span>24 h - retomar lead morno</span>
          <span>7 dias - campanha de reengajamento</span>
        </div>
      </article>
    </section>
  );
}

function useDashboardMetrics() {
  return {
    total: 0,
    hotLeads: 0,
    pipeline: 0,
    averageScore: 0,
    aiHandled: 0,
  };
}


function RefreshIcon() {
  return <Clock3 size={16} />;
}

function WhatsAppView({
  conversations,
  messages,
  selectedConversation,
  setSelectedConversation,
  markConversationRead,
  messageDraft,
  setMessageDraft,
  syncWhatsApp,
  sendWhatsAppText,
  sendWhatsAppMedia,
  replyToMessage,
  setReplyToMessage,
  isRecordingAudio,
  toggleAudioRecording,
  whatsAppSyncStatus,
  setWhatsAppSyncStatus,
  whatsAppBusy,
  isNewConversationOpen,
  setIsNewConversationOpen,
  newConversationPhone,
  setNewConversationPhone,
  startNewConversation,
  archiveConversationLocal,
  deleteConversationLocal,
}: {
  conversations: Conversation[];
  messages: Message[];
  selectedConversation: Conversation;
  setSelectedConversation: (conversation: Conversation) => void;
  markConversationRead: (conversation: Conversation) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  syncWhatsApp: () => void;
  sendWhatsAppText: () => void;
  sendWhatsAppMedia: (file: File, mediaType: "audio" | "video" | "image" | "document") => void;
  replyToMessage: Message | null;
  setReplyToMessage: (message: Message | null) => void;
  isRecordingAudio: boolean;
  toggleAudioRecording: () => void;
  whatsAppSyncStatus: string;
  setWhatsAppSyncStatus: (value: string) => void;
  whatsAppBusy: "" | "sync" | "send";
  isNewConversationOpen: boolean;
  setIsNewConversationOpen: (value: boolean) => void;
  newConversationPhone: string;
  setNewConversationPhone: (value: string) => void;
  startNewConversation: (event: FormEvent<HTMLFormElement>) => void;
  archiveConversationLocal: (conversation: Conversation, archive: boolean) => void;
  deleteConversationLocal: (conversation: Conversation) => void;
}) {
  const selectedRemoteJid = selectedConversation.remoteJid ?? selectedConversation.id;
  const selectedAliases = new Set([selectedRemoteJid, selectedConversation.id, ...(selectedConversation.aliases ?? [])]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | number | null>(null);
  const [forwardMessageTarget, setForwardMessageTarget] = useState<Message | null>(null);
  const [conversationFilter, setConversationFilter] = useState<"all" | "unread" | "favorites" | "groups" | "archived">("all");
  const visibleMessages = messages.filter((message) => {
    if (message.remoteJid || message.conversationId) {
      return selectedAliases.has(message.remoteJid ?? message.conversationId ?? "");
    }

    return conversations.length <= 3;
  });

  const filteredConversations = conversations.filter((conversation) => {
    if (conversationFilter === "archived") return Boolean(conversation.archived);
    if (conversation.archived) return false;
    if (conversationFilter === "unread") return conversation.unread > 0;
    if (conversationFilter === "groups") return String(conversation.remoteJid || conversation.id).includes("@g.us");
    if (conversationFilter === "favorites") return false;
    return true;
  });

  function triggerFile(mediaType: "audio" | "video" | "image" | "document") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      mediaType === "audio"
        ? "audio/*"
        : mediaType === "video"
          ? "video/*"
          : mediaType === "image"
            ? "image/*"
            : "*/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) sendWhatsAppMedia(file, mediaType);
    };
    input.click();
  }

  async function copyMessage(message: Message) {
    if (!message.body) return;
    await navigator.clipboard?.writeText(message.body);
    setOpenMessageMenuId(null);
  }

  function forwardMessage(message: Message) {
    setForwardMessageTarget(message);
    setOpenMessageMenuId(null);
  }

  async function forwardToConversation(conversation: Conversation) {
    if (!forwardMessageTarget) return;
    await apiRequest<{ ok: boolean }>("/api/whatsapp/forward", {
      method: "POST",
      token: localStorage.getItem("atendedor-2-token") ?? "",
      body: JSON.stringify({
        messageId: forwardMessageTarget.evolutionMessageId || forwardMessageTarget.id,
        targetRemoteJid: conversation.remoteJid || conversation.id,
      }),
    });
    setForwardMessageTarget(null);
  }

  function replyMessage(message: Message) {
    setReplyToMessage(message);
    setOpenMessageMenuId(null);
  }

  async function downloadMedia(message: Message) {
    try {
      const token = localStorage.getItem("atendedor-2-token") ?? "";
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/media/${encodeURIComponent(String(message.evolutionMessageId || message.id))}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Download retornou ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = decodeURIComponent(match?.[1] || message.fileName || "arquivo");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setWhatsAppSyncStatus(error instanceof Error ? error.message : "Nao foi possivel baixar o arquivo.");
    }
  }

  async function deleteMessage(message: Message) {
    const id = message.evolutionMessageId || message.id;
    await apiRequest<{ ok: boolean }>("/api/whatsapp/delete-message", {
      method: "POST",
      token: localStorage.getItem("atendedor-2-token") ?? "",
      body: JSON.stringify({ messageIds: [id] }),
    });
    setOpenMessageMenuId(null);
  }

  async function deleteCurrentConversation() {
    const conversationToDelete = selectedConversation;
    deleteConversationLocal(conversationToDelete);
    await apiRequest<{ ok: boolean }>("/api/whatsapp/delete-conversation", {
      method: "POST",
      token: localStorage.getItem("atendedor-2-token") ?? "",
      body: JSON.stringify({ remoteJid: conversationToDelete.remoteJid, conversationId: conversationToDelete.id }),
    });
  }

  async function archiveCurrentConversation(archive: boolean) {
    const conversationToArchive = selectedConversation;
    archiveConversationLocal(conversationToArchive, archive);
    await apiRequest<{ ok: boolean }>("/api/whatsapp/archive-conversation", {
      method: "POST",
      token: localStorage.getItem("atendedor-2-token") ?? "",
      body: JSON.stringify({ remoteJid: conversationToArchive.remoteJid, conversationId: conversationToArchive.id, archive }),
    });
  }

  async function reactToMessage(message: Message, emoji: string) {
    await apiRequest<{ ok: boolean }>("/api/whatsapp/reaction", {
      method: "POST",
      token: localStorage.getItem("atendedor-2-token") ?? "",
      body: JSON.stringify({ messageId: message.evolutionMessageId || message.id, emoji }),
    });
    setOpenMessageMenuId(null);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedRemoteJid, visibleMessages.length, visibleMessages[visibleMessages.length - 1]?.id]);


  return (
    <section className="whatsapp-layout">
      <aside className="conversation-list">
        <div className="list-header">
          <h2>Conversas</h2>
          <div className="list-actions">
            <span className="auto-sync-label">Tempo real</span>
            <button className="new-chat-button" onClick={() => setIsNewConversationOpen(true)} title="Nova conversa">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="conversation-filters">
          {[
            ["all", "Tudo"],
            ["unread", "Não lidas"],
            ["favorites", "Favoritas"],
            ["groups", "Grupos"],
            ["archived", "Arquivadas"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={conversationFilter === id ? "active" : ""}
              onClick={() => setConversationFilter(id as typeof conversationFilter)}
            >
              {label}
            </button>
          ))}
        </div>
        {whatsAppSyncStatus && <div className="sync-status">{whatsAppSyncStatus}</div>}
        {isNewConversationOpen && (
          <form className="new-conversation-form" onSubmit={startNewConversation}>
            <input
              value={newConversationPhone}
              onChange={(event) => setNewConversationPhone(event.target.value)}
              placeholder="Telefone com DDD"
              autoFocus
            />
            <button type="submit">Iniciar</button>
          </form>
        )}
        {filteredConversations.map((conversation) => (
          <button
            key={conversation.id}
            className={conversation.id === selectedConversation.id ? "conversation active" : "conversation"}
            onClick={() => {
              markConversationRead(conversation);
            }}
          >
            <div className="avatar">{conversation.profilePicUrl ? <img src={conversation.profilePicUrl} alt={conversation.name} /> : (conversation.name || conversation.phone).charAt(0)}</div>
            <div>
              <strong>{conversation.name || conversation.phone}</strong>
              <span>{conversation.phone} • {conversation.lastMessage}</span>
            </div>
            {conversation.unread > 0 && <b className="unread-dot">{conversation.unread}</b>}
          </button>
        ))}
      </aside>

      <article className="chat-panel">
        <header className="chat-header">
          <div className="avatar large">{selectedConversation.profilePicUrl ? <img src={selectedConversation.profilePicUrl} alt={selectedConversation.name} /> : (selectedConversation.name || selectedConversation.phone).charAt(0)}</div>
          <div>
            <strong>{selectedConversation.name || selectedConversation.phone}</strong>
            <span>
              {selectedConversation.phone} - {selectedConversation.status}
            </span>
          </div>
          <div className="chat-score">{selectedConversation.score}%</div>
          <button className="archive-conversation-button" onClick={() => archiveCurrentConversation(!selectedConversation.archived)} title="Arquivar conversa">
            {selectedConversation.archived ? "Desarquivar" : "Arquivar"}
          </button>
          <button className="delete-conversation-button" onClick={deleteCurrentConversation} title="Excluir conversa">Excluir</button>
        </header>

        <div className="messages">
          {visibleMessages.length ? (
            visibleMessages.map((message) => (
              <div
                className={`message ${message.from}`}
                key={message.id}
              >
                <button
                  className="message-menu-trigger"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMessageMenuId(openMessageMenuId === message.id ? null : message.id);
                  }}
                  aria-label="Opcoes da mensagem"
                >
                  ▾
                </button>
                {openMessageMenuId === message.id && (
                  <div className="message-menu">
                    <button onClick={() => replyMessage(message)}>Responder</button>
                    <button onClick={() => forwardMessage(message)}>Encaminhar</button>
                    <button onClick={() => copyMessage(message)}>Copiar</button>
                    {(message.mediaUrl || message.fileName || message.rawType !== "conversation") && (
                      <button onClick={() => downloadMedia(message)}>Baixar</button>
                    )}
                    <div className="message-menu-reactions">
                      {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                        <button key={emoji} onClick={() => reactToMessage(message, emoji)}>{emoji}</button>
                      ))}
                    </div>
                    <button className="danger" onClick={() => deleteMessage(message)}>Excluir</button>
                  </div>
                )}
                <MessageContent message={message} onDownloadMedia={downloadMedia} />
                <small>{message.time}{message.status === "pending" ? " • enviando" : message.status === "failed" ? " • falhou" : ""}</small>
              </div>
            ))
          ) : (
            <div className="empty-chat">
              <strong>Nenhuma mensagem importada ainda.</strong>
              <span>Clique em sincronizar para buscar o historico disponivel na Evolution API.</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {replyToMessage && (
          <div className="reply-preview">
            <span>Respondendo: {replyToMessage.body}</span>
            <button onClick={() => setReplyToMessage(null)}>x</button>
          </div>
        )}
        <footer className="composer">
          <div className="clip-menu-wrap">
            <button onClick={() => setIsAttachMenuOpen((current) => !current)} title="Anexar">
              <Paperclip size={19} />
            </button>
            {isAttachMenuOpen && (
              <div className="clip-menu">
                <button onClick={() => { triggerFile("image"); setIsAttachMenuOpen(false); }}>Foto</button>
                <button onClick={() => { triggerFile("video"); setIsAttachMenuOpen(false); }}>Video</button>
                <button onClick={() => { triggerFile("document"); setIsAttachMenuOpen(false); }}>Arquivo</button>
              </div>
            )}
          </div>
          <input
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendWhatsAppText();
              }
            }}
            placeholder="Digite uma mensagem"
          />
          <button className={isRecordingAudio ? "recording-button" : ""} onClick={toggleAudioRecording} title={isRecordingAudio ? "Parar e enviar audio" : "Gravar audio"}>
            <Mic size={19} />
          </button>
          <button className="send-button" onClick={sendWhatsAppText} disabled={whatsAppBusy === "send"}>
            <Send size={19} />
          </button>
        </footer>
      </article>

      <aside className="lead-inspector">
        <span className="eyebrow">Ficha do lead</span>
        <h2>{selectedConversation.name}</h2>
        <p>{selectedConversation.state} - Canal {selectedConversation.channel}</p>
        <div className="inspector-score">
          <strong>{selectedConversation.score}%</strong>
          <span>Potencial quente</span>
        </div>
        <button className="primary-action full">
          <Headphones size={17} />
          Assumir atendimento
        </button>
        <button className="secondary-action full">
          <UserPlus size={17} />
          Criar tarefa no CRM
        </button>
      </aside>

      {forwardMessageTarget && (
        <div className="forward-modal">
          <div className="forward-dialog">
            <header>
              <strong>Encaminhar mensagem</strong>
              <button onClick={() => setForwardMessageTarget(null)}>x</button>
            </header>
            <div className="forward-list">
              {conversations.map((conversation) => (
                <button key={conversation.id} onClick={() => forwardToConversation(conversation)}>
                  <div className="avatar small">
                    {conversation.profilePicUrl ? <img src={conversation.profilePicUrl} alt={conversation.name} /> : (conversation.name || conversation.phone).charAt(0)}
                  </div>
                  <span>
                    <strong>{conversation.name || conversation.phone}</strong>
                    <small>{conversation.phone}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function MessageContent({ message, onDownloadMedia }: { message: Message; onDownloadMedia: (message: Message) => void }) {
  const isImage = message.mimeType?.startsWith("image/") || message.mediaUrl?.startsWith("data:image");
  const isVideo = message.kind === "video" || message.mimeType?.startsWith("video/");
  const isAudio = message.kind === "audio" || message.mimeType?.startsWith("audio/");
  const canOpenMedia = Boolean(
    message.mediaUrl?.startsWith("data:") || message.mediaUrl?.startsWith("http://") || message.mediaUrl?.startsWith("https://") || message.mediaUrl?.startsWith("blob:"),
  );

  if (message.mediaUrl || message.fileName || message.thumbnail) {
    return (
      <span className="message-content">
        {isImage && canOpenMedia && <img className="message-media" src={message.mediaUrl} alt={message.fileName || "Imagem"} />}
        {isVideo && canOpenMedia && <video className="message-media" src={message.mediaUrl} controls />}
        {isAudio && canOpenMedia && <audio className="message-audio" src={message.mediaUrl} controls />}
        {(!isImage || !canOpenMedia) && (!isVideo || !canOpenMedia) && (!isAudio || !canOpenMedia) && (
          canOpenMedia ? (
            <a className="message-file" href={message.mediaUrl} target="_blank" rel="noreferrer">
              <FileText size={18} />
              {message.fileName || "Abrir arquivo"}
            </a>
          ) : (
            <button className="message-file unavailable" onClick={() => onDownloadMedia(message)}>
              <FileText size={18} />
              {message.fileName || "Baixar arquivo"}
            </button>
          )
        )}
        {message.replyTo && <small className="quoted-message">Resposta a: {message.replyTo.body}</small>}
        {message.body && <span>{message.body}</span>}
        {message.reactions?.length ? <span className="message-reaction">{message.reactions.map((reaction) => reaction.emoji).join(" ")}</span> : null}
        {canOpenMedia && message.kind === "file" && (
          <button className="message-download" onClick={() => onDownloadMedia(message)}>Baixar</button>
        )}
      </span>
    );
  }

  if (message.thumbnail) {
    return (
      <span className="message-content">
        <img className="message-media" src={message.thumbnail} alt={message.fileName || "Miniatura"} />
        <span>{message.body}</span>
      </span>
    );
  }

  return (
    <span className="message-content">
      {message.replyTo && <small className="quoted-message">Resposta a: {message.replyTo.body}</small>}
      <span>{message.body}</span>
      {message.reactions?.length ? <span className="message-reaction">{message.reactions.map((reaction) => reaction.emoji).join(" ")}</span> : null}
    </span>
  );
}

function LeadsView({
  leads,
  stages,
  leadMode,
  setLeadMode,
  newLead,
  setNewLead,
  addLead,
  moveLead,
}: {
  leads: Lead[];
  stages: string[];
  leadMode: "kanban" | "list";
  setLeadMode: (mode: "kanban" | "list") => void;
  newLead: { name: string; state: string; phone: string };
  setNewLead: (value: { name: string; state: string; phone: string }) => void;
  addLead: (event: FormEvent<HTMLFormElement>) => void;
  moveLead: (leadId: number, direction: 1 | -1) => void;
}) {
  return (
    <section className="leads-section">
      <div className="lead-toolbar">
        <form className="inline-form" onSubmit={addLead}>
          <input
            value={newLead.name}
            onChange={(event) => setNewLead({ ...newLead, name: event.target.value })}
            placeholder="Nome do lead"
          />
          <input
            value={newLead.state}
            onChange={(event) => setNewLead({ ...newLead, state: event.target.value })}
            placeholder="Estado"
            maxLength={2}
          />
          <input
            value={newLead.phone}
            onChange={(event) => setNewLead({ ...newLead, phone: event.target.value })}
            placeholder="WhatsApp"
          />
          <button type="submit">
            <Plus size={16} />
            Adicionar
          </button>
        </form>
        <div className="segmented">
          <button className={leadMode === "kanban" ? "active" : ""} onClick={() => setLeadMode("kanban")}>
            <KanbanSquare size={16} />
            Kanban
          </button>
          <button className={leadMode === "list" ? "active" : ""} onClick={() => setLeadMode("list")}>
            <List size={16} />
            Lista
          </button>
        </div>
      </div>

      {leadMode === "kanban" ? (
        <div className="kanban">
          {stages.map((stage) => (
            <div className="kanban-column" key={stage}>
              <div className="column-title">
                <strong>{stage}</strong>
                <span>{leads.filter((lead) => lead.stage === stage).length}</span>
              </div>
              {leads
                .filter((lead) => lead.stage === stage)
                .map((lead) => (
                  <LeadCard key={lead.id} lead={lead} moveLead={moveLead} />
                ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="lead-table">
          <div className="lead-table-row header">
            <span>Lead</span>
            <span>Etapa</span>
            <span>Score</span>
            <span>Valor</span>
            <span>Ultimo contato</span>
          </div>
          {leads.map((lead) => (
            <div className="lead-table-row" key={lead.id}>
              <span>
                <strong>{lead.name}</strong>
                <small>{lead.phone}</small>
              </span>
              <span>{lead.stage}</span>
              <span className={`temperature ${lead.temperature.toLowerCase()}`}>{lead.score}%</span>
              <span>{formatCurrency(lead.value)}</span>
              <span>{lead.lastContact}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LeadCard({ lead, moveLead }: { lead: Lead; moveLead: (leadId: number, direction: 1 | -1) => void }) {
  return (
    <article className="lead-card">
      <div className="lead-card-header">
        <div>
          <strong>{lead.name}</strong>
          <span>{lead.state} - {lead.phone}</span>
        </div>
        <b className={`temperature ${lead.temperature.toLowerCase()}`}>{lead.score}%</b>
      </div>
      <p>{lead.summary}</p>
      <div className="tag-list">
        {lead.tags.map((tag) => (
          <span key={tag}>
            <Tag size={13} />
            {tag}
          </span>
        ))}
      </div>
      <div className="lead-card-footer">
        <small>{lead.owner} - {lead.lastContact}</small>
        <div>
          <button onClick={() => moveLead(lead.id, -1)} aria-label="Voltar etapa">
            <ChevronRight className="flip" size={16} />
          </button>
          <button onClick={() => moveLead(lead.id, 1)} aria-label="Avancar etapa">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function AutomationView({ tags }: { tags: string[] }) {
  return (
    <section className="automation-grid">
      <article className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Personalidade</span>
            <h2>Instrucao principal do agente</h2>
          </div>
          <Bot />
        </div>
        <textarea
          defaultValue={`Voce e o Atendedor 2.0. Responda de forma humana, consultiva e objetiva. Siga a cultura da empresa, consulte a base de conhecimento antes de prometer algo e colete nome, estado, necessidade, orcamento, prazo e objeções. Classifique cada lead de 0% a 100% e encaminhe para humano quando houver alta intencao de compra.`}
        />
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Missoes</span>
            <h2>Objetivos da IA</h2>
          </div>
          <CheckCircle2 />
        </div>
        <div className="check-list">
          {missions.map((mission) => (
            <label key={mission}>
              <input type="checkbox" defaultChecked />
              {mission}
            </label>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Regras</span>
            <h2>Operacao automatizada</h2>
          </div>
          <Clock3 />
        </div>
        <div className="rule-list">
          {automationRules.map((rule) => (
            <div key={rule.title}>
              <strong>{rule.title}</strong>
              <span>{rule.value}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Base de conhecimento</span>
            <h2>Cultura, metodologia e conteudos</h2>
          </div>
          <FileText />
        </div>
        <div className="knowledge-grid">
          <div>
            <strong>Cultura</strong>
            <p>Tom de voz, politicas, promessas permitidas e palavras proibidas.</p>
          </div>
          <div>
            <strong>Metodologia</strong>
            <p>Roteiros de qualificacao, SPIN Selling, BANT e criterios de passagem.</p>
          </div>
          <div>
            <strong>Arquivos</strong>
            <p>PDFs, URLs, videos, audios, precos, catalogos e objeções frequentes.</p>
          </div>
          <div>
            <strong>Etiquetas ativas</strong>
            <p>{tags.join(", ")}</p>
          </div>
        </div>
      </article>
    </section>
  );
}

function SettingsView({
  stages,
  tags,
  newStage,
  setNewStage,
  addStage,
  newTag,
  setNewTag,
  addTag,
  agentSettings,
  setAgentSettings,
  saveAgentSettings,
  evolutionSettings,
  setEvolutionSettings,
  saveEvolutionSettings,
  settingsStatus,
  evolutionActionStatus,
  evolutionQrCode,
  evolutionBusy,
  testEvolutionConnection,
  generateEvolutionQrCode,
  resetEvolutionConnection,
}: {
  stages: string[];
  tags: string[];
  newStage: string;
  setNewStage: (value: string) => void;
  addStage: (event: FormEvent<HTMLFormElement>) => void;
  newTag: string;
  setNewTag: (value: string) => void;
  addTag: (event: FormEvent<HTMLFormElement>) => void;
  agentSettings: AgentSettings;
  setAgentSettings: (settings: AgentSettings) => void;
  saveAgentSettings: (event: FormEvent<HTMLFormElement>) => void;
  evolutionSettings: EvolutionSettings;
  setEvolutionSettings: (settings: EvolutionSettings) => void;
  saveEvolutionSettings: (event: FormEvent<HTMLFormElement>) => void;
  settingsStatus: string;
  evolutionActionStatus: string;
  evolutionQrCode: EvolutionQrCodeResult["qrCode"] | null;
  evolutionBusy: "" | "test" | "qrcode" | "reset";
  testEvolutionConnection: () => void;
  generateEvolutionQrCode: () => void;
  resetEvolutionConnection: () => void;
}) {
  const publicBaseUrl = API_BASE_URL || window.location.origin;
  const apiIntegrationUrl = `${publicBaseUrl}/api/evolution`;
  const followUpText = agentSettings.followUpCadence.join("\n");

  return (
    <section className="settings-grid">
      {settingsStatus && <div className="settings-status">{settingsStatus}</div>}

      <article className="panel">
        <form onSubmit={saveEvolutionSettings}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">WhatsApp</span>
              <h2>Evolution API</h2>
            </div>
            <Phone />
          </div>
          <div className={evolutionSettings.connected ? "connection-status online" : "connection-status pending"}>
            {evolutionSettings.connected ? "Configuracao salva" : "Aguardando dados da conexao"}
          </div>
          <label className="stacked-label">
            URL do servidor Evolution
            <input
              value={evolutionSettings.baseUrl}
              onChange={(event) => setEvolutionSettings({ ...evolutionSettings, baseUrl: event.target.value })}
              placeholder="https://sua-evolution-api.com"
            />
          </label>
          <label className="stacked-label">
            Instancia WhatsApp
            <input readOnly value={`${evolutionSettings.instance || "atendedor-20"} (criada automaticamente pelo Atendedor)`} />
          </label>
          <label className="stacked-label">
            API Key
            <input
              value={evolutionSettings.apiKey}
              onChange={(event) => setEvolutionSettings({ ...evolutionSettings, apiKey: event.target.value })}
              type="password"
              placeholder={
                evolutionSettings.hasApiKey
                  ? `Chave salva (${evolutionSettings.apiKeyPreview ?? "protegida"}) - digite outra para trocar`
                  : "Cole a chave da Evolution API"
              }
            />
          </label>
          <label className="stacked-label">
            Endpoint da API interna
            <input readOnly value={apiIntegrationUrl} />
          </label>
          <p className="settings-help">
            Informe somente URL e API key. O Atendedor cria e gerencia a instancia automaticamente pela API da Evolution.
          </p>
          <button className="primary-action full" type="submit">
            Salvar conexao
          </button>
          <div className="evolution-actions">
            <button
              className="secondary-action full"
              type="button"
              onClick={testEvolutionConnection}
              disabled={evolutionBusy !== ""}
            >
              {evolutionBusy === "test" ? "Testando..." : "Testar conexao"}
            </button>
            <button
              className="secondary-action full"
              type="button"
              onClick={generateEvolutionQrCode}
              disabled={evolutionBusy !== ""}
            >
              {evolutionBusy === "qrcode" ? "Gerando..." : "Gerar QR Code"}
            </button>
            <button
              className="secondary-action full danger-soft"
              type="button"
              onClick={resetEvolutionConnection}
              disabled={evolutionBusy !== ""}
            >
              {evolutionBusy === "reset" ? "Reiniciando..." : "Reiniciar conexao"}
            </button>
          </div>
          {evolutionActionStatus && <div className="settings-status compact">{evolutionActionStatus}</div>}
          {evolutionQrCode && (
            <div className="qr-code-panel">
              {evolutionQrCode.image ? (
                <img src={evolutionQrCode.image} alt="QR Code para conectar WhatsApp" />
              ) : (
                <strong>{evolutionQrCode.code || "QR Code recebido sem imagem."}</strong>
              )}
              <span>Abra o WhatsApp no celular, va em aparelhos conectados e escaneie este codigo. Se o celular disser "tente mais tarde", clique em Reiniciar conexao para gerar um QR totalmente novo.</span>
            </div>
          )}
        </form>
      </article>

      <article className="panel">
        <form onSubmit={saveAgentSettings}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Agente IA</span>
              <h2>Regras operacionais</h2>
            </div>
            <Bot />
          </div>
          <label className="stacked-label">
            Instrucao principal
            <textarea
              value={agentSettings.mainInstruction}
              onChange={(event) => setAgentSettings({ ...agentSettings, mainInstruction: event.target.value })}
            />
          </label>
          <label className="stacked-label">
            Horario de funcionamento
            <input
              value={agentSettings.businessHours}
              onChange={(event) => setAgentSettings({ ...agentSettings, businessHours: event.target.value })}
            />
          </label>
          <div className="settings-two-columns">
            <label className="stacked-label">
              Inatividade (min)
              <input
                value={agentSettings.inactivityMinutes}
                min={1}
                type="number"
                onChange={(event) =>
                  setAgentSettings({ ...agentSettings, inactivityMinutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="stacked-label">
              Passar para humano em (%)
              <input
                value={agentSettings.handoffScore}
                min={0}
                max={100}
                type="number"
                onChange={(event) => setAgentSettings({ ...agentSettings, handoffScore: Number(event.target.value) })}
              />
            </label>
          </div>
          <label className="stacked-label">
            Cadencia de follow-up (uma regra por linha)
            <textarea
              value={followUpText}
              onChange={(event) =>
                setAgentSettings({
                  ...agentSettings,
                  followUpCadence: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <button className="primary-action full" type="submit">
            Salvar agente
          </button>
        </form>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CRM</span>
            <h2>Etapas personalizaveis</h2>
          </div>
          <KanbanSquare />
        </div>
        <form className="inline-form compact" onSubmit={addStage}>
          <input value={newStage} onChange={(event) => setNewStage(event.target.value)} placeholder="Nova etapa" />
          <button type="submit">Adicionar</button>
        </form>
        <div className="pill-list">
          {stages.map((stage) => (
            <span key={stage}>{stage}</span>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Organizacao</span>
            <h2>Etiquetas</h2>
          </div>
          <Tag />
        </div>
        <form className="inline-form compact" onSubmit={addTag}>
          <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Nova etiqueta" />
          <button type="submit">Adicionar</button>
        </form>
        <div className="pill-list">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </article>

      <article className="panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Futuro comercial</span>
            <h2>Pronto para virar produto</h2>
          </div>
          <Sparkles />
        </div>
        <div className="rule-list">
          <div>
            <strong>Agora</strong>
            <span>Voce configura a Evolution API e as regras do agente direto nesta tela.</span>
          </div>
          <div>
            <strong>Quando vender</strong>
            <span>Trocaremos o arquivo local por banco online, criaremos empresas/usuarios e criptografia das chaves.</span>
          </div>
          <div>
            <strong>Hospedagem 24/7</strong>
            <span>Frontend em Vercel/Netlify, API em Render/Fly/Railway ou VPS pequena, banco Supabase/Neon.</span>
          </div>
        </div>
      </article>
    </section>
  );
}

export default App;
