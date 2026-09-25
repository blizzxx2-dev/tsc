import type { RoadmapTask } from './roadmap.mjs';
export function dependencies(tasks: RoadmapTask[]): { id: string; phase: string; from: string; to: string; title: string }[];
