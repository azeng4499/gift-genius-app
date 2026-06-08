export type UserContextState = {
  /** Backend users.id (UUID string). */
  userId: string | null;
  /** Active recipient profile id (UUID). Was feedId in the old API. */
  profileId: string | null;
  /** Active feed session id (UUID) for GET /feed/:session_id. */
  sessionId: string | null;
  /** Backend JWT from POST /auth/token. */
  accessToken: string | null;
};

const userContextState: UserContextState = {
  userId: null,
  profileId: null,
  sessionId: null,
  accessToken: null,
};

const listeners = new Set<(state: UserContextState) => void>();

function notifyListeners() {
  const snapshot = getUserContext();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function getUserContext(): UserContextState {
  return { ...userContextState };
}

export function setCurrentUser(userId: string | null) {
  userContextState.userId = userId;
  notifyListeners();
}

/** @deprecated Use setCurrentProfile — kept as alias during migration. */
export function setCurrentFeed(profileId: string | null) {
  setCurrentProfile(profileId);
}

export function setCurrentProfile(profileId: string | null) {
  userContextState.profileId = profileId;
  notifyListeners();
}

export function setCurrentSession(sessionId: string | null) {
  userContextState.sessionId = sessionId;
  notifyListeners();
}

export function clearUserContext() {
  userContextState.userId = null;
  userContextState.profileId = null;
  userContextState.sessionId = null;
  userContextState.accessToken = null;
  notifyListeners();
}

export function getCurrentUserId() {
  return userContextState.userId;
}

/** @deprecated Use getCurrentProfileId — kept as alias during migration. */
export function getCurrentFeedId() {
  return getCurrentProfileId();
}

export function getCurrentProfileId() {
  return userContextState.profileId;
}

export function getCurrentSessionId() {
  return userContextState.sessionId;
}

export function setAccessToken(accessToken: string | null) {
  userContextState.accessToken = accessToken;
  notifyListeners();
}

export function getAccessToken() {
  return userContextState.accessToken;
}

export function subscribeUserContext(
  listener: (state: UserContextState) => void
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
