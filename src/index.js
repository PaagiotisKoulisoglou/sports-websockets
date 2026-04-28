import express from 'express';

const PORT = 8000;
const app = express();

// Use JSON middleware
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Server is up and running');
});

// Start server and log URL
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server started at ${url}`);
});
