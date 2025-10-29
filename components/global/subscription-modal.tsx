'use client';
import { useSubscriptionModal } from '@/lib/providers/subscription-modal-provider';
import type { PriceDto, ProductWithPrices } from '@/lib/queries';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { formatPrice } from '@/lib/utils';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';

interface SubscriptionModalProps {
  products: ProductWithPrices[];
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ products }) => {
  const { open, setOpen } = useSubscriptionModal();
  const { toast } = useToast();
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);

  const onClickContinue = async (price: PriceDto) => {
    try {
      setPendingPriceId(price.id);
      toast({
        title: 'Checkout is coming soon',
        description: 'Our billing integration is not ready yet. Stay tuned!',
      });
    } catch (error) {
      console.error('Failed to start checkout flow', error);
      toast({
        title: 'Oops! Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setPendingPriceId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to a Pro Plan</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Select a plan to unlock premium features. Billing integration will be
          available soon.
        </DialogDescription>
        {products.length > 0 ? (
          products.map((product) => (
            <div
              className="flex items-center justify-between"
              key={product.id}
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {product.name ?? 'Untitled product'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {product.prices?.map((price) => (
                  <React.Fragment key={price.id}>
                    <strong className="text-3xl text-foreground">
                      {formatPrice(price)}{' '}
                      {price.interval ? (
                        <small className="text-base">
                          / {price.interval.toLowerCase()}
                        </small>
                      ) : null}
                    </strong>
                    <Button
                      onClick={() => onClickContinue(price)}
                      disabled={pendingPriceId === price.id}
                    >
                      {pendingPriceId === price.id ? 'Working…' : 'Upgrade ✨'}
                    </Button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No products found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionModal;
