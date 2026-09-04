/**
 * Legacy compatibility alias: re-exports Sentinel SDK as ObserveAIClient
 */
const { SentinelClient, SentinelAIClient, ObserveAIClient } = require('./sentinel-sdk');

module.exports = {
  SentinelClient,
  SentinelAIClient,
  ObserveAIClient
};
