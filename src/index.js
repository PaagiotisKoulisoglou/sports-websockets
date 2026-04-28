import express from 'express';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Sportes API is up!');
});

// Start server and log URL
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server is running at ${url}`);
});
