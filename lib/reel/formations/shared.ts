/**
 * The order points are dealt to a formation's slots.
 *
 * Every shaped formation sorts its slots by the same key, so point 200 is
 * roughly the 200th from the left in all of them. That is what makes a cut
 * read as the drawing rearranging itself rather than as a cloud of points
 * swapping places: each point moves a short way, mostly within its own
 * column, instead of crossing the frame. On a tall frame the drawing runs top
 * to bottom, so the sort does too.
 */
export const sortKey = (x: number, y: number, portrait: boolean) =>
  portrait ? y + x * 0.04 : x + y * 0.04;
