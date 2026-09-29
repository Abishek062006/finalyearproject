/**
 * Set right after a parent creates an account, so the parent space opens
 * straight into child setup instead of an empty home screen — the way a
 * device's setup assistant follows sign-in. Read once, then cleared.
 */
let pending = false;

export const onboardingFlag = {
  set(): void {
    pending = true;
  },
  consume(): boolean {
    const was = pending;
    pending = false;
    return was;
  },
};
