import type { Metadata } from 'next';
import { SEED_MCPS } from '../../../data/mcps';
import { McpDetail } from '../../../screens/McpDetail';

export function generateStaticParams() {
  return SEED_MCPS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const mcp = SEED_MCPS.find((m) => m.slug === slug);
  return mcp ? { title: mcp.name, description: mcp.description } : { title: 'MCP' };
}

export default function McpPage() {
  return <McpDetail />;
}
