require('dotenv').config();
const { buildApp } = require('./app');

const app = buildApp();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de Sabias que PR escuchando en http://localhost:${PORT}`);
});
