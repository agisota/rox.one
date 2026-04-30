import type { ValidationGate } from './product-mode-registry';
import {
  AgentPackageSchema,
  MissionRunSchema,
  paidEntitlementCanSatisfyValidationGate,
  ProgressLedgerSchema,
  SkillContractSchema,
  SubscriptionEntitlementSchema,
  type AgentPackage,
  type MissionRun,
  type ProgressLedger,
  type SkillContract,
  type SubscriptionEntitlement,
} from './experience-layer';

export type ExperienceLayerActor = {
  userId: string;
  teamIds: string[];
};

export function assertMissionAccess(input: {
  actor: ExperienceLayerActor;
  mission: MissionRun;
}): MissionRun {
  const mission = MissionRunSchema.parse(input.mission);
  if (mission.teamId) {
    assertActorInTeam(input.actor, mission.teamId, 'Actor cannot access mission across tenant boundary.');
    return mission;
  }

  if (mission.ownerUserId !== input.actor.userId) {
    throw new Error('Actor cannot access mission owned by another user.');
  }

  return mission;
}

export function assertPackageVisibilityAccess(input: {
  actor: ExperienceLayerActor;
  package: AgentPackage;
}): AgentPackage {
  const pkg = AgentPackageSchema.parse(input.package);
  if (pkg.visibility === 'built_in' || pkg.visibility === 'public') return pkg;

  if (pkg.visibility === 'private' && pkg.ownerUserId) {
    if (pkg.ownerUserId !== input.actor.userId) {
      throw new Error('Actor cannot access package owned by another user.');
    }
    return pkg;
  }

  if (!pkg.ownerTeamId) {
    throw new Error('Private or team package must have an owner team.');
  }

  assertActorInTeam(input.actor, pkg.ownerTeamId, 'Actor cannot access package across tenant boundary.');
  return pkg;
}

export function assertLedgerEntryActor(input: {
  actor: ExperienceLayerActor;
  entry: ProgressLedger;
}): ProgressLedger {
  const entry = ProgressLedgerSchema.parse(input.entry);

  if (entry.userId && entry.userId !== input.actor.userId) {
    throw new Error('Actor cannot write ledger entry for another user.');
  }

  if (entry.teamId) {
    assertActorInTeam(input.actor, entry.teamId, 'Actor cannot write ledger entry for another team.');
  }

  return entry;
}

export function assertEntitlementCannotSatisfyGate(input: {
  entitlement: SubscriptionEntitlement;
  gateId: ValidationGate;
}): never {
  const entitlement = SubscriptionEntitlementSchema.parse(input.entitlement);
  paidEntitlementCanSatisfyValidationGate(entitlement, input.gateId);
  throw new Error('Paid entitlements cannot satisfy validation gates.');
}

export function assertPackagePermissionProfile(input: {
  contract: SkillContract;
  allowedPermissions: string[];
}): SkillContract {
  const contract = SkillContractSchema.parse(input.contract);
  const allowed = new Set(input.allowedPermissions);
  const denied = contract.requiredPermissions.filter((permission) => !allowed.has(permission));

  if (denied.length > 0) {
    throw new Error(`Package contract requests permissions outside the allowed profile: ${denied.join(', ')}.`);
  }

  return contract;
}

export function assertPublicPackagePublishable(input: {
  promptInjectionWarnings: string[];
}): true {
  if (input.promptInjectionWarnings.length > 0) {
    throw new Error('Prompt injection warnings block public package publish.');
  }

  return true;
}

function assertActorInTeam(actor: ExperienceLayerActor, teamId: string, message: string): void {
  if (!actor.teamIds.includes(teamId)) {
    throw new Error(message);
  }
}
