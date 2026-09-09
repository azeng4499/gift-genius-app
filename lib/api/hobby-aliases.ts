/**
 * Extra search terms for merged hobbies so "guitar" still finds "Playing music".
 * Keys are lowercase; values are substrings of the catalog name.
 */
const HOBBY_SEARCH_ALIASES: Record<string, string[]> = {
  "playing music": ["guitar", "piano", "violin", "drums", "ukulele", "singing"],
  "music production": ["dj", "djing", "songwriting"],
  "yoga & meditation": ["yoga", "meditation"],
  "hiking & camping": ["hiking", "camping", "backpacking"],
  "knitting & crochet": ["knitting", "crochet"],
  "candles & soap": ["candle", "soap"],
  "wine & cocktails": ["wine", "cocktail", "whiskey"],
  "craft beer": ["beer", "brewing"],
  coffee: ["latte", "espresso", "roasting"],
  gardening: ["plants", "houseplants", "bonsai", "succulents", "flowers"],
  writing: ["poetry", "journaling", "blogging"],
  "painting & drawing": ["painting", "drawing"],
  climbing: ["bouldering", "rock climbing"],
  "skiing & snowboarding": ["skiing", "snowboarding"],
  "paddle sports": ["kayak", "canoe", "paddleboard", "sup"],
  "scuba & snorkeling": ["scuba", "snorkeling"],
  "racket sports": ["tennis", "pickleball", "badminton", "table tennis"],
  "team sports": ["basketball", "soccer", "baseball", "football", "volleyball"],
  "martial arts": ["boxing", "kickboxing"],
  fitness: ["gym", "crossfit", "weightlifting", "pilates", "marathon"],
  "content creation": ["podcast", "vlog", "youtube", "video editing"],
  "coding & tech": ["coding", "robotics", "electronics"],
  "models & rc": ["drone", "rc", "model trains", "rockets"],
  "comics & anime": ["anime", "manga", "comics", "cosplay"],
  "movies & film": ["movies", "filmmaking"],
  "theater & comedy": ["improv", "standup", "karaoke", "theater"],
  "tabletop gaming": ["d&d", "dnd", "rpg", "warhammer", "miniatures"],
  lego: ["lego"],
  "home & diy": ["diy", "interior", "furniture", "upcycling"],
  fashion: ["sneakers", "thrifting"],
  beauty: ["makeup", "skincare", "nails", "perfume"],
  "word games & trivia": ["crossword", "sudoku", "trivia"],
  pets: ["dogs", "cats", "aquarium"],
  collecting: ["stamps", "coins", "vinyl"],
  skating: ["ice skating", "rollerblading", "roller skating"],
  fishing: ["fly fishing", "ice fishing"],
  cycling: ["mountain biking", "bike"],
  travel: ["road trip"],
  magic: ["magic tricks", "juggling"],
};

export function hobbyMatchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const lower = name.toLowerCase();
  if (lower.includes(q)) return true;
  const aliases = HOBBY_SEARCH_ALIASES[lower] ?? [];
  return aliases.some((alias) => alias.includes(q) || q.includes(alias));
}
