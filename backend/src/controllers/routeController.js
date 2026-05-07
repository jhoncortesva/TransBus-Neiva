const db = require('../config/db');

const getRoutes = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, description, stops, color, created_at FROM routes ORDER BY name`
    );
    res.json({ routes: rows });
  } catch {
    res.status(500).json({ error: 'Error al obtener rutas' });
  }
};

const getRouteById = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.json({ route: rows[0] });
  } catch {
    res.status(500).json({ error: 'Error al obtener ruta' });
  }
};

const createRoute = async (req, res) => {
  const { name, description, stops, color, ida_coords, vuelta_coords, pois } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows } = await db.query(
      `INSERT INTO routes (name, description, stops, color, ida_coords, vuelta_coords, pois, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
       RETURNING id, name, description, stops, color, created_at`,
      [name.trim(), description || '', stops || '', color || '#1565C0',
       JSON.stringify(ida_coords || []), JSON.stringify(vuelta_coords || []),
       JSON.stringify(pois || []), req.user.id]
    );
    res.status(201).json({ route: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una ruta con ese nombre' });
    res.status(500).json({ error: 'Error al crear ruta' });
  }
};

const updateRoute = async (req, res) => {
  const { name, description, stops, color, ida_coords, vuelta_coords, pois } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  // Only update coords when explicitly provided in request body
  const hasCoords = 'ida_coords' in req.body;
  try {
    let query, params;
    if (hasCoords) {
      query = `UPDATE routes SET name=$1, description=$2, stops=$3, color=$4,
               ida_coords=$5::jsonb, vuelta_coords=$6::jsonb, pois=$7::jsonb, updated_at=NOW()
               WHERE id=$8 RETURNING id, name, description, stops, color, created_at`;
      params = [name.trim(), description || '', stops || '', color || '#1565C0',
                JSON.stringify(ida_coords || []), JSON.stringify(vuelta_coords || []),
                JSON.stringify(pois || []), req.params.id];
    } else {
      query = `UPDATE routes SET name=$1, description=$2, stops=$3, color=$4, updated_at=NOW()
               WHERE id=$5 RETURNING id, name, description, stops, color, created_at`;
      params = [name.trim(), description || '', stops || '', color || '#1565C0', req.params.id];
    }
    const { rows } = await db.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.json({ route: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una ruta con ese nombre' });
    res.status(500).json({ error: 'Error al actualizar ruta' });
  }
};

const deleteRoute = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Ruta no encontrada' });
    res.json({ message: 'Ruta eliminada' });
  } catch {
    res.status(500).json({ error: 'Error al eliminar ruta' });
  }
};

module.exports = { getRoutes, getRouteById, createRoute, updateRoute, deleteRoute };
