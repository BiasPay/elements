import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("dist-types");
const destinationDir = path.resolve("dist");
const entry = "index.d.ts";
// Elements bundle the checkout SDK, which isn't published, so shipped types can't name it.
const unpublished = "@biaspay/sdk-checkout";

const isFile = (file: string) =>
    stat(file).then(
        (stats) => stats.isFile(),
        () => false,
    );

async function resolveDeclaration(from: string, specifier: string): Promise<string> {
    const base = path.resolve(path.dirname(from), specifier.replace(/\.(ts|js)$/, ""));
    for (const candidate of [`${base}.d.ts`, path.join(base, "index.d.ts")]) {
        if (await isFile(candidate)) return candidate;
    }
    throw new Error(
        `${path.relative(sourceDir, from)} imports ${specifier}, which has no declaration.`,
    );
}

/** tsc keeps the `~/*` tsconfig alias in declarations, but consumers can't resolve it. */
function rewriteAliases(file: string, source: string): string {
    return source.replace(/(["'])~\/([^"']+)\1/g, (_, quote: string, target: string) => {
        const relative = path.relative(path.dirname(file), path.join(sourceDir, target));
        return `${quote}${relative.startsWith(".") ? relative : `./${relative}`}${quote}`;
    });
}

/** The declarations reachable from the package entry, with aliases rewritten. */
async function findShippedFiles(): Promise<Map<string, string>> {
    const shipped = new Map<string, string>();
    const queue = [path.join(sourceDir, entry)];
    while (queue.length) {
        const file = queue.pop()!;
        if (shipped.has(file)) continue;
        const source = rewriteAliases(file, await readFile(file, "utf8"));
        shipped.set(file, source);
        if (source.includes(unpublished)) {
            throw new Error(`${path.relative(sourceDir, file)} references ${unpublished}.`);
        }
        for (const [, specifier] of source.matchAll(
            /(?:from |import\()["'](\.{1,2}\/[^"']+)["']/g,
        )) {
            queue.push(await resolveDeclaration(file, specifier!));
        }
    }
    return shipped;
}

try {
    const files = await findShippedFiles();
    await Promise.all(
        [...files].map(async ([file, source]) => {
            const destinationPath = path.join(destinationDir, path.relative(sourceDir, file));
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await writeFile(destinationPath, source);
        }),
    );
    console.log(`Copied ${files.size} type declarations to dist.`);
} finally {
    await rm(sourceDir, { recursive: true, force: true });
}
