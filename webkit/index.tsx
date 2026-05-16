// == Steam RUB Converter - Millennium Plugin Port ==
import { callable } from '@steambrew/webkit';

declare const window: any;
declare const Millennium: any;

type SetSessionSourceCurrencyPayload = {
  currency: string;
};

function GM_addStyle(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

const GetCachedRates = callable<[], string>("GetCachedRates");
const GetSessionSourceCurrency = callable<[], string>("GetSessionSourceCurrency");
const SetSessionSourceCurrencyOnce = callable<[SetSessionSourceCurrencyPayload], string>("SetSessionSourceCurrencyOnce");


const signToValute: Record<string, string> = {
  "₸": "KZT", "KZT": "KZT", "TL": "TRY", "TRY": "TRY", "₺": "TRY", "€": "EUR", "£": "GBP", "ARS$": "ARS", "₴": "UAH",
  "₽": "RUB", "руб.": "RUB", "руб": "RUB", "RUB": "RUB", "$": "USD",
  "zł": "PLN", "R$": "BRL", "CN¥": "CNY", "RMB": "CNY", "¥": "JPY", "kr": "NOK", "Rp": "IDR", "RM": "MYR", "PHP": "PHP", "₱": "PHP", "P": "PHP",
  "S$": "SGD", "฿": "THB", "₫": "VND", "₩": "KRW", "Mex$": "MXN", "CDN$": "CAD", "A$": "AUD",
  "NZ$": "NZD", "₹": "INR", "CLP$": "CLP", "S/.": "PEN", "S/": "PEN", "COL$": "COP", "R ": "ZAR", "HK$": "HKD",
  "NT$": "TWD", "SR": "SAR", "DH": "AED", "₪": "ILS", "KD": "KWD", "QR": "QAR", "₡": "CRC",
  "$U": "UYU", "CHF": "CHF", "pуб": "RUB"
};

const steamCurrencies = [
  { id: 1, abbr: "USD", symbol: "$", hint: "United States Dollars" },
  { id: 2, abbr: "GBP", symbol: "£", hint: "British Pound" },
  { id: 3, abbr: "EUR", symbol: "€", hint: "European Union Euro" },
  { id: 4, abbr: "CHF", symbol: "CHF", hint: "Swiss Francs" },
  { id: 5, abbr: "RUB", symbol: "pуб", hint: "Russian Rouble" },
  { id: 6, abbr: "PLN", symbol: "zł", hint: "Polish Złoty" },
  { id: 7, abbr: "BRL", symbol: "R$", hint: "Brazilian Reals" },
  { id: 8, abbr: "JPY", symbol: "¥", hint: "Japanese Yen" },
  { id: 9, abbr: "NOK", symbol: "kr", hint: "Norwegian Krone" },
  { id: 10, abbr: "IDR", symbol: "Rp", hint: "Indonesian Rupiah" },
  { id: 11, abbr: "MYR", symbol: "RM", hint: "Malaysian Ringgit" },
  { id: 12, abbr: "PHP", symbol: "P", hint: "Philippine Peso" },
  { id: 13, abbr: "SGD", symbol: "S$", hint: "Singapore Dollar" },
  { id: 14, abbr: "THB", symbol: "฿", hint: "Thai Baht" },
  { id: 15, abbr: "VND", symbol: "₫", hint: "Vietnamese Dong" },
  { id: 16, abbr: "KRW", symbol: "₩", hint: "South Korean Won" },
  { id: 17, abbr: "TRY", symbol: "TL", hint: "Turkish Lira" },
  { id: 18, abbr: "UAH", symbol: "₴", hint: "Ukrainian Hryvnia" },
  { id: 19, abbr: "MXN", symbol: "Mex$", hint: "Mexican Peso" },
  { id: 20, abbr: "CAD", symbol: "CDN$", hint: "Canadian Dollars" },
  { id: 21, abbr: "AUD", symbol: "A$", hint: "Australian Dollars" },
  { id: 22, abbr: "NZD", symbol: "NZ$", hint: "New Zealand Dollar" },
  { id: 23, abbr: "CNY", symbol: null, hint: "Chinese Renminbi (yuan)" },
  { id: 24, abbr: "INR", symbol: "₹", hint: "Indian Rupee" },
  { id: 25, abbr: "CLP", symbol: "CLP$", hint: "Chilean Peso" },
  { id: 26, abbr: "PEN", symbol: "S/.", hint: "Peruvian Nuevo Sol" },
  { id: 27, abbr: "COP", symbol: "COL$", hint: "Colombian Peso" },
  { id: 28, abbr: "ZAR", symbol: "R ", hint: "South African Rand" },
  { id: 29, abbr: "HKD", symbol: "HK$", hint: "Hong Kong Dollar" },
  { id: 30, abbr: "TWD", symbol: "NT$", hint: "New Taiwan Dollar" },
  { id: 31, abbr: "SAR", symbol: "SR", hint: "Saudi Riyal" },
  { id: 32, abbr: "AED", symbol: "DH", hint: "UAE Dirham" },
  { id: 34, abbr: "ARS", symbol: "ARS$", hint: "Argentine Peso" },
  { id: 35, abbr: "ILS", symbol: "₪", hint: "Israeli New Shekel" },
  { id: 37, abbr: "KZT", symbol: "₸", hint: "Kazakhstani Tenge" },
  { id: 38, abbr: "KWD", symbol: "KD", hint: "Kuwaiti Dinar" },
  { id: 39, abbr: "QAR", symbol: "QR", hint: "Qatari Riyal" },
  { id: 40, abbr: "CRC", symbol: "₡", hint: "Costa Rican Colón" },
  { id: 41, abbr: "UYU", symbol: "$U", hint: "Uruguayan Peso" },
];

const findCurrencyById = (id: number) => steamCurrencies.find(c => c.id === id);

// --- State ---
let valute: string | null = null;
let valuteSign: string | null = null;
let sourceCurrencyDetector: string | null = null;
let currency: any = null;
let isReady = false;
let initialQueue: HTMLElement[] = [];
let startupRetryTimer: number | null = null;
let startupRetryCount = 0;
let settingsWatchTimer: number | null = null;
let currentSettingsKey = "";
let domObserver: MutationObserver | null = null;
let observerPauseDepth = 0;
let hasStarted = false;
let isInitializing = false;
let initializationRetryTimer: number | null = null;
const pendingProcessElements = new Set<HTMLElement>();
let pendingProcessTimer: number | null = null;
const pendingDynamicBundlePriceElements = new Set<HTMLElement>();
let pendingDynamicBundlePriceTimer: number | null = null;

const rateFetchTimeoutMs = 10000;
const rateFetchRetryMs = 15000;
const ratesCacheStorageKey = "steam-rub-converter:last-good-rates";

type RateSource = "freedom" | "exchange_api";

const getActiveRateSource = (): RateSource => {
  const configured = currency?.settings?.rateSource;
  return configured === "exchange_api" ? "exchange_api" : "freedom";
};

const getTargetCurrency = (): string => {
  return (currency?.settings?.targetCurrency || "RUB").toString().toUpperCase();
};

const getCurrencyInfo = (currencyCode: string) => {
  return steamCurrencies.find(c => c.abbr === currencyCode);
};

const manualCurrencySymbols: Record<string, string> = {
  RUB: "₽",
  TRY: "₺",
  PHP: "₱",
  CNY: "¥",
  KGS: "с",
  TJS: "SM",
  UZS: "сум",
};

const formattedCurrencyReplacements: Record<string, Array<[RegExp, string]>> = {
  RUB: [
    [/\s*(?:pуб|руб\.?|RUB|₽)\s*$/i, " ₽"],
  ],
  TRY: [
    [/^\s*(?:TL|TRY|₺)\s*/i, "₺"],
    [/\s*(?:TL|TRY|₺)\s*$/i, " ₺"],
  ],
  PHP: [
    [/^\s*(?:P|PHP|₱)\s*/i, "₱"],
    [/\s*(?:P|PHP|₱)\s*$/i, " ₱"],
  ],
  CNY: [
    [/^\s*(?:CNY|CN¥|RMB|¥)\s*/i, "¥"],
    [/\s*(?:CNY|CN¥|RMB|¥)\s*$/i, " ¥"],
  ],
};

const wholeNumberDisplayCurrencies = new Set([
  "CLP",
  "COP",
  "CRC",
  "IDR",
  "JPY",
  "KRW",
  "KZT",
  "RUB",
  "TWD",
  "VND",
]);

const getDisplayFractionDigits = (currencyCode: string): number => {
  if (wholeNumberDisplayCurrencies.has(currencyCode)) return 0;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).resolvedOptions().maximumFractionDigits;
  } catch (_) { }

  return 2;
};

const getFreedomBankRateForCurrency = (currencyCode: string): number | null => {
  if (currencyCode === "RUB") return 1;

  if (currency.ffin && currency.ffin.data && currency.ffin.data.mobile) {
    const mobile = currency.ffin.data.mobile;

    // Direct: bank buys RUB, sells currencyCode
    const direct = mobile.find((r: any) => r.buyCode.trim() === "RUB" && r.sellCode.trim() === currencyCode);
    if (direct) return parseFloat(direct.buyRate.replace(/[^0-9.]/g, ''));

    // Reverse: bank buys currencyCode, sells RUB
    const reverse = mobile.find((r: any) => r.buyCode.trim() === currencyCode && r.sellCode.trim() === "RUB");
    if (reverse) return 1 / parseFloat(reverse.sellRate.replace(/[^0-9.]/g, ''));
  }

  return null;
};

const getExchangeApiRateForCurrency = (currencyCode: string): number | null => {
  if (currencyCode === "RUB") return 1;

  const rate = currency.exchange_api?.rub?.[currencyCode.toLowerCase()];
  return typeof rate === "number" && rate > 0 ? rate : null;
};

const getRateForCurrency = (currencyCode: string, source: RateSource = getActiveRateSource()): number | null => {
  if (!currency) return null;

  if (source === "exchange_api") {
    return getExchangeApiRateForCurrency(currencyCode);
  }

  return getFreedomBankRateForCurrency(currencyCode);
};

const getConversionRates = (): { sourceRate: number; targetRate: number } | null => {
  if (!currency || !valute) return null;

  const targetCurrency = getTargetCurrency();
  const configuredSource = getActiveRateSource();
  const configuredSourceRate = getRateForCurrency(valute, configuredSource);
  const configuredTargetRate = getRateForCurrency(targetCurrency, configuredSource);

  if (configuredSourceRate && configuredTargetRate) {
    return {
      sourceRate: configuredSourceRate,
      targetRate: configuredTargetRate,
    };
  }

  if (configuredSource === "freedom" && !configuredSourceRate) {
    const exchangeSourceRate = getRateForCurrency(valute, "exchange_api");
    const exchangeTargetRate = getRateForCurrency(targetCurrency, "exchange_api");

    if (exchangeSourceRate && exchangeTargetRate) {
      return {
        sourceRate: exchangeSourceRate,
        targetRate: exchangeTargetRate,
      };
    }
  }

  return null;
};

const getDataPriceFinal = (element: HTMLElement): number | null => {
  const raw = element.dataset?.priceFinal || element.getAttribute("data-price-final");
  if (!raw) return null;

  const value = Number(raw);
  return value > 0 ? value / 100 : null;
};

const hasClassPart = (element: HTMLElement, part: string): boolean => {
  return (element.className || "").toString().includes(part);
};

const hasDirectChildClass = (element: HTMLElement, className: string): boolean => {
  return Array.from(element.children).some(child => child.classList.contains(className));
};

const hasLineThrough = (element: HTMLElement): boolean => {
  try {
    const style = window.getComputedStyle(element);
    return `${style.textDecorationLine} ${style.textDecoration}`.includes("line-through");
  } catch (_) {
    return false;
  }
};

const isOriginalDiscountPriceElement = (element: HTMLElement): boolean => {
  const className = (element.className || "").toString().toLowerCase();

  if (
    className.includes("discount_original_price") ||
    className.includes("original_price") ||
    className.includes("regular_price") ||
    className.includes("regprice") ||
    className.includes("list_price")
  ) {
    return true;
  }

  if (className.includes("normal_price") && element.closest(".Discounted, .discount_block")) {
    return true;
  }

  return hasLineThrough(element);
};

const parsePriceText = (text: string): number | null => {
  let clean = text.split(/\r?\n/)[0].replace(/[^-0-9.,]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  if (lastComma > lastDot) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    clean = clean.replace(/,/g, "");
  }

  const price = parseFloat(clean);
  return price && !isNaN(price) ? price : null;
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getElementTextWithoutConvertedPrices = (element: HTMLElement): string => {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
  return clone.textContent ? clone.textContent.trim() : "";
};

const withObserverPaused = (callback: () => void) => {
  observerPauseDepth += 1;
  if (observerPauseDepth === 1) {
    domObserver?.disconnect();
  }

  try {
    callback();
  } finally {
    observerPauseDepth -= 1;
    if (observerPauseDepth === 0 && domObserver && document.body) {
      domObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-price-final"],
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }
};

const isInjectedPriceNode = (node: Node): boolean => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  return !!element?.closest(".steam-rub-price");
};

const isOwnPriceMutation = (mutation: MutationRecord): boolean => {
  if (mutation.type === "childList") {
    const changedNodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    const targetElement = mutation.target instanceof HTMLElement ? mutation.target : null;
    const removedOnlyInjectedPrice =
      mutation.addedNodes.length === 0 &&
      mutation.removedNodes.length > 0 &&
      Array.from(mutation.removedNodes).every(isInjectedPriceNode);

    if (removedOnlyInjectedPrice && targetElement?.classList.contains("steam-rub-beta-market-price-source")) {
      return false;
    }

    return changedNodes.length > 0 && changedNodes.every(isInjectedPriceNode);
  }

  return isInjectedPriceNode(mutation.target);
};

const sourceCurrencyAliases: Record<string, string[]> = {
  RUB: ["руб", "руб.", "pуб", "RUB", "₽"],
  KZT: ["₸", "KZT"],
  TRY: ["TL", "TRY", "₺"],
  PHP: ["P", "PHP", "₱"],
  CNY: ["CNY", "CN¥", "RMB", "¥"],
  PEN: ["S/.", "S/", "PEN"],
  ZAR: ["R", "ZAR"],
};

const dynamicBundlePriceSelector = ".dynamic_bundle_description .discount_block[data-price-final] .discount_final_price";
const storePurchaseDropdownPriceSelector = ".game_area_purchase_game_dropdown_menu_container .game_area_purchase_game_dropdown_menu_item_text";
const modernStoreSaleWidgetSelector = ".StoreSalePriceWidgetContainer";
const tagBrowsePriceSelector = ".browse_tag_game_price";
const betaMarketRootSelector = "#CommunityTemplate";

const roundConvertedAmount = (amount: number, currencyCode: string): number => {
  const fractionDigits = getDisplayFractionDigits(currencyCode);
  const multiplier = Math.pow(10, fractionDigits);
  return Math.ceil(amount * multiplier) / multiplier;
};

const formatFallbackCurrency = (amount: number, currencyCode: string): string => {
  const fractionDigits = getDisplayFractionDigits(currencyCode);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch (_) { }

  const info = getCurrencyInfo(currencyCode);
  const symbol = manualCurrencySymbols[currencyCode] || info?.symbol || currencyCode;
  const rounded = amount.toLocaleString('ru-RU', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return symbol.includes("$") ? `${symbol}${rounded}` : `${rounded} ${symbol}`;
};

const normalizeFormattedCurrency = (formatted: string, currencyCode: string): string => {
  let trimmed = formatted.trim();

  formattedCurrencyReplacements[currencyCode]?.forEach(([pattern, replacement]) => {
    trimmed = trimmed.replace(pattern, replacement).trim();
  });

  if (getDisplayFractionDigits(currencyCode) > 0) return trimmed;

  return trimmed
    .replace(/([,.])00(?=\s*[^\d\s]*$)/, "")
    .replace(/[,.]00$/, "")
    .trim();
};

const formatConvertedPrice = (price: number): string | null => {
  if (!valute) return null;

  const targetCurrency = getTargetCurrency();
  if (valute === targetCurrency) return null;

  const rates = getConversionRates();
  if (!rates) return null;

  const convertedPrice = roundConvertedAmount((price / rates.sourceRate) * rates.targetRate, targetCurrency);
  const convertedMinorUnits = Math.ceil(convertedPrice * 100);
  let formatted: string | null = null;
  try { formatted = window.v_currencyformat?.(convertedMinorUnits, targetCurrency); } catch (_) { }
  if (!formatted) formatted = formatFallbackCurrency(convertedPrice, targetCurrency);

  return normalizeFormattedCurrency(formatted, targetCurrency);
};

type CurrencyConfidence =
  | "session-cache"
  | "meta"
  | "wallet-global"
  | "store-single-currency-scan"
  | "leaf-token"
  | "data-price";

type ParsedCurrencyPrice = {
  amount: number;
  currencyCode: string;
  token: string;
  confidence: CurrencyConfidence;
};

type SourceCurrencyPriceMatch = ParsedCurrencyPrice & {
  text: string;
  start: number;
  end: number;
  price: number;
};

const getDefaultCurrencySign = (currencyCode: string): string | null => {
  const currencyInfo = getCurrencyInfo(currencyCode);
  if (currencyInfo?.symbol?.trim()) return currencyInfo.symbol.trim();

  const alias = sourceCurrencyAliases[currencyCode]?.find(token => token.trim());
  if (alias) return alias.trim();

  return Object.keys(signToValute).find(sign => signToValute[sign] === currencyCode) || null;
};

const applySourceCurrency = (currencyCode: string | null | undefined, sign?: string | null, detector?: string): boolean => {
  const normalizedCode = currencyCode?.toString().trim().toUpperCase();
  if (!normalizedCode || !getCurrencyInfo(normalizedCode)) return false;

  valute = normalizedCode;
  valuteSign = sign?.trim() || getDefaultCurrencySign(normalizedCode);
  sourceCurrencyDetector = detector || sourceCurrencyDetector;
  return true;
};

const getCurrencyTokens = (currencyCode: string | null | undefined): string[] => {
  const tokens = new Set<string>();
  const normalizedCode = currencyCode?.toString().trim().toUpperCase();
  if (!normalizedCode) return [];

  tokens.add(normalizedCode);

  const sourceCurrency = getCurrencyInfo(normalizedCode);
  if (sourceCurrency?.symbol?.trim()) tokens.add(sourceCurrency.symbol.trim());

  sourceCurrencyAliases[normalizedCode]?.forEach(token => {
    if (token.trim()) tokens.add(token.trim());
  });

  Object.entries(signToValute).forEach(([sign, code]) => {
    if (code === normalizedCode && sign.trim()) tokens.add(sign.trim());
  });

  return Array.from(tokens).filter(Boolean).sort((a, b) => b.length - a.length);
};

const getSourceCurrencyTokens = (): string[] => {
  const tokens = new Set(getCurrencyTokens(valute));
  if (valuteSign?.trim()) tokens.add(valuteSign.trim());
  return Array.from(tokens).filter(Boolean).sort((a, b) => b.length - a.length);
};

const isCurrencyCodeToken = (token: string): boolean => /^[A-Z]{3}$/.test(token);

const textIncludesCurrencyToken = (text: string, token: string): boolean => {
  if (!token) return false;

  if (isCurrencyCodeToken(token)) {
    return new RegExp(`(^|[^A-Z])${escapeRegExp(token)}([^A-Z]|$)`, "i").test(text);
  }

  return text.includes(token);
};

const textContainsSourceCurrency = (text: string): boolean => {
  return getSourceCurrencyTokens().some(token => textIncludesCurrencyToken(text, token));
};

const getCurrencyTokenPattern = (token: string): string => {
  return escapeRegExp(token);
};

const getRawCurrencyPriceMatches = (
  text: string,
  currencyCode: string,
  confidence: CurrencyConfidence = "leaf-token"
): SourceCurrencyPriceMatch[] => {
  const matches: SourceCurrencyPriceMatch[] = [];
  const numberPattern = "\\d[\\d\\s.,]*";

  getCurrencyTokens(currencyCode).forEach(token => {
    const tokenPattern = getCurrencyTokenPattern(token);
    const patterns = [
      {
        pattern: new RegExp(`(^|[^A-Za-z])(${tokenPattern})\\s*(${numberPattern})`, "gi"),
        priceGroup: 3,
        tokenGroup: 2,
        startOffsetGroup: 1,
      },
      {
        pattern: new RegExp(`(^|[^\\dA-Za-z])(${numberPattern})\\s*(${tokenPattern})(?=$|[^A-Za-z])`, "gi"),
        priceGroup: 2,
        tokenGroup: 3,
        startOffsetGroup: 1,
      },
    ];

    patterns.forEach(({ pattern, priceGroup, tokenGroup, startOffsetGroup }) => {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const boundaryOffset = match[startOffsetGroup]?.length || 0;
        const rawMatch = match[0].slice(boundaryOffset);
        const price = parsePriceText(match[priceGroup]);
        if (price !== null) {
          matches.push({
            text: rawMatch.trim(),
            start: match.index + boundaryOffset,
            end: match.index + match[0].length,
            price,
            amount: price,
            currencyCode,
            token: match[tokenGroup],
            confidence,
          });
        }

        if (match.index === pattern.lastIndex) {
          pattern.lastIndex += 1;
        }
      }
    });
  });

  return matches;
};

const doRangesOverlap = (a: SourceCurrencyPriceMatch, b: SourceCurrencyPriceMatch): boolean => {
  return a.start < b.end && b.start < a.end;
};

const normalizeMatchedPriceText = (text: string): string => {
  return text.replace(/\s+/g, " ").trim();
};

const dedupeCurrencyPriceMatches = (matches: SourceCurrencyPriceMatch[]): SourceCurrencyPriceMatch[] => {
  const sortedMatches = matches.sort((a, b) => {
    const lengthDelta = (b.end - b.start) - (a.end - a.start);
    if (lengthDelta !== 0) return lengthDelta;
    const tokenLengthDelta = b.token.length - a.token.length;
    if (tokenLengthDelta !== 0) return tokenLengthDelta;
    return a.start - b.start;
  });

  const dedupedMatches: SourceCurrencyPriceMatch[] = [];

  sortedMatches.forEach(match => {
    const overlappingMatch = dedupedMatches.find(existing => doRangesOverlap(existing, match));
    if (overlappingMatch) {
      return;
    }

    const duplicateMatch = dedupedMatches.find(existing => {
      return (
        existing.start === match.start &&
        existing.end === match.end &&
        existing.price === match.price &&
        normalizeMatchedPriceText(existing.text) === normalizeMatchedPriceText(match.text)
      );
    });

    if (!duplicateMatch) {
      dedupedMatches.push(match);
    }
  });

  return dedupedMatches.sort((a, b) => a.start - b.start);
};

const getCurrencyPriceMatches = (
  text: string,
  currencyCode: string,
  confidence: CurrencyConfidence = "leaf-token"
): SourceCurrencyPriceMatch[] => {
  return dedupeCurrencyPriceMatches(getRawCurrencyPriceMatches(text, currencyCode, confidence));
};

const getSourceCurrencyPriceMatches = (text: string): SourceCurrencyPriceMatch[] => {
  if (!valute) return [];
  return getCurrencyPriceMatches(text, valute, sourceCurrencyDetector === "session-cache" ? "session-cache" : "leaf-token");
};

const getAllCurrencyPriceMatches = (text: string): SourceCurrencyPriceMatch[] => {
  return dedupeCurrencyPriceMatches(
    steamCurrencies.flatMap(steamCurrency => getRawCurrencyPriceMatches(text, steamCurrency.abbr, "leaf-token"))
  );
};

const getConflictingCurrencyPriceMatches = (text: string, expectedCurrency: string): SourceCurrencyPriceMatch[] => {
  const normalizedExpected = expectedCurrency.toUpperCase();
  return getAllCurrencyPriceMatches(text).filter(match => match.currencyCode !== normalizedExpected);
};

const textContainsConflictingCurrencyPrice = (text: string, expectedCurrency: string | null = valute): boolean => {
  if (!expectedCurrency) return false;
  return getConflictingCurrencyPriceMatches(text, expectedCurrency).length > 0;
};

const textContainsSourceCurrencyPrice = (text: string): boolean => {
  return !textContainsConflictingCurrencyPrice(text) && getSourceCurrencyPriceMatches(text).length > 0;
};

const parseSourceCurrencyPrice = (text: string): ParsedCurrencyPrice | null => {
  if (!valute) return null;
  if (textContainsConflictingCurrencyPrice(text, valute)) return null;
  if (!textContainsSourceCurrency(text)) return null;

  const matches = getSourceCurrencyPriceMatches(text);
  if (matches.length !== 1) return null;

  const match = matches[0];
  const remainingText = `${text.slice(0, match.start)}${text.slice(match.end)}`.replace(/\s+/g, " ").trim();
  if (/\d/.test(remainingText)) return null;

  return {
    amount: match.price,
    currencyCode: valute,
    token: match.token,
    confidence: match.confidence,
  };
};

const parseSourceCurrencyPriceText = (text: string): number | null => {
  return parseSourceCurrencyPrice(text)?.amount ?? null;
};

const parseTrailingSourceCurrencyPriceText = (text: string): number | null => {
  if (!valute) return null;
  if (textContainsConflictingCurrencyPrice(text, valute)) return null;

  const trimmedText = text.trim();
  const trailingMatch = getSourceCurrencyPriceMatches(trimmedText).find(match => {
    return match.end === trimmedText.length;
  });

  return trailingMatch?.price ?? null;
};

const getMarketPriceCell = (element: HTMLElement): HTMLElement | null => {
  return element.closest(
    ".market_listing_their_price, .market_listing_price, .market_listing_price_listings_block"
  ) as HTMLElement | null;
};

const isMarketCommodityPriceElement = (element: HTMLElement): boolean => {
  return (
    element.matches(".market_commodity_order_summary .market_commodity_orders_header_promote") ||
    element.matches(".market_commodity_orders_table td:first-child")
  );
};

const isMarketHistoryPriceElement = (element: HTMLElement): boolean => {
  return element.matches("#tabContentsMyMarketHistory .market_listing_price");
};

const isMarketActiveListingPriceElement = (element: HTMLElement): boolean => {
  return element.matches("#tabContentsMyListings .market_listing_price span[title]");
};

const isShoppingCartPage = (): boolean => {
  return !!document.body?.classList.contains("ShoppingCart") || window.location.pathname.includes("/cart");
};

const isWishlistPage = (): boolean => {
  return window.location.pathname.includes("/wishlist");
};

const isReactStorePricePage = (): boolean => {
  return isShoppingCartPage() || isWishlistPage();
};

const isModernStoreCollectionPage = (): boolean => {
  const path = window.location.pathname;
  return (
    path.startsWith("/dlcforyou") ||
    path.startsWith("/category/") ||
    path.startsWith("/charts/") ||
    path.startsWith("/tag/browse")
  );
};

const isMarketRecentListingPriceElement = (element: HTMLElement): boolean => {
  return element.matches(
    "#sellListingsTable .market_listing_price_with_fee, " +
    "#soldListingTable .market_listing_price_with_fee"
  );
};

const isCommunityMarketPage = (): boolean => {
  return window.location.hostname.includes("steamcommunity.com") && window.location.pathname.startsWith("/market");
};

const isBetaCommunityMarketPage = (): boolean => {
  return isCommunityMarketPage() && document.querySelector(betaMarketRootSelector) !== null;
};

const isIgnoredBetaMarketPriceContext = (element: HTMLElement): boolean => {
  return !!element.closest(
    ".steam-rub-price, svg, canvas, script, style, input, textarea, select, option, template, noscript, " +
    ".recharts-wrapper, .recharts-surface, [class*='recharts']"
  );
};

const childContainsSourceCurrencyToken = (element: HTMLElement): boolean => {
  return Array.from(element.children).some(child => {
    return textContainsSourceCurrency(getElementTextWithoutConvertedPrices(child as HTMLElement));
  });
};

const hasDirectConvertedPrice = (element: HTMLElement): boolean => {
  return Array.from(element.children).some(child => child.classList.contains("steam-rub-price"));
};

const isBetaMarketPriceLeaf = (element: HTMLElement): boolean => {
  if (!isBetaCommunityMarketPage()) return false;
  if (element.classList.contains("done") && hasDirectConvertedPrice(element)) return false;
  if (!element.closest(betaMarketRootSelector)) return false;
  if (!element.matches("span, div, td")) return false;
  if (!isElementVisible(element)) return false;
  if (isIgnoredBetaMarketPriceContext(element)) return false;
  if (childContainsSourceCurrencyToken(element)) return false;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!text || text.length > 100) return false;

  return parseSourceCurrencyPriceText(text) !== null;
};

const collectBetaMarketPriceElements = (node: Node): HTMLElement[] => {
  if (!isBetaCommunityMarketPage()) return [];

  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  if (!element) return [];

  const priceElements = new Set<HTMLElement>();

  if (isBetaMarketPriceLeaf(element)) {
    priceElements.add(element);
  }

  if (element.querySelectorAll) {
    element.querySelectorAll("span, div, td").forEach(candidate => {
      if (candidate instanceof HTMLElement && isBetaMarketPriceLeaf(candidate)) {
        priceElements.add(candidate);
      }
    });
  }

  return Array.from(priceElements);
};

const isBetaMarketPriceElement = (element: HTMLElement): boolean => {
  return isBetaMarketPriceLeaf(element);
};

const isDynamicBundlePriceElement = (element: HTMLElement): boolean => {
  return element.closest(".dynamic_bundle_description") !== null;
};

const isElementVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
};

const childContainsSourceCurrency = (element: HTMLElement): boolean => {
  return Array.from(element.children).some(child => {
    return textContainsSourceCurrencyPrice(getElementTextWithoutConvertedPrices(child as HTMLElement));
  });
};

const isModernStorePriceLeaf = (element: HTMLElement): boolean => {
  if (!isElementVisible(element)) return false;
  if (childContainsSourceCurrency(element)) return false;
  if (isOriginalDiscountPriceElement(element)) return false;

  const text = getElementTextWithoutConvertedPrices(element);
  return parseSourceCurrencyPriceText(text) !== null;
};

const collectModernStoreSaleWidgetPriceElements = (widget: HTMLElement): HTMLElement[] => {
  const priceLeaves = Array.from(widget.querySelectorAll("div, span"))
    .filter((candidate): candidate is HTMLElement => {
      return candidate instanceof HTMLElement && isModernStorePriceLeaf(candidate);
    });

  if (priceLeaves.length === 0) return [];
  if (widget.classList.contains("Discounted") && priceLeaves.length > 1) {
    return [priceLeaves[priceLeaves.length - 1]];
  }

  return priceLeaves;
};

const collectModernStorePriceElements = (node: Node): HTMLElement[] => {
  if (!isModernStoreCollectionPage()) return [];

  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  if (!element) return [];

  const priceElements = new Set<HTMLElement>();
  const widgets = new Set<HTMLElement>();

  const closestWidget = element.closest(modernStoreSaleWidgetSelector) as HTMLElement | null;
  if (closestWidget) widgets.add(closestWidget);

  if (element.matches(modernStoreSaleWidgetSelector)) {
    widgets.add(element);
  }

  if (element.querySelectorAll) {
    element.querySelectorAll(modernStoreSaleWidgetSelector).forEach(widget => {
      widgets.add(widget as HTMLElement);
    });
  }

  widgets.forEach(widget => {
    collectModernStoreSaleWidgetPriceElements(widget).forEach(priceElement => {
      priceElements.add(priceElement);
    });
  });

  if (element.matches(tagBrowsePriceSelector) && isModernStorePriceLeaf(element)) {
    priceElements.add(element);
  }

  if (element.querySelectorAll) {
    element.querySelectorAll(tagBrowsePriceSelector).forEach(priceElement => {
      if (isModernStorePriceLeaf(priceElement as HTMLElement)) {
        priceElements.add(priceElement as HTMLElement);
      }
    });
  }

  return Array.from(priceElements);
};

const isModernStorePriceElement = (element: HTMLElement): boolean => {
  if (!isModernStoreCollectionPage()) return false;

  if (element.matches(tagBrowsePriceSelector)) {
    return isModernStorePriceLeaf(element);
  }

  const widget = element.closest(modernStoreSaleWidgetSelector) as HTMLElement | null;
  if (!widget) return false;

  return collectModernStoreSaleWidgetPriceElements(widget).includes(element);
};

const isStorePurchaseDropdownPriceElement = (element: HTMLElement): boolean => {
  if (!location.pathname.startsWith("/app/")) return false;
  if (!element.matches(storePurchaseDropdownPriceSelector)) return false;
  if (!element.closest(".game_area_purchase")) return false;
  if (!element.closest("tr[role='button']")) return false;

  const text = getElementTextWithoutConvertedPrices(element);
  return textContainsSourceCurrencyPrice(text) && parseTrailingSourceCurrencyPriceText(text) !== null;
};

const collectDynamicBundlePriceElements = (node: Node): HTMLElement[] => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  if (!element) return [];

  const priceElements = new Set<HTMLElement>();

  if (element.matches(dynamicBundlePriceSelector)) {
    priceElements.add(element);
  }

  if (element.matches(".dynamic_bundle_description .discount_block[data-price-final]")) {
    const priceElement = element.querySelector(".discount_final_price") as HTMLElement | null;
    if (priceElement) priceElements.add(priceElement);
  }

  const closestPrice = element.closest(dynamicBundlePriceSelector) as HTMLElement | null;
  if (closestPrice) {
    priceElements.add(closestPrice);
  }

  if (element.querySelectorAll) {
    element.querySelectorAll(dynamicBundlePriceSelector).forEach(priceElement => {
      priceElements.add(priceElement as HTMLElement);
    });
  }

  return Array.from(priceElements);
};

const isCartPriceElement = (element: HTMLElement): boolean => {
  if (!isReactStorePricePage()) return false;
  if (element.classList.contains("done")) return false;
  if (isOriginalDiscountPriceElement(element)) return false;
  if (element.closest(".StoreSalePriceWidgetContainer")) return false;
  if (element.closest(".DialogDropDown")) return false;
  if (element.children.length > 0) return false;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!text || !textContainsSourceCurrencyPrice(text)) return false;
  if (parseSourceCurrencyPriceText(text) === null) return false;

  const parent = element.parentElement;
  if (!parent) return false;

  const priceChildren = Array.from(parent.children).filter((child): child is HTMLElement => {
    const childElement = child as HTMLElement;
    if (childElement.children.length > 0) return false;
    if (isOriginalDiscountPriceElement(childElement)) return false;

    const childText = getElementTextWithoutConvertedPrices(childElement);
    return !!childText && parseSourceCurrencyPriceText(childText) !== null;
  });

  if (priceChildren.length === 0) return false;

  return priceChildren.includes(element);
};

const injectStandaloneMarketPrice = (element: HTMLElement, extraClassName: string = "") => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;

  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!textContainsSourceCurrencyPrice(text)) return;

  const price = getDataPriceFinal(element) ?? parseSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = `steam-rub-price is-market-price ${extraClassName}`.trim();
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.classList.add("done", "steam-rub-market-price-source");
    element.appendChild(span);
  });
};

const injectMarketCommodityPrice = (element: HTMLElement) => {
  injectStandaloneMarketPrice(element, "is-market-commodity-price");
};

const injectBetaMarketPrice = (element: HTMLElement) => {
  if (element.classList.contains("done") && hasDirectConvertedPrice(element)) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  const price = parseSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price is-market-price steam-rub-beta-market-price";
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
    element.classList.add("done", "steam-rub-market-price-source", "steam-rub-beta-market-price-source");
    element.appendChild(span);
  });
};

const resetDynamicBundlePrice = (element: HTMLElement) => {
  withObserverPaused(() => {
    element.querySelectorAll(".steam-rub-dynamic-bundle-price").forEach(el => el.remove());
    element.querySelectorAll(".steam-rub-dynamic-bundle-line").forEach(el => el.classList.remove("steam-rub-dynamic-bundle-line"));
    element.classList.remove("steam-rub-dynamic-bundle-done");
  });
};

const shouldUseDiscountedDynamicBundleStyle = (priceContainer: HTMLElement): boolean => {
  const discount = Number(priceContainer.dataset?.discount || priceContainer.getAttribute("data-discount") || 0);
  return discount > 0 || priceContainer.querySelector(".discount_pct") !== null;
};

const injectDynamicBundlePrice = (element: HTMLElement) => {
  if (element.classList.contains("steam-rub-dynamic-bundle-done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const priceContainer = element.closest(".discount_block[data-price-final]") as HTMLElement | null;
  if (!priceContainer) return;

  const price = getDataPriceFinal(priceContainer);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price steam-rub-dynamic-bundle-price";
  if (shouldUseDiscountedDynamicBundleStyle(priceContainer)) {
    span.classList.add("is-discounted");
  }
  span.textContent = `≈${formatted}`;
  const priceLine = Array.from(element.children).find(child => {
    const childElement = child as HTMLElement;
    return !childElement.classList.contains("your_price_label") && textContainsSourceCurrencyPrice(childElement.textContent || "");
  }) as HTMLElement | undefined;

  withObserverPaused(() => {
    element.classList.add("steam-rub-dynamic-bundle-done");
    priceLine?.classList.add("steam-rub-dynamic-bundle-line");
    (priceLine || element).appendChild(span);
  });
};

const injectStorePurchaseDropdownPrice = (element: HTMLElement) => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!textContainsSourceCurrencyPrice(text)) return;

  const price = parseTrailingSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price steam-rub-dropdown-price";
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.classList.add("done", "steam-rub-dropdown-price-source");
    element.appendChild(span);
  });
};

const injectModernStorePrice = (element: HTMLElement) => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!textContainsSourceCurrencyPrice(text)) return;

  const price = parseSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price steam-rub-modern-store-price";
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.classList.add("done", "steam-rub-modern-store-price-source");
    element.appendChild(span);
  });
};

const injectCartPrice = (element: HTMLElement) => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!textContainsSourceCurrencyPrice(text)) return;

  const price = getDataPriceFinal(element) ?? parseSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price";
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.classList.add("done", "steam-rub-cart-price-source");
    element.appendChild(span);
  });
};

const injectMarketPrice = (cell: HTMLElement) => {
  if (cell.classList.contains("steam-rub-market-done")) return;
  if (!currency || !valute || valute === getTargetCurrency()) return;

  if (!getConversionRates()) return;

  withObserverPaused(() => {
    cell.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
    cell.querySelectorAll(".steam-rub-market-source-hidden").forEach(el => el.classList.remove("steam-rub-market-source-hidden"));
    cell.querySelectorAll(".done").forEach(el => el.classList.remove("done"));
  });

  const valueContainer = cell.querySelector(".market_table_value") as HTMLElement || cell;
  const priceElement = valueContainer.querySelector(".normal_price[data-price], .normal_price:not(.market_table_value)") as HTMLElement || valueContainer;
  const text = getElementTextWithoutConvertedPrices(priceElement);
  if (!textContainsSourceCurrencyPrice(text)) return;

  const price = getDataPriceFinal(priceElement) ?? parseSourceCurrencyPriceText(text);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price is-market-price";
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    priceElement.classList.add("steam-rub-market-price-source", "steam-rub-market-list-price-source");
    priceElement.appendChild(span);
    cell.classList.add("steam-rub-market-done");
  });
};

// --- Currency Detection ---
type SourceCurrencyDetection = {
  currency: string;
  sign: string | null;
  detector: "meta" | "wallet-global" | "store-single-currency-scan";
  confidence: CurrencyConfidence;
};

const parseCallableResponse = (response: any): any => {
  return typeof response === "string" ? JSON.parse(response) : response;
};

const sourceCurrencyFromSessionPayload = (payload: any): SourceCurrencyDetection | null => {
  const data = payload?.data ?? payload;
  const currencyCode = data?.currency ?? data?.sourceCurrency ?? data?.code;
  const normalizedCode = currencyCode?.toString().trim().toUpperCase();
  if (!normalizedCode || !getCurrencyInfo(normalizedCode)) return null;

  return {
    currency: normalizedCode,
    sign: data?.sign || getDefaultCurrencySign(normalizedCode),
    detector: "store-single-currency-scan",
    confidence: "session-cache",
  };
};

const loadSessionSourceCurrency = async (): Promise<boolean> => {
  if (valute && valuteSign) return true;

  try {
    const response = parseCallableResponse(await GetSessionSourceCurrency());
    const cachedSource = sourceCurrencyFromSessionPayload(response);
    if (cachedSource && applySourceCurrency(cachedSource.currency, cachedSource.sign, "session-cache")) {
      console.log(`[Steam RUB Converter] Currency via session cache: ${valute} (${valuteSign})`);
      return true;
    }
  } catch (e) {
    console.warn("[Steam RUB Converter] Failed to read session source currency cache:", e);
  }

  return false;
};

const lockSessionSourceCurrency = async (detection: SourceCurrencyDetection): Promise<boolean> => {
  try {
    const response = parseCallableResponse(await SetSessionSourceCurrencyOnce({
      currency: JSON.stringify({
        currency: detection.currency,
        sign: detection.sign || getDefaultCurrencySign(detection.currency) || "",
        detector: detection.detector,
        confidence: detection.confidence,
        url: window.location.href,
      }),
    }));

    const sessionSource = sourceCurrencyFromSessionPayload(response);
    if (sessionSource && applySourceCurrency(sessionSource.currency, sessionSource.sign, response?.locked ? detection.detector : "session-cache")) {
      console.log(`[Steam RUB Converter] Currency via ${response?.locked ? detection.detector : "session cache"}: ${valute} (${valuteSign})`);
      return true;
    }
  } catch (e) {
    console.warn("[Steam RUB Converter] Failed to lock session source currency; using local page value only:", e);
  }

  if (applySourceCurrency(detection.currency, detection.sign, detection.detector)) {
    console.log(`[Steam RUB Converter] Currency via ${detection.detector}: ${valute} (${valuteSign})`);
    return true;
  }

  return false;
};

const isStoreHostname = (): boolean => {
  return window.location.hostname.includes("store.steampowered.com");
};

const storeSourceCurrencyScanSelectors = [
  ".discount_final_price",
  ".price",
  ".game_purchase_price",
  ".search_price",
  ".sale_price",
  ".package_totals_area .price",
  ".package_totals_area .discount_final_price",
  ".package_header_container .discount_final_price",
  ".bundle_final_package_price",
  ".bundle_final_price_with_discount",
  modernStoreSaleWidgetSelector,
  tagBrowsePriceSelector,
];

const ambiguousFirstLockTokens = new Set(["P", "R", "¥"]);

const isAmbiguousFirstLockToken = (token: string): boolean => {
  return ambiguousFirstLockTokens.has(token.trim());
};

const detectCurrencyViaStorePriceScan = (): SourceCurrencyDetection | null => {
  if (!isStoreHostname()) return null;

  const observedTokensByCurrency = new Map<string, Set<string>>();

  storeSourceCurrencyScanSelectors.forEach(selector => {
    let elements: Element[] = [];
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (_) {
      return;
    }

    elements.forEach(element => {
      if (!(element instanceof HTMLElement)) return;
      if (!isElementVisible(element)) return;
      if (isOriginalDiscountPriceElement(element)) return;
      if (element.closest("#header_wallet_balance, #marketWalletBalanceAmount")) return;

      const text = getElementTextWithoutConvertedPrices(element);
      if (!text || text.length > 240) return;

      const matches = getAllCurrencyPriceMatches(text);
      if (matches.length === 0) return;

      const currenciesInElement = new Set(matches.map(match => match.currencyCode));
      if (currenciesInElement.size !== 1) {
        currenciesInElement.forEach(currencyCode => {
          if (!observedTokensByCurrency.has(currencyCode)) observedTokensByCurrency.set(currencyCode, new Set());
          observedTokensByCurrency.get(currencyCode)?.add("__mixed__");
        });
        return;
      }

      const currencyCode = matches[0].currencyCode;
      if (!observedTokensByCurrency.has(currencyCode)) {
        observedTokensByCurrency.set(currencyCode, new Set());
      }
      matches.forEach(match => observedTokensByCurrency.get(currencyCode)?.add(match.token.trim()));
    });
  });

  if (observedTokensByCurrency.size !== 1) return null;

  const [currencyCode, tokens] = Array.from(observedTokensByCurrency.entries())[0];
  if (tokens.has("__mixed__")) return null;
  if (tokens.size === 0 || Array.from(tokens).every(isAmbiguousFirstLockToken)) return null;

  return {
    currency: currencyCode,
    sign: getDefaultCurrencySign(currencyCode),
    detector: "store-single-currency-scan",
    confidence: "store-single-currency-scan",
  };
};

const grabCurrentCurrency = async (): Promise<boolean> => {
  if (valute && valuteSign) return true;
  if (await loadSessionSourceCurrency()) return true;

  const meta = document.querySelector('meta[itemprop="priceCurrency"]') as HTMLMetaElement;
  if (meta?.content) {
    const detectedCurrency = meta.content.toString().trim().toUpperCase();
    if (getCurrencyInfo(detectedCurrency)) {
      return lockSessionSourceCurrency({
        currency: detectedCurrency,
        sign: getDefaultCurrencySign(detectedCurrency),
        detector: "meta",
        confidence: "meta",
      });
    }
  }

  if (typeof window.g_rgWalletInfo !== 'undefined' && window.g_rgWalletInfo.wallet_currency) {
    const wallet = findCurrencyById(window.g_rgWalletInfo.wallet_currency);
    if (wallet) {
      return lockSessionSourceCurrency({
        currency: wallet.abbr,
        sign: wallet.symbol || getDefaultCurrencySign(wallet.abbr),
        detector: "wallet-global",
        confidence: "wallet-global",
      });
    }
  }

  const storeScanDetection = detectCurrencyViaStorePriceScan();
  if (storeScanDetection) {
    return lockSessionSourceCurrency(storeScanDetection);
  }

  return false;
};

// --- Price Injection ---
const injectPrice = (element: HTMLElement) => {
  if (!currency || !valute) return;

  if (isBetaMarketPriceElement(element)) {
    injectBetaMarketPrice(element);
    return;
  }

  if (element.classList.contains("done")) return;

  if (isDynamicBundlePriceElement(element)) return;
  if (isOriginalDiscountPriceElement(element)) return;

  if (isStorePurchaseDropdownPriceElement(element)) {
    injectStorePurchaseDropdownPrice(element);
    return;
  }

  if (isModernStorePriceElement(element)) {
    injectModernStorePrice(element);
    return;
  }

  if (isCartPriceElement(element)) {
    injectCartPrice(element);
    return;
  }

  if (isMarketActiveListingPriceElement(element)) {
    injectStandaloneMarketPrice(element, "is-market-active-listing-price");
    return;
  }

  if (isMarketRecentListingPriceElement(element)) {
    injectStandaloneMarketPrice(element, "is-market-recent-listing-price");
    return;
  }

  if (isMarketHistoryPriceElement(element)) {
    injectStandaloneMarketPrice(element, "is-market-history-price");
    return;
  }

  if (isMarketCommodityPriceElement(element)) {
    injectMarketCommodityPrice(element);
    return;
  }

  const marketPriceCell = getMarketPriceCell(element);
  if (marketPriceCell) {
    injectMarketPrice(marketPriceCell);
    return;
  }

  const text = element.textContent ? element.textContent.trim() : "";
  const dataPriceFinal = getDataPriceFinal(element);
  if (!text && dataPriceFinal === null) return;
  if (text && textContainsConflictingCurrencyPrice(text)) return;

  // Recurse into children that contain the currency sign, rather than processing a parent container.
  const childrenWithSign = Array.from(element.children).filter(c => {
    if (isOriginalDiscountPriceElement(c as HTMLElement)) return false;

    const t = c.textContent || "";
    return textContainsSourceCurrencyPrice(t);
  });
  if (childrenWithSign.length > 0) {
    childrenWithSign.forEach(c => {
      (c as HTMLElement).classList.remove("done");
      injectPrice(c as HTMLElement);
    });
    return;
  }

  // Skip if this element doesn't directly contain a recognizable price signal.
  if (!textContainsSourceCurrencyPrice(text) && dataPriceFinal === null) return;
  // Skip native target currency or excluded classes
  if (valute === getTargetCurrency()) return;
  if (hasDirectChildClass(element, "your_price_label")) return;
  const cls = element.className || "";
  if (
    cls.includes("discount_pct") ||
    cls.includes("discount_prices") ||
    cls.includes("discount_block") ||
    cls.includes("es-converted")
  ) return;

  if (!getConversionRates()) {
    return;
  }

  // Parse price
  let price: number | null = null;
  if (dataPriceFinal !== null) {
    price = dataPriceFinal;
  } else {
    price = parseSourceCurrencyPriceText(text);
  }

  if (!price || isNaN(price)) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  // Inject the span
  const span = document.createElement("span");
  span.className = "steam-rub-price";
  // Identify if this is a sale price to apply conditional styling (green color)
  const isSale = !!(
    element.closest('.discount_block:not(.no_discount)') ||
    element.closest('.Discounted') ||
    element.closest('.daily_deal_discount') ||
    (element.classList.contains('discount_final_price') && !element.closest('.no_discount'))
  );

  if (isSale) {
    span.classList.add("is-discounted");
  }
  span.textContent = `≈${formatted}`;

  withObserverPaused(() => {
    element.classList.add("done");

    if (element.tagName === "DIV" && !element.style.display) {
      element.style.display = "inline-block";
    }

    element.appendChild(span);
  });
};

// --- Selectors (Store only) ---
const targetSelectors = [
  "#header_wallet_balance",
  "#marketWalletBalanceAmount",
  "div[class*=StoreSalePriceBox]",
  ".game_purchase_price",
  ".game_purchase_action .game_purchase_price",
  ".game_purchase_action_bg .game_purchase_price",
  storePurchaseDropdownPriceSelector,
  ".discount_final_price",
  ".search_price",
  ".price:not(.spotlight_body):not(.similar_grid_price):not(.discount_original_price)",
  ".package_totals_area .price",
  ".package_totals_area .discount_final_price",
  ".package_header_container .discount_final_price",
  ".bundle_final_package_price",
  ".bundle_final_price_with_discount",
  ".bundle_purchase_action_bg .discount_final_price",
  ".bundle_purchase_action_bg .game_purchase_price",
  ".match_subtitle",
  ".game_area_dlc_price:not(:has(> *))",
  ".savings.bundle_savings",
  ".wallet_column",
  ".wht_total",
  ".normal_price:not(.market_table_value)",
  ".sale_price",
  "#tabContentsMyListings .market_listing_price span[title]",
  "#sellListingsTable .market_listing_price_with_fee",
  "#soldListingTable .market_listing_price_with_fee",
  "#tabContentsMyMarketHistory .market_listing_price",
  ".market_commodity_order_summary .market_commodity_orders_header_promote",
  ".market_commodity_orders_table td:first-child",
];

const processElement = (el: HTMLElement) => {
  if (
    isOriginalDiscountPriceElement(el) ||
    hasClassPart(el, "discount_pct") ||
    hasClassPart(el, "discount_prices") ||
    hasClassPart(el, "discount_block")
  ) return;

  if (!isReady) {
    if (!initialQueue.includes(el)) initialQueue.push(el);
    return;
  }
  injectPrice(el);
};

const processFullPage = () => {
  targetSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => processElement(el as HTMLElement));
    } catch (e) {
      console.warn(`[Steam RUB Converter] Selector failed: ${selector}`, e);
    }
  });

  if (isReactStorePricePage()) {
    document.querySelectorAll("body div, body span").forEach(el => {
      if (isCartPriceElement(el as HTMLElement)) {
        processElement(el as HTMLElement);
      }
    });
  }

  collectModernStorePriceElements(document.body).forEach(el => {
    if (!isReady) {
      if (!initialQueue.includes(el)) initialQueue.push(el);
      return;
    }

    injectModernStorePrice(el);
  });

  collectBetaMarketPriceElements(document.body).forEach(el => {
    if (!isReady) {
      if (!initialQueue.includes(el)) initialQueue.push(el);
      return;
    }

    injectBetaMarketPrice(el);
  });

  document.querySelectorAll(dynamicBundlePriceSelector).forEach(el => {
    if (!isReady) {
      if (!initialQueue.includes(el as HTMLElement)) initialQueue.push(el as HTMLElement);
      return;
    }

    injectDynamicBundlePrice(el as HTMLElement);
  });
};

const enqueueProcessElement = (element: HTMLElement) => {
  pendingProcessElements.add(element);

  if (pendingProcessTimer !== null) return;

  pendingProcessTimer = window.setTimeout(() => {
    pendingProcessTimer = null;
    const elements = Array.from(pendingProcessElements);
    pendingProcessElements.clear();
    elements.forEach(el => processElement(el));
  }, 50);
};

const enqueueDynamicBundlePriceElement = (element: HTMLElement) => {
  pendingDynamicBundlePriceElements.add(element);

  if (pendingDynamicBundlePriceTimer !== null) return;

  pendingDynamicBundlePriceTimer = window.setTimeout(() => {
    pendingDynamicBundlePriceTimer = null;
    const elements = Array.from(pendingDynamicBundlePriceElements);
    pendingDynamicBundlePriceElements.clear();
    elements.forEach(el => {
      resetDynamicBundlePrice(el);
      injectDynamicBundlePrice(el);
    });
  }, 50);
};

const matchesAnyTargetSelector = (element: HTMLElement): boolean => {
  return targetSelectors.some(selector => {
    try {
      return element.matches(selector);
    } catch (_) {
      return false;
    }
  });
};

const closestTargetElement = (element: HTMLElement): HTMLElement | null => {
  for (const selector of targetSelectors) {
    try {
      const match = element.closest(selector);
      if (match) return match as HTMLElement;
    } catch (_) { }
  }

  return null;
};

const findProcessableElement = (node: Node): HTMLElement | null => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  if (!element) return null;

  if (isCartPriceElement(element)) {
    return element;
  }

  if (isModernStorePriceElement(element)) {
    return element;
  }

  const modernStorePrice = collectModernStorePriceElements(element)[0];
  if (modernStorePrice) {
    return modernStorePrice;
  }

  if (isBetaMarketPriceElement(element)) {
    return element;
  }

  const betaMarketPrice = collectBetaMarketPriceElements(element)[0];
  if (betaMarketPrice) {
    return betaMarketPrice;
  }

  if (element.matches && matchesAnyTargetSelector(element)) {
    return element;
  }

  return closestTargetElement(element);
};

const handleMutations = (mutations: MutationRecord[]) => {
  if (observerPauseDepth > 0) return;

  const toProcess = new Set<HTMLElement>();
  const dynamicBundlePricesToProcess = new Set<HTMLElement>();

  for (const mutation of mutations) {
    if (isOwnPriceMutation(mutation)) {
      continue;
    }

    collectDynamicBundlePriceElements(mutation.target).forEach(el => {
      dynamicBundlePricesToProcess.add(el);
    });
    collectModernStorePriceElements(mutation.target).forEach(el => {
      toProcess.add(el);
    });
    collectBetaMarketPriceElements(mutation.target).forEach(el => {
      toProcess.add(el);
    });

    if (mutation.type === 'characterData' || mutation.type === 'attributes') {
      const target = findProcessableElement(mutation.target);
      if (target) {
        const marketPriceCell = getMarketPriceCell(target);
        withObserverPaused(() => {
          if (marketPriceCell) {
            marketPriceCell.classList.remove("steam-rub-market-done");
            marketPriceCell.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
            marketPriceCell.querySelectorAll(".steam-rub-market-source-hidden").forEach(el => el.classList.remove("steam-rub-market-source-hidden"));
          }
          target.classList.remove("done");
          target.classList.remove("steam-rub-cart-price-source");
          target.classList.remove("steam-rub-beta-market-price-source");
          target.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
        });
        if (isDynamicBundlePriceElement(target)) {
          collectDynamicBundlePriceElements(target).forEach(el => dynamicBundlePricesToProcess.add(el));
        } else {
          toProcess.add(target);
        }
      }
      continue;
    }

    if (mutation.type === 'childList') {
      const target = findProcessableElement(mutation.target);
      if (target) toProcess.add(target);

      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;

        collectDynamicBundlePriceElements(el).forEach(priceElement => {
          dynamicBundlePricesToProcess.add(priceElement);
        });
        collectModernStorePriceElements(el).forEach(priceElement => {
          toProcess.add(priceElement);
        });
        collectBetaMarketPriceElements(el).forEach(priceElement => {
          toProcess.add(priceElement);
        });

        if (el.matches && matchesAnyTargetSelector(el)) {
          toProcess.add(el);
        }
        if (isReactStorePricePage() && el.querySelectorAll) {
          el.querySelectorAll("div, span").forEach(candidate => {
            if (isCartPriceElement(candidate as HTMLElement)) {
              toProcess.add(candidate as HTMLElement);
            }
          });
        }
        if (el.querySelectorAll) {
          targetSelectors.forEach(selector => {
            try {
              el.querySelectorAll(selector).forEach(t => toProcess.add(t as HTMLElement));
            } catch (_) { }
          });
        }
      });
    }
  }

  dynamicBundlePricesToProcess.forEach(el => enqueueDynamicBundlePriceElement(el));
  toProcess.forEach(el => enqueueProcessElement(el));
};

const scheduleStartupRetry = () => {
  if (startupRetryTimer !== null) return;

  startupRetryTimer = window.setInterval(async () => {
    startupRetryCount += 1;

    if (!valute) {
      await grabCurrentCurrency();
    }

    processFullPage();

    const hasConvertedPrices = document.querySelector(".steam-rub-price") !== null;
    if ((valute === getTargetCurrency()) || hasConvertedPrices || startupRetryCount >= 20) {
      if (startupRetryTimer !== null) {
        window.clearInterval(startupRetryTimer);
        startupRetryTimer = null;
      }
    }
  }, 1000);
};

const getSettingsKey = (rates: any): string => {
  const settings = rates?.settings || {};
  return `${settings.rateSource || "freedom"}:${(settings.targetCurrency || "RUB").toString().toUpperCase()}`;
};

const hasRatePayload = (rates: any): boolean => {
  return !!(rates?.ffin || rates?.exchange_api);
};

const resetConvertedPrices = () => {
  withObserverPaused(() => {
    document.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
    document.querySelectorAll(".done").forEach(el => el.classList.remove("done"));
    document.querySelectorAll(".steam-rub-cart-price-source").forEach(el => el.classList.remove("steam-rub-cart-price-source"));
    document.querySelectorAll(".steam-rub-dropdown-price-source").forEach(el => el.classList.remove("steam-rub-dropdown-price-source"));
    document.querySelectorAll(".steam-rub-modern-store-price-source").forEach(el => el.classList.remove("steam-rub-modern-store-price-source"));
    document.querySelectorAll(".steam-rub-market-done").forEach(el => el.classList.remove("steam-rub-market-done"));
    document.querySelectorAll(".steam-rub-market-price-source").forEach(el => el.classList.remove("steam-rub-market-price-source"));
    document.querySelectorAll(".steam-rub-beta-market-price-source").forEach(el => el.classList.remove("steam-rub-beta-market-price-source"));
    document.querySelectorAll(".steam-rub-dynamic-bundle-done").forEach(el => el.classList.remove("steam-rub-dynamic-bundle-done"));
  });
  processFullPage();
  scheduleStartupRetry();
};

const scheduleSettingsWatch = () => {
  if (settingsWatchTimer !== null) return;

  settingsWatchTimer = window.setInterval(async () => {
    try {
      const nextCurrency = await loadCachedRates();
      const nextSettingsKey = getSettingsKey(nextCurrency);
      if (nextSettingsKey === currentSettingsKey && (hasRatePayload(currency) || !hasRatePayload(nextCurrency))) return;

      currency = nextCurrency;
      currentSettingsKey = nextSettingsKey;
      resetConvertedPrices();
    } catch (e) {
      console.warn("[Steam Currency Converter] Failed to refresh settings:", e);
    }
  }, 15000);
};

// --- Initialization ---
const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
};

const readStoredRates = () => {
  try {
    const raw = window.localStorage.getItem(ratesCacheStorageKey);
    if (!raw) return null;

    const stored = JSON.parse(raw);
    return hasRatePayload(stored) ? stored : null;
  } catch (_) {
    return null;
  }
};

const storeRates = (rates: any) => {
  if (!hasRatePayload(rates)) return;

  try {
    window.localStorage.setItem(ratesCacheStorageKey, JSON.stringify(rates));
  } catch (_) { }
};

const loadCachedRates = async () => {
  try {
    const rawRates = await withTimeout(GetCachedRates(), rateFetchTimeoutMs, "Timed out waiting for cached rates");
    const parsedRates = typeof rawRates === 'string' ? JSON.parse(rawRates) : rawRates;
    storeRates(parsedRates);
    return parsedRates;
  } catch (e) {
    const storedRates = readStoredRates();
    if (storedRates) {
      console.warn("[Steam RUB Converter] Using last cached rates after backend timeout.");
      return storedRates;
    }

    throw e;
  }
};

const scheduleInitializationRetry = () => {
  if (initializationRetryTimer !== null || isReady) return;

  initializationRetryTimer = window.setTimeout(() => {
    initializationRetryTimer = null;
    initializePlugin();
  }, rateFetchRetryMs);
};

const initializePlugin = async () => {
  if (isInitializing || isReady) return;

  isInitializing = true;

  try {
    currency = await loadCachedRates();
    currentSettingsKey = getSettingsKey(currency);
  } catch (e) {
    console.error("[Steam RUB Converter] Failed to get rates from backend:", e);
    isInitializing = false;
    scheduleInitializationRetry();
    return;
  }

  isInitializing = false;

  if (!hasRatePayload(currency)) {
    console.warn("[Steam RUB Converter] Cached rates are not ready yet; retrying.");
    scheduleInitializationRetry();
    return;
  }

  await grabCurrentCurrency();
  isReady = true;
  scheduleSettingsWatch();

  if (valute === getTargetCurrency()) {
    console.log("[Steam Currency Converter] Native target currency — skipping conversion.");
    return;
  }

  initialQueue.forEach(el => injectPrice(el));
  initialQueue = [];
  processFullPage();
  scheduleStartupRetry();
};

const observePriceChanges = () => {
  if (!domObserver || !document.body) return;

  domObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-price-final"],
    childList: true,
    characterData: true,
    subtree: true,
  });
};

const startConverter = (): boolean => {
  if (hasStarted) return true;
  if (!document.body) return false;

  hasStarted = true;
  processFullPage();

  domObserver = new MutationObserver(handleMutations);
  observePriceChanges();

  initializePlugin();
  return true;
};

const startWhenBodyReady = () => {
  if (startConverter()) return;

  let bodyObserver: MutationObserver | null = null;
  const tryStart = () => {
    if (!startConverter()) return;

    document.removeEventListener("DOMContentLoaded", tryStart);
    bodyObserver?.disconnect();
    bodyObserver = null;
  };

  document.addEventListener("DOMContentLoaded", tryStart);

  if (document.documentElement) {
    bodyObserver = new MutationObserver(tryStart);
    bodyObserver.observe(document.documentElement, { childList: true });
  }
};

// --- Entry Point ---
export default function WebkitMain() {
  GM_addStyle(`
    .steam-rub-price {
      font-size: 1em !important;
      font-weight: bold !important;
      margin-left: 3px !important;
      display: inline !important;
      white-space: nowrap;
      vertical-align: baseline;
    }
    .steam-rub-price.is-discounted {
      color: #BEEE11 !important;
    }
    .steam-rub-dynamic-bundle-price {
      display: inline !important;
      margin-left: 3px !important;
      color: #c6d4df !important;
      font-size: 13px !important;
      line-height: 16px !important;
    }
    .steam-rub-dynamic-bundle-price.is-discounted {
      color: inherit !important;
    }
    .dynamic_bundle_description .game_purchase_action,
    .dynamic_bundle_description .game_purchase_action_bg,
    .dynamic_bundle_description .discount_block.game_purchase_discount,
    .dynamic_bundle_description .discount_prices {
      height: auto !important;
      overflow: visible !important;
    }
    .dynamic_bundle_description .discount_prices {
      min-width: 124px !important;
    }
    .dynamic_bundle_description .discount_final_price.your_price {
      min-width: 124px !important;
      white-space: nowrap !important;
    }
    .dynamic_bundle_description .steam-rub-dynamic-bundle-line {
      white-space: nowrap !important;
    }
    .game_area_purchase_game_dropdown_menu_item_text .steam-rub-dropdown-price {
      margin-left: 6px !important;
      color: #8f98a0 !important;
      font-size: 11px !important;
      font-weight: normal !important;
      line-height: inherit !important;
    }
    .game_area_purchase_game_dropdown_selection .steam-rub-dropdown-price {
      display: none !important;
    }
    .steam-rub-modern-store-price {
      display: inline !important;
      margin-left: 4px !important;
      color: inherit !important;
      font-size: 0.92em !important;
      font-weight: inherit !important;
      line-height: inherit !important;
      white-space: nowrap !important;
      vertical-align: baseline !important;
    }
    .steam-rub-price.is-market-price {
      display: inline !important;
      margin-left: 3px !important;
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: inherit !important;
      color: inherit !important;
      white-space: nowrap !important;
      vertical-align: baseline !important;
    }
    .steam-rub-beta-market-price {
      margin-left: 5px !important;
      color: rgba(199, 213, 224, 0.72) !important;
      font-size: 0.92em !important;
      font-weight: inherit !important;
    }
    .steam-rub-beta-market-price-source {
      white-space: nowrap !important;
    }
    .market_listing_their_price .steam-rub-market-list-price-source .steam-rub-price.is-market-price,
    .market_listing_price .steam-rub-market-list-price-source .steam-rub-price.is-market-price,
    .market_listing_price_listings_block .steam-rub-market-list-price-source .steam-rub-price.is-market-price {
      display: block !important;
      margin-left: 0 !important;
      margin-top: 1px !important;
      text-align: center !important;
    }
    .market_listing_their_price .steam-rub-market-list-price-source,
    .market_listing_price .steam-rub-market-list-price-source,
    .market_listing_price_listings_block .steam-rub-market-list-price-source {
      display: inline-block !important;
      text-align: center !important;
    }
    .steam-rub-price.is-market-history-price {
      display: block !important;
      margin-left: 0 !important;
      margin-top: 1px !important;
      text-align: center !important;
    }
    .steam-rub-price.is-market-recent-listing-price {
      display: block !important;
      margin-left: 0 !important;
      margin-top: 1px !important;
      text-align: center !important;
    }
    #tabContentsMyMarketHistory .market_listing_price.steam-rub-market-price-source {
      display: inline-block !important;
      text-align: center !important;
    }
    #sellListingsTable .market_listing_price.steam-rub-market-price-source,
    #soldListingTable .market_listing_price.steam-rub-market-price-source {
      display: inline-block !important;
      text-align: center !important;
    }
    .market_listing_their_price .steam-rub-market-price-source,
    .market_listing_price .steam-rub-market-price-source,
    .market_listing_price_listings_block .steam-rub-market-price-source,
    .market_commodity_order_summary .steam-rub-market-price-source,
    .market_commodity_orders_table .steam-rub-market-price-source {
      white-space: nowrap !important;
    }
    .discount_final_price, .game_purchase_price,
    .game_purchase_action .sale_price,
    .discount_block .sale_price,
    .StoreSalePriceWidgetContainer .sale_price {
      display: inline-block !important;
      width: auto !important;
    }
    .bundle_final_package_price, .bundle_final_price_with_discount {
      display: inline-block !important;
      width: auto !important;
    }
    .discount_pct .steam-rub-price {
      display: none !important;
    }
    .tab_item_discount { width: auto !important; min-width: 120px !important; }
    .home_marketing_message.small .discount_block { height: auto !important; }
    .discount_block_inline { white-space: nowrap !important; display: inline-flex !important; align-items: center; }
  `);

  startWhenBodyReady();
}
