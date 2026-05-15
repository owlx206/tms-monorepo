import { ServiceError } from '../../../../shared/errors/service.error.js';

type DiscordInstallStatePayload = {
  discord_user_id: string;
};

export function signDiscordInstallState(payload: DiscordInstallStatePayload): string {
  return payload.discord_user_id;
}

export function verifyDiscordInstallState(state: string): DiscordInstallStatePayload {
  const discordUserId = state.trim();
  if (!/^\d{15,25}$/.test(discordUserId)) {
    throw new ServiceError('invalid discord install state', 400);
  }

  return {
    discord_user_id: discordUserId,
  };
}
