const express = require('express');
const { register, login } = require('../controllers/authController');

const createAuthRouter = (sdk) => {
  const router = express.Router();

  router.post('/register', register(sdk));
  router.post('/login', login(sdk));

  return router;
};

module.exports = createAuthRouter;
