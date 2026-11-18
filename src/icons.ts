const paths: Record<string, string> = {
  play: '<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  book: '<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Zm0 13c0-1 1-2 2-2h13M8 8h7m-7 3h4"/>',
  settings:
    '<path d="m9.4 3-.6 2.3-2 .9-2.1-.6-2 3.4 1.7 1.7-.1 2.4-1.5 1.5 2 3.4 2.2-.6 2 .9.5 2.1h4.1l.7-2.2 2-.9 2.1.6 2-3.4-1.6-1.5v-2.3l1.6-1.7-2-3.4-2.2.6-2-.9-.6-2.3z"/><circle cx="11.8" cy="11.8" r="3"/>',
  speaker: '<path d="M3 9h4l5-4v14l-5-4H3zM15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  full: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/>',
  shrink: '<path d="M4 9h5V4m11 5h-5V4M9 20v-5H4m11 5v-5h5"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v7H5a2 2 0 0 1-2-2v-3q0-2 1-2Zm16 0h-3v7h2a2 2 0 0 0 2-2v-3q0-2-1-2Z"/>',
  close: '<path d="m6 6 12 12m0-12L6 18"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  bag: '<path d="M5 9h14l1 12H4L5 9Zm3 0V7a4 4 0 0 1 8 0v2m-8 5h8"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="8" cy="10" r="4"/><path d="m12 10 9 0v3h-3v2h-3"/>',
  exit: '<path d="M10 4H5v16h5m4-13 5 5-5 5M8 12h11"/>',
};
export const icon = (name: string) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">' +
  (paths[name] || '') +
  '</svg>';
