# Vocabulary sync capability

## Requirements

### Requirement: Local-first custom vocabulary
The app MUST create, edit, load and delete custom vocabulary lists without an internet connection. A successful local edit MUST remain available after the app is restarted.

#### Scenario: Edit while offline
- GIVEN a previously installed app with local storage available
- WHEN the user edits a custom list while disconnected
- THEN the edit is persisted locally without waiting for a cloud response
- AND the edit is available after restarting offline.

### Requirement: Safe migration
The app MUST preserve existing localStorage custom lists when moving to the new local persistence layer. Migration MUST be idempotent.

#### Scenario: Retry migration
- GIVEN legacy lists exist and a migration was partially completed
- WHEN migration runs again
- THEN existing list/item identities are reused and no duplicate list or item is created
- AND legacy data is not removed until the new local copy has been verified.

### Requirement: Eventual cross-device sync
When a user is authenticated and a sync service is configured, local changes MUST be uploaded when connectivity returns and remote changes MUST be downloaded. Temporary network errors MUST NOT discard pending changes.

#### Scenario: Reconnect after offline edits
- GIVEN the user adds vocabulary offline
- WHEN internet access returns
- THEN pending changes are eventually uploaded and appear on another authenticated device.

### Requirement: Concurrent vocabulary additions
The data model MUST represent each vocabulary item independently with a stable ID, so unrelated concurrent additions do not overwrite an entire list snapshot.

#### Scenario: Add on two disconnected devices
- GIVEN two authenticated devices start with the same list
- WHEN each device adds a different word while offline and later reconnects
- THEN both words are retained after synchronisation.

### Requirement: Deletion propagation
The sync model MUST retain deletion tombstones until deletion propagation is safe, preventing stale disconnected devices from resurrecting deleted records.

#### Scenario: Delete while another device is offline
- GIVEN a list or item is deleted on one device
- WHEN another device reconnects with stale data
- THEN the deleted record is not silently recreated.

### Requirement: User data isolation
Cloud reads and writes MUST be scoped to the authenticated owner. Client code MUST NOT contain service-role keys or database credentials.

#### Scenario: Attempt cross-user access
- GIVEN two different authenticated users
- WHEN one user queries or modifies another user's vocabulary rows
- THEN Postgres access policies reject or filter the request.

### Requirement: Local-only features remain available
Bundled TOCFL decks, custom vocabulary import/export and practice MUST remain usable offline. Cloud sync is optional and does not block local practice.
