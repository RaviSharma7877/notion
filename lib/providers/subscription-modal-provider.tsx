'use client';
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import SubscriptionModal from '@/components/global/subscription-modal';
import type { ProductWithPrices } from '@/lib/queries';

type SubscriptionModalContextType = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
};

const SubscriptionModalContext = createContext<SubscriptionModalContextType>({
  open: false,
  setOpen: () => {},
});

export const useSubscriptionModal = () => {
  return useContext(SubscriptionModalContext);
};

export const SubscriptionModalProvider = ({
  children,
  products,
}: {
  children: ReactNode;
  products: ProductWithPrices[];
}) => {
  const [open, setOpen] = useState(false);

  return (
    <SubscriptionModalContext.Provider value={{ open, setOpen }}>
      {children}
      <SubscriptionModal products={products} />
    </SubscriptionModalContext.Provider>
  );
};
