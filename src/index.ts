import 'dotenv/config';

import App from './app';

const main = () => {
  const app = new App();
  app.start();
};

main();