/**
 * Gothic Transcription Training Data
 *
 * Curated data extracted from:
 * - gothic_word_patterns.json (Kong Christian den Fierdes Historie)
 * - glyphs.json (Gothic glyph library)
 *
 * This data is used to enhance the Claude Vision AI prompt for better
 * transcription accuracy of 1600s Danish Gothic/Fraktur script.
 */

const GOTHIC_TRAINING_DATA = {
  // Top 34 common words from historical documents
  commonWords: [
    "og", "at", "de", "det", "der", "den", "dend", "som", "med", "til",
    "for", "af", "udi", "var", "han", "hand", "sin", "sig", "sit", "alle",
    "eller", "efter", "over", "under", "mellem", "imellem", "anden", "andre",
    "meget", "meer", "aldrig", "altid", "nu", "da"
  ],

  // 21 verbs with historical spelling preserved
  verbs: [
    "hafde", "blef", "blev", "giorde", "giøre", "kunde", "kand",
    "skulle", "skulde", "ville", "vilde", "maatte", "sagde", "saae",
    "kom", "tog", "gaf", "gik", "lod", "satte", "holdte"
  ],

  // 23 nouns commonly found in historical texts
  nouns: [
    "Konge", "Kongen", "Konges", "Rige", "Riget", "Riger", "Rigets",
    "Land", "Landet", "Aar", "Dag", "Dage", "Tiid", "Lov", "Ret",
    "Raad", "Mand", "Mænd", "Herre", "Hertug", "Biskop", "Kirke", "Kirker"
  ],

  // 16 proper names (people and places)
  properNames: [
    "Kong Christian", "Christian", "Danmark", "Danske", "Norge", "Norske",
    "Sverrig", "Svenske", "Kiøbenhafn", "Trundhiem", "Pohlen",
    "Tydskland", "GUD", "Sigismund", "Karl", "Hertug Karl"
  ],

  // 12 adjectives with historical spelling
  adjectives: [
    "stor", "store", "god", "gode", "gammel", "gamle",
    "ny", "nye", "egen", "egne", "heel", "heele", "self", "samme"
  ],

  // Geographic terms
  geographic: [
    "Stockholms", "Calmar", "Elfsburg", "Jydland", "Fyen",
    "Sielland", "Skaane", "England", "Prussiske", "Prussien"
  ],

  // Titles and roles
  titles: [
    "Dronning", "Dronningen", "Prinds", "Printzen", "Raads",
    "Canceller", "Gesandt", "Gesandter", "Admiral", "Doctor"
  ],

  // Diplomatic and formal terms
  diplomaticTerms: [
    "Fordrag", "Forhandling", "Forbund", "Tractater",
    "Ambassadeur", "Commission", "Resolution"
  ],

  // Long s (ſ) patterns - 20 most important examples
  longSPatterns: [
    { gothic: "ſom", modern: "som" },
    { gothic: "ſig", modern: "sig" },
    { gothic: "ſin", modern: "sin" },
    { gothic: "ſit", modern: "sit" },
    { gothic: "ſtor", modern: "stor" },
    { gothic: "ſelf", modern: "self" },
    { gothic: "ſamme", modern: "samme" },
    { gothic: "ſkulle", modern: "skulle" },
    { gothic: "ſkal", modern: "skal" },
    { gothic: "ſtaae", modern: "staae" },
    { gothic: "Hiſtorie", modern: "Historie" },
    { gothic: "Majeſtæt", modern: "Majestæt" },
    { gothic: "diſſe", modern: "disse" },
    { gothic: "viſſe", modern: "visse" },
    { gothic: "beſte", modern: "beste" },
    { gothic: "forſtaae", modern: "forstaae" },
    { gothic: "Geſandt", modern: "Gesandt" },
    { gothic: "Ambaſſadeur", modern: "Ambassadeur" },
    { gothic: "Commiſſion", modern: "Commission" },
    { gothic: "Biſkop", modern: "Biskop" }
  ],

  // Common phrases from historical documents
  phrases: [
    "Kong Christian dend Fierde",
    "Hans Kongelige Majestæt",
    "Rigens Raad",
    "udi disse Tider",
    "efter at hand hafde",
    "saa og",
    "ikke alleeneste",
    "men ogsaa",
    "udi det Rige",
    "paa dend Tiid"
  ],

  // Common marginal note patterns
  marginalNotes: [
    "Kongen", "Hertug", "Aar 1596", "Aar 1597", "Aar 1598",
    "Biskoppen", "Dronningen", "Gesandter", "Stockholms", "Prussiske"
  ],

  // Rare and complex words from verified translation (Slange Chr 4 part 2 0812)
  // These words are particularly challenging and come from professional translation of pages 113-121
  rareWords: [
    "fremblinket", "høypriselige", "vederqvæget", "Vindskibelighed",
    "Agtsomhed", "Fortrængte", "Sagtmodighed", "Forsiunlighed",
    "Sparsommelighed", "Morgenrøden", "Diamanter", "Forsigtighed",
    "Heroiske", "Miskundhed", "Forfængelighed", "Skiemt",
    "Tidsfordrif", "Stadighed", "Alvorlighed", "smigrende",
    "klafrende", "Bagvaskelse", "cronet", "Beskiermelse",
    "Overmodige", "Huusholdning", "udkrævedes", "efterkommende",
    "høytravende", "hykliske", "stadfæster", "Privilegier",
    "Omhyggelighed", "Videnskaber", "indrettede", "Afdeelinger",
    "Magelighed", "overhøre", "Samtaler", "deslige",
    "brugelige", "Kiøbstædernes", "Forfremmelse", "Lagebetters",
    "Lovgivers", "Bogtrykkeriet", "Pergament", "u-læselige",
    "Munke-Skrift", "u-forstaaelige"
  ],

  // Complete sentence examples for few-shot learning (from verified parallel text)
  // These demonstrate typical 1600s Danish with historical spelling, long s patterns, and complex grammar
  exampleSentences: [
    "Det Lys, som hidindtil hafde fremblinket af dend unge Konges høypriselige Dyder, gaf, ligesom Morgenrøden, tilkiende, hvor klar en Soel der nu ville opstaae og fremskinne.",

    "Hand giorde ikke, som eendeel unge Printzer gierne giøre, at hand tog efter de smigrende og klafrende Tunges Snak og Bagvaskelse, som hand hafde hørt førend hand blef cronet; men hand udspurte og hørte hans klogeste og beste Raads Raad.",

    "Hans Sværd bar hand udi Belte ved sin Siide hængendes udi Balgen med stor Sagtmodighed, og hand dertil blef tvungen: Men naar hand dette skulle giøre, da viiste hand udi Gierningen, at hand hafde Mood og Styrke til at føre det, som een retfærdig Konge, og som enn tapper Krigs-Helt.",

    "Guld-Eblet bar hand saa varligen og holdte saa fast derpaa, at det aldrig trillede ham af Haanden, Forsiunlighed og Sparsommelighed at holde Haand over, at de ikke bleve brugte til andet, end til Fæderlandets Gafn og Nytte.",

    "Dend gamle Norske Lov, som nu er baaren til Eders Kongelige Majestæt og som med Munke-Skrift paa Pargament er skrefvet; kunde ikke efter de Tiders Tilstand være bedre, retfærdigere og meere taallig, end dend var: Men Tidernes Forandring, Sprogets Ælde, og indfaldene Regierings Forvirring haver giort een stor Deel af dend u-brugelig."
  ]
};
