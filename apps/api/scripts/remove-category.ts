// One-off cleanup — strips a category/tag value from every PandalYear that
// has it, e.g. removing "Family Friendly" after deciding it wasn't a useful
// filter (it described nearly every pandal). Run once against the live DB:
//   pnpm --filter @durgapandals/api exec tsx scripts/remove-category.ts "Family Friendly"
import "../src/load-env";
import { loadServerEnv } from "@durgapandals/config";
import { connectDatabase, PandalYearModel } from "@durgapandals/database";

async function main() {
  const value = process.argv[2];
  if (!value) {
    console.error('Usage: tsx scripts/remove-category.ts "Category Name"');
    process.exit(1);
  }

  const env = loadServerEnv();
  await connectDatabase({ uri: env.MONGODB_URI });

  const [categoriesResult, tagsResult] = await Promise.all([
    PandalYearModel.updateMany({ categories: value }, { $pull: { categories: value } }),
    PandalYearModel.updateMany({ tags: value }, { $pull: { tags: value } }),
  ]);

  console.log(
    `Removed "${value}" from ${categoriesResult.modifiedCount} pandal-year categories and ${tagsResult.modifiedCount} tag lists.`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
