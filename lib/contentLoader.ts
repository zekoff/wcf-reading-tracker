import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Section {
  number: number;
  text: string;
  footnotes?: string[];
  crossReferences?: string[];
}

export interface Chapter {
  number: number;
  title: string;
  sections: Section[];
}

export interface WCFContent {
  chapters: Chapter[];
}

let cached: WCFContent | null = null;

// Content currently ships as a static JSON file (generated from the WCF +
// Scripture Proofs PDF by scripts/parse-wcf.py) and is read from disk here
// rather than statically imported, so it's never bundled into client code.
// This is the only place that should know that -- everything else depends
// on WCFContent, so the source can be swapped later without touching
// UI or data layers.
export async function getWCFContent(): Promise<WCFContent> {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "public", "wcf-content.json");
  const raw = await readFile(filePath, "utf-8");
  cached = JSON.parse(raw) as WCFContent;
  return cached;
}
