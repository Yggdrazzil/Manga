import { classifySearchResult, classifyVolumeSynopsis } from '../scripts/synopsis-guard.mjs';

type Verdict = { ok: boolean; reason: string };
const classify = classifyVolumeSynopsis as (
  extract: string, shortDesc?: string, seriesTitle?: string, volumeSubtitle?: string,
) => Verdict;
const classifySearch = classifySearchResult as (
  extract: string, shortDesc?: string, seriesTitle?: string, volumeSubtitle?: string,
) => Verdict;

// Chaque cas ci-dessous est un extrait Wikipédia FR RÉEL qui s'était retrouvé
// à tort (ou à raison) sur une carte de tome dans le catalogue embarqué.

describe('classifyVolumeSynopsis — rejette les mauvais sujets', () => {
  it('rejette un jeu vidéo adapté de la BD', () => {
    const v = classify(
      "Bone : La Grande Course (Bone: The Great Cow Race) est le deuxième jeu vidéo de la série de jeux d'aventure basée sur la bande dessinée Bone.",
      '', 'Bone', 'La grande course',
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('mauvais-media');
  });

  it('rejette un film adapté, malgré la mention « bande dessinée » plus loin', () => {
    // Le piège exact qui passait avant : le garde-fou lisait tout le texte.
    const v = classify(
      "L’Élève Ducobu est un film français comique réalisé par Philippe de Chauveron sorti en 2011. Il s'agit d'une adaptation de la bande dessinée du même nom.",
      '', "L'Élève Ducobu", 'Ducobu, élève modèle !',
    );
    expect(v.ok).toBe(false);
  });

  it('rejette la série télévisée servie pour un tome de comics', () => {
    const v = classify(
      "The Walking Dead est une série télévisée d'horreur / dramatique américaine, tout d'abord développée par Frank Darabont.",
      '', 'The Walking Dead', 'Cette vie derrière nous…',
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('mauvais-media');
  });

  it('rejette une page d’homonymie', () => {
    const v = classify(
      'Comme sur des roulettes peut désigner :Comme sur des roulettes (1977), film de Nina Companeez.',
      '', 'Cédric', 'Comme sur des roulettes',
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('homonymie');
  });

  it('rejette l’article de la série quand il est servi pour un tome', () => {
    const v = classify(
      'Teenage Mutant Ninja Turtles (TMNT) est une série de bandes dessinées américaines publiée par Mirage Studios.',
      '', 'Teenage Mutant Ninja Turtles', 'Teenage Mutant Ninja Turtles #1',
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('decrit-la-serie');
  });

  it('rejette l’article d’un personnage', () => {
    const v = classify(
      'Michel Vaillant est un personnage de la série de bandes dessinées Michel Vaillant, créée par Jean Graton.',
      '', 'Michel Vaillant', 'China Moon',
    );
    expect(v.ok).toBe(false);
  });

  it('se fie à la description courte de l’API quand elle contredit le texte', () => {
    const v = classify(
      'Un long texte qui ne dit pas explicitement de quel média il parle mais qui reste assez long pour passer le seuil minimal de caractères.',
      'film français de 2004', 'Jack Palmer', "L'Enquête corse",
    );
    expect(v.ok).toBe(false);
  });

  it('rejette un extrait trop court', () => {
    expect(classify('Trop court.', '', 'Série', 'Tome').ok).toBe(false);
  });
});

describe('classifyVolumeSynopsis — conserve les résumés de tome légitimes', () => {
  it('accepte « est un album de la série de bande dessinée … »', () => {
    // Faux positif corrigé : contient « série » ET « bande dessinée », mais le
    // SUJET est bien l'album.
    const v = classify(
      'Le Jour des fous est un album de la série de bande dessinée Iznogoud publié aux éditions Dargaud.',
      '', 'Iznogoud', 'Le Jour des fous',
    );
    expect(v.ok).toBe(true);
  });

  it('accepte une aventure numérotée', () => {
    const v = classify(
      'Huit Heures à Berlin est la 22e aventure et le 29e album de la série de bande dessinée Blake et Mortimer.',
      '', 'Blake et Mortimer', 'Huit Heures à Berlin',
    );
    expect(v.ok).toBe(true);
  });

  it('accepte un titre d’album identique au titre de la série', () => {
    // Le sujet vaut la série, mais c'est aussi le sous-titre du tome : c'est
    // légitime (tome éponyme), on ne doit pas rejeter.
    const v = classify(
      'Largo Winch est une bande dessinée de Jean Van Hamme et Philippe Francq, premier tome de la série.',
      '', 'Largo Winch', 'Largo Winch',
    );
    expect(v.ok).toBe(true);
  });

  it('n’est pas piégé par « roman graphique »', () => {
    const v = classify(
      'Quartier lointain est un roman graphique de Jirō Taniguchi paru en 1998, récompensé à Angoulême.',
      '', 'Quartier lointain', 'Quartier lointain',
    );
    expect(v.ok).toBe(true);
  });
});

describe('classifySearchResult — plus strict que la passe directe', () => {
  it('exige une identification positive comme BD', () => {
    const neutral =
      'Le Trésor de Rackham le Rouge se déroule dans les Caraïbes et raconte une expédition maritime menée par plusieurs personnages.';
    // Accepté en passe A (aucun signal de mauvais média)…
    expect(classify(neutral, '', 'Tintin', 'Le Trésor de Rackham le Rouge').ok).toBe(true);
    // …mais refusé pour un résultat de recherche, moins fiable.
    expect(classifySearch(neutral, '', 'Tintin', 'Le Trésor de Rackham le Rouge').ok).toBe(false);
  });

  it('accepte un résultat de recherche qui s’annonce comme un album', () => {
    const v = classifySearch(
      'Le Sceptre d’Ottokar est le huitième album de la série de bande dessinée Les Aventures de Tintin.',
      '', 'Les Aventures de Tintin', "Le Sceptre d'Ottokar",
    );
    expect(v.ok).toBe(true);
  });
});
