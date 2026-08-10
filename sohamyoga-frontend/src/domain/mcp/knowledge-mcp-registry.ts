import { McpServerManifest, McpTool } from './types';

const TOOLS: McpTool[] = [
  {
    name: 'semantic_search',
    description: 'Search the yoga portal knowledge base using semantic embedding similarity (RAG via Qdrant + LlamaIndex).',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['query'],
      properties: {
        query:         { type: 'string' },
        topK:          { type: 'number', default: 5, maximum: 20 },
        collections:   { type: 'array', items: { type: 'string', enum: ['poses','courses','policies','blog','faq','community'] } },
        scoreThreshold:{ type: 'number', default: 0.65, description: 'Minimum similarity score 0–1' },
      },
    },
  },
  {
    name: 'search_rag_documents',
    description: 'Retrieve the most relevant document chunks from the RAG store for a given question.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['question'],
      properties: {
        question:    { type: 'string' },
        topK:        { type: 'number', default: 5 },
        rerank:      { type: 'boolean', default: true, description: 'Apply cross-encoder reranking for precision' },
        documentType:{ type: 'string' },
      },
    },
  },
  {
    name: 'query_knowledge_graph',
    description: 'Run a natural-language query against the GraphRAG/RDF knowledge graph (pose relationships, teacher expertise, anatomy).',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['query'],
      properties: {
        query:  { type: 'string', description: 'Natural-language question converted to graph traversal' },
        depth:  { type: 'number', default: 2, description: 'Hop depth for graph traversal' },
        format: { type: 'string', enum: ['summary','triples','json'], default: 'summary' },
      },
    },
  },
  {
    name: 'sparql_query',
    description: 'Execute a read-only SPARQL SELECT query against the yoga portal RDF triplestore (Apache Jena).',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['sparql'],
      properties: {
        sparql: { type: 'string', description: 'SELECT query only — UPDATE/DELETE will be rejected' },
        limit:  { type: 'number', default: 100, maximum: 1000 },
      },
    },
    safetyNote: 'Only SELECT queries are permitted. UPDATE/INSERT/DELETE operations will be rejected at the server.',
  },
  {
    name: 'get_entity_relationships',
    description: 'Return the direct relationships for a named entity (pose, teacher, anatomy term, course).',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['entityId'],
      properties: {
        entityId:   { type: 'string' },
        entityType: { type: 'string', enum: ['pose','teacher','course','anatomy_region','style'] },
        depth:      { type: 'number', default: 1 },
      },
    },
  },
  {
    name: 'index_new_content',
    description: 'Trigger embedding and indexing of a new document or video transcript into the RAG store.',
    tier: 'staff', riskLevel: 2,
    inputSchema: { type: 'object', required: ['contentId', 'contentType'],
      properties: {
        contentId:   { type: 'string' },
        contentType: { type: 'string', enum: ['blog_post','course_lesson','faq','pose_guide','policy'] },
        collection:  { type: 'string' },
      },
    },
    safetyNote: 'Do not index health records or personally identifiable information into the shared knowledge store',
  },
  {
    name: 'get_retrieval_context',
    description: 'Get the full retrieval context (sources + chunks + scores) used to generate a previous AI response.',
    tier: 'auto', riskLevel: 1,
    inputSchema: { type: 'object', required: ['traceId'],
      properties: { traceId: { type: 'string', description: 'Langfuse trace ID' } },
    },
  },
];

export const KNOWLEDGE_MCP: McpServerManifest = {
  id:          'knowledge-mcp',
  slug:        'knowledge-mcp',
  name:        'Knowledge MCP',
  description: 'Semantic search (RAG), graph queries (GraphRAG/RDF), SPARQL, entity relationships, and content indexing.',
  version:     '1.0.0',
  tools:       TOOLS,
  backingServices: ['Qdrant (vector store)', 'LlamaIndex', 'Apache Jena (RDF)', 'Neo4j (optional graph)', 'Langfuse'],
  availability: 'custom',
  implementationNote: 'LightRAG and LlamaIndex have community MCP adapters — evaluate before adopting. SPARQL adapter is fully custom.',
};
