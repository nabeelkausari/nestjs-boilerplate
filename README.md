# NestJS Microservices Boilerplate

A production-ready NestJS monorepo boilerplate with microservices architecture, featuring MongoDB, RabbitMQ, Redis, and API Gateway pattern. This boilerplate implements best practices for building scalable microservices with NestJS.

## Features

- 🏗️ **Monorepo Structure** using NestJS Workspaces
- 🚀 **Microservices Architecture**
  - API Gateway
  - Authentication Service
  - Notifications Service
- 🔐 **API Gateway Pattern**
  - Rate Limiting
  - Circuit Breaker
  - Request Routing
  - Service Health Monitoring
- 🔄 **Message Queue System** with RabbitMQ
- 💾 **Database Integration** with MongoDB & Mongoose
- 🚦 **Caching Layer** with Redis
- 🐳 **Docker Support** with Docker Compose
- 🔍 **Health Checks** for all services
- 📝 **API Documentation** with Swagger
- 🔧 **Development Tools**
  - ESLint & Prettier configuration
  - Jest for testing
  - Debug configuration
  - Hot Reload support

## Prerequisites

- Node.js (v18 or later)
- pnpm
- Docker and Docker Compose
- MongoDB
- Redis
- RabbitMQ

## Project Structure

```
.
├── apps/
│   ├── gateway/          # API Gateway Service
│   ├── auth/            # Authentication Service
│   └── notifications/   # Notifications Service
├── libs/
│   └── common/          # Shared modules and utilities
├── docker-compose.yaml
└── package.json
```

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd nestjs-boilerplate
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   - Copy `.env.example` to `.env` in each service directory
   - Update the variables as needed

4. **Start the services using Docker**

   ```bash
   docker-compose up -d
   ```

   This will start:

   - API Gateway (port 3000)
   - Auth Service (port 3001)
   - Notifications Service (port 3002)
   - MongoDB (port 27018)
   - Redis (port 6379)
   - RabbitMQ (ports 5672, 15672)

## Development

### Running Services Individually

```bash
# Start API Gateway
pnpm run start:dev gateway

# Start Auth Service
pnpm run start:dev auth

# Start Notifications Service
pnpm run start:dev notifications
```

### Debug Mode

```bash
pnpm run start:debug [service-name]
```

### Testing

```bash
# Unit tests
pnpm run test

# e2e tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## API Documentation

Once the services are running, you can access the Swagger documentation:

- API Gateway: http://localhost:3000/docs
- Auth Service: http://localhost:3001/docs
- Notifications Service: http://localhost:3002/docs

## Health Checks

Each service exposes a health check endpoint:

- API Gateway: http://localhost:3000/health
- Auth Service: http://localhost:3001/health
- Notifications Service: http://localhost:3002/health

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the UNLICENSED License - see the LICENSE file for details.

## Author

Nabeel Kausari (nabeelkausari@gmail.com)
