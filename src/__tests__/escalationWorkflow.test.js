import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyLocalWorkflowAction,
  buildWorkflowCounts,
  createReopenRequest,
  getStoredWorkflowItems,
  mergeWorkflowItems,
  normalizeWorkflowItem,
} from '../lib/escalationWorkflow';
import { storage } from '../lib/storage';

describe('escalationWorkflow', () => {
  beforeEach(() => {
    storage.remove('workflow_items');
  });

  it('creates and persists reopen requests', () => {
    createReopenRequest('CASE-2', { description: 'Need to reopen' }, 'judge@example.com');

    const items = getStoredWorkflowItems();
    expect(items).toHaveLength(1);
    expect(items.map((item) => item.item_type)).toEqual(['reopen']);
  });

  it('updates local workflow actions with history entries', () => {
    const item = createReopenRequest('CASE-1', { description: 'Need to reopen' }, 'judge@example.com');
    const updated = applyLocalWorkflowAction(item.id, 'approved', 'Looks valid', 'senior@example.com');

    expect(updated.status).toBe('approved');
    expect(updated.history.at(-1).action).toBe('approved');
    expect(updated.history.at(-1).reason).toBe('Looks valid');
  });

  it('merges remote and local items and computes counts', () => {
    createReopenRequest('CASE-9', { description: 'Need to reopen' }, 'judge@example.com');

    const merged = mergeWorkflowItems(
      [normalizeWorkflowItem({ id: 'remote-1', item_type: 'escalation', status: 'pending', case_id: 'CASE-3' })],
      getStoredWorkflowItems(),
    );

    const counts = buildWorkflowCounts(merged);
    expect(counts.all).toBe(2);
    expect(counts.pending).toBe(2);
    expect(counts.reopen).toBe(1);
    expect(counts.escalation).toBe(1);
  });

  it('normalizes backend escalated status into pending queue state', () => {
    const item = normalizeWorkflowItem({
      id: 'remote-queue-1',
      case_id: 'CASE-7',
      item_type: 'escalation',
      status: 'escalated',
    });

    expect(item.status).toBe('pending');
  });

  it('maps legacy amendment item_type to escalation', () => {
    const item = normalizeWorkflowItem({
      id: 'amendment-1',
      case_id: 'CASE-5',
      item_type: 'amendment',
      status: 'pending',
    });

    expect(item.item_type).toBe('escalation');
  });
});
