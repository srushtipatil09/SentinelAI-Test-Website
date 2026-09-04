const express = require('express');
const {
  getRoot,
  getHealth,
  getAnalytics,
  triggerError,
  triggerSlow,
  triggerDatabaseError,
  triggerCrash,
  triggerStress
} = require('../controllers/testController');
const { getUsers } = require('../controllers/authController');

const createMainRouter = (sdk) => {
  const router = express.Router();

  router.get('/', getRoot(sdk));
  router.get('/health', getHealth(sdk));
  router.get('/users', getUsers(sdk));
  router.get('/analytics', getAnalytics(sdk));
  router.get('/error', triggerError(sdk));
  router.get('/slow', triggerSlow(sdk));
  router.get('/database', triggerDatabaseError(sdk));
  router.get('/crash', triggerCrash(sdk));
  router.get('/stress', triggerStress(sdk));

  return router;
};

module.exports = createMainRouter;
