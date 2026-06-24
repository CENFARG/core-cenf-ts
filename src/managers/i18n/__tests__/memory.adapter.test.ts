import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryI18nAdapter } from '../adapters/memory.adapter.js';

describe('MemoryI18nAdapter', () => {
  let adapter: MemoryI18nAdapter;

  beforeEach(() => {
    adapter = new MemoryI18nAdapter();
  });

  describe('AsyncLifecycle', () => {
    it('start() resolves successfully', async () => {
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    it('stop() resolves successfully', async () => {
      await adapter.start();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });

    it('health() returns healthy status', async () => {
      await adapter.start();
      const health = await adapter.health();
      expect(health.status).toBe('healthy');
    });
  });

  describe('t() translation', () => {
    it('returns translated string for known key', async () => {
      await adapter.loadResources('en', {
        'welcome': 'Hello, World!',
      });

      expect(adapter.t('welcome')).toBe('Hello, World!');
    });

    it('returns key itself when translation is missing', () => {
      expect(adapter.t('unknown.key')).toBe('unknown.key');
    });

    it('interpolates parameters with {{}} syntax', async () => {
      await adapter.loadResources('en', {
        'greeting': 'Hello, {{name}}!',
      });

      expect(adapter.t('greeting', { name: 'Alice' })).toBe('Hello, Alice!');
    });

    it('interpolates multiple parameters', async () => {
      await adapter.loadResources('en', {
        'order': 'Order #{{id}} for {{name}}',
      });

      expect(adapter.t('order', { id: '123', name: 'Bob' })).toBe(
        'Order #123 for Bob',
      );
    });

    it('interpolates numeric parameters', async () => {
      await adapter.loadResources('en', {
        'count': 'You have {{count}} items',
      });

      expect(adapter.t('count', { count: 5 })).toBe('You have 5 items');
    });

    it('leaves unreplaced placeholders intact', async () => {
      await adapter.loadResources('en', {
        'msg': 'Hi {{name}}, your {{type}} is ready',
      });

      expect(adapter.t('msg', { name: 'Eve' })).toBe(
        'Hi Eve, your {{type}} is ready',
      );
    });
  });

  describe('locale management', () => {
    it('default locale is "en"', () => {
      expect(adapter.getLocale()).toBe('en');
    });

    it('setLocale changes active locale', async () => {
      await adapter.loadResources('en', { 'title': 'English' });
      await adapter.loadResources('es', { 'title': 'Español' });

      await adapter.setLocale('es');
      expect(adapter.getLocale()).toBe('es');
      expect(adapter.t('title')).toBe('Español');
    });

    it('t() uses current locale after switch', async () => {
      await adapter.loadResources('en', { 'hello': 'Hello' });
      await adapter.loadResources('fr', { 'hello': 'Bonjour' });

      await adapter.setLocale('fr');
      expect(adapter.t('hello')).toBe('Bonjour');

      await adapter.setLocale('en');
      expect(adapter.t('hello')).toBe('Hello');
    });

    it('t() returns key when locale has no resources', () => {
      expect(adapter.t('missing')).toBe('missing');
    });
  });

  describe('loadResources', () => {
    it('replaces existing resources for same locale', async () => {
      await adapter.loadResources('en', { 'key': 'old' });
      await adapter.loadResources('en', { 'key': 'new' });

      expect(adapter.t('key')).toBe('new');
    });

    it('merges resources into existing locale', async () => {
      await adapter.loadResources('en', { 'a': 'A' });
      await adapter.loadResources('en', { 'b': 'B' });

      expect(adapter.t('a')).toBe('A');
      expect(adapter.t('b')).toBe('B');
    });
  });

  describe('stop() cleanup', () => {
    it('clears all resources on stop', async () => {
      await adapter.start();
      await adapter.loadResources('en', { 'hello': 'Hello' });
      await adapter.stop();

      // After stop, resources are cleared — key returns itself
      expect(adapter.t('hello')).toBe('hello');
    });
  });
});
