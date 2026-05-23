export default function DemoFlowPage() {
  return (
    <main className="demo-shell">
      <div className="demo-orbit demo-orbit-a" />
      <div className="demo-orbit demo-orbit-b" />

      <section className="demo-hero card-shell">
        <div className="card-core demo-hero-grid">
          <div className="demo-copy">
            <p className="eyebrow">Demo flow</p>
            <h1>Complete your Probelayer workspace</h1>
            <p className="lede">
              A deliberately dense billing and governance flow that lets Probelayer surface confusion,
              trust collapse, overload, and defensive abuse risks in one pass.
            </p>
          </div>

          <div className="demo-metrics">
            <div className="metric-chip">SOC 2</div>
            <div className="metric-chip">Encrypted billing</div>
            <div className="metric-chip">Audit trail</div>
            <div className="metric-chip">Policy review</div>
          </div>
        </div>
      </section>

      <section className="demo-bento">
        <article className="card-shell demo-panel">
          <div className="card-core">
            <p className="eyebrow">Plan and billing</p>
            <h2>Choose a team plan</h2>
            <div className="demo-field-grid">
              <label className="field">
                <span>Work email</span>
                <input placeholder="name@company.com" />
              </label>
              <label className="field">
                <span>Company size</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Select a range
                  </option>
                  <option>1-10</option>
                  <option>11-50</option>
                  <option>51-250</option>
                </select>
              </label>
              <label className="field">
                <span>Card number</span>
                <input placeholder="4242 4242 4242 4242" />
              </label>
            </div>

            <div className="stack-actions">
              <button type="button" className="button-primary">
                Start trial
                <span>→</span>
              </button>
              <button type="button" className="button-secondary">
                Continue
              </button>
              <button type="button" className="button-secondary">
                Ask sales
              </button>
            </div>
          </div>
        </article>

        <article className="card-shell demo-panel">
          <div className="card-core">
            <p className="eyebrow">Review before confirming</p>
            <h2>What happens after you submit</h2>
            <dl className="demo-definition">
              <div>
                <dt>Trial length</dt>
                <dd>14 days, then $249/month unless canceled before renewal.</dd>
              </div>
              <div>
                <dt>Seat access</dt>
                <dd>All invited admins can export reports and add new monitored URLs.</dd>
              </div>
              <div>
                <dt>Refund policy</dt>
                <dd>Refunds are reviewed by support and may require audit-log validation.</dd>
              </div>
            </dl>
            <button type="button" className="button-primary button-block">
              Confirm and activate workspace
              <span>→</span>
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

