import type { Metadata } from 'next';
import { SEED_MCPS } from '../../../data/mcps';
import { siteKey } from '../../../lib/catalog';
import { SitePage } from '../../../screens/SitePage';

export function generateStaticParams() {
  return [...new Set(SEED_MCPS.map((mcp) => siteKey(mcp.site)))].map((site) => ({ site }));
}

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const raw = (await params).site;
  const key = siteKey(decodeURIComponent(raw));
  const variants = SEED_MCPS.filter((mcp) => siteKey(mcp.site) === key);
  return variants.length
    ? {
        title: `${key} · MCPs`,
        description: `${variants.length} implementaciones MCP para ${key} publicadas por la comunidad.`,
      }
    : { title: 'Web' };
}

export default function WebPage() {
  return <SitePage />;
}
