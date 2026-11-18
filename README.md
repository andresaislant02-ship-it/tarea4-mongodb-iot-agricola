# Tarea 4 – Almacenamiento y consultas de datos en Big Data (MongoDB)

**Curso:** Big Data (202016911) – UNAD
**Caso de uso:** monitoreo de sensores en cultivos (IoT agrícola)
**Base de datos:** `finca_iot` en MongoDB Atlas

## Descripción

Sistema de monitoreo de fincas con sensores de humedad del suelo, temperatura, pH y luminosidad. Cada sensor genera lecturas continuas, y cuando una lectura sale del rango permitido se registra una alerta.

## ¿Por qué NoSQL?

- **Volumen y velocidad:** las lecturas crecen sin parar y MongoDB escala horizontalmente con sharding.
- **Atributos variables:** cada tipo de sensor guarda campos distintos (profundidad, medio de medición, nubosidad).
- **Esquema flexible:** se pueden agregar sensores nuevos sin migraciones.
- **Datos geoespaciales:** índice `2dsphere` para ubicar sensores.

## Diseño de colecciones

| Colección | Documentos | Diseño |
|-----------|-----------:|--------|
| `fincas` | 5 | Propietario embebido |
| `sensores` | 20 | Umbral y ubicación (GeoJSON) embebidos; referencia a `finca_id` |
| `lecturas` | 160 | Referencian `sensor_id` y `finca_id` |
| `alertas` | variable | Se generan de las lecturas fuera de umbral; referencian `lectura_id` |

Criterio: se **embebe** lo que se consulta junto y se **referencia** lo que crece sin límite.



El script borra y vuelve a crear las colecciones, inserta los datos de prueba, crea los índices y ejecuta las consultas.

## Consultas incluidas

- **CRUD:** `insertOne`, `find`, `updateOne`, `deleteOne`
- **`$lookup`:** alertas altas con su sensor y su finca
- **Agregaciones:** humedad promedio por finca, alertas por finca y severidad, temperatura máxima y mínima por día
- **Geoespacial:** sensores a menos de 5 km de una finca con `$near`

## Archivos

- `tarea4_finca_iot.js`: datos de prueba y consultas
- `README.md`: este documento

## Autor

Andres David Aislant Leon – Ingeniería de Sistemas, UNAD – Grupo 2204
