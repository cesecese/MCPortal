import Link from 'next/link';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/primitives';

export function NotFound({ what = 'página' }: { what?: string }) {
  const isMcp = what === 'MCP';
  const isWeb = what === 'web';
  return (
    <div className="container" style={{ paddingTop: 56 }}>
      <EmptyState
        icon="compass"
        title={isMcp ? 'MCP no encontrado' : isWeb ? 'Web no encontrada' : 'Página no encontrada'}
        actions={
          <>
            <Link href="/" className="btn btn--outline">
              Ir al catálogo
            </Link>
            <Link href="/crear" className="btn btn--primary">
              <Icon name="plus" size={15} /> Crear MCP
            </Link>
          </>
        }
      >
        {isMcp
          ? 'No existe o ya no está publicado.'
          : isWeb
            ? 'Todavía no hay ninguna implementación MCP publicada para esta web.'
            : 'Esta dirección no corresponde a ninguna página.'}
      </EmptyState>
    </div>
  );
}
