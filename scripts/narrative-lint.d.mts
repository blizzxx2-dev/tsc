export interface LintHit {
  where: string;
  rule: 'avoid-list' | 'modern-word' | 'mock-archaic';
  match: string;
  text: string;
}
export const ROOT: string;
export const BANNED_MODERN: string[];
export const BANNED_ARCHAIC: string[];
export const AVOID: string[];
export const AVOID_CASED: string[];
export const RE_MODERN: RegExp;
export const RE_ARCHAIC: RegExp;
export const RE_AVOID: RegExp;
export const RE_AVOID_CASED: RegExp;
export function literals(file: string): { text: string; line: number }[];
export function SCRIPT_FILES(): string[];
export function STRING_TABLES(): string[];
export function lint(): LintHit[];
