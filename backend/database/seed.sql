-- Seed data for PostgreSQL database
INSERT INTO users (username, email, password, full_name)
VALUES ('admin', 'admin@example.com', '$2a$12$.NifCEunTbm0Q7mpJmCS3OsKigZvlwWYNSIRn6lGfasceRI965Y6u', 'Administrador')
ON CONFLICT (username) DO NOTHING;
