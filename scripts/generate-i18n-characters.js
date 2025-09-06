// Generate i18n character fields for 25 characters from character.md (EN)
// and character-select.html profilesData (ZH). Produces i18n.characters.generated.js
import { promises as fs } from 'fs';

const CHAR_HTML = 'character-select.html';
const CHAR_MD = 'character.md';
const OUT_FILE = 'i18n.characters.generated.js';

function normalizeName(name) {
  if (!name) return '';
  const key = name.toLowerCase().replace(/\s+/g, '');
  const alias = {
    ququ: 'Ququ',
    miumiu: 'Miumiu',
    yuuyii: 'Yuu Yii',
  };
  return alias[key] || name;
}

async function parseNameIdMap(html) {
  const txt = await fs.readFile(html, 'utf8');
  const out = {};
  const start = txt.indexOf('const characters = [');
  if (start === -1) return out;
  const after = txt.slice(start);
  const end = after.indexOf('];');
  const block = after.slice(0, end + 2);
  // Extract each object block
  const objRe = /\{[\s\S]*?\}/g;
  let om;
  while ((om = objRe.exec(block))) {
    const objText = om[0];
    const idMatch = objText.match(/id:\s*"([^"]+)"/);
    const nameMatch = objText.match(/name:\s*"([^"]+)"/);
    if (idMatch && nameMatch) {
      out[normalizeName(nameMatch[1])] = idMatch[1];
    }
  }
  return out;
}

async function parseChineseProfiles(html) {
  const txt = await fs.readFile(html, 'utf8');
  const startIdx = txt.indexOf('function getCharacterProfile');
  if (startIdx === -1) return {};
  const slice = txt.slice(startIdx);
  const objStart = slice.indexOf('const profilesData = {');
  if (objStart === -1) return {};
  const body = slice.slice(objStart + 'const profilesData = {'.length);
  // Cut until closing \n            }; (heuristic)
  const endIdx = body.indexOf('};');
  const mapText = body.slice(0, endIdx);
  // Match blocks: "Name": { ... }
  const blocks = {};
  const blockRe = /"([^"]+)"\s*:\s*\{([\s\S]*?)\},?\n/g;
  let bm;
  while ((bm = blockRe.exec(mapText))) {
    const rawName = bm[1];
    const content = bm[2];
    const profile = {};
    // key: value pairs (strings or numbers)
    const lineRe = /(age|birthday|zodiac|personality|dailyInterests|likes|dislikes|favoriteFood|favoriteMusic|favoriteMovies|favoriteGames)\s*:\s*([^,\n]+)\s*,?/g;
    let lm;
    while ((lm = lineRe.exec(content))) {
      const k = lm[1];
      let v = lm[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('\'') && v.endsWith('\''))) {
        v = v.slice(1, -1);
      }
      profile[k] = v;
    }
    blocks[normalizeName(rawName)] = profile;
  }
  return blocks;
}

async function parseEnglishProfiles(md) {
  const txt = await fs.readFile(md, 'utf8');
  const sections = txt.split(/^##\s+/m).slice(1);
  const out = {};
  for (const sec of sections) {
    const lines = sec.split(/\n/);
    const rawName = (lines[0] || '').trim();
    const get = (label) => {
      const re = new RegExp(`^- \\*\\*${label}\\*\\*:\\s*(.+?)\\s*$`, 'i');
      const line = lines.find((l) => re.test(l));
      if (!line) return undefined;
      const m = line.match(re);
      return m ? m[1].trim() : undefined;
    };
    const en = {
      age: get('Age'),
      birthday: get('Birthday'),
      zodiac: get('Zodiac'),
      personality: get('Personality'),
      dailyInterests: get('Daily Interests'),
    };
    const likesLine = get('Likes & Dislikes');
    if (likesLine) {
      const likeMatch = likesLine.match(/Likes([^;]+?)(?:;|$)/i);
      const dislikeMatch = likesLine.match(/dislikes([^;]+?)(?:;|$)/i);
      if (likeMatch) en.likes = likeMatch[1].trim();
      if (dislikeMatch) en.dislikes = dislikeMatch[1].trim();
    }
    en.favoriteFood = get('Favorite Foods');
    en.favoriteMusic = get('Favorite Music');
    en.favoriteMovies = get('Favorite Movies');
    en.favoriteGames = get('Favorite Games');
    if (rawName) out[normalizeName(rawName)] = en;
  }
  return out;
}

function toI18nEntries(nameToId, zhMap, enMap) {
  const en = {};
  const zh = {};
  const fields = [
    ['age', 'age'],
    ['birthday', 'birthday'],
    ['zodiac', 'zodiac'],
    ['personality', 'personality'],
    ['dailyInterests', 'interests'],
    ['likes', 'likes'],
    ['dislikes', 'dislikes'],
    ['favoriteFood', 'food'],
    ['favoriteMusic', 'music'],
    ['favoriteMovies', 'movies'],
    ['favoriteGames', 'games'],
  ];

  for (const nameKey of Object.keys(nameToId)) {
    const id = nameToId[nameKey];
    const zhP = zhMap[nameKey] || {};
    const enP = enMap[nameKey] || {};
    for (const [srcKey, i18nKey] of fields) {
      const enVal = (enP[srcKey] ?? '').toString();
      const zhVal = (zhP[srcKey] ?? '').toString() || enVal; // fallback to EN if missing
      en[`character.${id}.${i18nKey}`] = enVal;
      zh[`character.${id}.${i18nKey}`] = zhVal;
    }
  }
  return { en, zh };
}

async function main() {
  const nameToId = await parseNameIdMap(CHAR_HTML);
  const zhMap = await parseChineseProfiles(CHAR_HTML);
  const enMap = await parseEnglishProfiles(CHAR_MD);
  const merged = toI18nEntries(nameToId, zhMap, enMap);

  const header = '// Auto-generated from character.md and character-select.html. Do not edit manually.\n';
  const body = `window.I18N_CHARACTERS = ${JSON.stringify(merged, null, 2)};\n`;
  await fs.writeFile(OUT_FILE, header + body, 'utf8');
  console.log(`Generated ${OUT_FILE} with ${Object.keys(merged.en).length} EN keys and ${Object.keys(merged.zh).length} ZH keys.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
