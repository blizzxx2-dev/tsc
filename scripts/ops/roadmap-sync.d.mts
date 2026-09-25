import type { RoadmapTask } from './roadmap.mjs';

export interface SyncIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  state_reason: string | null;
  labels: string[];
}
export interface SyncAction {
  kind: 'create' | 'update' | 'close' | 'mark-done';
  id: string;
  number?: number;
  title?: string;
  body?: string;
  labels: string[];
  close?: boolean;
  file?: string;
  line?: number;
}
export function labelsFor(t: RoadmapTask): string[];
export function titleFor(t: RoadmapTask): string;
export function bodyFor(t: RoadmapTask): string;
export function plan(tasks: RoadmapTask[], issues: SyncIssue[]): SyncAction[];
export function markDone(root: string, actions: SyncAction[]): void;
