import { state } from './state.js';

export async function loadCSVMeta() {
  if (state.csvs.length) return state.csvs;
  const r = await fetch('data/csvs-meta.json');
  state.csvs = await r.json();
  return state.csvs;
}

export async function loadCSVData(filename) {
  if (state.csvData[filename]) return state.csvData[filename];
  const jsonName = filename.replace(/\.csv$/i, '') + '.json';
  const safeName = jsonName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const r = await fetch(`data/csv/${safeName}`);
  state.csvData[filename] = await r.json();
  return state.csvData[filename];
}