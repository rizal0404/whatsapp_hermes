import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'WhatsApp API Gateway',
        description: `
## Overview
RESTful API Gateway for WhatsApp messaging powered by Baileys (Multi-Device).

## Authentication
All \`/v1/*\` endpoints require an \`X-API-Key\` header with a valid API key.

## Features
- **Sessions** — Create, manage, and monitor WhatsApp sessions
- **Messages** — Send text and document messages with queue-based delivery
- **Groups** — List and inspect WhatsApp group metadata and JIDs
- **Recipients** — Manage notification recipients (CRUD)
- **Hermes** — Batch daily report sending with auto-recipient resolution
- **Monitoring** — System metrics and queue statistics
        `.trim(),
        version: '1.1.0',
        contact: {
          name: 'WA-Gateway Admin',
        },
      },
      servers: [
        {
          url: '{protocol}://{host}',
          description: 'Dynamic — auto-detects current host',
          variables: {
            protocol: {
              default: 'http',
              enum: ['http', 'https'],
              description: 'HTTP protocol',
            },
            host: {
              default: 'localhost:3000',
              description: 'Server host and port',
            },
          },
        },
      ],
      tags: [
        { name: 'Health', description: 'Server health checks' },
        { name: 'Sessions', description: 'WhatsApp session management (create, start, QR, logout)' },
        { name: 'Messages', description: 'Send text and document messages' },
        { name: 'Groups', description: 'WhatsApp group listing and metadata' },
        { name: 'Hermes', description: 'Batch report sending for Hermes Agent integration' },
        { name: 'Recipients', description: 'Notification recipient management (CRUD)' },
        { name: 'Monitoring', description: 'System metrics, queue stats' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for authenticating requests to /v1/* endpoints',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    theme: {
      title: 'WA-Gateway API Docs',
      css: [
        {
          filename: 'custom-theme.css',
          content: `
            /* Premium Dark Theme for Swagger UI */
            body { margin: 0; padding: 0; }
            .swagger-ui { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; }
            
            /* Topbar */
            .swagger-ui .topbar { background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%); padding: 12px 0; }
            .swagger-ui .topbar .download-url-wrapper { display: none; }
            .swagger-ui .topbar a span { display: none; }
            .swagger-ui .topbar a::after { content: 'WA-Gateway API'; font-size: 20px; font-weight: 700; color: #25D366; letter-spacing: 0.5px; }
            
            /* Main Info Section */
            .swagger-ui .info { margin: 30px 0; }
            .swagger-ui .info hgroup.main { margin: 0 0 20px 0; }
            .swagger-ui .info .title { font-size: 28px; font-weight: 800; color: #1a1a2e; }
            .swagger-ui .info .title small.version-stamp { background: linear-gradient(135deg, #25D366, #128C7E); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 600; vertical-align: middle; }
            .swagger-ui .info .description p { color: #4a4a6a; line-height: 1.7; }
            
            /* Tag Headers */
            .swagger-ui .opblock-tag { font-size: 18px; font-weight: 700; color: #1a1a2e; border-bottom: 2px solid #e8e8f0; padding: 12px 0; }
            .swagger-ui .opblock-tag:hover { background: rgba(37, 211, 102, 0.04); }
            .swagger-ui .opblock-tag small { font-size: 13px; color: #6c6c8a; }
            
            /* Operation Blocks */
            .swagger-ui .opblock { border-radius: 10px; margin: 6px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e8e8f0; }
            .swagger-ui .opblock .opblock-summary { padding: 10px 16px; border-radius: 10px; }
            .swagger-ui .opblock .opblock-summary-method { border-radius: 6px; font-size: 13px; font-weight: 700; min-width: 70px; padding: 6px 0; text-align: center; }
            
            /* GET - Green gradient */
            .swagger-ui .opblock-get { background: linear-gradient(135deg, rgba(37, 211, 102, 0.05), rgba(18, 140, 126, 0.03)); border-color: rgba(37, 211, 102, 0.3); }
            .swagger-ui .opblock-get .opblock-summary-method { background: linear-gradient(135deg, #25D366, #128C7E); }
            .swagger-ui .opblock-get .opblock-summary { border-color: transparent; }
            
            /* POST - Blue gradient */
            .swagger-ui .opblock-post { background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.03)); border-color: rgba(59, 130, 246, 0.3); }
            .swagger-ui .opblock-post .opblock-summary-method { background: linear-gradient(135deg, #3b82f6, #2563eb); }
            .swagger-ui .opblock-post .opblock-summary { border-color: transparent; }
            
            /* PUT - Amber gradient */
            .swagger-ui .opblock-put { background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), rgba(217, 119, 6, 0.03)); border-color: rgba(245, 158, 11, 0.3); }
            .swagger-ui .opblock-put .opblock-summary-method { background: linear-gradient(135deg, #f59e0b, #d97706); }
            .swagger-ui .opblock-put .opblock-summary { border-color: transparent; }
            
            /* DELETE - Red gradient */
            .swagger-ui .opblock-delete { background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.03)); border-color: rgba(239, 68, 68, 0.3); }
            .swagger-ui .opblock-delete .opblock-summary-method { background: linear-gradient(135deg, #ef4444, #dc2626); }
            .swagger-ui .opblock-delete .opblock-summary { border-color: transparent; }
            
            /* Summary path & description */
            .swagger-ui .opblock-summary-path { font-size: 14px; font-weight: 600; color: #1a1a2e; }
            .swagger-ui .opblock-summary-description { font-size: 13px; color: #6c6c8a; }
            
            /* Authorize Button */
            .swagger-ui .btn.authorize { background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none; border-radius: 8px; font-weight: 600; padding: 8px 20px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3); }
            .swagger-ui .btn.authorize:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4); }
            .swagger-ui .btn.authorize svg { fill: white; }
            
            /* Execute Button */
            .swagger-ui .btn.execute { background: linear-gradient(135deg, #25D366, #128C7E); border: none; border-radius: 6px; font-weight: 600; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.25); }
            .swagger-ui .btn.execute:hover { box-shadow: 0 4px 10px rgba(37, 211, 102, 0.35); }
            
            /* Try It Out Button */
            .swagger-ui .try-out__btn { border-radius: 6px; font-weight: 600; }
            
            /* Models Section */
            .swagger-ui section.models { border: 1px solid #e8e8f0; border-radius: 10px; }
            .swagger-ui section.models h4 { font-size: 16px; color: #1a1a2e; }
            
            /* Response Section */
            .swagger-ui .responses-wrapper { padding: 0 16px; }
            .swagger-ui .response .response-col_status { font-weight: 700; }
            
            /* Schema / Model */
            .swagger-ui .model-box { background: #f8f9fc; border-radius: 8px; }
            
            /* Scrollbar */
            .swagger-ui ::-webkit-scrollbar { width: 6px; height: 6px; }
            .swagger-ui ::-webkit-scrollbar-track { background: #f1f1f5; border-radius: 3px; }
            .swagger-ui ::-webkit-scrollbar-thumb { background: #c4c4d4; border-radius: 3px; }
            .swagger-ui ::-webkit-scrollbar-thumb:hover { background: #25D366; }
            
            /* Wrapper max width */
            .swagger-ui .wrapper { max-width: 1280px; padding: 0 24px; }
          `,
        },
      ],
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });
}
