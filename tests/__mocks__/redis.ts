import { vi } from 'vitest'

export const redis = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  decr: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  mget: vi.fn(),
  mset: vi.fn(),
  ttl: vi.fn(),
  exists: vi.fn(),
  flushdb: vi.fn(),
  flushall: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
}