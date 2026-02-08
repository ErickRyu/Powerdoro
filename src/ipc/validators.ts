/**
 * Input validation functions for IPC messages.
 * All validators are pure functions with no side effects.
 */

const MIN_TIMER_MINUTES = 1;
const MAX_TIMER_MINUTES = 180;
const MAX_RETROSPECT_LENGTH = 1000;
const DATE_PATH_REGEX = /^\d{4}_\d{2}_\d{2}$/;

export interface ValidationResult<T> {
  valid: boolean;
  value: T;
  error?: string;
}

/**
 * Validates timer input from the renderer process.
 * Must be a finite integer between 1 and 180 inclusive.
 */
export function validateTimerInput(value: unknown): ValidationResult<number> {
  if (value === null || value === undefined) {
    return { valid: false, value: 0, error: 'Timer value is required' };
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return { valid: false, value: 0, error: 'Timer value must be a number' };
  }

  if (!Number.isInteger(num)) {
    return { valid: false, value: 0, error: 'Timer value must be a whole number' };
  }

  if (num < MIN_TIMER_MINUTES || num > MAX_TIMER_MINUTES) {
    return {
      valid: false,
      value: 0,
      error: `Timer value must be between ${MIN_TIMER_MINUTES} and ${MAX_TIMER_MINUTES} minutes`,
    };
  }

  return { valid: true, value: num };
}

/**
 * Strips HTML tags from a string.
 */
function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes retrospect text from the renderer process.
 * Must be a non-empty string, HTML tags stripped, max 1000 characters.
 */
export function sanitizeRetrospectText(text: unknown): ValidationResult<string> {
  if (text === null || text === undefined) {
    return { valid: false, value: '', error: 'Retrospect text is required' };
  }

  if (typeof text !== 'string') {
    return { valid: false, value: '', error: 'Retrospect text must be a string' };
  }

  const sanitized = stripHtmlTags(text).trim();

  if (sanitized.length === 0) {
    return { valid: false, value: '', error: 'Retrospect text must not be empty' };
  }

  if (sanitized.length > MAX_RETROSPECT_LENGTH) {
    return {
      valid: false,
      value: '',
      error: `Retrospect text must not exceed ${MAX_RETROSPECT_LENGTH} characters`,
    };
  }

  return { valid: true, value: sanitized };
}

/**
 * Validates a date string used for retrospect file paths.
 * Must match YYYY_MM_DD format with no path traversal characters.
 */
export function isValidDatePath(dateStr: string): boolean {
  if (typeof dateStr !== 'string') {
    return false;
  }

  // Reject any path traversal characters
  if (dateStr.includes('..') || dateStr.includes('/') || dateStr.includes('\\')) {
    return false;
  }

  // Must match strict YYYY_MM_DD format
  if (!DATE_PATH_REGEX.test(dateStr)) {
    return false;
  }

  // Validate that the date components are reasonable
  const [yearStr, monthStr, dayStr] = dateStr.split('_');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}
