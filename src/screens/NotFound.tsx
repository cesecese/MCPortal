import Link from 'next/link';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/primitives';

export function NotFound({ what = 'página' }: { what?: string }) {
  return (
    <div className="container" style={{ paddingTop: 64 }}>
      <EmptyState
        icon="compass"
        title={what === 'MCP' ? 'Este MCP no existe o ya no está publicado' : 'Aquí no hay nada'}
        actions={
          <>
            <Link href="/" className="btn btn--outline">
              Ir al catálogo
            </Link>
            <Link href="/crear" className="btn btn--primary">
              <Icon name="plus" size={16} /> Crear un MCP
            </Link>
          </>
        }
      >
        {what === 'MCP'
          ? 'Puede que lo hayan renombrado. Búscalo en el catálogo o genéralo tú desde su web.'
          : 'La dirección no corresponde a ninguna pantalla de MCPortal.'}
      </EmptyState>
    </div>
  );
}
