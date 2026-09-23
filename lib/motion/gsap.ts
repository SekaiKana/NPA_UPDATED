'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/**
 * Single registration point for GSAP plugins.
 *
 * Registering twice is harmless but registering in a dozen components makes it
 * impossible to see what the site actually depends on. Everything imports
 * `gsap` and `ScrollTrigger` from here.
 *
 * Licence note: GSAP is not MIT. It ships under Webflow's standard "no charge"
 * licence, which covers commercial sites like this one and includes every
 * plugin. The only prohibited uses are building a competing visual animation
 * builder or reverse-engineering it.
 */
if (typeof window !== 'undefined') {
  /* SplitText used to be a paid Club plugin; since 3.13 every plugin ships
     free in the main package, which is why the display headlines can use real
     line-splitting instead of a hand-rolled approximation. */
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // The site's two curves, registered as named eases so timelines read the
  // same way the stylesheet does.
  gsap.registerEase('blueprint', (p) => 1 - Math.pow(1 - p, 4));
}

export { gsap, ScrollTrigger, SplitText };

/** Matches --ease in globals.css. */
export const EASE = 'power4.out';
/** Matches --ease-io. */
export const EASE_IO = 'power4.inOut';
