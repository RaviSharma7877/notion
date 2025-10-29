import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PriceDto } from './queries';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPrice = (price: Pick<PriceDto, 'unitAmount' | 'currency'>) => {
  if (price.unitAmount === null || price.unitAmount === undefined) {
    return 'N/A';
  }

  const priceString = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency ?? 'USD',
    minimumFractionDigits: 0,
  }).format(price.unitAmount / 100);
  return priceString;
};

export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000/';

  url = url.includes('http') ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  return url;
};

export const postData = async ({
  url,
  data,
}: {
  url: string;
  data?: { price: PriceDto };
}) => {
  console.log('posting,', url, data);
  const res: Response = await fetch(url, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.log('Error in postData', { url, data, res });
    throw Error(res.statusText);
  }
  return res.json();
};

export const toDateTime = (secs: number) => {
  const date = new Date('1970-01-01T00:30:00Z');
  date.setSeconds(secs);
  return date;
};
