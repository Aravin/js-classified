import { config } from "./config";

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(
    config.currency.locale,
    config.currency.options
  ).format(amount);
}

export function getExpiryDate(createdAt: string): string {
  const createdDate = new Date(createdAt);
  const expiryDate = new Date(createdDate);
  expiryDate.setDate(createdDate.getDate() + config.listing.expiryDays);
  
  const today = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) {
    return 'Expired';
  } else if (daysLeft === 0) {
    return 'Expires today';
  } else if (daysLeft === 1) {
    return 'Expires tomorrow';
  } else {
    return `Expires in ${daysLeft} days`;
  }
}