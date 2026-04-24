import { storage } from './storage';

const WORKFLOW_STORAGE_KEY = 'workflow_items';

const normalizeStatus = (status) => {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'escalated') return 'pending';
  if (value === 'approve') return 'approved';
  if (value === 'reject') return 'rejected';
  return value;
};

const normalizeItemType = (value) => {
  const itemType = String(value || 'escalation').toLowerCase();
  if (itemType === 'reopen_request') return 'reopen';
  if (itemType === 'amendment') return 'escalation';
  return itemType;
};

const normalizeHistoryEntry = (entry, index = 0) => ({
  id: entry?.id || `history-${index}`,
  action: entry?.action || entry?.status || 'created',
  reason: entry?.reason || entry?.note || '',
  actor: entry?.actor || entry?.actor_email || entry?.reviewed_by || entry?.submitter || 'System',
  created_at: entry?.created_at || entry?.timestamp || new Date().toISOString(),
  assignee: entry?.assignee || entry?.assigned_to || null,
});

export const normalizeWorkflowItem = (item, index = 0) => {
  const itemType = normalizeItemType(item?.item_type || item?.type);
  const id = String(item?.id || item?.request_id || item?.workflow_id || `${itemType}-${index}`);
  const status = normalizeStatus(item?.status);
  const caseId = String(item?.case_id || item?.caseId || item?.case?.id || 'unknown');
  const history = Array.isArray(item?.history)
    ? item.history.map(normalizeHistoryEntry)
    : [];

  return {
    ...item,
    id,
    backendId: id,
    case_id: caseId,
    item_type: itemType,
    status,
    case_title: item?.case_title || item?.title || null,
    title: item?.title || item?.case_title || `Case ${caseId}`,
    description: item?.description || item?.reason || item?.preview || item?.summary || '',
    preview: item?.preview || item?.summary || item?.description || '',
    context: item?.context || item?.details || item?.preview || '',
    details: item?.details || item?.context || '',
    originating_judge:
      item?.originating_judge || item?.submitter || item?.requested_by || item?.created_by || null,
    submitter:
      item?.submitter ||
      item?.originating_judge ||
      item?.requested_by ||
      item?.created_by ||
      'Unknown',
    domain: item?.domain || item?.case?.domain || null,
    submitted_at: item?.submitted_at || item?.created_at || new Date().toISOString(),
    assignee: item?.assignee || item?.assigned_to || null,
    priority: item?.priority || 'medium',
    source: item?.source || 'remote',
    history,
  };
};

export const getStoredWorkflowItems = () => {
  const items = storage.get(WORKFLOW_STORAGE_KEY) || [];
  return items.map((item, index) => normalizeWorkflowItem(item, index));
};

const persistWorkflowItems = (items) => {
  storage.set(WORKFLOW_STORAGE_KEY, items);
};

export const saveWorkflowItem = (item) => {
  const current = getStoredWorkflowItems();
  const next = [...current.filter((entry) => entry.id !== item.id), normalizeWorkflowItem(item)];
  persistWorkflowItems(next);
  return next;
};

export const updateStoredWorkflowItem = (itemId, updater) => {
  const current = getStoredWorkflowItems();
  const next = current.map((item) => {
    if (item.id !== String(itemId)) return item;
    return normalizeWorkflowItem(updater(item));
  });
  persistWorkflowItems(next);
  return next.find((item) => item.id === String(itemId)) || null;
};

export const getCaseWorkflowItems = (caseId) =>
  getStoredWorkflowItems().filter((item) => String(item.case_id) === String(caseId));

export const mergeWorkflowItems = (remoteItems = [], localItems = []) => {
  const merged = new Map();

  remoteItems.forEach((item, index) => {
    const normalized = normalizeWorkflowItem(item, index);
    merged.set(normalized.id, normalized);
  });

  localItems.forEach((item, index) => {
    const normalized = normalizeWorkflowItem(item, index);
    merged.set(normalized.id, normalized);
  });

  return [...merged.values()].sort(
    (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime(),
  );
};

export const buildWorkflowCounts = (items = []) => ({
  all: items.length,
  escalation: items.filter((item) => item.item_type === 'escalation').length,
  reopen: items.filter((item) => item.item_type === 'reopen').length,
  pending: items.filter((item) => item.status === 'pending').length,
});

export const splitWorkflowItemsBySource = (items = []) => ({
  remote: items.filter((item) => item.source !== 'local'),
  local: items.filter((item) => item.source === 'local'),
});

const createLocalWorkflowItem = (caseId, itemType, payload, actor) => {
  const submittedAt = new Date().toISOString();
  const id = `local-${itemType}-${caseId}-${Date.now()}`;

  return normalizeWorkflowItem({
    id,
    case_id: caseId,
    item_type: itemType,
    status: 'pending',
    title: payload.title || `Case ${caseId}`,
    description: payload.description,
    context: payload.context || '',
    details: payload.details || '',
    submitter: actor,
    submitted_at: submittedAt,
    source: 'local',
    priority: payload.priority || 'high',
    history: [
      {
        action: 'created',
        reason: payload.description,
        actor,
        created_at: submittedAt,
      },
    ],
  });
};

export const createReopenRequest = (caseId, payload, actor) => {
  const item = createLocalWorkflowItem(caseId, 'reopen', payload, actor);
  saveWorkflowItem(item);
  return item;
};

export const applyLocalWorkflowAction = (itemId, action, reason, actor, assignee = null) =>
  updateStoredWorkflowItem(itemId, (item) => {
    const nextStatus = normalizeStatus(action === 'reassign' || action === 'info_requested' ? 'pending' : action);
    const submittedAt = new Date().toISOString();

    return {
      ...item,
      status: nextStatus,
      assignee: assignee || item.assignee || null,
      history: [
        ...(item.history || []),
        normalizeHistoryEntry({
          action,
          reason,
          actor,
          assignee,
          created_at: submittedAt,
        }),
      ],
    };
  });

