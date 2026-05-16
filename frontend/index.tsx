import React, { useEffect, useRef, useState } from 'react';
import {
	definePlugin,
	IconsModule,
	callable,
	DropdownItem,
	DialogButton,
	PanelSection,
	PanelSectionRow,
	DialogBodyText,
	SingleDropdownOption,
} from '@steambrew/client';

type RateSource = 'freedom' | 'exchange_api';

interface RateSettings {
	rateSource: RateSource;
	targetCurrency: string;
}

interface BackendResponse<T> {
	success: boolean;
	data: T;
	error?: string;
}

interface SupportedTargetCurrencies {
	source: RateSource;
	currencies: string[];
}

const FetchRates = callable<[], boolean>('FetchRates');
const GetRateSettings = callable<[], string>('GetRateSettings');
const GetSupportedTargetCurrencies = callable<[{ source: RateSource }], string>('GetSupportedTargetCurrencies');
const SetRateSource = callable<[{ source: RateSource }], string>('SetRateSource');
const SetTargetCurrency = callable<[{ currency: string }], string>('SetTargetCurrency');

const sourceOptions: SingleDropdownOption[] = [
	{ data: 'freedom', label: 'Freedom Bank' },
	{ data: 'exchange_api', label: 'exchange-api' },
];

const steamStoreCurrencies: SingleDropdownOption[] = [
	{ data: 'AED', label: 'AED - United Arab Emirates Dirham' },
	{ data: 'AUD', label: 'AUD - Australian Dollar' },
	{ data: 'BRL', label: 'BRL - Brazilian Real' },
	{ data: 'CAD', label: 'CAD - Canadian Dollar' },
	{ data: 'CHF', label: 'CHF - Swiss Franc' },
	{ data: 'CLP', label: 'CLP - Chilean Peso' },
	{ data: 'CNY', label: 'CNY - Chinese Yuan' },
	{ data: 'COP', label: 'COP - Colombian Peso' },
	{ data: 'CRC', label: 'CRC - Costa Rican Colon' },
	{ data: 'EUR', label: 'EUR - Euro' },
	{ data: 'GBP', label: 'GBP - British Pound' },
	{ data: 'HKD', label: 'HKD - Hong Kong Dollar' },
	{ data: 'ILS', label: 'ILS - Israeli New Shekel' },
	{ data: 'IDR', label: 'IDR - Indonesian Rupiah' },
	{ data: 'INR', label: 'INR - Indian Rupee' },
	{ data: 'JPY', label: 'JPY - Japanese Yen' },
	{ data: 'KRW', label: 'KRW - South Korean Won' },
	{ data: 'KWD', label: 'KWD - Kuwaiti Dinar' },
	{ data: 'KZT', label: 'KZT - Kazakhstani Tenge' },
	{ data: 'MXN', label: 'MXN - Mexican Peso' },
	{ data: 'MYR', label: 'MYR - Malaysian Ringgit' },
	{ data: 'NOK', label: 'NOK - Norwegian Krone' },
	{ data: 'NZD', label: 'NZD - New Zealand Dollar' },
	{ data: 'PEN', label: 'PEN - Peruvian Sol' },
	{ data: 'PHP', label: 'PHP - Philippine Peso' },
	{ data: 'PLN', label: 'PLN - Polish Zloty' },
	{ data: 'QAR', label: 'QAR - Qatari Riyal' },
	{ data: 'RUB', label: 'RUB - Russian Ruble' },
	{ data: 'SAR', label: 'SAR - Saudi Riyal' },
	{ data: 'SGD', label: 'SGD - Singapore Dollar' },
	{ data: 'THB', label: 'THB - Thai Baht' },
	{ data: 'TWD', label: 'TWD - New Taiwan Dollar' },
	{ data: 'UAH', label: 'UAH - Ukrainian Hryvnia' },
	{ data: 'USD', label: 'USD - United States Dollar' },
	{ data: 'UYU', label: 'UYU - Uruguayan Peso' },
	{ data: 'VND', label: 'VND - Vietnamese Dong' },
	{ data: 'ZAR', label: 'ZAR - South African Rand' },
];

const currencyLabels = new Map(steamStoreCurrencies.map((option) => [option.data as string, option.label]));
const manualCurrencyNames: Record<string, string> = {
	KGS: 'Kyrgyzstani Som',
	TJS: 'Tajikistani Somoni',
	UZS: 'Uzbekistani Som',
};
const manualCurrencySymbols: Record<string, string> = {
	KGS: 'с',
	TJS: 'SM',
	UZS: 'сум',
};

const getCurrencyName = (currency: string): string | null => {
	if (manualCurrencyNames[currency]) return manualCurrencyNames[currency];

	try {
		const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
		const name = displayNames.of(currency);
		if (typeof name !== 'string') return null;
		return name && name !== currency ? name : null;
	} catch (_) {
		return null;
	}
};

const getCurrencySymbol = (currency: string): string | null => {
	if (manualCurrencySymbols[currency]) return manualCurrencySymbols[currency];

	try {
		const parts = new Intl.NumberFormat('en', {
			style: 'currency',
			currency,
			currencyDisplay: 'narrowSymbol',
			maximumFractionDigits: 0,
		}).formatToParts(1);
		const symbol = parts.find((part) => part.type === 'currency')?.value;
		return symbol && symbol !== currency ? symbol : null;
	} catch (_) {
		return null;
	}
};

const getCurrencyLabel = (currency: string): string => {
	const existing = currencyLabels.get(currency);
	if (typeof existing === 'string') {
		const symbol = getCurrencySymbol(currency);
		return symbol ? existing.replace(' - ', ` (${symbol}) - `) : existing;
	}

	const name = getCurrencyName(currency);
	const symbol = getCurrencySymbol(currency);
	if (name) return `${currency}${symbol ? ` (${symbol})` : ''} - ${name}`;
	return currency;
};

const getTargetOptions = (currencies: string[]): SingleDropdownOption[] => currencies.map((currency) => ({
	data: currency,
	label: getCurrencyLabel(currency),
}));

const linkStyle = { color: '#66c0f4' };
const annotationStyle = { color: '#8f98a0', fontSize: '12px', marginTop: '8px' };
const statusStyle = { color: '#8f98a0', fontSize: '12px', minHeight: '18px', marginTop: '8px' };
const dropdownValueStyle: React.CSSProperties = {
	display: 'block',
	maxWidth: '100%',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
};

const sourceDescriptions: Record<RateSource, React.ReactNode> = {
	freedom: React.createElement(
		'a',
		{ href: 'https://bankffin.kz/ru/exchange-rates', target: '_blank', rel: 'noreferrer', style: linkStyle },
		'Freedom Bank',
	),
	exchange_api: React.createElement(
		'a',
		{ href: 'https://github.com/fawazahmed0/exchange-api', target: '_blank', rel: 'noreferrer', style: linkStyle },
		'Free Currency Exchange Rates API',
	),
};

const parseBackendResponse = <T,>(raw: string): BackendResponse<T> => JSON.parse(raw) as BackendResponse<T>;

const ConfigurePanel = () => {
	const [rateSource, setRateSourceState] = useState<RateSource>('freedom');
	const [targetCurrency, setTargetCurrencyState] = useState('RUB');
	const [targetCurrencies, setTargetCurrencies] = useState<string[]>(['RUB']);
	const [isBusy, setIsBusy] = useState(false);
	const [status, setStatus] = useState('');
	const mountedRef = useRef(true);
	const targetOptions = getTargetOptions(targetCurrencies);

	const setBusyIfMounted = (value: boolean) => {
		if (mountedRef.current) setIsBusy(value);
	};

	const setStatusIfMounted = (value: string) => {
		if (mountedRef.current) setStatus(value);
	};

	const loadTargetCurrencies = async (source: RateSource): Promise<string[]> => {
		const response = parseBackendResponse<SupportedTargetCurrencies>(await GetSupportedTargetCurrencies({ source }));
		if (!response.success) {
			throw new Error(response.error ?? 'Failed to load target currencies.');
		}

		return response.data.currencies;
	};

	useEffect(() => {
		mountedRef.current = true;

		GetRateSettings()
			.then((raw) => {
				const response = parseBackendResponse<RateSettings>(raw);
				if (!mountedRef.current) return;

				if (response.success) {
					setRateSourceState(response.data.rateSource);
					setTargetCurrencyState(response.data.targetCurrency);
					setStatus('');
					loadTargetCurrencies(response.data.rateSource)
						.then((currencies) => {
							if (mountedRef.current) setTargetCurrencies(currencies);
						})
						.catch((error: unknown) => {
							setStatusIfMounted(error instanceof Error ? error.message : 'Failed to load target currencies.');
						});
				} else {
					setStatus(response.error ?? 'Failed to load settings.');
				}
			})
			.catch((error: unknown) => {
				setStatusIfMounted(error instanceof Error ? error.message : 'Failed to load settings.');
			});

		return () => {
			mountedRef.current = false;
		};
	}, []);

	const saveRateSource = async (source: RateSource) => {
		setStatusIfMounted('');

		try {
			const response = parseBackendResponse<RateSettings>(await SetRateSource({ source }));
			if (!mountedRef.current) return;
			if (!response.success) {
				setStatus(response.error ?? 'Failed to save provider.');
				return;
			}

			setRateSourceState(response.data.rateSource);
			setTargetCurrencyState(response.data.targetCurrency);
			const currencies = await loadTargetCurrencies(response.data.rateSource);
			if (!mountedRef.current) return;
			setTargetCurrencies(currencies);
			if (response.data.targetCurrency !== targetCurrency) {
				setStatus(`Provider saved. Target currency changed to ${response.data.targetCurrency} because of provider support.`);
				return;
			}
			setStatus('');
		} catch (error: unknown) {
			setStatusIfMounted(error instanceof Error ? error.message : 'Failed to save provider.');
		}
	};

	const saveTargetCurrency = async (currency: string) => {
		setStatusIfMounted('');

		try {
			const response = parseBackendResponse<RateSettings>(await SetTargetCurrency({ currency }));
			if (!mountedRef.current) return;
			if (!response.success) {
				setStatus(response.error ?? 'Failed to save target currency.');
				return;
			}

			setRateSourceState(response.data.rateSource);
			setTargetCurrencyState(response.data.targetCurrency);
			setStatus('');
		} catch (error: unknown) {
			setStatusIfMounted(error instanceof Error ? error.message : 'Failed to save target currency.');
		}
	};

	const refreshRates = async () => {
		setBusyIfMounted(true);
		setStatusIfMounted('Refreshing both rate caches...');

		try {
			const ok = await FetchRates();
			if (!mountedRef.current) return;
			setStatus(ok ? 'Both rate caches refreshed successfully.' : 'Rate cache refresh failed.');
			const currencies = await loadTargetCurrencies(rateSource);
			if (mountedRef.current) setTargetCurrencies(currencies);
		} catch (error: unknown) {
			setStatusIfMounted(error instanceof Error ? `Rate cache refresh failed: ${error.message}` : 'Rate cache refresh failed.');
		} finally {
			setBusyIfMounted(false);
		}
	};

	return React.createElement(
		'div',
		{ style: { padding: '20px', color: 'white' } },
		<>
			<PanelSection title="Currency Rates">
				<PanelSectionRow>
					<DropdownItem
						label="Rates source"
						description={sourceDescriptions[rateSource]}
						rgOptions={sourceOptions}
						selectedOption={rateSource}
						disabled={isBusy}
						onChange={(option) => saveRateSource(option.data as RateSource)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<DropdownItem
						label="Convert to"
						layout="below"
						rgOptions={targetOptions}
						selectedOption={targetCurrency}
						disabled={isBusy}
						contextMenuPositionOptions={{ bMatchWidth: true }}
						renderButtonValue={(element) => React.createElement('span', { style: dropdownValueStyle }, element)}
						onChange={(option) => saveTargetCurrency(option.data as string)}
					/>
				</PanelSectionRow>
				<PanelSectionRow>
					<DialogButton disabled={isBusy} onClick={refreshRates}>
						Refresh rate cache
					</DialogButton>
				</PanelSectionRow>
			</PanelSection>
			<DialogBodyText style={annotationStyle}>Rates are updated every 30 minutes.</DialogBodyText>
			<DialogBodyText style={statusStyle}>{status || ' '}</DialogBodyText>
		</>,
	);
};

export default definePlugin(() => {
	// Initial fetch on startup
	FetchRates().catch(console.error);

	// Fetch every 30 minutes in the background
	setInterval(() => {
		FetchRates().catch(console.error);
	}, 30 * 60 * 1000);

	return {
		title: 'Steam RUB Converter',
		icon: <IconsModule.Settings />,
		content: <ConfigurePanel />,
	};
});
