import { state } from './state.js';

export async function loadCSVMeta() {
  if (state.csvs.length) return state.csvs;
  const r = await fetch('/api/csvs');
  state.csvs = await r.json();
  return state.csvs;
}

export async function loadCSVData(filename) {
  if (state.csvData[filename]) return state.csvData[filename];
  const r = await fetch(`/api/csv/${encodeURIComponent(filename)}`);
  state.csvData[filename] = await r.json();
  return state.csvData[filename];
}