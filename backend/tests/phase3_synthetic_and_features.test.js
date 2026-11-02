/**
 * SitePulse — Phase 3 Test Suite: Synthetic Data Simulation & ML Feature Store
 * Validates:
 *   1. Minimum volume (>= 250 projects) and synthetic flags
 *   2. Referential integrity across relational tables
 *   3. Date consistency & duration arithmetic
 *   4. Progress constraints (0-100%, unique trade/date pairs)
 *   5. Correct future-based label derivation
 *   6. Mathematical accuracy of engineered features
 *   7. Strict zero-leakage temporal cutoff at Day 25
 *   8. Grouped project train/val/test split separation
 */

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.resolve(__dirname, '../../data/synthetic');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].trim() : '';
    });
    return obj;
  });
}

test('Phase 3 - 1. Volume & Metadata: Generates >= 250 projects with synthetic labels', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));
  const trades = parseCSV(path.join(DATA_DIR, 'trades.csv'));
  const stores = parseCSV(path.join(DATA_DIR, 'stores.csv'));
  const updates = parseCSV(path.join(DATA_DIR, 'daily_updates.csv'));

  assert.ok(projects.length >= 250, `Expected >= 250 projects, found ${projects.length}`);
  assert.strictEqual(projects.length, 260);
  assert.strictEqual(trades.length, 1300);
  assert.strictEqual(stores.length, 260);
  assert.ok(updates.length > 50000, `Expected > 50k daily logs, found ${updates.length}`);

  // Confirm is_synthetic tag
  assert.ok(projects.every(p => p.is_synthetic === 'True' || p.is_synthetic === 'true'));
  assert.ok(updates.slice(0, 100).every(u => u.is_synthetic === 'True' || u.is_synthetic === 'true'));
});

test('Phase 3 - 2. Referential Integrity: Foreign keys resolve correctly across tables', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));
  const stores = parseCSV(path.join(DATA_DIR, 'stores.csv'));
  const trades = parseCSV(path.join(DATA_DIR, 'trades.csv'));
  const updates = parseCSV(path.join(DATA_DIR, 'daily_updates.csv'));
  const delays = parseCSV(path.join(DATA_DIR, 'delay_events.csv'));

  const storeIds = new Set(stores.map(s => s.id));
  const projectIds = new Set(projects.map(p => p.id));
  const tradeIds = new Set(trades.map(t => t.id));

  assert.ok(projects.every(p => storeIds.has(p.store_id)));
  assert.ok(trades.every(t => projectIds.has(t.project_id)));
  assert.ok(updates.slice(0, 1000).every(u => tradeIds.has(u.trade_id)));
  assert.ok(delays.every(de => projectIds.has(de.project_id) && tradeIds.has(de.trade_id)));
});

test('Phase 3 - 3. Date Consistency & Temporal Ordering', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));

  projects.forEach(p => {
    const start = new Date(p.start_date);
    const deadline = new Date(p.deadline);
    const actualEnd = new Date(p.actual_completion_date);

    assert.ok(start <= deadline, `Project ${p.id} start must be <= deadline`);
    assert.ok(start <= actualEnd, `Project ${p.id} start must be <= actualEnd`);

    const durDays = Math.round((actualEnd - start) / (1000 * 60 * 60 * 24));
    assert.strictEqual(durDays, parseInt(p.actual_duration_days, 10));

    const delay = parseInt(p.actual_duration_days, 10) - parseInt(p.planned_duration_days, 10);
    assert.strictEqual(delay, parseInt(p.delay_days, 10));
  });
});

test('Phase 3 - 4. Progress Constraints: Range [0, 100] and no duplicate trade/date updates', () => {
  const updates = parseCSV(path.join(DATA_DIR, 'daily_updates.csv'));
  const tradeDatePairs = new Set();
  let hasDuplicate = false;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const pct = parseFloat(u.progress_pct);
    assert.ok(pct >= 0.0 && pct <= 100.0, `Progress ${pct}% out of bounds`);

    const key = `${u.trade_id}_${u.date}`;
    if (tradeDatePairs.has(key)) {
      hasDuplicate = true;
      break;
    }
    tradeDatePairs.add(key);
  }
  assert.strictEqual(hasDuplicate, false, 'Encountered duplicate (trade_id, date) daily update');
});

test('Phase 3 - 5. Label Correctness: target_is_delayed_over_3d matches delay_days > 3', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));
  const features = parseCSV(path.join(DATA_DIR, 'project_features_day25.csv'));

  projects.forEach(p => {
    const delay = parseInt(p.delay_days, 10);
    const expected = delay > 3 ? '1' : '0';
    assert.strictEqual(p.is_delayed_over_3d, expected);
  });

  features.forEach(f => {
    const delay = parseInt(f.target_actual_delay_days, 10);
    const expected = delay > 3 ? '1' : '0';
    assert.strictEqual(f.target_is_delayed_over_3d, expected);
  });
});

test('Phase 3 - 6. Feature Engineering: Formula consistency aligned with vw_ml_project_features', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));
  const features = parseCSV(path.join(DATA_DIR, 'project_features_day25.csv'));

  features.slice(0, 50).forEach(f => {
    const p = projects.find(proj => proj.id === f.project_id);
    assert.ok(p, `Project ${f.project_id} not found in projects`);

    const expectedRatio = (25 / parseInt(p.planned_duration_days, 10)).toFixed(4);
    assert.strictEqual(parseFloat(f.timeline_elapsed_ratio).toFixed(4), expectedRatio);

    const expectedVariance = (parseFloat(f.overall_actual_pct) - parseFloat(f.overall_planned_pct)).toFixed(2);
    assert.strictEqual(parseFloat(f.schedule_variance_pct).toFixed(2), expectedVariance);

    const expectedDeficit = Math.max(0, parseInt(f.total_workers_required, 10) - parseInt(f.total_workers_present, 10));
    assert.strictEqual(parseInt(f.workforce_deficit, 10), expectedDeficit);
  });
});

test('Phase 3 - 7. Target Leakage Prevention: Fixed Cutoff Day 25 Guardrail', () => {
  const features = parseCSV(path.join(DATA_DIR, 'project_features_day25.csv'));
  const tradeFeatures = parseCSV(path.join(DATA_DIR, 'trade_features_day25.csv'));

  assert.ok(features.every(f => f.eval_cutoff_day === '25'));
  assert.ok(tradeFeatures.every(tf => tf.eval_cutoff_day === '25'));

  const featureHeaders = Object.keys(features[0]);
  const futureColumns = featureHeaders.filter(h => h.startsWith('future_'));
  assert.strictEqual(futureColumns.length, 0, 'No future_ prefixed columns allowed in features');
});

test('Phase 3 - 8. Grouped Project Separation: Train/Val/Test strictly disjoint', () => {
  const projects = parseCSV(path.join(DATA_DIR, 'projects.csv'));
  const train = parseCSV(path.join(DATA_DIR, 'train_features.csv'));
  const val = parseCSV(path.join(DATA_DIR, 'val_features.csv'));
  const testSet = parseCSV(path.join(DATA_DIR, 'test_features.csv'));
  const splitMeta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'split_metadata.json'), 'utf-8'));

  const trainPids = new Set(train.map(r => r.project_id));
  const valPids = new Set(val.map(r => r.project_id));
  const testPids = new Set(testSet.map(r => r.project_id));

  trainPids.forEach(pid => {
    assert.ok(!valPids.has(pid), `Train project ${pid} leaked into Val`);
    assert.ok(!testPids.has(pid), `Train project ${pid} leaked into Test`);
  });
  valPids.forEach(pid => {
    assert.ok(!testPids.has(pid), `Val project ${pid} leaked into Test`);
  });

  assert.strictEqual(trainPids.size, 182);
  assert.strictEqual(valPids.size, 39);
  assert.strictEqual(testPids.size, 39);
  assert.strictEqual(trainPids.size + valPids.size + testPids.size, 260);

  assert.strictEqual(splitMeta.train_projects_count, 182);
  assert.strictEqual(splitMeta.val_projects_count, 39);
  assert.strictEqual(splitMeta.test_projects_count, 39);
});
