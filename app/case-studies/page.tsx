import styles from "../subpage.module.css";

export default function CaseStudies() {
  const studies = [
    {
      title: "FinFlow — B2B Payments Platform",
      desc: "Built a multi-tenant payment orchestration platform processing $2M+ daily transactions. Delivered MVP in 6 weeks.",
    },
    {
      title: "Ops Console — Internal Tooling",
      desc: "Replaced 4 legacy admin tools with a unified operations dashboard. Reduced team onboarding time by 60%.",
    },
    {
      title: "MedSync — Healthcare SaaS",
      desc: "HIPAA-compliant patient management system with real-time scheduling and AI-powered triage recommendations.",
    },
  ];

  return (
    <div className={styles.pageShell}>
      <p className={styles.pageLabel}>Case Studies</p>
      <h1 className={styles.pageTitle}>Proof of impact.</h1>
      <p className={styles.pageDesc}>
        Real projects. Real results. See how we&apos;ve helped companies
        move faster and build better.
      </p>

      <div className={styles.pageCardGrid}>
        {studies.map((s, i) => (
          <div key={i} className={`glass-card ${styles.pageCard}`}>
            <h3 className={styles.pageCardTitle}>{s.title}</h3>
            <p className={styles.pageCardDesc}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
