/**
 * src/utils/strings.test.ts
 *
 * WHY ARE WE TESTING THIS?
 * Name initials are displayed inside a colored circle avatar for every customer in the list.
 * While it seems simple, user inputs are notoriously dirty: users paste leading spaces, input
 * double-spaces, hyphenated names, lowercase text, or completely empty values.
 * If our code crashes on these inputs, the entire list screen crashes, locking the shopkeeper out.
 *
 * DEFENSIVE PROGRAMMING CONCEPT:
 * Defensive programming is the practice of writing code that handles inputs that "should never happen"
 * (such as a null or undefined customer name). In theory, database constraints prevent null names.
 * However, in production, schemas evolve, API contracts drift, database rows get corrupted, or a
 * programmer forgets to pass a parameter. By writing code that handles these cases gracefully instead
 * of crashing, the app remains resilient. A missing initial is a minor visual bug; a crash is a critical failure.
 *
 * JEST CONCEPTS RECAP:
 * - `describe`: Groups the tests for our string utility.
 * - `it`: Specifies a single behavior (e.g. "should handle empty inputs").
 * - `expect(...).toBe(...)`: Asserts that the derived initial matches our expected output.
 */

import { getInitials } from './strings';

describe('String Utilities - getInitials()', () => {

  it('should extract two uppercase initials from a standard full name', () => {
    // "Kamau Wanjiku" -> first letters of the first two words: "KW"
    expect(getInitials('Kamau Wanjiku')).toBe('KW');
  });

  it('should extract one initial from a single name', () => {
    // "John" -> only one word, returns "J"
    expect(getInitials('John')).toBe('J');
  });

  it('should capitalize initials from lowercase input names', () => {
    // "mary jane watson" -> first two initials uppercase -> "MJ" (not "mj")
    expect(getInitials('mary jane watson')).toBe('MJ');
  });

  it('should handle hyphenated names correctly', () => {
    // "Anne-Marie Odhiambo" -> split by whitespace -> ["Anne-Marie", "Odhiambo"] -> "AO"
    expect(getInitials('Anne-Marie Odhiambo')).toBe('AO');
  });

  it('should return an empty string for empty inputs to prevent crashes', () => {
    // "" -> empty name -> "" (no crash)
    expect(getInitials('')).toBe('');
  });

  it('should return an empty string for whitespace-only inputs', () => {
    // "   " -> whitespace only -> "" (no crash)
    expect(getInitials('  ')).toBe('');
  });

  it('should defensively handle null and undefined values gracefully', () => {
    /**
     * Defensive tests: Even if TypeScript says the argument must be a string,
     * compilation is erased at runtime. If a null or undefined value slips in,
     * the code should return an empty string instead of throwing a TypeError.
     */
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
  });
});

/**
 * WHAT BUGS DID THESE TESTS CATCH?
 * 1. String split errors: Without defensive checks, calling `name.trim()` on a null value would throw
 *    `TypeError: Cannot read properties of null (reading 'trim')` and crash the application.
 * 2. Fallback characters: The original implementation returned "?" for empty values.
 *    These tests prove that we've updated it to return "" for empty/whitespace/null values, as required by the UI designs.
 *
 * PASSING FOR THE WRONG REASON VS. GENUINE CORRECTNESS:
 * - A test passing for the wrong reason might happen if `getInitials` simply returned the first two characters of whatever string
 *   was passed. For "John", it would return "Jo" (incorrect, should be "J").
 * - Genuine correctness is proved by testing edge cases (whitespace, lowercase, nulls, hyphens, and single names) to ensure
 *   the algorithm behaves correctly under all real-world conditions.
 */
