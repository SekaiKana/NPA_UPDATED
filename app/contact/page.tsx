import styles from "../subpage.module.css";

export default function Contact() {
  return (
    <div className={styles.pageShell}>
      <p className={styles.pageLabel}>Contact</p>
      <h1 className={styles.pageTitle}>Let&apos;s build something.</h1>
      <p className={styles.pageDesc}>
        Tell us about your project and we&apos;ll get back to you within 24
        hours with a game plan.
      </p>

      <form className={styles.contactForm} onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          className={styles.input}
          placeholder="Your name"
          id="contact-name"
        />
        <input
          type="email"
          className={styles.input}
          placeholder="Email address"
          id="contact-email"
        />
        <input
          type="text"
          className={styles.input}
          placeholder="Company"
          id="contact-company"
        />
        <textarea
          className={styles.textarea}
          placeholder="Tell us about your project..."
          id="contact-message"
        />
        <button type="submit" className={styles.submitBtn}>
          Send Message <span className="arrow">→</span>
        </button>
      </form>
    </div>
  );
}
