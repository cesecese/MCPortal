/** Validación de la URL del paso 1 de «Crear». */
export function normalizeUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: 'Escribe la dirección de la web.' };
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    const isLocal = url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname);
    if (!isLocal && !/\.[a-z]{2,}$/i.test(url.hostname)) {
      return { ok: false, error: 'No parece un dominio válido. Ejemplo: openlibrary.org' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'No parece una URL válida. Ejemplo: https://openlibrary.org' };
  }
}
