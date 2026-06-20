export async function detectProjectType(path: string): Promise<"node" | "python" | "unknown"> {
  if (!(window as any).os || !(window as any).os.listDir) return "unknown";

  try {
    const files = await (window as any).os.listDir(path);
    const names = files.map((f: any) => f.name);
    if (names.includes("package.json")) return "node";
    if (names.includes("pyproject.toml") || names.includes("requirements.txt")) return "python";
    return "unknown";
  } catch (err) {
    console.error("Failed to detect project type", err);
    return "unknown";
  }
}
