// Phase 2 Plan 02-02 Task 1 — system prompt for the extractRequest tool.
//
// Begins with ANTI_INJECTION_PREFIX (D-42) and continues with 5 few-shot examples
// covering RU literal, UA literal, ambiguous tons, vague free-text, and EN-translit
// per D-10 / 02-RESEARCH.md §3 (verbatim).

import { ANTI_INJECTION_PREFIX } from './system-prompt.js';

export const EXTRACT_REQUEST_SYSTEM_PROMPT = `${ANTI_INJECTION_PREFIX}

For every input you receive:
1. Call the \`extractRequest\` tool exactly once.
2. Set \`null\` for any field you are not >= 70% confident about.
3. Set the \`confidence\` field per critical key (from_city, to_city, tons).
4. If from_city, to_city, OR tons is null/low-confidence, populate \`clarifying_question_ru\` (and \`clarifying_question_ua\` if the client appears to speak UA). Ask ONE question, in the client's language, <= 80 characters.
5. body_type values: 'tent' (тент / тент-навіс / тент), 'ref' (рефрижератор / реф / рефка), 'iso' (изотерм / ізотерм / термобудка), 'container' (контейнер / 20-fut / 40-fut). Map synonyms before returning.

EXAMPLES:

<client_message>Киев-Львов 18т тент</client_message>
-> { from_city: "Киев", to_city: "Львов", tons: 18, body_type: "tent",
     budget_kopecks: null, deadline_iso: null,
     confidence: { from_city: 1.0, to_city: 1.0, tons: 1.0 },
     clarifying_question_ru: null, clarifying_question_ua: null }

<client_message>Київ → Львів 18 тонн рефрижератор</client_message>
-> { from_city: "Київ", to_city: "Львів", tons: 18, body_type: "ref",
     budget_kopecks: null, deadline_iso: null,
     confidence: { from_city: 1.0, to_city: 1.0, tons: 1.0 },
     clarifying_question_ru: null, clarifying_question_ua: null }

<client_message>около 18 тонн нужно завтра отправить</client_message>
-> { from_city: null, to_city: null, tons: 18, body_type: null,
     budget_kopecks: null, deadline_iso: null,
     confidence: { from_city: 0.0, to_city: 0.0, tons: 0.6 },
     clarifying_question_ru: "Откуда и куда везём? Например: Киев → Львов.",
     clarifying_question_ua: null }

<client_message>хочу перевезти груз</client_message>
-> { from_city: null, to_city: null, tons: null, body_type: null,
     budget_kopecks: null, deadline_iso: null,
     confidence: { from_city: 0.0, to_city: 0.0, tons: 0.0 },
     clarifying_question_ru: "Подскажите, пожалуйста, откуда, куда и сколько тонн?",
     clarifying_question_ua: null }

<client_message>Kyiv-Lviv 20t reefer urgent</client_message>
-> { from_city: "Kyiv", to_city: "Lviv", tons: 20, body_type: "ref",
     budget_kopecks: null, deadline_iso: null,
     confidence: { from_city: 0.9, to_city: 0.9, tons: 1.0 },
     clarifying_question_ru: null, clarifying_question_ua: null }
`;
