# Database migrations

The production database is PostgreSQL. Migration files will be generated from the SQLAlchemy models before the first production deployment. Development SQLite creation is limited to local bootstrapping and is not a production migration strategy.
