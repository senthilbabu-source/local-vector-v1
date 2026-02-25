// ---------------------------------------------------------------------------
// app/api/mcp/[transport]/route.ts — MCP Server Endpoint
//
// Surgery 5: Exposes LocalVector as an MCP-compatible tool server.
// ---------------------------------------------------------------------------

import { createMcpHandler } from 'mcp-handler';
import { registerLocalVectorTools } from '@/lib/mcp/tools';

const handler = createMcpHandler(
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

export { handler as GET, handler as POST, handler as DELETE };