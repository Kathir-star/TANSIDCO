import app from './api/index.js';
app.listen(3001, () => {
  console.log('Test server running');
  process.exit(0);
});
