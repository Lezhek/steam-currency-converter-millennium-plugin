local http = require("http")
local json = require("json")
local utils = require("utils")
local logger = require("logger")
local millennium = require("millennium")
local fs = require("fs")
local io = require("io")

local RATE_SOURCES = {
    freedom = true,
    exchange_api = true,
}

local FREEDOM_FALLBACK_TARGET_CURRENCIES = {
    AED = true,
    CNY = true,
    EUR = true,
    KGS = true,
    KZT = true,
    RUB = true,
    TJS = true,
    TRY = true,
    USD = true,
    UZS = true,
}

local FIAT_CURRENCIES = {
    AED=true, AFN=true, ALL=true, AMD=true, ANG=true, AOA=true, ARS=true, AUD=true, AWG=true, AZN=true,
    BAM=true, BBD=true, BDT=true, BGN=true, BHD=true, BIF=true, BMD=true, BND=true, BOB=true, BRL=true,
    BSD=true, BTN=true, BWP=true, BYN=true, BZD=true, CAD=true, CDF=true, CHF=true, CLP=true, CNY=true,
    COP=true, CRC=true, CUC=true, CUP=true, CVE=true, CZK=true, DJF=true, DKK=true, DOP=true, DZD=true,
    EGP=true, ERN=true, ETB=true, EUR=true, FJD=true, FKP=true, GBP=true, GEL=true, GHS=true, GIP=true,
    GMD=true, GNF=true, GTQ=true, GYD=true, HKD=true, HNL=true, HRK=true, HTG=true, HUF=true, IDR=true,
    ILS=true, INR=true, IQD=true, IRR=true, ISK=true, JMD=true, JOD=true, JPY=true, KES=true, KGS=true,
    KHR=true, KMF=true, KPW=true, KRW=true, KWD=true, KYD=true, KZT=true, LAK=true, LBP=true, LKR=true,
    LRD=true, LSL=true, LYD=true, MAD=true, MDL=true, MGA=true, MKD=true, MMK=true, MNT=true, MOP=true,
    MRU=true, MUR=true, MVR=true, MWK=true, MXN=true, MYR=true, MZN=true, NAD=true, NGN=true, NIO=true,
    NOK=true, NPR=true, NZD=true, OMR=true, PAB=true, PEN=true, PGK=true, PHP=true, PKR=true, PLN=true,
    PYG=true, QAR=true, RON=true, RSD=true, RUB=true, RWF=true, SAR=true, SBD=true, SCR=true, SDG=true,
    SEK=true, SGD=true, SHP=true, SLE=true, SLL=true, SOS=true, SRD=true, SSP=true, STN=true, SVC=true,
    SYP=true, SZL=true, THB=true, TJS=true, TMT=true, TND=true, TOP=true, TRY=true, TTD=true, TWD=true,
    TZS=true, UAH=true, UGX=true, USD=true, UYU=true, UZS=true, VES=true, VND=true, VUV=true, WST=true,
    XAF=true, XCD=true, XCG=true, XDR=true, XOF=true, XPF=true, XSU=true, YER=true, ZAR=true, ZMW=true,
    ZWG=true, ZWL=true,
}

local DEFAULT_SETTINGS = {
    rateSource = "freedom",
    targetCurrency = "RUB",
}

local cached_rates = {
    ffin = nil,
    exchange_api = nil,
}

local session_source_currency = nil
local early_store_home_hook_id = nil

local function get_plugin_dir()
    local src = debug.getinfo(1, "S").source or ""
    src = src:gsub("^@", "")
    return fs.parent_path(fs.parent_path(src))
end

local function get_settings_path()
    return fs.join(get_plugin_dir(), "settings.json")
end

local function merge_settings(settings)
    local result = {}
    settings = type(settings) == "table" and settings or {}

    for key, value in pairs(DEFAULT_SETTINGS) do
        result[key] = settings[key] ~= nil and settings[key] or value
    end

    if not RATE_SOURCES[result.rateSource] then
        result.rateSource = DEFAULT_SETTINGS.rateSource
    end

    result.targetCurrency = tostring(result.targetCurrency or DEFAULT_SETTINGS.targetCurrency):upper()
    if result.rateSource == "freedom" and not FREEDOM_FALLBACK_TARGET_CURRENCIES[result.targetCurrency] then
        result.targetCurrency = DEFAULT_SETTINGS.targetCurrency
    elseif not FIAT_CURRENCIES[result.targetCurrency] then
        result.targetCurrency = DEFAULT_SETTINGS.targetCurrency
    end

    return result
end

local function load_settings()
    local file = io.open(get_settings_path(), "r")
    if not file then
        return merge_settings({})
    end

    local content = file:read("*a")
    file:close()

    local ok, parsed = pcall(json.decode, content)
    if not ok or type(parsed) ~= "table" then
        logger:warn("Settings file invalid, using defaults")
        return merge_settings({})
    end

    return merge_settings(parsed)
end

local function save_settings(settings)
    local file, err = io.open(get_settings_path(), "w")
    if not file then
        logger:error("Failed to write settings: " .. tostring(err or "unknown"))
        return false
    end

    file:write(json.encode(merge_settings(settings)))
    file:close()
    return true
end

local function fetch_freedom_bank()
    math.randomseed(utils.time())
    local n = tostring(math.random())
    local ffinUrl = "https://bankffin.kz/api/exchange-rates/getRates?" .. n

    local successFfin, ffinRes = pcall(http.get, ffinUrl, { timeout = 10 })
    if successFfin and ffinRes and ffinRes.status == 200 then
        local s, parsed = pcall(json.decode, ffinRes.body)
        if s then
            cached_rates.ffin = parsed
            logger:info("Freedom Bank rates updated successfully")
            return true
        end
    end

    logger:warn("Freedom Bank fetch failed or timed out")
    return false
end

local function fetch_exchange_api()
    local urls = {
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/rub.min.json",
        "https://latest.currency-api.pages.dev/v1/currencies/rub.min.json",
    }

    for _, url in ipairs(urls) do
        local success, res = pcall(http.get, url, { timeout = 10 })
        if success and res and res.status == 200 then
            local ok, parsed = pcall(json.decode, res.body)
            if ok and type(parsed) == "table" and type(parsed.rub) == "table" then
                cached_rates.exchange_api = parsed
                logger:info("exchange-api rates updated successfully")
                return true
            end
        end
    end

    logger:warn("exchange-api fetch failed or timed out")
    return false
end

local function add_currency_code(set, code)
    code = tostring(code or ""):upper():gsub("%s+", "")
    if code ~= "" then
        set[code] = true
    end
end

local function sorted_currency_list(set)
    local result = {}
    for code, enabled in pairs(set) do
        if enabled then
            table.insert(result, code)
        end
    end

    table.sort(result)
    return result
end

local function get_freedom_supported_target_set()
    local set = { RUB = true }

    if cached_rates.ffin and cached_rates.ffin.data and type(cached_rates.ffin.data.mobile) == "table" then
        for _, rate in ipairs(cached_rates.ffin.data.mobile) do
            local buy = tostring(rate.buyCode or ""):upper():gsub("%s+", "")
            local sell = tostring(rate.sellCode or ""):upper():gsub("%s+", "")
            if buy == "RUB" then
                add_currency_code(set, sell)
            elseif sell == "RUB" then
                add_currency_code(set, buy)
            end
        end
    else
        for code, enabled in pairs(FREEDOM_FALLBACK_TARGET_CURRENCIES) do
            if enabled then
                set[code] = true
            end
        end
    end

    return set
end

local function get_exchange_api_supported_target_set()
    local set = { RUB = true }

    if cached_rates.exchange_api and type(cached_rates.exchange_api.rub) == "table" then
        for code, value in pairs(cached_rates.exchange_api.rub) do
            local normalized = tostring(code or ""):upper():gsub("%s+", "")
            if type(value) == "number" and value > 0 and FIAT_CURRENCIES[normalized] then
                add_currency_code(set, normalized)
            end
        end
    end

    return set
end

local function get_supported_target_set(source)
    if source == "exchange_api" then
        return get_exchange_api_supported_target_set()
    end

    return get_freedom_supported_target_set()
end

local function is_supported_target(source, target)
    return get_supported_target_set(source)[target] == true
end

local function normalize_currency_code(code)
    code = tostring(code or ""):upper():gsub("%s+", "")
    if code == "" then
        return nil
    end

    return code
end

local function is_supported_source_currency(code)
    return FIAT_CURRENCIES[code] == true
end

local function normalize_source_currency_payload(payload)
    if type(payload) == "string" then
        local ok, parsed = pcall(json.decode, payload)
        if ok and type(parsed) == "table" then
            payload = parsed
        else
            payload = { currency = payload }
        end
    end

    if type(payload) ~= "table" then
        return nil
    end

    if payload[1] ~= nil then
        if type(payload[1]) == "table" then
            payload = payload[1]
        else
            payload = { currency = payload[1] }
        end
    end

    if type(payload.currency) == "string" then
        local ok, parsed = pcall(json.decode, payload.currency)
        if ok and type(parsed) == "table" then
            payload = parsed
        end
    end

    local code = normalize_currency_code(payload.currency or payload.sourceCurrency or payload.code)
    if not code or not is_supported_source_currency(code) then
        return nil
    end

    return {
        currency = code,
        sign = tostring(payload.sign or ""),
        detector = tostring(payload.detector or "unknown"),
        confidence = tostring(payload.confidence or "unknown"),
        url = tostring(payload.url or ""),
        timestamp = utils.time_ms(),
    }
end

-- Fetch rates from external APIs
function FetchRates()
    logger:info("Updating exchange rates...")

    local freedom_ok = fetch_freedom_bank()
    local exchange_ok = fetch_exchange_api()

    return freedom_ok or exchange_ok
end

-- Return cached rates (fetch if empty)
function GetCachedRates()
    if not cached_rates.ffin or not cached_rates.exchange_api then
        FetchRates()
    end

    cached_rates.settings = load_settings()
    return json.encode(cached_rates)
end

function GetSessionSourceCurrency()
    return json.encode({
        success = true,
        data = session_source_currency,
    })
end

function SetSessionSourceCurrencyOnce(payload)
    if session_source_currency ~= nil then
        return json.encode({
            success = true,
            locked = false,
            data = session_source_currency,
        })
    end

    local normalized = normalize_source_currency_payload(payload)
    if not normalized then
        return json.encode({
            success = false,
            error = "Invalid source currency payload",
            data = session_source_currency,
        })
    end

    session_source_currency = normalized
    logger:info("Session source currency locked: " .. session_source_currency.currency .. " via " .. session_source_currency.detector)

    return json.encode({
        success = true,
        locked = true,
        data = session_source_currency,
    })
end

function GetRateSettings()
    return json.encode({
        success = true,
        data = load_settings(),
    })
end

function GetSupportedTargetCurrencies(payload)
    local source = nil
    if type(payload) == "table" then
        source = payload.source or payload.rateSource
    end

    local settings = load_settings()
    if source == nil then
        source = settings.rateSource
    end

    source = tostring(source)
    if not RATE_SOURCES[source] then
        source = DEFAULT_SETTINGS.rateSource
    end

    if not cached_rates.ffin or not cached_rates.exchange_api then
        FetchRates()
    end

    return json.encode({
        success = true,
        data = {
            source = source,
            currencies = sorted_currency_list(get_supported_target_set(source)),
        },
    })
end

function SetRateSource(payload)
    local source = payload
    if type(payload) == "table" then
        source = payload.source or payload.rateSource
    end

    source = tostring(source)
    if not RATE_SOURCES[source] then
        return json.encode({
            success = false,
            error = "Unknown rate source: " .. source,
            data = load_settings(),
        })
    end

    local settings = load_settings()
    settings.rateSource = source

    if not cached_rates.ffin or not cached_rates.exchange_api then
        FetchRates()
    end

    settings = merge_settings(settings)
    if not is_supported_target(settings.rateSource, settings.targetCurrency) then
        settings.targetCurrency = DEFAULT_SETTINGS.targetCurrency
    end

    if not save_settings(settings) then
        return json.encode({
            success = false,
            error = "Failed to write settings file",
            data = settings,
        })
    end

    return json.encode({
        success = true,
        data = settings,
    })
end

function SetTargetCurrency(payload)
    local target = payload
    if type(payload) == "table" then
        target = payload.currency or payload.targetCurrency
    end

    target = tostring(target or ""):upper()
    local settings = load_settings()

    if not cached_rates.ffin or not cached_rates.exchange_api then
        FetchRates()
    end

    if not is_supported_target(settings.rateSource, target) then
        return json.encode({
            success = false,
            error = "Target currency is not supported by the selected rate source: " .. target,
            data = settings,
        })
    end

    settings.targetCurrency = target
    settings = merge_settings(settings)

    if not save_settings(settings) then
        return json.encode({
            success = false,
            error = "Failed to write settings file",
            data = settings,
        })
    end

    return json.encode({
        success = true,
        data = settings,
    })
end

-- Plugin lifecycle
local function on_load()
    logger:info("Steam RUB Converter backend initialized")
    local early_store_home_path = fs.join(get_plugin_dir(), ".millennium", "Dist", "early-store-home.js"):gsub("\\", "/")
    local ok, hook_id_or_error = pcall(function()
        return millennium.add_browser_js(early_store_home_path, "^https://store\\.steampowered\\.com/?([?#].*)?$")
    end)

    if ok and type(hook_id_or_error) == "number" and hook_id_or_error > 0 then
        early_store_home_hook_id = hook_id_or_error
        logger:info("Early Store home converter registered")
    elseif ok and hook_id_or_error == -1 then
        -- Millennium can return -1 here while the browser hook is still active.
    else
        logger:warn("Early Store home converter registration failed: " .. tostring(hook_id_or_error))
    end

    millennium.ready()
end

local function on_frontend_loaded()
    -- Optional: trigger fetch on frontend load
end

local function on_unload()
    if early_store_home_hook_id ~= nil then
        pcall(function()
            millennium.remove_browser_module(early_store_home_hook_id)
        end)
    end

    logger:info("Steam RUB Converter backend shutting down")
end

return {
    on_load = on_load,
    on_frontend_loaded = on_frontend_loaded,
    on_unload = on_unload,
    FetchRates = FetchRates,
    GetCachedRates = GetCachedRates,
    GetSessionSourceCurrency = GetSessionSourceCurrency,
    SetSessionSourceCurrencyOnce = SetSessionSourceCurrencyOnce,
    GetRateSettings = GetRateSettings,
    GetSupportedTargetCurrencies = GetSupportedTargetCurrencies,
    SetRateSource = SetRateSource,
    SetTargetCurrency = SetTargetCurrency,
}
