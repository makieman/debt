import AsyncStorage from '@react-native-async-storage/async-storage';

export type CurrencyCode = 'KES' | 'UGX' | 'TZS' | 'USD';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'D MMM YYYY';
export type ThemeMode = 'light' | 'dark';
export type LanguageCode = 'en' | 'sw';

export interface ShopProfile {
  ownerName: string;
  phone: string;
  theme: ThemeMode;
  currency: CurrencyCode;
  dateFormat: DateFormat;
  language: LanguageCode;
  notificationReminders: boolean;
  notificationDailySummary: boolean;
  notificationNewCustomer: boolean;
  notificationSound: boolean;
  /**
   * ISO 8601 string of the last successful data export, or null if never exported.
   * Stored as a string (not Date) because AsyncStorage serialises everything to
   * JSON — a Date object would serialise as "[object Object]", losing the value.
   * We parse this with formatTransactionDate() only at display time.
   */
  lastExportDate: string | null;
}

const DEFAULT_PROFILE: ShopProfile = {
  ownerName: 'Shop Owner',
  phone: '+254',
  theme: 'dark', // App is currently dark mode
  currency: 'KES',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  notificationReminders: true,
  notificationDailySummary: false,
  notificationNewCustomer: true,
  notificationSound: true,
  lastExportDate: null,
};

const PROFILE_STORAGE_KEY = '@duka_deni_shop_profile';

export const loadShopProfile = async (): Promise<ShopProfile> => {
  try {
    const jsonValue = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
    if (jsonValue != null) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(jsonValue) };
    }
  } catch (e) {
    console.error('Failed to load shop profile from storage', e);
  }
  return DEFAULT_PROFILE;
};

export const saveShopProfile = async (profile: ShopProfile): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(profile);
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save shop profile to storage', e);
  }
};
