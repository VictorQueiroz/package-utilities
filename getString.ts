export default function getString(args: string[], name: string): string | null {
  let out: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== name) {
      continue;
    }
    args.splice(i, 1);

    if (args[i].startsWith("-") || args[i].startsWith("--")) {
      return null;
    }
    out = args.splice(i, 1)[0] ?? null;
    break;
  }
  return out;
}
