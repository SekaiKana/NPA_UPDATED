/**
 * The work index.
 *
 * ⚠️  EVERY ENTRY BELOW IS A PLACEHOLDER. ⚠️
 *
 * The previous site shipped three case studies — "FinFlow", "Ops Console" and
 * "MedSync" — carrying specific claims ($2M+ daily transactions, a 6-week MVP,
 * a 60% onboarding reduction, HIPAA compliance). Those were confirmed as
 * filler, so none of them, and none of their numbers, appear here. Inventing
 * replacements would be worse: fabricated client outcomes on a studio site are
 * a liability, not a placeholder.
 *
 * What is here instead is the real *shape* of a case study, described in terms
 * of the work NPA genuinely does, with `placeholder: true` on every entry so
 * the UI can mark them honestly and refuse to link them anywhere.
 *
 * To publish a real one: replace the entry, set `placeholder: false`, and add
 * `cover` (1600x1000 or wider, in /public/work/). The grid handles the rest.
 */

export interface WorkItem {
  slug: string;
  title: string;
  summary: string;
  sector: string;
  year: string;
  scope: string[];
  /** Marks the entry as awaiting real content. Never ship `false` unverified. */
  placeholder: boolean;
  /** Path under /public. Falls back to a generated blueprint plate when absent. */
  cover?: string;
}

export const WORK: WorkItem[] = [
  {
    slug: 'platform-build',
    title: 'Multi-tenant platform build',
    summary:
      'A full-stack product built end to end for a team that needed to serve many customers from one system: architecture, data model, application and deployment.',
    sector: 'Placeholder',
    year: 'TBC',
    scope: ['Architecture', 'Full-stack', 'Deployment'],
    placeholder: true,
  },
  {
    slug: 'intelligent-systems',
    title: 'Retrieval system for internal knowledge',
    summary:
      'A retrieval-augmented assistant wired into an existing document estate, so staff could ask questions in natural language instead of searching folders.',
    sector: 'Placeholder',
    year: 'TBC',
    scope: ['RAG', 'Data pipeline', 'Interface'],
    placeholder: true,
  },
  {
    slug: 'operations-tooling',
    title: 'Operations tooling to replace spreadsheets',
    summary:
      'A bespoke internal interface replacing a set of spreadsheets and manual steps, designed around how the team actually works rather than around a generic admin template.',
    sector: 'Placeholder',
    year: 'TBC',
    scope: ['Internal tooling', 'GUI', 'Automation'],
    placeholder: true,
  },
  {
    slug: 'rapid-mvp',
    title: 'Concept to production MVP',
    summary:
      'A new business initiative taken from concept to a deployed, production-ready MVP inside a single sprint cycle.',
    sector: 'Placeholder',
    year: 'TBC',
    scope: ['MVP', 'Product', 'Infrastructure'],
    placeholder: true,
  },
];

/** True while nothing real has been published yet — drives the notice on /work. */
export const ALL_PLACEHOLDER = WORK.every((item) => item.placeholder);
