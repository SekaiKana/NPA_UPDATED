'use client';

/* The frame loop writes to the canvas, the HUD and the captions directly. */

'use no memo';

import { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { useLang } from '@/components/LangContext';
import { useLenis } from '@/components/motion/SmoothScroll';
import SectionHead from '@/components/ui/SectionHead';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { gsap, SplitText } from '@/lib/motion/gsap';
import { ReelEngine } from '@/lib/reel/engine';
import { clamp, easeInOutCubic } from '@/lib/reel/math';
import { activeShot, LAND, RANGES, SHOTS } from '@/lib/reel/shots';
import type { ReelCopy, ReelTheme } from '@/lib/reel/types';
import styles from './Reel.module.css';

/* True only once the client has taken over from the server HTML. The server
   renders the storyboard, which reads without JavaScript; the live reel
   replaces it after hydration, and only where motion is welcome. */
const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

/* Phones, upright or on their side. The six landscape drawings had to be
   squeezed into the top half of an upright screen, and the pinned track is
   five screens of scrolling, so the reel is left out there altogether.
   Mirrored in Reel.module.css, which hides the server HTML before hydration. */
const PHONE = '(max-width: 720px), (pointer: coarse) and (max-height: 500px)';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Caption titles mark their accent phrase with asterisks, as `*this*`. */
function accent(text: string): ReactNode {
  return text.split('*').map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));
}

interface Shot {
  key: string;
  name: string;
  title: string;
  sub: string;
}

/** Colours and faces off the live page, so the canvas matches the CSS exactly. */
function readTheme(root: HTMLElement): ReelTheme {
  const cs = getComputedStyle(root);
  const token = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  const displayProbe = root.querySelector<HTMLElement>('.display') ?? root;
  const labelProbe = root.querySelector<HTMLElement>('[data-label-face]') ?? root;
  return {
    ink: token('--ink', '#121212'),
    ink3: token('--ink-3', '#59594f'),
    accent: token('--accent', '#6b4423'),
    display: getComputedStyle(displayProbe).fontFamily || 'Georgia, serif',
    label: getComputedStyle(labelProbe).fontFamily || 'sans-serif',
  };
}

/**
 * The process, in motion: the homepage's showreel.
 *
 * Six shots drawn live by one population of points. The scroll plays it: it
 * scrubs what happens inside each shot, and crossing into the next plays the
 * cut between them on its own timing (see `CUT_SECONDS`). The section is tall
 * and its stage is sticky, which holds the frame still while the page scrolls
 * through it; that is CSS doing what ScrollTrigger's `pin` would, without
 * reparenting a React-owned node into a pin-spacer.
 *
 * Under reduced motion, and in the server HTML, it is a storyboard instead:
 * the same six shots as stills with their captions, which is both the
 * accessible version and a perfectly good way to read the section.
 *
 * Phones get neither (see `PHONE`).
 */
export default function Reel() {
  const { t, lang } = useLang();
  const reduced = usePrefersReducedMotion();
  const hydrated = useHydrated();
  const phone = useMediaQuery(PHONE);
  const live = hydrated && !reduced;

  const shots: Shot[] = SHOTS.map((s, i) => ({
    key: s.key,
    name: t(`reel.s${i + 1}.name`),
    title: t(`reel.s${i + 1}.title`),
    sub: t(`reel.s${i + 1}.sub`),
  }));

  const copy: ReelCopy = {
    queue: t('reel.c.queue'),
    throughput: t('reel.c.throughput'),
    bottleneck: t('reel.c.bottleneck'),
    layers: [1, 2, 3, 4, 5].map((k) => t(`reel.c.l${k}`)),
    week: t('reel.c.week'),
    weekOf: t('reel.c.weekOf'),
    deploy: t('reel.c.deploy'),
    mvp: t('reel.c.mvp'),
  };

  if (phone) return null;

  return (
    <section className={styles.reel} id="process" data-mode={live ? 'live' : 'still'}>
      <div className="shell">
        <SectionHead
          label={t('reel.label')}
          title={t('reel.title')}
          titleClassName={styles.headTitle}
        />
      </div>

      {live ? (
        <LiveReel
          shots={shots}
          copy={copy}
          lang={lang}
          labels={{ shot: t('reel.hud.shot'), nav: t('reel.nav'), goto: t('reel.goto') }}
        />
      ) : (
        <Storyboard shots={shots} copy={copy} lang={lang} draw={hydrated} />
      )}
    </section>
  );
}

/* ====================================================================== */
/* Live                                                                    */
/* ====================================================================== */

function LiveReel({
  shots,
  copy,
  lang,
  labels,
}: {
  shots: Shot[];
  copy: ReelCopy;
  lang: string;
  labels: { shot: string; nav: string; goto: string };
}) {
  const lenis = useLenis();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const scrubRef = useRef<HTMLOListElement>(null);
  const shotNoRef = useRef<HTMLSpanElement>(null);
  const shotNameRef = useRef<HTMLSpanElement>(null);

  const engineRef = useRef<ReelEngine | null>(null);
  /** Which caption is up. Shared by the frame loop and the caption setup. */
  const shownRef = useRef(0);
  const namesRef = useRef<string[]>([]);
  /** The split captions, rebuilt per language. */
  const capsRef = useRef<{
    items: HTMLElement[];
    parts: Element[][];
    meta: HTMLElement[][];
  } | null>(null);

  /* ---- The engine and the frame loop ---- */
  useIsomorphicLayoutEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const scrub = scrubRef.current;
    if (!track || !stage || !frame || !canvas || !scrub) return;

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const lowPower = coarse || (navigator.hardwareConcurrency ?? 4) <= 4;
    const area = frame.clientWidth * frame.clientHeight;
    const particles = Math.round(
      clamp(area / 800, lowPower ? 420 : 640, lowPower ? 900 : 1700)
    );

    let engine: ReelEngine;
    try {
      engine = new ReelEngine(canvas, { particles, theme: readTheme(frame), copy });
    } catch {
      return;
    }
    engineRef.current = engine;

    const progressOf = () => {
      const rect = track.getBoundingClientRect();
      const dist = track.offsetHeight - stage.offsetHeight;
      return dist > 0 ? clamp(-rect.top / dist) : 0;
    };

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    engine.resize(frame.clientWidth, frame.clientHeight, dpr());
    engine.seek(progressOf());
    shownRef.current = activeShot(engine.playhead);

    const ro = new ResizeObserver(() => {
      engine.resize(frame.clientWidth, frame.clientHeight, dpr());
    });
    ro.observe(frame);

    let alive = true;
    // The mark is rasterised from the display face, so it is redrawn once the face is in.
    document.fonts?.ready.then(() => {
      if (alive) engine.setTheme(readTheme(frame));
    });

    /* ---- Pointer ---- */
    let pointerX = -1e4;
    let pointerY = -1e4;
    let pointerIn = false;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerIn = true;
    };
    const onLeave = () => {
      pointerIn = false;
    };
    if (fine) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }

    /* ---- HUD ---- */
    const segments = Array.from(scrub.children) as HTMLElement[];
    const setHud = (index: number, animate: boolean) => {
      segments.forEach((seg, k) => {
        if (k === index) seg.dataset.active = '';
        else delete seg.dataset.active;
      });
      const no = shotNoRef.current;
      const name = shotNameRef.current;
      const next = namesRef.current[index] ?? '';
      if (!no || !name) return;
      if (!animate) {
        no.textContent = pad2(index + 1);
        name.textContent = next;
        return;
      }
      gsap.to(no, {
        duration: 0.5,
        scrambleText: { text: pad2(index + 1), chars: '0123456789', speed: 0.8 },
        overwrite: true,
      });
      gsap.to(name, {
        duration: 0.7,
        scrambleText: {
          text: next,
          chars: /[A-Za-z]/.test(next) ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : next,
          speed: 0.6,
        },
        overwrite: true,
      });
    };
    setHud(shownRef.current, false);

    /* ---- Captions: the outgoing one clears, then the next rises in ----
       Sequenced, not crossed. The two captions share the lower third, so a
       cross-fade of their words lays one line of type over another for a
       quarter of a second, which reads as a rendering fault. The outgoing
       words leave fast on an accelerating curve; the incoming ones wait for
       the space and arrive on the site's long settle. Scrolling backwards
       reverses both directions, so the reel reads as rewinding. */
    const OUT = 0.34;
    const cut = (from: number, to: number) => {
      const caps = capsRef.current;
      setHud(to, true);
      if (!caps) return;
      const dir = to > from ? 1 : -1;

      gsap.to(caps.parts[from], {
        yPercent: -112 * dir,
        duration: OUT,
        ease: 'power3.in',
        stagger: 0.01,
        overwrite: true,
      });
      gsap.to(caps.meta[from], {
        autoAlpha: 0,
        y: -8 * dir,
        duration: 0.24,
        ease: 'power2.in',
        overwrite: true,
      });
      gsap.to(caps.items[from], { autoAlpha: 0, duration: 0.01, delay: OUT + 0.12, overwrite: true });

      gsap.set(caps.items[to], { autoAlpha: 1, overwrite: true });
      gsap.fromTo(
        caps.parts[to],
        { yPercent: 112 * dir },
        { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.032, delay: OUT + 0.06, overwrite: true }
      );
      gsap.fromTo(
        caps.meta[to],
        { autoAlpha: 0, y: 10 * dir },
        { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: OUT + 0.22, stagger: 0.08, overwrite: true }
      );
    };

    /* ---- The frame ---- */
    const tick = (_time: number, deltaMs: number) => {
      const fr = frame.getBoundingClientRect();
      const inside =
        pointerIn &&
        pointerX >= fr.left &&
        pointerX <= fr.right &&
        pointerY >= fr.top &&
        pointerY <= fr.bottom;
      engine.setPointer(pointerX - fr.left, pointerY - fr.top, inside);
      engine.update(deltaMs / 1000, progressOf());

      const p = engine.playhead;
      scrub.style.setProperty('--p', p.toFixed(4));

      const index = activeShot(p);
      if (index !== shownRef.current) {
        const from = shownRef.current;
        shownRef.current = index;
        cut(from, index);
      }
    };

    /* Puts the captions straight onto a shot, with no cut. */
    const jump = (index: number) => {
      shownRef.current = index;
      setHud(index, false);
      const caps = capsRef.current;
      if (!caps) return;
      gsap.killTweensOf([...caps.items, ...caps.parts.flat(), ...caps.meta.flat()]);
      caps.items.forEach((item, i) => {
        const on = i === index;
        gsap.set(item, { autoAlpha: on ? 1 : 0 });
        gsap.set(caps.parts[i], { yPercent: on ? 0 : 112 });
        gsap.set(caps.meta[i], { autoAlpha: on ? 1 : 0, y: 0 });
      });
    };

    /* Only runs while the section is anywhere near the viewport.

       On the way back in it is re-seated on wherever the scroll now is, out of
       sight. The loop was paused, so the playhead is wherever the visitor left
       it; arriving from below, that is the first shot, and resuming from there
       fast-forwarded through all six cuts in front of them. */
    let running = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          engine.seek(progressOf());
          const index = activeShot(engine.playhead);
          if (index !== shownRef.current) jump(index);
          gsap.ticker.add(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          gsap.ticker.remove(tick);
        }
      },
      { rootMargin: '20% 0px' }
    );
    io.observe(track);

    return () => {
      alive = false;
      io.disconnect();
      if (running) gsap.ticker.remove(tick);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf([shotNoRef.current, shotNameRef.current]);
      engineRef.current = null;
    };
    /* Built once. Language changes reach the engine through `setCopy` below
       rather than tearing down the simulation. */
  }, []);

  /* ---- Per language: the canvas's words, the HUD, and the caption split ---- */
  useIsomorphicLayoutEffect(() => {
    namesRef.current = shots.map((s) => s.name.toUpperCase());
    engineRef.current?.setCopy(copy);
    const name = shotNameRef.current;
    if (name) {
      gsap.killTweensOf(name);
      name.textContent = namesRef.current[shownRef.current] ?? '';
    }
    if (shotNoRef.current) shotNoRef.current.textContent = pad2(shownRef.current + 1);

    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-caption]'));
    /* Latin text rises word by word. Japanese rises line by line: it has no
       spaces, and splitting it into one box per character hands every
       character boundary to the browser as a place to wrap, which throws away
       the line-breaking rules Japanese depends on. A title came out with a
       word broken across two lines and a comma starting the third. Split by
       line, the browser sets the text properly first and the split follows
       its breaks, re-measured whenever the frame changes size. */
    const cjk = lang === 'JP';

    const ctx = gsap.context(() => {
      const parts: Element[][] = items.map(() => []);
      const meta: HTMLElement[][] = [];
      items.forEach((item, i) => {
        const title = item.querySelector('h3');
        const on = i === shownRef.current;
        if (title) {
          const split = cjk
            ? new SplitText(title, {
                type: 'lines',
                mask: 'lines',
                linesClass: 'reel-l',
                autoSplit: true,
                onSplit: (self) => {
                  parts[i] = self.lines;
                  /* A re-split rebuilds the lines at rest, which is only
                     right for the caption on screen. */
                  if (i !== shownRef.current) gsap.set(self.lines, { yPercent: 112 });
                },
              })
            : new SplitText(title, { type: 'words', mask: 'words', wordsClass: 'reel-w' });
          if (!cjk) parts[i] = split.words;
        }
        const m = Array.from(item.querySelectorAll<HTMLElement>('[data-meta]'));
        meta.push(m);

        gsap.set(item, { autoAlpha: on ? 1 : 0 });
        gsap.set(parts[i], { yPercent: on ? 0 : 112 });
        gsap.set(m, { autoAlpha: on ? 1 : 0, y: 0 });
      });
      capsRef.current = { items, parts, meta };
    }, list);

    return () => {
      /* The cut tweens are started from the frame loop, outside this context,
         so reverting it does not stop them. */
      const caps = capsRef.current;
      if (caps) gsap.killTweensOf([...caps.items, ...caps.parts.flat(), ...caps.meta.flat()]);
      capsRef.current = null;
      ctx.revert();
    };
    // `shots` and `copy` are derived from `lang`, which is the real dependency.
  }, [lang]);

  /** Scrolls to just inside the start of a shot; the cut to it then plays on its own. */
  const go = (index: number) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const dist = track.offsetHeight - stage.offsetHeight;
    const p = index === 0 ? 0 : RANGES[index].start + LAND;
    const top = track.getBoundingClientRect().top + window.scrollY + p * dist;
    const instance = lenis.current;
    if (instance) instance.scrollTo(top, { duration: 1.5, easing: easeInOutCubic });
    else window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div
      ref={trackRef}
      className={styles.track}
      style={{ '--shots': SHOTS.length } as CSSProperties}
    >
      {/* The reel's words, all six shots, for assistive technology. The
          captions on screen are one at a time and mid-animation more often
          than not, so they are hidden from it rather than read out in
          fragments; this is the same text as a plain list. */}
      <ol className="sr-only">
        {shots.map((shot, i) => (
          <li key={shot.key}>
            <h3>
              {pad2(i + 1)} {shot.name}: {accent(shot.title)}
            </h3>
            <p>{shot.sub}</p>
          </li>
        ))}
      </ol>

      <div ref={stageRef} className={styles.stage}>
        <div ref={frameRef} className={styles.frame}>
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

          <div className={styles.hud} data-label-face="" aria-hidden="true">
            <div className={styles.hudGroup}>
              <span>{labels.shot}</span>
              <span ref={shotNoRef} className={styles.hudValue} />
              <span>/ {pad2(SHOTS.length)}</span>
              <span ref={shotNameRef} className={styles.hudName} />
            </div>
          </div>

          <ol ref={listRef} className={styles.captions} aria-hidden="true">
            {shots.map((shot, i) => (
              /* Keyed by language as well as shot. SplitText rewrites the
                 title's children, so React's own text node is no longer in the
                 document; a fresh element per language is what lets the new
                 words actually reach the page. */
              <li
                key={`${lang}-${shot.key}`}
                data-caption={i}
                className={`${styles.caption} ${i === SHOTS.length - 1 ? styles.captionEnd : ''}`}
              >
                <span className={styles.capIndex} data-meta="">
                  {pad2(i + 1)} <span className={styles.capName}>{shot.name}</span>
                </span>
                <h3 className={`display ${styles.capTitle}`}>{accent(shot.title)}</h3>
                <p className={styles.capSub} data-meta="">
                  {shot.sub}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <nav className={styles.scrubber} aria-label={labels.nav}>
          <ol ref={scrubRef} className={styles.segments}>
            {shots.map((shot, i) => (
              <li
                key={shot.key}
                style={
                  {
                    '--s': RANGES[i].start,
                    '--e': RANGES[i].end,
                    flexGrow: SHOTS[i].weight,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  className={styles.segment}
                  onClick={() => go(i)}
                  aria-label={`${labels.goto} ${i + 1}: ${shot.name}`}
                >
                  <span className={styles.segLabel}>
                    <span className={styles.segNo}>{pad2(i + 1)}</span>
                    <span className={styles.segName}>{shot.name}</span>
                  </span>
                  <span className={styles.segTrack}>
                    <span className={styles.segFill} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}

/* ====================================================================== */
/* Storyboard                                                              */
/* ====================================================================== */

/** The moment in each shot that best stands for it, as local progress. */
const STILL_AT = [0.3, 0.62, 0.9, 0.96, 0.42, 0.8];

function Storyboard({
  shots,
  copy,
  lang,
  draw,
}: {
  shots: Shot[];
  copy: ReelCopy;
  lang: string;
  draw: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    if (!draw || !list) return;
    const canvases = Array.from(list.querySelectorAll<HTMLCanvasElement>('canvas'));

    const render = () => {
      const theme = readTheme(list);
      canvases.forEach((canvas, i) => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w === 0 || h === 0) return;
        try {
          const engine = new ReelEngine(canvas, {
            particles: clamp((w * h) / 260, 380, 900),
            theme,
            copy,
          });
          engine.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
          engine.still(i, STILL_AT[i]);
        } catch {
          /* No 2D canvas: the captions still carry the section. */
        }
      });
    };

    render();
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) render();
    });
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 160);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
    // `copy` is derived from `lang`.
  }, [draw, lang]);

  return (
    <div className="shell">
      <ol ref={listRef} className={styles.board}>
        {shots.map((shot, i) => (
          <li key={shot.key} className={styles.card}>
            <div className={styles.cardFrame}>
              <canvas className={styles.cardCanvas} aria-hidden="true" />
            </div>
            <span className={styles.capIndex} data-label-face="">
              {pad2(i + 1)} <span className={styles.capName}>{shot.name}</span>
            </span>
            <h3 className={`display d-sm ${styles.cardTitle}`}>{accent(shot.title)}</h3>
            <p className={styles.capSub}>{shot.sub}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
