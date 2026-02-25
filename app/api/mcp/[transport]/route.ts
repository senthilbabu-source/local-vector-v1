// ---------------------------------------------------------------------------
// app/api/mcp/[transport]/route.ts — MCP Server Endpoint
//
// Surgery 5: Exposes LocalVector as an MCP-compatible tool server.
//
// Auth: Bearer token via MCP_API_KEY env var. Returns 401 when missing or
// invalid. Fails closed when MCP_API_KEY is not configured.
// ---------------------------------------------------------------------------

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerLocalVectorTools } from '@/lib/mcp/tools';

const baseHandler = createMcpHandler(
  (server) => {
    registerLocalVectorTools(server);
  },
  {},
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
);

const handler = withMcpAuth(
  baseHandler,
  (_req, bearerToken) => {
    const apiKey = process.env.MCP_API_KEY;

    // Fail closed: if MCP_API_KEY is not configured, reject all requests.
    if (!apiKey) return undefined;

    // Validate bearer token against the configured key.
    if (bearerToken && bearerToken === apiKey) {
      return { token: bearerToken, clientId: 'mcp-client', scopes: [] };
    }

    return undefined;
  },
  { required: true }
);

export { handler as GET, handler as POST, handler as DELETE };
