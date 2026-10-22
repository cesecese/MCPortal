# Clientes de ejemplo (7) — entrada para el MCP

La web **no carga** estos 7 clientes. Son datos de entrada para crearlos tú desde
el MCP con `gestoria_meridian_create_client`; la web arranca con **un único cliente base**
(`CL-2026-0001`, Marta Rivas).

- `clientes.txt`: **7 líneas, una por cliente**, sin cabecera. Campos separados por comas:
  `id, nombre, apellidos, telefono, email, cif, direccion, ciudad, cp, provincia, tipo, iban, fecha_alta, asesor, estado, notas, balance`.
- `clientes.json`: los mismos 7, por si prefieres leerlos desde un script.
- `balances/`: los 7 PDFs. El campo `balance` ya contiene la ruta que hay que pasar
  al parámetro `balance` del MCP (relativa a la raíz del repo).
- Los IDs son orientativos: al crearlos en orden, la web asigna `CL-2026-0002` a
  `CL-2026-0008`. El MCP no acepta `id`; lo genera la web.

Códigos internos: `tipo` = `empresa|autonomo|particular`; `estado` = `activo|pendiente|inactivo`;
`asesor` = `elena|marcos|lucia`.

| Cliente | CIF | PDF de entrada |
|---|---|---|
| Alba Serrano Gil | B76543210 | balances/Alba_Serrano_Gil.pdf |
| Carlos Mendoza Ruiz | B23456789 | balances/Carlos_Mendoza_Ruiz.pdf |
| Nerea López Campos | 12345678Z | balances/Nerea_López_Campos.pdf |
| Ignacio Ferreira Costa | B34567890 | balances/Ignacio_Ferreira_Costa.pdf |
| Paula Ortiz Navarro | B45678912 | balances/Paula_Ortiz_Navarro.pdf |
| Sergio Hernández Bravo | B56789123 | balances/Sergio_Hernández_Bravo.pdf |
| Marta Vidal Serrano | 87654321X | balances/Marta_Vidal_Serrano.pdf |
