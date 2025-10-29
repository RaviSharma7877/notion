import React from 'react';

import { SubscriptionModalProvider } from '@/lib/providers/subscription-modal-provider';
import AppStateProvider from '@/lib/providers/state-provider';
import { getActiveProductsWithPrice } from '@/lib/queries';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = async ({ children }) => {
  const { data: products, error } = await getActiveProductsWithPrice();
  const safeProducts = error ? [] : products;
  return (
    <main className="flex over-hidden h-screen">
      <AppStateProvider>
        <SubscriptionModalProvider products={safeProducts}>
          {children}
        </SubscriptionModalProvider>
      </AppStateProvider>
    </main>
  );
};

export default Layout;
