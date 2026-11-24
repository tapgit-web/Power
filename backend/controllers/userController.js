const User = require('../models/User');
const { ROLES, DEFAULT_ADMIN_EMAIL } = require('../config/constants');

// List all users: GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve user list' });
  }
};

// Create a new user: POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const { email, password, role, assignedMachines, allMachines } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const validRole = [ROLES.ADMIN, ROLES.USER_EDITOR, ROLES.USER].includes(role)
      ? role
      : ROLES.USER;

    const isAll = Boolean(allMachines || validRole === ROLES.ADMIN);
    const assigned = isAll ? [] : Array.isArray(assignedMachines) ? assignedMachines : [];

    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: validRole,
      assignedMachines: assigned,
      allMachines: isAll,
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        assignedMachines: newUser.assignedMachines,
        allMachines: newUser.allMachines,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user permissions or role: PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, assignedMachines, allMachines } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect primary admin from losing admin rights
    if (user.email === DEFAULT_ADMIN_EMAIL && role && role !== ROLES.ADMIN) {
      return res.status(400).json({ error: 'Cannot demote the primary administrator account' });
    }

    if (role && [ROLES.ADMIN, ROLES.USER_EDITOR, ROLES.USER].includes(role)) {
      user.role = role;
    }

    const isAll = Boolean(allMachines || user.role === ROLES.ADMIN);
    user.allMachines = isAll;
    user.assignedMachines = isAll
      ? []
      : Array.isArray(assignedMachines)
      ? assignedMachines
      : user.assignedMachines;

    await user.save();

    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        assignedMachines: user.assignedMachines,
        allMachines: user.allMachines,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user: DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deletion of primary admin
    if (user.email === DEFAULT_ADMIN_EMAIL) {
      return res.status(400).json({ error: 'Cannot delete the primary administrator account' });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: `User "${user.email}" deleted successfully` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};
