const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { DEFAULT_ADMIN_EMAIL, ROLES } = require('../config/constants');

// Login endpoint: POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user in database
    let user = await User.findOne({ email: normalizedEmail });

    // Seed default admin if it doesn't exist yet
    if (!user && normalizedEmail === DEFAULT_ADMIN_EMAIL) {
      const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';
      if (password === defaultPassword) {
        const passwordHash = await User.hashPassword(defaultPassword);
        user = await User.create({
          email: normalizedEmail,
          passwordHash,
          role: ROLES.ADMIN,
          allMachines: true,
          assignedMachines: ['TAP001'],
        });
        console.log(`👑 [Auth] Default admin created: ${normalizedEmail}`);
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        assignedMachines: user.assignedMachines,
        allMachines: user.allMachines,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

// Registration endpoint: POST /api/auth/register
const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const isAdmin = normalizedEmail === DEFAULT_ADMIN_EMAIL;
    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: isAdmin ? ROLES.ADMIN : ROLES.USER,
      allMachines: isAdmin,
      assignedMachines: [],
    });

    console.log(`👤 [Auth] New user registered: ${normalizedEmail} (Role: ${user.role})`);

    const token = generateToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        assignedMachines: user.assignedMachines,
        allMachines: user.allMachines,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

// Current user profile: GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

module.exports = {
  login,
  register,
  getMe,
};
