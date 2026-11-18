// The funnel analytics dashboard, reading /api/dashboard.
import { useEffect, useState } from "react";
import { money, money2, number, percent } from "../lib/format.js";

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const [demo, setDemo] = useState(true);
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    setState((s) => ({ ...s, status: "loading" }));
    fetch(`/api/dashboard?days=${days}&demo=${demo ? 1 : 0}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Couldn't load the numbers.");
        setState({ status: "ok", data: d });
      })
      .catch((e) => setState({ status: "error", text: e.message }));
  }, [days, demo]);

  const d = state.data;
  return (
    <div className="dash">
      <header className="dash__head">
        <div>
          <a className="dash__logo" href="/">Quell</a>
          <h1>Funnel analytics</h1>
        </div>
        <div className="dash__controls">
          {d?.hasDemo && <span className="dash__demo">Includes demo data, simulated traffic</span>}
          <label className="dash__toggle"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demo data</label>
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.days} type="button" className={days === r.days ? "is-on" : ""} aria-pressed={days === r.days} onClick={() => setDays(r.days)}>{r.label}</button>
            ))}
          </div>
        </div>
      </header>

      {state.status === "error" && <p className="dash__msg">{state.text}</p>}
      {!d && state.status === "loading" && <p className="dash__msg">Loading...</p>}

      {d && (
        <div className={state.status === "loading" ? "dash__body is-loading" : "dash__body"}>
          <div className="kpis">
            <Kpi label="Visitors" value={number(d.kpis.visitors)} />
            <Kpi label="Conversion rate" value={percent(d.kpis.conversion)} note={`${number(d.kpis.orders)} orders`} />
            <Kpi label="Average order value" value={money2(d.kpis.aov)} note="vs $79 for one pair" />
            <Kpi label="Revenue" value={money(Math.round(d.kpis.revenue))} note={`${money2(d.kpis.revenuePerVisitor)} per visitor`} />
            <Kpi label="Emails captured" value={number(d.kpis.leads)} note={d.kpis.visitors ? `${percent(d.kpis.leads / d.kpis.visitors)} of visitors` : ""} />
          </div>

          <div className="row">
            <Panel title="Funnel" sub="Visitors reaching each step">
              <Funnel steps={d.funnel} />
            </Panel>
            <Panel title="A/B test: hero headline" sub="Visitors split 50/50, each always sees the same version">
              <AbTest ab={d.ab} />
            </Panel>
          </div>

          <div className="row">
            <Panel title="What builds the average order" sub={`Where the ${money2(d.kpis.aov)} average comes from`}>
              <Aov aov={d.aov} />
            </Panel>
            <Panel title="By traffic source" sub="From the UTM tag on each ad link">
              <table className="table">
                <thead><tr><th>Source</th><th>Visitors</th><th>Conversion</th><th>Revenue</th></tr></thead>
                <tbody>
                  {d.sources.map((s) => (
                    <tr key={s.source}><td>{s.source}{s.campaign && <small> · {s.campaign}</small>}</td><td>{number(s.visitors)}</td><td>{percent(s.conversion)}</td><td>{money(Math.round(s.revenue))}</td></tr>
                  ))}
                  {!d.sources.length && <tr><td colSpan={4}>No visits yet in this range.</td></tr>}
                </tbody>
              </table>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, note }) {
  return <div className="kpi"><p>{label}</p><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function Panel({ title, sub, children }) {
  return <section className="panel"><h2>{title}</h2><p className="panel__sub">{sub}</p>{children}</section>;
}

function Funnel({ steps }) {
  const top = steps[0]?.sessions || 0;
  // The biggest drop between two steps, before payment
  let worst = null;
  for (let i = 1; i < steps.length - 1; i++) {
    const prev = steps[i - 1].sessions;
    const drop = prev ? 1 - steps[i].sessions / prev : 0;
    if (!worst || drop > worst.drop) worst = { i, drop };
  }
  return (
    <ol className="funnel">
      {steps.map((s, i) => {
        const isUpsell = s.event === "upsell_accepted";
        const paid = steps.find((x) => x.event === "purchase")?.sessions || 0;
        const share = top ? s.sessions / top : 0;
        return (
          <li key={s.event}>
            <span className="funnel__label">{s.label}</span>
            <span className="funnel__track"><span style={{ width: `${Math.max(share * 100, s.sessions ? 0.6 : 0)}%` }} /></span>
            <span className="funnel__n"><strong>{number(s.sessions)}</strong> {isUpsell ? `${paid ? percent(s.sessions / paid, 0) : "0%"} of buyers` : percent(share)}</span>
            {worst && worst.i === i && worst.drop > 0 && <span className="funnel__drop">Biggest drop: {percent(worst.drop, 0)} leave at this step</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AbTest({ ab }) {
  const conf = ab.confidence;
  const confText = conf >= 0.99 ? "over 99%" : percent(conf, 0);
  const verdict =
    !ab.leader || ab.variants.some((v) => v.visitors < 100)
      ? "Not enough visitors yet to call a winner."
      : conf >= 0.95
      ? `${ab.leader} converts ${percent(ab.lift, 0)} better, with ${confText} confidence. Make ${ab.leader} the default and test the next idea.`
      : `${ab.leader} is ahead by ${percent(ab.lift, 0)}, but confidence is only ${confText}. Keep the test running.`;
  return (
    <>
      <table className="table">
        <thead><tr><th>Headline</th><th>Visitors</th><th>Orders</th><th>Conversion</th></tr></thead>
        <tbody>
          {ab.variants.map((v) => (
            <tr key={v.variant}>
              <td><b>{v.variant}</b> "{v.headline}"</td>
              <td>{number(v.visitors)}</td>
              <td>{number(v.orders)}</td>
              <td>{percent(v.rate)} {ab.leader === v.variant && conf >= 0.95 && <span className="pill">Leading</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="verdict">{verdict}</p>
    </>
  );
}

function Aov({ aov }) {
  const parts = [
    { k: "base", label: "Base price", value: aov.base, cls: "a1" },
    { k: "bundles", label: `Bundles: ${percent(aov.multiShare, 0)} choose 2 or 3 pairs`, value: aov.bundles, cls: "a2" },
    { k: "protect", label: `Order bump: ${percent(aov.protectShare, 0)} add Protect`, value: aov.protect, cls: "a3" },
    { k: "upsell", label: `Upsell: ${percent(aov.upsellShare, 0)} add the pad`, value: aov.upsell, cls: "a4" },
  ];
  const sum = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <>
      <div className="aov">
        {parts.map((p) => p.value > 0 && <span key={p.k} className={p.cls} style={{ width: `${(p.value / sum) * 100}%` }} title={`${p.label}: ${money2(p.value)}`} />)}
      </div>
      <ul className="legend">
        {parts.map((p) => <li key={p.k}><i className={p.cls} />{p.label}<b>+{money2(p.value)}</b></li>)}
        {aov.discount > 0 && <li><i className="a5" />Email discount<b>-{money2(aov.discount)}</b></li>}
      </ul>
    </>
  );
}
