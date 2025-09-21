/**
 * one.ai Package - AI-powered Topic Analysis for LAMA Electron
 *
 * This package provides AI-driven topic analysis capabilities including:
 * - Subject identification from conversations
 * - Keyword extraction
 * - Summary generation with versioning
 *
 * All operations run in Node.js main process with ONE.core integration
 */

// Models
const Subject = require('./models/Subject');
const Keyword = require('./models/Keyword');
const Summary = require('./models/Summary');

// Services
const TopicAnalyzer = require('./services/TopicAnalyzer');

// Storage
const SubjectStorage = require('./storage/subject-storage');
const SummaryStorage = require('./storage/summary-storage');
const KeywordStorage = require('./storage/keyword-storage');

module.exports = {
  // Models
  Subject,
  Keyword,
  Summary,

  // Services
  TopicAnalyzer,

  // Storage
  SubjectStorage,
  SummaryStorage,
  KeywordStorage,

  // Version
  version: '1.0.0'
};