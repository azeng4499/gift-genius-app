export type UserContextState = {
  userId: number | null;
  feedId: number | null;
  accessToken: string | null;
};

const userContextState: UserContextState = {
  userId: null,
  feedId: null,
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

export function setCurrentUser(userId: number | null) {
  userContextState.userId = userId;
  notifyListeners();
}

export function setCurrentFeed(feedId: number | null) {
  userContextState.feedId = feedId;
  notifyListeners();
}

export function clearUserContext() {
  userContextState.userId = null;
  userContextState.feedId = null;
  userContextState.accessToken = null;
  notifyListeners();
}

export function getCurrentUserId() {
  return userContextState.userId;
}

export function getCurrentFeedId() {
  return userContextState.feedId;
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
