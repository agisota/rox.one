import {
  DEFAULT_OPTION_GRAPH,
  OPTION_GRAPH_CATEGORIES,
  resolveOptionGraphExecutionConfig,
  resolveOptionGraphOptions,
  type OptionGraphCategory,
  type OptionGraphOption,
} from '@craft-agent/shared/workbench/option-graph';
import type { ProductMode } from '@craft-agent/shared/workbench/product-mode-registry';

export type SpecBuilderSource = 'manual' | 'prompt-rewrite' | 'thinking-partner';

export interface SpecBuilderStateInput {
  source: SpecBuilderSource;
  rawInput: string;
  modeId: ProductMode;
  selectedOptionIds?: string[];
}

export interface SpecBuilderCategoryGroup {
  category: OptionGraphCategory;
  label: string;
  options: OptionGraphOption[];
}

export interface SpecBuilderState {
  source: SpecBuilderSource;
  rawInput: string;
  modeId: ProductMode;
  selectedOptionIds: string[];
  selectedOptions: OptionGraphOption[];
  availableOptionIds: string[];
  categoryGroups: SpecBuilderCategoryGroup[];
  derivedConfig?: ReturnType<typeof resolveOptionGraphExecutionConfig>;
  preview: string;
  canExport: boolean;
}

const CATEGORY_LABELS: Record<OptionGraphCategory, string> = {
  output_type: 'Output type',
  depth: 'Depth',
  audience: 'Audience',
  format: 'Format',
  style: 'Style',
  design: 'Design',
  research_depth: 'Research depth',
  geography: 'Geography',
  recency: 'Recency',
  source_requirements: 'Source requirements',
  api_requirements: 'API requirements',
  security: 'Security',
  compliance: 'Compliance',
  testing: 'Testing',
  tdd: 'TDD',
  deliverables: 'Deliverables',
  diagrams: 'Diagrams',
  metrics: 'Metrics',
  risks: 'Risks',
  validation: 'Validation',
};

function uniquePreserveOrder(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function removeDependentOptions(selectedOptionIds: readonly string[], removedOptionId: string): string[] {
  const selectedSet = new Set(selectedOptionIds);
  selectedSet.delete(removedOptionId);

  let changed = true;
  while (changed) {
    changed = false;
    for (const option of DEFAULT_OPTION_GRAPH.options) {
      if (!selectedSet.has(option.id)) {
        continue;
      }
      if (option.requires.some((requiredOptionId) => !selectedSet.has(requiredOptionId))) {
        selectedSet.delete(option.id);
        changed = true;
      }
    }
  }

  return selectedOptionIds.filter((optionId) => selectedSet.has(optionId));
}

function addOption(selectedOptionIds: readonly string[], optionId: string): string[] {
  const option = DEFAULT_OPTION_GRAPH.options.find((candidate) => candidate.id === optionId);
  if (!option) {
    throw new Error(`Unknown option ${optionId}`);
  }

  const withoutExcluded = selectedOptionIds.filter((selectedOptionId) => !option.excludes.includes(selectedOptionId));
  return uniquePreserveOrder([...withoutExcluded, optionId]);
}

function getSelectedOptions(selectedOptionIds: readonly string[]): OptionGraphOption[] {
  return selectedOptionIds.map((optionId) => {
    const option = DEFAULT_OPTION_GRAPH.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      throw new Error(`Unknown option ${optionId}`);
    }
    return option;
  });
}

function buildCategoryGroups(availableOptionIds: readonly string[]): SpecBuilderCategoryGroup[] {
  const availableSet = new Set(availableOptionIds);
  return OPTION_GRAPH_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    options: DEFAULT_OPTION_GRAPH.options.filter((option) => option.category === category && availableSet.has(option.id)),
  })).filter((group) => group.options.length > 0);
}

export function createSpecBuilderState(input: SpecBuilderStateInput): SpecBuilderState {
  const selectedOptionIds = uniquePreserveOrder(input.selectedOptionIds ?? []);
  const selectedOptions = getSelectedOptions(selectedOptionIds);
  const available = resolveOptionGraphOptions({
    rawIntent: input.rawInput,
    modeId: input.modeId,
    selectedOptionIds,
  });
  const hasInput = input.rawInput.trim().length > 0;
  const canExport = hasInput && selectedOptionIds.length > 0;

  const derivedConfig = canExport
    ? resolveOptionGraphExecutionConfig({
        rawIntent: input.rawInput,
        modeId: input.modeId,
        permissionMode: input.modeId === 'build' ? 'ask' : 'safe',
        selectedOptionIds,
      })
    : undefined;

  const state: SpecBuilderState = {
    source: input.source,
    rawInput: input.rawInput.trim(),
    modeId: input.modeId,
    selectedOptionIds,
    selectedOptions,
    availableOptionIds: available.availableOptionIds,
    categoryGroups: buildCategoryGroups(available.availableOptionIds),
    derivedConfig,
    preview: '',
    canExport,
  };

  return {
    ...state,
    preview: createSpecBuilderPreview(state),
  };
}

export function toggleSpecBuilderOption(state: SpecBuilderState, optionId: string): SpecBuilderState {
  const selectedOptionIds = state.selectedOptionIds.includes(optionId)
    ? removeDependentOptions(state.selectedOptionIds, optionId)
    : addOption(state.selectedOptionIds, optionId);

  return createSpecBuilderState({
    source: state.source,
    rawInput: state.rawInput,
    modeId: state.modeId,
    selectedOptionIds,
  });
}

export function clearSpecBuilderOptions(state: SpecBuilderState): SpecBuilderState {
  return createSpecBuilderState({
    source: state.source,
    rawInput: state.rawInput,
    modeId: state.modeId,
    selectedOptionIds: [],
  });
}

export function createSpecBuilderPreview(state: Pick<SpecBuilderState, 'rawInput' | 'selectedOptions' | 'derivedConfig'>): string {
  const lines = ['# Spec Builder Preview', '', `## Input`, state.rawInput.trim() || '_No input provided._', ''];

  lines.push('## Selected requirements');
  if (state.selectedOptions.length === 0) {
    lines.push('_No requirements selected yet._');
  } else {
    for (const option of state.selectedOptions) {
      lines.push(`- ${option.label}`);
    }
  }

  lines.push('', '## Derived sections');
  if (!state.derivedConfig || state.derivedConfig.sections.length === 0) {
    lines.push('_Select options to generate sections._');
  } else {
    for (const section of state.derivedConfig.sections) {
      lines.push(`- ${section}`);
    }
  }

  lines.push('', '## Skills');
  if (!state.derivedConfig || state.derivedConfig.skills.length === 0) {
    lines.push('_Select options to derive skills._');
  } else {
    for (const skill of state.derivedConfig.skills) {
      lines.push(`- ${skill}`);
    }
  }

  lines.push('', '## Validation gates');
  if (!state.derivedConfig || state.derivedConfig.validationGates.length === 0) {
    lines.push('_Select options to derive validation gates._');
  } else {
    for (const gate of state.derivedConfig.validationGates) {
      lines.push(`- ${gate}`);
    }
  }

  return lines.join('\n');
}
