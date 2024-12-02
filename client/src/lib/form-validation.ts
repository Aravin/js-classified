import DOMPurify from 'dompurify';
import { containsBadWords } from './badwords';

export interface FormData {
  title: string;
  description: string;
  price: string;
  location: string;
  category: string;
  phone: string;
  email: string;
}

export interface FormErrors {
  title: string;
  description: string;
  price: string;
  location: string;
  category: string;
  phone: string;
  email: string;
}

export const initialFormData: FormData = {
  title: '',
  description: '',
  price: '',
  location: '',
  category: '',
  phone: '',
  email: ''
};

export const initialErrors: FormErrors = {
  title: '',
  description: '',
  price: '',
  location: '',
  category: '',
  phone: '',
  email: ''
};

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [] // Strip all attributes
  });
}

export function isValidAlphanumericTitle(title: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\s.,!?-]*$/.test(title);
}

export function validateTitle(title: string): string {
  const sanitizedTitle = sanitizeInput(title);
  
  if (!sanitizedTitle) {
    return 'Title is required';
  }

  if (sanitizedTitle.length < 10 || sanitizedTitle.length > 70) {
    return 'Title must be between 10 and 70 characters';
  }

  if (!isValidAlphanumericTitle(sanitizedTitle)) {
    return 'Title must start with a letter or number and contain only alphanumeric characters, spaces, and basic punctuation';
  }

  const titleCheck = containsBadWords(sanitizedTitle);
  if (titleCheck.hasBadWords) {
    return 'Title contains inappropriate content';
  }

  return '';
}

export function validateDescription(description: string): string {
  const sanitizedDesc = sanitizeInput(description);
  
  if (!sanitizedDesc) {
    return 'Description is required';
  }

  if (sanitizedDesc.length > 500) {
    return 'Description must not exceed 500 characters';
  }

  const descCheck = containsBadWords(sanitizedDesc);
  if (descCheck.hasBadWords) {
    return 'Description contains inappropriate content';
  }

  return '';
}

export function validatePrice(price: string): string {
  const priceNum = Number(price);
  if (!price) {
    return 'Price is required';
  }
  if (isNaN(priceNum) || priceNum < 0) {
    return 'Price must be 0 or greater';
  }
  if (priceNum > 999999) {
    return 'Price must not exceed 999,999';
  }
  return '';
}

export function validateLocation(location: string): string {
  return !location ? 'Location is required' : '';
}

export function validateCategory(category: string): string {
  return !category ? 'Category is required' : '';
}

export function validateContact(email: string, phone: string): { email: string; phone: string } {
  const errors = { email: '', phone: '' };

  if (!email && !phone) {
    errors.email = 'Either email or phone is required';
    errors.phone = 'Either email or phone is required';
    return errors;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    errors.phone = 'Please enter a valid 10-digit phone number';
  }

  return errors;
}

export function validateForm(formData: FormData): { isValid: boolean; errors: FormErrors } {
  const errors = { ...initialErrors };
  let isValid = true;

  // Validate all fields
  const titleError = validateTitle(formData.title);
  const descError = validateDescription(formData.description);
  const priceError = validatePrice(formData.price);
  const locationError = validateLocation(formData.location);
  const categoryError = validateCategory(formData.category);
  const contactErrors = validateContact(formData.email, formData.phone);

  if (titleError) {
    errors.title = titleError;
    isValid = false;
  }

  if (descError) {
    errors.description = descError;
    isValid = false;
  }

  if (priceError) {
    errors.price = priceError;
    isValid = false;
  }

  if (locationError) {
    errors.location = locationError;
    isValid = false;
  }

  if (categoryError) {
    errors.category = categoryError;
    isValid = false;
  }

  if (contactErrors.email || contactErrors.phone) {
    errors.email = contactErrors.email;
    errors.phone = contactErrors.phone;
    isValid = false;
  }

  return { isValid, errors };
}

export function hasFormChanges(formData: FormData, initialData: FormData): boolean {
  return (
    formData.title !== initialData.title ||
    formData.description !== initialData.description ||
    formData.price !== initialData.price ||
    formData.location !== initialData.location ||
    formData.category !== initialData.category ||
    formData.phone !== initialData.phone ||
    formData.email !== initialData.email
  );
}