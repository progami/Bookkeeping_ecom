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

// Mock ResizeObserver for recharts
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.URL.createObjectURL for file downloads
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  window.URL.revokeObjectURL = vi.fn()
}

// Mock document.createElement for download links
const originalCreateElement = document.createElement.bind(document)
Object.defineProperty(global.document, 'createElement', {
  value: vi.fn((tag: string) => {
    const element = originalCreateElement(tag)
    if (tag === 'a') {
      element.click = vi.fn()
    }
    return element
  }),
  writable: true,
})