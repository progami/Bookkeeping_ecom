export const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Bookkeeping API',
    version: '1.0.0',
    description: 'API for bookkeeping application with Xero integration',
    contact: {
      name: 'API Support',
      email: 'support@bookkeeping.app'
    }
  },
  servers: [
    {
      url: 'https://localhost:3003/api/v1',
      description: 'Development server'
    },
    {
      url: 'https://api.bookkeeping.app/v1',
      description: 'Production server'
    }
  ],
  tags: [
    { name: 'Authentication', description: 'Authentication endpoints' },
    { name: 'Xero', description: 'Xero integration endpoints' },
    { name: 'Analytics', description: 'Analytics and reporting endpoints' },
    { name: 'System', description: 'System monitoring and health endpoints' },
    { name: 'Database', description: 'Database management endpoints' }
  ],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'bookkeeping_session',
        description: 'Session-based authentication using secure HTTP-only cookies'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['SPEND', 'RECEIVE'] },
          status: { type: 'string' },
          total: { type: 'number' },
          tax: { type: 'number' },
          date: { type: 'string', format: 'date' },
          reference: { type: 'string' },
          bankAccountId: { type: 'string' },
          contactId: { type: 'string' }
        }
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['ACCREC', 'ACCPAY'] },
          status: { type: 'string' },
          invoiceNumber: { type: 'string' },
          reference: { type: 'string' },
          total: { type: 'number' },
          amountDue: { type: 'number' },
          amountPaid: { type: 'number' },
          date: { type: 'string', format: 'date' },
          dueDate: { type: 'string', format: 'date' },
          contactId: { type: 'string' }
        }
      },
      GLAccount: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string' },
          description: { type: 'string' },
          systemAccount: { type: 'boolean' },
          enablePaymentsToAccount: { type: 'boolean' },
          showInExpenseClaims: { type: 'boolean' },
          class: { type: 'string' },
          reportingCode: { type: 'string' },
          reportingCodeName: { type: 'string' }
        }
      },
      MemoryStats: {
        type: 'object',
        properties: {
          memory: {
            type: 'object',
            properties: {
              heapUsedMB: { type: 'number' },
              heapTotalMB: { type: 'number' },
              externalMB: { type: 'number' },
              rssMB: { type: 'number' },
              percentUsed: { type: 'number' },
              status: { type: 'string', enum: ['normal', 'moderate', 'high', 'critical'] }
            }
          },
          process: {
            type: 'object',
            properties: {
              uptime: { type: 'string' },
              uptimeSeconds: { type: 'number' },
              cpuUser: { type: 'number' },
              cpuSystem: { type: 'number' },
              pid: { type: 'number' },
              version: { type: 'string' },
              platform: { type: 'string' },
              arch: { type: 'string' }
            }
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      HealthCheck: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  responseTime: { type: 'number' }
                }
              },
              redis: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  responseTime: { type: 'number' }
                }
              },
              memory: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  heapUsedMB: { type: 'number' },
                  percentUsed: { type: 'number' }
                }
              },
              xeroSync: {
                type: 'object',
                properties: {
                  lastSync: { type: 'string', format: 'date-time' },
                  status: { type: 'string' }
                }
              }
            }
          },
          errors: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number',
        schema: { type: 'integer', minimum: 1, default: 1 }
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: { type: 'integer', minimum: 1, maximum: 1000, default: 50 }
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., "date:desc")',
        schema: { type: 'string' }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    }
  },
  paths: {
    '/auth/status': {
      get: {
        tags: ['Authentication'],
        summary: 'Get authentication status',
        operationId: 'getAuthStatus',
        responses: {
          '200': {
            description: 'Authentication status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    authenticated: { type: 'boolean' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        tenantId: { type: 'string' },
                        tenantName: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/xero/auth': {
      get: {
        tags: ['Authentication'],
        summary: 'Initiate Xero OAuth flow',
        operationId: 'initiateXeroAuth',
        responses: {
          '302': {
            description: 'Redirect to Xero OAuth',
            headers: {
              Location: { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/xero/callback': {
      get: {
        tags: ['Authentication'],
        summary: 'Xero OAuth callback',
        operationId: 'xeroCallback',
        parameters: [
          { name: 'code', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '302': {
            description: 'Redirect to dashboard',
            headers: {
              Location: { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/xero/sync': {
      post: {
        tags: ['Xero'],
        summary: 'Sync all data from Xero',
        operationId: 'syncXeroData',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Sync results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    details: {
                      type: 'object',
                      properties: {
                        contactsCreated: { type: 'integer' },
                        contactsUpdated: { type: 'integer' },
                        invoicesCreated: { type: 'integer' },
                        invoicesUpdated: { type: 'integer' },
                        transactionsCreated: { type: 'integer' },
                        transactionsUpdated: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/xero/transactions': {
      get: {
        tags: ['Xero'],
        summary: 'Get bank transactions',
        operationId: 'getTransactions',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortParam' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['SPEND', 'RECEIVE'] } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'List of transactions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transactions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Transaction' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/xero/invoices': {
      get: {
        tags: ['Xero'],
        summary: 'Get invoices',
        operationId: 'getInvoices',
        security: [{ sessionAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortParam' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['ACCREC', 'ACCPAY'] } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'List of invoices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    invoices: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Invoice' }
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/xero/gl-accounts': {
      get: {
        tags: ['Xero'],
        summary: 'Get GL accounts',
        operationId: 'getGLAccounts',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of GL accounts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    accounts: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/GLAccount' }
                    },
                    accountsByType: {
                      type: 'object',
                      additionalProperties: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/GLAccount' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/xero/sync-gl-accounts': {
      post: {
        tags: ['Xero'],
        summary: 'Sync GL accounts from Xero',
        operationId: 'syncGLAccounts',
        security: [{ sessionAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  includeArchived: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Sync results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    stats: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        created: { type: 'integer' },
                        updated: { type: 'integer' },
                        errors: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/analytics/top-vendors': {
      get: {
        tags: ['Analytics'],
        summary: 'Get top vendors by spend',
        operationId: 'getTopVendors',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['30d', '90d', '1y', 'all'] } }
        ],
        responses: {
          '200': {
            description: 'List of top vendors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    vendors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          contactId: { type: 'string' },
                          name: { type: 'string' },
                          totalSpend: { type: 'number' },
                          transactionCount: { type: 'integer' },
                          averageTransaction: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/analytics/insights': {
      get: {
        tags: ['Analytics'],
        summary: 'Get financial insights',
        operationId: 'getInsights',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Financial insights',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    revenue: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        trend: { type: 'number' },
                        byMonth: { type: 'array', items: { type: 'object' } }
                      }
                    },
                    expenses: {
                      type: 'object',
                      properties: {
                        total: { type: 'number' },
                        trend: { type: 'number' },
                        byCategory: { type: 'array', items: { type: 'object' } }
                      }
                    },
                    cashFlow: {
                      type: 'object',
                      properties: {
                        net: { type: 'number' },
                        forecast: { type: 'array', items: { type: 'object' } }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/system/memory': {
      get: {
        tags: ['System'],
        summary: 'Get memory statistics',
        operationId: 'getMemoryStats',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'Memory statistics',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MemoryStats' }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/system/health': {
      get: {
        tags: ['System'],
        summary: 'Get system health status',
        operationId: 'getHealthStatus',
        responses: {
          '200': {
            description: 'Health check results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthCheck' }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalError' }
        }
      }
    },
    '/database/tables': {
      get: {
        tags: ['Database'],
        summary: 'List database tables',
        operationId: 'getDatabaseTables',
        security: [{ sessionAuth: [] }],
        responses: {
          '200': {
            description: 'List of database tables',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tables: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          rowCount: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' }
        }
      }
    },
    '/database/table/{tableName}': {
      get: {
        tags: ['Database'],
        summary: 'Get table data',
        operationId: 'getTableData',
        security: [{ sessionAuth: [] }],
        parameters: [
          { name: 'tableName', in: 'path', required: true, schema: { type: 'string' } },
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' }
        ],
        responses: {
          '200': {
            description: 'Table data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'object' } },
                    columns: { type: 'array', items: { type: 'string' } },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        totalPages: { type: 'integer' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/UnauthorizedError' },
          '404': {
            description: 'Table not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    }
  },
  'x-readme': {
    'explorer-enabled': true,
    'proxy-enabled': true,
    'samples-enabled': true
  }
};