/*
 * Extended Horizons / Maui Reef Encounters brand lexicon.
 *
 * Vendored from the Element fork's @element-hq/text-correct package (LOCAL-CHANGES.md
 * L034 / business to-do #44). This is the single source of truth for brand-aware
 * autocorrect. Keep it in sync with the Element copy: edit both when the terms change.
 *
 * Design rule (learned the hard way; see the Element package's design rules): a
 * correction is ONLY safe if its `wrong` form is not a legitimate everyday English word.
 * Pure capitalization of a real word (element, matrix, whisper, synapse, clique, lanai,
 * nitrox, paperclip) fires on ordinary prose and was removed. We keep: genuine
 * misspellings, casing of non-words (FareHarbor, RingCentral, ...), and place/proper
 * nouns that are effectively never a common lowercase word (Maui, Molokini, ...). NEVER
 * add an entry where `wrong === right`: it produces a sentence-start anti-correction
 * (compile() also guards against this).
 */

/** @typedef {{ wrong: string, right: string, category: string, note?: string }} BrandCorrection */

/**
 * When `wrong` is typed, suggest `right`. Matched case-insensitively on word boundaries.
 * @type {BrandCorrection[]}
 */
export const BRAND_CORRECTIONS = [
  {
    wrong: 'fareharbor',
    right: 'FareHarbor',
    category: 'brand',
    note: 'Booking platform; canonical camelCase per fork docs',
  },
  {
    wrong: 'Fareharbor',
    right: 'FareHarbor',
    category: 'brand',
    note: 'Capitalize the H',
  },
  {
    wrong: 'fare harbor',
    right: 'FareHarbor',
    category: 'brand',
    note: 'Brand is one word',
  },
  {
    wrong: 'fairharbor',
    right: 'FareHarbor',
    category: 'brand',
    note: 'Common phonetic misspelling',
  },
  {
    wrong: 'farehabor',
    right: 'FareHarbor',
    category: 'brand',
    note: 'Dropped-r typo',
  },
  {
    wrong: 'ringcentral',
    right: 'RingCentral',
    category: 'brand',
    note: 'Phone system; canonical camelCase',
  },
  {
    wrong: 'Ringcentral',
    right: 'RingCentral',
    category: 'brand',
    note: 'Capitalize the C',
  },
  {
    wrong: 'ring central',
    right: 'RingCentral',
    category: 'brand',
    note: 'Brand is one word',
  },
  {
    wrong: 'chatwoot',
    right: 'Chatwoot',
    category: 'brand',
    note: 'Support inbox tool',
  },
  {
    wrong: 'Chatwood',
    right: 'Chatwoot',
    category: 'brand',
    note: 'Common typo',
  },
  {
    wrong: 'chatwood',
    right: 'Chatwoot',
    category: 'brand',
    note: 'Common typo',
  },
  {
    wrong: 'livekit',
    right: 'LiveKit',
    category: 'brand',
    note: 'SFU media server; canonical camelCase',
  },
  {
    wrong: 'Livekit',
    right: 'LiveKit',
    category: 'brand',
    note: 'Capitalize the K',
  },
  {
    wrong: 'live kit',
    right: 'LiveKit',
    category: 'brand',
    note: 'Brand is one word',
  },
  {
    wrong: 'cliq',
    right: 'Cliq',
    category: 'brand',
    note: "Zoho Cliq chat; capitalized (note: 'clique' is a real word, deliberately not corrected)",
  },
  {
    wrong: 'zoho',
    right: 'Zoho',
    category: 'brand',
    note: 'Software suite; capitalized',
  },
  {
    wrong: 'Zohos',
    right: 'Zoho',
    category: 'brand',
    note: 'No plural/possessive drift',
  },
  {
    wrong: 'faster whisper',
    right: 'faster-whisper',
    category: 'tool',
    note: 'Package name is hyphenated, lowercase',
  },
  {
    wrong: 'yourls',
    right: 'YOURLS',
    category: 'tool',
    note: 'Self-hosted short-link app; all caps',
  },
  { wrong: 'Yourls', right: 'YOURLS', category: 'tool', note: 'All caps' },
  {
    wrong: 'datasette',
    right: 'Datasette',
    category: 'tool',
    note: 'SQLite web UI; capitalized',
  },
  {
    wrong: 'Rclone',
    right: 'rclone',
    category: 'tool',
    note: 'Canonically lowercase',
  },
  {
    wrong: 'RClone',
    right: 'rclone',
    category: 'tool',
    note: 'Canonically lowercase',
  },
  {
    wrong: 'xola',
    right: 'Xola',
    category: 'brand',
    note: 'Booking platform; capitalized',
  },
  {
    wrong: 'callrail',
    right: 'CallRail',
    category: 'brand',
    note: 'Call-tracking; canonical camelCase',
  },
  {
    wrong: 'Callrail',
    right: 'CallRail',
    category: 'brand',
    note: 'Capitalize the R',
  },
  {
    wrong: 'call rail',
    right: 'CallRail',
    category: 'brand',
    note: 'Brand is one word',
  },
  {
    wrong: 'padi',
    right: 'PADI',
    category: 'cert',
    note: 'Dive training agency; all caps acronym',
  },
  { wrong: 'Padi', right: 'PADI', category: 'cert', note: 'All caps acronym' },
  {
    wrong: 'P.A.D.I.',
    right: 'PADI',
    category: 'cert',
    note: 'No periods in the acronym',
  },
  {
    wrong: 'molokni',
    right: 'Molokini',
    category: 'place',
    note: 'Crescent islet dive site off Maui; classic misspell',
  },
  {
    wrong: 'molokini',
    right: 'Molokini',
    category: 'place',
    note: 'Capitalize proper noun',
  },
  {
    wrong: 'molikini',
    right: 'Molokini',
    category: 'place',
    note: 'Vowel-swap misspell',
  },
  {
    wrong: 'mokolini',
    right: 'Molokini',
    category: 'place',
    note: 'Transposition misspell',
  },
  {
    wrong: 'molokinni',
    right: 'Molokini',
    category: 'place',
    note: 'Double-n misspell',
  },
  {
    wrong: 'lahaina',
    right: 'Lahaina',
    category: 'place',
    note: 'Maui town; capitalize proper noun',
  },
  {
    wrong: 'Lahania',
    right: 'Lahaina',
    category: 'place',
    note: 'Transposition misspell',
  },
  {
    wrong: 'Lahina',
    right: 'Lahaina',
    category: 'place',
    note: 'Dropped-a misspell',
  },
  {
    wrong: 'Lahaini',
    right: 'Lahaina',
    category: 'place',
    note: 'Ending misspell',
  },
  {
    wrong: 'maui',
    right: 'Maui',
    category: 'place',
    note: 'Island; capitalize proper noun',
  },
  {
    wrong: 'Mauai',
    right: 'Maui',
    category: 'place',
    note: 'Transposition misspell',
  },
  {
    wrong: 'hawaii',
    right: 'Hawaii',
    category: 'place',
    note: 'Capitalize proper noun',
  },
  {
    wrong: 'Hawai',
    right: 'Hawaii',
    category: 'place',
    note: 'Dropped-i misspell (non-okina form)',
  },
  {
    wrong: 'Hawwaii',
    right: 'Hawaii',
    category: 'place',
    note: 'Double-w misspell',
  },
  {
    wrong: 'turtle town',
    right: 'Turtle Town',
    category: 'place',
    note: 'Named dive site; title case',
  },
  {
    wrong: 'buoyency',
    right: 'buoyancy',
    category: 'common-typo',
    note: 'Classic dive-term misspell',
  },
  {
    wrong: 'bouyancy',
    right: 'buoyancy',
    category: 'common-typo',
    note: 'Transposed uo->ou',
  },
  {
    wrong: 'bouyency',
    right: 'buoyancy',
    category: 'common-typo',
    note: 'Double misspell',
  },
  {
    wrong: 'buyoancy',
    right: 'buoyancy',
    category: 'common-typo',
    note: 'Transposition misspell',
  },
  {
    wrong: 'buoancy',
    right: 'buoyancy',
    category: 'common-typo',
    note: 'Dropped-y misspell',
  },
  {
    wrong: 'regualtor',
    right: 'regulator',
    category: 'common-typo',
    note: 'Transposition misspell',
  },
  {
    wrong: 'regulater',
    right: 'regulator',
    category: 'common-typo',
    note: '-er for -or misspell',
  },
  {
    wrong: 'narcossis',
    right: 'narcosis',
    category: 'common-typo',
    note: 'Double-s misspell',
  },
  {
    wrong: 'divemaster',
    right: 'Divemaster',
    category: 'cert',
    note: 'PADI pro rating; capitalized as certification title',
  },
  {
    wrong: 'dive master',
    right: 'Divemaster',
    category: 'cert',
    note: 'PADI rating is one word',
  },
  {
    wrong: 'snorkling',
    right: 'snorkeling',
    category: 'common-typo',
    note: 'Dropped-e misspell',
  },
  {
    wrong: 'certifcation',
    right: 'certification',
    category: 'common-typo',
    note: 'Dropped-i misspell',
  },
  {
    wrong: 'certificaton',
    right: 'certification',
    category: 'common-typo',
    note: 'Dropped-i misspell',
  },
  {
    wrong: 'elearning',
    right: 'eLearning',
    category: 'tool',
    note: 'PADI eLearning; canonical camelCase',
  },
  {
    wrong: 'e-learning',
    right: 'eLearning',
    category: 'tool',
    note: 'Normalize to PADI eLearning casing',
  },
];

/**
 * Correctly-spelled domain terms that a generic spell checker would wrongly flag.
 * Seeded into Harper's dictionary via importWords() so they are never underlined.
 * @type {string[]}
 */
export const PROTECTED_TERMS = [
  'FareHarbor',
  'RingCentral',
  'Chatwoot',
  'Synapse',
  'LiveKit',
  'Cliq',
  'Zoho',
  'Whisper',
  'faster-whisper',
  'YOURLS',
  'Matrix',
  'Element',
  'Datasette',
  'rclone',
  'Xola',
  'CallRail',
  'Paperclip',
  'Egress',
  'Olm',
  'MatrixRTC',
  'homeserver',
  'Molokini',
  'Lanai',
  'Lahaina',
  'Maui',
  'Hawaii',
  'Kahoolawe',
  'Nitrox',
  'Divemaster',
  'buoyancy',
  'regulator',
  'BCD',
  'DSD',
  'narcosis',
  'Wikiki',
  'eLearning',
  'liveaboard',
  'backplate',
  'octopus',
  'reef',
  'altaFlow',
  'openid',
  'sqlite',
  'Anthropic',
  'Opus',
  // Lowercase dive terms whose brand capitalization entry was removed (L034):
  // keep Harper from re-flagging the valid lowercase forms.
  'nitrox',
  'snorkeling',
  'wetsuit',
  'scuba',
];
