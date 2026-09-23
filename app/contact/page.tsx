'use client';

import { useState, type FormEvent } from 'react';
import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Magnetic from '@/components/motion/Magnetic';
import shell from '../page-shell.module.css';
import styles from './contact.module.css';

const EMAIL = 'sekai.kanamori@npanalytica.com';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactPage() {
  const { t } = useLang();
  const [status, setStatus] = useState<Status>('idle');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          company: data.get('company'),
          message: data.get('message'),
          website: data.get('website'),
        }),
      });

      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <header className={`shell ${shell.masthead}`}>
        <div className={shell.mastheadInner}>
          <div className={shell.mastLead}>
            <Reveal>
              <span className="label">{t('contact.label')}</span>
            </Reveal>
            <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
              {t('contact.title')}
            </DisplayReveal>
          </div>
          <Reveal delay={0.12} className={shell.lead}>
            <p className="body">{t('contact.desc')}</p>
          </Reveal>
        </div>
      </header>

      <section className={`shell ${shell.sectionTight}`}>
        <div className={styles.grid}>
          <Reveal className={styles.formWrap}>
            <form className={styles.form} onSubmit={onSubmit} noValidate>
              {/* Honeypot. Hidden from sight and from assistive tech, but a
                  bot filling every field will trip it. */}
              <div className={styles.honey} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <div className={styles.field}>
                <label htmlFor="name" className={styles.labelRow}>
                  <span className="label">{t('contact.f.name')}</span>
                  <span className={styles.req}>{t('contact.f.required')}</span>
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  autoComplete="name"
                  className={styles.input}
                  disabled={status === 'sending'}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="email" className={styles.labelRow}>
                  <span className="label">{t('contact.f.email')}</span>
                  <span className={styles.req}>{t('contact.f.required')}</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={styles.input}
                  disabled={status === 'sending'}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="company" className={styles.labelRow}>
                  <span className="label">{t('contact.f.company')}</span>
                </label>
                <input
                  id="company"
                  name="company"
                  autoComplete="organization"
                  className={styles.input}
                  disabled={status === 'sending'}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="message" className={styles.labelRow}>
                  <span className="label">{t('contact.f.message')}</span>
                  <span className={styles.req}>{t('contact.f.required')}</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  className={styles.textarea}
                  disabled={status === 'sending'}
                />
              </div>

              <div className={styles.actions}>
                <Magnetic>
                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={status === 'sending'}
                    data-cursor="expand"
                  >
                    {status === 'sending' ? t('contact.f.sending') : t('contact.f.submit')}
                    <span aria-hidden="true" className={styles.submitArrow}>
                      &#8594;
                    </span>
                  </button>
                </Magnetic>
              </div>

              {/* Announced to screen readers as it changes. */}
              <p
                className={`${styles.status} ${
                  status === 'error' ? styles.statusError : ''
                }`}
                role="status"
                aria-live="polite"
              >
                {status === 'sent' && t('contact.f.sent')}
                {status === 'error' && (
                  <>
                    {t('contact.f.error')}{' '}
                    <a href={`mailto:${EMAIL}`} className="link-u">
                      {EMAIL}
                    </a>
                  </>
                )}
              </p>
            </form>
          </Reveal>

          <Reveal delay={0.12} className={styles.aside}>
            <div className={styles.asideBlock}>
              <span className="label">{t('contact.direct')}</span>
              <a href={`mailto:${EMAIL}`} className={`${styles.bigEmail} link-u`}>
                {EMAIL}
              </a>
            </div>

            <div className={styles.asideBlock}>
              <span className="label">{t('contact.located')}</span>
              <span className="meta">35.6762&#176; N, 139.6503&#176; E</span>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
