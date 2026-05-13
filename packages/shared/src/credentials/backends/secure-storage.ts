/**
 * Secure Storage Backend
 *
 * Stores credentials in encrypted files rooted at the ROX config directory.
 * Local single-user credentials stay at ~/.rox/credentials.enc by default;
 * workspace-scoped credentials can opt into tenant-prefixed files.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Encryption key is derived from OS-native hardware UUID using PBKDF2:
 * - macOS: IOPlatformUUID (tied to logic board, never changes)
 * - Windows: MachineGuid from registry (set at OS install)
 * - Linux: /var/lib/dbus/machine-id (set at OS install)
 *
 * This is more stable than the previous hostname-based derivation, which could
 * change with network/DHCP. Legacy credentials are auto-migrated on first load.
 *
 * File format:
 *   [Header - 64 bytes]
 *   ├── Magic: "ROX01\0" (8 bytes)
 *   ├── Flags: uint32 LE (4 bytes) - reserved for future use
 *   ├── Salt: 32 bytes (PBKDF2 salt)
 *   ├── Reserved: 20 bytes
 *   [Encrypted Payload]
 *   ├── IV: 12 bytes (random per write)
 *   ├── Auth Tag: 16 bytes (GCM authentication)
 *   └── Ciphertext: variable (encrypted JSON)
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  hkdfSync,
  createHash,
} from 'crypto';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { hostname, userInfo, homedir } from 'os';
import { join, dirname } from 'path';

import type { CredentialBackend } from './types.ts';
import type { CredentialId, StoredCredential } from '../types.ts';
import { credentialIdToAccount, accountToCredentialId } from '../types.ts';
import { getConfigDir } from '../../config/paths.ts';
import {
  DEFAULT_LOCAL_SCOPE,
  type BrandedWorkspaceScope,
} from '../../config/storage-scope.ts';
import { isMultiTenantActivated } from '../../config/storage-scope-runtime.ts';
import { createLogger } from '../../utils/debug.ts';

// File format constants
const MAGIC_BYTES = Buffer.from('ROX01\0');
const HEADER_SIZE = 64;
const MAGIC_SIZE = 8;
const FLAGS_SIZE = 4;
const SALT_SIZE = 32;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const KEY_SIZE = 32;
const TENANT_CREDENTIAL_KDF_VERSION = 1;
const TENANT_CREDENTIAL_KDF_INFO = Buffer.from('rox.credentials.v1');

// PBKDF2 iterations (balance security vs startup time)
const PBKDF2_ITERATIONS = 100000;

const log = createLogger('credentials');

/**
 * Get stable machine identifier using OS-native hardware UUID.
 * This is far more stable than hostname which can change with network/DHCP.
 * Falls back to username + homedir if hardware UUID unavailable.
 */
function getStableMachineId(): string {
  try {
    if (process.platform === 'darwin') {
      // macOS: IOPlatformUUID - tied to logic board, never changes
      const output = execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match?.[1]) return match[1];
    } else if (process.platform === 'win32') {
      // Windows: MachineGuid from registry - set at OS install
      const output = execSync(
        'reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (match?.[1]) return match[1];
    } else {
      // Linux: dbus machine-id - set at OS install
      const machineIdPath = '/var/lib/dbus/machine-id';
      const altPath = '/etc/machine-id';
      if (existsSync(machineIdPath)) {
        return readFileSync(machineIdPath, 'utf-8').trim();
      } else if (existsSync(altPath)) {
        return readFileSync(altPath, 'utf-8').trim();
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: username + homedir (stable enough for most cases)
  return `${userInfo().username}:${homedir()}`;
}

/** Internal credential store structure */
interface CredentialStore {
  version: 1 | 2;
  credentials: Record<string, StoredCredential>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    kdfVersion?: 1;
    workspaceId?: string;
  };
}

export interface SecureStorageBackendOptions {
  readonly priority?: number;
}

export class SecureStorageBackend implements CredentialBackend {
  readonly name = 'secure-storage';
  readonly priority: number;

  private cachedStore: CredentialStore | null = null;
  private encryptionKey: Buffer | null = null;
  private encryptionKeyCacheId: string | null = null;
  private salt: Buffer | null = null;

  constructor(
    private readonly scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE,
    options: SecureStorageBackendOptions = {},
  ) {
    this.priority = options.priority ?? 100;
  }

  async isAvailable(): Promise<boolean> {
    // File backend is always available - we can always write to filesystem
    return true;
  }

  async get(id: CredentialId): Promise<StoredCredential | null> {
    const store = await this.loadStore();
    if (!store) {
      this.emitTenantAudit('credential.scope.read', {
        credentialType: id.type,
        hit: false,
      });
      return null;
    }

    const key = credentialIdToAccount(id);
    const credential = store.credentials[key] || null;
    this.emitTenantAudit('credential.scope.read', {
      credentialType: id.type,
      hit: credential !== null,
    });
    return credential;
  }

  async set(id: CredentialId, credential: StoredCredential): Promise<void> {
    let store = await this.loadStore();

    if (!store) {
      // Initialize new store
      store = this.createEmptyStore();
    }

    const key = credentialIdToAccount(id);
    store.credentials[key] = credential;
    this.applyScopeMetadata(store);
    store.metadata.updatedAt = Date.now();

    await this.saveStore(store);
    this.emitTenantAudit('credential.scope.write', {
      credentialType: id.type,
    });
  }

  async delete(id: CredentialId): Promise<boolean> {
    const store = await this.loadStore();
    if (!store) {
      this.emitTenantAudit('credential.scope.delete', {
        credentialType: id.type,
        deleted: false,
      });
      return false;
    }

    const key = credentialIdToAccount(id);
    if (!(key in store.credentials)) {
      this.emitTenantAudit('credential.scope.delete', {
        credentialType: id.type,
        deleted: false,
      });
      return false;
    }

    delete store.credentials[key];
    this.applyScopeMetadata(store);
    store.metadata.updatedAt = Date.now();

    await this.saveStore(store);
    this.emitTenantAudit('credential.scope.delete', {
      credentialType: id.type,
      deleted: true,
    });
    return true;
  }

  async list(filter?: Partial<CredentialId>): Promise<CredentialId[]> {
    const store = await this.loadStore();
    if (!store) {
      this.emitTenantAudit('credential.scope.list', {
        credentialType: filter?.type,
        count: 0,
      });
      return [];
    }

    const ids = Object.keys(store.credentials)
      .map(accountToCredentialId)
      .filter((id): id is CredentialId => id !== null);

    if (!filter) {
      this.emitTenantAudit('credential.scope.list', {
        count: ids.length,
      });
      return ids;
    }

    const filtered = ids.filter((id) => {
      if (filter.type && id.type !== filter.type) return false;
      if (filter.workspaceId && id.workspaceId !== filter.workspaceId) return false;
      if (filter.name && id.name !== filter.name) return false;
      return true;
    });
    this.emitTenantAudit('credential.scope.list', {
      credentialType: filter.type,
      count: filtered.length,
    });
    return filtered;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async loadStore(): Promise<CredentialStore | null> {
    // Return cached store if available
    if (this.cachedStore) return this.cachedStore;

    const credentialsFile = this.getCredentialsFile();
    if (!existsSync(credentialsFile)) return null;

    let fileData: Buffer;
    try {
      fileData = readFileSync(credentialsFile);
    } catch {
      return null;
    }

    // Validate minimum size
    if (fileData.length < HEADER_SIZE + IV_SIZE + AUTH_TAG_SIZE) {
      // File is corrupted, delete and return null
      this.handleCorruptedFile();
      return null;
    }

    // Validate magic bytes
    if (!fileData.subarray(0, MAGIC_SIZE).equals(MAGIC_BYTES)) {
      this.handleCorruptedFile();
      return null;
    }

    // Parse header
    // const flags = fileData.readUInt32LE(MAGIC_SIZE); // Reserved for future use
    const salt = fileData.subarray(MAGIC_SIZE + FLAGS_SIZE, MAGIC_SIZE + FLAGS_SIZE + SALT_SIZE);
    this.salt = salt;

    // Extract encrypted data
    const encryptedData = fileData.subarray(HEADER_SIZE);

    // Try new stable key first (v2 - hardware UUID based)
    const newKey = this.getEncryptionKey(salt);
    let store = this.tryDecrypt(encryptedData, newKey);

    if (store) {
      this.cachedStore = store;
      return store;
    }

    if (!this.getTenantWorkspaceId()) {
      // Try legacy key for migration (v1 - included hostname).
      // This handles flat credentials encrypted with old key derivation. Tenant
      // files intentionally do not try local legacy keys because copied flat or
      // cross-tenant files must not decrypt under a workspace scope.
      const legacyKey = this.getLegacyEncryptionKey(salt);
      store = this.tryDecrypt(encryptedData, legacyKey);

      if (store) {
        // Migration: re-save with new stable key so future loads use hardware UUID
        this.cachedStore = store;
        await this.saveStore(store);
        return store;
      }
    }

    // Both keys failed - file is truly corrupted
    this.handleCorruptedFile();
    return null;
  }

  /**
   * Attempt to decrypt data with given key.
   * Returns parsed store on success, null on failure.
   */
  private tryDecrypt(encryptedData: Buffer, key: Buffer): CredentialStore | null {
    try {
      const iv = encryptedData.subarray(0, IV_SIZE);
      const authTag = encryptedData.subarray(IV_SIZE, IV_SIZE + AUTH_TAG_SIZE);
      const ciphertext = encryptedData.subarray(IV_SIZE + AUTH_TAG_SIZE);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch {
      return null;
    }
  }

  private async saveStore(store: CredentialStore): Promise<void> {
    const credentialsFile = this.getCredentialsFile();
    // Ensure directory exists
    const credentialsDir = dirname(credentialsFile);
    if (!existsSync(credentialsDir)) {
      mkdirSync(credentialsDir, { recursive: true, mode: 0o700 });
    }

    // Use existing salt or generate new one
    const salt = this.salt || randomBytes(SALT_SIZE);
    this.salt = salt;

    // Get encryption key
    const key = this.getEncryptionKey(salt);

    // Serialize payload
    const plaintext = Buffer.from(JSON.stringify(store), 'utf8');

    // Generate new IV for each write (critical for GCM security)
    const iv = randomBytes(IV_SIZE);

    // Encrypt
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Build header
    const header = Buffer.alloc(HEADER_SIZE);
    MAGIC_BYTES.copy(header, 0);
    header.writeUInt32LE(0, MAGIC_SIZE); // Flags (reserved)
    salt.copy(header, MAGIC_SIZE + FLAGS_SIZE);

    // Combine all parts
    const fileData = Buffer.concat([header, iv, authTag, ciphertext]);

    // Write with restrictive permissions (owner read/write only)
    writeFileSync(credentialsFile, fileData, { mode: 0o600 });
    this.cachedStore = store;
  }

  private getEncryptionKey(salt: Buffer): Buffer {
    const tenantWorkspaceId = this.getTenantWorkspaceId();
    const cacheId = `${tenantWorkspaceId ?? 'local'}:${salt.toString('hex')}`;
    if (this.encryptionKey && this.encryptionKeyCacheId === cacheId) {
      return this.encryptionKey;
    }

    // New stable machine ID using hardware UUID (v2)
    // This is far more stable than hostname which can change with network/DHCP
    const stableMachineId = createHash('sha256')
      .update(getStableMachineId())
      .update('rox-agent-v2') // Bumped version for new key derivation
      .digest();

    // Derive local master key using the existing PBKDF2 substrate.
    const masterKey = pbkdf2Sync(stableMachineId, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256');

    this.encryptionKey = tenantWorkspaceId
      ? Buffer.from(hkdfSync(
        'sha256',
        masterKey,
        Buffer.from(tenantWorkspaceId),
        TENANT_CREDENTIAL_KDF_INFO,
        KEY_SIZE,
      ))
      : masterKey;
    this.encryptionKeyCacheId = cacheId;

    return this.encryptionKey;
  }

  /**
   * Legacy key derivation for migration from v1 (included hostname).
   * Used to decrypt credentials from older versions before re-encrypting with stable key.
   */
  private getLegacyEncryptionKey(salt: Buffer): Buffer {
    const legacyMachineId = createHash('sha256')
      .update(hostname())
      .update(userInfo().username)
      .update(homedir())
      .update('rox-agent-v1')
      .digest();

    return pbkdf2Sync(legacyMachineId, salt, PBKDF2_ITERATIONS, KEY_SIZE, 'sha256');
  }

  private handleCorruptedFile(): void {
    // Delete corrupted file - user will need to re-enter credentials
    const credentialsFile = this.getCredentialsFile();
    try {
      if (existsSync(credentialsFile)) {
        unlinkSync(credentialsFile);
      }
    } catch {
      // Ignore deletion errors
    }
    this.cachedStore = null;
    this.encryptionKey = null;
    this.encryptionKeyCacheId = null;
    this.salt = null;
  }

  /** Clear cached data (for testing or forced refresh) */
  clearCache(): void {
    this.cachedStore = null;
    this.encryptionKey = null;
    this.encryptionKeyCacheId = null;
    this.salt = null;
  }

  private getCredentialsFile(): string {
    return join(this.getCredentialsDir(), 'credentials.enc');
  }

  private getCredentialsDir(): string {
    const tenantWorkspaceId = this.getTenantWorkspaceId();
    if (!tenantWorkspaceId) {
      return getConfigDir();
    }
    return join(getConfigDir(), 'tenants', tenantWorkspaceId);
  }

  private getTenantWorkspaceId(): string | null {
    if (this.scope.kind !== 'workspace' || !isMultiTenantActivated()) {
      return null;
    }
    return this.scope.workspaceId;
  }

  private createEmptyStore(): CredentialStore {
    const now = Date.now();
    const tenantWorkspaceId = this.getTenantWorkspaceId();
    if (!tenantWorkspaceId) {
      return {
        version: 1,
        credentials: {},
        metadata: {
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    return {
      version: 2,
      credentials: {},
      metadata: {
        createdAt: now,
        updatedAt: now,
        kdfVersion: TENANT_CREDENTIAL_KDF_VERSION,
        workspaceId: tenantWorkspaceId,
      },
    };
  }

  private applyScopeMetadata(store: CredentialStore): void {
    const tenantWorkspaceId = this.getTenantWorkspaceId();
    if (!tenantWorkspaceId) return;
    store.version = 2;
    store.metadata.kdfVersion = TENANT_CREDENTIAL_KDF_VERSION;
    store.metadata.workspaceId = tenantWorkspaceId;
  }

  private emitTenantAudit(event: string, payload: Record<string, unknown>): void {
    const tenantWorkspaceId = this.getTenantWorkspaceId();
    if (!tenantWorkspaceId) return;
    log.debug(JSON.stringify({
      level: 'trace',
      event,
      workspaceId: tenantWorkspaceId,
      ...payload,
    }));
  }
}
