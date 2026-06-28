#!/bin/bash
echo "Generating Prisma client..."
npx prisma generate
echo "Running migrations..."
npx prisma migrate dev --name init
echo "Done! Database is ready."
