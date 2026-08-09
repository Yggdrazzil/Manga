/**
 * Classifieur de résumés Wikipédia FR pour les albums de BD.
 *
 * Fonction pure, sans I/O, partagée par l'enrichissement et sa validation.
 *
 * Le principe : ne juger QUE la phrase de définition (« X est un/une … »),
 * jamais le corps du texte. Les premiers garde-fous testaient tout l'extrait
 * et laissaient passer de vrais faux positifs, parce qu'un article de FILM
 * adapté d'une BD mentionne « bande dessinée » deux phrases plus loin :
 *
 *   « L'Élève Ducobu est un film français comique […]. Il s'agit d'une
 *     adaptation de la bande dessinée du même nom. »   → doit être REJETÉ
 *
 *   « Bone : La Grande Course est le deuxième jeu vidéo de la série de jeux
 *     d'aventure basée sur la bande dessinée Bone. »   → doit être REJETÉ
 */

export function stripAccents(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Première phrase (sans accents, minuscules), plafonnée à 300 caractères. */
export function definitionSentence(text) {
  const clean = stripAccents(String(text || '').replace(/\s+/g, ' ').trim());
  const m = /^(.{0,300}?[.!?])(?:\s|$)/.exec(clean);
  return m ? m[1] : clean.slice(0, 300);
}

// Page d'homonymie : « Le Voleur de lumière peut désigner : … »
const DISAMBIGUATION = /\b(peut designer|peut faire reference a|est un nom qui peut)\b/;

// « … est un film », « … est le deuxième jeu vidéo », « … est un roman »…
// Le quantificateur borné autorise les qualificatifs ordinaux/nationaux
// (« est le deuxième jeu vidéo », « est un film français comique »).
const WRONG_MEDIUM_DEF = new RegExp(
  '\\b(?:est|etait|designe)\\s+(?:un|une|le|la|l\'|les)\\s*[^.]{0,60}?\\b(' +
  'film|long[- ]metrage|court[- ]metrage|telefilm|' +
  'jeux? video|jeux? d[\' ]aventure|jeu de societe|jeu de role|' +
  'serie(?: televisee| d[\' ]animation| animee)|feuilleton|' +
  'roman(?!s? graphique)|nouvelle litteraire|piece de theatre|' +
  'album (?:studio|de musique|musical)|chanson|single|groupe (?:de musique|musical)|opera|' +
  'trompettiste|saxophoniste|pianiste|chanteur|chanteuse|compositeur|' +
  'commune|ville|village|riviere|montagne|genre de|espece de|' +
  'logiciel|application|site web' +
  ')\\b',
);

// Signature d'un album : « est le 12e album de la série », « est une bande
// dessinée », « est la 22e aventure », « est le tome 3 »…
const BD_DEF = new RegExp(
  '\\b(?:est|constitue)\\s+(?:un|une|le|la|l\'|les)\\s*[^.]{0,70}?\\b(' +
  'bandes? dessinee|roman graphique|comics?|manga|manhwa|manhua|' +
  'album|tome|volume|histoire|aventure|recit|episode de la serie|diptyque|triptyque' +
  ')\\b',
);

/**
 * Sujet de la phrase de définition : ce qui précède « est/sont/désigne ».
 * « Le Jour des fous est un album de la série … » → « le jour des fous ».
 */
function definitionSubject(def) {
  const m = /^(.{1,90}?)\s+(?:est|sont|etait|designe)\b/.exec(def);
  if (!m) return '';
  return m[1]
    .replace(/\([^)]*\)/g, ' ')   // « Teenage Mutant Ninja Turtles (TMNT) »
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sameWork(a, b) {
  const norm = s => stripAccents(String(s || ''))
    .replace(/^(le|la|les|l|un|une)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return norm(a) !== '' && norm(a) === norm(b);
}

/**
 * Décide si un extrait Wikipédia peut servir de résumé pour UN TOME.
 *
 * @param {string} extract      Extrait REST de Wikipédia FR.
 * @param {string} shortDesc    Champ `description` de l'API (souvent « film de 2011 »).
 * @param {string} seriesTitle  Titre de la série, pour détecter l'article de série.
 * @param {string} volumeSubtitle Titre de l'album, pour distinguer tome et série.
 * @returns {{ok: boolean, reason: string}}
 */
export function classifyVolumeSynopsis(extract, shortDesc = '', seriesTitle = '', volumeSubtitle = '') {
  const text = String(extract || '').trim();
  if (text.length < 40) return { ok: false, reason: 'trop-court' };

  const def = definitionSentence(text);
  const short = stripAccents(String(shortDesc || ''));

  if (DISAMBIGUATION.test(def)) return { ok: false, reason: 'homonymie' };

  // La description courte de l'API est la définition la plus fiable quand
  // elle existe (« film français de Philippe de Chauveron »).
  if (short && WRONG_MEDIUM_DEF.test(`est un ${short}`) && !BD_DEF.test(`est un ${short}`)) {
    return { ok: false, reason: `mauvais-media (description: ${shortDesc})` };
  }

  if (WRONG_MEDIUM_DEF.test(def)) return { ok: false, reason: 'mauvais-media' };

  // Article de la SÉRIE servi pour un tome : le sujet de la définition est le
  // titre de la série lui-même (« Pierre Tombal est le titre d'une série… »),
  // et non celui de l'album. On ne se fie qu'au sujet : « Le Jour des fous est
  // un album de la série de bande dessinée Iznogoud » reste un résumé de tome
  // valide, alors qu'il contient bien les mots « série » et « bande dessinée ».
  const subject = definitionSubject(def);
  if (subject && seriesTitle && sameWork(subject, seriesTitle) && !sameWork(subject, volumeSubtitle)) {
    return { ok: false, reason: 'decrit-la-serie' };
  }

  return { ok: true, reason: 'ok' };
}

/** Variante stricte pour les résultats de RECHERCHE (moins fiables). */
export function classifySearchResult(extract, shortDesc = '', seriesTitle = '', volumeSubtitle = '') {
  const base = classifyVolumeSynopsis(extract, shortDesc, seriesTitle, volumeSubtitle);
  if (!base.ok) return base;
  // Un résultat de recherche doit s'annoncer positivement comme de la BD.
  if (!BD_DEF.test(definitionSentence(extract))) {
    return { ok: false, reason: 'pas-identifie-comme-bd' };
  }
  return { ok: true, reason: 'ok' };
}
