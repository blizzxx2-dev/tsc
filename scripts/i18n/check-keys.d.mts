export interface KeyScan {
  keys: number;
  used: number;
  missing: string[];
  unused: string[];
  nonLiteral: string[];
  hardcoded: string[];
  simUntranslatable: string[];
}
export function scan(): KeyScan;
