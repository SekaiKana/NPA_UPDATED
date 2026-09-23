import StageMount from './webgl/StageMount';

/**
 * The single background entry point for the site.
 *
 * The static plate is server-rendered and always present, so the page has a
 * finished ground on first paint and on any machine that never runs WebGL.
 * StageMount layers the live canvas over it when the device allows.
 */
export default function Backdrop() {
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <StageMount />
    </>
  );
}
