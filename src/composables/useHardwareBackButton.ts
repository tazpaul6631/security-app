import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue';

export type BackButtonHandler = (processNextHandler: () => void) => void;

interface BackEntry {
  priority: number;
  handler: BackButtonHandler;
}

const entries: BackEntry[] = [];
let listenerAttached = false;

const dispatchBack = () => {
  const sorted = [...entries].sort((a, b) => b.priority - a.priority);
  let index = 0;

  const processNextHandler = () => {
    index += 1;
    if (index < sorted.length) {
      sorted[index].handler(processNextHandler);
      return;
    }
    void minimizeApp();
  };

  if (sorted.length === 0) {
    void minimizeApp();
    return;
  }

  sorted[0].handler(processNextHandler);
};

const minimizeApp = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await App.minimizeApp();
  } catch {
    await App.exitApp();
  }
};

const ensureListener = async () => {
  if (listenerAttached || !Capacitor.isNativePlatform()) return;
  listenerAttached = true;
  await App.addListener('backButton', () => {
    dispatchBack();
  });
};

/**
 * Hardware back via Capacitor. Call `processNextHandler()` to fall through.
 * Registers while the component is active (including keep-alive).
 */
export function useHardwareBackButton(
  priority: number,
  handler: BackButtonHandler,
) {
  const entry: BackEntry = { priority, handler };

  const add = () => {
    if (!entries.includes(entry)) entries.push(entry);
    void ensureListener();
  };

  const remove = () => {
    const idx = entries.indexOf(entry);
    if (idx >= 0) entries.splice(idx, 1);
  };

  onMounted(add);
  onActivated(add);
  onDeactivated(remove);
  onUnmounted(remove);
}
