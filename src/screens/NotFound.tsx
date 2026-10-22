import Link from 'next/link';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/primitives';

export function NotFound({ what = 'página' }: { what?: string }) {
  const isMcp = what === 'MCP';
  const isWeb = what === 'web';

  const title = isMcp
    ? 'Este MCP no está disponible.'
    : isWeb
      ? 'Todavía no hay un MCP para esta web.'
      : 'Aquí no hay nada.';

  const body = isMcp
    ? 'Puede que se haya eliminado, que ya no esté publicado o que el enlace no sea correcto.'
    : isWeb
      ? 'Puedes crear uno y comprobar qué herramientas se pueden generar.'
      : 'Esta dirección no corresponde a ninguna página de MCPortal.';

  const actions = isMcp ? (
    <Link href="/" className="btn btn--primary">
      Volver al catálogo
    </Link>
  ) : isWeb ? (
    <>
      <Link href="/crear" className="btn btn--primary">
        <Icon name="plus" size={15} /> Crear un MCP
      </Link>
      <Link href="/" className="btn btn--outline">
        Explorar catálogo
      </Link>
    </>
  ) : (
    <Link href="/" className="btn btn--primary">
      Explorar MCPs
    </Link>
  );

  return (
    <div className="container" style={{ paddingTop: 56 }}>
      <EmptyState icon="compass" title={title} actions={actions}>
        {body}
      </EmptyState>
    </div>
  );
}
