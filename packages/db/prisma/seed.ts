// Prisma seed — minimal fake data for local development.
//
// TODO(scaffold): implement once the schema has real models. Intended seed:
//   2 courses, 3 materials, 1 event, 1 partner with 1 offer, 1 reward.
// Run with: npm run db:seed

async function main() {
  // eslint-disable-next-line no-console
  console.log("[seed] No models yet — schema is deferred. Nothing to seed.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
