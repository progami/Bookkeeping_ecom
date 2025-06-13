import { vi } from 'vitest'

export const prisma = {
  bankTransaction: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  glAccount: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  syncLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}