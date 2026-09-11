import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Bot, BrainCircuit, CheckCircle2, ChevronDown, Database, FileText, LayoutDashboard, Mic, Package, Play, SendHorizonal, Sparkles, Users, Volume2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useCountUp, useReveal, useSpotlight } from "../../hooks/useInteractive.js";
import ThemeSwitcher from "../ThemeSwitcher.jsx";

const FEATURES = [
  ["01", "Voice-first", "Speak naturally in Hindi, English or text. No complicated forms.", Mic, "Milk ka stock kitna hai?"],
  ["02", "Smart Khata", "Record and retrieve customer transactions instantly.", FileText, "Ramesh ka khata dikhao."],
  ["03", "Customer Intelligence", "Find inactive customers, high-credit customers and buying patterns.", Users, "Pichle 10 din se kaun nahi aaya?"],
  ["04", "Inventory Intelligence", "Track stock and identify products that need attention.", Package, "Kaunse products low stock me hain?"],
  ["05", "Business Insights", "Turn everyday transactions into simple, actionable insights.", BarChart3, "Aaj kitni sale hui?"],
  ["06", "AI Actions", "Your AI doesn't just answer questions. It can perform tasks for you.", Zap, "Rahul ne 500 ka saman udhaar liya."],
];

const STEPS = [
  ["01", "Speak", "Tell GrowMate what you need in your natural language.", Mic],
  ["02", "Understand", "AI understands your intent and identifies the required action.", BrainCircuit],
  ["03", "Retrieve", "It securely accesses the relevant shop data.", Database],
  ["04", "Act", "Get an answer, insight or automated action instantly.", Zap],
];

const DEMOS = [
  {
    prompt: "Ramesh ka khata dikhao.",
    title: "Ramesh's Khata",
    tool: "get_customer_khata",
    reply: "Ramesh currently owes ₹2,450. His last transaction was 4 days ago — a part payment of ₹550 via UPI.",
    stats: [["Outstanding", "₹2,450"], ["Last visit", "4 days ago"], ["This month", "₹6,800"]],
  },
  {
    prompt: "Pichle 10 din se kaunse regular customers nahi aaye?",
    title: "Inactive customers",
    tool: "find_inactive_customers",
    reply: "2 customers pichle 10 din se nahi aaye: Neha Gupta (20 days, baki ₹600) aur Priya Sharma (13 days, baki ₹1,500).",
    stats: [["Neha Gupta", "20 days"], ["Priya Sharma", "13 days"], ["Total baki", "₹2,100"]],
  },
  {
    prompt: "₹1,000 se zyada kis kis ka baki hai?",
    title: "High-credit customers",
    tool: "find_high_credit_customers",
    reply: "3 customers ka ₹1,000 se zyada baki hai: Ramesh ₹2,450, Suresh ₹2,000 aur Priya ₹1,500.",
    stats: [["Ramesh", "₹2,450"], ["Suresh", "₹2,000"], ["Priya", "₹1,500"]],
  },
  {
    prompt: "Milk ka stock kitna hai?",
    title: "Milk stock",
    tool: "get_inventory",
    reply: "Milk: 6 litre available (minimum 12 litre). ⚠️ Low stock — reorder soon.",
    stats: [["In stock", "6 litre"], ["Minimum", "12 litre"], ["Status", "Low"]],
  },
];

export default function Landing({ onStart }) {
  useReveal();
  return (
    <div className="relative">
      <Navbar onStart={onStart} />
      <Hero onStart={onStart} />
      <Marquee />
      <Features onStart={onStart} />
      <UnderTheHood />
      <LiveDemo onStart={onStart} />
      <HowItWorks />
      <CTA onStart={onStart} />
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Navbar({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const fn = () => {
      setScrolled(window.scrollY > 20);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <header className="fixed top-0 inset-x-0 z-50 transition-all" style={{ background: scrolled ? "var(--glass)" : "transparent", backdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent" }}>
      <div className="h-[2px]" style={{ width: `${progress}%`, background: "var(--grad)", transition: "width .1s linear" }} />
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="icon-tile icon-tile-solid" style={{ width: 34, height: 34, borderRadius: 10 }}><Sparkles size={16} /></span>
          <span className="font-bold text-[15px] font-display">GrowMate AI</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--muted)]">
          <a href="#features" className="hover:text-[var(--text)] transition">Features</a>
          <a href="#how" className="hover:text-[var(--text)] transition">How it works</a>
          <a href="#demo" className="hover:text-[var(--text)] transition">Demo</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitcher compact />
          <button className="btn btn-primary btn-sm" onClick={onStart}>Try GrowMate</button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
function Counter({ to, prefix = "", suffix = "", decimals = 0 }) {
  const [v, ref] = useCountUp(to, { duration: 1400 });
  return <span ref={ref} className="tabular">{prefix}{v.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>;
}

function Hero({ onStart }) {
  const [pos, setPos] = useState({ x: 50, y: 40 });
  return (
    <section
      id="top"
      className="relative pt-40 pb-20 px-6 overflow-hidden"
      onMouseMove={(e) => setPos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 })}
    >
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="orb" style={{ width: 420, height: 420, background: "var(--accent)", left: `calc(${pos.x}% - 210px)`, top: `calc(${pos.y}% - 210px)`, transition: "left 1.2s ease, top 1.2s ease", opacity: 0.22 }} />
      <div className="orb" style={{ width: 300, height: 300, background: "var(--accent-2)", right: "8%", top: "10%", animationDelay: "-5s", opacity: 0.18 }} />

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="eyebrow mb-6 fade-up flex items-center justify-center gap-2"><span className="dot-pulse" /> One Copilot</div>
        <h1 className="display text-5xl sm:text-6xl md:text-[84px] fade-up">
          Your entire shop, <span className="gradient-text">intelligent.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto fade-up">Everything you need to make faster, smarter business decisions.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3 fade-up">
          <button className="btn btn-primary" style={{ padding: "13px 24px", fontSize: 15 }} onClick={onStart}>Start with GrowMate <ArrowRight size={16} /></button>
          <a href="#demo" className="btn btn-ghost" style={{ padding: "13px 24px", fontSize: 15 }}><Play size={14} /> Talk to your business</a>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {[
            [<Counter to={3} suffix=" languages" key="a" />, "Hindi · English · English"],
            [<Counter to={7} suffix=" AI tools" key="b" />, "Khata, stock, sales & more"],
            [<Counter to={0.4} suffix="s" decimals={1} key="c" />, "Median demo response"],
            [<Counter to={100} suffix="%" key="d" />, "Grounded in your shop data"],
          ].map(([v, l], i) => (
            <div key={i} className="card-2 p-4 text-left reveal" data-delay={i}>
              <div className="text-xl font-bold font-display">{v}</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Marquee() {
  const items = ["Ramesh ka khata dikhao", "Aaj kitni sale hui?", "Milk ka stock kitna hai?", "₹1000 se zyada kiska baki hai?", "Rahul 2 kg sugar leke gaya", "Naya khata banao", "Pichle 10 din se kaun nahi aaya?", "Suresh ne 1000 diye"];
  const list = [...items, ...items];
  return (
    <div className="py-6 overflow-hidden" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)" }}>
      <div className="marquee">
        {list.map((t, i) => (
          <span key={i} className="badge badge-gray" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500 }}><Mic size={12} className="text-accent" /> {t}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function SectionHead({ eyebrow, title, accent, subtitle, dot = false }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-14 reveal">
      <div className="eyebrow mb-4 flex items-center justify-center gap-2">{dot && <span className="dot-pulse" />}{eyebrow}</div>
      <h2 className="display text-4xl md:text-6xl">
        {title} <span className="gradient-text">{accent}</span>
      </h2>
      {subtitle && <p className="mt-5 text-lg text-[var(--muted)]">{subtitle}</p>}
    </div>
  );
}

function FeatureCard({ n, title, desc, Icon, example, open, onToggle, onStart, delay }) {
  const sp = useSpotlight({ tilt: true, max: 5 });
  return (
    <div
      ref={sp.ref}
      onMouseMove={sp.onMouseMove}
      onMouseLeave={sp.onMouseLeave}
      onClick={onToggle}
      className={`card card-hover ${sp.className} p-7 min-h-[260px] flex flex-col cursor-pointer reveal`}
      data-delay={delay}
    >
      <div className="flex items-start justify-between">
        <span className="icon-tile"><Icon size={20} /></span>
        <span className="text-xs text-[var(--muted-2)]">{n}</span>
      </div>
      <h3 className="text-xl font-bold mt-10">{title}</h3>
      <p className="text-[var(--muted)] mt-2 leading-relaxed text-[15px]">{desc}</p>
      <div className="overflow-hidden transition-all" style={{ maxHeight: open ? 120 : 0, opacity: open ? 1 : 0, marginTop: open ? 14 : 0 }}>
        <div className="card-2 p-3 text-sm flex items-center gap-2" style={{ borderColor: "var(--accent-line)" }}>
          <Mic size={14} className="text-accent shrink-0" />
          <span className="flex-1 truncate">"{example}"</span>
          <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onStart(); }}>Try <ArrowRight size={12} /></button>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between pt-6 text-[var(--muted)]">
        <span className="text-[11px]">{open ? "Hide example" : "Click for example"}</span>
        <ChevronDown size={16} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </div>
    </div>
  );
}

function Features({ onStart }) {
  const [open, setOpen] = useState(null);
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHead eyebrow="One Copilot" title="Your entire shop," accent="intelligent." subtitle="Everything you need to make faster, smarter business decisions." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(([n, title, desc, Icon, example], i) => (
            <FeatureCard key={n} n={n} title={title} desc={desc} Icon={Icon} example={example} open={open === n} onToggle={() => setOpen(open === n ? null : n)} onStart={onStart} delay={i % 3} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function FlowNode({ icon: Icon, title, sub, active = false, small = false }) {
  return (
    <div className={`card-2 text-center transition-all ${active ? "glow flow-active" : ""}`} style={{ padding: small ? "16px 10px" : "18px 22px", borderColor: active ? "var(--accent-line)" : undefined, minWidth: small ? 0 : 200, transform: active ? "scale(1.03)" : "none" }}>
      <Icon size={18} className="mx-auto" style={{ color: active ? "var(--accent-text-strong)" : "var(--accent-text)" }} />
      <div className="font-semibold text-[13px] mt-2">{title}</div>
      <div className="text-[10px] text-[var(--muted-2)] mt-0.5">{sub}</div>
    </div>
  );
}

const FLOW_STAGES = ["shopkeeper", "agent", "tool", "db", "agent", "shopkeeper"];

function UnderTheHood() {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);
  const [toolIdx, setToolIdx] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setStep((s) => {
        const n = (s + 1) % FLOW_STAGES.length;
        if (n === 0) setToolIdx((i) => (i + 1) % 4);
        return n;
      });
    }, 900);
    return () => clearInterval(t);
  }, [running]);
  const stage = FLOW_STAGES[step];
  const tools = [[BookOpen, "Khata"], [Users, "Customers"], [Package, "Inventory"], [BarChart3, "Sales"]];
  const labels = ["Shopkeeper asks", "Agent selects a tool", `Calling ${tools[toolIdx][1]} tool`, "Reading PostgreSQL", "Agent composes reply", "Grounded answer delivered"];

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="reveal">
          <div className="eyebrow mb-5">Under the hood</div>
          <h2 className="display text-4xl md:text-6xl">
            Not just a chatbot.<br /><span className="gradient-text">An AI agent.</span>
          </h2>
          <p className="mt-6 text-lg text-[var(--muted)] leading-relaxed max-w-xl">
            GrowMate connects natural language with real business actions. The AI understands the request, selects the appropriate tool, retrieves shop data and responds with grounded results.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs">
            {["Ask", "Understand", "Decide", "Execute", "Respond"].map((s, i) => {
              const activeIdx = [0, 1, 2, 3, 4][Math.min(step, 4)];
              return (
                <span key={s} className="flex items-center gap-2">
                  <span className="card-2 px-3 py-1.5 transition-all" style={i === activeIdx ? { borderColor: "var(--accent-line)", color: "var(--accent-text)", background: "var(--accent-soft)" } : undefined}>{s}</span>
                  {i < 4 && <ArrowRight size={12} className="text-[var(--muted-2)]" />}
                </span>
              );
            })}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button className="btn btn-ghost btn-sm" onClick={() => setRunning((r) => !r)}>{running ? "Pause animation" : "Play animation"}</button>
            <span className="text-xs text-[var(--muted)]">{labels[step]}</span>
          </div>
        </div>
        <div className="card p-8 md:p-10 reveal" data-delay="1">
          <div className="max-w-md mx-auto">
            <FlowNode icon={Mic} title="Shopkeeper" sub="Voice / Text" active={stage === "shopkeeper"} />
            <div className="flow-line" />
            <FlowNode icon={Bot} title="AI Agent" sub="Intent + tool selection" active={stage === "agent"} />
            <div className="flow-line" />
            <div className="relative">
              <div className="absolute left-[12%] right-[12%] top-0 h-px" style={{ background: "repeating-linear-gradient(to right, var(--border-strong) 0 4px, transparent 4px 8px)" }} />
              <div className="grid grid-cols-4 gap-2 pt-4">
                {tools.map(([I, name], i) => <FlowNode key={name} icon={I} title={name} sub="Tool" small active={stage === "tool" && toolIdx === i} />)}
              </div>
            </div>
            <div className="flow-line" />
            <FlowNode icon={Database} title="PostgreSQL" sub="Shop data (Supabase)" active={stage === "db"} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function LiveDemo({ onStart }) {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | thinking | reply
  const [auto, setAuto] = useState(true);
  const demo = DEMOS[idx];

  useEffect(() => {
    let i = 0;
    setTyped("");
    setPhase("typing");
    const t = setInterval(() => {
      i++;
      setTyped(demo.prompt.slice(0, i));
      if (i >= demo.prompt.length) {
        clearInterval(t);
        setPhase("thinking");
        setTimeout(() => setPhase("reply"), 900);
      }
    }, 40);
    return () => clearInterval(t);
  }, [idx, demo.prompt]);

  useEffect(() => {
    if (!auto) return;
    const loop = setInterval(() => setIdx((n) => (n + 1) % DEMOS.length), 8000);
    return () => clearInterval(loop);
  }, [auto]);

  const pick = (i) => { setAuto(false); setIdx(i); };

  return (
    <section id="demo" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHead dot eyebrow="Live product demo" title="Talk to your" accent="business." subtitle="Ask questions. Record transactions. Get insights. Click any prompt below to try it." />
        <div className="card overflow-hidden glow reveal" style={{ borderRadius: 24 }}>
          <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]">
            <aside className="hidden md:flex flex-col p-4" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 px-2 mb-6">
                <span className="icon-tile icon-tile-solid" style={{ width: 30, height: 30, borderRadius: 9 }}><Sparkles size={14} /></span>
                <span className="font-bold text-sm font-display">GrowMate AI</span>
              </div>
              {[["Dashboard", LayoutDashboard, true], ["Customers", Users], ["Khata", BookOpen], ["Inventory", Package], ["Sales", BarChart3], ["Analytics", BrainCircuit]].map(([l, I, a]) => (
                <div key={l} className={`nav-item ${a ? "active" : ""}`} style={{ fontSize: 13, padding: "9px 12px" }}><I size={15} /> {l}</div>
              ))}
              <div className="mt-auto card-2 p-3 flex items-center gap-2">
                <span className="icon-tile" style={{ width: 30, height: 30 }}><Bot size={13} /></span>
                <div className="flex-1"><div className="text-xs font-semibold">AI Copilot</div><div className="text-[10px] text-[var(--muted)]">Always ready</div></div>
                <span className="dot-pulse" />
              </div>
            </aside>
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow mb-1">GrowMate AI</div>
                  <div className="text-xl font-bold">Good morning, Rajesh 👋</div>
                </div>
                <div className="w-9 h-9 rounded-full grid place-items-center font-bold text-sm text-white" style={{ background: "var(--grad)" }}>R</div>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                {[["Today's Sales", 1420, "3 transactions", "var(--green)", "₹"], ["Outstanding", 7750, "6 customers", "var(--amber)", "₹"], ["Low Stock", 4, "Needs attention", "var(--red)", "", " products"], ["Customers", 6, "Active khata", "var(--accent-text)", ""]].map(([l, v, h, c, pre, suf]) => (
                  <div key={l} className="card-2 p-4">
                    <div className="text-[11px] text-[var(--muted)]">{l}</div>
                    <div className="text-xl font-bold mt-1 font-display"><Counter to={v} prefix={pre} suffix={suf || ""} /></div>
                    <div className="text-[10px] mt-1" style={{ color: c }}>{h}</div>
                  </div>
                ))}
              </div>
              <div className="card-2 glow mt-5 p-2.5 pl-3 flex items-center gap-3">
                <span className="icon-tile icon-tile-solid" style={{ width: 42, height: 42 }}><Mic size={17} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--muted)]">Ask your Copilot</div>
                  <div className="text-[15px] font-medium truncate">{typed}<span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse" style={{ background: "var(--accent)" }} /></div>
                </div>
                <span className="btn btn-ghost" style={{ padding: 10 }}><SendHorizonal size={16} /></span>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-2"><span className="dot-pulse" /> Voice: Hindi/English ready</span>
                <span className="badge badge-gray"><Volume2 size={11} /> Auto voice ON</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {DEMOS.map((d, i) => (
                  <button key={d.prompt} onClick={() => pick(i)} className={`btn btn-sm ${i === idx ? "btn-primary" : "btn-ghost"}`} style={{ fontWeight: 500, fontSize: 11, padding: "5px 10px" }}>{d.prompt}</button>
                ))}
              </div>

              <div className="card p-5 mt-5 transition-all" style={{ opacity: phase === "reply" ? 1 : 0.5, transform: phase === "reply" ? "translateY(0)" : "translateY(6px)", minHeight: 190 }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile" style={{ width: 36, height: 36 }}><Bot size={16} /></span>
                    <div><div className="font-semibold text-sm">{phase === "reply" ? demo.title : "GrowMate AI"}</div><div className="text-[10px] text-[var(--muted)]">AI response · just now</div></div>
                  </div>
                  {phase === "reply" && <span className="text-[11px] text-[var(--green)] flex items-center gap-1"><CheckCircle2 size={12} /> From your shop data</span>}
                </div>
                {phase !== "reply" ? (
                  <div className="mt-5 flex items-center gap-3 text-xs text-[var(--muted)]">
                    <div className="typing"><span /><span /><span /></div>
                    {phase === "thinking" ? `Selecting tool → ${demo.tool}() → retrieving shop data…` : "Listening…"}
                  </div>
                ) : (
                  <div className="fade-up">
                    <p className="text-sm mt-4 text-body">{demo.reply}</p>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {demo.stats.map(([l, v]) => (
                        <div key={l} className="card-2 p-3"><div className="text-[10px] text-[var(--muted)] truncate">{l}</div><div className="font-bold mt-0.5">{v}</div></div>
                      ))}
                    </div>
                    <div className="mt-3"><span className="badge badge-gray" style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>⚙ {demo.tool}()</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-8 reveal">
          <button className="btn btn-primary" onClick={onStart}>Open the real dashboard <ArrowRight size={16} /></button>
          <div className="text-xs text-[var(--muted)] mt-3">The real app talks to the Python FastAPI backend — with voice input and live shop data.</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function HowItWorks() {
  const [active, setActive] = useState(0);
  return (
    <section id="how" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <SectionHead eyebrow="How it works" title="From conversation" accent="to action." subtitle="A simple interface backed by an agentic AI architecture." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map(([n, title, desc, Icon], i) => (
            <div key={n} onMouseEnter={() => setActive(i)} className="pt-8 relative cursor-default reveal" data-delay={i} style={{ borderTop: `2px solid ${active === i ? "var(--accent)" : "var(--border)"}`, transition: "border-color .3s" }}>
              <div className="flex items-center justify-between">
                <span className={`icon-tile ${active === i ? "icon-tile-solid" : ""}`}><Icon size={20} /></span>
                {i < 3 && <ArrowRight size={16} className="text-[var(--muted-2)] hidden lg:block" />}
              </div>
              <div className="text-xs text-[var(--muted-2)] mt-12">{n}</div>
              <h3 className="text-xl font-bold mt-1">{title}</h3>
              <p className="text-[var(--muted)] mt-2 text-[15px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm reveal">
          {["Speak", "Understand", "Retrieve", "Act"].map((s, i) => (
            <span key={s} className="flex items-center gap-3">
              <button onClick={() => setActive(i)} className="card-2 px-4 py-2 font-medium transition-all" style={active === i ? { borderColor: "var(--accent-line)", background: "var(--accent-soft)", color: "var(--accent-text)" } : undefined}>{s}</button>
              {i < 3 && <ArrowRight size={14} className="text-accent" />}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function CTA({ onStart }) {
  const sp = useSpotlight();
  return (
    <section className="py-24 px-6">
      <div ref={sp.ref} onMouseMove={sp.onMouseMove} className={`max-w-5xl mx-auto card glow p-12 text-center relative overflow-hidden reveal ${sp.className}`} style={{ borderRadius: 28 }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 50% 120%, rgba(var(--accent-rgb),0.25), transparent 70%)" }} />
        <div className="relative">
          <h2 className="display text-4xl md:text-5xl">Run your shop with <span className="gradient-text">one copilot.</span></h2>
          <p className="mt-4 text-[var(--muted)] text-lg">Khata, customers, inventory, sales and insights — in Hindi, English or English.</p>
          <button className="btn btn-primary mt-8" style={{ padding: "13px 26px", fontSize: 15 }} onClick={onStart}>Try GrowMate <ArrowUpRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-10" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-[var(--muted)]">
        <div className="flex items-center gap-2"><Sparkles size={14} className="text-accent" /> GrowMate AI — AI Shopkeeper Copilot for small Indian businesses.</div>
        <div className="flex items-center gap-4">
          <span className="text-xs">React · Vite · FastAPI · OpenAI · Supabase</span>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
