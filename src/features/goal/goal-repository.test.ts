import { beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/storage/database';
import { GoalRepository } from '@/storage/goal-repository';
import { SettingsRepository } from '@/storage/settings-repository';

describe('GoalRepository', () => {
  let repo: GoalRepository;
  let settings: SettingsRepository;

  beforeEach(async () => {
    const db = createDatabase(`goal-test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new GoalRepository(db);
    settings = new SettingsRepository();
    await settings.update({ activeGoalId: undefined });
  });

  it('creates a goal and lists it newest-first', async () => {
    const a = await repo.create({ text: 'Backend engineering' });
    const b = await repo.create({ text: 'Public speaking' });
    const list = await repo.list();
    expect(list.map((g) => g.id)).toEqual([b.id, a.id]);
    expect(a.text).toBe('Backend engineering');
  });

  it('rejects an empty goal', async () => {
    await expect(repo.create({ text: '   ' })).rejects.toThrow();
  });

  it('updates a goal', async () => {
    const g = await repo.create({ text: 'Old' });
    const updated = await repo.update(g.id, { text: 'New' });
    expect(updated.text).toBe('New');
    expect(updated.createdAt).toBe(g.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(g.updatedAt);
  });

  it('updates structured metadata', async () => {
    const g = await repo.create({ text: 'Goal' });
    const updated = await repo.update(g.id, { domains: ['api'], topics: ['design'] });
    expect(updated.domains).toEqual(['api']);
    expect(updated.topics).toEqual(['design']);
  });

  it('removes a goal', async () => {
    const g = await repo.create({ text: 'To delete' });
    await repo.remove(g.id);
    expect(await repo.get(g.id)).toBeUndefined();
  });

  it('stores activeGoalId in settings', async () => {
    const g = await repo.create({ text: 'Active' });
    await settings.update({ activeGoalId: g.id });
    const loaded = await settings.get();
    expect(loaded.activeGoalId).toBe(g.id);
  });
});
