export const ALLOW: Record<string, string>;
export function blocklist(): string[];
export function scan(): Promise<{
  terms: number;
  hits: { term: string; where: string; player: boolean; text: string; allowed?: string }[];
  names: [string, number][];
}>;
