// Servicios para el modelo de datos de Firestore
// Cada función encapsula operaciones CRUD para una colección
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Helpers ────────────────────────────────────────────────────────────────

const col = (nombre) => collection(db, nombre);

// ─── Usuarios ────────────────────────────────────────────────────────────────

export const usuariosService = {
  async obtener(uid) {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  },
  async actualizar(uid, datos) {
    await updateDoc(doc(db, 'usuarios', uid), datos);
  },
};

// ─── Áreas ───────────────────────────────────────────────────────────────────

export const areasService = {
  async listar() {
    const snap = await getDocs(query(col('areas'), orderBy('nombre')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    return addDoc(col('areas'), { ...datos, activa: true });
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, 'areas', id), datos);
  },
  async eliminar(id) {
    await deleteDoc(doc(db, 'areas', id));
  },
};

// ─── Rutas ───────────────────────────────────────────────────────────────────

export const rutasService = {
  async listar() {
    const snap = await getDocs(query(col('rutas'), orderBy('nombre')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    return addDoc(col('rutas'), { ...datos, activa: true });
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, 'rutas', id), datos);
  },
  async eliminar(id) {
    await deleteDoc(doc(db, 'rutas', id));
  },
};

// ─── Comunidades ─────────────────────────────────────────────────────────────

export const comunidadesService = {
  async listar(rutaId = null) {
    const constraints = rutaId ? [where('rutaId', '==', rutaId)] : [];
    const snap = await getDocs(query(col('comunidades'), ...constraints, orderBy('nombre')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    return addDoc(col('comunidades'), datos);
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, 'comunidades', id), datos);
  },
  async eliminar(id) {
    await deleteDoc(doc(db, 'comunidades', id));
  },
};

// ─── Puntos de reunión ────────────────────────────────────────────────────────

export const puntosReunionService = {
  async listar(comunidadId = null) {
    const constraints = comunidadId ? [where('comunidadId', '==', comunidadId)] : [];
    const snap = await getDocs(
      query(col('puntosReunion'), ...constraints, orderBy('nombre'))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    return addDoc(col('puntosReunion'), datos);
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, 'puntosReunion', id), datos);
  },
  async eliminar(id) {
    await deleteDoc(doc(db, 'puntosReunion', id));
  },
};

// ─── Empleados ────────────────────────────────────────────────────────────────

export const empleadosService = {
  async listar(areaId = null) {
    const constraints = areaId ? [where('areaId', '==', areaId)] : [];
    const snap = await getDocs(
      query(col('empleados'), ...constraints, orderBy('nombreLower'))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async buscarPorNomina(nomina) {
    const snap = await getDocs(query(col('empleados'), where('nomina', '==', nomina)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos) {
    return addDoc(col('empleados'), {
      ...datos,
      nombreLower: datos.nombre?.toLowerCase() ?? '',
      activo: true,
    });
  },
  async actualizar(id, datos) {
    const patch = { ...datos };
    if (datos.nombre) patch.nombreLower = datos.nombre.toLowerCase();
    await updateDoc(doc(db, 'empleados', id), patch);
  },
  async eliminar(id) {
    await deleteDoc(doc(db, 'empleados', id));
  },
};

// ─── Solicitudes ──────────────────────────────────────────────────────────────

export const solicitudesService = {
  async listar(filtros = {}) {
    const constraints = [];
    if (filtros.areaId) constraints.push(where('areaId', '==', filtros.areaId));
    if (filtros.estatus) constraints.push(where('estatus', '==', filtros.estatus));
    if (filtros.creadoPor) constraints.push(where('creadoPor', '==', filtros.creadoPor));
    constraints.push(orderBy('fechaSolicitud', 'desc'));
    const snap = await getDocs(query(col('solicitudes'), ...constraints));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async crear(datos, uid) {
    return addDoc(col('solicitudes'), {
      ...datos,
      creadoPor: uid,
      fechaSolicitud: serverTimestamp(),
      estatus: 'pendiente',
    });
  },
  async actualizar(id, datos) {
    await updateDoc(doc(db, 'solicitudes', id), datos);
  },
  async cambiarEstatus(id, estatus) {
    await updateDoc(doc(db, 'solicitudes', id), { estatus });
  },

  // Sub-colección de pasajeros
  async agregarPasajero(solicitudId, pasajero) {
    return addDoc(col(`solicitudes/${solicitudId}/pasajeros`), pasajero);
  },
  async listarPasajeros(solicitudId) {
    const snap = await getDocs(col(`solicitudes/${solicitudId}/pasajeros`));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },
  async eliminarPasajero(solicitudId, pasajeroId) {
    await deleteDoc(doc(db, `solicitudes/${solicitudId}/pasajeros`, pasajeroId));
  },
};
