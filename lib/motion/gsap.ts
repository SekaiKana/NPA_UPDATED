'use client';

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
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
  /* ScrambleText is the instrument-panel readout: the reel's shot names and
     the transition's route labels resolve out of noise the way a display
     settles, rather than fading. */
  /* Flip moves the navigation's contents between its layouts: the layout
     changes at once and Flip animates the difference with transforms. */
  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, Flip);

  // The site's two curves, registered as named eases so timelines read the
  // same way the stylesheet does.
  gsap.registerEase('blueprint', (p) => 1 - Math.pow(1 - p, 4));

  // Damped springs for the navigation's changes of shape, the timeline
  // counterparts of --ease-spring. `spring` crosses its target by about 8%
  // and rings back; `spring-soft` by about 3%, for the menu, where 8% of a
  // card most of a screen tall is a lurch rather than a give.
  gsap.registerEase('spring', dampedSpring(0.62, 10));
  gsap.registerEase('spring-soft', dampedSpring(0.75, 9));
}

/** A unit step response of a damped spring, pinned to land exactly on 1. */
function dampedSpring(zeta: number, omega: number) {
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const at = (t: number) =>
    1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
  const miss = 1 - at(1);
  return (p: number) => (p >= 1 ? 1 : at(p) + miss * p);
}

export { gsap, Flip, ScrollTrigger, SplitText };

/** Matches --ease in globals.css. */
export const EASE = 'power4.out';
/** Matches --ease-io. */
export const EASE_IO = 'power4.inOut';
