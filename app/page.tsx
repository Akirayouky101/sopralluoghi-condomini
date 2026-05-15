"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabaseClient";
import type { ComponentItem, SurveyDraft, WorkSection } from "@/lib/types";

const workSections: WorkSection[] = [
  {
    title: "Impianto elettrico parti comuni",
    checks: ["Verifica quadro", "Linee da sostituire", "Prese e punti luce", "Protezione differenziale"],
  },
  {
    title: "Messa a terra",
    checks: ["Misure dispersore", "Nodo equipotenziale", "Collettori", "Verbale verifica"],
  },
  {
    title: "Illuminazione scale",
    checks: ["Plafoniere", "Sensori presenza", "Emergenza", "Temporizzatori"],
  },
  {
    title: "Autorimessa e corselli",
    checks: ["Illuminazione box", "Quadri locali", "Linee antincendio", "Pulsanti emergenza"],
  },
  {
    title: "Cancelli e automazioni",
    checks: ["Centralina", "Fotocellule", "Lampeggiante", "Costa sensibile"],
  },
];

const defaultComponents: ComponentItem[] = [
  { name: "Plafoniera LED 18W IP65", category: "Illuminazione", unit: "pz" },
  { name: "Lampada emergenza LED", category: "Illuminazione", unit: "pz" },
  { name: "Sensore presenza da soffitto", category: "Illuminazione", unit: "pz" },
  { name: "Cavo FG16 3G2,5", category: "Impianto elettrico", unit: "m" },
  { name: "Cavo FG16 5G6", category: "Impianto elettrico", unit: "m" },
  { name: "Interruttore magnetotermico differenziale", category: "Impianto elettrico", unit: "pz" },
  { name: "Quadro elettrico IP65", category: "Impianto elettrico", unit: "pz" },
  { name: "Dispersore a picchetto zincato", category: "Messa a terra", unit: "pz" },
  { name: "Corda rame nudo 35 mmq", category: "Messa a terra", unit: "m" },
  { name: "Collettore equipotenziale", category: "Messa a terra", unit: "pz" },
];

const emptyDraft: SurveyDraft = {
  condominiumName: "",
  address: "",
  contact: "",
  surveyDate: "",
  selectedWorks: [],
  materials: "",
  notes: "",
};

type ViewName = "dashboard" | "new" | "library" | "components" | "settings";

export default function Home() {
  const [view, setView] = useState<ViewName>("dashboard");
  const [components, setComponents] = useState<ComponentItem[]>(defaultComponents);
  const [componentSearch, setComponentSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [draft, setDraft] = useState<SurveyDraft>(emptyDraft);
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setUserEmail(currentUser?.email ?? null);
      if (currentUser) {
        await loadComponents(currentUser.id);
      }
    }

    loadSession();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(components.map((item) => item.category))).sort()],
    [components],
  );

  const filteredComponents = useMemo(() => {
    const term = componentSearch.toLowerCase();
    return components.filter((component) => {
      const matchesTerm = [component.name, component.category, component.unit].join(" ").toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || component.category === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [categoryFilter, componentSearch, components]);

  async function loadComponents(ownerId: string) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("component_catalog")
      .select("id,name,category,unit,brand,supplier,notes")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Errore caricamento componenti: ${error.message}`);
      return;
    }

    if (data.length > 0) {
      setComponents(data);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    const currentUserId = data.user.id;
    setUserId(currentUserId);
    setUserEmail(data.user.email ?? null);
    setAuthOpen(false);
    setMessage("Accesso effettuato.");
    await loadComponents(currentUserId);
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const passwordConfirm = String(form.get("passwordConfirm"));

    if (password.length < 8) {
      setMessage("La password deve avere almeno 8 caratteri.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Le password non coincidono.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user && data.session) {
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
      setAuthOpen(false);
      setMessage("Registrazione completata. Sei gia dentro l'app.");
      await loadComponents(data.user.id);
      return;
    }

    setMessage("Registrazione completata. Controlla la tua email per confermare l'account.");
    setAuthMode("login");
  }

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserId(null);
    setUserEmail(null);
    setMessage("Sei uscito dall'app.");
  }

  function toggleWork(value: string) {
    setDraft((current) => {
      const exists = current.selectedWorks.includes(value);
      return {
        ...current,
        selectedWorks: exists
          ? current.selectedWorks.filter((item) => item !== value)
          : [...current.selectedWorks, value],
      };
    });
  }

  function addMaterial(component: ComponentItem, quantity: number) {
    const line = `${quantity} ${component.unit} ${component.name}`;
    setDraft((current) => ({
      ...current,
      materials: current.materials.trim() ? `${current.materials}\n${line}` : line,
    }));
  }

  async function addComponent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const component: ComponentItem = {
      name: String(form.get("name")).trim(),
      category: String(form.get("category")).trim(),
      unit: String(form.get("unit")).trim(),
    };

    if (!component.name || !component.category || !component.unit) return;

    if (supabase && userId) {
      const { data, error } = await supabase
        .from("component_catalog")
        .insert({ ...component, user_id: userId })
        .select("id,name,category,unit,brand,supplier,notes")
        .single();

      if (error) {
        setMessage(`Errore salvataggio componente: ${error.message}`);
        return;
      }

      setComponents((current) => [data, ...current]);
    } else {
      setComponents((current) => [{ ...component, id: crypto.randomUUID() }, ...current]);
    }

    event.currentTarget.reset();
    setMessage("Componente aggiunto.");
  }

  async function saveSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) {
      setMessage("In demo il salvataggio resta locale. Con Supabase configurato salveremo nel database.");
      buildReport();
      return;
    }

    const { data: condominium, error: condominiumError } = await supabase
      .from("condominiums")
      .insert({
        user_id: userId,
        name: draft.condominiumName,
        address: draft.address,
        contact: draft.contact,
      })
      .select("id")
      .single();

    if (condominiumError) {
      setMessage(`Errore condominio: ${condominiumError.message}`);
      return;
    }

    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert({
        user_id: userId,
        condominium_id: condominium.id,
        survey_date: draft.surveyDate || new Date().toISOString().slice(0, 10),
        notes: draft.notes,
      })
      .select("id")
      .single();

    if (surveyError) {
      setMessage(`Errore sopralluogo: ${surveyError.message}`);
      return;
    }

    const selectedBySection = workSections
      .map((section) => ({
        user_id: userId,
        survey_id: survey.id,
        title: section.title,
        selected_checks: draft.selectedWorks
          .filter((work) => work.startsWith(`${section.title}: `))
          .map((work) => work.replace(`${section.title}: `, "")),
      }))
      .filter((section) => section.selected_checks.length > 0);

    if (selectedBySection.length > 0) {
      await supabase.from("survey_sections").insert(selectedBySection);
    }

    const materialRows = draft.materials
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({
        user_id: userId,
        survey_id: survey.id,
        description: line,
      }));

    if (materialRows.length > 0) {
      await supabase.from("survey_materials").insert(materialRows);
    }

    setMessage("Sopralluogo salvato nel database.");
    buildReport();
    setDraft(emptyDraft);
  }

  function buildReport() {
    setReport(
      [
        draft.condominiumName || "Nuovo condominio",
        draft.address || "Indirizzo da compilare",
        draft.contact || "Referente da indicare",
        "",
        "Lavorazioni:",
        draft.selectedWorks.length ? draft.selectedWorks.join("\n") : "Nessuna lavorazione selezionata",
        "",
        "Materiali:",
        draft.materials || "Nessun materiale inserito",
        "",
        "Note:",
        draft.notes || "Nessuna nota inserita",
      ].join("\n"),
    );
  }

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SC</span>
          <div>
            <strong>Sopralluoghi</strong>
            <small>Mini gestionale tecnico</small>
          </div>
        </div>

        <nav aria-label="Sezioni principali">
          {[
            ["dashboard", "Archivio"],
            ["new", "Nuovo sopralluogo"],
            ["library", "Modelli lavorazioni"],
            ["components", "Componenti"],
            ["settings", "Impostazioni"],
          ].map(([key, label]) => (
            <button
              className={`nav-item ${view === key ? "active" : ""}`}
              key={key}
              onClick={() => setView(key as ViewName)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Gestione sopralluoghi condominiali</p>
            <h1>{viewTitles[view]}</h1>
          </div>
          <div className="topbar-actions">
            {userId ? (
              <div className="user-profile">
                <span className="avatar" aria-hidden="true">
                  {(userEmail ?? "U").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>Profilo</strong>
                  <small>{userEmail}</small>
                </div>
                <button className="secondary-action compact-action" onClick={signOut} type="button">
                  Esci
                </button>
              </div>
            ) : (
              <button
                className="secondary-action"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                type="button"
              >
                Accedi
              </button>
            )}
            <button className="primary-action" onClick={() => setView("new")} type="button">
              + Nuovo
            </button>
          </div>
        </header>

        {message ? <p className="notice">{message}</p> : null}

        {view === "dashboard" ? (
          <section className="view active">
            <div className="stats-grid" aria-label="Riepilogo">
              <article className="stat">
                <span>Da completare</span>
                <strong>3</strong>
              </article>
              <article className="stat">
                <span>In attesa preventivo</span>
                <strong>5</strong>
              </article>
              <article className="stat">
                <span>Chiusi questo mese</span>
                <strong>8</strong>
              </article>
            </div>

            <div className="survey-list">
              {demoSurveys.map((survey) => (
                <article className="survey-card" key={survey.name}>
                  <div>
                    <h3>{survey.name}</h3>
                    <p className="survey-meta">{survey.meta}</p>
                    <p className="survey-meta">{survey.summary}</p>
                  </div>
                  <span className="badge">{survey.status}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "new" ? (
          <section className="view active new-view">
            <form className="editor" onSubmit={saveSurvey}>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Dati sopralluogo</h2>
                  <span>1/4</span>
                </div>
                <div className="form-grid">
                  <label>
                    Condominio
                    <input
                      onChange={(event) => setDraft({ ...draft, condominiumName: event.target.value })}
                      placeholder="Condominio Aurora"
                      required
                      value={draft.condominiumName}
                    />
                  </label>
                  <label>
                    Indirizzo
                    <input
                      onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                      placeholder="Via Roma 24, Milano"
                      required
                      value={draft.address}
                    />
                  </label>
                  <label>
                    Referente
                    <input
                      onChange={(event) => setDraft({ ...draft, contact: event.target.value })}
                      placeholder="Amministratore / caposcala"
                      value={draft.contact}
                    />
                  </label>
                  <label>
                    Data
                    <input
                      onChange={(event) => setDraft({ ...draft, surveyDate: event.target.value })}
                      type="date"
                      value={draft.surveyDate}
                    />
                  </label>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Sezioni tecniche</h2>
                  <span>2/4</span>
                </div>
                <div className="work-sections">
                  {workSections.map((section) => (
                    <article className="work-item" key={section.title}>
                      <header>
                        <strong>{section.title}</strong>
                        <span className="badge">Da compilare</span>
                      </header>
                      <div className="check-grid">
                        {section.checks.map((check) => {
                          const value = `${section.title}: ${check}`;
                          return (
                            <label key={value}>
                              <input
                                checked={draft.selectedWorks.includes(value)}
                                onChange={() => toggleWork(value)}
                                type="checkbox"
                              />
                              {check}
                            </label>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Materiali e note</h2>
                  <span>3/4</span>
                </div>
                <div className="material-picker">
                  <div className="picker-toolbar">
                    <input
                      onChange={(event) => setComponentSearch(event.target.value)}
                      placeholder="Cerca componente frequente"
                      type="search"
                      value={componentSearch}
                    />
                    <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category === "all" ? "Tutte le categorie" : category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="component-list">
                    {filteredComponents.map((component) => (
                      <ComponentPickerRow component={component} key={component.id ?? component.name} onAdd={addMaterial} />
                    ))}
                  </div>
                </div>
                <div className="split">
                  <label>
                    Lista materiali
                    <textarea
                      onChange={(event) => setDraft({ ...draft, materials: event.target.value })}
                      placeholder="Es. 12 plafoniere LED, 80 m cavo FG16, 1 quadro IP65"
                      value={draft.materials}
                    />
                  </label>
                  <label>
                    Note generali
                    <textarea
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                      placeholder="Accessi, criticita, urgenze, misure da verificare"
                      value={draft.notes}
                    />
                  </label>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Foto e riepilogo</h2>
                  <span>4/4</span>
                </div>
                <div className="photo-box">
                  <input accept="image/*" multiple type="file" />
                  <p>Il prossimo blocco collega queste foto allo storage Supabase.</p>
                </div>
                <div className="actions">
                  <button className="secondary-action" onClick={buildReport} type="button">
                    Anteprima riepilogo
                  </button>
                  <button className="primary-action" type="submit">
                    Salva sopralluogo
                  </button>
                </div>
              </section>
            </form>

            <aside className="report" aria-live="polite">
              <h2>Riepilogo</h2>
              <pre>{report || "Compila la scheda e genera l'anteprima tecnica."}</pre>
            </aside>
          </section>
        ) : null}

        {view === "library" ? (
          <section className="view active">
            <div className="panel">
              <div className="panel-heading">
                <h2>Modelli lavorazioni</h2>
                <span>Personalizzabili</span>
              </div>
              <div className="template-grid">
                {workSections.map((section) => (
                  <article className="template-card" key={section.title}>
                    <h3>{section.title}</h3>
                    <ul>
                      {section.checks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "components" ? (
          <section className="view active">
            <div className="panel">
              <div className="panel-heading">
                <h2>Database componenti</h2>
                <span>{userId ? "Supabase" : "Demo locale"}</span>
              </div>
              <form className="component-form" onSubmit={addComponent}>
                <label>
                  Nome componente
                  <input name="name" placeholder="Plafoniera LED 18W IP65" required />
                </label>
                <label>
                  Categoria
                  <input name="category" placeholder="Illuminazione" required />
                </label>
                <label>
                  Unita
                  <input name="unit" placeholder="pz, m, cad" required />
                </label>
                <button className="primary-action" type="submit">
                  Aggiungi
                </button>
              </form>
              <div className="component-table">
                {components.map((component) => (
                  <article className="component-row" key={component.id ?? component.name}>
                    <div>
                      <strong>{component.name}</strong>
                      <span>
                        {component.category} · {component.unit}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "settings" ? (
          <section className="view active">
            <div className="panel">
              <div className="panel-heading">
                <h2>Configurazione online</h2>
                <span>Vercel + Supabase</span>
              </div>
              <div className="roadmap">
                <p>1. Crea progetto Supabase e applica lo schema SQL.</p>
                <p>2. Crea utente con email e password in Supabase Auth.</p>
                <p>3. Inserisci URL e anon key in Vercel come variabili ambiente.</p>
                <p>4. Collega il repository a Vercel e pubblica.</p>
              </div>
            </div>
          </section>
        ) : null}

        {authOpen ? (
          <div className="modal-backdrop" role="presentation">
            <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
              <button className="modal-close" onClick={() => setAuthOpen(false)} type="button" aria-label="Chiudi">
                x
              </button>
              <div className="modal-heading">
                <p className="eyebrow">Account personale</p>
                <h2 id="auth-title">{authMode === "login" ? "Accedi all'app" : "Crea il tuo account"}</h2>
                <p>Salva sopralluoghi, componenti e materiali nel tuo archivio online.</p>
              </div>
              <form className="auth-panel" onSubmit={authMode === "login" ? signIn : signUp}>
                <div className="auth-switch" aria-label="Modalita accesso">
                  <button
                    className={authMode === "login" ? "active" : ""}
                    onClick={() => setAuthMode("login")}
                    type="button"
                  >
                    Accedi
                  </button>
                  <button
                    className={authMode === "register" ? "active" : ""}
                    onClick={() => setAuthMode("register")}
                    type="button"
                  >
                    Registrati
                  </button>
                </div>
                {!hasSupabaseConfig ? <p className="notice">Supabase non e configurato.</p> : null}
                <label>
                  Email
                  <input name="email" placeholder="tu@email.it" required type="email" />
                </label>
                <label>
                  Password
                  <input name="password" placeholder="Password" required type="password" />
                </label>
                {authMode === "register" ? (
                  <label>
                    Conferma password
                    <input name="passwordConfirm" placeholder="Ripeti password" required type="password" />
                  </label>
                ) : null}
                <button className="primary-action" type="submit">
                  {authMode === "login" ? "Accedi" : "Crea account"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

function ComponentPickerRow({
  component,
  onAdd,
}: {
  component: ComponentItem;
  onAdd: (component: ComponentItem, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <article className="component-row">
      <div>
        <strong>{component.name}</strong>
        <span>
          {component.category} · {component.unit}
        </span>
      </div>
      <div className="component-actions">
        <input min="1" onChange={(event) => setQuantity(Number(event.target.value))} type="number" value={quantity} />
        <button className="secondary-action" onClick={() => onAdd(component, quantity)} type="button">
          Aggiungi
        </button>
      </div>
    </article>
  );
}

const viewTitles: Record<ViewName, string> = {
  dashboard: "Archivio sopralluoghi",
  new: "Nuovo sopralluogo",
  library: "Modelli lavorazioni",
  components: "Database componenti",
  settings: "Impostazioni",
};

const demoSurveys = [
  {
    name: "Condominio Verdi",
    meta: "Via Verdi 18, Torino · Studio Rossi · 14/05/2026",
    summary: "Messa a terra da verificare, illuminazione scale da aggiornare.",
    status: "Da completare",
  },
  {
    name: "Residenza Milano",
    meta: "Corso Italia 7, Milano · Sig.ra Bianchi · 11/05/2026",
    summary: "Quadro parti comuni e sensori presenza in autorimessa.",
    status: "Pronto per preventivo",
  },
  {
    name: "Condominio Giardino",
    meta: "Via Manzoni 42, Monza · Amministrazione Nord · 09/05/2026",
    summary: "Sopralluogo iniziato, mancano foto locale tecnico.",
    status: "Bozza",
  },
];
