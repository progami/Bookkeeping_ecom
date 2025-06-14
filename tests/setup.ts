import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock fetch globally with a default implementation
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'Xero not connected' }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response)
)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}