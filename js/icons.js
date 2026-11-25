/* Uniform Custom SVG Icons & Ghibli Mascot Library (Zero decorative emoji) */

const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  import: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  piggy: '<path d="M19 10c0-3.3-3.1-6-7-6-3.4 0-6.2 2.1-6.9 4.9L3 10v3l2.2.8C6 16.2 8.7 18 12 18h1v2h2v-2.2c2.4-.9 4-3.1 4-5.8h2v-2h-2Z"/><circle cx="15" cy="9" r="1"/>',
  printer: '<path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 14h12v6H6z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 11v6M14 11v6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-3.1 4.2"/><path d="M6.6 6.6C3.9 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3.1-.4 4.4-1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  transfer: '<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 19h16"/>',
  upload: '<path d="M12 15V3m0 0-4 4m4-4 4 4"/><path d="M4 19h16"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M16 12h5"/>',
  landmark: '<path d="M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 3 3 8h18l-9-5Z"/>',
  smartphone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  utensils: '<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c2 1 3 3 3 6s-1 4-3 4"/>',
  basket: '<path d="M5 10h14l-1.5 9h-11L5 10Z"/><path d="M9 10 12 4l3 6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  book: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3V4Z"/><path d="M7 17h11"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 6.5L7 16l2.5-6.5L16 8Z"/>',
  heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9Z"/>',
  bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l5-8h4l3 8M11 9l-2-3h3"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8M12 8c-2-3-5-3-5-1s3 1 5 1Zm0 0c2-3 5-3 5-1s-3 1-5 1Z"/>',
  sprout: '<path d="M12 21V11"/><path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7Z"/><path d="M12 14c0-3.5-2.8-6-6.5-6 0 3.5 2.8 6 6.5 6Z"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="8.5" r="1"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 19h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};

const LEGACY_ICON_MAP = {
  'cute-cat-food': 'utensils',
  'cute-shopping-basket': 'basket',
  'cute-bill-light': 'bolt',
  'cute-book-pencil': 'book',
  'cute-ticket-star': 'compass',
  'cute-heart-pill': 'heart',
  'cute-scooter': 'bike',
  'cute-atm': 'banknote',
  'cute-money-bag': 'wallet',
  'cute-gift-ribbon': 'gift',
  'cute-plant-growth': 'sprout',
  'cute-wallet': 'wallet',
  'cute-bank-vault': 'landmark',
  'cute-phone-pay': 'smartphone',
};

export const AVAILABLE_ICONS = [
  'utensils', 'basket', 'bolt', 'book', 'compass', 'heart',
  'bike', 'banknote', 'wallet', 'gift', 'sprout', 'landmark',
  'smartphone', 'tag', 'piggy', 'calendar',
];

export function icon(name, size = 18) {
  const key = LEGACY_ICON_MAP[name] || name;
  const path = ICON_PATHS[key] || ICON_PATHS.tag;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function ghibliMascot(theme = 'meadow', mood = 'calm', size = 56) {
  const smile = mood === 'happy'
    ? 'M23 35 Q28 40 33 35'
    : mood === 'careful'
      ? 'M24 37 Q28 35 32 37'
      : 'M24 35 Q28 38 32 35';

  if (theme === 'bakery') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="30" r="21" fill="#F6DFDC"/>
      <path d="M16 22 L19 10 L26 18 Z" fill="#3B2B26"/>
      <path d="M40 22 L37 10 L30 18 Z" fill="#3B2B26"/>
      <ellipse cx="28" cy="31" rx="14" ry="13" fill="#3B2B26"/>
      <circle cx="23" cy="29" r="2.2" fill="#FFFBF4"/>
      <circle cx="33" cy="29" r="2.2" fill="#FFFBF4"/>
      <circle cx="23.4" cy="29" r="1" fill="#2F1F18"/>
      <circle cx="33.4" cy="29" r="1" fill="#2F1F18"/>
      <path d="${smile}" stroke="#FFFBF4" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M18 14 C23 10 33 10 38 14 L33 17 L23 17 Z" fill="#A83B32"/>
      <circle cx="28" cy="14.5" r="2.2" fill="#F6DFDC"/>
    </svg>`;
  }

  if (theme === 'lantern') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="22" fill="#223142"/>
      <path d="M28 7 V13" stroke="#E8B256" stroke-width="2" stroke-linecap="round"/>
      <rect x="17" y="13" width="22" height="28" rx="11" fill="#E8B256"/>
      <rect x="20" y="16" width="16" height="22" rx="8" fill="#F7D996"/>
      <circle cx="24" cy="27" r="1.9" fill="#17202A"/>
      <circle cx="32" cy="27" r="1.9" fill="#17202A"/>
      <path d="${smile}" stroke="#17202A" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M22 41 H34" stroke="#E58A73" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  // Default: meadow leaf spirit
  return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <circle cx="28" cy="30" r="21" fill="#DFEFE5"/>
    <path d="M28 16 C28 10 34 7 39 9 C38 14 33 17 28 16 Z" fill="#2A6B4A"/>
    <path d="M28 17 V12" stroke="#1F5439" stroke-width="2" stroke-linecap="round"/>
    <path d="M15 34 C15 22 21 17 28 17 C35 17 41 22 41 34 C41 42 36 46 28 46 C20 46 15 42 15 34 Z" fill="#7D9682"/>
    <ellipse cx="28" cy="37" rx="9.5" ry="7" fill="#FFFDF7"/>
    <circle cx="23" cy="28" r="2.2" fill="#1F2D24"/>
    <circle cx="33" cy="28" r="2.2" fill="#1F2D24"/>
    <circle cx="23.6" cy="27.4" r="0.8" fill="#FFFDF7"/>
    <circle cx="33.6" cy="27.4" r="0.8" fill="#FFFDF7"/>
    <path d="${smile}" stroke="#1F2D24" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="19" cy="31" r="2" fill="#D98B75" opacity="0.55"/>
    <circle cx="37" cy="31" r="2" fill="#D98B75" opacity="0.55"/>
  </svg>`;
}
