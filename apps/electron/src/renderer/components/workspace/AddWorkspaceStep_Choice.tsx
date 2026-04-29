import { useTranslation } from "react-i18next"
import { FolderPlus, FolderOpen, Cloud, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddWorkspaceContainer, AddWorkspaceStepHeader } from "./primitives"

interface AddWorkspaceStep_ChoiceProps {
  onCreateNew: () => void
  onOpenFolder: () => void
  onConnectRemote: () => void
}

interface ChoiceCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

function ChoiceCard({ icon, title, description, onClick, variant = 'secondary' }: ChoiceCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-start gap-4 overflow-hidden rounded-[18px] border p-4 text-left",
        "transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === 'primary'
          ? "border-accent/30 bg-accent/[0.07] shadow-middle hover:-translate-y-0.5 hover:bg-accent/[0.09] hover:shadow-strong"
          : "border-border/60 bg-background/75 shadow-minimal hover:-translate-y-0.5 hover:border-border hover:bg-background hover:shadow-middle"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          variant === 'primary' ? "via-accent/45" : "via-foreground/10"
        )}
      />
      <div className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border",
        variant === 'primary'
          ? "border-accent/25 bg-accent/12 text-accent"
          : "border-border/60 bg-foreground/[0.03] text-foreground/70"
      )}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-medium text-[15px] leading-5 text-foreground">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-muted-foreground">{description}</div>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
          variant === 'primary'
            ? "border-accent/25 bg-background/70 text-accent group-hover:translate-x-0.5"
            : "border-border/60 bg-background/70 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground"
        )}
      >
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  )
}

/**
 * AddWorkspaceStep_Choice - Initial step to choose creation method
 *
 * Two options:
 * 1. Create new workspace - Creates a fresh workspace folder
 * 2. Open folder as workspace - Use an existing folder
 */
export function AddWorkspaceStep_Choice({
  onCreateNew,
  onOpenFolder,
  onConnectRemote,
}: AddWorkspaceStep_ChoiceProps) {
  const { t } = useTranslation()
  return (
    <AddWorkspaceContainer>
      <div className="mt-2" />
      <AddWorkspaceStepHeader
        title={t("workspace.addWorkspace")}
        description={t("workspace.addWorkspaceDesc")}
      />

      <div className="mt-8 w-full space-y-3.5">
        <ChoiceCard
          icon={<FolderPlus className="h-5 w-5" />}
          title={t("workspace.createNew")}
          description={t("workspace.createNewDesc")}
          onClick={onCreateNew}
          variant="primary"
        />

        <ChoiceCard
          icon={<FolderOpen className="h-5 w-5" />}
          title={t("workspace.openFolder")}
          description={t("workspace.openFolderDesc")}
          onClick={onOpenFolder}
        />

        <ChoiceCard
          icon={<Cloud className="h-5 w-5" />}
          title={t("workspace.connectRemote")}
          description={t("workspace.connectRemoteDesc")}
          onClick={onConnectRemote}
        />
      </div>
    </AddWorkspaceContainer>
  )
}
