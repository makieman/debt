import React, { createContext, useContext, ReactNode } from 'react';
import { useShopProfile } from './ShopProfileContext';
import { translations, TranslationKey } from '../i18n/strings';

// Function-typed keys that take a parameter
type FunctionTranslationKey = {
  [K in TranslationKey]: typeof translations.en[K] extends (...args: any[]) => string ? K : never
}[TranslationKey];

// String-typed keys (everything else)
type StringTranslationKey = Exclude<TranslationKey, FunctionTranslationKey>;

interface LanguageContextType {
  /** Translate a plain string key */
  t: (key: StringTranslationKey) => string;
  /** Translate a parameterised key (returns the function for you to call) */
  tFn: <K extends FunctionTranslationKey>(key: K) => typeof translations.en[K];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile } = useShopProfile();
  
  const language = profile?.language || 'en';

  /**
   * WHY TWO SEPARATE FUNCTIONS (t and tFn)?
   *
   * Some translations are plain strings: t('appLock') → "App lock"
   * Some are functions that take parameters: tFn('attemptsRemaining')(3) → "3 attempts remaining"
   *
   * Merging them into one function would require a union return type of
   * `string | ((n: number) => string)`, forcing EVERY call site to check
   * whether the result is a string or a function. That defeats the purpose
   * of having typed translations.
   *
   * Keeping them separate means TypeScript knows:
   *   t('appLock')         → always string  ✅
   *   tFn('attemptsRemaining')(3) → always string  ✅
   *   t('attemptsRemaining')  → TypeScript ERROR: wrong function  ✅
   */
  const t = (key: StringTranslationKey): string => {
    const val = (translations[language] as any)[key];
    const fallback = (translations['en'] as any)[key];
    return (typeof val === 'string' ? val : typeof fallback === 'string' ? fallback : key) as string;
  };

  const tFn = <K extends FunctionTranslationKey>(key: K): typeof translations.en[K] => {
    const val = (translations[language] as any)[key];
    const fallback = (translations['en'] as any)[key];
    return (typeof val === 'function' ? val : fallback) as typeof translations.en[K];
  };

  return (
    <LanguageContext.Provider value={{ t, tFn }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
