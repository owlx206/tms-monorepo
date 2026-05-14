import {
  CodeforcesClient,
  type CodeforcesCredentials,
  resolveCodeforcesCredentials,
} from '../../../../infrastructure/external/codeforces/codeforces-api.service.js';

class DefaultCodeforcesGateway {
  constructor(private readonly codeforcesClient: CodeforcesClient) {}

  fetchGymMetadata(gymId: string) {
    return this.codeforcesClient.fetchGymMetadata(gymId);
  }
}

export class DefaultCodeforcesGatewayFactory {
  create(credentials: CodeforcesCredentials | null): DefaultCodeforcesGateway {
    return new DefaultCodeforcesGateway(
      new CodeforcesClient(
        credentials
          ? resolveCodeforcesCredentials(credentials.apiKey, credentials.apiSecret)
          : null,
      ),
    );
  }
}
