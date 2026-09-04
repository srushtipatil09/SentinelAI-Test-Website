// Custom middleware to attach request context
module.exports = function requestContextMiddleware(req, res, next) {
  req.requestTime = Date.now();
  next();
};
