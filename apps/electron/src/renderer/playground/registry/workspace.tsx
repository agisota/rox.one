import type { ComponentEntry } from './types'
import { AddWorkspaceStep_Choice } from '@/components/workspace/AddWorkspaceStep_Choice'

const noopHandler = () => console.log('[Playground] Workspace action triggered')

export const workspaceComponents: ComponentEntry[] = [
  {
    id: 'workspace-choice-step',
    name: 'AddWorkspaceStep_Choice',
    category: 'Agent Setup',
    description: 'Workspace entry choice with create, open-folder, and connect-remote actions',
    component: AddWorkspaceStep_Choice,
    props: [],
    variants: [],
    mockData: () => ({
      onCreateNew: noopHandler,
      onOpenFolder: noopHandler,
      onConnectRemote: noopHandler,
    }),
  },
]
