const User = require('../models/User');
const { getStatus } = require('../config/db');

// In-memory fallback users database
const inMemoryUsers = [
  { id: '1', name: 'Demo User', email: 'demo@sentinel.io', role: 'admin' },
  { id: '2', name: 'Test Tester', email: 'test@sentinel.io', role: 'customer' }
];

const register = (sdk) => async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !name) {
      sdk.captureLog('ERROR', 'User Registration Failed - Missing Email or Name', { email });
      return res.status(400).json({ error: 'Name and email are required' });
    }

    let newUser;
    if (getStatus()) {
      newUser = await User.create({ name, email, password: password || 'secret123' });
    } else {
      newUser = { id: String(inMemoryUsers.length + 1), name, email, role: 'customer' };
      inMemoryUsers.push(newUser);
    }

    // Requirement: Generate "User Registered" log
    sdk.captureLog('INFO', 'User Registered', {
      userId: newUser.id || newUser._id,
      email: newUser.email,
      name: newUser.name
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: newUser
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'register' });
    next(err);
  }
};

const login = (sdk) => async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      sdk.captureLog('ERROR', 'Login Failed - Missing Email credentials');
      return res.status(400).json({ error: 'Email is required' });
    }

    // Requirement: Generate "User Logged In" log
    sdk.captureLog('INFO', 'User Logged In', {
      email,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      message: 'Login successful',
      token: 'jwt_mock_token_sentinel_demo_12345',
      user: { email }
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'login' });
    next(err);
  }
};

const getUsers = (sdk) => async (req, res, next) => {
  try {
    let users = [];
    if (getStatus()) {
      users = await sdk.startSpan('db.users.find', () => User.find().limit(20));
    } else {
      users = inMemoryUsers;
    }

    sdk.captureLog('INFO', 'Users List Retrieved', { count: users.length });

    return res.status(200).json({
      status: 'success',
      count: users.length,
      users
    });
  } catch (err) {
    sdk.captureException(err, true, { action: 'getUsers' });
    next(err);
  }
};

module.exports = { register, login, getUsers };
