import {
  validateTimerInput,
  sanitizeRetrospectText,
  isValidDatePath,
} from '../src/ipc/validators';

describe('validateTimerInput', () => {
  describe('valid inputs', () => {
    it('should accept minimum value of 1 minute', () => {
      const result = validateTimerInput(1);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should accept typical value of 25 minutes', () => {
      const result = validateTimerInput(25);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);
    });

    it('should accept maximum value of 180 minutes', () => {
      const result = validateTimerInput(180);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(180);
    });

    it('should accept numeric string "25" by coercing to number', () => {
      const result = validateTimerInput('25');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(25);
    });
  });

  describe('invalid inputs', () => {
    it('should reject 0', () => {
      const result = validateTimerInput(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('between');
    });

    it('should reject negative numbers', () => {
      const result = validateTimerInput(-1);
      expect(result.valid).toBe(false);
    });

    it('should reject values above 180', () => {
      const result = validateTimerInput(181);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric strings', () => {
      const result = validateTimerInput('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('should reject null', () => {
      const result = validateTimerInput(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined', () => {
      const result = validateTimerInput(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject floating point numbers', () => {
      const result = validateTimerInput(25.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('whole number');
    });

    it('should reject NaN', () => {
      const result = validateTimerInput(NaN);
      expect(result.valid).toBe(false);
    });

    it('should reject Infinity', () => {
      const result = validateTimerInput(Infinity);
      expect(result.valid).toBe(false);
    });
  });
});

describe('sanitizeRetrospectText', () => {
  describe('valid inputs', () => {
    it('should accept normal text', () => {
      const result = sanitizeRetrospectText('Worked on feature X');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('Worked on feature X');
    });

    it('should strip HTML tags from text', () => {
      const result = sanitizeRetrospectText('<b>bold</b> and <script>alert("xss")</script>normal');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('bold and alert("xss")normal');
    });

    it('should trim whitespace', () => {
      const result = sanitizeRetrospectText('  some text  ');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('some text');
    });
  });

  describe('invalid inputs', () => {
    it('should reject null', () => {
      const result = sanitizeRetrospectText(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined', () => {
      const result = sanitizeRetrospectText(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-string types', () => {
      const result = sanitizeRetrospectText(42);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject empty string', () => {
      const result = sanitizeRetrospectText('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only string', () => {
      const result = sanitizeRetrospectText('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject text exceeding 1000 characters', () => {
      const longText = 'a'.repeat(1001);
      const result = sanitizeRetrospectText(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1000');
    });

    it('should accept text at exactly 1000 characters', () => {
      const maxText = 'a'.repeat(1000);
      const result = sanitizeRetrospectText(maxText);
      expect(result.valid).toBe(true);
      expect(result.value.length).toBe(1000);
    });

    it('should reject string that becomes empty after HTML stripping', () => {
      const result = sanitizeRetrospectText('<b></b>');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });
});

describe('isValidDatePath', () => {
  describe('valid dates', () => {
    it('should accept valid date format YYYY_MM_DD', () => {
      expect(isValidDatePath('2024_01_15')).toBe(true);
    });

    it('should accept current-era dates', () => {
      expect(isValidDatePath('2026_02_08')).toBe(true);
    });

    it('should accept boundary month and day values', () => {
      expect(isValidDatePath('2024_12_31')).toBe(true);
    });
  });

  describe('invalid dates', () => {
    it('should reject path traversal with ../', () => {
      expect(isValidDatePath('../etc/passwd')).toBe(false);
    });

    it('should reject path traversal with forward slash', () => {
      expect(isValidDatePath('2024/01/15')).toBe(false);
    });

    it('should reject path traversal with backslash', () => {
      expect(isValidDatePath('2024\\01\\15')).toBe(false);
    });

    it('should reject double dot sequences', () => {
      expect(isValidDatePath('..2024_01_15')).toBe(false);
    });

    it('should reject invalid format with dashes', () => {
      expect(isValidDatePath('2024-01-15')).toBe(false);
    });

    it('should reject month 0', () => {
      expect(isValidDatePath('2024_00_15')).toBe(false);
    });

    it('should reject month 13', () => {
      expect(isValidDatePath('2024_13_15')).toBe(false);
    });

    it('should reject day 0', () => {
      expect(isValidDatePath('2024_01_00')).toBe(false);
    });

    it('should reject day 32', () => {
      expect(isValidDatePath('2024_01_32')).toBe(false);
    });

    it('should reject year below 2000', () => {
      expect(isValidDatePath('1999_01_15')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(isValidDatePath(12345 as unknown as string)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidDatePath('')).toBe(false);
    });

    it('should reject arbitrary strings', () => {
      expect(isValidDatePath('not_a_date')).toBe(false);
    });
  });
});
