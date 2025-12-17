const swagger = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API FITS',
      version: '1.0.0',
      description: "Documentation interactive de l'API FITS",
    },
    servers: [
      { url: 'http://localhost:3000' }
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swagger(options);
module.exports = swaggerSpec;
