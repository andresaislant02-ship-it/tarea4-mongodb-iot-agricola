// Tarea 4 - Big Data (UNAD) - Caso de uso: monitoreo de sensores en cultivos (IoT agrícola)
// Ejecutar en mongosh:  mongosh "TU_URI_DE_ATLAS" tarea4_finca_iot.js
// Base de datos: finca_iot | Colecciones: fincas, sensores, lecturas, alertas

const bd = db.getSiblingDB("finca_iot");
["fincas", "sensores", "lecturas", "alertas"].forEach(c => bd[c].drop());

// Generador pseudoaleatorio reproducible (siempre produce los mismos datos)
let semilla = 42;
function azar() { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; }
function entre(a, b, d = 1) { return +(a + azar() * (b - a)).toFixed(d); }

// ---------- 1. FINCAS (5 documentos) ----------
const fincas = [
  { _id: "F01", nombre: "La Esperanza", municipio: "Fusagasugá", departamento: "Cundinamarca", cultivo: "Tomate", area_ha: 12.5, propietario: { nombre: "Carlos Rodríguez", telefono: "3101234567" } },
  { _id: "F02", nombre: "El Mirador", municipio: "Pitalito", departamento: "Huila", cultivo: "Café", area_ha: 8.0, propietario: { nombre: "María Cuéllar", telefono: "3112345678" } },
  { _id: "F03", nombre: "Las Palmas", municipio: "Zona Bananera", departamento: "Magdalena", cultivo: "Banano", area_ha: 25.3, propietario: { nombre: "Jorge Pinto", telefono: "3123456789" } },
  { _id: "F04", nombre: "San Isidro", municipio: "Ipiales", departamento: "Nariño", cultivo: "Papa", area_ha: 15.2, propietario: { nombre: "Luz Mora", telefono: "3134567890" } },
  { _id: "F05", nombre: "El Roble", municipio: "Duitama", departamento: "Boyacá", cultivo: "Cebolla", area_ha: 6.7, propietario: { nombre: "Pedro Salamanca", telefono: "3145678901" } }
];
bd.fincas.insertMany(fincas);

// ---------- 2. SENSORES (20 documentos: 4 por finca) ----------
const tipos = [
  { tipo: "humedad_suelo", unidad: "%", min: 30, max: 70 },
  { tipo: "temperatura", unidad: "°C", min: 12, max: 32 },
  { tipo: "ph", unidad: "pH", min: 5.5, max: 7.5 },
  { tipo: "luminosidad", unidad: "lux", min: 2000, max: 60000 }
];
const coordsBase = { F01: [-74.37, 4.34], F02: [-76.05, 1.85], F03: [-74.15, 10.77], F04: [-77.64, 0.83], F05: [-73.03, 5.82] };
const sensores = [];
let n = 1;
fincas.forEach(f => {
  tipos.forEach(t => {
    sensores.push({
      _id: "S" + String(n).padStart(2, "0"),
      finca_id: f._id,
      tipo: t.tipo,
      unidad: t.unidad,
      modelo: "AgroSense-" + (100 + n),
      estado: n % 9 === 0 ? "mantenimiento" : "activo",
      instalado: new Date(Date.UTC(2026, 5, 1 + n)),
      umbral: { min: t.min, max: t.max },
      ubicacion: { type: "Point", coordinates: [+(coordsBase[f._id][0] + entre(-0.01, 0.01, 4)).toFixed(4), +(coordsBase[f._id][1] + entre(-0.01, 0.01, 4)).toFixed(4)] }
    });
    n++;
  });
});
bd.sensores.insertMany(sensores);

// ---------- 3. LECTURAS (160 documentos: 8 por sensor) y 4. ALERTAS ----------
// Cada tipo de sensor guarda campos distintos (esquema flexible)
const lecturas = [];
const alertas = [];
let l = 1, a = 1;
sensores.forEach(s => {
  const span = s.umbral.max - s.umbral.min;
  for (let i = 0; i < 8; i++) {
    const valor = Math.max(0, entre(s.umbral.min - 0.15 * span, s.umbral.max + 0.15 * span, 1)); // sin valores negativos
    const lec = {
      _id: "L" + String(l).padStart(3, "0"),
      sensor_id: s._id,
      finca_id: s.finca_id,
      fecha: new Date(Date.UTC(2026, 10, 1) + (i * 24 + (l % 8)) * 3600 * 1000),
      valor: valor,
      bateria_pct: Math.round(entre(40, 100, 0))
    };
    if (s.tipo === "humedad_suelo") lec.profundidad_cm = [10, 20, 30][i % 3];
    if (s.tipo === "temperatura") lec.medio = i % 2 === 0 ? "aire" : "suelo";
    if (s.tipo === "luminosidad") lec.nubosidad_pct = Math.round(entre(0, 100, 0));
    lecturas.push(lec);

    if (valor < s.umbral.min || valor > s.umbral.max) {
      const exceso = valor < s.umbral.min ? s.umbral.min - valor : valor - s.umbral.max;
      alertas.push({
        _id: "A" + String(a).padStart(3, "0"),
        lectura_id: lec._id,
        sensor_id: s._id,
        finca_id: s.finca_id,
        fecha: lec.fecha,
        severidad: exceso > 0.1 * span ? "alta" : "media",
        mensaje: "Valor de " + s.tipo + " fuera de rango: " + valor + " " + s.unidad,
        atendida: false
      });
      a++;
    }
    l++;
  }
});
bd.lecturas.insertMany(lecturas);
bd.alertas.insertMany(alertas);

// Índices
bd.lecturas.createIndex({ sensor_id: 1, fecha: -1 });
bd.alertas.createIndex({ finca_id: 1, severidad: 1 });
bd.sensores.createIndex({ ubicacion: "2dsphere" });

print("Documentos -> fincas:", bd.fincas.countDocuments(), "| sensores:", bd.sensores.countDocuments(),
  "| lecturas:", bd.lecturas.countDocuments(), "| alertas:", bd.alertas.countDocuments());

// =====================================================
// CONSULTAS
// =====================================================

print("\n--- CRUD: CREATE (insertOne) ---");
printjson(bd.lecturas.insertOne({ _id: "L999", sensor_id: "S01", finca_id: "F01", fecha: new Date(), valor: 55.2, bateria_pct: 90, profundidad_cm: 20 }));

print("\n--- CRUD: READ (find) últimas 3 lecturas del sensor S01 ---");
printjson(bd.lecturas.find({ sensor_id: "S01" }).sort({ fecha: -1 }).limit(3).toArray());

print("\n--- CRUD: UPDATE (updateOne) marcar alerta A001 como atendida ---");
printjson(bd.alertas.updateOne({ _id: "A001" }, { $set: { atendida: true, atendida_por: "técnico de campo" } }));

print("\n--- CRUD: DELETE (deleteOne) borrar la lectura de prueba L999 ---");
printjson(bd.lecturas.deleteOne({ _id: "L999" }));

print("\n--- JOIN con $lookup: alertas altas con su sensor y su finca ---");
printjson(bd.alertas.aggregate([
  { $match: { severidad: "alta" } },
  { $lookup: { from: "sensores", localField: "sensor_id", foreignField: "_id", as: "sensor" } },
  { $unwind: "$sensor" },
  { $lookup: { from: "fincas", localField: "finca_id", foreignField: "_id", as: "finca" } },
  { $unwind: "$finca" },
  { $project: { _id: 0, alerta: "$_id", finca: "$finca.nombre", cultivo: "$finca.cultivo", sensor: "$sensor.tipo", mensaje: 1 } },
  { $limit: 5 }
]).toArray());

print("\n--- AGREGACIÓN 1: humedad promedio del suelo por finca ---");
printjson(bd.lecturas.aggregate([
  { $lookup: { from: "sensores", localField: "sensor_id", foreignField: "_id", as: "s" } },
  { $unwind: "$s" },
  { $match: { "s.tipo": "humedad_suelo" } },
  { $group: { _id: "$finca_id", humedad_promedio: { $avg: "$valor" }, lecturas: { $sum: 1 } } },
  { $sort: { humedad_promedio: -1 } }
]).toArray());

print("\n--- AGREGACIÓN 2: número de alertas por finca y severidad ---");
printjson(bd.alertas.aggregate([
  { $group: { _id: { finca: "$finca_id", severidad: "$severidad" }, total: { $sum: 1 } } },
  { $sort: { "_id.finca": 1, total: -1 } }
]).toArray());

print("\n--- AGREGACIÓN 3: temperatura máxima y mínima por día ---");
printjson(bd.lecturas.aggregate([
  { $lookup: { from: "sensores", localField: "sensor_id", foreignField: "_id", as: "s" } },
  { $unwind: "$s" },
  { $match: { "s.tipo": "temperatura" } },
  { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fecha" } }, max: { $max: "$valor" }, min: { $min: "$valor" } } },
  { $sort: { _id: 1 } }
]).toArray());

print("\n--- CONSULTA GEOESPACIAL: sensores a menos de 5 km de la finca F01 ---");
printjson(bd.sensores.find({
  ubicacion: { $near: { $geometry: { type: "Point", coordinates: [-74.37, 4.34] }, $maxDistance: 5000 } }
}, { tipo: 1, finca_id: 1 }).toArray());
