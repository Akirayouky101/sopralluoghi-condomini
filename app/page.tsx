"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabaseClient";
import type { ComponentItem, SurveyDraft, UserProfile, WorkSection } from "@/lib/types";

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
type DemoSurvey = (typeof demoSurveys)[number];
type WorkDetail = {
  area: string;
  intervention: string;
  status: string;
  notes: string;
  materials: string[];
};

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<DemoSurvey | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [workDetails, setWorkDetails] = useState<Record<string, WorkDetail>>({});
  const [activeWork, setActiveWork] = useState<string | null>(null);
  const [detailComponentSearch, setDetailComponentSearch] = useState("");
  const [materialsOpen, setMaterialsOpen] = useState(false);

  useEffect(() => {
    async function loadSession() {
      if (!supabase) {
        setAuthChecked(true);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUserId(currentUser?.id ?? null);
      setUserEmail(currentUser?.email ?? null);
      if (currentUser) {
        await loadProfile(currentUser.id, currentUser.user_metadata);
        await loadComponents(currentUser.id);
      }
      setAuthChecked(true);
    }

    loadSession();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(components.map((item) => item.category))).sort()],
    [components],
  );

  const filteredComponents = useMemo(() => {
    const term = componentSearch.toLowerCase();
    if (term.trim().length < 2) return [];
    return components.filter((component) => {
      const matchesTerm = [component.name, component.category, component.unit].join(" ").toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || component.category === categoryFilter;
      return matchesTerm && matchesCategory;
    }).slice(0, 5);
  }, [categoryFilter, componentSearch, components]);

  const detailComponents = useMemo(() => {
    const term = detailComponentSearch.toLowerCase();
    if (term.trim().length < 2) return [];
    return components
      .filter((component) => [component.name, component.category, component.unit].join(" ").toLowerCase().includes(term))
      .slice(0, 5);
  }, [components, detailComponentSearch]);

  const allMaterials = useMemo(() => {
    const manualMaterials = draft.materials
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const sectionMaterials = Object.entries(workDetails).flatMap(([work, detail]) =>
      detail.materials.map((material) => `${work}: ${material}`),
    );
    return [...sectionMaterials, ...manualMaterials];
  }, [draft.materials, workDetails]);

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

  async function loadProfile(ownerId: string, metadata?: Record<string, unknown>) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,company,phone")
      .eq("id", ownerId)
      .maybeSingle();

    if (error) {
      setMessage(`Errore caricamento profilo: ${error.message}`);
      return;
    }

    if (data) {
      setProfile(data);
      return;
    }

    const fallbackProfile = {
      id: ownerId,
      full_name: typeof metadata?.full_name === "string" ? metadata.full_name : null,
      company: typeof metadata?.company === "string" ? metadata.company : null,
      phone: typeof metadata?.phone === "string" ? metadata.phone : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert(fallbackProfile)
      .select("id,full_name,company,phone")
      .single();

    if (insertError) {
      setMessage(`Errore creazione profilo: ${insertError.message}`);
      return;
    }

    setProfile(inserted);
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
    await loadProfile(currentUserId, data.user.user_metadata);
    setAuthOpen(false);
    setMessage("");
    await loadComponents(currentUserId);
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName")).trim();
    const company = String(form.get("company")).trim();
    const phone = String(form.get("phone")).trim();
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const passwordConfirm = String(form.get("passwordConfirm"));

    if (!fullName) {
      setMessage("Inserisci nome e cognome.");
      return;
    }

    if (password.length < 8) {
      setMessage("La password deve avere almeno 8 caratteri.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Le password non coincidono.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company,
          phone,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user && data.session) {
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? null);
      await loadProfile(data.user.id, data.user.user_metadata);
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
    setProfile(null);
    setView("dashboard");
    setMessage("Sei uscito dall'app.");
  }

  function emptyWorkDetail(): WorkDetail {
    return {
      area: "",
      intervention: "",
      status: "Da verificare",
      notes: "",
      materials: [],
    };
  }

  function toggleWork(value: string, checked: boolean) {
    setDraft((current) => {
      return {
        ...current,
        selectedWorks: checked
          ? Array.from(new Set([...current.selectedWorks, value]))
          : current.selectedWorks.filter((item) => item !== value),
      };
    });

    if (checked) {
      setWorkDetails((current) => ({
        ...current,
        [value]: current[value] ?? emptyWorkDetail(),
      }));
      setDetailComponentSearch("");
      setActiveWork(value);
    }
  }

  function addMaterial(component: ComponentItem, quantity: number) {
    const line = `${quantity} ${component.unit} ${component.name}`;
    setDraft((current) => ({
      ...current,
      materials: current.materials.trim() ? `${current.materials}\n${line}` : line,
    }));
  }

  function updateActiveWorkDetail(field: "area" | "intervention" | "status" | "notes", value: string) {
    if (!activeWork) return;
    setWorkDetails((current) => ({
      ...current,
      [activeWork]: {
        ...(current[activeWork] ?? emptyWorkDetail()),
        [field]: value,
      },
    }));
  }

  function addMaterialToActiveWork(component: ComponentItem, quantity: number) {
    if (!activeWork) return;
    const line = `${quantity} ${component.unit} ${component.name}`;
    setWorkDetails((current) => {
      const detail = current[activeWork] ?? emptyWorkDetail();
      return {
        ...current,
        [activeWork]: {
          ...detail,
          materials: [...detail.materials, line],
        },
      };
    });
  }

  function removeMaterialFromActiveWork(index: number) {
    if (!activeWork) return;
    setWorkDetails((current) => {
      const detail = current[activeWork] ?? emptyWorkDetail();
      return {
        ...current,
        [activeWork]: {
          ...detail,
          materials: detail.materials.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  }

  function updateAttachments(files: FileList | null) {
    if (!files) return;
    setAttachments((current) => [...current, ...Array.from(files)]);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
    setAttachments([]);
    setWorkDetails({});
  }

  function buildReport() {
    setReport(
      [
        draft.condominiumName || "Nuovo condominio",
        draft.address || "Indirizzo da compilare",
        draft.contact || "Referente da indicare",
        "",
        "Lavorazioni:",
        draft.selectedWorks.length
          ? draft.selectedWorks
              .map((work) => {
                const detail = workDetails[work];
                if (!detail) return work;
                return [
                  work,
                  `Area: ${detail.area || "Non indicata"}`,
                  `Intervento: ${detail.intervention || "Non indicato"}`,
                  `Stato: ${detail.status}`,
                  `Materiali: ${detail.materials.length ? detail.materials.join(", ") : "Nessuno"}`,
                  `Note: ${detail.notes || "Nessuna nota"}`,
                ].join("\n");
              })
              .join("\n\n")
          : "Nessuna lavorazione selezionata",
        "",
        "Materiali:",
        allMaterials.length ? allMaterials.join("\n") : "Nessun materiale inserito",
        "",
        "Foto e documenti:",
        attachments.length ? attachments.map((file) => file.name).join("\n") : "Nessun allegato inserito",
        "",
        "Note:",
        draft.notes || "Nessuna nota inserita",
      ].join("\n"),
    );
  }

  const profileLabel = profile?.full_name || userEmail || "Profilo";
  const profileDetail = profile?.company || userEmail;
  const selectedSurveyModal = selectedSurvey ? (
    <div className="modal-backdrop" role="presentation">
      <div className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="survey-summary-title">
        <button className="modal-close" onClick={() => setSelectedSurvey(null)} type="button" aria-label="Chiudi">
          x
        </button>
        <div className="summary-heading">
          <span className={`badge ${statusClass(selectedSurvey.status)}`}>{selectedSurvey.status}</span>
          <h2 id="survey-summary-title">{selectedSurvey.name}</h2>
          <p>{selectedSurvey.meta}</p>
        </div>
        <div className="summary-grid">
          <section>
            <h3>Riepilogo lavorazione</h3>
            <p>{selectedSurvey.summary}</p>
          </section>
          <section>
            <h3>Sezioni interessate</h3>
            <ul>
              {selectedSurvey.works.map((work) => (
                <li key={work}>{work}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Materiali previsti</h3>
            <ul>
              {selectedSurvey.materials.map((material) => (
                <li key={material}>{material}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Prossima azione</h3>
            <p>{selectedSurvey.nextAction}</p>
          </section>
        </div>
        <div className="actions">
          <button className="secondary-action" onClick={() => setSelectedSurvey(null)} type="button">
            Chiudi
          </button>
          <button
            className="primary-action"
            onClick={() => {
              setSelectedSurvey(null);
              setView("new");
            }}
            type="button"
          >
            Crea sopralluogo simile
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const activeWorkDetail = activeWork ? (workDetails[activeWork] ?? emptyWorkDetail()) : null;
  const workDetailModal = activeWork && activeWorkDetail ? (
    <div className="modal-backdrop" role="presentation">
      <div className="work-detail-modal" role="dialog" aria-modal="true" aria-labelledby="work-detail-title">
        <button className="modal-close" onClick={() => setActiveWork(null)} type="button" aria-label="Chiudi">
          x
        </button>
        <div className="summary-heading">
          <span className="badge status-ready">Lavorazione selezionata</span>
          <h2 id="work-detail-title">{activeWork}</h2>
          <p>Compila i dati tecnici mentre sei sul posto, così il riepilogo finale resta completo.</p>
        </div>
        <div className="work-detail-grid">
          <label>
            Area
            <input
              onChange={(event) => updateActiveWorkDetail("area", event.target.value)}
              placeholder="Es. Cantina, scale, corsello box"
              value={activeWorkDetail.area}
            />
          </label>
          <label>
            Tipo intervento
            <select
              onChange={(event) => updateActiveWorkDetail("intervention", event.target.value)}
              value={activeWorkDetail.intervention}
            >
              <option value="">Seleziona intervento</option>
              <option>Verifica</option>
              <option>Ripristino</option>
              <option>Sostituzione</option>
              <option>Smantellamento</option>
              <option>Rifacimento completo</option>
              <option>Test e certificazione</option>
            </select>
          </label>
          <label>
            Stato
            <select onChange={(event) => updateActiveWorkDetail("status", event.target.value)} value={activeWorkDetail.status}>
              <option>Da verificare</option>
              <option>Da preventivare</option>
              <option>Urgente</option>
              <option>Completabile</option>
              <option>Escluso</option>
            </select>
          </label>
          <label className="work-detail-notes">
            Descrizione tecnica
            <textarea
              onChange={(event) => updateActiveWorkDetail("notes", event.target.value)}
              placeholder="Es. sostituire plafoniere cantina, verificare dorsale luci e sezione cavo, certificare linea..."
              value={activeWorkDetail.notes}
            />
          </label>
        </div>
        <div className="detail-materials">
          <div className="material-picker-heading">
            <div>
              <strong>Materiali per questa lavorazione</strong>
              <span>Cerca nel catalogo e collega i componenti alla sezione selezionata.</span>
            </div>
            <button
              className="secondary-action compact-action"
              onClick={() => {
                setActiveWork(null);
                setView("components");
              }}
              type="button"
            >
              Gestisci componenti
            </button>
          </div>
          <input
            onChange={(event) => setDetailComponentSearch(event.target.value)}
            placeholder="Cerca almeno 2 caratteri, es. cavo o plafoniera"
            type="search"
            value={detailComponentSearch}
          />
          {detailComponentSearch.trim().length >= 2 ? (
            detailComponents.length ? (
              <div className="component-list compact-component-list">
                {detailComponents.map((component) => (
                  <ComponentPickerRow
                    component={component}
                    key={component.id ?? component.name}
                    onAdd={addMaterialToActiveWork}
                  />
                ))}
              </div>
            ) : (
              <p className="material-empty">Nessun componente trovato. Puoi aggiungerlo da Componenti.</p>
            )
          ) : null}
          {activeWorkDetail.materials.length ? (
            <div className="attachment-list">
              {activeWorkDetail.materials.map((material, index) => (
                <article className="attachment-item" key={`${material}-${index}`}>
                  <div>
                    <strong>{material}</strong>
                    <span>{activeWork}</span>
                  </div>
                  <button className="secondary-action compact-action" onClick={() => removeMaterialFromActiveWork(index)} type="button">
                    Rimuovi
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="material-empty">Nessun materiale collegato a questa lavorazione.</p>
          )}
        </div>
        <div className="actions">
          <button className="primary-action" onClick={() => setActiveWork(null)} type="button">
            Salva dettaglio
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const materialsModal = materialsOpen ? (
    <div className="modal-backdrop" role="presentation">
      <div className="summary-modal" role="dialog" aria-modal="true" aria-labelledby="materials-title">
        <button className="modal-close" onClick={() => setMaterialsOpen(false)} type="button" aria-label="Chiudi">
          x
        </button>
        <div className="summary-heading">
          <span className="badge status-ready">{allMaterials.length} materiali</span>
          <h2 id="materials-title">Lista completa materiali</h2>
          <p>Riepilogo dei materiali collegati alle lavorazioni e di quelli inseriti manualmente.</p>
        </div>
        {allMaterials.length ? (
          <div className="materials-list-modal">
            {allMaterials.map((material, index) => (
              <article className="attachment-item" key={`${material}-${index}`}>
                <div>
                  <strong>{material}</strong>
                  <span>Materiale sopralluogo</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="material-empty">Non hai ancora inserito materiali.</p>
        )}
        <div className="actions">
          <button className="primary-action" onClick={() => setMaterialsOpen(false)} type="button">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const authModal = authOpen ? (
    <div className="modal-backdrop" role="presentation">
      <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={() => setAuthOpen(false)} type="button" aria-label="Chiudi">
          x
        </button>
        <div className="modal-visual">
          <span className="modal-badge">Area riservata</span>
          <div className="modal-logo">SC</div>
          <h3>Sopralluoghi Condomini</h3>
          <p>Archivio tecnico, componenti e relazioni sempre disponibili.</p>
          <div className="modal-feature-list">
            <span>Database componenti</span>
            <span>Schede tecniche</span>
            <span>Salvataggio cloud</span>
          </div>
        </div>
        <div className="modal-content">
          <div className="modal-heading">
            <p className="eyebrow">Account personale</p>
            <h2 id="auth-title">{authMode === "login" ? "Bentornato" : "Crea il tuo account"}</h2>
            <p>
              {authMode === "login"
                ? "Accedi per continuare a gestire i tuoi sopralluoghi."
                : "Inserisci i dati base del profilo per completare la registrazione."}
            </p>
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
            {authMode === "register" ? (
              <div className="auth-field-grid">
                <label>
                  Nome e cognome
                  <input name="fullName" placeholder="Mario Rossi" required type="text" />
                </label>
                <label>
                  Azienda
                  <input name="company" placeholder="Rossi Impianti" type="text" />
                </label>
                <label>
                  Telefono
                  <input name="phone" placeholder="+39 333 1234567" type="tel" />
                </label>
              </div>
            ) : null}
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
            <button className="primary-action auth-submit" type="submit">
              {authMode === "login" ? "Accedi" : "Crea account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  ) : null;

  if (!authChecked) {
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
        </aside>
        <main className="locked-main">
          <section className="locked-panel">
            <p className="eyebrow">Accesso riservato</p>
            <h1>Caricamento sessione</h1>
            <p>Controllo l'accesso al tuo archivio tecnico.</p>
          </section>
        </main>
      </>
    );
  }

  if (!userId) {
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
        </aside>
        <main className="locked-main">
          {message ? <p className="notice locked-notice">{message}</p> : null}
          <section className="locked-panel">
            <div className="locked-mark">SC</div>
            <p className="eyebrow">Accesso riservato</p>
            <h1>Sopralluoghi Condomini</h1>
            <p>Accedi o registrati per usare il gestionale, salvare componenti e creare sopralluoghi.</p>
            <div className="locked-highlights" aria-label="Funzioni principali">
              <span>Schede tecniche guidate</span>
              <span>Archivio materiali</span>
              <span>Database online</span>
            </div>
            <div className="locked-actions">
              <button
                className="primary-action"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                type="button"
              >
                Accedi
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  setAuthMode("register");
                  setAuthOpen(true);
                }}
                type="button"
              >
                Registrati
              </button>
            </div>
          </section>
          {authModal}
        </main>
      </>
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
                  <strong>{profileLabel}</strong>
                  <small>{profileDetail}</small>
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
                <button className="survey-card survey-card-button" key={survey.name} onClick={() => setSelectedSurvey(survey)} type="button">
                  <div>
                    <h3>{survey.name}</h3>
                    <p className="survey-meta">{survey.meta}</p>
                    <p className="survey-meta">{survey.summary}</p>
                  </div>
                  <span className={`badge ${statusClass(survey.status)}`}>{survey.status}</span>
                </button>
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
                                onChange={(event) => toggleWork(value, event.target.checked)}
                                type="checkbox"
                              />
                              {check}
                              {workDetails[value]?.materials.length ? (
                                <span className="check-note">{workDetails[value].materials.length} materiali</span>
                              ) : null}
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
                <div className="materials-summary-box">
                  <div>
                    <strong>{allMaterials.length} materiali inseriti</strong>
                    <span>I componenti principali si aggiungono dalle schede delle singole lavorazioni.</span>
                  </div>
                  <div className="materials-summary-actions">
                    <button className="secondary-action compact-action" onClick={() => setView("components")} type="button">
                      Gestisci componenti
                    </button>
                    <button className="primary-action compact-action" onClick={() => setMaterialsOpen(true)} type="button">
                      Lista completa
                    </button>
                  </div>
                </div>
                <div className="split">
                  <label>
                    Materiali extra o manuali
                    <textarea
                      onChange={(event) => setDraft({ ...draft, materials: event.target.value })}
                      placeholder="Es. materiali non ancora presenti nel catalogo o note libere sui materiali"
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
                  <label className="upload-dropzone">
                    <strong>Aggiungi foto o documenti</strong>
                    <span>Puoi selezionare immagini, PDF o documenti dal dispositivo.</span>
                    <input accept="image/*,.pdf,.doc,.docx" multiple onChange={(event) => updateAttachments(event.target.files)} type="file" />
                  </label>
                  {attachments.length ? (
                    <div className="attachment-list">
                      {attachments.map((file, index) => (
                        <article className="attachment-item" key={`${file.name}-${index}`}>
                          <div>
                            <strong>{file.name}</strong>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                          <button className="secondary-action compact-action" onClick={() => removeAttachment(index)} type="button">
                            Rimuovi
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>Nessun allegato selezionato.</p>
                  )}
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
            <div className="settings-grid">
            <div className="panel">
              <div className="panel-heading">
                <h2>Profilo attività</h2>
                <span>Account</span>
              </div>
              <div className="settings-list">
                <p><strong>Nome</strong><span>{profile?.full_name || "Non impostato"}</span></p>
                <p><strong>Azienda</strong><span>{profile?.company || "Non impostata"}</span></p>
                <p><strong>Telefono</strong><span>{profile?.phone || "Non impostato"}</span></p>
                <p><strong>Email</strong><span>{userEmail}</span></p>
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Preferenze sopralluogo</h2>
                <span>Default</span>
              </div>
              <div className="settings-list">
                <label>
                  Stato nuovo sopralluogo
                  <select defaultValue="Bozza">
                    <option>Bozza</option>
                    <option>Da completare</option>
                    <option>Pronto per preventivo</option>
                  </select>
                </label>
                <label>
                  Formato relazione
                  <select defaultValue="Tecnica dettagliata">
                    <option>Tecnica dettagliata</option>
                    <option>Sintetica per preventivo</option>
                  </select>
                </label>
                <label className="setting-check">
                  <input defaultChecked type="checkbox" />
                  Includi lista materiali nel riepilogo
                </label>
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Stato servizi</h2>
                <span>Online</span>
              </div>
              <div className="service-list">
                <p><strong>Supabase</strong><span>Configurato</span></p>
                <p><strong>Autenticazione</strong><span>Attiva</span></p>
                <p><strong>Storage foto</strong><span>Prossimo collegamento cloud</span></p>
              </div>
            </div>
            </div>
          </section>
        ) : null}

        {authModal}
        {selectedSurveyModal}
        {workDetailModal}
        {materialsModal}
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

function statusClass(status: string) {
  if (status === "Da completare") return "status-open";
  if (status === "Pronto per preventivo") return "status-ready";
  if (status === "Bozza") return "status-draft";
  return "";
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

const demoSurveys = [
  {
    name: "Condominio Verdi",
    meta: "Via Verdi 18, Torino · Studio Rossi · 14/05/2026",
    summary: "Messa a terra da verificare, illuminazione scale da aggiornare.",
    status: "Da completare",
    works: ["Messa a terra", "Illuminazione scale", "Quadro parti comuni"],
    materials: ["6 plafoniere LED IP65", "1 collettore equipotenziale", "40 m cavo FG16"],
    nextAction: "Completare rilievo fotografico del locale contatori e confermare misure dispersione.",
  },
  {
    name: "Residenza Milano",
    meta: "Corso Italia 7, Milano · Sig.ra Bianchi · 11/05/2026",
    summary: "Quadro parti comuni e sensori presenza in autorimessa.",
    status: "Pronto per preventivo",
    works: ["Autorimessa e corselli", "Impianto elettrico parti comuni"],
    materials: ["8 sensori presenza", "1 quadro IP65", "2 differenziali"],
    nextAction: "Preparare preventivo con opzione sensori presenza e aggiornamento quadro.",
  },
  {
    name: "Condominio Giardino",
    meta: "Via Manzoni 42, Monza · Amministrazione Nord · 09/05/2026",
    summary: "Sopralluogo iniziato, mancano foto locale tecnico.",
    status: "Bozza",
    works: ["Locale tecnico", "Cancelli e automazioni"],
    materials: ["Materiali da confermare dopo secondo accesso"],
    nextAction: "Richiedere accesso al locale tecnico e completare scheda cancelli.",
  },
];
