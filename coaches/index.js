// coaches/index.js
// Coach registry — import all coaches and export as array

import englishCoach from './english-coach.js';
import clarityCoach from './clarity-coach.js';
import decisionCoach from './decision-coach.js';
import debateCoach from './debate-coach.js';
import stoicCoach from './stoic-coach.js';
import scrumCoach from './scrum-coach.js';
import systemsThinkingCoach from './systems-thinking-coach.js';
import toneRewriter from './tone-rewriter.js';
import translatorCoach from './translator-coach.js';

// All built-in coaches in display order
export const coaches = [
  englishCoach,
  clarityCoach,
  decisionCoach,
  debateCoach,
  stoicCoach,
  scrumCoach,
  systemsThinkingCoach,
  toneRewriter,
  translatorCoach
];

export function getCoachById(id) {
  return coaches.find(c => c.id === id) || null;
}

export default coaches;
