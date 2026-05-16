// == Steam RUB Converter - Millennium Plugin Port ==
import { callable } from '@steambrew/webkit';

declare const window: any;
declare const Millennium: any;

function GM_addStyle(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}


const signToValute: Record<string, string> = {
  "₸": "KZT", "TL": "TRY", "€": "EUR", "£": "GBP", "ARS$": "ARS", "₴": "UAH", "₽": "RUB", "руб": "RUB", "$": "USD",
  "zł": "PLN", "R$": "BRL", "¥": "JPY", "kr": "NOK", "Rp": "IDR", "RM": "MYR", "P": "PHP",
  "S$": "SGD", "฿": "THB", "₫": "VND", "₩": "KRW", "Mex$": "MXN", "CDN$": "CAD", "A$": "AUD",
  "NZ$": "NZD", "₹": "INR", "CLP$": "CLP", "S/.": "PEN", "COL$": "COP", "R ": "ZAR", "HK$": "HKD",
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
    return changedNodes.length > 0 && changedNodes.every(isInjectedPriceNode);
  }

  return isInjectedPriceNode(mutation.target);
};

const dynamicBundlePriceSelector = ".dynamic_bundle_description .discount_block[data-price-final] .discount_final_price";

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

const isMarketRecentListingPriceElement = (element: HTMLElement): boolean => {
  return element.matches(
    "#sellListingsTable .market_listing_price_with_fee, " +
    "#soldListingTable .market_listing_price_with_fee"
  );
};

const isDynamicBundlePriceElement = (element: HTMLElement): boolean => {
  return element.closest(".dynamic_bundle_description") !== null;
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
  if (!text || !valuteSign || !text.includes(valuteSign)) return false;
  if (parsePriceText(text) === null) return false;

  const parent = element.parentElement;
  if (!parent) return false;

  const priceChildren = Array.from(parent.children).filter((child): child is HTMLElement => {
    const childElement = child as HTMLElement;
    if (childElement.children.length > 0) return false;
    if (isOriginalDiscountPriceElement(childElement)) return false;

    const childText = getElementTextWithoutConvertedPrices(childElement);
    return !!childText && !!valuteSign && childText.includes(valuteSign) && parsePriceText(childText) !== null;
  });

  if (priceChildren.length === 0) return false;

  return priceChildren.includes(element);
};

const injectStandaloneMarketPrice = (element: HTMLElement, extraClassName: string = "") => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || !valuteSign || valute === getTargetCurrency()) return;

  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!text.includes(valuteSign)) return;

  const price = getDataPriceFinal(element) ?? parsePriceText(text);
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

const resetDynamicBundlePrice = (element: HTMLElement) => {
  withObserverPaused(() => {
    element.querySelectorAll(".steam-rub-dynamic-bundle-price").forEach(el => el.remove());
    element.querySelectorAll(".steam-rub-dynamic-bundle-line").forEach(el => el.classList.remove("steam-rub-dynamic-bundle-line"));
    element.classList.remove("steam-rub-dynamic-bundle-done");
  });
};

const injectDynamicBundlePrice = (element: HTMLElement) => {
  if (element.classList.contains("steam-rub-dynamic-bundle-done")) return;
  if (!currency || !valute || !valuteSign || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const priceContainer = element.closest(".discount_block[data-price-final]") as HTMLElement | null;
  if (!priceContainer) return;

  const price = getDataPriceFinal(priceContainer);
  if (!price) return;

  const formatted = formatConvertedPrice(price);
  if (!formatted) return;

  const span = document.createElement("span");
  span.className = "steam-rub-price steam-rub-dynamic-bundle-price";
  span.textContent = `≈${formatted}`;
  const priceLine = Array.from(element.children).find(child => {
    const childElement = child as HTMLElement;
    return !childElement.classList.contains("your_price_label") && childElement.textContent?.includes(valuteSign);
  }) as HTMLElement | undefined;

  withObserverPaused(() => {
    element.classList.add("steam-rub-dynamic-bundle-done");
    priceLine?.classList.add("steam-rub-dynamic-bundle-line");
    (priceLine || element).appendChild(span);
  });
};

const injectCartPrice = (element: HTMLElement) => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || !valuteSign || valute === getTargetCurrency()) return;
  if (!getConversionRates()) return;

  const text = getElementTextWithoutConvertedPrices(element);
  if (!text.includes(valuteSign)) return;

  const price = getDataPriceFinal(element) ?? parsePriceText(text);
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
  if (!currency || !valute || !valuteSign || valute === getTargetCurrency()) return;

  if (!getConversionRates()) return;

  withObserverPaused(() => {
    cell.querySelectorAll(".steam-rub-price").forEach(el => el.remove());
    cell.querySelectorAll(".steam-rub-market-source-hidden").forEach(el => el.classList.remove("steam-rub-market-source-hidden"));
    cell.querySelectorAll(".done").forEach(el => el.classList.remove("done"));
  });

  const valueContainer = cell.querySelector(".market_table_value") as HTMLElement || cell;
  const priceElement = valueContainer.querySelector(".normal_price[data-price], .normal_price:not(.market_table_value)") as HTMLElement || valueContainer;
  const text = getElementTextWithoutConvertedPrices(priceElement);
  if (!text.includes(valuteSign)) return;

  const price = getDataPriceFinal(priceElement) ?? parsePriceText(text);
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
const grabCurrentCurrency = async (): Promise<boolean> => {
  if (valute && valuteSign) return true;

  // 1. Meta tag (reliable on Store pages)
  const meta = document.querySelector('meta[itemprop="priceCurrency"]') as HTMLMetaElement;
  if (meta && meta.content) {
    valute = meta.content;
    valuteSign = Object.keys(signToValute).find(k => signToValute[k] === valute) || null;
    if (valute && valuteSign) {
      console.log(`[Steam RUB Converter] Currency via meta: ${valute} (${valuteSign})`);
      return true;
    }
  }

  // 2. Wallet info (reliable on community pages)
  if (typeof window.g_rgWalletInfo !== 'undefined' && window.g_rgWalletInfo.wallet_currency) {
    const wallet = findCurrencyById(window.g_rgWalletInfo.wallet_currency);
    if (wallet) {
      valute = wallet.abbr;
      valuteSign = wallet.symbol;
      console.log(`[Steam RUB Converter] Currency via wallet: ${valute} (${valuteSign})`);
      return true;
    }
  }

  // 3. Scan visible price elements as last resort. React cart/wishlist prices use hashed class names.
  const priceEls = Array.from(document.querySelectorAll('.discount_final_price, .price, .game_purchase_price'));
  if (isReactStorePricePage()) {
    priceEls.push(...Array.from(document.querySelectorAll("body div, body span")));
  }

  for (const el of priceEls) {
    const text = el.textContent || "";
    for (const [sign, code] of Object.entries(signToValute)) {
      if (text.includes(sign)) {
        valuteSign = sign;
        valute = code;
        console.log(`[Steam RUB Converter] Currency via price scan: ${valute} (${valuteSign})`);
        return true;
      }
    }
  }

  return false;
};

// --- Price Injection ---
const injectPrice = (element: HTMLElement) => {
  if (element.classList.contains("done")) return;
  if (!currency || !valute || !valuteSign) return;

  if (isDynamicBundlePriceElement(element)) return;
  if (isOriginalDiscountPriceElement(element)) return;

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

  // Recurse into children that contain the currency sign, rather than processing a parent container.
  const childrenWithSign = Array.from(element.children).filter(c => {
    if (isOriginalDiscountPriceElement(c as HTMLElement)) return false;

    const t = c.textContent || "";
    return t.includes(valuteSign as string);
  });
  if (childrenWithSign.length > 0) {
    childrenWithSign.forEach(c => {
      (c as HTMLElement).classList.remove("done");
      injectPrice(c as HTMLElement);
    });
    return;
  }

  // Skip if this element doesn't directly contain a recognizable price signal.
  if (!text.includes(valuteSign) && dataPriceFinal === null) return;
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
    price = parsePriceText(text);
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
  ".StoreSalePriceWidgetContainer:not(.Discounted) div",
  ".StoreSalePriceWidgetContainer.Discounted div:nth-child(2) > div:nth-child(2)",
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

    if (!valute || !valuteSign) {
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
    document.querySelectorAll(".steam-rub-market-done").forEach(el => el.classList.remove("steam-rub-market-done"));
    document.querySelectorAll(".steam-rub-market-price-source").forEach(el => el.classList.remove("steam-rub-market-price-source"));
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
const GetCachedRates = callable("GetCachedRates");

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
