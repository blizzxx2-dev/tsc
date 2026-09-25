import type { RoadmapTask } from './roadmap.mjs';

export function points(tasks: RoadmapTask[]): Record<RoadmapTask['phase'], { total: number; done: number }>;
export function forecast(samples: { date: string; done: number; total: number }[], today?: Date): { velocity: number; remaining: number; date: Date | null };
