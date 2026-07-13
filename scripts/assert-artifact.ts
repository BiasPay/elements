import { readFileSync } from "node:fs";

const [mode, ...files] = process.argv.slice(2);
if (mode !== "production" && mode !== "development") {
    throw new Error('First argument must be "production" or "development".');
}
if (files.length === 0) throw new Error(`Pass at least one ${mode} artifact to inspect.`);

const endpoints = {
    production: ["https://api.biaspay.com", "https://field.biaspay.com"],
    development: ["https://api.bias.localhost", "https://field.bias.localhost"],
} as const;
const artifact = files.map((file) => readFileSync(file, "utf8")).join("\n");

for (const value of endpoints[mode]) {
    if (!artifact.includes(value)) throw new Error(`${mode} artifact is missing ${value}.`);
}
for (const value of endpoints[mode === "production" ? "development" : "production"]) {
    if (artifact.includes(value)) throw new Error(`${mode} artifact contains ${value}.`);
}
for (const value of ["VITE_BIAS_API_URL", "VITE_BIAS_FIELD_FRAME_URL"]) {
    if (artifact.includes(value)) throw new Error(`${mode} artifact contains ${value}.`);
}
