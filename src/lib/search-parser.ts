// Parse advanced search syntax like $tag:ASMR $va:五十嵐裕美
// Returns structured search query with filters

export interface SearchFilters {
  text: string; // free text search
  tag: string[];
  tagw: string[]; // include low-vote tags
  circle: string[];
  va: string[];
  duration: number | null; // > x seconds
  rate: number | null; // > x rating
  price: number | null; // > x price
  sell: number | null; // > x sales
  age: string | null; // age category
  lang: string | null; // language
}

const FILTER_KEYS = [
  "tag",
  "tagw",
  "circle",
  "va",
  "duration",
  "rate",
  "price",
  "sell",
  "age",
  "lang",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export function parseSearchQuery(input: string): {
  text: string;
  filters: SearchFilters;
  rawFilters: { key: FilterKey; value: string }[];
} {
  const filters: SearchFilters = {
    text: "",
    tag: [],
    tagw: [],
    circle: [],
    va: [],
    duration: null,
    rate: null,
    price: null,
    sell: null,
    age: null,
    lang: null,
  };

  const rawFilters: { key: FilterKey; value: string }[] = [];

  // Match $key:value patterns (value can be quoted or unquoted)
  const regex = /\$(tag|tagw|circle|va|duration|rate|price|sell|age|lang):("([^"]*)"|(\S+))/gi;
  let match;

  let remainingText = input;

  while ((match = regex.exec(input)) !== null) {
    const key = match[1].toLowerCase() as FilterKey;
    const value = (match[3] ?? match[4] ?? "").trim();

    rawFilters.push({ key, value });

    // Remove this filter from the text
    remainingText = remainingText.replace(match[0], " ").trim();

    if (key === "tag") filters.tag.push(value);
    else if (key === "tagw") filters.tagw.push(value);
    else if (key === "circle") filters.circle.push(value);
    else if (key === "va") filters.va.push(value);
    else if (key === "duration") filters.duration = parseFloat(value) || null;
    else if (key === "rate") filters.rate = parseFloat(value) || null;
    else if (key === "price") filters.price = parseFloat(value) || null;
    else if (key === "sell") filters.sell = parseInt(value) || null;
    else if (key === "age") filters.age = value;
    else if (key === "lang") filters.lang = value;
  }

  filters.text = remainingText.trim();

  return { text: filters.text, filters, rawFilters };
}

export function hasFilters(filters: SearchFilters): boolean {
  return (
    filters.tag.length > 0 ||
    filters.tagw.length > 0 ||
    filters.circle.length > 0 ||
    filters.va.length > 0 ||
    filters.duration !== null ||
    filters.rate !== null ||
    filters.price !== null ||
    filters.sell !== null ||
    filters.age !== null ||
    filters.lang !== null
  );
}

// Get the current "typing" filter (user typed `$tag:` but hasn't finished)
export function getActiveFilterPrefix(text: string): {
  key: FilterKey | null;
  query: string;
} | null {
  const match = text.match(/\$(tag|tagw|circle|va|duration|rate|price|sell|age|lang):(\S*)$/i);
  if (!match) return null;
  return {
    key: match[1].toLowerCase() as FilterKey,
    query: match[2] || "",
  };
}
