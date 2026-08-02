import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installChromeMock, resetChromeMock } from './chrome-mock';

installChromeMock();

afterEach(() => {
  cleanup();
  resetChromeMock();
  vi.restoreAllMocks();
});
