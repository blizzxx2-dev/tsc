/**
 * Preload (sandboxed, context-isolated): exposes `window.ssBridge` with three functions restricted to
 * the channel allow-lists in src/platform/bridge.ts. No Node, no ipcRenderer, no arbitrary channels
 * reach the page (PLT-0012).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { EVENT_CHANNELS, INVOKE_CHANNELS, SEND_CHANNELS } from '../../src/platform/bridge';

const invokeOk = new Set<string>(INVOKE_CHANNELS);
const sendOk = new Set<string>(SEND_CHANNELS);
const eventOk = new Set<string>(EVENT_CHANNELS);

contextBridge.exposeInMainWorld('ssBridge', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!invokeOk.has(channel)) return Promise.reject(new Error(`channel not allowed: ${channel}`));
    return ipcRenderer.invoke(channel, ...args);
  },
  send(channel: string, ...args: unknown[]): void {
    if (sendOk.has(channel)) ipcRenderer.send(channel, ...args);
  },
  on(channel: string, cb: (...args: unknown[]) => void): () => void {
    if (!eventOk.has(channel)) return () => undefined;
    const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
