import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Key, Monitor, ArrowRight } from "lucide-react"
import { RoxAgentsSymbol } from "@/components/icons/RoxAgentsSymbol"
import { StepFormLayout } from "./primitives"

import claudeIcon from "@/assets/provider-icons/claude.svg"
import openaiIcon from "@/assets/provider-icons/openai.svg"
import copilotIcon from "@/assets/provider-icons/copilot.svg"

/**
 * The high-level provider choice the user makes on first launch.
 * This maps to one or more ApiSetupMethods downstream.
 */
export type ProviderChoice = 'claude' | 'chatgpt' | 'copilot' | 'api_key' | 'local'

interface ProviderOption {
  id: ProviderChoice
  name: string
  description: string
  icon: React.ReactNode
  featured?: boolean
}

const PROVIDER_ICONS: Record<ProviderChoice, React.ReactNode> = {
  claude: <img src={claudeIcon} alt="" className="size-5 rounded-[3px]" />,
  chatgpt: <img src={openaiIcon} alt="" className="size-5 rounded-[3px]" />,
  copilot: <img src={copilotIcon} alt="" className="size-5 rounded-[3px]" />,
  api_key: <Key className="size-5" />,
  local: <Monitor className="size-5" />,
}

interface ProviderSelectStepProps {
  /** Called when the user selects a provider */
  onSelect: (choice: ProviderChoice) => void
  /** Called when the user chooses to skip setup */
  onSkip?: () => void
}

/**
 * ProviderSelectStep — First screen after install.
 *
 * Welcomes the user and asks them to pick their subscription / auth method.
 * Selecting a card immediately advances to the next step.
 */
export function ProviderSelectStep({ onSelect, onSkip }: ProviderSelectStepProps) {
  const { t } = useTranslation()

  const PROVIDER_OPTIONS: ProviderOption[] = [
    {
      id: 'claude',
      name: t("onboarding.providerSelect.claudeProMax"),
      description: t("onboarding.providerSelect.claudeProMaxDesc"),
      icon: PROVIDER_ICONS.claude,
      featured: true,
    },
    {
      id: 'chatgpt',
      name: t("onboarding.providerSelect.codexChatGPT"),
      description: t("onboarding.providerSelect.codexChatGPTDesc"),
      icon: PROVIDER_ICONS.chatgpt,
      featured: true,
    },
    {
      id: 'copilot',
      name: t("onboarding.providerSelect.githubCopilot"),
      description: t("onboarding.providerSelect.githubCopilotDesc"),
      icon: PROVIDER_ICONS.copilot,
      featured: true,
    },
    {
      id: 'api_key',
      name: t("onboarding.providerSelect.otherProvider"),
      description: 'Anthropic, AWS Bedrock, OpenRouter, Google or any compatible provider.',
      icon: PROVIDER_ICONS.api_key,
    },
    {
      id: 'local',
      name: t("onboarding.providerSelect.localModel"),
      description: 'Run models locally with Ollama.',
      icon: PROVIDER_ICONS.local,
    },
  ]

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-10 top-2 h-24 rounded-full bg-accent/12 blur-3xl opacity-90" />
      <StepFormLayout
        iconElement={
          <div className="flex size-[72px] items-center justify-center rounded-[20px] border border-accent/20 bg-accent/10 shadow-minimal">
            <RoxAgentsSymbol className="size-10 text-accent" />
          </div>
        }
        title={t("onboarding.providerSelect.title")}
        description={t("onboarding.providerSelect.description")}
        className="relative overflow-hidden rounded-[28px] border border-border/50 bg-background/92 px-8 py-8 shadow-strong backdrop-blur-xl supports-[backdrop-filter]:bg-background/84"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent" />
        <div className="space-y-3.5">
          {PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={cn(
                "group relative flex w-full items-start gap-4 overflow-hidden rounded-[18px] border p-4 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                option.featured
                  ? "border-accent/25 bg-accent/[0.06] shadow-middle hover:-translate-y-0.5 hover:bg-accent/[0.08] hover:shadow-strong"
                  : "border-border/60 bg-foreground/[0.02] shadow-minimal hover:-translate-y-0.5 hover:border-border hover:bg-background hover:shadow-middle",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
                  option.featured ? "via-accent/45" : "via-foreground/10"
                )}
              />

              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[14px] border",
                  option.featured
                    ? "border-accent/20 bg-background/80 text-accent"
                    : "border-border/60 bg-background/80 text-muted-foreground"
                )}
              >
                {option.icon}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-medium leading-5 text-foreground">{option.name}</span>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {option.description}
                </p>
              </div>

              <div
                aria-hidden="true"
                className={cn(
                  "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                  option.featured
                    ? "border-accent/20 bg-background/75 text-accent group-hover:translate-x-0.5"
                    : "border-border/60 bg-background/75 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground"
                )}
              >
                <ArrowRight className="size-4" />
              </div>
            </button>
          ))}
        </div>

        {onSkip && (
          <div className="mt-5 text-center">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("onboarding.providerSelect.setupLater")}
            </button>
          </div>
        )}
      </StepFormLayout>
    </div>
  )
}
