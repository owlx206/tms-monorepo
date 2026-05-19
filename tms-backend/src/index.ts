import { main } from './server.js';

main().catch((error: unknown) => {
  console.error('Failed to initialize backend server');
  console.error(error);
  process.exit(1);
});
