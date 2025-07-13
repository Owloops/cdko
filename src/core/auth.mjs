/**
 * AWS authentication check
 */

import { $, quote } from 'zx';
import { logger } from '../utils/logger.mjs';
import { AuthenticationError } from '../utils/errors.mjs';

export async function checkAwsProfile(profile) {
  const result = await $`aws sts get-caller-identity --profile ${quote(profile)}`.quiet().nothrow();
  
  if (!result.ok) {
    const message = `AWS authentication failed for profile: ${profile}. Please run: aws sso login --profile ${profile}`;
    throw new AuthenticationError(message, profile);
  }

  try {
    const identity = JSON.parse(result.stdout);
    logger.success(`AWS profile authenticated: ${profile} (Account: ${identity.Account})`);
    return identity;
  } catch {
    logger.success(`AWS profile authenticated: ${profile}`);
    return null;
  }
}