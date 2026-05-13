import type {
  ComposerQuickActionWrapperId,
  ProductMode,
  ProductModeIntent,
} from './product-mode-toolbar';

export const COMPOSER_QUICK_ACTION_SECTION_LABELS = [
  'Исходный запрос',
  'Контекст',
  'Инструкция',
  'Формат результата',
] as const;

export type ComposerQuickActionContextKind = 'follow-up' | 'attachment' | 'source';

export interface ComposerQuickActionContextItem {
  kind: ComposerQuickActionContextKind;
  label: string;
  text?: string;
  path?: string;
  slug?: string;
}

export interface ComposerQuickActionPromptInput {
  intent: ProductModeIntent;
  rawInput: string;
  selectedMode: ProductMode;
  contextItems?: ComposerQuickActionContextItem[];
  workingDirectory?: string;
  sessionLabels?: string[];
  currentSessionStatus?: string;
}

export type ComposerQuickActionPromptResult =
  | {
      ok: true;
      prompt: string;
      targetKind: 'input' | ComposerQuickActionContextKind;
      targetLabel: string;
      targetText: string;
    }
  | {
      ok: false;
      reason: 'unsupported-intent' | 'empty-target';
      message: string;
    };

interface ComposerQuickActionTarget {
  kind: 'input' | ComposerQuickActionContextKind;
  label: string;
  text: string;
}

interface ComposerQuickActionCopy {
  heading: string;
  instruction: string;
  format: string;
}

const QUICK_ACTION_COPY: Record<ComposerQuickActionWrapperId, ComposerQuickActionCopy> = {
  'improve-prompt': {
    heading: 'Улучшить запрос',
    instruction: [
      'Перепиши исходный запрос так, чтобы агент мог выполнить его без лишних уточнений.',
      'Сохрани намерение пользователя, добавь недостающий контекст, критерии приемки и проверку результата.',
      'Не превращай задачу в отдельный режим или экран: это только улучшение текущего запроса.',
    ].join(' '),
    format: 'Верни один готовый промпт. Если есть риск неверного предположения, добавь короткий блок "Нужно уточнить".',
  },
  'tdd-plan': {
    heading: 'TDD план',
    instruction: [
      'Составь рабочий TDD-план для исходного запроса.',
      'Начни с минимального failing test или validation check, затем опиши green implementation, targeted verification и worklog evidence.',
    ].join(' '),
    format: 'Верни компактный план с секциями Red, Green, Verify, Worklog и Acceptance matrix.',
  },
  verify: {
    heading: 'Проверить',
    instruction: [
      'Проверь исходный запрос или выбранный контекст на логические, фактические, технические и UX-риски.',
      'Отдели подтвержденное от предположений и укажи, какие проверки нужно запустить.',
    ].join(' '),
    format: 'Верни verdict, findings by severity, exact checks, residual risks и next action.',
  },
  'tear-down': {
    heading: 'Разъебать',
    instruction: [
      'Жестко раскритикуй исходный запрос или решение перед исполнением.',
      'Ищи лишние сущности, слабые предположения, визуальный шум, неясные контракты, regressions и скрытую сложность.',
    ].join(' '),
    format: 'Верни список проблем по severity, root cause, точечную правку и что не трогать.',
  },
  spec: {
    heading: 'Собрать ТЗ',
    instruction: [
      'Преобразуй исходный запрос в исполнимое техническое задание.',
      'Сохрани функциональность, но убери лишний шум: выдели user outcome, boundaries, screens/components, data/state, tests и rollout.',
    ].join(' '),
    format: 'Верни PRD/TZ с acceptance criteria, non-goals, implementation notes и validation plan.',
  },
  review: {
    heading: 'Ревью',
    instruction: [
      'Проведи review исходного запроса или выбранного контекста перед исполнением.',
      'Сфокусируйся на correctness, UX friction, missing tests, regressions, security/privacy и maintainability.',
    ].join(' '),
    format: 'Верни findings first, затем open questions, suggested patch plan и tests to run.',
  },
};

export function createComposerQuickActionPrompt(
  input: ComposerQuickActionPromptInput,
): ComposerQuickActionPromptResult {
  if (input.intent.behavior !== 'wrap-prompt' || !input.intent.wrapperId) {
    return {
      ok: false,
      reason: 'unsupported-intent',
      message: 'Quick action expects a wrap-prompt intent.',
    };
  }

  const target = resolveQuickActionTarget(input.rawInput, input.contextItems ?? []);

  if (!target) {
    return {
      ok: false,
      reason: 'empty-target',
      message: 'Введите запрос или выберите конкретный фрагмент, файл или источник.',
    };
  }

  const copy = QUICK_ACTION_COPY[input.intent.wrapperId];
  const context = buildContextLines(input, target);
  const prompt = [
    `# ${copy.heading}`,
    '',
    `## ${COMPOSER_QUICK_ACTION_SECTION_LABELS[0]}`,
    target.text,
    '',
    `## ${COMPOSER_QUICK_ACTION_SECTION_LABELS[1]}`,
    context.length > 0 ? context.map(line => `- ${line}`).join('\n') : '- Дополнительный контекст не выбран.',
    '',
    `## ${COMPOSER_QUICK_ACTION_SECTION_LABELS[2]}`,
    copy.instruction,
    '',
    `## ${COMPOSER_QUICK_ACTION_SECTION_LABELS[3]}`,
    copy.format,
  ].join('\n');

  return {
    ok: true,
    prompt,
    targetKind: target.kind,
    targetLabel: target.label,
    targetText: target.text,
  };
}

function resolveQuickActionTarget(
  rawInput: string,
  contextItems: ComposerQuickActionContextItem[],
): ComposerQuickActionTarget | null {
  const normalizedInput = normalizeMultiline(rawInput);

  if (normalizedInput) {
    return {
      kind: 'input',
      label: 'Composer input',
      text: normalizedInput,
    };
  }

  for (const item of contextItems) {
    const text = createContextItemText(item);
    if (!text) continue;

    return {
      kind: item.kind,
      label: item.label.trim() || item.kind,
      text,
    };
  }

  return null;
}

function createContextItemText(item: ComposerQuickActionContextItem): string {
  const label = item.label.trim();
  const text = normalizeMultiline(item.text ?? '');
  const path = normalizeMultiline(item.path ?? '');
  const slug = normalizeMultiline(item.slug ?? '');
  const summary = [label, path, slug ? `slug: ${slug}` : ''].filter(Boolean).join('\n');

  if (text && summary) return `${text}\n\n${summary}`;
  if (text) return text;
  return summary;
}

function buildContextLines(
  input: ComposerQuickActionPromptInput,
  target: ComposerQuickActionTarget,
): string[] {
  const lines = [
    `Быстрая команда: ${input.intent.wrapperId}`,
    `Целевой режим: ${input.intent.mode}`,
    `Текущий режим composer: ${input.selectedMode}`,
    `Источник цели: ${target.kind} (${target.label})`,
  ];
  const workingDirectory = normalizeMultiline(input.workingDirectory ?? '');
  const sessionLabels = input.sessionLabels?.map(label => label.trim()).filter(Boolean) ?? [];
  const currentSessionStatus = normalizeMultiline(input.currentSessionStatus ?? '');
  const contextItems = input.contextItems ?? [];

  if (workingDirectory) {
    lines.push(`Work in Folder: ${workingDirectory}`);
  }

  if (sessionLabels.length > 0) {
    lines.push(`Метки сессии: ${sessionLabels.join(', ')}`);
  }

  if (currentSessionStatus) {
    lines.push(`Статус сессии: ${currentSessionStatus}`);
  }

  for (const item of contextItems) {
    const itemText = createContextItemText(item);
    if (!itemText) continue;
    lines.push(`${item.kind}: ${itemText.replace(/\n+/g, ' / ')}`);
  }

  return lines;
}

function normalizeMultiline(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}
