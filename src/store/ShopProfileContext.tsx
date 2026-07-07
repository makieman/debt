import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ShopProfile, loadShopProfile, saveShopProfile } from './shopProfile';

interface ShopProfileContextType {
  profile: ShopProfile | null;
  updateProfile: (updates: Partial<ShopProfile>) => Promise<void>;
  isLoading: boolean;
}

const ShopProfileContext = createContext<ShopProfileContextType | undefined>(undefined);

export const ShopProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initProfile = async () => {
      const storedProfile = await loadShopProfile();
      setProfile(storedProfile);
      setIsLoading(false);
    };
    initProfile();
  }, []);

  const updateProfile = async (updates: Partial<ShopProfile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    await saveShopProfile(newProfile);
  };

  return (
    <ShopProfileContext.Provider value={{ profile, updateProfile, isLoading }}>
      {children}
    </ShopProfileContext.Provider>
  );
};

export const useShopProfile = () => {
  const context = useContext(ShopProfileContext);
  if (context === undefined) {
    throw new Error('useShopProfile must be used within a ShopProfileProvider');
  }
  return context;
};
