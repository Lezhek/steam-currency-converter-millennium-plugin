(() => {
  const ratesCacheStorageKey = "steam-rub-converter:last-good-rates";
  const sourceCurrencySessionStorageKey = "steam-rub-converter:session-source-currency";
  const earlyPriceClass = "steam-rub-early-price";
  const earlySourceClass = "steam-rub-early-price-source";

  if (window.location.hostname !== "store.steampowered.com") return;
  if (!/^\/(?:[?#].*)?$/.test(window.location.pathname)) return;

  const steamCurrencies = [
    { abbr: "USD", symbol: "$" }, { abbr: "GBP", symbol: "£" }, { abbr: "EUR", symbol: "€" },
    { abbr: "CHF", symbol: "CHF" }, { abbr: "RUB", symbol: "₽" }, { abbr: "PLN", symbol: "zł" },
    { abbr: "BRL", symbol: "R$" }, { abbr: "JPY", symbol: "¥" }, { abbr: "NOK", symbol: "kr" },
    { abbr: "IDR", symbol: "Rp" }, { abbr: "MYR", symbol: "RM" }, { abbr: "PHP", symbol: "₱" },
    { abbr: "SGD", symbol: "S$" }, { abbr: "THB", symbol: "฿" }, { abbr: "VND", symbol: "₫" },
    { abbr: "KRW", symbol: "₩" }, { abbr: "TRY", symbol: "₺" }, { abbr: "UAH", symbol: "₴" },
    { abbr: "MXN", symbol: "Mex$" }, { abbr: "CAD", symbol: "CDN$" }, { abbr: "AUD", symbol: "A$" },
    { abbr: "NZD", symbol: "NZ$" }, { abbr: "CNY", symbol: "¥" }, { abbr: "INR", symbol: "₹" },
    { abbr: "CLP", symbol: "CLP$" }, { abbr: "PEN", symbol: "S/." }, { abbr: "COP", symbol: "COL$" },
    { abbr: "ZAR", symbol: "R" }, { abbr: "HKD", symbol: "HK$" }, { abbr: "TWD", symbol: "NT$" },
    { abbr: "SAR", symbol: "SR" }, { abbr: "AED", symbol: "DH" }, { abbr: "ARS", symbol: "ARS$" },
    { abbr: "ILS", symbol: "₪" }, { abbr: "KZT", symbol: "₸" }, { abbr: "KWD", symbol: "KD" },
    { abbr: "QAR", symbol: "QR" }, { abbr: "CRC", symbol: "₡" }, { abbr: "UYU", symbol: "$U" },
    { abbr: "KGS", symbol: "с" }, { abbr: "TJS", symbol: "SM" }, { abbr: "UZS", symbol: "сум" },
  ];

  const manualCurrencySymbols = {
    RUB: "₽",
    TRY: "₺",
    PHP: "₱",
    CNY: "¥",
    KGS: "с",
    TJS: "SM",
    UZS: "сум",
  };

  const sourceCurrencyAliases = {
    RUB: ["руб", "руб.", "pуб", "RUB", "₽"],
    KZT: ["₸", "KZT"],
    TRY: ["TL", "TRY", "₺"],
    PHP: ["P", "PHP", "₱"],
    CNY: ["CNY", "CN¥", "RMB", "¥"],
    PEN: ["S/.", "S/", "PEN"],
    ZAR: ["R", "ZAR"],
  };

  const formattedCurrencyReplacements = {
    RUB: [[/\s*(?:pуб|руб\.?|RUB|₽)\s*$/i, " ₽"]],
    TRY: [[/^\s*(?:TL|TRY|₺)\s*/i, "₺"], [/\s*(?:TL|TRY|₺)\s*$/i, " ₺"]],
    PHP: [[/^\s*(?:P|PHP|₱)\s*/i, "₱"], [/\s*(?:P|PHP|₱)\s*$/i, " ₱"]],
    CNY: [[/^\s*(?:CNY|CN¥|RMB|¥)\s*/i, "¥"], [/\s*(?:CNY|CN¥|RMB|¥)\s*$/i, " ¥"]],
  };

  const readJson = (storage, key) => {
    try {
      const raw = storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const rates = readJson(window.localStorage, ratesCacheStorageKey);
  const source = readJson(window.sessionStorage, sourceCurrencySessionStorageKey);
  const sourceCurrency = (source?.currency || source?.sourceCurrency || source?.code || "").toString().trim().toUpperCase();
  const targetCurrency = (rates?.settings?.targetCurrency || "RUB").toString().trim().toUpperCase();
  const rateSource = rates?.settings?.rateSource === "exchange_api" ? "exchange_api" : "freedom";

  if (!rates || !sourceCurrency || !targetCurrency || sourceCurrency === targetCurrency) return;

  const currencyInfo = (currencyCode) => steamCurrencies.find(currency => currency.abbr === currencyCode);
  if (!currencyInfo(sourceCurrency) || !currencyInfo(targetCurrency)) return;

  const getFreedomRate = (currencyCode) => {
    if (currencyCode === "RUB") return 1;
    const mobile = rates?.ffin?.data?.mobile;
    if (!Array.isArray(mobile)) return null;

    const direct = mobile.find(rate => rate?.buyCode?.trim() === "RUB" && rate?.sellCode?.trim() === currencyCode);
    if (direct) {
      const parsed = parseFloat(String(direct.buyRate || "").replace(/[^0-9.]/g, ""));
      return parsed > 0 ? parsed : null;
    }

    const reverse = mobile.find(rate => rate?.buyCode?.trim() === currencyCode && rate?.sellCode?.trim() === "RUB");
    if (reverse) {
      const parsed = parseFloat(String(reverse.sellRate || "").replace(/[^0-9.]/g, ""));
      return parsed > 0 ? 1 / parsed : null;
    }

    return null;
  };

  const getExchangeRate = (currencyCode) => {
    if (currencyCode === "RUB") return 1;
    const rate = rates?.exchange_api?.rub?.[currencyCode.toLowerCase()];
    return typeof rate === "number" && rate > 0 ? rate : null;
  };

  const getRate = (currencyCode, sourceName = rateSource) => {
    return sourceName === "exchange_api" ? getExchangeRate(currencyCode) : getFreedomRate(currencyCode);
  };

  const sourceRate = getRate(sourceCurrency) ?? (rateSource === "freedom" ? getExchangeRate(sourceCurrency) : null);
  const targetRate = getRate(targetCurrency) ?? (rateSource === "freedom" ? getExchangeRate(targetCurrency) : null);
  if (!sourceRate || !targetRate) return;

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const getCurrencyTokens = (currencyCode) => {
    const info = currencyInfo(currencyCode);
    const tokens = [currencyCode, info?.symbol, ...(sourceCurrencyAliases[currencyCode] || [])].filter(Boolean);
    return Array.from(new Set(tokens.map(token => token.toString()).filter(Boolean))).sort((a, b) => b.length - a.length);
  };

  const sourceTokens = getCurrencyTokens(sourceCurrency);
  const numberPattern = "\\d[\\d\\s.,]*";
  const sourcePricePatterns = sourceTokens.flatMap(token => {
    const tokenPattern = escapeRegExp(token);
    return [
      new RegExp(`(^|[^A-Za-z])(${tokenPattern})\\s*(${numberPattern})`, "i"),
      new RegExp(`(^|[^\\dA-Za-z])(${numberPattern})\\s*(${tokenPattern})(?=$|[^A-Za-z])`, "i"),
    ];
  });

  const parsePriceText = (text) => {
    let clean = text.split(/\r?\n/)[0].replace(/[^-0-9.,]/g, "");
    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");
    if (lastComma > lastDot) {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > lastComma) {
      clean = clean.replace(/,/g, "");
    }

    const price = parseFloat(clean);
    return price && !Number.isNaN(price) ? price : null;
  };

  const parseSourcePrice = (text) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    for (const pattern of sourcePricePatterns) {
      const match = normalized.match(pattern);
      if (!match) continue;
      const rawPrice = match[3] && !sourceTokens.includes(match[3]) ? match[3] : match[2];
      const price = parsePriceText(rawPrice);
      if (price) return price;
    }
    return null;
  };

  const getOfficialFractionDigits = (currencyCode) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).resolvedOptions().maximumFractionDigits;
    } catch (_) {
      return 2;
    }
  };

  const getDisplayFractionDigits = (currencyCode) => {
    const officialFractionDigits = getOfficialFractionDigits(currencyCode);
    const usdRate = getRate("USD") ?? (rateSource === "freedom" ? getExchangeRate("USD") : null);
    const resolvedTargetRate = getRate(currencyCode) ?? (rateSource === "freedom" ? getExchangeRate(currencyCode) : null);
    return usdRate && resolvedTargetRate && resolvedTargetRate / usdRate >= 10 ? 0 : officialFractionDigits;
  };

  const formatFallbackCurrency = (amount, currencyCode) => {
    const fractionDigits = getDisplayFractionDigits(currencyCode);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(amount);
    } catch (_) {
      const symbol = manualCurrencySymbols[currencyCode] || currencyInfo(currencyCode)?.symbol || currencyCode;
      const rounded = amount.toLocaleString("ru-RU", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
      return symbol.includes("$") ? `${symbol}${rounded}` : `${rounded} ${symbol}`;
    }
  };

  const normalizeFormattedCurrency = (formatted, currencyCode) => {
    let trimmed = formatted.trim();
    (formattedCurrencyReplacements[currencyCode] || []).forEach(([pattern, replacement]) => {
      trimmed = trimmed.replace(pattern, replacement).trim();
    });

    if (getDisplayFractionDigits(currencyCode) > 0) return trimmed;
    return trimmed.replace(/([,.])00(?=\s*[^\d\s]*$)/, "").replace(/[,.]00$/, "").trim();
  };

  const formatConvertedPrice = (price) => {
    const fractionDigits = getDisplayFractionDigits(targetCurrency);
    const multiplier = Math.pow(10, fractionDigits);
    const converted = Math.ceil(((price / sourceRate) * targetRate) * multiplier) / multiplier;
    const minorUnits = Math.ceil(converted * 100);
    let formatted = null;

    try {
      formatted = window.v_currencyformat?.(minorUnits, targetCurrency);
    } catch (_) { }

    return normalizeFormattedCurrency(formatted || formatFallbackCurrency(converted, targetCurrency), targetCurrency);
  };

  const getTextWithoutConvertedPrices = (element) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(".steam-rub-price").forEach(node => node.remove());
    return clone.textContent ? clone.textContent.trim() : "";
  };

  const hasLineThrough = (element) => {
    try {
      const style = window.getComputedStyle(element);
      return `${style.textDecorationLine} ${style.textDecoration}`.includes("line-through");
    } catch (_) {
      return false;
    }
  };

  const isOriginalDiscountPriceElement = (element) => {
    const className = (element.className || "").toString().toLowerCase();
    return (
      className.includes("discount_original_price") ||
      className.includes("original_price") ||
      className.includes("regular_price") ||
      className.includes("regprice") ||
      className.includes("list_price") ||
      hasLineThrough(element)
    );
  };

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  };

  const isInViewport = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  };

  const hasChildSourcePrice = (element) => {
    return Array.from(element.children).some(child => parseSourcePrice(getTextWithoutConvertedPrices(child)));
  };

  const injectEarlyStyle = () => {
    if (document.getElementById("steam-rub-early-style")) return;
    const style = document.createElement("style");
    style.id = "steam-rub-early-style";
    style.textContent = `
      .steam-rub-price.${earlyPriceClass} {
        display: inline !important;
        margin-left: 3px !important;
        font-size: 1em !important;
        font-weight: bold !important;
        white-space: nowrap !important;
        vertical-align: baseline !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const candidateSelectors = [
    ".discount_final_price",
    ".sale_price",
    ".game_purchase_price",
    ".browse_tag_game_price",
    ".StoreSalePriceWidgetContainer span",
    ".StoreSalePriceWidgetContainer div",
  ];

  const processElement = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.classList.contains("done") || element.querySelector(`.${earlyPriceClass}`)) return false;
    if (element.closest(".steam-rub-price, .discount_pct")) return false;
    if (isOriginalDiscountPriceElement(element) || !isVisible(element) || hasChildSourcePrice(element)) return false;

    const text = getTextWithoutConvertedPrices(element);
    if (!text || text.length > 120) return false;

    const price = parseSourcePrice(text);
    if (!price) return false;

    const formatted = formatConvertedPrice(price);
    if (!formatted) return false;

    injectEarlyStyle();
    const span = document.createElement("span");
    span.className = `steam-rub-price ${earlyPriceClass}`;
    span.textContent = `≈${formatted}`;
    element.classList.add("done", earlySourceClass);
    element.appendChild(span);
    return true;
  };

  const processPage = () => {
    let converted = 0;
    const candidates = [];

    for (const selector of candidateSelectors) {
      document.querySelectorAll(selector).forEach(element => candidates.push(element));
    }

    Array.from(new Set(candidates))
      .sort((a, b) => Number(isInViewport(b)) - Number(isInViewport(a)))
      .forEach(element => {
        if (converted >= 80) return;
        if (processElement(element)) converted += 1;
      });

    window.__sccEarlyStoreHome = {
      firstAt: window.__sccEarlyStoreHome?.firstAt || performance.now(),
      lastAt: performance.now(),
      lastConverted: converted,
      totalConverted: document.querySelectorAll(`.${earlyPriceClass}`).length,
      sourceCurrency,
      targetCurrency,
      rateSource,
    };
    return converted;
  };

  let attempts = 0;
  let observer = null;
  const stop = () => {
    if (observer) observer.disconnect();
    observer = null;
  };

  const run = () => {
    attempts += 1;
    processPage();

    const normalConverterStyleLoaded = Array.from(document.querySelectorAll("style:not(#steam-rub-early-style)"))
      .some(style => (style.textContent || "").includes("steam-rub-price"));

    if (normalConverterStyleLoaded || attempts >= 30) {
      stop();
      return;
    }
    window.setTimeout(run, attempts < 8 ? 50 : 150);
  };

  if (document.body) {
    observer = new MutationObserver(() => processPage());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  run();
})();
