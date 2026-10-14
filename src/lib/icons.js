const s = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

export const icons = {
  arrowL: s('<path d="M15 5l-7 7 7 7"/>'),
  arrowR: s('<path d="M9 5l7 7-7 7"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  bag: s('<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  lock: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  pin: s('<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  glass: s('<path d="M7 3h10l-1.5 9a3.5 3.5 0 0 1-7 0z"/><path d="M12 15.5V21M8.5 21h7"/>'),
  people: s('<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.6"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  minus: s('<path d="M5 12h14"/>'),
  store: s('<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>'),
  route: s('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>'),
};
