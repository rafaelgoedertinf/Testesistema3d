import { FormEvent, useEffect, useMemo, useState } from "react";
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
  id: number;
  name: string;
  phone: string;
  state: string;
  status: string;
  lastMessage: string;
  unread: number;
  score: number;
  channel: "WhatsApp";
};

type Message = {
  id: number;
  from: "lead" | "agent" | "system";
  body: string;
  time: string;
  kind?: "text" | "audio" | "video" | "file";
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
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(initialAgentSettings);
  const [evolutionSettings, setEvolutionSettings] = useState<EvolutionSettings>(initialEvolutionSettings);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [evolutionActionStatus, setEvolutionActionStatus] = useState("");
  const [evolutionQrCode, setEvolutionQrCode] = useState<EvolutionQrCodeResult["qrCode"] | null>(null);
  const [evolutionBusy, setEvolutionBusy] = useState<"" | "test" | "qrcode">("");

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
            <span className={`api-badge ${apiStatus}`}>
              {apiStatus === "online" ? "API local online" : apiStatus === "offline" ? "Modo local/offline" : "Dados de demo"}
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
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
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
          />
        )}
      </main>
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

function WhatsAppView({
  conversations,
  messages,
  selectedConversation,
  setSelectedConversation,
  messageDraft,
  setMessageDraft,
}: {
  conversations: Conversation[];
  messages: Message[];
  selectedConversation: Conversation;
  setSelectedConversation: (conversation: Conversation) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
}) {
  const actionButtons = [
    { label: "Video", icon: Video },
    { label: "Audio", icon: Mic },
    { label: "Anexo", icon: Paperclip },
    { label: "Encaminhar", icon: Forward },
    { label: "Copiar", icon: ClipboardCopy },
    { label: "Arquivo", icon: FileText },
  ];

  return (
    <section className="whatsapp-layout">
      <aside className="conversation-list">
        <div className="list-header">
          <h2>Conversas</h2>
          <button>
            <Plus size={16} />
          </button>
        </div>
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            className={conversation.id === selectedConversation.id ? "conversation active" : "conversation"}
            onClick={() => setSelectedConversation(conversation)}
          >
            <div className="avatar">{conversation.name.charAt(0)}</div>
            <div>
              <strong>{conversation.name}</strong>
              <span>{conversation.lastMessage}</span>
            </div>
            {conversation.unread > 0 && <b>{conversation.unread}</b>}
          </button>
        ))}
      </aside>

      <article className="chat-panel">
        <header className="chat-header">
          <div className="avatar large">{selectedConversation.name.charAt(0)}</div>
          <div>
            <strong>{selectedConversation.name}</strong>
            <span>
              {selectedConversation.phone} - {selectedConversation.status}
            </span>
          </div>
          <div className="chat-score">{selectedConversation.score}%</div>
        </header>

        <div className="chat-actions">
          {actionButtons.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label}>
                <Icon size={16} />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="messages">
          {messages.map((message) => (
            <div className={`message ${message.from}`} key={message.id}>
              {message.kind === "audio" && <PlayCircle size={18} />}
              <span>{message.body}</span>
              <small>{message.time}</small>
            </div>
          ))}
        </div>

        <footer className="composer">
          <button>
            <Paperclip size={19} />
          </button>
          <input
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            placeholder="Digite uma mensagem ou instrucao para a IA"
          />
          <button>
            <Mic size={19} />
          </button>
          <button className="send-button">
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
    </section>
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
  evolutionBusy: "" | "test" | "qrcode";
  testEvolutionConnection: () => void;
  generateEvolutionQrCode: () => void;
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
          </div>
          {evolutionActionStatus && <div className="settings-status compact">{evolutionActionStatus}</div>}
          {evolutionQrCode && (
            <div className="qr-code-panel">
              {evolutionQrCode.image ? (
                <img src={evolutionQrCode.image} alt="QR Code para conectar WhatsApp" />
              ) : (
                <strong>{evolutionQrCode.code || "QR Code recebido sem imagem."}</strong>
              )}
              <span>Abra o WhatsApp no celular, va em aparelhos conectados e escaneie este codigo.</span>
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
