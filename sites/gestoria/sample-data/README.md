# Clientes de ejemplo (7)

- `clientes.txt`: **7 líneas, una por cliente**, sin cabecera. Campos separados por comas:
  `id, nombre, apellidos, telefono, email, cif, direccion, ciudad, cp, provincia, tipo, iban, fecha_alta, asesor, estado, notas, balance`.
- `clientes.json`: los mismos 7 clientes; la web los carga automáticamente al arrancar.
- Los PDFs están en `../documents/` y se descargan desde **Documentos** o desde la ficha de cada cliente. El campo `balance` del txt es el nombre del archivo.

Códigos internos: `tipo` = `empresa|autonomo|particular`; `estado` = `activo|pendiente|inactivo`;
`asesor` = `elena|marcos|lucia`.

| Cliente | CIF | Balance |
|---|---|---|
| Alba Serrano Gil | B76543210 | Alba_Serrano_Gil.pdf |
| Carlos Mendoza Ruiz | B23456789 | Carlos_Mendoza_Ruiz.pdf |
| Nerea López Campos | 12345678Z | Nerea_López_Campos.pdf |
| Ignacio Ferreira Costa | B34567890 | Ignacio_Ferreira_Costa.pdf |
| Paula Ortiz Navarro | B45678912 | Paula_Ortiz_Navarro.pdf |
| Sergio Hernández Bravo | B56789123 | Sergio_Hernández_Bravo.pdf |
| Marta Vidal Serrano | 87654321X | Marta_Vidal_Serrano.pdf |
