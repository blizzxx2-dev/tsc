export interface RoadmapTask {
  file: string;
  line: number;
  done: boolean;
  prefix: string;
  id: string;
  phase: 'M0' | 'Demo' | 'Alpha' | 'Beta' | 'Release' | 'Post';
  pri: 'P0' | 'P1' | 'P2' | 'P3';
  size: 'S' | 'M' | 'L';
  title: string;
  acceptance: string;
  text: string;
}
export const TASK: RegExp;
export const PHASES: RoadmapTask['phase'][];
export const POINTS: Record<RoadmapTask['size'], number>;
export function parseTasks(text: string, file?: string): RoadmapTask[];
export function readRoadmap(root: string, dir?: string): RoadmapTask[];
