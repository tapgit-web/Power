const jwt = require('jsonwebtoken');
const { ROLES } = require('../config/constants');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'power_monitoring_super_secret_jwt_key_2026';

// Middleware to verify Bearer JWT
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      assignedMachines: Array.isArray(decoded.assignedMachines) ? decoded.assignedMachines : [],
      allMachines: Boolean(decoded.allMachines),
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

// Guard: Only Administrator
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

// Guard: Administrator or User Editor (can edit labels/names for assigned machines)
const requireEditorOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.USER_EDITOR)) {
    return res.status(403).json({ error: 'Forbidden: Editor or Admin access required' });
  }
  next();
};

// Helper: Check if current user has permission to access a specific machine
const canAccessMachine = (user, machineId) => {
  if (!user) return false;
  if (user.role === ROLES.ADMIN || user.allMachines) return true;
  return Array.isArray(user.assignedMachines) && user.assignedMachines.includes(machineId);
};

// Helper: Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      email: user.email,
      role: user.role,
      assignedMachines: user.assignedMachines || [],
      allMachines: user.allMachines || false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireEditorOrAdmin,
  canAccessMachine,
  generateToken,
  JWT_SECRET,
};
